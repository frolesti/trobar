const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

const compile = source => ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText;

function ownerMapHarness() {
    const source = fs.readFileSync(require.resolve('../app/src/screens/Map/MapScreen.tsx'), 'utf8');
    const ast = ts.createSourceFile('MapScreen.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const fragments = {};
    function visit(node) {
        if (ts.isVariableDeclaration(node) && ['focusOwnedBar', 'fetchRoute'].includes(node.name.getText(ast))) {
            fragments[node.name.getText(ast)] = node.initializer.getText(ast);
        }
        if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useFocusEffect' && node.getText(ast).includes('getOwnedBar(user.id)')) {
            fragments.load = node.arguments[0].arguments[0].getText(ast);
        }
        if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect') {
            if (node.getText(ast).includes('!ownerBar || !mapReady')) fragments.apply = node.arguments[0].getText(ast);
            if (node.getText(ast).includes('Requesting foreground permissions')) fragments.gps = node.arguments[0].getText(ast);
        }
        ts.forEachChild(node, visit);
    }
    visit(ast);
    assert.equal(Object.keys(fragments).length, 5);
    const cameras = [], selections = [], requests = [], notices = [];
    const context = {
        user: { id: 'owner', role: 'bar_owner' }, ownerBar: null, mapReady: false, userLocation: null,
        ownerEntryHandledRef: { current: false }, lastRegionRef: { current: null }, routeRequestId: { current: 0 },
        MAP_REGION_DELTA: 0.008, useCallback: callback => callback, ownerDemoCopy: bar => bar,
        mapRefNative: { current: { animateToRegion: region => cameras.push(region) } },
        setCenterLocation: value => { context.centerLocation = value; }, setVisibleBounds() {}, setCurrentZoom() {}, setSearchQuery() {},
        setShowBarProfile: value => { context.expanded = value; }, handleSelectBar: bar => selections.push(bar),
        setOwnerBar: value => { context.ownerBar = value; },
        getOwnedBar: () => new Promise(resolve => requests.push(resolve)),
        showAlert: value => notices.push(value), console: { info() {} },
        Location: { requestForegroundPermissionsAsync() { throw new Error('owner entry must not request GPS'); } },
    };
    vm.runInNewContext(compile(Object.entries(fragments).map(([name, value]) => `globalThis.${name} = ${value};`).join('\n')), context);
    return { context, cameras, selections, requests, notices };
}

test('owner entry waits for real map readiness then centers and selects only the compact owned-bar card', async () => {
    for (const readyFirst of [true, false]) {
        const { context, cameras, selections, requests } = ownerMapHarness();
        context.gps();
        const cleanup = context.load();
        context.mapReady = readyFirst;
        context.apply();
        assert.equal(cameras.length, 0);
        const bar = { id: 'owned', name: 'El meu local', latitude: 41.56, longitude: 2.01 };
        requests[0](bar);
        await Promise.resolve();
        context.apply();
        assert.equal(cameras.length, readyFirst ? 1 : 0);
        context.mapReady = true;
        context.apply();
        context.apply();
        assert.equal(cameras.length, 1);
        assert.equal(cameras[0].latitude, bar.latitude);
        assert.equal(cameras[0].longitude, bar.longitude);
        assert.equal(cameras[0].latitudeDelta, 0.008);
        assert.equal(selections[0], bar);
        assert.equal(context.expanded, false);
        await context.fetchRoute(bar);
        assert.equal(context.routeRequestId.current, 1, 'invalidate stale routes without making a paid request from the bar to itself');
        cleanup();
    }
});

test('late owner lookup cannot override explicit GPS choice, blurred screens or invalid coordinates', async () => {
    const bar = { id: 'owned', latitude: 41, longitude: 2 };
    for (const choice of ['gps', 'blur', 'invalid']) {
        const { context, cameras, requests, notices } = ownerMapHarness();
        const cleanup = context.load();
        context.mapReady = true;
        if (choice === 'gps') context.ownerEntryHandledRef.current = true;
        if (choice === 'blur') cleanup();
        requests[0](choice === 'invalid' ? { ...bar, latitude: 91 } : bar);
        await Promise.resolve();
        context.apply();
        assert.equal(cameras.length, 0);
        assert.equal(notices.length, choice === 'invalid' ? 1 : 0);
        if (choice === 'blur') assert.equal(context.ownerBar, null);
    }
});

test('web Google map initializes with supported stable options, without resetting pan/zoom on parent renders', () => {
    const source = fs.readFileSync(require.resolve('../app/src/shims/react-native-maps.web.tsx'), 'utf8');
    let index = 0;
    const memos = [];
    const hooks = {
        ...React, useEffect() {}, useImperativeHandle() {}, useRef: () => ({ current: null }),
        useState: initial => [initial, () => {}], useCallback: callback => callback,
        useMemo(factory, deps) {
            const position = index++;
            const previous = memos[position];
            if (!previous || deps.some((value, i) => value !== previous.deps[i])) memos[position] = { deps, value: factory() };
            return memos[position].value;
        },
    };
    const module = { exports: {} };
    vm.runInNewContext(compile(source), {
        exports: module.exports, process: { env: { EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: 'test-key' } },
        window: { google: { maps: { ControlPosition: { LEFT_BOTTOM: 6 } } } },
        require(name) {
            if (name === 'react') return hooks;
            if (name === 'react-native') return { View: 'View', StyleSheet: require('react-native-web').StyleSheet };
            if (name === '@react-google-maps/api') return { GoogleMap: 'GoogleMap', OverlayView: 'OverlayView', useJsApiLoader: () => ({ isLoaded: true }) };
            return { __esModule: true, default: 'Component' };
        },
    });
    const render = props => { index = 0; return module.exports.default.render(props, null).props.children; };
    const first = render({ initialRegion: { latitude: 41.38, longitude: 2.17, latitudeDelta: 0.05 } });
    assert.equal(first.props.options.center.lat, 41.38);
    assert.equal(first.props.options.center.lng, 2.17);
    assert.equal(first.props.options.zoom, 13);
    assert.equal(first.props.defaultCenter, undefined);
    assert.equal(first.props.defaultZoom, undefined);
    assert.equal(first.props.center, undefined);
    assert.equal(first.props.zoom, undefined);
    const next = render({ initialRegion: { latitude: 42, longitude: 3, latitudeDelta: 1 } });
    assert.equal(next.props.options, first.props.options, 'stable options do not reset user pan/zoom on idle-driven parent renders');
    assert(!source.includes('setTimeout(recenter'), 'do not repeatedly recenter on artificial timers');
});

test('web map projects real pin coordinates and preserves or restores the exact viewport zoom', async () => {
    let api;
    const hooks = { ...React,
        useEffect() {}, useImperativeHandle(_ref, factory) { api = factory(); },
        useRef: value => ({ current: value }), useState: initial => [initial, () => {}],
        useCallback: callback => callback, useMemo: factory => factory(), useContext: () => ({}),
    };
    class LatLng {
        constructor(latitude, longitude) { this.latitude = latitude; this.longitude = longitude; }
        lat() { return this.latitude; }
        lng() { return this.longitude; }
    }
    const module = { exports: {} };
    vm.runInNewContext(compile(fs.readFileSync(require.resolve('../app/src/shims/react-native-maps.web.tsx'), 'utf8')), {
        exports: module.exports, process: { env: { EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: 'test-key' } },
        window: { google: { maps: { LatLng, Point: class { constructor(x, y) { this.x = x; this.y = y; } }, ControlPosition: { LEFT_BOTTOM: 6 } } } },
        require(name) {
            if (name === 'react') return hooks;
            if (name === 'react-native') return { View: 'View', StyleSheet: require('react-native-web').StyleSheet };
            if (name === '@react-google-maps/api') return { GoogleMap: 'GoogleMap', OverlayView: 'OverlayView', useJsApiLoader: () => ({ isLoaded: true }) };
            return { __esModule: true, default: 'Component' };
        },
    });
    const mapElement = module.exports.default.render({}, null).props.children;
    await assert.rejects(api.pointForCoordinate({ latitude: 0, longitude: 0 }), /not ready/);
    let zoom = 14;
    const zooms = [], pans = [];
    mapElement.props.onLoad({
        getDiv: () => ({ clientWidth: 390, clientHeight: 844 }),
        getCenter: () => new LatLng(0, 0), getZoom: () => zoom,
        setZoom: value => { zooms.push(value); zoom = value; }, panTo: value => pans.push(value),
        getProjection: () => ({
            fromLatLngToPoint: point => ({ x: point.lng() + 128, y: 128 - point.lat() }),
            fromPointToLatLng: point => new LatLng(128 - point.y, point.x - 128),
        }),
    });
    const center = await api.pointForCoordinate({ latitude: 0, longitude: 0 });
    assert.deepEqual({ ...center }, { x: 195, y: 422 });
    const nearby = await api.pointForCoordinate({ latitude: 1 / 2 ** zoom, longitude: 1 / 2 ** zoom });
    assert.deepEqual({ ...nearby }, { x: 196, y: 421 });
    const roundTrip = await api.coordinateForPoint(nearby);
    assert.deepEqual({ ...roundTrip }, { latitude: 1 / 2 ** zoom, longitude: 1 / 2 ** zoom });
    const region = { latitude: 41.4, longitude: 2.1, latitudeDelta: 0.05, longitudeDelta: 360 * 390 / (256 * 2 ** 14) };
    api.animateToRegion(region);
    assert.equal(zooms.length, 0, 'selection must not change the existing zoom');
    assert.deepEqual({ ...pans[0] }, { lat: 41.4, lng: 2.1 });
    zoom = 16;
    api.animateToRegion(region);
    assert.equal(zoom, 14, 'closing restores the previous zoom even after the user zoomed while the card was open');
    const marker = module.exports.Marker({ coordinate: { latitude: 0, longitude: 0 }, anchor: { x: 0.5, y: 1 }, children: 'pin' });
    assert.equal(marker.props.getPixelPositionOffset, undefined, 'an early zero-size overlay measurement must not misplace loaded images');
    assert.equal(marker.props.children.props.style.transform, 'translate(-50%, -100%)');
});

test('one map mounts immediately with the original platform provider, without focus remounts or timed provider changes', () => {
    const source = fs.readFileSync(require.resolve('../app/src/screens/Map/MapScreen.tsx'), 'utf8');
    const ast = ts.createSourceFile('MapScreen.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let map, timeoutEffect;
    const visit = node => {
        if (ts.isJsxOpeningElement(node) && node.tagName.getText(ast) === 'MapView') map = node;
        if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect'
            && node.getText(ast).includes('Map did not report readiness')) timeoutEffect = node.arguments[0].getText(ast);
        ts.forEachChild(node, visit);
    };
    visit(ast);
    assert(map);
    assert(ts.isJsxElement(map.parent.parent), 'the map must not be gated behind focus, layout, GPS or data readiness');
    assert(!source.includes('setNativeMapMounted'));
    assert(!source.includes('nativeMapVisitedRef'));
    assert(!source.includes('useDeviceMap'));
    assert(!source.includes('canMountMap'));
    const attributes = map.attributes.properties;
    const attribute = name => attributes.find(item => item.name?.getText(ast) === name);
    assert(!attribute('onLayout'), 'layout is not proof that cartography is ready');
    assert.equal(attribute('key').initializer.expression.getText(ast), 'nativeMapRevision');
    const camera = { latitude: 0, longitude: 0, latitudeDelta: 0.01, longitudeDelta: 0.02 };
    const context = {
        nativeMapRevision: 1, nativeMapRevisionRef: { current: 1 },
        lastRegionRef: { current: camera }, setMapReady: value => { context.ready = value; },
        setMapLoadFailed: value => { context.failed = value; },
    };
    vm.runInNewContext(compile(`globalThis.region = ${attribute('initialRegion').initializer.expression.getText(ast)};
        globalThis.readyCallback = ${attribute('onMapReady').initializer.expression.getText(ast)};`), context);
    assert.equal(context.region, camera);
    context.readyCallback();
    assert.equal(context.ready, true);
    assert.equal(context.failed, false);
    context.ready = false;
    context.nativeMapRevisionRef.current = 2;
    context.readyCallback();
    assert.equal(context.ready, false, 'ignore stale callbacks after an explicit user retry');
    assert(timeoutEffect);
    let timeoutCallback, delay, cleared;
    const timerContext = {
        mapReady: false, nativeMapRevision: 1, Platform: { OS: 'ios' }, console: { info() {} },
        setNativeMapRevision() { throw new Error('timeouts must never remount or switch the provider'); },
        setMapLoadFailed(value) { timerContext.failed = value; },
        setTimeout(callback, milliseconds) { timeoutCallback = callback; delay = milliseconds; return 42; },
        clearTimeout(id) { cleared = id; },
    };
    vm.runInNewContext(compile(`globalThis.effect = ${timeoutEffect};`), timerContext);
    const cleanup = timerContext.effect();
    assert.equal(delay, 8000, 'this is an error watchdog, not a delay before mounting');
    timeoutCallback();
    assert.equal(timerContext.failed, true);
    cleanup();
    assert.equal(cleared, 42);
    timerContext.mapReady = true;
    delay = null;
    assert.equal(timerContext.effect(), undefined);
    assert.equal(delay, null);
    assert(source.includes("useScreenLoading('MapScreen', false)"), 'a global opaque splash must not occlude native map rendering');
    assert(source.includes('collapsable={false}'));
    assert(source.includes("label: 'Tornar-ho a provar'"));
    for (const platform of ['ios', 'android', 'web']) {
        for (const role of ['bar_owner', 'user']) {
            const style = { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 };
            const providerContext = { user: { role }, PROVIDER_GOOGLE: 'google', CUSTOM_MAP_STYLE: ['google-style'], Platform: { OS: platform }, styles: { map: style } };
            vm.runInNewContext(compile(`globalThis.provider = ${attribute('provider').initializer.expression.getText(ast)};
                globalThis.style = ${attribute('style').initializer.expression.getText(ast)};
                globalThis.customStyle = ${attribute('customMapStyle').initializer.expression.getText(ast)};`), providerContext);
            assert.equal(providerContext.provider, platform === 'android' ? 'google' : undefined);
            assert.equal(providerContext.style, style);
            assert.equal(providerContext.customStyle, platform === 'ios' ? undefined : providerContext.CUSTOM_MAP_STYLE);
        }
    }
});

test('stale named searches cannot overwrite newer results or reopen a dismissed dropdown', async () => {
    const source = fs.readFileSync(require.resolve('../app/src/screens/Map/MapScreen.tsx'), 'utf8');
    const ast = ts.createSourceFile('MapScreen.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let declaration;
    const visit = node => {
        if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'searchNominatim') declaration = node;
        ts.forEachChild(node, visit);
    };
    visit(ast);
    const requests = [];
    const rendered = [];
    const searchRequestRef = { current: 0 };
    const module = { exports: {} };
    vm.runInNewContext(compile(`export const ${declaration.getText(ast)};`), {
        exports: module.exports, useCallback: callback => callback, searchRequestRef,
        centerLocation: { latitude: 41, longitude: 2 },
        setGeoSuggestions: value => rendered.push(value),
        searchMapLocations: () => new Promise(resolve => requests.push(resolve)),
        showAlert() {}, console: { info() {} },
    });
    const first = module.exports.searchNominatim('Old bar');
    const second = module.exports.searchNominatim('New bar');
    requests[1]({ suggestions: ['new'], partial: false });
    await second;
    requests[0]({ suggestions: ['old'], partial: false });
    await first;
    assert.deepEqual(rendered, [['new']]);
    const third = module.exports.searchNominatim('Dismissed');
    searchRequestRef.current++;
    requests[2]({ suggestions: ['dismissed'], partial: false });
    await third;
    assert.deepEqual(rendered, [['new']]);
});

test('unregistered popup accepts zero coordinates, preserves Place ID and address, blocks duplicate reports and cleans navigation timers', async () => {
    const slots = [], callbacks = [], calls = [], timers = new Map(), cleanups = [];
    let cursor = 0, release, timerId = 0;
    const hooks = { ...React,
        useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = value; }]; },
        useRef(initial) { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
        useEffect(effect) { const i = cursor++; if (!(i in slots)) { slots[i] = true; callbacks.push(effect); } },
    };
    const module = { exports: {} };
    vm.runInNewContext(compile(fs.readFileSync(require.resolve('../app/src/screens/ReportBar/ReportBarScreen.tsx'), 'utf8')), {
        exports: module.exports, setTimeout: callback => { timers.set(++timerId, callback); return timerId; }, clearTimeout: id => timers.delete(id),
        console: { info() {} },
        require(name) {
            if (name === 'react') return hooks;
            if (name === 'react-native') return {
                View: 'View', TouchableOpacity: 'TouchableOpacity', ScrollView: 'ScrollView',
                useWindowDimensions: () => ({ height: 800 }),
                Animated: { Value: class {}, View: 'AnimatedView', spring() {}, timing() {}, parallel: () => ({ start: callback => callback?.() }) },
                Easing: { in: value => value, back() {} },
            };
            if (name === '@react-navigation/native') return { useIsFocused: () => true };
            if (name.endsWith('editorialTheme')) return { EDITORIAL: {} };
            if (name.endsWith('AuthContext')) return { useAuth: () => ({ user: { id: 'alice' } }) };
            if (name.endsWith('barService')) return { addUserReportedBar: (...args) => { calls.push(['report', ...args]); return new Promise(resolve => { release = resolve; }); } };
            if (name.endsWith('placesService')) return { fetchBarPlaceDetails: async (...args) => {
                calls.push(['details', ...args]);
                return { formattedAddress: 'Major, Terrassa' };
            } };
            if (name.endsWith('AlertBanner')) return { __esModule: true, default: 'AlertBanner', showAlert: value => calls.push(['notice', value]) };
            if (name.endsWith('AppText')) return { __esModule: true, default: 'Text' };
            if (name.endsWith('BarCard')) return { __esModule: true, default: 'BarCard' };
            if (name.endsWith('UserNotice')) return { __esModule: true, default: 'UserNotice' };
            throw new Error(`Unexpected dependency ${name}`);
        },
    });
    const props = { navigation: { navigate: () => calls.push(['navigate']), goBack: () => calls.push(['close']) },
        route: { params: { osmBar: { id: 'google_fixture', name: 'Local', googlePlaceId: 'fixture', lat: 0, lon: 0, tags: { 'addr:street': 'Major', 'addr:city': 'Terrassa' } } } } };
    const nodes = node => !React.isValidElement(node) ? [] : [node, ...React.Children.toArray(node.props.children).flatMap(nodes)];
    const detailCredits = [];
    const render = (extra = {}) => { cursor = 0; return nodes(module.exports.ReportBarContent({
        osmBar: props.route.params.osmBar,
        onClose: props.navigation.goBack,
        onRegistered: props.navigation.navigate,
        onGoogleDetailsChange: value => detailCredits.push(value),
        ...extra,
    })); };
    let tree = render();
    callbacks.forEach(callback => cleanups.push(callback()));
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(calls[0], ['details', 'Local', 0, 0, 'fixture']);
    tree = render();
    assert.deepEqual(detailCredits, [false, true], 'notify the shared map footer once Google details are visible');
    assert(tree.some(node => node.type === 'Text' && node.props.children === 'Google Maps'), 'standalone report retains Google credit');
    assert(!render({ attributionInMap: true }).some(node => node.type === 'Text' && node.props.children === 'Google Maps'), 'embedded map card does not duplicate the map footer');
    const card = tree.find(node => node.type === 'BarCard');
    assert.equal(card.props.address, 'Major, Terrassa');
    const first = card.props.onConfirm();
    const second = card.props.onConfirm();
    card.props.onCancel();
    assert.equal(calls.filter(call => call[0] === 'report').length, 1);
    assert.equal(calls.filter(call => call[0] === 'close').length, 0);
    release();
    await Promise.all([first, second]);
    assert.equal(timers.size, 1);
    assert.equal(render().find(node => node.type === 'UserNotice').props.tone, 'success');
    cleanups.forEach(cleanup => cleanup?.());
    assert.equal(detailCredits.at(-1), false, 'clear detail attribution when the popup closes');
    assert.equal(timers.size, 0);
    assert.equal(calls.filter(call => call[0] === 'navigate').length, 0);
});
