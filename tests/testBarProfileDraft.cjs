const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 } }).outputText;
const source = fs.readFileSync(require.resolve('../app/src/screens/BarDashboard/BarDashboardScreen.tsx'), 'utf8');
const ast = ts.createSourceFile('Dashboard.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function initializer(name) {
    let result;
    const visit = node => { if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) result = node.initializer.getText(ast); ts.forEachChild(node, visit); };
    visit(ast);
    assert(result, name);
    return result;
}

test('profile normalization ignores order and whitespace, preserves explicit false and clears removed fields', () => {
    const module = { exports: {} };
    vm.runInNewContext(compile(fs.readFileSync(require.resolve('../app/src/utils/barProfileDraft.ts'), 'utf8')), { exports: module.exports });
    const normalize = value => JSON.parse(JSON.stringify(module.exports.barProfileDraft(value)));
    assert.deepEqual(normalize({
        description: ' Local ', promotionalText: ' ', socialMedia: { instagram: ' @local ', twitter: '' },
        amenities: ['wifi', 'parking', 'wifi'], broadcastingMatches: ['2', '1'], showGoogleRating: false,
    }), {
        description: 'Local', promotionalText: '', socialMedia: { instagram: '@local' },
        amenities: ['parking', 'wifi'], broadcastingMatches: ['1', '2'], showGoogleRating: false, reservationUrl: '', fullMatchIds: [],
    });
    assert.deepEqual(normalize({}), {
        description: '', promotionalText: '', socialMedia: {}, amenities: [], broadcastingMatches: [], showGoogleRating: false, reservationUrl: '', fullMatchIds: [],
    });
});

test('Firestore profile update replaces the social map instead of merging back deleted links', async () => {
    const module = { exports: {} };
    const stored = { ownerId: 'owner', socialMedia: { twitter: 'old', instagram: 'old' } };
    vm.runInNewContext(compile(fs.readFileSync(require.resolve('../app/src/services/barOwnerService.ts'), 'utf8')), {
        exports: module.exports, require(name) {
            if (name === 'firebase/firestore') return {
                doc: (...args) => args.at(-1), serverTimestamp: () => 'now',
                updateDoc: async (_ref, update) => Object.assign(stored, update),
                setDoc: () => { throw new Error('Nested merge would retain removed social links'); },
            };
            if (name === 'firebase/storage') return {};
            if (name.endsWith('config/firebase')) return { db: {} };
            if (name.endsWith('api/core')) return { executeOrThrow: callback => callback() };
            if (name.endsWith('barReservations')) return {};
            throw new Error(name);
        },
    });
    await module.exports.updateBarProfile('bar', { socialMedia: { instagram: 'new' }, promotionalText: '' });
    assert.equal(stored.socialMedia.twitter, undefined);
    assert.equal(stored.socialMedia.instagram, 'new');
    assert.equal(stored.promotionalText, '');
    assert.equal(stored.ownerId, 'owner');
});

test('leaving prompts only for unsaved changes; repeated attempts and in-flight writes cannot navigate', () => {
    const context = {
        hasChanges: true, savingRef: { current: false }, showUnsavedChanges: false,
        leaveAction: { current: null }, setShowUnsavedChanges(value) { context.showUnsavedChanges = value; },
        setAllowLeave(value) { context.allowLeave = value; },
    };
    vm.runInNewContext(compile(`globalThis.requestLeave = ${initializer('requestLeave')}; globalThis.continueLeaving = ${initializer('continueLeaving')};`), context);
    const calls = [];
    context.requestLeave(() => calls.push('map'));
    assert.equal(context.showUnsavedChanges, true);
    assert.deepEqual(calls, []);
    context.requestLeave(() => calls.push('replacement'));
    context.continueLeaving();
    assert.equal(context.allowLeave, true);
    context.leaveAction.current();
    assert.deepEqual(calls, ['map']);
    context.hasChanges = false;
    context.requestLeave(() => calls.push('legal'));
    assert.deepEqual(calls, ['map', 'legal']);
    context.savingRef.current = true;
    context.requestLeave(() => calls.push('logout'));
    assert.deepEqual(calls, ['map', 'legal']);
});

test('confirmation saves before leaving and stays open when persistence fails or a newer draft remains', async () => {
    let button;
    const visit = node => {
        if (ts.isJsxElement(node) && node.openingElement.attributes.properties.some(attribute =>
            attribute.name?.getText(ast) === 'testID' && attribute.initializer?.text === 'bar-leave-save')) button = node.getText(ast);
        ts.forEachChild(node, visit);
    };
    visit(ast);
    for (const success of [true, false]) {
        const calls = [];
        let finish;
        const context = {
            React, TouchableOpacity: 'TouchableOpacity', Text: 'Text', AppIcon: 'AppIcon', saving: false, styles: {},
            handleSaveProfile: () => { calls.push('save'); return new Promise(resolve => { finish = resolve; }); },
            continueLeaving: () => calls.push('leave'),
        };
        vm.runInNewContext(compile(`globalThis.render = () => (${button});`), context);
        const promise = context.render().props.onPress();
        assert.deepEqual(calls, ['save']);
        finish(success);
        await promise;
        assert.deepEqual(calls, success ? ['save', 'leave'] : ['save']);
    }
});

test('cancel keeps drafts and discard restores every persisted field without writing', () => {
    const buttons = new Map();
    const visit = node => {
        if (ts.isJsxElement(node)) {
            const id = node.openingElement.attributes.properties.find(attribute => attribute.name?.getText(ast) === 'testID');
            if (id?.initializer?.text?.startsWith('bar-leave-')) buttons.set(id.initializer.text, node.getText(ast));
        }
        ts.forEachChild(node, visit);
    };
    visit(ast);
    const calls = [];
    const stored = { description: 'Saved', promotionalText: '', socialMedia: {}, amenities: [], broadcastingMatches: ['a'], showGoogleRating: false, reservationUrl: 'https://bar.example/reservar', fullMatchIds: ['a'] };
    const context = {
        React, TouchableOpacity: 'TouchableOpacity', Text: 'Text', AppIcon: 'AppIcon', saving: false, styles: {},
        bar: { ...stored, amenities: ['legacy'] }, savedProfile: { current: JSON.stringify(stored) },
        leaveAction: { current: () => {} },
        setShowUnsavedChanges: value => calls.push(['modal', value]),
        continueLeaving: () => calls.push(['leave']),
    };
    for (const setter of ['Description', 'PromotionalText', 'Socials', 'SelectedAmenities', 'BroadcastingIds', 'ShowGoogleRating', 'ReservationLink', 'FullMatchIds']) {
        context[`set${setter}`] = value => { context[setter] = value; };
    }
    vm.runInNewContext(compile(`globalThis.cancel = () => (${buttons.get('bar-leave-cancel')}); globalThis.discard = () => (${buttons.get('bar-leave-discard')});`), context);
    context.Description = 'Draft';
    context.cancel().props.onPress();
    assert.equal(context.Description, 'Draft');
    assert.equal(context.leaveAction.current, null);
    assert.deepEqual(calls, [['modal', false]]);
    calls.length = 0;
    context.discard().props.onPress();
    assert.equal(context.Description, 'Saved');
    assert.equal(context.PromotionalText, '');
    assert.deepEqual([...context.BroadcastingIds], ['a']);
    assert.deepEqual([...context.SelectedAmenities], [], 'discard restores the editable baseline, not filtered-out legacy values');
    assert.equal(context.ShowGoogleRating, false);
    assert.equal(context.ReservationLink, stored.reservationUrl);
    assert.deepEqual([...context.FullMatchIds], ['a']);
    assert.deepEqual(calls, [['leave']]);
});
