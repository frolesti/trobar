const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const geometry = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../app/src/utils/mapSelection.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: geometry.exports });
const { selectionRegion, mapBubbleLayout, mapMarkerSize, cameraForRegion, isValidMapRegion } = geometry.exports;
const source = fs.readFileSync(require.resolve('../app/src/screens/Map/MapScreen.tsx'), 'utf8');
const parsed = ts.createSourceFile('MapScreen.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function implementation(name, declaration = false) {
    let result;
    function visit(node) {
        if ((declaration ? ts.isFunctionDeclaration(node) : ts.isVariableDeclaration(node)) && node.name?.getText(parsed) === name) {
            result = declaration ? node.getText(parsed) : node.initializer.getText(parsed);
        }
        ts.forEachChild(node, visit);
    }
    visit(parsed);
    assert(result, `missing ${name}`);
    return result;
}

test('selecting either venue pans to the popup anchor without zooming at any viewport or existing zoom', () => {
    for (const height of [568, 667, 844]) for (const delta of [0.0004, 0.008, 0.1, 2]) {
        const region = { latitude: 41.4, longitude: 2.1, latitudeDelta: delta, longitudeDelta: delta * 0.6 };
        const coordinate = { latitude: 41.41, longitude: 2.11 };
        const target = height - 124;
        const next = selectionRegion(region, coordinate, target, height);
        assert.equal(next.latitudeDelta, region.latitudeDelta);
        assert.equal(next.longitudeDelta, region.longitudeDelta);
        assert.equal(next.longitude, coordinate.longitude);
        const projectedY = height / 2 + (next.latitude - coordinate.latitude) * height / next.latitudeDelta;
        assert(Math.abs(projectedY - target) < 0.0001);
        assert.equal(region.latitude, 41.4, 'the saved viewport must not be mutated');
    }
});

test('popup and arrow stay bounded above or below the actual pin on narrow and short screens', () => {
    for (const width of [320, 390, 430]) for (const height of [568, 667, 844]) {
        for (const x of [0, width / 2, width]) for (const y of [-20, 180, height - 124, height + 20]) {
            for (const contentHeight of [70, 220, 650, 900]) {
                const layout = mapBubbleLayout({ x, y }, height, width, 108, 112, contentHeight);
                const visibleHeight = Math.min(contentHeight, layout.maxHeight);
                assert(layout.top >= 108);
                assert(layout.top + layout.maxHeight <= height - 112);
                assert(layout.top + visibleHeight <= height - 112);
                assert(layout.triangleLeft >= 26 && layout.triangleLeft <= width - 44);
                assert.equal(layout.triangleTop, layout.placement === 'above' ? layout.top + visibleHeight : layout.top - 9);
            }
        }
    }
    assert.equal(mapBubbleLayout({ x: 195, y: 170 }, 844, 390, 108, 112, 300).placement, 'below');
    const above = mapBubbleLayout({ x: 195, y: 720 }, 844, 390, 108, 112, 300);
    assert.equal(above.placement, 'above');
    assert.equal(above.top + 300, 720 - 64 - 12);
    assert.equal(above.triangleLeft + 9, 195, 'the arrow follows the pin, not the viewport center');
});

test('popup tip stays only 3px above the selected marker frame at every supported zoom', () => {
    for (const zoom of [3, 11, 14, 15, 18]) {
        for (const discovered of [true, false]) {
            const markerHeight = discovered ? Math.max(44, mapMarkerSize(zoom, true)) : mapMarkerSize(zoom, true);
            const layout = mapBubbleLayout({ x: 195, y: 720 }, 844, 390, 108, 112, 220, markerHeight);
            assert.equal(720 - markerHeight - (layout.triangleTop + 9), 3);
        }
    }
});

function selectionHarness() {
    const state = {
        selectedBar: null, selectedDiscoveredBar: null, selectedLocation: null, isReporting: false,
        preSelectionRegionRef: { current: null }, lastRegionRef: { current: { latitude: 41.4, longitude: 2.1, latitudeDelta: 0.1, longitudeDelta: 0.06 } },
        preSelectionCameraRef: { current: null }, selectionCameraRequestRef: { current: 0 },
        anchorRequestRef: { current: 0 }, lastMarkerPressRef: { current: 0 }, searchRequestRef: { current: 0 },
        searchTimerRef: { current: null }, routeRequestId: { current: 0 },
        positionedVenueRef: { current: null }, selectedVenueId: 'registered:test',
        mapInteractedRef: { current: false }, pendingInitialRegionRef: { current: null },
        searchInputRef: { current: null }, Keyboard: { dismiss() {} },
        centerLocation: null, searchRadiusKm: 5, useCallback: callback => callback, clearTimeout,
        cameras: [], points: [], alerts: [], console,
        setGeoSuggestions() {}, setRouteInfo() {}, setRouteCoords() {}, setShowBarProfile() {}, setBubbleReady() {}, setShowFiltersPanel() {}, setSearchFocused() {},
    };
    Object.assign(state, {
        setSelectedBar: bar => { state.selectedBar = bar; },
        setSelectedDiscoveredBar: bar => { state.selectedDiscoveredBar = bar; },
        setBarCardAnchorX: x => { state.points.push(['x', x]); },
        setBarCardAnchorY: y => { state.points.push(['y', y]); },
        showAlert: value => { state.alerts.push(value); },
        mapRefNative: { current: { animateToRegion: region => { state.cameras.push(region); }, animateCamera: camera => { state.cameras.push(camera); } } },
    });
    vm.createContext(state);
    vm.runInContext(ts.transpileModule([
        implementation('restoreMapViewport', true),
        ...['handleMapGesture', 'beginBarSelection', 'handleSelectBar', 'navigateToReportBar', 'closeBarBubble', 'updateBarCardAnchor', 'centerMapToGPS'].map(name => `globalThis.${name} = ${implementation(name)};`),
    ].join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, state);
    return state;
}

function cameraHarness() {
    const state = selectionHarness();
    const effects = [];
    function find(node) {
        if (ts.isCallExpression(node) && node.expression.getText(parsed) === 'useEffect' &&
            node.arguments[0]?.getText(parsed).includes('const positionVenue = async')) effects.push(node.arguments[0].getText(parsed));
        ts.forEachChild(node, find);
    }
    find(parsed);
    assert.equal(effects.length, 1);
    const camera = { center: { latitude: 41.4, longitude: 2.1 }, heading: 37, pitch: 42, zoom: 16, altitude: 240 };
    const center = { latitude: 41.405, longitude: 2.11 };
    Object.assign(state, {
        selectedLocation: { latitude: 41.41, longitude: 2.11 }, isDesktop: false, height: 844, selectedPinY: 732,
        timers: [], setTimeout: callback => { state.timers.push(callback); return state.timers.length; },
        clearTimeout() {},
    });
    Object.assign(state.mapRefNative.current, {
        getCamera: async () => camera,
        pointForCoordinate: async () => ({ x: 120, y: 250 }),
        coordinateForPoint: async point => { state.centerPoint = point; return center; },
    });
    vm.runInContext(ts.transpileModule(`globalThis.positionEffect = ${effects[0]};`, {
        compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText, state);
    return { state, camera, center };
}

test('native selection uses the real projection and preserves heading, pitch, zoom and altitude; closing restores the camera', async () => {
    const { state, camera, center } = cameraHarness();
    state.preSelectionRegionRef.current = { ...state.lastRegionRef.current };
    state.positionEffect();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(state.cameras.length, 1);
    assert.deepEqual({ ...state.cameras[0] }, { ...camera, center });
    assert.deepEqual({ ...state.centerPoint }, { x: 120, y: -60 }, 'move the bar to y=732 without assuming a north-up linear projection');
    assert.equal(state.preSelectionCameraRef.current, camera);
    state.restoreMapViewport();
    assert.equal(state.cameras[1], camera);
    assert.equal(state.preSelectionCameraRef.current, null);
});

test('late native camera lookups cannot move the map or overwrite the saved camera after dismissal', async () => {
    const { state, camera } = cameraHarness();
    let release;
    state.mapRefNative.current.getCamera = () => new Promise(resolve => { release = resolve; });
    const cleanup = state.positionEffect();
    cleanup();
    release(camera);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(state.cameras.length, 0);
    assert.equal(state.preSelectionCameraRef.current, null);
    assert.equal(state.timers.length, 0);
});

test('a manual map gesture cancels pending automatic moves and prevents closing a card from undoing exploration', () => {
    const state = selectionHarness();
    state.handleSelectBar({ id: 'venue', latitude: 41.41, longitude: 2.11 });
    state.preSelectionCameraRef.current = { center: { latitude: 41.4, longitude: 2.1 }, heading: 37 };
    state.pendingInitialRegionRef.current = { ...state.lastRegionRef.current };
    const request = state.selectionCameraRequestRef.current;
    state.handleMapGesture();
    state.lastRegionRef.current = { latitude: 42, longitude: 3, latitudeDelta: 0.003, longitudeDelta: 0.002 };
    state.closeBarBubble();
    assert.equal(state.mapInteractedRef.current, true);
    assert.equal(state.pendingInitialRegionRef.current, null);
    assert(state.selectionCameraRequestRef.current > request);
    assert.equal(state.cameras.length, 0);
    assert.equal(state.lastRegionRef.current.latitude, 42);
});

test('layout changes and late manual gestures do not re-pan an already positioned venue', async () => {
    const { state } = cameraHarness();
    state.positionEffect();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(state.cameras.length, 1);
    state.handleMapGesture();
    state.selectedPinY = 500;
    state.positionEffect();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(state.cameras.length, 1);
});

test('explicit GPS closes search, preserves the camera scale and ignores late fixes after another gesture', async () => {
    for (const gesture of [true, false]) {
        const state = selectionHarness();
        let release, blurred = 0;
        Object.assign(state, {
            ownerEntryHandledRef: { current: false }, userLocation: null, Platform: { OS: 'ios' }, searchFocused: true,
            setSearchFocused: value => { state.searchFocused = value; }, setSearchQuery() {},
            setCenterLocation: value => { state.centerLocation = value; },
            setUserLocation: value => { state.userLocation = value; },
            Location: {
                requestForegroundPermissionsAsync: async () => ({ status: 'granted' }),
                getCurrentPositionAsync: () => new Promise(resolve => { release = resolve; }),
            },
        });
        state.searchInputRef.current = { blur() { blurred++; } };
        const pending = state.centerMapToGPS();
        await new Promise(resolve => setImmediate(resolve));
        if (gesture) state.handleMapGesture();
        release({ coords: { latitude: 41.5, longitude: 2.2 } });
        await pending;
        assert.equal(state.searchFocused, false);
        assert.equal(blurred, 1);
        assert.equal(state.cameras.length, gesture ? 0 : 1);
        if (!gesture) assert.deepEqual(JSON.parse(JSON.stringify(state.cameras[0])), { center: { latitude: 41.5, longitude: 2.2 }, heading: 0, pitch: 0 });
        else assert.equal(state.userLocation, null);
    }
});

test('no compass or permanent tutorial replay control remains in the map or account settings', () => {
    assert(!source.includes('map-reset-north'));
    assert(!source.includes('Obrir la guia del mapa'));
    for (const file of ['Profile/SettingsModal.tsx', 'BarDashboard/BarDashboardScreen.tsx']) {
        const settings = fs.readFileSync(require.resolve(`../app/src/screens/${file}`), 'utf8');
        assert(!settings.includes('Tornar a veure la guia'));
    }
});

function mapTutorialHarness() {
    const state = selectionHarness();
    Object.assign(state, {
        tutorialSnapshot: { current: null }, tutorialBarRef: { current: null }, tutorialDiscoveryRequest: { current: 0 },
        userLocation: { coords: { latitude: 41.5, longitude: 2.2 } }, centerLocation: { latitude: 40.4, longitude: -3.7 },
        bars: [
            { id: 'madrid', latitude: 40.4, longitude: -3.7 },
            { id: 'barcelona', latitude: 41.5, longitude: 2.201, tier: 'premium' },
        ],
        activeFilters: new Set(['open_now']), selectedMatch: { id: 'match' }, scannedBars: [], searchQuery: 'Original',
        MAP_REGION_DELTA: 0.008, CAMP_NOU_FALLBACK: { latitude: 41.38, longitude: 2.12 },
        tutorialDiscovery: 'idle', tutorialDiscoveredBar: null,
        setActiveFilters: value => { state.activeFilters = value; }, setSelectedMatch: value => { state.selectedMatch = value; },
        setSearchQuery: value => { state.searchQuery = value; }, setCenterLocation: value => { state.centerLocation = value; },
        setVisibleBounds: value => { state.visibleBounds = value; },
        setTutorialDiscovery: value => { state.tutorialDiscovery = value; },
        setTutorialDiscoveredBar: value => { state.tutorialDiscoveredBar = value; },
        setScannedBars: update => { state.scannedBars = typeof update === 'function' ? update(state.scannedBars) : update; },
        discoverMapBars: async () => ({ bars: [{ id: 'found', lat: 41.501, lon: 2.201, name: 'Local' }] }),
        isSameVenue: (item, bar) => item.id === bar.id,
        mergeDiscoveredBars: (before, next) => [...before, ...next],
        setBarCardAnchorX() {}, setBarCardAnchorY() {},
    });
    state.mapRefNative.current.getCamera = async () => ({ center: { latitude: 40.4, longitude: -3.7 }, heading: 37, zoom: 15 });
    vm.runInContext(ts.transpileModule([
        `const deg2rad = ${implementation('deg2rad')};`,
        `const getDistanceFromLatLonInKm = ${implementation('getDistanceFromLatLonInKm')};`,
        implementation('nearestTutorialBar', true).replace('export ', ''),
        `globalThis.nearestTutorialBar = nearestTutorialBar;`,
        `globalThis.prepareMapTutorial = ${implementation('prepareMapTutorial')};`,
    ].join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, state);
    return state;
}

test('the tutorial selects the closest real saved venue from GPS, independent of filters or viewport, and locks it across steps', async () => {
    const state = mapTutorialHarness();
    state.prepareMapTutorial('map-search');
    assert.equal(state.tutorialBarRef.current.id, 'barcelona', 'use GPS, not the current Madrid viewport');
    assert.equal(state.activeFilters.size, 0);
    state.prepareMapTutorial('map-bar');
    assert.equal(state.selectedBar.id, 'barcelona');
    assert.equal(state.cameras.at(-1).latitude, 41.5);
    state.userLocation.coords = { latitude: 40.4, longitude: -3.7 };
    state.prepareMapTutorial('map-directions');
    assert.equal(state.selectedBar.id, 'barcelona', 'camera changes must not change the demonstration bar');
    assert.equal(state.tutorialSnapshot.current.query, 'Original');
    assert.equal(state.tutorialSnapshot.current.filters.has('open_now'), true);
    const fallback = mapTutorialHarness();
    fallback.userLocation = null;
    fallback.prepareMapTutorial('map-bar');
    assert.equal(fallback.selectedBar.id, 'madrid', 'without location use the original map center');
    assert.equal(state.nearestTutorialBar([
        { id: 'invalid', latitude: NaN, longitude: 0 },
        { id: 'demo', latitude: 0, longitude: 0, isTestData: true },
        { id: 'real', latitude: 0, longitude: 0.01 },
    ], { latitude: 0, longitude: 0 }).id, 'real');
    assert.equal(state.nearestTutorialBar([], { latitude: 0, longitude: 0 }), null);
});

test('discovery demonstrates a real unregistered card and discards late results after skipping', async () => {
    const state = mapTutorialHarness();
    state.prepareMapTutorial('map-discovery');
    assert.equal(state.tutorialDiscovery, 'loading');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(state.tutorialDiscovery, 'ready');
    assert.equal(state.tutorialDiscoveredBar.id, 'found');
    state.prepareMapTutorial('map-report');
    assert.equal(state.selectedDiscoveredBar.id, 'found');
    assert.equal(state.selectedBar, null);
    const late = mapTutorialHarness();
    let release;
    late.discoverMapBars = () => new Promise(resolve => { release = resolve; });
    late.prepareMapTutorial('map-discovery');
    late.tutorialDiscoveryRequest.current++;
    release({ bars: [{ id: 'late' }] });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(late.scannedBars.length, 0);
    assert.equal(late.tutorialDiscoveredBar, null);
});

test('relative range changes preserve rotation and pitch on native and web cameras without mutating the snapshot', () => {
    const region = { latitude: 41.4, longitude: 2.1, latitudeDelta: 0.1, longitudeDelta: 0.06 };
    for (const native of [true, false]) {
        const camera = { center: { latitude: 41.4, longitude: 2.1 }, heading: 37, pitch: 42,
            ...(native ? { altitude: 240 } : { zoom: 16 }) };
        const closer = { ...region, latitude: 41.5, longitudeDelta: 0.03, latitudeDelta: 0.05 };
        const moved = cameraForRegion(camera, region, closer);
        assert.equal(moved.heading, 37);
        assert.equal(moved.pitch, 42);
        assert.equal(moved.center.latitude, 41.5);
        assert.equal(native ? moved.altitude : moved.zoom, native ? 120 : 17);
        assert.equal(native ? camera.altitude : camera.zoom, native ? 240 : 16);
        const back = cameraForRegion(moved, closer, region);
        assert.equal(native ? back.altitude : back.zoom, native ? 240 : 16);
    }
    for (const invalid of [{ ...region, latitude: NaN }, { ...region, longitudeDelta: 0 }, { ...region, latitude: 91 }]) {
        assert.equal(isValidMapRegion(invalid), false);
        assert.throws(() => cameraForRegion({}, region, invalid), /Invalid map region/);
    }
});

test('closing either kind restores the exact original viewport, including after switching between venues', () => {
    for (const discoveredFirst of [true, false]) {
        const state = selectionHarness();
        const original = { ...state.lastRegionRef.current };
        const registered = { id: 'registered', latitude: 41.41, longitude: 2.11 };
        const discovered = { id: 'discovered', lat: 41.42, lon: 2.12 };
        const first = () => discoveredFirst ? state.navigateToReportBar(discovered) : state.handleSelectBar(registered);
        const second = () => discoveredFirst ? state.handleSelectBar(registered) : state.navigateToReportBar(discovered);
        first();
        const request = state.anchorRequestRef.current;
        first();
        assert.equal(state.anchorRequestRef.current, request, 'tapping the selected pin must not erase its anchor');
        state.lastRegionRef.current = selectionRegion(original, registered, 720, 844);
        second();
        assert.deepEqual({ ...state.preSelectionRegionRef.current }, original);
        state.closeBarBubble();
        assert.deepEqual({ ...state.cameras[0] }, original);
        assert.deepEqual({ ...state.lastRegionRef.current }, original, 'a quick subsequent selection must not save the closed venue viewport while the restore animation is still running');
        assert.equal(state.selectedBar, null);
        assert.equal(state.selectedDiscoveredBar, null);
        assert.equal(state.preSelectionRegionRef.current, null);
        state.closeBarBubble();
        assert.equal(state.cameras.length, 1, 'closing twice cannot replay a stale camera');
    }
});

test('report submission blocks outside dismissal and switching pins until the request finishes', () => {
    const state = selectionHarness();
    state.navigateToReportBar({ id: 'pending', lat: 41, lon: 2 });
    state.isReporting = true;
    state.closeBarBubble();
    state.handleSelectBar({ id: 'other', latitude: 41, longitude: 2 });
    state.navigateToReportBar({ id: 'other', lat: 41, lon: 2 });
    assert.equal(state.selectedDiscoveredBar.id, 'pending');
    assert.equal(state.selectedBar, null);
    assert.equal(state.cameras.length, 0);
    state.isReporting = false;
    state.closeBarBubble();
    assert.equal(state.cameras.length, 1);
});

test('late coordinate projections cannot reopen or move a closed/new popup; actual failures are surfaced', async () => {
    const state = selectionHarness();
    let resolve;
    state.selectedLocation = { latitude: 41.4, longitude: 2.1 };
    state.mapRefNative.current.pointForCoordinate = () => new Promise(done => { resolve = done; });
    const pending = state.updateBarCardAnchor();
    state.restoreMapViewport();
    resolve({ x: 200, y: 700 });
    await pending;
    assert.equal(state.points.length, 0);
    state.mapRefNative.current.pointForCoordinate = async () => ({ x: 150, y: 600 });
    await state.updateBarCardAnchor();
    assert.deepEqual(state.points, [['y', 600], ['x', 150]]);
    state.console = { info() {} };
    state.mapRefNative.current.pointForCoordinate = async () => ({ x: NaN, y: 600 });
    await state.updateBarCardAnchor();
    assert.equal(state.alerts.length, 1);
    assert.equal(state.alerts[0].tone, 'error');
});
