const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

function renderBarCard(tier) {
    const source = fs.readFileSync(require.resolve('../app/src/components/BarCard.tsx'), 'utf8');
    const moduleStub = { exports: {} };
    const calls = [];
    vm.runInNewContext(ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
    }).outputText, {
        exports: moduleStub.exports,
        require: name => {
            if (name === 'react') return React;
            if (name === 'react-native') return Object.fromEntries(['View', 'Text', 'TouchableOpacity', 'Image', 'ScrollView', 'ActivityIndicator'].map(value => [value, value]));
            if (name === '@expo/vector-icons') return { Feather: 'Feather', MaterialCommunityIcons: 'MaterialCommunityIcons' };
            if (name.endsWith('sketchTheme')) return { sketchShadow: () => ({}) };
            if (name.endsWith('editorialTheme')) return { EDITORIAL: { background: '#7a0033', onBackground: '#FFFFFF', onBackgroundMuted: '#F0CDD9', borderOnBackground: 'rgba(255,255,255,0.3)', matchday: '#EDBB00', ink: '#202631', inkMuted: '#66707D', grana: '#a50044', paperAlt: '#EAF0F5', hairline: '#ddd', fontBold: 'Barlow', fontRegular: 'Barlow' } };
            throw new Error(`Unexpected dependency: ${name}`);
        },
    });
    const tree = moduleStub.exports.default({
        name: 'Bar del barri', address: 'Carrer Major, 10', latitude: 41, longitude: 2,
        verified: true, tier, loadingPlaceDetails: false, fallbackIsOpen: true,
        distanceText: '5 min caminant (300 m)', reviewAvgRating: 4.5, reviewCount: 12,
        gallery: ['owner-photo', 'shared-photo'], placeDetails: { photoUrls: ['shared-photo', 'public-photo'] },
        onNavigate: () => calls.push('navigate'), onProfileOpen: () => calls.push('expand'), onClose: () => calls.push('close'),
    });
    const nodes = [];
    const visit = node => {
        if (Array.isArray(node)) return node.forEach(visit);
        if (node == null || typeof node === 'boolean') return;
        nodes.push(node);
        if (React.isValidElement(node)) visit(node.props.children);
    };
    visit(tree);
    return { nodes, calls, text: nodes.filter(node => typeof node === 'string').join(' ') };
}

test('premium map cards retain every normal-card detail and expand only on request', () => {
    for (const tier of ['free', 'premium']) {
        const card = renderBarCard(tier);
        assert.equal(card.nodes[0].props.style.backgroundColor, '#7a0033');
        assert.equal(card.nodes.find(node => node.props?.children === 'Bar del barri').props.style.color, '#FFFFFF');
        for (const detail of ['Bar del barri', 'Carrer Major, 10', '5 min caminant (300 m)', '4.5', 'Obert', 'Com arribar-hi']) assert(card.text.includes(detail));
        assert.deepEqual(card.nodes.filter(node => node.type === 'Image').map(node => node.props.source.uri), ['owner-photo', 'shared-photo', 'public-photo']);
        const expand = card.nodes.find(node => node.props?.accessibilityLabel === 'Veure totes les dades de Bar del barri');
        assert.equal(!!expand, tier === 'premium');
        assert.deepEqual(card.calls, []);
        if (expand) { expand.props.onPress(); assert.deepEqual(card.calls, ['expand']); }
        card.nodes.find(node => node.props?.accessibilityLabel === 'Com arribar a Bar del barri').props.onPress();
        card.nodes.find(node => node.props?.accessibilityLabel === 'Tancar la fitxa de Bar del barri').props.onPress();
        assert.deepEqual(card.calls.slice(-2), ['navigate', 'close']);
        assert(!card.text.includes('Premium · Veure perfil'));
    }
    const map = fs.readFileSync(require.resolve('../app/src/screens/Map/MapScreen.tsx'), 'utf8');
    assert.match(map, /gallery=\{selectedBar\.gallery\}/);
    assert.match(map, /borderColor: selectedBar\.tier === 'premium' \? EDITORIAL\.matchday : EDITORIAL\.borderOnBackground/);
    assert.match(map, /borderBottomColor: selectedBar\.tier === 'premium' \? EDITORIAL\.matchday : EDITORIAL\.borderOnBackground/);
});

test('registered bars retain original pin and crest; only unregistered bars are gray dots', () => {
    const source = fs.readFileSync(require.resolve('../app/src/screens/Map/MapScreen.tsx'), 'utf8');
    const parsed = ts.createSourceFile('MapScreen.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const declarations = parsed.statements.filter(statement => ts.isVariableStatement(statement) && statement.declarationList.declarations.some(item => ['ConfirmedBarMarker', 'ScannedBarMarker'].includes(item.name.getText(parsed))));
    const moduleStub = { exports: {} };
    const badge = () => null;
    vm.runInNewContext(ts.transpileModule(declarations.map(declaration => `export ${declaration.getText(parsed)}`).join('\n'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
    }).outputText, {
        exports: moduleStub.exports, React: { ...React, memo: component => component },
        useState: value => [value, () => {}], Marker: 'Marker', View: 'View', VerifiedBarBadge: badge,
        isVerifiedBar: bar => !!bar.ownerId && bar.tier === 'premium',
        Image: 'Image', MAP_PIN_3D: 'registered-pin', styles: { markerPin3d: { width: 52 }, markerPinSelected3d: { width: 64 } },
    });
    for (const isSelected of [false, true]) for (const zoom of [3, 11, 15, 18]) {
        const marker = moduleStub.exports.ConfirmedBarMarker({ bar: { latitude: 41, longitude: 2 }, isSelected, zoom, onPress() {} });
        assert.equal(marker.props.anchor.y, 1);
        const [pin, crest] = marker.props.children.props.children;
        assert.equal(pin.type, 'Image');
        assert.equal(pin.props.source, 'registered-pin');
        const scale = Math.min(1, Math.max(0.32, Math.pow(2, (zoom - 15) / 4)));
        assert.equal(pin.props.style.at(-1).width, Math.round((isSelected ? 64 : 52) * scale));
        assert.equal(pin.props.style.at(-1).height, pin.props.style.at(-1).width);
        assert.equal(crest.type, badge);
        assert.equal(crest.props.scale, scale);
    }
    assert.match(source, /zoom=\{currentZoom\}/);
    assert.match(source, /key=\{`bar-\$\{bar\.id\}-\$\{Math\.round\(currentZoom \* 2\)\}`\}/);
    const scanned = moduleStub.exports.ScannedBarMarker({ osmBar: { lat: 41, lon: 2 }, onPress() {} });
    assert.equal(scanned.props.anchor.y, 0.5);
    const dot = scanned.props.children.props.children;
    assert.equal(dot.type, 'View');
    assert.equal(dot.props.style.backgroundColor, '#8B8E93');
    assert.equal(dot.props.style.width, 16);
    assert.equal(dot.props.style.height, 16);
});