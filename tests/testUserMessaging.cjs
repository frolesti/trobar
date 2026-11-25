const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');

function load(file, dependencies = {}, globals = {}) {
    const module = { exports: {} };
    const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.React, esModuleInterop: true,
    } }).outputText;
    vm.runInNewContext(code, { module, exports: module.exports, ...globals,
        require(name) {
            if (name in dependencies) return dependencies[name];
            throw new Error(`Unexpected dependency ${name}`);
        },
    });
    return module.exports;
}
const messages = load('app\\src\\utils\\errorHandler.ts');
const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : node?.props ? [node, ...nodes(node.props.children)] : [];
const text = node => Array.isArray(node) ? node.map(text).join('') : node?.props ? (node.props.message || '') + text(node.props.children) : typeof node === 'string' ? node : '';

test('public errors are allowlisted; unknown codes, strings, payloads and stacks never reach users', () => {
    const credentials = messages.STANDARD_MESSAGES.credentials;
    for (const code of ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found']) {
        assert.equal(messages.getUserFriendlyError({ code, message: 'FirebaseError: secret' }), credentials);
    }
    for (const error of [
        new Error('Stripe token=secret HTTP 500'), 'raw backend response',
        { code: 'unknown/code', message: 'private configuration' }, { message: 'SQL stack' },
        { code: 'toString' }, { code: 'constructor' }, { code: '__proto__' },
        { code: 'storage/bucket-not-found', message: 'bucket internals' },
        null, undefined, 503,
    ]) {
        const result = messages.getUserFriendlyError(error);
        assert(!/secret|HTTP|Firebase|unknown\/|SQL|bucket|backend|configuration/.test(result));
        assert.equal(result, error?.code === 'storage/bucket-not-found' ? messages.STANDARD_MESSAGES.unavailable : messages.STANDARD_MESSAGES.unexpected);
    }
    assert.equal(messages.getUserFriendlyError({ name: 'AbortError' }), messages.STANDARD_MESSAGES.connection);
    assert.equal(messages.getUserFriendlyError(new Error('secret'), 'No hem pogut desar la foto.'), 'No hem pogut desar la foto.');
    assert.equal(messages.getUserFriendlyError(null, 'FirebaseError auth/internal-error'), messages.STANDARD_MESSAGES.unexpected);
    for (const value of ['[API FAIL] loginEmail: {}', '{"name":"FirebaseError"}', 'HTTP 500', 'auth/wrong-password', 'TypeError: private', 'https://private.test/?token=secret']) {
        assert.equal(messages.sanitizeUserMessage(value), messages.STANDARD_MESSAGES.unexpected);
    }
    assert.equal(messages.sanitizeUserMessage('Consulta enviada.'), 'Consulta enviada.');
});

test('shared inline and transient notice visuals filter text and retain accessible actions', () => {
    let actions = 0, dismissals = 0;
    const Notice = load('app\\src\\components\\UserNotice.tsx', {
        react: React,
        'react-native': { View: 'View', TouchableOpacity: 'TouchableOpacity', StyleSheet: { create: value => value } },
        '@expo/vector-icons': { Feather: 'Feather' },
        './AppText': { __esModule: true, default: 'Text' },
        '../theme/editorialTheme': { EDITORIAL: {} },
        '../utils/errorHandler': messages,
    }).default;
    const notice = Notice({
        message: 'FirebaseError auth/internal-error', title: 'HTTP 500', tone: 'error',
        action: { label: 'Obrir configuració', onPress: () => actions++ }, onDismiss: () => dismissals++,
    });
    assert.equal(notice.props.accessibilityRole, 'alert');
    assert.equal(notice.props.accessibilityLiveRegion, 'assertive');
    assert(text(notice).includes(messages.STANDARD_MESSAGES.unexpected));
    assert(!/Firebase|HTTP|auth\//.test(text(notice)));
    const action = nodes(notice).find(node => node.type === 'TouchableOpacity' && text(node) === 'Obrir configuració');
    assert.equal(Object.assign({}, ...action.props.style.filter(Boolean)).minHeight, 44);
    action.props.onPress();
    const close = nodes(notice).find(node => node.props.accessibilityLabel === 'Tancar avís');
    const closeStyle = Object.assign({}, ...close.props.style.filter(Boolean));
    assert.equal(closeStyle.width, 44);
    assert.equal(closeStyle.height, 44);
    close.props.onPress();
    assert.equal(actions, 1);
    assert.equal(dismissals, 1);
    const compact = Notice({ message: 'Buscant locals...', compact: true, action: { label: 'Aturar', onPress() {} } });
    const content = compact.props.children[0];
    const contentStyle = Object.assign({}, ...content.props.style.filter(Boolean));
    assert.equal(contentStyle.flexBasis, 'auto', 'compact text must retain intrinsic width, never a zero flex basis');
    assert.equal(contentStyle.flexGrow, 0);
    assert.equal(contentStyle.flexShrink, 1);
    assert.equal(compact.props.style[1].maxWidth, '100%');
    const compactStyle = Object.assign({}, ...compact.props.style.filter(Boolean));
    assert.equal(compactStyle.paddingLeft, compactStyle.paddingRight);
    const dismissible = Notice({ message: 'Locals trobats', compact: true, onDismiss() {} });
    const dismissibleStyle = Object.assign({}, ...dismissible.props.style.filter(Boolean));
    assert.equal(dismissibleStyle.paddingLeft, 44);
    assert.equal(dismissibleStyle.paddingRight, 44);
    const dismissButton = nodes(dismissible).find(node => node.props.accessibilityLabel === 'Tancar avís');
    assert.equal(Object.assign({}, ...dismissButton.props.style.filter(Boolean)).position, 'absolute');
    assert.equal(nodes(content).find(node => node.props.accessibilityRole === 'button').props.style[1].alignSelf, 'stretch');
});

test('API failures retain original codes, are unsuccessful and log without native LogBox error/warning calls', async () => {
    const logs = [];
    const console = { log() {}, info: (...args) => logs.push(args), error() { assert.fail('native error overlay'); }, warn() { assert.fail('native warning overlay'); } };
    const core = load('app\\src\\api\\core.ts', { '../utils/errorHandler': messages }, { console, URL, AbortController, setTimeout, clearTimeout });
    const failure = Object.assign(new Error('FirebaseError: private'), { code: 'auth/invalid-credential' });
    await assert.rejects(core.executeOrThrow(async () => { throw failure; }, 'loginEmail'), error => error === failure);
    const response = await core.executeRequest(async () => { throw failure; }, 'loginEmail');
    assert.equal(response.success, false);
    assert.equal(response.data, null);
    assert.equal(response.error, messages.STANDARD_MESSAGES.credentials);
    assert.equal(logs.length, 2);
    assert.equal(logs[0][1].code, failure.code);
    assert.equal(await core.executeOrThrow(async () => 7, 'success'), 7);
});

test('alerts delegate lifecycle to the toast library with safe messages, sticky timing and modal hosts', () => {
    const calls = [];
    let hides = 0;
    const Toast = Object.assign(() => null, { show: value => calls.push(value), hide: () => hides++ });
    const banner = load('app\\src\\components\\AlertBanner.tsx', {
        react: { ...React, useEffect: effect => effect() },
        'react-native': { View: 'View', StyleSheet: { create: value => value } },
        'react-native-toast-message': { __esModule: true, default: Toast },
        'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 24 }) },
        './UserNotice': { __esModule: true, default: 'UserNotice' },
        '../utils/errorHandler': messages,
    });
    const wrapper = banner.default({});
    assert.equal(wrapper.props.pointerEvents, 'box-none');
    assert.equal(wrapper.props.style.overflow, 'hidden', 'hidden library placeholders must not overflow narrow viewports');
    const host = wrapper.props.children;
    assert.equal(host.type, Toast);
    assert.equal(host.props.position, 'bottom');
    assert.equal(host.props.bottomOffset, 90);
    assert.equal(banner.default({ active: false }), null);
    assert.equal(banner.default({ topOffset: 2 }).props.children.props.topOffset, 12);
    banner.showAlert({ message: 'Primer avís', tone: 'error' });
    assert.equal(calls.at(-1).visibilityTime, 8000);
    assert.equal(calls.at(-1).autoHide, true);
    banner.showAlert({ message: 'Avís nou', duration: 0 });
    assert.equal(calls.at(-1).autoHide, false);
    banner.showAlert({ message: '[API FAIL] private response', tone: 'error' });
    assert.equal(calls.at(-1).props.message, messages.STANDARD_MESSAGES.unexpected);
    let actions = 0;
    banner.showAlert({ message: 'Acció', duration: 60000, position: 'top', offset: 55, action: { label: 'Continuar', onPress: () => actions++ } });
    assert.equal(calls.at(-1).visibilityTime, 15000);
    assert.equal(calls.at(-1).topOffset, 55);
    const content = host.props.config.trobar({ props: calls.at(-1).props, hide: Toast.hide });
    const notice = nodes(content).find(node => node.type === 'UserNotice');
    assert.equal(notice.props.compact, true);
    notice.props.action.onPress();
    assert.equal(actions, 1);
    assert.equal(hides, 1);
    banner.dismissAlert();
    assert.equal(hides, 2);
    const modal = banner.default({ priority: 1, defaultPosition: 'top' }).props.children;
    assert.equal(modal.type, Toast);
    assert.equal(modal.props.position, 'top');
    const visibility = [];
    const mapHost = banner.default({ bottomOffset: 48, horizontalInsets: { left: 62, right: 80 }, onVisibilityChange: value => visibility.push(value) }).props.children;
    const mapContent = mapHost.props.config.trobar({ props: { message: 'Avís del mapa' }, hide: Toast.hide });
    assert.equal(mapContent.props.style[1].paddingLeft, 62);
    assert.equal(mapContent.props.style[1].paddingRight, 80);
    mapHost.props.onShow();
    mapHost.props.onHide();
    assert.deepEqual(visibility, [true, false]);
});

function loginHarness(emailForm = true) {
    const slots = [], alerts = [], resetCalls = [], loginCalls = [];
    let cursor = 0, resetFailure, loginFailure, resume;
    const hooks = { ...React,
        useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
        useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
        useEffect() {},
    };
    const auth = { currentUser: null };
    const screen = load('app\\src\\screens\\LoginModal\\LoginModal.tsx', {
        react: hooks,
        'react-native': { ...Object.fromEntries(['View', 'ScrollView', 'TextInput', 'TouchableOpacity', 'Image', 'KeyboardAvoidingView'].map(key => [key, key])), Platform: { OS: 'web' }, PanResponder: { create: () => ({ panHandlers: {} }) } },
        '@react-navigation/native': { useIsFocused: () => true },
        'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
        'expo-status-bar': { StatusBar: 'StatusBar' },
        '../../components/AppText': { __esModule: true, default: 'Text' },
        '../../components/AppIcon': { __esModule: true, default: 'AppIcon' },
        '../../components/LoadingIndicator': { LoadingIndicator: 'LoadingIndicator' },
        '../../components/UserNotice': { __esModule: true, default: 'UserNotice' },
        '../../components/AlertBanner': { showAlert: value => alerts.push(value) },
        '../../context/AuthContext': { useAuth: () => ({ user: null, isLoading: false, loginEmail: async (...args) => { loginCalls.push(args); if (loginFailure) throw loginFailure; } }) },
        '../../context/SplashContext': { useScreenLoading() {} },
        '../../theme/editorialTheme': { EDITORIAL: {} },
        '../../theme/sketchTheme': { ensureLoraOnWeb() {}, SKETCH_THEME: { colors: {} } },
        '../../utils/errorHandler': messages,
        '../../config/firebase': { auth },
        '../../services/userService': { getUserProfile() {} },
        'firebase/auth': { sendPasswordResetEmail: async (...args) => { resetCalls.push(args); if (resume) await new Promise(resolve => { resume = resolve; }); if (resetFailure) throw resetFailure; } },
        './LoginModal.styles': { __esModule: true, default: {} },
        '../../../../assets/app/img/logo/mascot-open-cloche.png': 0,
        '../../../../assets/web/logos/wordmark-cream.png': 1,
    }, { console: { info() {} } });
    const render = () => { cursor = 0; return screen.default({ navigation: { canGoBack: () => true, goBack() {} } }); };
    const button = label => nodes(render()).find(node => node.type === 'TouchableOpacity' && text(node).includes(label));
    const field = placeholder => nodes(render()).find(node => node.props.placeholder === placeholder);
    if (emailForm) {
        button('Continuar amb el meu correu').props.onPress();
        field('Correu electrònic').props.onChangeText('  persona@example.test  ');
        field('Contrasenya').props.onChangeText('not-a-real-password');
    }
    return { render, button, alerts, resetCalls, loginCalls, auth,
        failReset: failure => { resetFailure = failure; },
        failLogin: failure => { loginFailure = failure; },
        pause: () => { resume = true; return () => { const callback = resume; resume = null; callback(); }; },
    };
}

test('login retains product copy and centers the open-cloche mascot above the troBar-only heading', () => {
    const ui = loginHarness(false);
    const tree = ui.render();
    const heading = nodes(tree).find(node => node.props.accessibilityRole === 'header');
    assert.equal(heading.props.accessibilityLabel, 'troBar');
    const brand = nodes(tree).find(node => node.props.testID === 'login-brand');
    assert.equal(nodes(brand).filter(node => node.type === 'Image').length, 2);
    assert(nodes(brand).includes(heading), 'mascot and wordmark stay together even when an inline error is shown');
    assert(!text(tree).includes('Entra a'));
    assert(text(tree).includes('Guarda els teus bars preferits, rep alertes de partits del Barça i descobreix on viure el proper clàssic. Si encara no tens compte, el crearem automàticament la primera vegada.'));
    assert(!text(tree).includes('El partit es viu millor junts.'));
    const mascot = nodes(tree).find(node => node.type === 'Image');
    assert.equal(mascot.props.resizeMode, 'contain');
    const styles = load('app\\src\\screens\\LoginModal\\LoginModal.styles.ts', {
        'react-native': { StyleSheet: { create: value => value } },
        '../../theme/editorialTheme': { EDITORIAL: {} },
    }).default;
    assert.equal(styles.logoImg.borderRadius, undefined);
    assert.equal(styles.logoImg.backgroundColor, undefined);
    assert.equal(styles.logoImg.borderWidth, undefined);
    assert.equal(styles.topBar.justifyContent, 'center');
    assert.equal(styles.topCloseButton.position, 'absolute');
    assert.equal(styles.header.alignItems, 'center');
    assert.equal(styles.logoImg.tintColor, '#F4E6CC');
    assert.equal(styles.wordmark.tintColor, styles.logoImg.tintColor);
    assert(styles.wordmark.marginTop <= 0);
});

test('failed login shows only a safe inline notice without account lookup or backend details', async () => {
    const ui = loginHarness();
    ui.failLogin({ code: 'auth/invalid-credential', message: '[API FAIL] private' });
    await ui.button('Entrar').props.onPress();
    const notice = nodes(ui.render()).find(node => node.type === 'UserNotice');
    assert.equal(notice.props.message, messages.STANDARD_MESSAGES.credentials);
    assert.equal(ui.alerts.length, 0);
    assert.equal(ui.loginCalls.length, 1);
});

test('recovery confirms neutrally, blocks concurrent reset/login and reports actual failures', async () => {
    const ui = loginHarness();
    const release = ui.pause();
    const reset = ui.button('Has oblidat');
    const first = reset.props.onPress();
    await reset.props.onPress();
    await ui.button('Entrar').props.onPress();
    assert.equal(ui.resetCalls.length, 1);
    assert.equal(ui.loginCalls.length, 0);
    assert.equal(ui.alerts.length, 0);
    assert.equal(ui.resetCalls[0][1], 'persona@example.test');
    assert.equal(ui.auth.languageCode, 'ca');
    assert.equal(ui.button('Enviant').props.disabled, true);
    release();
    await first;
    assert.equal(ui.alerts[0].message, messages.STANDARD_MESSAGES.resetSent);
    ui.failReset({ code: 'auth/network-request-failed', message: 'secret' });
    await ui.button('Has oblidat').props.onPress();
    assert.equal(ui.alerts.length, 1);
    assert.equal(nodes(ui.render()).find(node => node.type === 'UserNotice').props.message, messages.STANDARD_MESSAGES.connection);
    ui.failReset({ code: 'auth/user-not-found' });
    await ui.button('Has oblidat').props.onPress();
    assert.equal(ui.alerts[1].message, ui.alerts[0].message);
});
