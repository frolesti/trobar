const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const path = require('node:path');

function load(file, dependencies = {}, globals = {}, extra = '') {
    const module = { exports: {} };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve(file), 'utf8') + extra, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
    }).outputText, {
        module, exports: module.exports, ...globals,
        require(name) {
            if (name in dependencies) return dependencies[name];
            throw new Error(`Unexpected dependency ${name}`);
        },
    });
    return module.exports;
}
const legal = load('../app/src/data/legalContent.ts', { './contactEmails.json': require('../app/src/data/contactEmails.json') });
const helpers = load('../app/src/utils/legalAcceptance.ts', { '../data/legalContent': legal });
const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : node?.props ? [node, ...nodes(node.props.children)] : [];
const text = node => Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : typeof node === 'string' ? node : '';
const valid = () => ({
    termsVersion: legal.LEGAL_VERSIONS.terms, privacyVersion: legal.LEGAL_VERSIONS.privacy,
    termsRead: true, privacyRead: true, acceptedAt: { toMillis: () => 100 }, platform: 'web',
});

test('only both read, explicitly accepted and current server-dated documents unlock the account', () => {
    assert(helpers.hasCurrentLegalAcceptance(valid()));
    for (const acceptance of [
        undefined, {}, { ...valid(), termsVersion: 'old' }, { ...valid(), privacyVersion: 'old' },
        { ...valid(), termsRead: false }, { ...valid(), privacyRead: false },
        { ...valid(), acceptedAt: undefined }, { ...valid(), acceptedAt: { toMillis: () => 0 } },
    ]) assert(!helpers.hasCurrentLegalAcceptance(acceptance));
    for (let mask = 0; mask < 16; mask++) {
        assert.equal(helpers.canAcceptLegalDocuments(
            { terms: !!(mask & 1), privacy: !!(mask & 2) },
            { terms: !!(mask & 4), privacy: !!(mask & 8) },
        ), mask === 15);
    }
});

test('acceptance is merged into the authenticated profile, server-stamped and confirmed before success', async () => {
    const writes = [], reads = [];
    let currentUser = { uid: 'alice' }, failure, data = { legalAcceptance: valid() };
    const service = load('../app/src/services/userService.ts', {
        'firebase/firestore': {
            doc: (_db, ...parts) => parts.join('/'), serverTimestamp: () => 'SERVER_TIMESTAMP',
            setDoc: async (...args) => { if (failure) throw failure; writes.push(args); },
            getDocFromServer: async ref => { reads.push(ref); return { data: () => data }; },
        },
        'firebase/storage': {}, 'expo-file-system/legacy': {},
        'react-native': { Platform: { OS: 'web' } },
        '../config/firebase': { auth: { get currentUser() { return currentUser; } }, db: {} },
        '../api/core': { executeOrThrow: fn => fn() },
        '../models/UserProfile': {}, '../data/legalContent': legal,
        '../utils/legalAcceptance': helpers,
    });
    const result = await service.saveLegalAcceptance('alice');
    assert.equal(result.termsVersion, legal.LEGAL_VERSIONS.terms);
    assert.equal(writes[0][0], 'users/alice');
    assert.equal(writes[0][2].merge, true);
    assert.equal(writes[0][1].legalAcceptance.acceptedAt, 'SERVER_TIMESTAMP');
    assert.equal(writes[0][1].legalAcceptance.termsRead, true);
    assert.equal(writes[0][1].legalAcceptance.privacyRead, true);
    assert.deepEqual(reads, ['users/alice']);
    failure = new Error('offline');
    await assert.rejects(service.saveLegalAcceptance('alice'), /offline/);
    failure = undefined;
    data = {};
    await assert.rejects(service.saveLegalAcceptance('alice'), /confirmar/);
    currentUser = { uid: 'bob' };
    await assert.rejects(service.saveLegalAcceptance('alice'), /iniciar sessió/);
    currentUser = null;
    await assert.rejects(service.saveLegalAcceptance('alice'), /iniciar sessió/);
});

test('legal reader requires reaching the end and exposes the frolesti footer in both documents', async () => {
    for (const doc of [legal.TERMS, legal.PRIVACY]) {
        let completed = 0;
        const links = [];
        const screen = load('../app/src/screens/Legal/LegalScreen.tsx', {
            react: { ...React, useRef: value => ({ current: value }) },
            'react-native': { ScrollView: 'ScrollView', View: 'View', TouchableOpacity: 'Button', StyleSheet: { create: value => value }, Linking: { openURL: async url => links.push(url) } },
            'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
            '@react-navigation/native': {}, 'expo-status-bar': { StatusBar: 'StatusBar' },
            '../../components/AppText': { __esModule: true, default: 'Text' },
            '../../components/AppIcon': { __esModule: true, default: 'AppIcon' },
            '../../components/IconCredits': { __esModule: true, default: 'IconCredits' },
            '../../components/AlertBanner': { showAlert() {} },
            '../../context/SplashContext': { useScreenLoading() {} },
            '../../theme/editorialTheme': { EDITORIAL: {}, ED_TYPE: {} },
            '../../utils/webScreenStyles': {}, '../../data/legalContent': legal,
        }).LegalDocument({ doc, onBack() {}, onReadComplete: () => completed++ });
        const scroll = nodes(screen).find(node => node.type === 'ScrollView');
        scroll.props.onLayout({ nativeEvent: { layout: { height: 600 } } });
        scroll.props.onContentSizeChange(390, 2400);
        assert.equal(completed, 0);
        scroll.props.onScroll({ nativeEvent: { contentOffset: { y: 1200 } } });
        assert.equal(completed, 0);
        scroll.props.onScroll({ nativeEvent: { contentOffset: { y: 1800 } } });
        assert.equal(completed, 1);
        scroll.props.onScroll({ nativeEvent: { contentOffset: { y: 1800 } } });
        assert.equal(completed, 1);
        const footer = nodes(screen).find(node => node.props.accessibilityLabel === 'Visitar el web de frolesti');
        await footer.props.onPress();
        assert.deepEqual(links, ['https://frolesti.cat']);
        assert(text(screen).includes('fet per '));
    }
});

function consentHarness() {
    let cursor = 0, user = { id: 'alice' }, registration = true, busyRelease, failSave = true;
    let saves = 0;
    const states = [];
    const hooks = { ...React,
        useRef(initial) { const i = cursor++; return states[i] ||= { current: initial }; },
        useState(initial) {
            const i = cursor++; if (!(i in states)) states[i] = initial;
            return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }];
        },
    };
    const module = load('../app/src/components/LegalConsentGate.tsx', {
        react: hooks,
        'react-native': { Modal: 'Modal', ScrollView: 'ScrollView', View: 'View', TouchableOpacity: 'Button', StyleSheet: { create: value => value } },
        'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
        '@expo/vector-icons': { Feather: 'Feather' },
        './AppText': { __esModule: true, default: 'Text' }, './UserNotice': { __esModule: true, default: 'UserNotice' },
        './AlertBanner': { AlertBannerHost: 'Host' }, '../data/legalContent': legal,
        '../utils/legalAcceptance': helpers, '../theme/editorialTheme': { EDITORIAL: {} },
        '../utils/errorHandler': { getUserFriendlyError: () => 'No hem pogut desar l’acceptació.' },
        '../screens/Legal/LegalScreen': { LegalDocument: 'LegalDocument' },
        '../context/AuthContext': { useAuth: () => ({
            user, isLoading: false, requiresRegistrationConsent: registration && !!user && !helpers.hasCurrentLegalAcceptance(user.legalAcceptance), logout: async () => { user = null; },
            acceptLegalDocuments: async () => { saves++; if (busyRelease) await new Promise(resolve => { busyRelease = resolve; }); if (failSave) throw new Error('offline'); user = { ...user, legalAcceptance: valid() }; },
        }) },
    }, { console: { info() {} } }, '\nexport { ConsentForm };');
    const render = () => { cursor = 0; return module.ConsentForm(); };
    const button = label => nodes(render()).find(node => node.props.accessibilityLabel === label);
    return {
        render, button, gate: () => module.default(), get saves() { return saves; },
        read(key) { button(`Llegir ${key === 'terms' ? 'Termes del Servei' : 'Política de Privacitat'}`).props.onPress(); const reader = render(); assert.equal(reader.type, 'LegalDocument'); reader.props.onReadComplete(); reader.props.onBack(); },
        success: () => { failSave = false; },
        pause: () => { busyRelease = true; return () => { const resolve = busyRelease; busyRelease = null; resolve(); }; },
        setUser: value => { user = value; },
        setRegistration: value => { registration = value; },
    };
}

test('consent gate applies only to new or unfinished registrations, never returning accounts', () => {
    const ui = consentHarness();
    assert.equal(ui.gate().type, 'Modal');
    ui.setRegistration(false);
    ui.setUser({ id: 'returning' });
    assert.equal(ui.gate(), null);
    ui.setUser({ id: 'returning', legalAcceptance: valid() });
    assert.equal(ui.gate(), null);
    ui.setUser({ id: 'returning', legalAcceptance: { ...valid(), termsVersion: 'old' } });
    assert.equal(ui.gate(), null);
    ui.setRegistration(true);
    assert.equal(ui.gate().type, 'Modal');
    ui.setUser(null);
    assert.equal(ui.gate(), null);
    const app = fs.readFileSync(require.resolve('../App.tsx'), 'utf8');
    assert.match(app, /<LegalConsentGate/);
});

test('reading both documents alone is insufficient; retries and double submits cannot bypass persistence', async () => {
    const ui = consentHarness();
    const submit = () => ui.button('Desar l’acceptació i continuar');
    assert.equal(submit().props.disabled, true);
    await submit().props.onPress();
    assert.equal(ui.saves, 0);
    ui.read('terms');
    ui.button('Accepto Termes del Servei').props.onPress();
    assert.equal(submit().props.disabled, true);
    ui.read('privacy');
    assert.equal(submit().props.disabled, true);
    ui.button('Accepto Política de Privacitat').props.onPress();
    assert.equal(submit().props.disabled, false);
    await submit().props.onPress();
    assert.equal(ui.saves, 1);
    assert(nodes(ui.render()).some(node => node.type === 'UserNotice'));
    assert.equal(ui.gate().type, 'Modal', 'a failed save must leave the account blocked');
    ui.success();
    const release = ui.pause();
    const staleSubmit = submit();
    const pending = staleSubmit.props.onPress();
    await staleSubmit.props.onPress();
    assert.equal(submit().props.disabled, true);
    await submit().props.onPress();
    assert.equal(ui.saves, 2);
    release();
    await pending;
    assert.equal(ui.gate(), null);
});

test('web legal renderer includes the same creator link', () => {
    const source = fs.readFileSync(path.join(__dirname, '../web-app/components/LegalBody.tsx'), 'utf8');
    assert.match(source, /<footer/);
    assert.match(source, /fet per <a href="https:\/\/frolesti\.cat"/);
    assert.match(source, /rel="noopener noreferrer"/);
});

function authHarness({ platform = 'web', nativeGoogle = platform === 'android', googleIosClientId, newAccount = false, storage = new Map(), profile = null, beforeStorageWrite = async () => {} } = {}) {
    let cursor = 0, effectCursor = 0, listener, listenerWork, failSave = false, pushRegistrations = 0;
    const states = [], dependencies = [], pendingEffects = [];
    const firebaseUser = { uid: 'alice', email: 'alice@example.test', providerData: [], getIdToken: async () => 'token', getIdTokenResult: async () => ({ claims: {} }) };
    const auth = { currentUser: null };
    const signIn = async () => {
        auth.currentUser = firebaseUser;
        listenerWork = listener(firebaseUser);
        return { user: firebaseUser, isNewUser: newAccount };
    };
    class Provider {
        setCustomParameters() {}
        addScope() {}
        credential() { return {}; }
        static credential() { return {}; }
    }
    const googleConfigurations = [];
    let playServicesChecks = 0;
    const module = load('../app/src/context/AuthContext.tsx', {
        react: { ...React,
            useState(initial) {
                const index = cursor++;
                if (!(index in states)) states[index] = initial;
                return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
            },
            useRef(initial) { const index = cursor++; return states[index] ||= { current: initial }; },
            useEffect(callback, deps) {
                const index = effectCursor++;
                if (!dependencies[index] || deps.some((value, i) => value !== dependencies[index][i])) pendingEffects.push(callback);
                dependencies[index] = deps;
            },
        },
        'firebase/auth': {
            onAuthStateChanged: (_auth, callback) => { listener = callback; return () => {}; },
            signInWithEmailAndPassword: signIn, createUserWithEmailAndPassword: signIn,
            signInWithCredential: signIn, signInWithPopup: signIn,
            getAdditionalUserInfo: credential => ({ isNewUser: credential.isNewUser }),
            GoogleAuthProvider: Provider, OAuthProvider: Provider,
            updateProfile: async () => {}, sendEmailVerification: async () => {},
            signOut: async () => { auth.currentUser = null; await listener(null); },
        },
        '@react-native-async-storage/async-storage': { __esModule: true, default: {
            getItem: async key => storage.get(key) || null, setItem: async (key, value) => { await beforeStorageWrite(); storage.set(key, value); }, removeItem: async key => storage.delete(key),
        } },
        '../config/firebase': { auth },
        '../services/userService': {
            getUserProfile: async () => profile,
            saveLegalAcceptance: async () => { if (failSave) throw new Error('permission-denied'); return valid(); },
        },
        '../services/emailService': { recordFirstAppLogin: async () => {}, recordAccountSecurity: async () => {} },
        '../utils/legalAcceptance': helpers,
        'react-native': { Platform: { OS: platform }, TurboModuleRegistry: { get: () => nativeGoogle }, AppState: { addEventListener: () => ({ remove() {} }) } },
        '../services/notificationService': { registerPushNotifications: async () => { pushRegistrations++; }, unregisterPushNotifications: async () => {} },
        'expo-constants': { __esModule: true, default: {} },
        '../components/AlertBanner': { showAlert() {} },
        '../api/core': { executeOrThrow: callback => callback() },
        'expo-apple-authentication': { isAvailableAsync: async () => true, AppleAuthenticationScope: {}, signInAsync: async () => ({ identityToken: 'apple-token' }) },
        '@react-native-google-signin/google-signin': { GoogleSignin: {
            configure: options => googleConfigurations.push(options),
            hasPlayServices: async () => { playServicesChecks++; },
            signIn: async () => ({ data: { idToken: 'google-token' } }),
        } },
        'expo-crypto': { randomUUID: () => 'nonce', CryptoDigestAlgorithm: {}, digestStringAsync: async () => 'digest' },
        'expo-auth-session': {
            getDefaultReturnUrl: () => 'trobar://auth', ResponseType: {}, Prompt: {},
            AuthRequest: class {
                async makeAuthUrlAsync() { return 'https://accounts.google.com/auth'; }
                parseReturnUrl() { return { type: 'success', params: { id_token: `header.${Buffer.from(JSON.stringify({ nonce: 'nonce' })).toString('base64url')}.signature` } }; }
            },
        },
        'expo-web-browser': { openAuthSessionAsync: async () => ({ type: 'success', url: 'trobar://auth' }) },
    }, { console: { log() {}, info() {}, error() {} }, URL, atob, process: { env: { EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: googleIosClientId } } });
    const render = () => {
        cursor = effectCursor = 0;
        const tree = module.AuthProvider({ children: null });
        pendingEffects.splice(0).forEach(effect => effect());
        return tree.props.value;
    };
    render();
    return {
        render, storage, googleConfigurations,
        get playServicesChecks() { return playServicesChecks; },
        get pushRegistrations() { return pushRegistrations; },
        async settle() { await listenerWork; return render(); },
        async restore() { auth.currentUser = firebaseUser; await listener(firebaseUser); return render(); },
        failSave: value => { failSave = value; },
    };
}

test('native iOS Google uses its configured OAuth client without requesting Android Play Services', async () => {
    const clientId = '123456-iosfixture.apps.googleusercontent.com';
    const ui = authHarness({ platform: 'ios', nativeGoogle: true, googleIosClientId: clientId });
    await ui.render().loginGoogle();
    await ui.settle();
    assert.equal(ui.googleConfigurations.length, 1);
    assert.equal(ui.googleConfigurations[0].iosClientId, clientId);
    assert.equal(ui.playServicesChecks, 0);
    const android = authHarness({ platform: 'android' });
    await android.render().loginGoogle();
    await android.settle();
    assert.equal(android.playServicesChecks, 1);
});

test('every social provider gates only account creation, not returning login', async () => {
    for (const [platform, method] of [['web', 'loginGoogle'], ['ios', 'loginGoogle'], ['android', 'loginGoogle'], ['web', 'loginApple'], ['ios', 'loginApple']]) {
        for (const newAccount of [false, true]) {
            const ui = authHarness({ platform, newAccount });
            await ui.render()[method]();
            const state = await ui.settle();
            assert.equal(state.requiresRegistrationConsent, newAccount, `${platform} ${method} new=${newAccount}`);
            assert.equal(ui.storage.has('@trobar:pending-legal-registration:alice'), newAccount);
            assert.equal(state.isLoading, false);
            if (platform !== 'web') assert.equal(ui.pushRegistrations, newAccount ? 0 : 1);
        }
    }
});

test('auth listener cannot end loading before new-account classification is persisted', async () => {
    let release;
    const ui = authHarness({ newAccount: true, beforeStorageWrite: () => new Promise(resolve => { release = resolve; }) });
    const signingIn = ui.render().loginGoogle();
    const during = await ui.settle();
    assert.equal(during.isLoading, true);
    release();
    await signingIn;
    assert.equal(ui.render().isLoading, false);
    assert.equal(ui.render().requiresRegistrationConsent, true);
});

test('email creation requires consent and only confirmed persistence finishes registration', async () => {
    const ui = authHarness();
    await ui.render().registerEmail('alice@example.test', 'password', 'Alice');
    let state = await ui.settle();
    assert.equal(state.requiresRegistrationConsent, true);
    ui.failSave(true);
    await assert.rejects(state.acceptLegalDocuments(), /permission-denied/);
    assert.equal(ui.render().requiresRegistrationConsent, true);
    assert(ui.storage.has('@trobar:pending-legal-registration:alice'));
    ui.failSave(false);
    await ui.render().acceptLegalDocuments();
    assert.equal(ui.render().requiresRegistrationConsent, false);
    assert.equal(ui.storage.has('@trobar:pending-legal-registration:alice'), false);
    await ui.render().logout();
    await ui.render().loginEmail('alice@example.test', 'password');
    assert.equal((await ui.settle()).requiresRegistrationConsent, false);
});

test('session restore resumes only unfinished registrations on this device', async () => {
    for (const profile of [null, { legalAcceptance: { ...valid(), termsVersion: 'old' } }]) {
        assert.equal((await authHarness({ profile }).restore()).requiresRegistrationConsent, false);
    }
    const storage = new Map([['@trobar:pending-legal-registration:alice', 'true']]);
    assert.equal((await authHarness({ storage }).restore()).requiresRegistrationConsent, true);
    assert.equal((await authHarness({ storage, profile: { legalAcceptance: valid() } }).restore()).requiresRegistrationConsent, false);
});
