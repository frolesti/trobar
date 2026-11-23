const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { iosReleaseIssues } = require('../scripts/checkIosRelease.cjs');
const root = path.resolve(__dirname, '..');
const base = require('../app.json').expo;
const fixtureClient = '123456-iosfixture.apps.googleusercontent.com';

function configure(environment = {}) {
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'app.config.js'), 'utf8'), {
        module, process: { env: environment },
        require(name) {
            if (name === './scripts/devStart') return { prepareDirectExpoStart() {} };
            if (name === './app/src/theme/brandColors.json') return require('../app/src/theme/brandColors.json');
            throw new Error(`Unexpected dependency ${name}`);
        },
    });
    return module.exports({ config: base });
}

test('native iOS Google return scheme matches the runtime client and Apple capability survives dynamic config', () => {
    const configured = configure({ EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: fixtureClient });
    const google = configured.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === '@react-native-google-signin/google-signin');
    assert.equal(google[1].iosUrlScheme, 'com.googleusercontent.apps.123456-iosfixture');
    assert(configured.plugins.includes('expo-apple-authentication'));
    assert.equal(configured.ios.usesAppleSignIn, true);
    assert.equal(configured.ios.infoPlist.NSLocationWhenInUseUsageDescription, base.ios.infoPlist.NSLocationWhenInUseUsageDescription);
    assert.throws(() => configure({ EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: 'not-an-oauth-client' }), /client OAuth iOS/);
    assert.doesNotThrow(() => configure());
});

test('release preflight blocks missing credentials, wrong Firebase environment and broken icon paths', () => {
    const configured = configure({ EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: fixtureClient });
    const environment = Object.fromEntries([
        'API_KEY', 'AUTH_DOMAIN', 'STORAGE_BUCKET', 'MESSAGING_SENDER_ID', 'APP_ID',
    ].map(key => [`EXPO_PUBLIC_FIREBASE_${key}`, 'fixture']));
    Object.assign(environment, {
        EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'trobar-1123f', EXPO_PUBLIC_TROBAR_ENV: 'production',
        EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: 'fixture', EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: fixtureClient,
    });
    assert.deepEqual(iosReleaseIssues(configured, environment, root), []);
    const missingGoogle = { ...environment };
    delete missingGoogle.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
    assert(iosReleaseIssues(configured, missingGoogle, root).some(issue => issue.includes('GOOGLE_IOS_CLIENT_ID')));
    const invalid = iosReleaseIssues({ ...configured, ios: { ...configured.ios, icon: 'absent.png' } }, {
        ...environment, EXPO_PUBLIC_TROBAR_ENV: 'dev', EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'another-project',
    }, root);
    assert(invalid.some(issue => issue.includes('prod o production')));
    assert(invalid.some(issue => issue.includes('Firebase')));
    assert(invalid.some(issue => issue.includes('icona')));
    assert(iosReleaseIssues({ ...configured, ios: { ...configured.ios, icon: base.plugins[4][1].image } }, environment, root)
        .some(issue => issue.includes('PNG RGB')));
});
