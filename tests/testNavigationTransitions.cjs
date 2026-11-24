const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

test('merchant content slides horizontally, reverses direction and respects reduced motion', () => {
    const source = fs.readFileSync(require.resolve('../app/src/screens/BarDashboard/BarDashboardScreen.tsx'), 'utf8');
    const ast = ts.createSourceFile('dashboard.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let callback;
    const visit = node => {
        if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect'
            && node.getText(ast).includes('contentSlide.setValue')) callback = node.arguments[0].getText(ast);
        ts.forEachChild(node, visit);
    };
    visit(ast);
    assert(callback);
    const positions = [], timings = [];
    let stops = 0;
    const context = {
        activeTab: 'settings', profileMode: 'overview', previousView: { current: 'profile:overview' },
        reduceMotion: false, width: 390, Platform: { OS: 'ios' }, Easing: { cubic: 'cubic', out: value => value },
        contentSlide: { stopAnimation() {}, setValue: value => positions.push(value) },
        Animated: { timing: (_, options) => { timings.push(options); return { start() {}, stop() { stops++; } }; } },
    };
    vm.runInNewContext(ts.transpileModule(`globalThis.effect = ${callback};`, {
        compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText, context);
    context.effect()();
    assert.equal(stops, 1);
    assert.equal(positions[0], 390);
    assert.equal(timings[0].duration, 280);
    assert.equal(timings[0].useNativeDriver, true);
    context.activeTab = 'profile';
    context.effect();
    assert.equal(positions[1], -390);
    context.profileMode = 'edit';
    context.reduceMotion = true;
    context.effect();
    assert.equal(positions[2], 0);
    assert.equal(timings[2].duration, 0);
    context.reduceMotion = false;
    context.effect();
    assert.equal(positions.at(-1), 0, 'a preference or viewport change must not leave the same page stopped halfway offscreen');
});

test('menu routes explicitly enable horizontal animation on web and preserve back transitions', () => {
    const moduleStub = { exports: {} };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../app/src/navigation/AppNavigator.tsx'), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
    }).outputText, { module: moduleStub, exports: moduleStub.exports, require(name) {
        if (name === 'react') return { ...React, useState: () => [undefined, () => {}] };
        if (name === '@react-navigation/native') return { NavigationContainer: 'NavigationContainer', DefaultTheme: { colors: {} }, useNavigationContainerRef: () => ({}) };
        if (name.includes('TutorialContext')) return { TutorialProvider: 'TutorialProvider' };
        if (name === '@react-navigation/stack') return {
            createStackNavigator: () => ({ Navigator: 'Navigator', Screen: 'Screen' }),
            CardStyleInterpolators: { forHorizontalIOS: 'horizontal' },
        };
        if (name.includes('editorialTheme')) return { EDITORIAL: {} };
        return { __esModule: true, default: 'Component' };
    } });
    const navigator = moduleStub.exports.default().props.children.props.children;
    assert.equal(navigator.props.screenOptions.animation, 'slide_from_right');
    const map = navigator.props.children.find(node => node.props.name === 'Map');
    assert.equal(map.props.options.animation, undefined, 'the map inherits the same horizontal stack transition as the merchant menu');
    assert.equal(map.props.options.cardStyleInterpolator, undefined);
    assert.equal(navigator.props.screenOptions.cardStyleInterpolator, 'horizontal');
    const matches = navigator.props.children.find(node => node.props.name === 'Matches');
    assert.equal(matches.props.options.animation, 'slide_from_left');
    assert.equal(matches.props.options.gestureDirection, 'horizontal-inverted');
    assert.equal(matches.props.options.cardStyleInterpolator, 'horizontal');
    const matchesSource = fs.readFileSync(require.resolve('../app/src/screens/Matches/MatchesScreen.tsx'), 'utf8');
    assert.match(matchesSource, /useScreenLoading\('MatchesScreen', false\)/, 'the global splash must not hide the navigation animation');
    assert.match(matchesSource, /loading \|\| competitionLoading \? <ActivityIndicator/, 'show loading inside the moving screen instead');
});
