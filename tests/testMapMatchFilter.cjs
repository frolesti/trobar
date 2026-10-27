const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

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
    const state = { nextMatch: null, selectedMatch: selected, upcomingMatches: [], defaultCategory: preference, matchIdFromNav: navId, Date, console,
        fetchAllMatches: async () => ({ matches: [men, women] }),
        setNextMatch: value => { state.nextMatch = value; }, setSelectedMatch: value => { state.selectedMatch = value; }, setUpcomingMatches: value => { state.upcomingMatches = value; },
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

test('map swipes cannot open login or trigger the stack back gesture', () => {
    const map = fs.readFileSync(require.resolve('../app/src/screens/Map/MapScreen.tsx'), 'utf8');
    const navigator = fs.readFileSync(require.resolve('../app/src/navigation/AppNavigator.tsx'), 'utf8');
    assert.doesNotMatch(map, /edgeSwipeResponder|PanResponder/);
    assert.match(navigator, /name="Map"[^\n]*gestureEnabled: false/);
    const login = fs.readFileSync(require.resolve('../app/src/screens/LoginModal/LoginModal.tsx'), 'utf8');
    assert.match(login, /isFocused && user && !isLoading && !authInProgress/);
    assert.doesNotMatch(map, /marginTop: -28/);
});