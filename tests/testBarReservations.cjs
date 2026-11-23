const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

function load(file, dependencies = {}, globals = {}) {
    const module = { exports: {} };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve(file), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
    }).outputText, { module, exports: module.exports, URL, console, ...globals,
        require(name) {
            assert(name in dependencies, `Unexpected dependency: ${name}`);
            return dependencies[name];
        },
    });
    return module.exports;
}
const reservations = load('../app/src/utils/barReservations.ts');
const draft = load('../app/src/utils/barProfileDraft.ts').barProfileDraft;
const premium = { tier: 'premium', reservationUrl: 'https://bar.example/reservar', fullMatchIds: ['full'] };
const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : node?.props ? [node, ...nodes(node.props.children)] : [];

test('reservation URLs allow external HTTPS bookings but reject unsafe or malformed links', () => {
    assert.equal(reservations.reservationUrl(' https://bar.example/reservar?partit=1 '), premium.reservationUrl + '?partit=1');
    for (const value of ['', undefined, 'javascript:alert(1)', 'http://bar.example', 'https://user:pass@bar.example',
        'https://localhost', 'https://', 'bar.example', 'https://bar.example/' + 'a'.repeat(2048)]) {
        assert.equal(reservations.reservationUrl(value), null, value);
    }
});

test('full capacity is scoped to one Premium match and drafts remove deselected broadcasts', () => {
    assert.equal(reservations.isBarFullForMatch(premium, 'full'), true);
    for (const match of [undefined, 'other']) assert.equal(reservations.isBarFullForMatch(premium, match), false);
    assert.equal(reservations.isBarFullForMatch({ ...premium, tier: 'free' }, 'full'), false);
    const normalized = draft({ reservationUrl: ' https://bar.example/reservar ', broadcastingMatches: ['a', 'b'], fullMatchIds: ['b', 'gone', 'b'] });
    assert.equal(normalized.reservationUrl, premium.reservationUrl);
    assert.deepEqual([...normalized.fullMatchIds], ['b']);
    assert.deepEqual([...draft({ broadcastingMatches: [] }).fullMatchIds], []);
});

function actionHarness({ fail = false } = {}) {
    const links = [], alerts = [], logs = [];
    const Action = load('../app/src/components/BarReservationAction.tsx', {
        react: React,
        'react-native': { View: 'View', TouchableOpacity: 'Button', Linking: { openURL: async url => {
            links.push(url);
            if (fail) throw new Error('Cannot open URL');
        } } },
        './AppText': { __esModule: true, default: 'Text' },
        '../theme/editorialTheme': { EDITORIAL: { matchday: '#F4D35E', background: '#7A0033' } },
        '../utils/barReservations': reservations, './AlertBanner': { showAlert: value => alerts.push(value) },
    }, { console: { info: (...args) => logs.push(args) } }).default;
    return { render: props => nodes(Action({ bar: premium, ...props })), links, alerts, logs };
}
test('booking is highlighted and opens the owner URL, but a full match cannot open it even programmatically', async () => {
    const h = actionHarness();
    const button = tree => tree.find(node => node.props.testID === 'bar-reservation-button');
    const available = button(h.render({ matchId: 'other' }));
    assert.equal(available.props.disabled, false);
    assert.equal(available.props.style.backgroundColor, '#F4D35E');
    available.props.onPress();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(h.links, [premium.reservationUrl]);
    const fullTree = h.render({ matchId: 'full' });
    const full = button(fullTree);
    assert.equal(full.props.disabled, true);
    assert.equal(full.props.accessibilityState.disabled, true);
    assert(fullTree.some(node => node.props.children === 'Complet per a aquest partit'));
    full.props.onPress();
    assert.equal(h.links.length, 1);
    assert.equal(h.render({ bar: { ...premium, tier: 'free' } }).length, 0);
    assert.equal(h.render({ bar: { tier: 'premium' } }).length, 0);
    const withoutLink = h.render({ bar: { ...premium, reservationUrl: '' }, matchId: 'full' });
    assert(withoutLink.some(node => node.props.children === 'Complet per a aquest partit'));
    assert.equal(button(withoutLink), undefined);
});
test('demo bookings never open an external site and failures give feedback', async () => {
    const demo = actionHarness();
    demo.render({ demo: true }).find(node => node.type === 'Button').props.onPress();
    assert.equal(demo.links.length, 0);
    assert.equal(demo.alerts.length, 1);
    const failed = actionHarness({ fail: true });
    failed.render({}).find(node => node.type === 'Button').props.onPress();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(failed.alerts[0].tone, 'error');
    assert.equal(failed.logs.length, 1);
});
test('owner profile rejects invalid booking URLs before writing and persists normalized links and match state', async () => {
    const writes = [];
    const service = load('../app/src/services/barOwnerService.ts', {
        'firebase/firestore': {
            doc: (_db, _collection, id) => id, serverTimestamp: () => 'now',
            updateDoc: async (id, value) => writes.push({ id, value }),
        },
        'firebase/storage': {}, '../config/firebase': { db: {} },
        '../api/core': { executeOrThrow: callback => callback() }, '../utils/barReservations': reservations,
    });
    await assert.rejects(service.updateBarProfile('bar', { reservationUrl: 'javascript:alert(1)' }), /https/);
    assert.equal(writes.length, 0);
    await service.updateBarProfile('bar', { reservationUrl: ' https://bar.example ', fullMatchIds: ['full'] });
    assert.equal(writes[0].value.reservationUrl, 'https://bar.example/');
    assert.deepEqual([...writes[0].value.fullMatchIds], ['full']);
    await service.updateBarProfile('bar', { reservationUrl: '' });
    assert.equal(writes[1].value.reservationUrl, '');
});
test('live bar snapshots preserve reservations and stop listening when the selected card closes', () => {
    let receive, failure, stopped = false;
    const errors = [], updates = [];
    const service = load('../app/src/services/barService.ts', {
        'firebase/firestore': {
            doc: (_db, _collection, id) => id,
            collection: (_db, name) => name,
            onSnapshot: (_ref, success, error) => { receive = success; failure = error; return () => { stopped = true; }; },
        },
        '../config/firebase': { db: {} }, '../api/core': {}, './osmService': {}, './placesService': {},
        '../utils/barNavigation': { getBarCoordinates: data => ({ latitude: data.latitude, longitude: data.longitude }) },
        '../utils/matchBroadcast': {}, '../data/premiumDemoProfiles': {},
    });
    const unsubscribe = service.subscribeToBarDetails('bar', bar => updates.push(bar), error => errors.push(error));
    const data = { ...premium, name: 'Bar', latitude: 41, longitude: 2 };
    receive({ id: 'bar', exists: () => true, data: () => data });
    assert.equal(updates[0].reservationUrl, premium.reservationUrl);
    assert.deepEqual([...updates[0].fullMatchIds], ['full']);
    receive({ id: 'bar', exists: () => true, data: () => ({ ...data, fullMatchIds: [] }) });
    assert.equal(updates[1].fullMatchIds.length, 0);
    failure(new Error('Offline'));
    assert.equal(errors.length, 1);
    unsubscribe();
    assert.equal(stopped, true);
    const lists = [];
    stopped = false;
    const stopList = service.subscribeToBars(bars => lists.push(bars), error => errors.push(error));
    const snapshot = fullMatchIds => ({ forEach: callback => {
        callback({ id: 'bar', data: () => ({ ...data, fullMatchIds }) });
        callback({ id: 'pending', data: () => ({ ...data, status: 'pending_checkout' }) });
    } });
    receive(snapshot(['full']));
    receive(snapshot([]));
    assert.equal(lists[0].length, 1);
    assert.equal(lists[0][0].fullMatchIds[0], 'full');
    assert.equal(lists[1][0].fullMatchIds.length, 0);
    failure(new Error('Offline'));
    assert.equal(errors.length, 2);
    stopList();
    assert.equal(stopped, true);
});
