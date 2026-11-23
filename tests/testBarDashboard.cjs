const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

const root = '../app/src/';
function parse(file) {
    const source = fs.readFileSync(require.resolve(root + file), 'utf8');
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    assert.equal(ast.parseDiagnostics.length, 0, `${file} must parse`);
    return ast;
}
function find(ast, predicate) {
    let result;
    const visit = node => { if (predicate(node)) result = node; ts.forEachChild(node, visit); };
    visit(ast);
    assert(result, 'Expected source element was not found');
    return result;
}
function initializer(ast, name) {
    return find(ast, node => ts.isVariableDeclaration(node) && node.name.getText(ast) === name).initializer.getText(ast);
}
function evaluate(source, globals = {}, dependencies = {}) {
    const module = { exports: {} };
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
        module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true,
    } }).outputText, { exports: module.exports, ...globals,
        require(name) { assert(name in dependencies, `Unexpected dependency ${name}`); return dependencies[name]; },
    });
    return module.exports;
}
const dashboard = parse('screens/BarDashboard/BarDashboardScreen.tsx');
const native = {
    Platform: { OS: 'web', select: options => options.web || options.default || {} },
    StyleSheet: { create: value => value, hairlineWidth: 1, absoluteFill: {} },
};
const baseTheme = evaluate(`export const EDITORIAL = ${initializer(parse('theme/editorialTheme.ts'), 'EDITORIAL')}`, {
    brandColors: require('../app/src/theme/brandColors.json'),
});
const themed = evaluate(fs.readFileSync(require.resolve(root + 'screens/BarDashboard/BarDashboardScreen.styles.ts'), 'utf8'), {}, {
    '../../theme/editorialTheme': baseTheme, 'react-native': native,
    '../../theme/sketchTheme': { SKETCH_THEME: { colors: { primary: '#a50044' } }, sketchShadow: () => ({}) },
});

function nodes(tree, predicate) {
    const found = [];
    const visit = child => {
        if (!React.isValidElement(child)) return;
        if (predicate(child)) found.push(child);
        React.Children.forEach(child.props.children, visit);
    };
    visit(tree);
    return found;
}

function editorGlobals(overrides = {}) {
    const globals = {
        React, ScrollView: 'ScrollView', Text: 'Text', TouchableOpacity: 'TouchableOpacity', View: 'View',
        Image: 'Image', TextInput: 'TextInput', Switch: 'Switch', AppIcon: 'AppIcon',
        styles: themed.default, EDITORIAL: themed.DASHBOARD_THEME, webScreenScroll: {},
        bar: { showGoogleRating: true, gallery: ['https://example.test/cover.jpg'], tier: 'premium' },
        description: 'El nostre local', promotionalText: 'La promoció', showGoogleRating: true,
        configuredSocials: 1, socials: { instagram: 'elnostrebar' }, selectedAmenities: new Set(['wifi']),
        broadcastingIds: new Set(['match']), upcomingMatches: [], matchGenderFilter: null,
        reservationLink: '', fullMatchIds: new Set(),
        setReservationLink(value) { globals.reservationLink = value; },
        setFullMatchIds(update) { globals.fullMatchIds = update(globals.fullMatchIds); },
        SOCIAL_NETWORKS: evaluate(`export const value = ${initializer(dashboard, 'SOCIAL_NETWORKS')}`).value,
        AMENITY_OPTIONS: [{ key: 'wifi', label: 'Wi-Fi', icon: 'wifi' }],
        saving: false, hasChanges: true, ActivityIndicator: 'ActivityIndicator',
        editorScrollRef: { current: null }, pendingEditorSection: { current: null },
        setProfileMode(value) { globals.profileMode = value; },
        setDescription(value) { globals.description = value; },
        setPromotionalText(value) { globals.promotionalText = value; },
        setShowGoogleRating(value) { globals.showGoogleRating = value; },
        setSocials(update) { globals.socials = update(globals.socials); },
        setSelectedAmenities(update) { globals.selectedAmenities = update(globals.selectedAmenities); },
        setBroadcastingIds(update) { globals.broadcastingIds = update(globals.broadcastingIds); },
        setMatchGenderFilter(value) { globals.matchGenderFilter = value; },
        ...overrides,
    };
    return globals;
}

test('owner profile exposes all editors inline with exactly one save action at the end', () => {
    const saved = [];
    const component = evaluate(`
        const profileSections = ${initializer(dashboard, 'profileSections')};
        const renderSectionContent = ${initializer(dashboard, 'renderSectionContent')};
        export const renderProfileTab = ${initializer(dashboard, 'renderProfileTab')};
    `, editorGlobals({ handleSaveProfile: () => saved.push('all') }));
    const tree = component.renderProfileTab();
    const sections = nodes(tree, node => node.props.testID?.startsWith('bar-profile-section-'));
    assert.deepEqual(sections.map(node => node.props.testID), [
        'bar-profile-section-description', 'bar-profile-section-promotions', 'bar-profile-section-reservations', 'bar-profile-section-amenities',
        'bar-profile-section-matches', 'bar-profile-section-socials', 'bar-profile-section-googleRating',
    ]);
    assert(sections.every(node => node.type === 'View' && !node.props.onPress));
    assert.equal(nodes(tree, node => node.type === 'TextInput').length, 3 + editorGlobals().SOCIAL_NETWORKS.length);
    assert.equal(nodes(tree, node => node.type === 'Switch').length, 1);
    assert.equal(nodes(tree, node => node.type === 'Image')[0].props.source.uri, 'https://example.test/cover.jpg');
    const buttons = nodes(tree, node => node.props.testID === 'bar-profile-save');
    assert.equal(buttons.length, 1);
    assert.equal(tree.props.children.at(-1), buttons[0]);
    for (const button of buttons) {
        assert.equal(button.props.accessibilityRole, 'button');
        button.props.onPress();
    }
    assert.deepEqual(saved, ['all']);
    assert.equal(nodes(tree, node => node.props.testID?.startsWith('bar-profile-save-')).length, 0);
    assert(!dashboard.getText().includes('openSheet'));
    assert(!dashboard.getText().includes('sheetOverlay'));
});

test('merchant overview exposes real match and review data, focused shortcuts and guarded map navigation', () => {
    const calls = [];
    const match = { id: 'match' };
    const globals = editorGlobals({
        nextOwnerMatch: match, MatchCard: 'MatchCard',
        reviewStats: { totalReviews: 12, averageRating: 4.5 },
        openEditor: section => calls.push(section || 'edit'),
        setShowBarProfile: value => calls.push(`preview:${value}`),
        requestLeave: action => { calls.push('guard'); action(); },
        navigation: { popTo: route => calls.push(route) },
    });
    const { renderOverview } = evaluate(`export const renderOverview = ${initializer(dashboard, 'renderOverview')};`, globals);
    const tree = renderOverview();
    assert.equal(tree.props.testID, 'bar-management-overview');
    assert.equal(nodes(tree, node => node.type === 'TextInput').length, 0);
    const card = nodes(tree, node => node.type === 'MatchCard')[0];
    assert.equal(card.props.match, match);
    card.props.onPress();
    nodes(tree, node => node.props.testID === 'bar-management-edit')[0].props.onPress();
    const buttonFor = label => nodes(tree, node => node.type === 'TouchableOpacity'
        && nodes(node, child => child.type === 'Text' && child.props.children === label).length)[0];
    buttonFor('Veure com queda').props.onPress();
    buttonFor('Serveis i ambient').props.onPress();
    nodes(tree, node => node.props.accessibilityLabel === 'Veure el meu bar al mapa')[0].props.onPress();
    assert.deepEqual(calls, ['matches', 'edit', 'preview:true', 'amenities', 'guard', 'Map']);
    const text = nodes(tree, node => node.type === 'Text').map(node => node.props.children).join(' ');
    assert(text.includes('4.5 de 5 · 12 ressenyes de troBar'));
    assert(text.includes('Tens canvis sense desar'));
    assert(text.includes('HAS MARCAT QUE L’EMETS'));
});

test('editor shortcuts scroll to the chosen section and successful save returns to the overview', async () => {
    const scrolls = [];
    const globals = editorGlobals({
        pendingEditorSection: { current: 'matches' },
        editorScrollRef: { current: { scrollTo: value => scrolls.push(value) } },
        handleSaveProfile: async () => true,
    });
    const { renderProfileTab } = evaluate(`
        const profileSections = ${initializer(dashboard, 'profileSections')};
        const renderSectionContent = ${initializer(dashboard, 'renderSectionContent')};
        export const renderProfileTab = ${initializer(dashboard, 'renderProfileTab')};
    `, globals);
    const tree = renderProfileTab();
    nodes(tree, node => node.props.testID === 'bar-profile-section-matches')[0].props.onLayout({ nativeEvent: { layout: { y: 680 } } });
    assert.equal(globals.pendingEditorSection.current, null);
    assert.equal(scrolls.length, 1);
    assert.equal(scrolls[0].y, 668);
    await nodes(tree, node => node.props.testID === 'bar-profile-save')[0].props.onPress();
    assert.equal(globals.profileMode, 'overview');
});

test('dashboard surfaces are grana and text remains readable in profile cards and editors', () => {
    const styles = themed.default;
    assert.equal(styles.container.backgroundColor, baseTheme.EDITORIAL.background);
    for (const key of ['sectionCard', 'sheetContainer', 'input', 'socialInput', 'planCard']) {
        assert.equal(styles[key].backgroundColor, baseTheme.EDITORIAL.matchCard);
    }
    for (const key of ['headerTitle', 'sectionCardTitle', 'sectionCardSubtitle', 'sheetTitle', 'input', 'socialInput']) {
        assert([baseTheme.EDITORIAL.onBackground, baseTheme.EDITORIAL.onBackgroundMuted].includes(styles[key].color));
    }
    assert.equal(styles.headerBtn.width, 44);
    assert.equal(styles.profileHero.backgroundColor, baseTheme.EDITORIAL.matchCard);
    assert.equal(styles.sectionSaveButton.minHeight, 44);
    assert.equal(baseTheme.EDITORIAL.card, '#FFFFFF', 'dashboard palette must not alter other screens');
});

function buttonByAttribute(ast, name, value) {
    return find(ast, node => ts.isJsxElement(node) && node.openingElement.attributes.properties.some(attribute =>
        ts.isJsxAttribute(attribute) && attribute.name.getText(ast) === name &&
        attribute.initializer && ts.isStringLiteral(attribute.initializer) && attribute.initializer.text === value));
}

test('owner map action opens the real shared map, without a placeholder or owner ejection', () => {
    const calls = [];
    const button = find(dashboard, node => ts.isJsxSelfClosingElement(node) && node.tagName.getText(dashboard) === 'OwnerBottomNav');
    const component = evaluate(`export const Button = () => (${button.getText(dashboard)});`, {
        React, OwnerBottomNav: 'OwnerBottomNav', activeTab: 'profile', setActiveTab() {},
        styles: themed.default, SKETCH_THEME: { colors: {} },
        setShowNotifications: value => calls.push(value),
        requestLeave: action => action(),
        navigation: { popTo: route => calls.push(route) },
    });

    test('shared owner tabs preserve labels, selected state, accessible hit targets and bottom insets', () => {
        const Nav = evaluate(fs.readFileSync(require.resolve(root + 'components/OwnerBottomNav.tsx'), 'utf8'), {}, {
            react: React, 'react-native': { ...native, View: 'View', TouchableOpacity: 'TouchableOpacity' },
            'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 34 }) },
            './AppText': 'Text', './AppIcon': 'AppIcon', '../theme/editorialTheme': baseTheme,
        }).default;
        for (const active of ['map', 'profile', 'settings']) {
            const calls = [];
            const tree = Nav({ active, onMap: () => calls.push('map'), onProfile: () => calls.push('profile'), onSettings: () => calls.push('settings') });
            const tabs = nodes(tree, node => node.props.accessibilityRole === 'tab');
            assert.deepEqual(tabs.map(tab => tab.props.accessibilityLabel), ['Mapa', 'Perfil', 'Configuració']);
            assert.equal(tabs.filter(tab => tab.props.accessibilityState.selected).length, 1);
            assert.equal(tree.props.style[1].paddingBottom, 34);
            for (const tab of tabs) {
                assert(tab.props.style.minHeight >= 44);
                tab.props.onPress();
            }
            assert.deepEqual(calls, ['map', 'profile', 'settings']);
        }
    });
    component.Button().props.onMap();
    assert.deepEqual(calls, [false, 'Map']);
    assert(!dashboard.getText().includes('renderMapTab'));
    const map = parse('screens/Map/MapScreen.tsx');
    let redirectsOwner = false;
    const visit = node => {
        if (ts.isCallExpression(node) && node.expression.getText(map) === 'useEffect') {
            const effect = node.arguments[0]?.getText(map) || '';
            if (effect.includes('bar_owner') && effect.includes('navigation.reset')) redirectsOwner = true;
        }
        ts.forEachChild(node, visit);
    };
    visit(map);
    assert.equal(redirectsOwner, false);
    const ownerNav = find(map, node => ts.isJsxSelfClosingElement(node) && node.tagName.getText(map) === 'OwnerBottomNav');
    const ownerCalls = [];
    const owner = evaluate(`export const Nav = () => (${ownerNav.getText(map)});`, {
        React, OwnerBottomNav: 'OwnerBottomNav', centerMapToGPS() {},
        navigation: { navigate: (...args) => ownerCalls.push(args) },
    }).Nav();
    owner.props.onProfile();
    owner.props.onSettings();
    assert.deepEqual(JSON.parse(JSON.stringify(ownerCalls)), [['BarDashboard', { tab: 'profile' }], ['BarDashboard', { tab: 'settings' }]]);
    const profileButton = buttonByAttribute(map, 'accessibilityLabel', 'Obrir el perfil');
    const attribute = profileButton.openingElement.attributes.properties.find(item => item.name?.getText(map) === 'onPress');
    for (const role of ['bar_owner', 'user']) {
        const navigations = [];
        const handler = evaluate(`export const press = ${attribute.initializer.expression.getText(map)};`, {
            user: { role }, navigation: { navigate: target => navigations.push(target) },
        });
        handler.press();
        assert.deepEqual(navigations, [role === 'bar_owner' ? 'BarDashboard' : 'Profile']);
    }
});

test('owner footer reuses standard compact legal links, preserves destinations and uses configured version', () => {
    const footerStyles = evaluate(fs.readFileSync(require.resolve(root + 'screens/Profile/SettingsModal.styles.ts'), 'utf8'), {}, {
        'react-native': native, '../../theme/editorialTheme': baseTheme,
    }).default;
    const routes = [];
    const footer = buttonByAttribute(dashboard, 'testID', 'bar-settings-footer');
    const component = evaluate(`export const Footer = () => (${footer.getText(dashboard)});`, {
        React, View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity',
        profileFooterStyles: footerStyles, Constants: { expoConfig: { version: '2.0.0' } },
        styles: themed.default,
        requestLeave: action => action(),
        navigation: { navigate: route => routes.push(route) },
    });
    const tree = component.Footer();
    const links = nodes(tree, node => node.props.accessibilityRole === 'link');
    assert.equal(links.length, 3);
    for (const link of links) {
        assert.equal(link.props.style.minHeight, 44);
        link.props.onPress();
    }
    assert.deepEqual(routes, ['TermsOfService', 'PrivacyPolicy', 'Contact']);
    assert.equal(footerStyles.footerLinks.flexWrap, 'wrap');
    assert.equal(themed.default.settingsScrollContent.flexGrow, 1);
    assert.equal(themed.default.settingsFooter.marginTop, 16);
    assert(initializer(dashboard, 'renderSettingsTab').includes('styles.settingsScrollContent'));
    assert.deepEqual(tree.props.children[1].props.children, ['troBar ', '2.0.0']);
    assert(!initializer(dashboard, 'renderSettingsTab').includes('IconCredits'));
    assert(!initializer(dashboard, 'renderSettingsTab').includes('Legal i suport'));
});

test('Premium capacity switches affect only the chosen broadcast and deselection clears its full state', () => {
    const globals = editorGlobals({
        broadcastingIds: new Set(['men', 'women']), fullMatchIds: new Set(['women']),
        upcomingMatches: [
            { id: 'men', category: 'masculino', homeTeam: 'Barça', awayTeam: 'Rival', date: '2026-12-01', competition: {} },
            { id: 'women', category: 'femenino', homeTeam: 'Barça', awayTeam: 'Rival', date: '2026-12-02', competition: {} },
        ],
    });
    const render = () => evaluate(`export const render = ${initializer(dashboard, 'renderSectionContent')};`, globals).render('matches');
    let tree = render();
    const switches = nodes(tree, node => node.type === 'Switch');
    assert.equal(switches.length, 2);
    switches[0].props.onValueChange(true);
    assert.deepEqual([...globals.fullMatchIds], ['women', 'men']);
    tree = render();
    nodes(tree, node => node.type === 'TouchableOpacity' && node.props.accessibilityLabel?.includes('masculí'))[0].props.onPress();
    assert.deepEqual([...globals.fullMatchIds], ['women']);
    assert.equal(globals.broadcastingIds.has('men'), false);
    assert.equal(nodes(render(), node => node.type === 'Switch').length, 1);
    globals.matchGenderFilter = 'femenino';
    tree = render();
    nodes(tree, node => node.type === 'TouchableOpacity' && node.props.style === themed.default.selectAllBtn)[0].props.onPress();
    assert.equal(globals.fullMatchIds.size, 0);
    globals.bar = { ...globals.bar, tier: 'free' };
    globals.broadcastingIds = new Set(['men', 'women']);
    globals.matchGenderFilter = null;
    assert.equal(nodes(render(), node => node.type === 'Switch').length, 0);
});

test('match colors match standard gender tokens and filtered select-all never changes other matches', () => {
    const globals = editorGlobals({
        broadcastingIds: new Set(['other']),
        upcomingMatches: [
            { id: 'men', category: 'masculino', homeTeam: 'Barça', awayTeam: 'Rival', date: '2026-12-01', competition: {} },
            { id: 'women', category: 'femenino', homeTeam: 'Barça', awayTeam: 'Rival', date: '2026-12-02', competition: {} },
            { id: 'queen', homeTeam: 'Barça', awayTeam: 'Rival', date: '2026-12-03', competition: { name: 'Copa de la Reina' } },
        ],
    });

    const render = () => evaluate(`export const render = ${initializer(dashboard, 'renderSectionContent')};`, globals, {
        '../../../../assets/app/img/competicions/copa-reina.png': 'queen-crest',
    }).render('matches');
    let tree = render();
    const filters = tree.props.children[0].props.children;
    assert.deepEqual(Array.from(filters, node => node.props.children.props.children), ['Masculí', 'Femení']);
    assert.equal(filters[0].props.style[1].backgroundColor, baseTheme.EDITORIAL.masculine);
    assert.equal(filters[1].props.style[1].backgroundColor, baseTheme.EDITORIAL.feminine);
    const rows = nodes(tree, node => node.type === 'TouchableOpacity' && node.props.accessibilityLabel?.includes(' vs '));
    assert.deepEqual(rows.map(node => node.props.style[1].backgroundColor), [
        baseTheme.EDITORIAL.masculine, baseTheme.EDITORIAL.feminine, baseTheme.EDITORIAL.feminine,
    ]);
    assert(!/[♂♀]/u.test(initializer(dashboard, 'renderSectionContent')));
    filters[1].props.onPress();
    tree = render();
    assert.equal(nodes(tree, node => node.type === 'TouchableOpacity' && node.props.accessibilityLabel?.includes(' vs ')).length, 2);
    tree.props.children[1].props.onPress();
    assert.deepEqual([...globals.broadcastingIds], ['other', 'women', 'queen']);
    render().props.children[1].props.onPress();
    assert.deepEqual([...globals.broadcastingIds], ['other']);
    render().props.children[0].props.children[1].props.onPress();
    assert.equal(globals.matchGenderFilter, null);
    assert.equal(nodes(render(), node => node.props.accessibilityLabel?.includes(' vs ')).length, 3);
    filters[0].props.onPress();
    render().props.children[1].props.onPress();
    assert.deepEqual([...globals.broadcastingIds], ['other', 'men']);
});
