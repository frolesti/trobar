const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(require.resolve('../app/src/screens/BarDashboard/BarDashboardScreen.tsx'), 'utf8');
const parsed = ts.createSourceFile('Dashboard.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let save;
function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === 'handleSaveProfile') save = node.initializer.getText(parsed);
    ts.forEachChild(node, visit);
}
visit(parsed);

test('owner rating visibility persists both on and off and failures never change the public preview', async () => {
    for (const enabled of [true, false]) for (const fail of [true, false]) {
        const writes = [], toasts = [];
        let current = { id: 'bar', showGoogleRating: !enabled };
        let saving = false;
        const context = {
            bar: current, showGoogleRating: enabled,
            profileDraftRef: { current: { showGoogleRating: enabled } }, savedProfile: { current: '' },
            setSaving(value) { saving = value; },
            savingRef: { current: false },
            setBar(update) { current = update(current); },
            async updateBarProfile(id, data) {
                writes.push({ id, data });
                if (fail) throw new Error('Rejected write');
            },
            showToast(message, type) { toasts.push(type); },
            console: { error() {}, info() {} },
        };
        vm.createContext(context);
        vm.runInContext(ts.transpileModule(`globalThis.save = ${save}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
        await context.save();
        assert.deepEqual(JSON.parse(JSON.stringify(writes)), [{ id: 'bar', data: { showGoogleRating: enabled } }]);
        assert.equal(current.showGoogleRating, fail ? !enabled : enabled);
        assert.equal(saving, false);
        assert.equal(context.savingRef.current, false);
        assert.deepEqual(toasts, [fail ? 'error' : 'success']);
    }
});

function saveHarness(fail = false) {
    const writes = [], toasts = [];
    let current = { id: 'bar', description: 'Old', showGoogleRating: false };
    const context = {
        bar: current, description: '  New description  ', promotionalText: '',
        profileDraftRef: { current: {
            description: 'New description', promotionalText: '', socialMedia: { instagram: 'elnostrebar', website: 'https://example.test' },
            amenities: ['wifi'], broadcastingMatches: ['match'], showGoogleRating: true,
        } },
        savedProfile: { current: '' },
        socials: { instagram: '  elnostrebar  ', website: ' https://example.test ', facebook: '  ' },
        SOCIAL_NETWORKS: [{ key: 'instagram' }, { key: 'website' }, { key: 'facebook' }],
        selectedAmenities: new Set(['wifi']), broadcastingIds: new Set(['match']), showGoogleRating: true,
        savingRef: { current: false }, saving: false, savingSection: null,
        setSaving(value) { context.saving = value; },
        setSavingSection(value) { context.savingSection = value; },
        setBar(update) { current = update(current); },
        async updateBarProfile(id, data) {
            writes.push({ id, data });
            if (fail) throw new Error('Sensitive API details');
        },
        showToast(message, type) { toasts.push({ message, type }); },
        console: { info() {} },
    };
    vm.createContext(context);
    vm.runInContext(ts.transpileModule(`globalThis.save = ${save}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
    return { context, writes, toasts, current: () => current };
}

test('one save persists all fields and failures preserve every draft and the saved baseline', async () => {
    for (const fail of [false, true]) {
        const { context, writes, toasts, current } = saveHarness(fail);
        const expected = context.profileDraftRef.current;
        const success = await context.save();
        assert.equal(success, !fail);
        assert.deepEqual(JSON.parse(JSON.stringify(writes)), [{ id: 'bar', data: expected }]);
        assert.equal(toasts[0].type, fail ? 'error' : 'success');
        assert(!toasts[0].message.includes('Sensitive API'));
        assert.equal(context.description, '  New description  ');
        assert.equal(context.socials.instagram, '  elnostrebar  ');
        assert.equal(context.savingRef.current, false);
        assert.equal(context.saving, false);
        assert.equal(context.savingSection, null);
        assert.equal(context.savedProfile.current, fail ? '' : JSON.stringify(expected));
        if (fail) assert.deepEqual(current(), { id: 'bar', description: 'Old', showGoogleRating: false });
        else for (const [key, value] of Object.entries(expected)) {
            assert.deepEqual(JSON.parse(JSON.stringify(current()[key] ?? null)), value);
        }
    }
});

test('rapid saves share a synchronous lock and edits during the write are not overwritten', async () => {
    const { context, writes, current } = saveHarness();
    let finish;
    context.updateBarProfile = async (id, data) => {
        writes.push({ id, data });
        await new Promise(resolve => { finish = resolve; });
    };
    const pending = context.save();
    context.description = 'A newer draft';
    context.profileDraftRef.current = { ...context.profileDraftRef.current, description: 'A newer draft' };
    await context.save();
    await context.save();
    assert.equal(writes.length, 1);
    assert.equal(current().description, 'Old');
    finish();
    assert.equal(await pending, false, 'newer edits must prevent save-and-leave');
    assert.equal(current().description, 'New description');
    assert.equal(current().showGoogleRating, true);
    assert.equal(context.description, 'A newer draft');
    assert.equal(context.savingRef.current, false);
    context.updateBarProfile = async (id, data) => writes.push({ id, data });
    assert.equal(await context.save(), true);
    assert.equal(writes.length, 2);
    assert.equal(current().description, 'A newer draft');
});

test('public bar mapping preserves explicit opt-in and defaults existing bars to hidden', () => {
    const barSource = fs.readFileSync(require.resolve('../app/src/services/barService.ts'), 'utf8');
    const barTree = ts.createSourceFile('barService.ts', barSource, ts.ScriptTarget.Latest, true);
    let mapper;
    function find(node) {
        if (ts.isVariableDeclaration(node) && node.name.getText(barTree) === 'mapDocToBar') mapper = node.initializer.getText(barTree);
        ts.forEachChild(node, find);
    }
    find(barTree);
    const context = {
        getBarCoordinates: () => ({ latitude: 41, longitude: 2 }),
        enrichPremiumDemoBar: bar => bar,
        console,
    };
    vm.createContext(context);
    vm.runInContext(ts.transpileModule(`globalThis.map = ${mapper}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
    for (const value of [undefined, false, true, 'true', 1]) {
        const mapped = context.map({ id: 'bar', data: () => ({ showGoogleRating: value }) });
        assert.equal(mapped.showGoogleRating, value === true);
    }
});
