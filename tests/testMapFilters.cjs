const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const compile = code => ts.transpileModule(code, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
}).outputText;
function loadModule(file, dependencies = {}) {
    const module = { exports: {} };
    vm.runInNewContext(compile(fs.readFileSync(require.resolve(file), 'utf8')), {
        module, exports: module.exports,
        require(name) {
            if (name in dependencies) return dependencies[name];
            throw new Error(`Unexpected dependency: ${name}`);
        },
    });
    return module.exports;
}
const { AMENITY_OPTIONS, AMENITY_CATEGORIES } = loadModule('../app/src/data/amenities.ts');
const { matchesBarFilters } = loadModule('../app/src/utils/barFilters.ts', {
    '../services/placesService': { isOpenNow: periods => periods?.[0]?.status },
});

test('all 16 model amenities have exactly one filter and a visible category', () => {
    const source = fs.readFileSync(require.resolve('../app/src/models/Bar.ts'), 'utf8');
    const ast = ts.createSourceFile('Bar.ts', source, ts.ScriptTarget.Latest, true);
    const type = ast.statements.find(node => ts.isTypeAliasDeclaration(node) && node.name.text === 'BarAmenity');
    const modelKeys = type.type.types.map(node => node.literal.text).sort();
    const filterKeys = Array.from(AMENITY_OPTIONS, option => option.key).sort();
    assert.equal(filterKeys.length, 16);
    assert.deepEqual(filterKeys, modelKeys);
    for (const option of AMENITY_OPTIONS) {
        assert(AMENITY_CATEGORIES.some(category => category.key === option.category));
    }
});

test('every amenity requires explicit data for both registered and discovered bars', () => {
    for (const { key } of AMENITY_OPTIONS) {
        for (const base of [{ id: 'registered', latitude: 41, longitude: 2 }, { id: 'discovered', lat: 41, lon: 2 }]) {
            const filters = new Set([key]);
            assert(matchesBarFilters({ ...base, amenities: [key] }, filters), key);
            assert(!matchesBarFilters({ ...base, amenities: [] }, filters), key);
            assert(!matchesBarFilters(base, filters), key);
            assert(matchesBarFilters(base, new Set()));
        }
    }
    assert(!matchesBarFilters({ amenities: ['sports_bar', 'multiple_screens'] }, new Set(['projector'])));
    assert(!matchesBarFilters({ amenities: ['wifi'] }, new Set(['wifi', 'accessible'])));
    assert(matchesBarFilters({ amenities: ['wifi', 'accessible'] }, new Set(['wifi', 'accessible'])));
});

test('open now excludes closed or unknown schedules, including discovered bars', () => {
    const filters = new Set(['open_now']);
    assert(matchesBarFilters({ openingPeriods: [{ status: true }] }, filters));
    assert(!matchesBarFilters({ openingPeriods: [{ status: false }] }, filters));
    assert(!matchesBarFilters({ isOpen: true }, filters));
    assert(!matchesBarFilters({ amenities: ['sports_bar'] }, filters));
    assert(!matchesBarFilters({ openingPeriods: [{ status: true }] }, new Set(['open_now', 'wifi'])));
    assert(matchesBarFilters({ openingPeriods: [{ status: true }], amenities: ['wifi'] }, new Set(['open_now', 'wifi'])));
});

test('filter panel renders every checkbox, active state, all groups and working reset/results actions', () => {
    const source = fs.readFileSync(require.resolve('../app/src/screens/Map/MapScreen.tsx'), 'utf8');
    const ast = ts.createSourceFile('MapScreen.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const declarations = {};
    function visit(node) {
        if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
            declarations[node.name.text] = node.initializer.getText(ast);
        }
        ts.forEachChild(node, visit);
    }
    visit(ast);
    let activeFilters = new Set(['wifi']);
    let visible = true;
    const actions = new Map();
    const container = ({ children, testID, accessibilityRole, accessibilityLabel, accessibilityState, onPress }) => {
        if (onPress) actions.set(accessibilityLabel || testID || 'results', onPress);
        return React.createElement(accessibilityRole === 'checkbox' ? 'button' : 'div', {
            'data-testid': testID, role: accessibilityRole, 'aria-label': accessibilityLabel,
            'aria-checked': accessibilityState?.checked,
        }, children);
    };
    const context = {
        React, AMENITY_OPTIONS, AMENITY_CATEGORIES, useMemo: fn => fn(),
        View: container, TouchableOpacity: container, ScrollView: container, Text: container,
        MaterialCommunityIcons: () => null, Feather: () => null,
        Platform: { select: () => ({}) }, EDITORIAL: {}, styles: {},
        activeFilters, height: 844, mobileDropdownTop: 66, safeBottomInset: 34,
        setActiveFilters: value => { activeFilters = value; },
        setShowFiltersPanel: value => { visible = value; },
        toggleFilter() {},
    };
    const panel = vm.runInNewContext(compile(
        `const FILTER_OPTIONS = ${declarations.FILTER_OPTIONS}; (${declarations.renderFiltersPanel})`,
    ), context);
    const html = renderToStaticMarkup(panel());
    assert.equal((html.match(/role="checkbox"/g) || []).length, 17);
    for (const option of AMENITY_OPTIONS) {
        assert(html.includes(`data-testid="map-filter-${option.key}"`));
        assert(html.includes(option.label));
    }
    for (const category of AMENITY_CATEGORIES) assert(html.includes(category.label));
    assert.match(html, /aria-label="WiFi" aria-checked="true"/);
    assert(html.includes('1 filtre'));
    actions.get('Netejar tots els filtres')();
    assert.equal(activeFilters.size, 0);
    actions.get('Veure resultats dels filtres')();
    assert.equal(visible, false);
    assert.match(source, /showsVerticalScrollIndicator=\{true\}/);
    assert.equal((source.match(/matchesBarFilters\(bar, activeFilters\)/g) || []).length, 2);
});
