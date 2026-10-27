const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const brand = require('../app/src/theme/brandColors.json');

const theme = {
    background: brand.background, onBackground: '#FFFFFF', onBackgroundMuted: '#F0CDD9',
    borderOnBackground: 'rgba(255,255,255,0.3)', matchday: '#F4D35E',
    fontRegular: 'Barlow', fontSport: 'BarlowCondensed',
    paper: '#F5F7FA', paperAlt: '#EAF0F5', card: '#FFFFFF', granaSoft: '#F0D8E2',
    ink: '#202631', inkMuted: '#606875', hairline: '#DDE0E5',
};
const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : node?.props ? [node, ...nodes(node.props.children)] : [];
const text = node => Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : typeof node === 'string' ? node : '';

function render({ owner = false, editing = false, reviewForm = false, width = 390, height = 844 } = {}) {
    let state = 0;
    const values = {
        0: true,
        1: [{ id: 'review', userId: 'other', userName: 'Anna', rating: 4, comment: 'Bon ambient', createdAt: new Date('2026-10-27') }],
        2: { averageRating: 4, totalReviews: 1 },
        4: reviewForm,
        8: editing,
        9: new Set(['wifi']),
    };
    const calls = [];
    const hooks = {
        ...React, useEffect() {}, useCallback: callback => callback, useRef: value => ({ current: value }),
        useState: initial => [state in values ? values[state++] : (state++, initial), () => {}],
    };
    const native = Object.fromEntries(['View', 'TouchableOpacity', 'Image', 'ScrollView', 'Modal', 'TextInput'].map(name => [name, name]));
    Object.assign(native, {
        Platform: { OS: 'web', select: options => options.web },
        useWindowDimensions: () => ({ height, width }),
        Animated: { View: 'AnimatedView', Value: class {} },
    });
    const amenity = { key: 'wifi', label: 'WiFi', icon: 'wifi', category: 'serveis' };
    const module = { exports: {} };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../app/src/components/BarProfileModal.tsx'), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
    }).outputText, {
        module, exports: module.exports, console,
        require(name) {
            if (name === 'react') return hooks;
            if (name === 'react-native') return native;
            if (name.endsWith('AppText')) return { __esModule: true, default: 'Text' };
            if (name.endsWith('AppIcon')) return { __esModule: true, default: 'AppIcon' };
            if (name.includes('editorialTheme')) return { EDITORIAL: theme };
            if (name.includes('sketchTheme')) return { sketchShadow: () => ({}) };
            if (name.includes('AuthContext')) return { useAuth: () => ({ user: { id: owner ? 'owner' : 'visitor' } }) };
            if (name.includes('placesService')) return { isOpenNow: () => true };
            if (name.includes('amenities')) return { AMENITY_OPTIONS: [amenity], AMENITY_MAP: new Map([['wifi', amenity]]), AMENITY_CATEGORIES: [{ key: 'serveis', label: 'Serveis' }] };
            if (name.endsWith('MatchCard')) return { __esModule: true, default: 'MatchCard' };
            if (name.includes('reviewService') || name.includes('barOwnerService') || name.includes('barService') || name.includes('AlertBanner')) return {};
            throw new Error(`Unexpected dependency: ${name}`);
        },
    });
    const tree = module.exports.default({
        visible: true, bar: {
            id: 'premium', tier: 'premium', ownerId: 'owner', name: 'Bar del barri', address: 'Carrer Major',
            amenities: ['wifi'], gallery: ['owner-photo'], description: 'Un bar de barri', promotionalText: 'Promo',
            socialMedia: { instagram: 'bar-del-barri' }, broadcastingMatches: ['match'],
        },
        placeDetails: {
            photoUrls: ['public-photo'], phoneNumber: '123456789', websiteUri: 'https://example.test',
            currentOpeningHours: { openNow: true, weekdayDescriptions: ['Dilluns: 10-22'] },
        },
        allMatches: [{ id: 'match' }],
        onClose: () => calls.push('close'), onNavigate: () => calls.push('navigate'),
    });
    return { tree, calls };
}

test('expanded premium profile uses grana surfaces, readable content and gold trim', () => {
    for (const options of [{}, { owner: true, editing: true }, { reviewForm: true }]) {
        const { tree } = render(options);
        const all = nodes(tree);
        const panel = all.find(node => node.props.testID === 'premium-bar-panel');
        assert.equal(panel.props.style.backgroundColor, brand.background);
        assert.equal(panel.props.style.borderTopColor, theme.matchday);
        const backgrounds = new Set([
            brand.background, '#FFFFFF', theme.matchday, theme.borderOnBackground,
            'rgba(255,255,255,0.06)', 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.16)', 'rgba(0,0,0,0.5)',
        ]);
        for (const node of all) {
            for (const style of [node.props.style].flat(Infinity).filter(Boolean)) {
                if (style.backgroundColor) assert(backgrounds.has(style.backgroundColor), `unexpected light surface: ${style.backgroundColor}`);
                if (style.color) assert([brand.background, '#FFFFFF', theme.onBackgroundMuted, theme.matchday].includes(style.color), `low-contrast text: ${style.color}`);
                if (style.backgroundColor === '#FFFFFF') {
                    assert.equal(node.type, 'TouchableOpacity', 'only primary buttons may use solid white surfaces');
                    for (const label of nodes(node).filter(child => child.type === 'Text')) {
                        assert.equal(label.props.style.color, brand.background, 'white buttons need dark text');
                    }
                }
            }
        }
        const name = all.find(node => node.type === 'Text' && text(node) === 'Bar del barri');
        assert.equal(name.props.style.color, '#FFFFFF');
        for (const detail of ['Carrer Major', 'Un bar de barri', 'Promo', 'Com arribar-hi']) assert(text(tree).includes(detail));
        assert(all.some(node => node.type === 'MatchCard'));
        const input = all.find(node => node.type === 'TextInput');
        if (input) {
            assert.equal(input.props.style.backgroundColor, brand.background);
            assert.equal(input.props.style.color, '#FFFFFF');
            assert.equal(input.props.placeholderTextColor, theme.onBackgroundMuted);
        }
    }
});

test('text actions have no decorative icons and essential controls still work', () => {
    const { tree, calls } = render({ reviewForm: true });
    const all = nodes(tree);
    const actions = all.filter(node => node.type === 'TouchableOpacity');
    const navigate = actions.find(node => node.props.accessibilityLabel === 'Com arribar a Bar del barri');
    assert(!nodes(navigate.props.children).some(node => node.type === 'AppIcon'));
    assert.equal(nodes(navigate).find(node => node.type === 'Text').props.style.color, brand.background);
    navigate.props.onPress();
    const close = actions.find(node => node.props.accessibilityLabel === 'Tancar les dades del bar');
    assert(nodes(close).some(node => node.type === 'AppIcon' && node.props.name === 'x'));
    close.props.onPress();
    assert.deepEqual(calls, ['navigate', 'close']);
    for (const action of actions.filter(node => ['Seguir', 'Seguint', 'Publicar', 'Cancel·lar', 'Escriure', 'Desar'].includes(text(node)))) {
        assert(!nodes(action.props.children).some(node => node.type === 'AppIcon'), text(action));
    }
    assert.equal(actions.filter(node => node.props.accessibilityRole === 'radio').length, 5);
    const social = actions.find(node => node.props.accessibilityLabel === 'Obrir instagram');
    assert(nodes(social).some(node => node.type === 'AppIcon' && node.props.name === 'instagram'));
    const owner = nodes(render({ owner: true, editing: true }).tree);
    const amenity = owner.find(node => node.props.accessibilityRole === 'checkbox');
    assert.equal(amenity.props.accessibilityState.checked, true);
    assert(!nodes(amenity).some(node => node.type === 'AppIcon'));
});

test('panel and gallery fit the current viewport instead of module-load dimensions', () => {
    for (const [width, height] of [[320, 600], [390, 844], [844, 390]]) {
        const all = nodes(render({ width, height }).tree);
        const panel = all.find(node => node.props.testID === 'premium-bar-panel');
        assert.equal(panel.props.style.height, height * 0.92);
        const photos = all.filter(node => node.type === 'Image' && ['owner-photo', 'public-photo'].includes(node.props.source?.uri));
        assert.equal(photos.length, 2);
        for (const image of photos) {
            assert.equal(image.props.style.width, Math.min(300, width * 0.7));
        }
    }
});
