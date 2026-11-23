const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

function renderBarCard(tier, overrides = {}) {
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
            if (name.endsWith('PremiumProfileSlider')) return { __esModule: true, default: 'PremiumProfileSlider' };
            if (name.endsWith('VenuePhotoGallery')) return { __esModule: true, default: 'VenuePhotoGallery' };
            if (name.endsWith('BarReservationAction')) return { __esModule: true, default: 'BarReservationAction' };
            if (name.endsWith('barReservations')) return {
                reservationUrl: value => value || null,
                isBarFullForMatch: (bar, matchId) => bar.tier === 'premium' && bar.fullMatchIds?.includes(matchId),
            };
            throw new Error(`Unexpected dependency: ${name}`);
        },
    });
    const tree = moduleStub.exports.default({
        name: 'Bar del barri', address: 'Carrer Major, 10', latitude: 41, longitude: 2,
        verified: true, tier, loadingPlaceDetails: false, fallbackIsOpen: true,
        distanceText: '5 min caminant (300 m)', reviewAvgRating: 4.5, reviewCount: 12,
        promotionalText: 'Tapa i beguda durant el partit',
        gallery: ['owner-photo', 'shared-photo'], placeDetails: { photoUrls: ['shared-photo', 'public-photo'] },
        onNavigate: () => calls.push('navigate'), onProfileOpen: () => calls.push('expand'), onClose: () => calls.push('close'),
        onConfirm: () => calls.push('confirm'), onCancel: () => calls.push('cancel'),
        ...overrides,
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

test('premium map card forwards the chosen match and capacity state to its reservation action', () => {
    const card = renderBarCard('premium', { reservationUrl: 'https://bar.example/reservar', fullMatchIds: ['match'], matchId: 'match' });
    const action = card.nodes.find(node => node.type === 'BarReservationAction');
    assert.equal(action.props.matchId, 'match');
    assert.deepEqual(action.props.bar.fullMatchIds, ['match']);
    assert.equal(action.props.bar.reservationUrl, 'https://bar.example/reservar');
    assert.equal(renderBarCard('free').nodes.some(node => node.type === 'BarReservationAction'), false);
});

test('discovered, free and premium profiles share the header and details template with profile-specific actions', () => {
    for (const [tier, verified] of [['free', false], ['free', true], ['premium', true]]) {
        const card = renderBarCard(tier, { verified });
        for (const id of ['venue-card-header', 'venue-card-status', 'venue-card-details']) {
            assert.equal(card.nodes.filter(node => node.props?.testID === id).length, 1);
        }
        assert(card.nodes.filter(node => node.type === 'ScrollView').every(node => node.props.horizontal));
        assert.equal(card.text.includes('PREMIUM'), tier === 'premium' && verified);
        assert.equal(card.text.includes('Es poden veure partits aquí?'), !verified);
        assert.equal(card.text.includes('Com arribar-hi'), verified);
        if (!verified) {
            const primary = card.nodes.find(node => node.type === 'TouchableOpacity' && node.props.onPress && node.props.style.backgroundColor === '#FFFFFF');
            const secondary = card.nodes.find(node => node.type === 'TouchableOpacity' && node.props.style.borderWidth === 1);
            assert(primary && secondary);
            primary.props.onPress();
            secondary.props.onPress();
            assert.deepEqual(card.calls, ['confirm', 'cancel']);
            assert(primary.props.style.minHeight >= 44 && secondary.props.style.minHeight >= 44);
        }
    }
});

test('premium summaries retain essential details without vertical scrolling and expand only on request', () => {
    for (const tier of ['free', 'premium']) {
        const card = renderBarCard(tier);
        assert.equal(card.nodes[0].props.style.backgroundColor, '#7a0033');
        assert.equal(card.nodes.find(node => node.props?.children === 'Bar del barri').props.style.color, '#FFFFFF');
        for (const detail of ['Bar del barri', 'Carrer Major, 10', '5 min caminant (300 m)', '4.5', 'Obert', 'Com arribar-hi']) assert(card.text.includes(detail));
        assert.deepEqual(Array.from(card.nodes.find(node => node.type === 'VenuePhotoGallery').props.photos), ['owner-photo', 'shared-photo', 'public-photo']);
        assert(card.nodes.filter(node => node.type === 'ScrollView').every(node => node.props.horizontal));
        if (tier === 'premium') {
            assert(card.text.includes('Tapa i beguda durant el partit'));
            const summary = card.nodes[0].props.children.filter(React.isValidElement);
            assert.equal(summary[0].type, 'PremiumProfileSlider', 'the opening line belongs at the top');
        }
        const expand = card.nodes.find(node => node.type === 'PremiumProfileSlider');
        assert.equal(!!expand, tier === 'premium');
        assert.deepEqual(card.calls, []);
        if (expand) { expand.props.onOpen(); assert.deepEqual(card.calls, ['expand']); }
        card.nodes.find(node => node.props?.accessibilityLabel === 'Com arribar a Bar del barri').props.onPress();
        card.nodes.find(node => node.props?.accessibilityLabel === 'Tancar la fitxa de Bar del barri').props.onPress();
        assert.deepEqual(card.calls.slice(-2), ['navigate', 'close']);
        assert(!card.text.includes('Veure totes les dades'));
        assert.equal(card.text.includes('PREMIUM'), tier === 'premium');
    }
    const map = fs.readFileSync(require.resolve('../app/src/screens/Map/MapScreen.tsx'), 'utf8');
    assert.match(map, /gallery=\{profileBar\.gallery\}/);
    assert.match(map, /<PremiumBarSheet/);
    const sheet = fs.readFileSync(require.resolve('../app/src/components/PremiumBarSheet.tsx'), 'utf8');
    assert.match(sheet, /borderColor: expandable \? EDITORIAL\.matchday : EDITORIAL\.borderOnBackground/);
    assert.match(map, /profileHandleHidden=\{insidePremiumSheet\}/);
});

test('the full photo and metadata layout is reserved before details and images arrive', () => {
    const single = renderBarCard('free', { gallery: ['photo'], placeDetails: null });
    const gallery = single.nodes.find(node => node.type === 'VenuePhotoGallery');
    const empty = renderBarCard('premium', { gallery: [], placeDetails: null });
    assert.equal(empty.nodes.find(node => node.type === 'VenuePhotoGallery').props.height, gallery.props.height);
    const loading = renderBarCard('premium', { gallery: [], placeDetails: null, loadingPlaceDetails: true });
    assert.equal(loading.nodes.find(node => node.type === 'VenuePhotoGallery').props.height, gallery.props.height);
    for (const card of [single, empty, loading]) {
        assert.equal(card.nodes.find(node => node.props?.testID === 'venue-card-status').props.style.height, 24);
        assert.equal(card.nodes.find(node => node.props?.testID === 'venue-card-details').props.children.props.children[0].props.style.height, 32);
    }
    assert(empty.text.includes('Com arribar-hi'));
});

test('both marker types use decoded 3D pins with bottom anchors', () => {
    const source = fs.readFileSync(require.resolve('../app/src/screens/Map/MapScreen.tsx'), 'utf8');
    const parsed = ts.createSourceFile('MapScreen.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const declarations = parsed.statements.filter(statement => ts.isVariableStatement(statement) && statement.declarationList.declarations.some(item => ['ConfirmedBarMarker', 'ScannedBarMarker'].includes(item.name.getText(parsed))));
    const moduleStub = { exports: {} };
    const badge = () => null;
    const platform = { OS: 'ios' };
    vm.runInNewContext(ts.transpileModule(declarations.map(declaration => `export ${declaration.getText(parsed)}`).join('\n'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
    }).outputText, {
        exports: moduleStub.exports, React: { ...React, memo: component => component },
        useState: value => [value, () => {}], useEffect: () => {}, Marker: 'Marker', View: 'View', Text: 'Text', VerifiedBarBadge: badge,
        EDITORIAL: { grana: '#A50044', matchday: '#EDBB00', onBackground: '#FFF', fontBold: 'Barlow' },
        isVerifiedBar: bar => !!bar.ownerId && bar.tier === 'premium',
        MapImage: 'Image', getMapIcon: key => key === 'registered' ? 'registered-pin' : 'gray-pin', styles: { markerPin3d: { width: 52 }, markerPinSelected3d: { width: 64 } },
        Platform: platform, mapMarkerSize: (zoom, selected) => Math.round((selected ? 64 : 52) * Math.min(1, Math.max(.32, 2 ** ((zoom - 15) / 4)))),
    });
    for (const isSelected of [false, true]) for (const zoom of [3, 11, 15, 18]) {
        const marker = moduleStub.exports.ConfirmedBarMarker({ bar: { latitude: 41, longitude: 2 }, isSelected, zoom, onPress() {} });
        assert.equal(marker.props.anchor.y, 1);
        const pin = marker.props.children.props.children.filter(React.isValidElement)[0].props.children;
        assert.equal(pin.type, 'Image');
        assert.equal(pin.props.source, 'registered-pin');
        const scale = Math.min(1, Math.max(0.32, Math.pow(2, (zoom - 15) / 4)));
        assert.equal(pin.props.style.at(-1).width, Math.round((isSelected ? 64 : 52) * scale));
        assert.equal(pin.props.style.at(-1).height, pin.props.style.at(-1).width);
        assert.equal(marker.props.centerOffset.y, -pin.props.style.at(-1).height / 2, 'MapKit must anchor the actual bottom, not its default center');
    }
    const premium = moduleStub.exports.ConfirmedBarMarker({ bar: { latitude: 41, longitude: 2, ownerId: 'owner', tier: 'premium' }, isSelected: true, zoom: 15, onPress() {} });
    const premiumPin = premium.props.children.props.children.filter(React.isValidElement)[0].props.children;
    assert.equal(premiumPin.type, badge);
    assert.equal(premiumPin.props.size, 64);
    platform.OS = 'android';
    const google = moduleStub.exports.ConfirmedBarMarker({ bar: { latitude: 41, longitude: 2 }, zoom: 15, onPress() {} });
    assert.equal(google.props.anchor.y, 1);
    assert.equal(google.props.centerOffset, undefined, 'Google Maps already respects anchor and must not be offset twice');
    platform.OS = 'ios';
    assert.match(source, /zoom=\{currentZoom\}/);
    const owned = moduleStub.exports.ConfirmedBarMarker({
        bar: { name: 'El local', latitude: 41, longitude: 2 }, isSelected: true, isOwned: true, zoom: 15, onPress() {},
    });
    assert.equal(owned.props.zIndex, 500);
    assert.equal(owned.props.accessibilityLabel, 'El teu bar: El local');
    assert.equal(owned.props.centerOffset.y, -(64 + 26) / 2);
    assert.equal(owned.props.children.props.children[0].props.children.props.children, 'El teu bar');
    assert.match(source, /key=\{`bar-\$\{bar\.id\}-\$\{Math\.round\(currentZoom \* 2\)\}`\}/);
    let presses = 0, stopped = 0;
    const scanned = moduleStub.exports.ScannedBarMarker({ osmBar: { lat: 41, lon: 2, name: 'Zurito' }, onPress() { presses++; } });
    assert.equal(scanned.props.anchor.y, 1);
    assert.equal(scanned.props.centerOffset.y, -52 / 2);
    assert.equal(scanned.props.tracksViewChanges, true, 'the image must load before its native snapshot freezes');
    assert.equal(scanned.props.children.props.style.width, 52);
    assert.equal(scanned.props.children.props.style.height, 52);
    assert.equal(scanned.props.children.props.accessibilityLabel, 'Veure Zurito');
    assert.equal(scanned.props.stopPropagation, true);
    scanned.props.onPress({ stopPropagation() { stopped++; } });
    assert.equal(stopped, 1);
    assert.equal(presses, 1);
    const pin = scanned.props.children.props.children;
    assert.equal(pin.type, 'Image');
    assert.equal(pin.props.source, 'gray-pin');
    assert.equal(pin.props.style.width, 52);
    assert.equal(pin.props.style.height, 52);
});