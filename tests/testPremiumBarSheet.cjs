const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

function harness() {
    const states = [], refs = [], dependencies = [], effects = [], animations = [];
    let stateIndex = 0, refIndex = 0, effectIndex = 0;
    const hooks = { ...React,
        useRef(initial) { const i = refIndex++; return refs[i] || (refs[i] = { current: initial }); },
        useState(initial) { const i = stateIndex++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = value; }]; },
        useEffect(effect, deps) {
            const i = effectIndex++;
            if (!dependencies[i] || deps.some((value, j) => value !== dependencies[i][j])) { dependencies[i] = deps; effects.push(effect); }
        },
    };
    class Value {
        constructor(value) { this.current = value; this.listeners = new Map(); }
        setValue(value) { this.current = value; for (const callback of this.listeners.values()) callback({ value }); }
        stopAnimation() {}
        addListener(callback) { const key = String(this.listeners.size); this.listeners.set(key, callback); return key; }
        removeListener(key) { this.listeners.delete(key); }
        interpolate({ inputRange, outputRange }) {
            return { current: () => {
                let i = inputRange.findIndex(value => value >= this.current);
                if (i <= 0) i = 1;
                const fraction = (this.current - inputRange[i - 1]) / (inputRange[i] - inputRange[i - 1]);
                return outputRange[i - 1] + fraction * (outputRange[i] - outputRange[i - 1]);
            } };
        }
    }
    const native = {
        View: 'View', TouchableOpacity: 'TouchableOpacity', KeyboardAvoidingView: 'KeyboardAvoidingView',
        Platform: { OS: 'web', select: options => options.web }, StyleSheet: { absoluteFill: {} },
        AccessibilityInfo: { isReduceMotionEnabled: async () => false, addEventListener: () => ({ remove() {} }) },
        BackHandler: { addEventListener: () => ({ remove() {} }) },
        Animated: { View: 'AnimatedView', Value, spring: (value, { toValue }) => ({
            start(callback) { animations.push(toValue); value.setValue(toValue); callback({ finished: true }); },
        }) },
    };
    const module = { exports: {} };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../app/src/components/PremiumBarSheet.tsx'), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
    }).outputText, { module, exports: module.exports, console, require(name) {
        if (name === 'react') return hooks;
        if (name === 'react-native') return native;
        if (name.includes('safe-area')) return { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) };
        if (name.includes('editorialTheme')) return { EDITORIAL: { background: '#7a0033', matchday: '#F4D35E' } };
        if (name.endsWith('PremiumProfileSlider')) return { __esModule: true, default: 'Handle' };
        throw new Error(name);
    } });
    const props = {
        name: 'Bar', screenWidth: 390, screenHeight: 844,
        collapsedTop: 280, collapsedLeft: 12, collapsedWidth: 366, collapsedHeight: 300, expanded: false,
        compactContent: 'Summary', renderExpanded: () => 'Full profile',
        onExpandedChange: value => { props.expanded = value; }, onCollapsedHeightChange: value => { props.collapsedHeight = value; },
    };
    const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : node?.props ? [node, ...nodes(node.props.children)] : [];
    function render() {
        stateIndex = refIndex = effectIndex = 0;
        const tree = module.exports.default(props);
        effects.splice(0).forEach(effect => effect());
        return nodes(tree);
    }
    return { props, animations, render, handle: () => render().find(node => node.type === 'Handle').props,
        frame: () => render().find(node => node.props.testID === 'premium-bar-sheet').props.style };
}

test('premium card follows the finger before release and settles back after a short drag', () => {
    const sheet = harness();
    sheet.render();
    sheet.handle().onDragStart();
    sheet.handle().onDrag(-40);
    const frame = sheet.frame();
    assert.equal(frame.top.current(), 240, 'the same card moves upward by the finger distance');
    assert(frame.height.current() > 300 && frame.height.current() < 844, 'height grows continuously while held');
    assert.equal(sheet.animations.length, 0, 'not a delayed modal launch');
    assert.equal(sheet.props.expanded, false);
    sheet.handle().onDragEnd(-40, 0);
    assert.equal(sheet.frame().top.current(), 280);
    assert.equal(sheet.frame().height, undefined, 'the collapsed card must regain its intrinsic height');
});

test('the first card is measured before becoming visible or interactive', () => {
    const sheet = harness();
    sheet.props.layoutReady = false;
    let frame = sheet.render().find(node => node.props.testID === 'premium-bar-sheet');
    assert.equal(frame.props.style.opacity, 0);
    assert.equal(frame.props.pointerEvents, 'none');
    frame.props.onLayout({ nativeEvent: { layout: { height: 336 } } });
    assert.equal(sheet.props.collapsedHeight, 336);
    sheet.props.layoutReady = true;
    frame = sheet.render().find(node => node.props.testID === 'premium-bar-sheet');
    assert.equal(frame.props.style.opacity, 1);
    assert.equal(frame.props.pointerEvents, 'auto');
});

test('collapsed premium cards measure their entire content without inheriting a clipped previous popup height', () => {
    const sheet = harness();
    const compact = sheet.render().find(node => node.props.testID === 'static-premium-map-card');
    assert.equal(compact.props.style.position, 'relative');
    assert.equal(compact.props.style.marginTop, undefined, 'the normal-flow handle already reserves its 28px; never count it twice');
    assert.equal(sheet.frame().height, undefined);
    const frame = sheet.render().find(node => node.props.testID === 'premium-bar-sheet');
    frame.props.onLayout({ nativeEvent: { layout: { height: 452 } } });
    assert.equal(sheet.props.collapsedHeight, 452);
    sheet.handle().onDragStart();
    assert.equal(sheet.frame().height.current(), 452, 'expansion starts from the actual full summary height');
    const map = fs.readFileSync(require.resolve('../app/src/screens/Map/MapScreen.tsx'), 'utf8');
    assert.match(map, /collapsedHeight=\{venueCardHeight\}/);
    assert.doesNotMatch(map, /onCollapsedHeightChange=\{setBarCardHeight\}/);
});

test('premium measurements belong to the selected venue, not to the previous report or premium card', () => {
    const source = fs.readFileSync(require.resolve('../app/src/screens/Map/MapScreen.tsx'), 'utf8');
    const ast = ts.createSourceFile('MapScreen.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let initializer;
    function find(node) {
        if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'venueCardHeight') initializer = node.initializer.getText(ast);
        ts.forEachChild(node, find);
    }
    find(ast);
    assert(initializer);
    const calculate = new Function('selectedVenueId', 'venueMeasurement', `return ${initializer};`);
    assert.equal(calculate('registered:new', { id: 'discovered:previous', height: 650 }), 280);
    assert.equal(calculate('registered:new', { id: 'registered:new', height: 326 }), 326);
    assert.equal(calculate('registered:new', null), 280);
    assert.equal(calculate('registered:new', { id: 'discovered:new', height: 650 }), 280);
});

test('free and discovered venues use the same intrinsic frame without premium-only interactions', () => {
    const sheet = harness();
    sheet.props.expandable = false;
    const nodes = sheet.render();
    assert(!nodes.some(node => node.type === 'Handle'));
    assert.equal(sheet.frame().height, undefined);
    const frame = nodes.find(node => node.props.testID === 'premium-bar-sheet');
    frame.props.onLayout({ nativeEvent: { layout: { height: 226 } } });
    assert.equal(sheet.props.collapsedHeight, 226);
    assert(!nodes.some(node => node.props.testID === 'expanded-premium-content'));
});
test('the same sheet expands, drags down, cancels and collapses without mounting a second modal', () => {
    const sheet = harness();
    sheet.render();
    sheet.handle().onDragStart();
    sheet.handle().onDrag(-180);
    sheet.handle().onDragEnd(-180, 0);
    assert.equal(sheet.props.expanded, true);
    assert(Math.abs(sheet.frame().top.current() - 844 * 0.06) < 1e-8);
    sheet.handle().onDragStart();
    sheet.handle().onDrag(40);
    assert(sheet.frame().top.current() > 844 * 0.06);
    sheet.handle().onDragCancel();
    assert.equal(sheet.props.expanded, true);
    sheet.handle().onDragStart();
    sheet.handle().onDrag(180);
    sheet.handle().onDragEnd(180, 0.8);
    assert.equal(sheet.props.expanded, false);
    assert.equal(sheet.frame().top.current(), 280);
    assert(!sheet.render().some(node => node.type === 'Modal'));
});
