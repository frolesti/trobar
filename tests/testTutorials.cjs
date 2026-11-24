const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

const compile = source => ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText;
const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : node?.props ? [node, ...nodes(node.props.children)] : [];

function tutorialHarness({ storage = new Map(), failRead = false, failWrite = false } = {}) {
    const slots = [], pending = [], frames = new Map(), writes = [], notices = [], navigations = [], prepared = [];
    let cursor = 0, dirty = true, frameId = 0, tree;
    let auth = { user: null, isLoading: false, requiresRegistrationConsent: false };
    let route = 'Map';
    const hooks = {
        ...React,
        useState(initial) {
            const index = cursor++;
            if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
            return [slots[index], value => {
                const next = typeof value === 'function' ? value(slots[index]) : value;
                if (!Object.is(next, slots[index])) { slots[index] = next; dirty = true; }
            }];
        },
        useRef(initial) {
            const index = cursor++;
            if (!(index in slots)) slots[index] = { current: initial };
            return slots[index];
        },
        useMemo(factory, deps) {
            const index = cursor++;
            if (!slots[index] || deps.some((value, i) => !Object.is(value, slots[index].deps[i]))) slots[index] = { deps, value: factory() };
            return slots[index].value;
        },
        useCallback(callback, deps) { return hooks.useMemo(() => callback, deps); },
        useEffect(effect, deps) {
            const index = cursor++;
            if (!slots[index] || deps.some((value, i) => !Object.is(value, slots[index].deps[i]))) {
                const previous = slots[index];
                slots[index] = { deps };
                pending.push(() => { previous?.cleanup?.(); slots[index].cleanup = effect(); });
            }
        },
    };
    const navigation = { isReady: () => true, navigate(screen) { navigations.push(screen); route = screen; dirty = true; } };
    const module = { exports: {} };
    vm.runInNewContext(compile(fs.readFileSync(require.resolve('../app/src/context/TutorialContext.tsx'), 'utf8')), {
        exports: module.exports, console: { info() {} },
        requestAnimationFrame: callback => { frames.set(++frameId, callback); return frameId; },
        cancelAnimationFrame: id => frames.delete(id),
        require(name) {
            if (name === 'react') return hooks;
            if (name === 'react-native') return {
                View: 'View', Modal: 'Modal', ScrollView: 'ScrollView', TouchableOpacity: 'Button', ActivityIndicator: 'Spinner',
                StyleSheet: { create: value => value }, Keyboard: { dismiss() {} },
                AccessibilityInfo: { announceForAccessibility() {} }, useWindowDimensions: () => ({ width: 390, height: 844 }),
            };
            if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ top: 44, bottom: 34 }) };
            if (name.includes('async-storage')) return { __esModule: true, default: {
                async multiGet(keys) { if (failRead) throw Error('Read failed'); return keys.map(key => [key, storage.get(key) ?? null]); },
                async setItem(key, value) { writes.push([key, value]); if (failWrite) throw Error('Write failed'); storage.set(key, value); },
            } };
            if (name.includes('AuthContext')) return { useAuth: () => auth };
            if (name.includes('AlertBanner')) return { showAlert: notice => notices.push(notice) };
            if (name.includes('editorialTheme')) return { EDITORIAL: {} };
            if (name.endsWith('AppText')) return { __esModule: true, default: 'Text' };
            if (name === '@react-navigation/native') return {};
            throw Error(name);
        },
    });
    const render = () => {
        for (let attempt = 0; dirty && attempt < 30; attempt++) {
            dirty = false; cursor = 0;
            tree = module.exports.TutorialProvider({ children: null, navigation, route });
            pending.splice(0).forEach(effect => effect());
        }
        assert(!dirty, 'tutorial render must settle');
        return tree;
    };
    const flush = async (count = 8) => {
        for (let turn = 0; turn < count; turn++) {
            await Promise.resolve();
            render();
            const callbacks = [...frames.values()];
            frames.clear();
            callbacks.forEach(callback => callback());
        }
        render();
    };
    render();
    return {
        ...module.exports, storage, writes, notices, navigations, prepared, flush,
        register(id, ready = true, rect = [20, 100, 320, 48], available = true) {
            return tree.props.value.register(id, { ready, available, prepare: () => prepared.push(id),
                node: () => ({ measureInWindow: callback => callback(...(typeof rect === 'function' ? rect() : rect)) }) });
        },
        auth(value, screen = route) { auth = value; route = screen; dirty = true; render(); },
        title() { return nodes(render()).find(node => node.props.accessibilityRole === 'header' && this.visible())?.props.children; },
        visible() { return nodes(render()).find(node => node.type === 'Modal').props.visible; },
        click(label) {
            const button = nodes(render()).find(node => node.type === 'Button' && nodes(node).some(child => child.props.children === label));
            assert(button, `missing ${label}`);
            button.props.onPress();
        },
    };
}

test('basic coachmarks wait for a ready control and legal consent; skip persists with no replay action', async () => {
    const h = tutorialHarness();
    const unregister = h.register('map-search', false);
    await h.flush();
    assert.equal(h.visible(), false);
    unregister();
    h.auth({ user: null, isLoading: false, requiresRegistrationConsent: true });
    h.register('map-search');
    await h.flush();
    assert.equal(h.visible(), false);
    h.auth({ user: null, isLoading: false, requiresRegistrationConsent: false });
    await h.flush();
    assert.equal(h.title(), 'Troba bar, sense crear un compte');
    h.click('Omet');
    h.click('Omet');
    await h.flush();
    assert.equal(h.writes.length, 2, 'one start and one completion, even after double taps');
    assert.equal(h.storage.get(h.tutorialKey('basic')), 'done');
    assert.equal(h.visible(), false);
    const reopened = tutorialHarness({ storage: h.storage });
    reopened.register('map-search');
    await reopened.flush();
    assert.equal(reopened.visible(), false);
    assert.equal(reopened.writes.length, 0);
});

test('basic guide advances across actual targets, supports going back and persists only on completion', async () => {
    const h = tutorialHarness();
    const targets = ['map-search', 'map-filters', 'map-bar', 'map-directions', 'map-premium', 'map-matches', 'map-discovery', 'map-report', 'map-account'];
    for (const id of targets) h.register(id);
    await h.flush();
    h.click('Següent'); await h.flush();
    assert.equal(h.title(), 'Tria l’ambient que busques');
    h.click('Enrere'); await h.flush();
    assert.equal(h.title(), 'Troba bar, sense crear un compte');
    for (let i = 0; i < targets.length - 1; i++) { h.click('Següent'); await h.flush(); }
    assert.equal(h.title(), 'Amb compte, hi guanyes més');
    assert.equal(h.storage.get(h.tutorialKey('basic')), 'started');
    h.click('Explorar el mapa'); await h.flush();
    assert.equal(h.visible(), false);
    assert.equal(h.writes.length, 2);
    assert(h.prepared.includes('map-matches'));
    assert(h.prepared.includes('map-report'));
    assert(h.prepared.includes('map-directions'));
    assert.equal(h.navigations.includes('Login'), false, 'account creation is not required');
});

test('account onboarding navigates to an unmounted Profile; progress stays separate for each account and owner role', async () => {
    const h = tutorialHarness();
    h.register('map-search');
    await h.flush();
    h.click('Omet'); await h.flush();
    h.auth({ user: { id: 'culer-a', role: 'user' }, isLoading: false }, 'Map');
    await h.flush();
    assert.equal(h.navigations.at(-1), 'Profile', 'do not require Profile to be mounted before starting the account guide');
    h.register('profile-details'); await h.flush();
    assert.equal(h.title(), 'El teu perfil');
    h.click('Omet'); await h.flush();
    h.auth({ user: { id: 'culer-b', role: 'user' }, isLoading: false }, 'Map');
    await h.flush();
    assert.equal(h.title(), 'El teu perfil');
    assert.equal(h.storage.get(h.tutorialKey('account', 'culer-a')), 'done');
    assert.equal(h.storage.get(h.tutorialKey('account', 'culer-b')), 'started');
    h.click('Omet'); await h.flush();
    h.register('owner-edit');
    h.auth({ user: { id: 'owner', role: 'bar_owner' }, isLoading: false }, 'BarDashboard');
    await h.flush();
    assert.equal(h.title(), 'Presenta el teu bar');
    h.click('Omet'); await h.flush();
    assert.equal(h.storage.get(h.tutorialKey('owner', 'owner')), 'done');
    assert.equal(h.storage.has(h.tutorialKey('account', 'owner')), false);
});

test('storage failures are reported without a false persisted completion or an automatic restart loop', async () => {
    for (const failure of ['read', 'write']) {
        const h = tutorialHarness({ failRead: failure === 'read', failWrite: failure === 'write' });
        h.register('map-search');
        await h.flush();
        if (failure === 'read') assert.equal(h.visible(), false);
        else { h.click('Omet'); await h.flush(); }
        assert.equal(h.visible(), false);
        assert(h.notices.some(notice => notice.tone === 'error'));
        if (failure === 'write') assert.equal(h.storage.has(h.tutorialKey('basic')), false);
    }
});

test('unmeasurable controls produce a recoverable notice instead of a stalled guide; cards stay within safe areas', async () => {
    const h = tutorialHarness();
    h.register('map-search', true, [0, -100, 320, 48]);
    await h.flush(40);
    assert.equal(h.visible(), false);
    assert.equal(h.notices.length, 1);
    for (const height of [568, 844]) for (const y of [44, 260, height - 90]) for (const cardHeight of [220, 400]) {
        const top = h.tutorialCardTop({ x: 10, y, width: 300, height: 48 }, height, 44, 34, cardHeight);
        assert(top >= 56);
        assert(top + cardHeight <= height - 34 - 12);
    }
});

test('coachmarks wait for a moving control to settle before placing the spotlight', async () => {
    const h = tutorialHarness();
    let moving = true, x = 100;
    h.register('map-search', true, () => [moving ? (x -= 5) : 20, 100, 240, 48]);
    await h.flush();
    assert.equal(h.title(), undefined);
    moving = false;
    await h.flush();
    assert.equal(h.visible(), true);
    assert.equal(h.notices.length, 0);
});

test('an interrupted guide is not replayed; only real available venue steps are included', async () => {
    const h = tutorialHarness();
    for (const id of ['map-search', 'map-filters', 'map-discovery', 'map-report', 'map-account']) h.register(id);
    for (const id of ['map-bar', 'map-directions', 'map-premium', 'map-matches']) h.register(id, false, [0, 0, 0, 0], false);
    await h.flush();
    const restarted = tutorialHarness({ storage: h.storage });
    restarted.register('map-search');
    await restarted.flush();
    assert.equal(restarted.visible(), false, 'starting once is enough to suppress future automatic replay');
    for (let i = 0; i < 4; i++) { h.click('Següent'); await h.flush(); }
    assert.equal(h.title(), 'Amb compte, hi guanyes més');
    h.click('Crear un compte gratuït'); await h.flush();
    assert.equal(h.navigations.at(-1), 'Login');
    assert(!h.prepared.includes('map-bar'), 'never invent a venue when the catalogue is empty');
});
