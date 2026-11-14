const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(require.resolve('../app/src/screens/Map/MapScreen.tsx'), 'utf8');
const parsed = ts.createSourceFile('MapScreen.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function find(predicate) {
    let result;
    function visit(node) {
        if (predicate(node)) result = node;
        ts.forEachChild(node, visit);
    }
    visit(parsed);
    assert(result, 'required implementation must exist');
    return result;
}
const fetchRoute = find(node => ts.isVariableDeclaration(node) && node.name.getText(parsed) === 'fetchRoute').initializer.getText(parsed);
const reset = find(node => ts.isCallExpression(node) && node.expression.getText(parsed) === 'useEffect'
    && node.arguments[1]?.getText(parsed) === '[selectedMatch?.id]').arguments[0].getText(parsed);

test('filter changes immediately remove the route and ignore its late network response', async () => {
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    const state = {
        routeRequestId: { current: 0 }, centerLocation: { latitude: 41, longitude: 2 },
        userLocation: null, ownerBar: null, route: ['old-route'], info: 'old-distance', bar: 'old-bar', profile: true,
        process: { env: { EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: 'test-key' } },
        executeRequest: async callback => callback(),
        fetchWithTimeout: async () => ({ json: () => pending }),
        decodePolyline: () => [[2, 41], [2.01, 41.01]],
    };
    Object.assign(state, {
        setRouteInfo: value => { state.info = value; }, setRouteCoords: value => { state.route = value; },
        setSelectedBar: value => { state.bar = value; }, setShowBarProfile: value => { state.profile = value; },
        setSelectedDiscoveredBar() {}, restoreMapViewport() {},
    });
    vm.createContext(state);
    vm.runInContext(ts.transpileModule(`globalThis.fetchRoute = ${fetchRoute}; globalThis.resetFilter = ${reset}`, {
        compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText, state);
    const request = state.fetchRoute({ id: 'selected', latitude: 41.01, longitude: 2.01 });
    state.resetFilter();
    assert.equal(state.route, null);
    assert.equal(state.info, null);
    assert.equal(state.bar, null);
    assert.equal(state.profile, false);
    release({ routes: [{ duration: '300s', distanceMeters: 400, polyline: { encodedPolyline: 'test' } }] });
    await request;
    assert.equal(state.route, null, 'the superseded request cannot redraw the route');
    assert.equal(state.info, null);
    await state.fetchRoute({ id: 'selected', latitude: 41.01, longitude: 2.01 });
    assert.equal(state.route.length, 2, 'deliberately selecting a new bar may draw its route');
});

test('native cards stay above the footer; premium summaries are static and measured in full', () => {
    const module = { exports: {} };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../app/src/utils/mapSelection.ts'), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText, { exports: module.exports });
    const calculate = (height, anchor, contentHeight, headerHeight) => {
        const layout = module.exports.mapBubbleLayout({ x: 195, y: anchor }, height, 390, headerHeight + 8, 112, contentHeight);
        return { ...layout, cardTop: layout.top, availableBottom: height - 112 };
    };
    for (const height of [568, 667, 844]) for (const anchor of [180, 400, 600]) for (const contentHeight of [220, 650, 900]) {
        const layout = calculate(height, anchor, contentHeight, 280);
        assert(layout.cardTop >= 288, 'card must not cover the match deck');
        assert(layout.cardTop + layout.maxHeight <= height - 100 - 12);
    }
    for (const height of [568, 667, 844]) for (const anchor of [180, 400, 600]) for (const contentHeight of [220, 280, 320]) {
        const headerHeight = height < 700 ? 108 : 280;
        const layout = calculate(height, height - 124, contentHeight, headerHeight);
        assert(layout.cardTop >= headerHeight + 8);
        assert(layout.cardTop + contentHeight <= layout.availableBottom, 'the entire measured premium card must fit');
    }
    assert.match(source, /isDesktop \|\| \(!selectedBar && !selectedDiscoveredBar\)/);
    const sheet = fs.readFileSync(require.resolve('../app/src/components/PremiumBarSheet.tsx'), 'utf8');
    assert.match(sheet, /testID="static-premium-map-card"/);
    assert(!sheet.includes('ScrollView'), 'the summary is measured without any scroll container');
    assert.match(source, /compactContent=\{renderContentPanel\(true\)\}/);
    assert.match(source, /expandable=\{selectedBar\?\.tier === 'premium'\}/);
    assert(!source.includes('testID="map-bar-bubble"'), 'there must not be a second popup container for non-premium venues');
});

test('desktop premium summaries fit short windows without a scroll container', () => {
    const position = find(node => ts.isJsxAttribute(node) && node.name.getText(parsed) === 'collapsedTop')
        .initializer.expression.whenTrue.getText(parsed);
    const calculate = new Function('desktopCardTop', 'height', 'venueCardHeight', `return ${position};`);
    for (const height of [390, 568, 768]) for (const contentHeight of [297, 321]) for (const anchor of [106, 286]) {
        const top = calculate(anchor, height, contentHeight);
        assert(top >= 8);
        assert(top <= anchor);
        assert(top + contentHeight <= height - 12, 'the complete card stays inside the viewport');
    }
    assert.match(source, /dense=\{height < 700\}/);
});
