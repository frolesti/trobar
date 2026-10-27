const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load({ go = false, granted = true, locationGranted = true, user = 'user', os = 'ios' } = {}) {
    const writes = [], scheduled = [], removed = [];
    let tokenCalls = 0;
    let currentPermission = granted;
    let currentLocationPermission = locationGranted;
    const storage = new Map();
    const api = {
        setNotificationHandler() {}, setNotificationChannelAsync: async () => {}, AndroidImportance: { HIGH: 4 }, IosAuthorizationStatus: { PROVISIONAL: 3, EPHEMERAL: 4 },
        getPermissionsAsync: async () => ({ granted: currentPermission, status: currentPermission ? 'granted' : 'denied', canAskAgain: false }),
        getExpoPushTokenAsync: async () => { tokenCalls++; return { data: 'ExponentPushToken[test]' }; },
        scheduleNotificationAsync: async request => scheduled.push(request), SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval' },
    };
    const module = { exports: {} };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../app/src/services/notificationService.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, {
        module, exports: module.exports,
        require: name => {
            if (name === 'react-native') return { Platform: { OS: os } };
            if (name === 'expo-notifications') return api;
            if (name === 'expo-location') return {
                Accuracy: { Balanced: 3 },
                getForegroundPermissionsAsync: async () => ({ granted: currentLocationPermission }),
                requestForegroundPermissionsAsync: async () => ({ granted: currentLocationPermission }),
                getCurrentPositionAsync: async () => ({ coords: { latitude: 41.38, longitude: 2.15 } }),
            };
            if (name === 'expo-constants') return { appOwnership: go ? 'expo' : 'standalone', easConfig: { projectId: 'project' } };
            if (name === 'expo-device') return { isDevice: true };
            if (name === 'expo-crypto') return { digestStringAsync: async () => 'hash', CryptoDigestAlgorithm: { SHA256: 'sha256' } };
            if (name.includes('async-storage')) return { getItem: async key => storage.get(key), setItem: async (key, value) => storage.set(key, value), removeItem: async key => storage.delete(key) };
            if (name === 'firebase/firestore') return { doc: (...parts) => parts.slice(1).join('/'), setDoc: async (...args) => writes.push(args), deleteDoc: async ref => removed.push(ref), serverTimestamp: () => 'now' };
            return { auth: { currentUser: { uid: user } }, db: {} };
        },
    });
    return { service: module.exports, writes, scheduled, removed, setPermission: value => { currentPermission = value; }, setLocationPermission: value => { currentLocationPermission = value; }, get tokenCalls() { return tokenCalls; } };
}

test('Expo Go supports local test without requesting remote push tokens', async () => {
    const state = load({ go: true });
    assert.equal(await state.service.registerPushNotifications('user'), 'unsupported');
    assert.equal(state.tokenCalls, 0);
    assert.equal(await state.service.testLocalNotification(), true);
    assert.equal(state.scheduled[0].trigger.seconds, 5);
});
test('device tokens are private to signed-in owner and removed before logout', async () => {
    const state = load();
    assert.equal(await state.service.registerPushNotifications('user'), 'granted');
    assert.equal(state.writes[0][0], 'users/user/pushDevices/hash');
    await state.service.unregisterPushNotifications('user');
    assert.equal(state.removed[0], 'users/user/pushDevices/hash');
    const mismatch = load({ user: 'other' });
    assert.equal(await mismatch.service.registerPushNotifications('user'), 'error');
    assert.equal(mismatch.writes.length, 0);
});
test('denied permissions and web never register tokens or schedule a test', async () => {
    for (const options of [{ granted: false }, { os: 'web' }]) {
        const state = load(options);
        assert.notEqual(await state.service.registerPushNotifications('user'), 'granted');
        assert.equal(await state.service.testLocalNotification(), false);
        assert.equal(state.tokenCalls, 0);
        assert.equal(state.scheduled.length, 0);
    }
});

test('revoked notification permission removes the previously registered device', async () => {
    const state = load();
    await state.service.registerPushNotifications('user');
    state.setPermission(false);
    assert.equal(await state.service.registerPushNotifications('user', false), 'denied');
    assert.deepEqual(state.removed, ['users/user/pushDevices/hash']);
});

test('nearby consent is private and denied location never saves coordinates', async () => {
    const state = load();
    assert.equal(await state.service.saveNotificationArea('user'), true);
    assert.equal(state.writes[0][0], 'users/user/notificationPrivate/area');
    assert.equal(state.writes[0][1].consent, 'foreground');
    await state.service.clearNotificationArea('user');
    assert.equal(state.removed[0], 'users/user/notificationPrivate/area');
    const denied = load({ locationGranted: false });
    assert.equal(await denied.service.saveNotificationArea('user'), false);
    assert.equal(denied.writes.length, 0);
    await denied.service.registerPushNotifications('user', false);
    assert.equal(denied.removed.length, 0);
    const revoked = load();
    await revoked.service.saveNotificationArea('user');
    revoked.setLocationPermission(false);
    await revoked.service.registerPushNotifications('user', false);
    assert.equal(revoked.removed[0], 'users/user/notificationPrivate/area');
});