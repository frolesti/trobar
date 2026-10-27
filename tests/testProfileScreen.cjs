const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

function profileHarness() {
    const slots = [];
    let index = 0;
    let dirty = true;
    let effects = [];
    let tree;
    let rejectSave = false;
    let pendingWrite = null;
    let pendingRefresh = null;
    let removeGuard;
    let user = { id: 'test-user', name: 'Anna', surname: 'Garcia', email: 'anna@example.test', avatar: '', role: 'user' };
    const writes = [];
    const timers = new Map();
    let timerId = 0;
    const hooks = {
        ...React,
        useState(initial) {
            const slot = index++;
            if (!(slot in slots)) slots[slot] = initial;
            return [slots[slot], value => {
                const next = typeof value === 'function' ? value(slots[slot]) : value;
                if (!Object.is(next, slots[slot])) { slots[slot] = next; dirty = true; }
            }];
        },
        useRef(initial) {
            const slot = index++;
            if (!(slot in slots)) slots[slot] = { current: initial };
            return slots[slot];
        },
        useEffect(effect, dependencies) {
            const slot = index++;
            if (!slots[slot] || dependencies.some((value, offset) => !Object.is(value, slots[slot][offset]))) {
                slots[slot] = dependencies;
                effects.push(effect);
            }
        },
    };
    const theme = { granaDeep: '#7a0033', grana: '#a50044', masculine: '#8C003B', fontRegular: 'Barlow_400Regular', fontBold: 'Barlow_600SemiBold' };
    let appStateHandler;
    const native = { StyleSheet: { create: value => value }, Platform: { OS: 'ios' }, AppState: { addEventListener: (_name, callback) => { appStateHandler = callback; return { remove() {} }; } } };
    for (const name of ['View', 'Image', 'TouchableOpacity', 'TextInput', 'ActivityIndicator', 'ScrollView', 'KeyboardAvoidingView', 'Modal']) native[name] = name;
    function load(file) {
        const module = { exports: {} };
        vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText, {
            module, exports: module.exports, console,
            setTimeout: callback => { const id = ++timerId; timers.set(id, callback); return id; },
            clearTimeout: id => timers.delete(id),
            require(name) {
                if (name === 'react') return hooks;
                if (name === 'react-native') return native;
                if (name === 'react-native-safe-area-context') return { SafeAreaView: 'SafeAreaView' };
                if (name === '@react-navigation/native') return { useNavigation: () => navigation, useIsFocused: () => true, usePreventRemove: (enabled, callback) => { removeGuard = { enabled, callback }; } };
                if (name === 'expo-status-bar') return { StatusBar: 'StatusBar' };
                if (name.includes('AuthContext')) return { useAuth: () => ({ user, isLoading: false, logout: async () => {}, refreshProfile: async () => { await pendingRefresh; } }) };
                if (name.includes('userService')) return { updateUserProfile: async (id, data) => { writes.push({ id, data }); await pendingWrite; if (rejectSave) throw new Error('Save failed'); user = { ...user, ...data }; } };
                if (name.includes('errorHandler')) return { getUserFriendlyError: (_error, fallback) => fallback };
                if (name.includes('editorialTheme')) return { EDITORIAL: theme };
                if (name.endsWith('ProfileScreen.styles')) return { __esModule: true, default: load(path.join(path.dirname(file), 'ProfileScreen.styles.ts')) };
                return { __esModule: true, default: name.endsWith('AppText') ? 'Text' : name.endsWith('AppIcon') ? 'AppIcon' : 'SettingsModal' };
            },
        });
        return module.exports.default;
    }
    const actions = [];
    const navigation = { navigate() {}, replace() {}, canGoBack: () => false, dispatch: action => actions.push(action) };
    const Screen = load(path.join(__dirname, '../app/src/screens/Profile/ProfileScreen.tsx'));
    const render = () => {
        for (let attempts = 0; attempts < 10; attempts++) {
            if (!dirty) return tree;
            dirty = false;
            index = 0;
            tree = Screen();
            const pending = effects;
            effects = [];
            pending.forEach(effect => effect());
        }
        throw new Error('Profile did not settle');
    };
    const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : node?.props ? [node, ...nodes(node.props.children)] : [];
    const text = node => Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : typeof node === 'string' ? node : '';
    const find = predicate => nodes(render()).find(predicate);
    return {
        render, writes, actions,
        field: label => find(node => node.type === 'TextInput' && node.props.accessibilityLabel === label),
        retry: () => find(node => node.props.accessibilityLabel === 'Reintentar desar el perfil'),
        find, text: () => text(render()),
        rejectSave: value => { rejectSave = value; },
        pauseSaves: () => { let release; pendingWrite = new Promise(resolve => { release = resolve; }); return () => { pendingWrite = null; release(); }; },
        pauseRefresh: () => { let release; pendingRefresh = new Promise(resolve => { release = resolve; }); return () => { pendingRefresh = null; release(); }; },
        updateAvatar: () => { user = { ...user, avatar: 'https://example.test/avatar.png' }; dirty = true; render(); },
        removeGuard: () => { render(); return removeGuard; },
        flush: async () => { const pending = [...timers.values()]; timers.clear(); pending.forEach(callback => callback()); for (let turn = 0; turn < 20; turn++) { await Promise.resolve(); render(); } },
        background: async () => { appStateHandler('background'); for (let turn = 0; turn < 20; turn++) { await Promise.resolve(); render(); } },
    };
}

test('profile embeds preferences and autosaves trimmed fields without a save button or modal', async () => {
    const profile = profileHarness();
    assert.equal(profile.render().props.style.backgroundColor, '#7a0033');
    assert(profile.find(node => node.type === 'View' && node.props.style?.flexDirection === 'row' && node.props.style.backgroundColor === '#7a0033'));
    assert(profile.find(node => node.type === 'ScrollView'));
    assert(profile.find(node => node.type === 'KeyboardAvoidingView'));
    assert.equal(profile.field('Nom').props.style.fontFamily, 'Barlow_400Regular');
    assert.equal(typeof profile.field('Nom').props.onEndEditing, 'function');
    assert.doesNotMatch(profile.text(), /Desar canvis|Descartar canvis/);
    assert.equal(profile.removeGuard().enabled, false);
    profile.field('Nom').props.onChangeText('  Maria  ');
    profile.render();
    assert.equal(profile.removeGuard().enabled, true);
    assert.equal(profile.find(node => node.type === 'Modal'), undefined);
    await profile.flush();
    assert.deepEqual(JSON.parse(JSON.stringify(profile.writes)), [{ id: 'test-user', data: { name: 'Maria', surname: 'Garcia' } }]);
    assert.match(profile.text(), /Canvis desats/);
    assert.equal(profile.removeGuard().enabled, false);
    assert.doesNotMatch(profile.text(), /Toca la càmera|TANCAR SESSIÓ/);
    assert.equal(profile.find(node => node.type === 'SettingsModal').props.visible, true);
});

test('avatar refresh preserves name edits and empty names cannot be saved', async () => {
    const profile = profileHarness();
    profile.field('Nom').props.onChangeText('Nom pendent');
    profile.updateAvatar();
    assert.equal(profile.field('Nom').props.value, 'Nom pendent');
    profile.field('Nom').props.onChangeText('   ');
    profile.render();
    await profile.flush();
    assert.equal(profile.writes.length, 0);
    assert.match(profile.text(), /El nom no pot quedar buit/);
});

test('failed profile saves retain edits, expose an error and can be retried', async () => {
    const profile = profileHarness();
    profile.field('Cognoms').props.onChangeText('Soler');
    profile.rejectSave(true);
    await profile.flush();
    assert.equal(profile.field('Cognoms').props.value, 'Soler');
    assert(profile.find(node => node.props.accessibilityRole === 'alert'));
    assert(profile.retry());
    profile.rejectSave(false);
    profile.retry().props.onPress();
    await profile.flush();
    assert.match(profile.text(), /Canvis desats/);
});

test('leaving or backgrounding the profile persists the pending edit before navigation', async () => {
    const profile = profileHarness();
    profile.field('Nom').props.onChangeText('Maria');
    profile.removeGuard().callback({ data: { action: { type: 'GO_BACK' } } });
    await profile.flush();
    assert.equal(profile.actions.length, 1);
    assert.equal(profile.writes[0].data.name, 'Maria');
    profile.field('Cognoms').props.onChangeText('Soler');
    await profile.background();
    assert.equal(profile.writes.at(-1).data.surname, 'Soler');
});

test('inline settings have no sliding container, notification demo or invented version', () => {
    const source = fs.readFileSync(path.join(__dirname, '../app/src/screens/Profile/SettingsModal.tsx'), 'utf8');
    assert.doesNotMatch(source, /<Modal|<ScrollView|Animated\.|Provar notificació|v1\.3\.0|@frolesti/);
    assert.match(source, /Constants\.expoConfig\?\.version/);
    assert.match(source, /styles\.logoutButton/);
    assert.match(source, /Eliminar el compte/);
    assert.doesNotMatch(source, /Aplicació de mapes|chooseMapApp|Legal i suport/);
    assert.match(source, /@react-native-community\/slider/);
    assert.match(source, /onSlidingComplete=/);
    assert.match(source, /type: 'range'/);
    assert.match(source, /'aria-valuetext': RADIUS_OPTIONS\[radiusIndex\]\.label/);
    assert.match(source, /onPointerUp:/);
    assert.match(source, /onKeyUp:/);
    assert.match(source, /prefs\.display\[key\] === value/);
    assert.match(source, /value: 10000/);
    const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '../firebase/firestore/schema.json'), 'utf8'));
    assert.deepEqual(schema.collections.users.fields.preferences.fields.display.fields.searchRadius.enum, [500, 1000, 2000, 5000, 10000]);
    assert.match(source, /testID="profile-footer"/);
    assert.doesNotMatch(source, /IconCredits/);
    const legal = fs.readFileSync(path.join(__dirname, '../app/src/screens/Legal/LegalScreen.tsx'), 'utf8');
    assert.match(legal, /doc === TERMS/);
    assert.match(legal, /<IconCredits/);
    const styles = fs.readFileSync(path.join(__dirname, '../app/src/screens/Profile/SettingsModal.styles.ts'), 'utf8');
    assert.match(styles, /logoutButton: \{[^}]*alignSelf: 'center'/);
    assert.match(styles, /footer: \{ marginTop: 8, paddingTop: 8/);
    assert(source.indexOf('Eliminar el compte</Text>') < source.indexOf('testID="profile-footer"'));
    assert.match(source, /mailto:suport@trobar-app\.cat/);
});

test('editing during an in-flight save queues the latest values without disabling the fields', async () => {
    const profile = profileHarness();
    const release = profile.pauseSaves();
    profile.field('Nom').props.onChangeText('Maria');
    await profile.flush();
    assert.equal(profile.writes.length, 1);
    assert.equal(profile.field('Cognoms').props.editable, true);
    profile.field('Cognoms').props.onChangeText('Soler');
    await profile.flush();
    assert.equal(profile.writes.length, 1);
    release();
    await profile.flush();
    assert.equal(profile.writes.length, 2);
    assert.deepEqual(JSON.parse(JSON.stringify(profile.writes.at(-1).data)), { name: 'Maria', surname: 'Soler' });
    assert.match(profile.text(), /Canvis desats/);
});

test('a failed navigation save keeps the profile open and never discards the edited fields', async () => {
    const profile = profileHarness();
    profile.field('Nom').props.onChangeText('Maria');
    profile.rejectSave(true);
    profile.removeGuard().callback({ data: { action: { type: 'GO_BACK' } } });
    await profile.flush();
    assert.equal(profile.actions.length, 0);
    assert.equal(profile.field('Nom').props.value, 'Maria');
    assert(profile.retry());
});

test('editing during the profile refresh also persists the latest draft', async () => {
    const profile = profileHarness();
    const release = profile.pauseRefresh();
    profile.field('Nom').props.onChangeText('Maria');
    await profile.flush();
    profile.field('Cognoms').props.onChangeText('Soler');
    await profile.flush();
    assert.equal(profile.writes.length, 1);
    release();
    await profile.flush();
    assert.equal(profile.writes.length, 2);
    assert.equal(profile.writes.at(-1).data.surname, 'Soler');
    assert.equal(profile.removeGuard().enabled, false);
});