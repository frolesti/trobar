const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const helpersModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../app/src/utils/mapMatches.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { module: helpersModule, exports: helpersModule.exports });
const helpers = helpersModule.exports;

function load({ preference = 'all', selected = null, navId } = {}) {
    const source = fs.readFileSync(require.resolve('../app/src/screens/Map/MapScreen.tsx'), 'utf8');
    const parsed = ts.createSourceFile('MapScreen.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let toggle, alternative, effect;
    const visit = node => {
        if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === 'toggleMatchCategory') toggle = node.initializer.getText(parsed);
        if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === 'getAlternativeMatch') alternative = node.initializer.getText(parsed);
        if (ts.isCallExpression(node) && node.expression.getText(parsed) === 'useEffect' && node.arguments[0]?.getText(parsed).includes('const catFiltered')) effect = node.arguments[0].getText(parsed);
        ts.forEachChild(node, visit);
    };
    visit(parsed);
    const women = { id: 'women', category: 'femenino', homeTeam: 'Barcelona', awayTeam: 'Chelsea', date: new Date('2070-01-01') };
    const men = { id: 'men', category: 'masculino', homeTeam: 'Barcelona', awayTeam: 'Madrid', date: new Date('2070-01-02') };
    const state = { ...helpers, nextMatch: null, selectedMatch: selected, upcomingMatches: [], defaultCategory: preference, matchIdFromNav: navId, Date, console,
        fetchAllMatches: async () => ({ matches: [men, women] }),
        setNextMatch: value => { state.nextMatch = typeof value === 'function' ? value(state.nextMatch) : value; }, setSelectedMatch: value => { state.selectedMatch = value; }, setUpcomingMatches: value => { state.upcomingMatches = value; },
        showAlert: () => {},
    };
    vm.createContext(state);
    vm.runInContext(ts.transpileModule(`globalThis.getAlternativeMatch = ${alternative}; globalThis.toggle = ${toggle}; globalThis.load = ${effect};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, state);
    return state;
}

test('initial map card honors saved category while all starts with chronological next match', async () => {
    for (const [preference, expected] of [['all', 'women'], ['masculino', 'men'], ['femenino', 'women']]) {
        const state = load({ preference });
        state.load();
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(state.nextMatch.id, expected);
        state.toggle();
        assert.notEqual(state.nextMatch.id, expected);
        assert.equal(state.selectedMatch, null);
        state.toggle();
        assert.equal(state.nextMatch.id, expected);
        assert.equal(state.defaultCategory, preference);
    }
});

test('category detection is consistent for legacy, competition-only and explicit identities', () => {
    for (const match of [
        { category: 'FEMENI' }, { category: 'femenino' }, { competition: { name: 'UWCL' } },
        { competition: { name: 'Liga F' } }, { homeTeam: 'Barcelona Women' }, { league: 'Copa de la Reina' },
    ]) assert(helpers.isWomenMatch(match));
    for (const match of [
        { category: 'MASCULI' }, { category: 'masculino', competition: { name: 'Women' } },
        { league: 123 }, { homeTeam: { name: 'FC Barcelona' } },
    ]) assert(!helpers.isWomenMatch(match));
});

test('match refresh preserves two categories and user choice, including during live matches', async () => {
    const state = load();
    state.load();
    await new Promise(resolve => setImmediate(resolve));
    state.toggle();
    const chosen = state.nextMatch.id;
    for (let i = 0; i < 10; i++) {
        state.load();
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(state.nextMatch.id, chosen);
        assert(state.getAlternativeMatch(state.nextMatch));
    }
    const now = Date.now();
    const fixtures = [
        { id: 'live-women', category: 'FEMENI', date: new Date(now - 3600000), status: 'live' },
        { id: 'men', category: 'MASCULI', date: new Date(now + 3600000) },
        { id: 'finished', date: new Date(now + 7200000), status: 'finished' },
        { id: 'postponed', date: new Date(now + 7200000), status: 'postponed' },
        { id: 'invalid', date: new Date('invalid') },
    ];
    const upcoming = helpers.upcomingMapMatches(fixtures, now);
    assert.deepEqual(Array.from(upcoming, m => m.id), ['live-women', 'men']);
    assert.equal(helpers.alternativeMapMatch(upcoming, upcoming[1]).id, 'live-women');
});
test('switching the displayed match preserves an active match filter', async () => {
    const state = load({ preference: 'masculino', navId: 'men' });
    state.load();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(state.selectedMatch.id, 'men');
    state.toggle();
    assert.equal(state.selectedMatch.id, 'women');
    assert.equal(state.nextMatch.id, 'women');
    state.toggle();
    assert.equal(state.selectedMatch.id, 'men');
});

test('a selected match with no visible confirmed venues keeps its notice until results or scope change', () => {
    const source = fs.readFileSync(require.resolve('../app/src/screens/Map/MapScreen.tsx'), 'utf8');
    const ast = ts.createSourceFile('MapScreen.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let effect;
    function visit(node) {
        if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect'
            && node.arguments[0]?.getText(ast).includes('Cap bar amb aquest partit confirmat')) effect = node.arguments[0].getText(ast);
        ts.forEachChild(node, visit);
    }
    visit(ast);
    assert(effect);
    const timers = new Map();
    const context = {
        selectedMatch: { id: 'chosen' }, initialBarsLoaded: true, mapReady: true, tutorialKind: null, filteredBars: [],
        setMatchNotice: value => { context.notice = value; },
        setTimeout: callback => { timers.set(1, callback); return 1; }, clearTimeout: id => timers.delete(id),
    };
    const apply = vm.runInNewContext(ts.transpileModule(`(${effect})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
    apply();
    assert.match(context.notice, /Cap bar.*partit confirmat a prop/);
    assert.equal(timers.size, 0, 'the empty state must not disappear while the map remains empty');
    context.filteredBars = [{ id: 'real' }];
    const cleanup = apply();
    assert.match(context.notice, /Mostrant els locals/);
    timers.get(1)();
    assert.equal(context.notice, null);
    cleanup();
    for (const change of [{ initialBarsLoaded: false }, { mapReady: false }, { selectedMatch: null }, { tutorialKind: 'basic' }]) {
        const saved = { ...context };
        Object.assign(context, change);
        apply();
        assert.equal(context.notice, null);
        Object.assign(context, saved);
    }
});

test('map swipes cannot open login or trigger the stack back gesture', () => {
    const map = fs.readFileSync(require.resolve('../app/src/screens/Map/MapScreen.tsx'), 'utf8');
    const navigator = fs.readFileSync(require.resolve('../app/src/navigation/AppNavigator.tsx'), 'utf8');
    assert.doesNotMatch(map, /edgeSwipeResponder|PanResponder/);
    assert.match(navigator, /name="Map"[^\n]*gestureEnabled: false/);
    const login = fs.readFileSync(require.resolve('../app/src/screens/LoginModal/LoginModal.tsx'), 'utf8');
    assert.match(login, /isFocused && user && !isLoading && !authInProgress/);
    assert.doesNotMatch(map, /marginTop: -28/);
});