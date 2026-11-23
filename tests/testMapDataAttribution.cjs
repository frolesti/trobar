const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const calls = [];
const logs = [];
const moduleStub = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../app/src/components/MapDataAttribution.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText, {
    exports: moduleStub.exports,
    console: { info: (...args) => logs.push(args) },
    require(name) {
        if (name === 'react') return React;
        if (name === 'react-native') return { View: 'View', TouchableOpacity: 'TouchableOpacity', Linking: {
            openURL: async url => { calls.push(url); if (url.endsWith('broken')) throw Error('Link unavailable'); },
        } };
        if (name.endsWith('AppText')) return { __esModule: true, default: 'Text' };
        if (name.endsWith('editorialTheme')) return { EDITORIAL: { background: '#7a0033', onBackground: '#fff', fontRegular: 'Barlow_400Regular' } };
        throw Error(name);
    },
});
const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : node?.props ? [node, ...nodes(node.props.children)] : [];
const render = props => nodes(moduleStub.exports.default({ venues: [], ...props }));
const links = tree => tree.filter(node => node.props.accessibilityRole === 'link');

test('a merged venue gets a single credit row with one link per real source', async () => {
    const tree = render({ venues: [{ source: 'google', sources: ['openstreetmap', 'google'], attributions: [] }] });
    assert.equal(tree.filter(node => node.props.testID === 'map-data-attribution').length, 1);
    assert.deepEqual(links(tree).map(node => node.props.accessibilityLabel), ['Google Maps', '© OpenStreetMap']);
    for (const link of links(tree)) await link.props.onPress();
    assert(calls.includes('https://www.openstreetmap.org/copyright'));
    assert(calls.includes('https://maps.google.com/'));
});

test('Google-only results do not falsely credit OSM; empty data has no credit row', () => {
    assert.equal(render({}).length, 0);
    assert.deepEqual(links(render({ venues: [{ source: 'google' }] })).map(node => node.props.accessibilityLabel), ['Google Maps']);
    assert.deepEqual(links(render({ venues: [{ source: 'openstreetmap' }] })).map(node => node.props.accessibilityLabel), ['© OpenStreetMap']);
});

test('required credits remain readable links without a popup surface or a touch-blocking container', () => {
    const tree = render({ venues: [{ sources: ['google', 'openstreetmap'] }] });
    const row = tree.find(node => node.props.testID === 'map-data-attribution');
    assert.equal(row.props.pointerEvents, 'box-none');
    assert(row.props.style.every(style => !style?.backgroundColor && !style?.borderRadius));
    for (const link of links(tree)) {
        const label = nodes(link).find(node => node.type === 'Text');
        assert.equal(label.props.style.color, '#fff');
        assert.equal(label.props.style.fontSize, 12);
        assert.equal(label.props.style.fontFamily, 'Barlow_400Regular');
    }
});

test('native Google map attribution is not duplicated, and geocoding/details are credited when displayed', () => {
    assert.equal(render({ venues: [{ source: 'google' }], googleMapAttributed: true }).length, 0);
    assert.equal(links(render({ googleDetails: true }))[0].props.accessibilityLabel, 'Google Maps');
    assert.equal(links(render({ osmGeocoding: true }))[0].props.accessibilityLabel, '© OpenStreetMap');
});

test('provider credits are retained, deduplicated and link failures are logged', async () => {
    const provider = { name: 'Provider', uri: 'https://example.test/broken' };
    const tree = render({ venues: [
        { source: 'google', attributions: [provider] }, { source: 'google', attributions: [provider] },
    ] });
    assert.equal(links(tree).length, 2);
    const link = links(tree).find(node => node.props.accessibilityLabel === 'Provider');
    link.props.onPress();
    await new Promise(resolve => setImmediate(resolve));
    assert(logs.some(args => args[0].includes('Attribution link failed')));
});

test('credits belong to the existing search bar, not a separate map overlay, and dropdowns follow its measured height', () => {
    const source = fs.readFileSync(require.resolve('../app/src/screens/Map/MapScreen.tsx'), 'utf8');
    const ast = ts.createSourceFile('MapScreen.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let searchBar, dropdownTop, creditCount = 0;
    function visit(node) {
        if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'renderSearchBarInput') searchBar = node.initializer.getText(ast);
        if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'mobileDropdownTop') dropdownTop = node.initializer.getText(ast);
        if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === 'MapDataAttribution') creditCount++;
        ts.forEachChild(node, visit);
    }
    visit(ast);
    let measuredHeight;
    const context = {
        React, View: 'View', Text: 'Text', TextInput: 'TextInput', Feather: 'Icon', TouchableOpacity: 'Button',
        MapDataAttribution: moduleStub.exports.default, EDITORIAL: {}, styles: {}, Platform: { OS: 'ios' },
        activeFilters: new Set(), showFiltersPanel: false, searchQuery: '', handleSearchInput() {},
        scannedBars: [{ source: 'google' }], geoSuggestions: [], placeDetails: null, discoveredGoogleDetails: false,
        setSearchBarHeight: height => { measuredHeight = height; },
    };
    const renderSearchBar = vm.runInNewContext(ts.transpileModule(`(${searchBar})`, {
        compilerOptions: { jsx: ts.JsxEmit.React },
    }).outputText, context);
    const bar = renderSearchBar();
    assert.equal(bar.props.testID, 'map-search-bar');
    assert.equal(creditCount, 1, 'no second credit block may remain at the bottom of the map');
    const credit = nodes(bar).find(node => node.type === moduleStub.exports.default);
    assert(credit, 'credits must be contained in the search bar');
    assert.equal(credit.props.style.position, undefined);
    assert.equal(credit.props.venues[0].source, 'google');
    for (const height of [54, 78, 102, 150]) {
        bar.props.onLayout({ nativeEvent: { layout: { height } } });
        assert.equal(measuredHeight, height);
        const top = vm.runInNewContext(dropdownTop, { mobileHeaderTop: 55, searchBarHeight: measuredHeight });
        assert.equal(top - 55 - height, 4, 'wrapped attribution must never sit under the dropdown');
    }
});

test('map cards delegate credits to the search bar; standalone report screens keep their own credits', () => {
    const map = fs.readFileSync(require.resolve('../app/src/screens/Map/MapScreen.tsx'), 'utf8');
    const report = fs.readFileSync(require.resolve('../app/src/screens/ReportBar/ReportBarScreen.tsx'), 'utf8');
    assert.match(map, /<MapDataAttribution/);
    assert.match(map, /attributionInMap onGoogleDetailsChange=\{setDiscoveredGoogleDetails\}/);
    assert(!map.includes('© OpenStreetMap contributors'));
    assert.match(report, /attributionInMap = false/);
    assert.match(report, /!attributionInMap &&/);
    assert.match(report, /onGoogleDetailsChange\?\.\(!!details\)/);
});
