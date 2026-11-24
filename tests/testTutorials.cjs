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
                View: 'View', Modal: 'Modal', ScrollView: 'ScrollView', TouchableOpacity: 'Button',
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
        register(id, ready = true, rect = [20, 100, 320, 48]) {
            return tree.props.value.register(id, { ready, prepare: () => prepared.push(id),
                node: () => ({ measureInWindow: callback => callback(...(typeof rect === 'function' ? rect() : rect)) }) });
        },
        start(kind) { tree.props.value.start(kind); render(); },
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

test('basic coachmarks wait for a ready control and legal consent; skip persists and manual replay remains available', async () => {
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
    assert.equal(h.title(), 'Troba on veure el partit');
    h.click('Saltar la guia');
    h.click('Saltar la guia');
    await h.flush();
    assert.equal(h.writes.length, 1, 'double taps must not persist twice');
    assert.equal(h.storage.get(h.tutorialKey('basic')), 'done');
    assert.equal(h.visible(), false);
    h.start('basic');
    await h.flush();
    assert.equal(h.visible(), true);
});

test('basic guide advances across actual targets, supports going back and persists only on completion', async () => {
    const h = tutorialHarness();
    for (const id of ['map-search', 'map-compass', 'map-area', 'map-matches']) h.register(id);
    await h.flush();
    h.click('Següent'); await h.flush();
    assert.equal(h.title(), 'Mou-te al teu ritme');
    h.click('Anterior'); await h.flush();
    assert.equal(h.title(), 'Troba on veure el partit');
    for (let i = 0; i < 3; i++) { h.click('Següent'); await h.flush(); }
    assert.equal(h.title(), 'Tria el partit');
    assert.equal(h.writes.length, 0);
    h.click('Entesos'); await h.flush();
    assert.equal(h.visible(), false);
    assert.equal(h.writes.length, 1);
    assert(h.prepared.includes('map-matches'));
});

test('account onboarding navigates to an unmounted Profile; progress stays separate for each account and owner role', async () => {
    const h = tutorialHarness();
    h.register('map-search');
    await h.flush();
    h.click('Saltar la guia'); await h.flush();
    h.auth({ user: { id: 'culer-a', role: 'user' }, isLoading: false }, 'Map');
    await h.flush();
    assert.equal(h.navigations.at(-1), 'Profile', 'do not require Profile to be mounted before starting the account guide');
    h.register('profile-details'); await h.flush();
    assert.equal(h.title(), 'El teu perfil');
    h.click('Saltar la guia'); await h.flush();
    h.auth({ user: { id: 'culer-b', role: 'user' }, isLoading: false }, 'Map');
    await h.flush();
    assert.equal(h.title(), 'El teu perfil');
    assert.equal(h.storage.get(h.tutorialKey('account', 'culer-a')), 'done');
    assert.equal(h.storage.has(h.tutorialKey('account', 'culer-b')), false);
    h.click('Saltar la guia'); await h.flush();
    h.register('owner-edit');
    h.auth({ user: { id: 'owner', role: 'bar_owner' }, isLoading: false }, 'BarDashboard');
    await h.flush();
    assert.equal(h.title(), 'Presenta el teu bar');
    h.click('Saltar la guia'); await h.flush();
    assert.equal(h.storage.get(h.tutorialKey('owner', 'owner')), 'done');
    assert.equal(h.storage.has(h.tutorialKey('account', 'owner')), false);
});

test('storage failures are reported without a false persisted completion or an automatic restart loop', async () => {
    for (const failure of ['read', 'write']) {
        const h = tutorialHarness({ failRead: failure === 'read', failWrite: failure === 'write' });
        h.register('map-search');
        await h.flush();
        if (failure === 'read') { assert.equal(h.visible(), false); h.start('basic'); await h.flush(); }
        h.click('Saltar la guia'); await h.flush();
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
    assert.equal(h.visible(), false);
    moving = false;
    await h.flush();
    assert.equal(h.visible(), true);
    assert.equal(h.notices.length, 0);
});
