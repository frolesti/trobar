const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : node?.props ? [node, ...nodes(node.props.children)] : [];
const text = node => Array.isArray(node) ? node.map(text).join('') : node?.props ? (node.props.message || '') + text(node.props.children) : typeof node === 'string' || typeof node === 'number' ? String(node) : '';
function harness(authenticated = true) {
    const slots = [], calls = [];
    let index = 0, ids = 0, fail = false, release = null;
    const hooks = { ...React,
        useState(initial) { const i = index++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
        useRef(initial) { const i = index++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
    };
    const moduleStub = { exports: {} };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../app/src/screens/Contact/ContactScreen.tsx'), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
    }).outputText, { module: moduleStub, exports: moduleStub.exports, console: { error() {}, info() {} }, require(name) {
        if (name === 'react') return hooks;
        if (name === 'react-native') return {
            ...Object.fromEntries(['View', 'ScrollView', 'TextInput', 'TouchableOpacity', 'ActivityIndicator', 'KeyboardAvoidingView'].map(key => [key, key])),
            Platform: { OS: 'web' }, StyleSheet: { create: value => value },
        };
        if (name === 'react-native-safe-area-context') return { SafeAreaView: 'SafeAreaView' };
        if (name === '@react-navigation/native') return { useNavigation: () => ({ navigate: route => calls.push(route) }) };
        if (name === 'expo-status-bar') return { StatusBar: 'StatusBar' };
        if (name === 'expo-constants') return { __esModule: true, default: { expoConfig: { version: '1.0.0' } } };
        if (name === 'expo-crypto') return { randomUUID: () => `uuid-${++ids}` };
        if (name.includes('AuthContext')) return { useAuth: () => ({ user: authenticated ? { id: 'alice', email: 'alice@example.test' } : null }) };
        if (name.includes('editorialTheme')) return { EDITORIAL: {} };
        if (name.endsWith('UserNotice')) return { __esModule: true, default: 'UserNotice' };
        if (name.includes('contactService')) return { submitContact: async data => {
            calls.push(data);
            if (release) await new Promise(resolve => { release = resolve; });
            if (fail) throw new Error('Backend unavailable');
            return data.requestId;
        } };
        if (name.includes('errorHandler')) return { getUserFriendlyError: () => 'No s’ha pogut enviar' };
        return { __esModule: true, default: name.endsWith('AppText') ? 'Text' : 'AppIcon' };
    } });
    const render = () => { index = 0; return moduleStub.exports.default(); };
    const find = predicate => nodes(render()).find(predicate);
    return {
        calls, render, text: () => text(render()),
        field: label => find(node => node.props.accessibilityLabel === label),
        button: label => find(node => node.type === 'TouchableOpacity' && text(node) === label),
        consent: () => find(node => node.props.accessibilityRole === 'checkbox'),
        fail: value => { fail = value; },
        pause: () => { release = true; return () => { const resolve = release; release = null; resolve(); }; },
    };
}
function fill(ui) {
    ui.field('Assumpte').props.onChangeText('  No es veu un partit  ');
    ui.field('Missatge').props.onChangeText('  Explico els passos per reproduir la incidència.  ');
    ui.consent().props.onPress();
}

test('contact offers sign-in for guests and validates fields and consent before sending', async () => {
    const guest = harness(false);
    assert.equal(guest.field('Assumpte'), undefined);
    guest.button('Inicia sessió per contactar').props.onPress();
    assert.deepEqual(guest.calls, ['Login']);
    const ui = harness();
    await ui.button('Enviar consulta').props.onPress();
    assert.equal(ui.calls.length, 0);
    assert(ui.text().includes('20 a 5.000'));
    ui.field('Assumpte').props.onChangeText('Assumpte vàlid');
    ui.field('Missatge').props.onChangeText('Un missatge vàlid amb més de vint caràcters.');
    await ui.button('Enviar consulta').props.onPress();
    assert(ui.text().includes('Cal acceptar'));
    assert.equal(ui.calls.length, 0);
});

test('failed contact preserves drafts and retry identity; edits obtain a new identity', async () => {
    const ui = harness();
    fill(ui);
    ui.fail(true);
    await ui.button('Enviar consulta').props.onPress();
    assert(ui.text().includes('No s’ha pogut enviar'));
    assert.equal(ui.field('Assumpte').props.value, '  No es veu un partit  ');
    await ui.button('Enviar consulta').props.onPress();
    assert.equal(ui.calls[0].requestId, ui.calls[1].requestId);
    ui.field('Assumpte').props.onChangeText('Assumpte corregit');
    ui.fail(false);
    await ui.button('Enviar consulta').props.onPress();
    assert.notEqual(ui.calls[2].requestId, ui.calls[1].requestId);
    assert(ui.text().includes('Consulta enviada'));
    assert(ui.text().includes(ui.calls[2].requestId));
    assert.equal(ui.field('Missatge'), undefined);
});

test('contact blocks duplicate taps while sending and only confirms after backend success', async () => {
    const ui = harness();
    fill(ui);
    const resume = ui.pause();
    const button = ui.button('Enviar consulta');
    const first = button.props.onPress();
    await button.props.onPress();
    assert.equal(ui.calls.length, 1);
    assert.equal(ui.calls[0].subject, 'No es veu un partit');
    assert(!ui.text().includes('Consulta enviada'));
    assert.equal(ui.field('Missatge').props.editable, false);
    resume();
    await first;
    assert(ui.text().includes('Consulta enviada'));
});
