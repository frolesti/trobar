const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

test('competition switches reset rendered history and restore the load-previous control', async () => {
    let currentUser = null;
    let focused = true;
    let defaultCategory = 'all';
    let pendingPreferences = null;
    const slots = [];
    let hookIndex = 0;
    let dirty = true;
    let pendingEffects = [];
    const sameDependencies = (previous, current) => previous && current && previous.length === current.length && previous.every((value, index) => Object.is(value, current[index]));
    const hooks = {
        ...React,
        useState: initial => {
            const index = hookIndex++;
            if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
            return [slots[index], value => {
                const next = typeof value === 'function' ? value(slots[index]) : value;
                if (!Object.is(next, slots[index])) { slots[index] = next; dirty = true; }
            }];
        },
        useRef: initial => {
            const index = hookIndex++;
            if (!(index in slots)) slots[index] = { current: initial };
            return slots[index];
        },
        useMemo: (compute, dependencies) => {
            const index = hookIndex++;
            if (!sameDependencies(slots[index]?.dependencies, dependencies)) slots[index] = { dependencies, value: compute() };
            return slots[index].value;
        },
        useEffect: (effect, dependencies) => {
            const index = hookIndex++;
            if (!sameDependencies(slots[index]?.dependencies, dependencies)) {
                pendingEffects.push(() => {
                    slots[index]?.cleanup?.();
                    slots[index] = { dependencies, cleanup: effect() };
                });
            }
        },
    };
    hooks.useCallback = (callback, dependencies) => hooks.useMemo(() => callback, dependencies);
    const fixture = (id, league, date) => ({ id, league, competition: { id: league, name: league === '1' ? 'Primera Division' : 'Champions League' }, date, category: 'masculino', homeTeam: 'Barcelona', awayTeam: 'Opponent' });
    const champions = Array.from({ length: 15 }, (_, index) => fixture(`cl-${index}`, '2', new Date(2025, 0, index + 1)));
    champions.push(fixture('cl-next', '2', new Date('2070-01-01')));
    const league = [fixture('league-old', '1', new Date('2025-02-01')), fixture('league-next', '1', new Date('2070-01-02')), fixture('league-next-month', '1', new Date('2070-02-02'))];
    const female = { ...fixture('female-next', '1', new Date('2070-03-01')), category: 'femenino' };
    const source = fs.readFileSync(require('node:path').join(__dirname, '../app/src/screens/Matches/MatchesScreen.tsx'), 'utf8');
    const moduleStub = { exports: {} };
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText, {
        module: moduleStub, exports: moduleStub.exports, Date, Map, Set, console,
        setTimeout: () => 0, requestAnimationFrame: callback => callback(),
        require: name => {
            if (name === 'react') return hooks;
            if (name === 'react-native') return Object.fromEntries(['View', 'FlatList', 'TouchableOpacity', 'ActivityIndicator', 'RefreshControl', 'ScrollView'].map(key => [key, key]));
            if (name === 'react-native-safe-area-context') return { SafeAreaView: 'SafeAreaView' };
            if (name === '@react-navigation/native') return { useIsFocused: () => focused };
            if (name === 'expo-status-bar') return { StatusBar: 'StatusBar' };
            if (name.includes('AuthContext')) return { useAuth: () => ({ user: currentUser }) };
            if (name.includes('SplashContext')) return { useScreenLoading: () => {} };
            if (name === 'firebase/firestore') return { collection: () => 'competitions', getDocs: async () => ({ forEach: callback => ['1', '2', '3'].forEach(id => callback({ id, data: () => ({ name: id === '1' ? 'Primera Division' : id === '2' ? 'Champions League' : 'Copa del Rey' }) })) }) };
            if (name.includes('matchService')) return { fetchAllMatches: async () => ({ matches: [champions.at(-1), ...league.slice(1), female] }), subscribeToMatchUpdates: () => () => {}, fetchCompetitionMatches: async ids => ids.includes('2') ? champions : ids.includes('3') ? [] : league, fetchPastMatches: async () => [] };
            if (name.includes('barService')) return { fetchBroadcastMatchIds: async () => new Set() };
            if (name.includes('matchBroadcast')) return { nextBroadcastMatchId: () => 'cl-next' };
            if (name.includes('matchHistory')) return { previousMatchPage: (matches, before, count) => matches.filter(match => match.date < before).sort((first, second) => second.date - first.date).slice(0, count).reverse() };
            if (name.includes('editorialTheme')) return { EDITORIAL: { masculine: '#8C003B', feminine: '#AD2857' } };
            if (name.includes('AlertBanner')) return { showAlert: error => { throw new Error(error.message); } };
            if (name.includes('userService')) return { getUserPreferences: async () => pendingPreferences || ({ display: { defaultCategory } }) };
            if (name.includes('webScreenStyles') || name.includes('config/firebase') || name.includes('userService')) return {};
            return { __esModule: true, default: name.endsWith('MatchCard') ? 'MatchCard' : name.endsWith('AppIcon') ? 'AppIcon' : 'Text' };
        },
    });
    const Screen = moduleStub.exports.default;
    const navigation = {};
    let tree;
    const settle = async () => {
        for (let attempt = 0; attempt < 20; attempt++) {
            if (dirty) {
                dirty = false;
                hookIndex = 0;
                tree = Screen({ navigation });
                const effects = pendingEffects;
                pendingEffects = [];
                effects.forEach(effect => effect());
            }
            await new Promise(resolve => setImmediate(resolve));
            if (!dirty && !pendingEffects.length) return;
        }
        throw new Error('Screen did not settle');
    };
    const elements = node => Array.isArray(node) ? node.flatMap(elements) : node?.props ? [node, ...elements(node.props.children)] : [];
    const text = node => Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : typeof node === 'string' ? node : '';
    const pressCompetition = async label => {
        const button = elements(tree).find(node => node.type === 'TouchableOpacity' && text(node) === label);
        assert(button, `Missing filter ${label}`);
        button.props.onPress();
        await settle();
    };
    const list = () => elements(tree).find(node => node.type === 'FlatList');
    const ids = () => Array.from(list().props.data).filter(item => !item.type).map(item => item.id);
    await settle();
    await pressCompetition('Champions League');
    assert.deepEqual(ids(), ['cl-next']);
    await list().props.ListHeaderComponent.props.onPress();
    await settle();
    assert.equal(ids().filter(id => id.startsWith('cl-') && id !== 'cl-next').length, 10);
    await pressCompetition('La Liga');
    assert.deepEqual(ids(), ['league-next', 'league-next-month']);
    const months = Array.from(list().props.data).filter(item => item.type === 'month');
    assert.deepEqual(months.map(item => item.id), ['month-2070-1', 'month-2070-2']);
    assert.match(months[0].label, /gener.*2070/);
    assert.match(months[1].label, /febrer.*2070/);
    const monthHeader = list().props.renderItem({ item: months[0] });
    assert.equal(text(monthHeader), 'Gener del 2070');
    assert.equal(monthHeader.props.style.borderTopWidth, undefined);
    const seasonHeader = list().props.renderItem({ item: { type: 'season', season: '2069/2070' } });
    assert.equal(elements(seasonHeader).some(node => node.props.style?.height === 1), false);
    assert.equal(list().props.ListHeaderComponent.props.accessibilityLabel, 'Carregar 10 partits anteriors');
    await pressCompetition('Champions League');
    assert.deepEqual(ids(), ['cl-next']);
    await pressCompetition('Copa del Rey');
    assert.deepEqual(ids(), []);
    const historyControl = list().props.ListHeaderComponent;
    assert.equal(historyControl.props.style.height, 44);
    assert.equal(historyControl.props.style.flexShrink, 0);
    assert.equal(historyControl.props.style.backgroundColor, undefined);
    assert.equal(historyControl.props.style.borderRadius, undefined);
    assert.equal(list().props.ListHeaderComponentStyle.minHeight, 54);
    assert.equal(elements(historyControl).find(node => node.type === 'AppIcon').props.name, 'chevron-up');
    const empty = list().props.ListEmptyComponent.type();
    assert.equal(text(empty), 'Encara no hi ha partits programats');
    assert.equal(elements(empty).filter(node => node.type === 'AppIcon').length, 0);
    for (const [label, color] of [['Masculí', '#8C003B'], ['Femení', '#AD2857']]) {
        const tab = elements(tree).find(node => node.type === 'TouchableOpacity' && text(node) === label);
        assert.equal(tab.props.style.backgroundColor, color);
        assert.equal(elements(tab).some(node => node.type === 'View'), false);
    }
    const tab = label => elements(tree).find(node => node.type === 'TouchableOpacity' && text(node) === label);
    assert.equal(tab('Tots'), undefined);
    await pressCompetition('Masculí');
    assert.equal(tab('Masculí').props.accessibilityState.selected, true);
    assert.equal(ids().includes('female-next'), false);
    await pressCompetition('Masculí');
    assert.equal(tab('Masculí').props.accessibilityState.selected, false);
    assert.equal(ids().includes('female-next'), true);
    await pressCompetition('Femení');
    assert.deepEqual(ids(), ['female-next']);
    await pressCompetition('Femení');
    assert.equal(tab('Femení').props['aria-pressed'], false);
    assert.equal(ids().includes('cl-next'), true);
    currentUser = { id: 'profile-user' };
    defaultCategory = 'femenino';
    dirty = true;
    await settle();
    assert.equal(tab('Femení').props.accessibilityState.selected, true);
    await pressCompetition('Femení');
    assert.equal(tab('Femení').props.accessibilityState.selected, false);
    assert.equal(defaultCategory, 'femenino');
    focused = false;
    dirty = true;
    await settle();
    defaultCategory = 'all';
    focused = true;
    dirty = true;
    await settle();
    assert.equal(tab('Masculí').props.accessibilityState.selected, false);
    assert.equal(tab('Femení').props.accessibilityState.selected, false);
    assert.equal(ids().includes('female-next'), true);
    let completePreferences;
    pendingPreferences = new Promise(resolve => { completePreferences = resolve; });
    currentUser = { id: 'slow-profile' };
    dirty = true;
    await settle();
    await pressCompetition('Masculí');
    completePreferences({ display: { defaultCategory: 'femenino' } });
    await settle();
    assert.equal(tab('Masculí').props.accessibilityState.selected, true);
    assert.equal(tab('Femení').props.accessibilityState.selected, false);
});