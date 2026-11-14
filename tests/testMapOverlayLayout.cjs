const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(require.resolve('../app/src/screens/Map/MapScreen.tsx'), 'utf8');
const ast = ts.createSourceFile('MapScreen.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = {};
let noticeEffect;
function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        declarations[node.name.text] = node.initializer.getText(ast);
    }
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect'
        && node.arguments[0]?.getText(ast).includes('setMatchNotice')) {
        noticeEffect = node.arguments[0].getText(ast);
    }
    ts.forEachChild(node, visit);
}
visit(ast);
const compile = code => ts.transpileModule(code, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

test('notices sit at the bottom beside the control column across viewport sizes and safe areas', () => {
    for (const width of [320, 375, 430, 768, 1024, 1440]) {
        for (const safeBottomInset of [8, 34, 48]) {
            for (const signedIn of [false, true]) {
                const context = { width, safeBottomInset, user: signedIn ? { id: 'test' } : null, selectedBar: null, selectedDiscoveredBar: null, Platform: { OS: 'web' } };
                const keys = ['isDesktop', 'mobileFabBottom', 'mapControlsBottom', 'mapControlsInline', 'mapSearchBottom', 'mapNoticeBottom', 'mapNoticeRight', 'mapNoticeLeft'];
                const result = vm.runInNewContext(keys.map(key => `const ${key} = ${declarations[key]};`).join('\n')
                    + '\n({mapControlsBottom, mapSearchBottom, mapNoticeBottom, mapNoticeRight, mapNoticeLeft})', context);
                assert(result.mapSearchBottom - (result.mapControlsBottom + 48) >= 8);
                assert.equal(result.mapNoticeBottom, result.mapControlsBottom);
                const noticeRightEdge = width - result.mapNoticeRight;
                const controlLeftEdge = width - 20 - 48;
                assert.equal(controlLeftEdge - noticeRightEdge, 12);
                assert(noticeRightEdge - result.mapNoticeLeft >= 160, 'notice remains readable on narrow screens');
                assert.equal((result.mapNoticeLeft + noticeRightEdge) / 2, width / 2, 'the whole bubble, not only its text, must be centered on screen');
                assert(result.mapNoticeLeft >= 62, 'web zoom controls also remain clear');
                context.Platform.OS = 'ios';
                assert.equal(result.mapNoticeLeft, result.mapNoticeRight);
                for (const noticeHeight of [44, 64, 120]) {
                    const viewportHeight = 844;
                    const noticeTop = viewportHeight - result.mapNoticeBottom - noticeHeight;
                    const noticeBottom = noticeTop + noticeHeight;
                    assert.equal(noticeBottom, viewportHeight - result.mapControlsBottom);
                    assert(noticeRightEdge < controlLeftEdge, 'wrapping must never invade the control column');
                }
            }
        }
    }
    assert.equal((source.match(/bottom: mapNoticeBottom/g) || []).length, 2);
    assert.equal((source.match(/right: mapNoticeRight/g) || []).length, 3);
    assert.equal((source.match(/left: mapNoticeLeft/g) || []).length, 3);
    assert.equal((source.match(/onLayout=\{event => setMapNoticeHeight\(event\.nativeEvent\.layout\.height\)\}/g) || []).length, 2);
    assert.match(source, /mapNoticeBottom \+ mapNoticeHeight \+ 8/);
    assert.equal((source.match(/bottom: mapSearchBottom/g) || []).length, 2);
    assert.equal((source.match(/bottom: mapControlsBottom/g) || []).length, 2);
    assert.match(source, /!mapLoadFailed && !transientAlertVisible && !selectedLocation && \(scanMessage \|\| matchNotice\)/);
    assert.match(source, /mapLoadFailed && !transientAlertVisible/);
    assert.match(source, /<AlertBannerHost\s+active=\{isFocused\}\s+bottomOffset=\{mapNoticeBottom\}\s+horizontalInsets=\{\{ left: mapNoticeLeft, right: mapNoticeRight \}\}/);
});

test('selected-venue controls form one row below the card without overlapping its pin or each other', () => {
    for (const width of [320, 390, 430]) for (const height of [568, 667, 844]) {
        for (const safeBottomInset of [8, 34, 48]) for (const signedIn of [false, true]) {
            for (const discovered of [false, true]) {
                const context = {
                    width, height, safeBottomInset, user: signedIn ? { id: 'test' } : null,
                    selectedBar: discovered ? null : { id: 'registered' }, selectedDiscoveredBar: discovered ? { id: 'discovered' } : null,
                };
                const keys = ['isDesktop', 'mobileFabBottom', 'mapAttributionBottom', 'selectedPinY', 'mapControlsBottom', 'mapControlsInline', 'mapSearchBottom', 'mapSearchRight'];
                const layout = vm.runInNewContext(keys.map(key => `const ${key} = ${declarations[key]};`).join('\n')
                    + '\n({selectedPinY, mapControlsBottom, mapSearchBottom, mapSearchRight})', context);
                assert.equal(layout.mapSearchBottom, layout.mapControlsBottom);
                assert.equal(layout.mapSearchRight, 76);
                assert(width - layout.mapSearchRight - 48 >= width / 2 + 32, 'the selected pin remains clear of the search control');
                const cardBottom = layout.selectedPinY - 64 - 12;
                assert(cardBottom < height - layout.mapControlsBottom - 48, 'the controls remain below the card');
                assert.equal(layout.mapSearchRight - (20 + 48), 8, 'controls keep their 8px horizontal separation');
            }
        }
    }
});

test('search progress and results disappear after 3.5 seconds and replaced messages cancel their old timers', () => {
    let effectSource;
    function find(node) {
        if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect' && node.arguments[1]?.getText(ast) === '[scanMessage]') effectSource = node.arguments[0].getText(ast);
        ts.forEachChild(node, find);
    }
    find(ast);
    assert(effectSource);
    let scheduled, message = 'Buscant bars sense registrar…';
    const cleared = [];
    const context = {
        scanMessage: message, setScanMessage: value => { message = value; },
        setTimeout: (callback, delay) => { scheduled = { callback, delay }; return 1; }, clearTimeout: id => cleared.push(id),
    };
    const effect = vm.runInNewContext(compile(`(${effectSource})`), context);
    const cleanup = effect();
    assert.equal(scheduled.delay, 3500);
    cleanup();
    assert.deepEqual(cleared, [1]);
    context.scanMessage = '28 locals sense registrar.';
    effect();
    scheduled.callback();
    assert.equal(message, null);
    assert.doesNotMatch(source, /onDismiss=\{scanMessage/, 'short-lived scan notices need no asymmetric dismiss gutter');
});

test('confirmed-match notice expires quickly and selection changes clean up the previous timer', () => {
    let message = null;
    let scheduled;
    const cleared = [];
    const context = {
        selectedMatch: { id: 'men' },
        setMatchNotice: value => { message = value; },
        setTimeout: (callback, delay) => { scheduled = { callback, delay }; return 1; },
        clearTimeout: id => cleared.push(id),
    };
    const effect = vm.runInNewContext(compile(`(${noticeEffect})`), context);
    const cleanup = effect();
    assert.equal(message, 'Mostrant els locals que han confirmat aquest partit.');
    assert.equal(scheduled.delay, 2400);
    scheduled.callback();
    assert.equal(message, null);
    cleanup();
    assert.deepEqual(cleared, [1]);
    context.selectedMatch = { id: 'women' };
    effect();
    assert(message);
    context.selectedMatch = null;
    effect();
    assert.equal(message, null, 'removing the filter must also remove its confirmation');
});

test('map control surfaces are translucent circles and pin artwork uses brand grana', () => {
    const stylesSource = fs.readFileSync(require.resolve('../app/src/screens/Map/MapScreen.styles.ts'), 'utf8');
    const module = { exports: {} };
    vm.runInNewContext(compile(stylesSource), {
        module, exports: module.exports,
        require(name) {
            if (name === 'react-native') return { StyleSheet: { create: value => value }, Platform: { select: value => value.web } };
            if (name.includes('sketchTheme')) return { SKETCH_THEME: { colors: {} } };
            if (name.includes('editorialTheme')) return { EDITORIAL: {} };
            throw new Error(`Unexpected dependency ${name}`);
        },
    });
    const fab = module.exports.default.fabGps;
    assert.equal(fab.width, 48);
    assert.equal(fab.height, fab.width);
    assert.equal(fab.borderRadius, fab.width / 2);
    assert.equal(fab.backgroundColor, 'rgba(255,250,243,0.68)');
    assert.equal(fab.borderWidth, 1.5);
    assert.equal(fab.borderTopColor, 'rgba(255,255,255,0.95)');
    assert.match(source, /testID="confirmed-bar-pin" source=\{getMapIcon\('registered'\)\}/);
    assert.match(source, /testID="discovered-bar-pin" source=\{getMapIcon\('discovered'\)\}/);
    assert.equal((source.match(/source=\{getMapIcon\('hide'\)\}/g) || []).length, 2);
    assert.match(source, /!selectedLocation && \(scanMessage \|\| matchNotice\)/, 'scan instructions must not cover the selected pin');
    for (const name of ['target', 'search']) {
        assert.equal(source.split(`source={getMapIcon('${name}')}`).length - 1, 2);
    }
    const icons = fs.readFileSync(require.resolve('../app/src/utils/mapIcons.ts'), 'utf8');
    assert.match(icons, /map-icons\/target-3d\.png/);
    assert.match(icons, /map-icons\/zoom-3d\.png/);
});
