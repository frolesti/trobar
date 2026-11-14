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
        if (name.endsWith('editorialTheme')) return { EDITORIAL: { background: '#7a0033', onBackground: '#fff' } };
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

test('map cards delegate credits to the shared row; standalone report screens keep their own credits', () => {
    const map = fs.readFileSync(require.resolve('../app/src/screens/Map/MapScreen.tsx'), 'utf8');
    const report = fs.readFileSync(require.resolve('../app/src/screens/ReportBar/ReportBarScreen.tsx'), 'utf8');
    assert.match(map, /<MapDataAttribution/);
    assert.match(map, /attributionInMap onGoogleDetailsChange=\{setDiscoveredGoogleDetails\}/);
    assert(!map.includes('© OpenStreetMap contributors'));
    assert.match(report, /attributionInMap = false/);
    assert.match(report, /!attributionInMap &&/);
    assert.match(report, /onGoogleDetailsChange\?\.\(!!details\)/);
});
