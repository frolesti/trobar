const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(os, installed, preferred) {
    const opened = [], alerts = [], stored = new Map(preferred ? [['trobar.defaultMapApp', preferred]] : []);
    const module = { exports: {} };
    const native = { Platform: { OS: os }, Linking: { canOpenURL: async url => installed.some(scheme => url.startsWith(scheme)), openURL: async url => opened.push(url) }, Alert: { alert: (...args) => alerts.push(args) } };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../app/src/services/mapAppService.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, {
        module, exports: module.exports,
        require: name => name === 'react-native' ? native : name.includes('async-storage') ? { getItem: async key => stored.get(key) || null, setItem: async (key, value) => stored.set(key, value), removeItem: async key => stored.delete(key) } : { validBarCoordinates: point => Number.isFinite(point.latitude) && Number.isFinite(point.longitude), buildBarNavigationUrls: () => ({ googleUrl: 'https://maps.google.com' }) },
    });
    return { service: module.exports, opened, alerts, stored };
}

test('only installed apps appear; native links never use web fallbacks', async () => {
    const state = load('ios', ['comgooglemaps://']);
    assert.equal((await state.service.installedMapApps()).length, 1);
    await state.service.openBarMaps({ latitude: 41.5, longitude: 2 });
    assert.equal(state.opened[0], 'comgooglemaps://?daddr=41.5,2&directionsmode=walking');
    assert.equal(state.alerts.length, 0);
    assert.equal(state.stored.get('trobar.defaultMapApp'), 'google');
});
test('removed default is cleared and never redirects to its website', async () => {
    const state = load('ios', [], 'waze');
    await state.service.openBarMaps({ latitude: 41, longitude: 2 });
    assert.equal(state.opened.length, 0);
    assert.equal(state.stored.size, 0);
    assert.equal(state.alerts[0][0], 'Cap app de mapes disponible');
});
test('Android Google navigation and remembered selection open exact coordinates', async () => {
    const state = load('android', ['google.navigation:', 'waze://'], 'google');
    await state.service.openBarMaps({ latitude: 0, longitude: 0 });
    assert.equal(state.opened[0], 'google.navigation:q=0,0&mode=w');
    assert.equal(state.alerts.length, 0);
});

test('chooser remembers the first selection and opens subsequent routes without asking again', async () => {
    const state = load('ios', ['comgooglemaps://', 'waze://']);
    await state.service.openBarMaps({ latitude: 41, longitude: 2 });
    assert.deepEqual(Array.from(state.alerts[0][2], option => option.text), ['Google Maps', 'Waze', 'Cancel·la']);
    state.alerts[0][2][1].onPress();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(state.stored.get('trobar.defaultMapApp'), 'waze');
    assert.equal(state.opened[0], 'waze://?ll=41,2&navigate=yes');
    await state.service.openBarMaps({ latitude: 42, longitude: 3 });
    assert.equal(state.alerts.length, 1);
    assert.equal(state.opened[1], 'waze://?ll=42,3&navigate=yes');
    await state.service.setDefaultMapApp(null);
    assert.equal(await state.service.getDefaultMapApp(), null);
});