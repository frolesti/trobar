const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

function slider(extraProps = {}) {
    const values = [];
    let opens = 0;
    const hooks = { ...React, useRef: current => ({ current }), useMemo: create => create() };
    const native = {
        View: 'View', Platform: { OS: 'web', select: options => options.web }, StyleSheet: { create: styles => styles },
        PanResponder: { create: panHandlers => ({ panHandlers }) },
        Animated: {
            View: 'AnimatedView',
            Value: class { setValue(value) { values.push(value); } stopAnimation() {} },
            timing: (value, { toValue }) => ({ start: callback => { value.setValue(toValue); callback({ finished: true }); } }),
            spring: (value, { toValue }) => ({ start: () => value.setValue(toValue) }),
        },
    };
    const module = { exports: {} };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../app/src/components/PremiumProfileSlider.tsx'), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
    }).outputText, { module, exports: module.exports,
        require(name) {
            if (name === 'react') return hooks;
            if (name === 'react-native') return native;
            if (name.endsWith('AppText')) return { __esModule: true, default: 'Text' };
            if (name.includes('editorialTheme')) return { EDITORIAL: { borderOnBackground: 'rgba(255,255,255,0.3)' } };
            throw new Error(name);
        },
    });
    const tree = module.exports.default({ name: 'Bar del barri', onOpen: () => opens++, ...extraProps });
    return { tree, pan: tree.props, values, opens: () => opens };
}

test('premium expansion displays only the same subtle line as the expanded sheet', () => {
    const { tree } = slider();
    const area = tree.props.style[0];
    assert.equal(area.height + tree.props.hitSlop.top + tree.props.hitSlop.bottom, 44);
    assert.equal(area.borderWidth, undefined);
    assert.equal(area.backgroundColor, undefined);
    assert.equal(area.userSelect, 'none', 'browser text selection must not steal an upward drag');
    assert.equal(area.touchAction, 'none', 'browser scrolling must not steal the gesture');
    const line = tree.props.children;
    assert.equal(line.type, 'View');
    assert.equal(line.props.children, undefined, 'no visible text, arrow or icon');
    assert.equal(line.props.style.width, 40);
    assert.equal(line.props.style.height, 4);
    assert.equal(line.props.style.borderRadius, 2);
    assert.equal(line.props.style.backgroundColor, 'rgba(255,255,255,0.3)');
});

test('premium profile slider opens only after a deliberate slide, with reset and bounds', () => {
    const { tree, pan, values, opens } = slider();
    assert.equal(tree.props.accessibilityRole, 'adjustable');
    assert.match(tree.props.accessibilityHint, /cap amunt/);
    assert('translateY' in tree.props.style[1].transform[0]);
    assert.equal(pan.onStartShouldSetPanResponder(), true);
    assert.equal(pan.onStartShouldSetPanResponderCapture(), true, 'the handle must acquire the upward drag');
    pan.onPanResponderMove(null, { dx: 0, dy: 25 });
    assert.equal(values.at(-1), 0);
    pan.onPanResponderRelease(null, { dx: 0, dy: 0 });
    assert.equal(opens(), 0, 'a tap must not open');
    pan.onPanResponderRelease(null, { dx: 0, dy: -20 });
    assert.equal(opens(), 0, 'a short slide must reset');
    assert.equal(values.at(-1), 0);
    pan.onPanResponderRelease(null, { dx: 200, dy: 0 });
    pan.onPanResponderRelease(null, { dx: 0, dy: 100 });
    pan.onPanResponderRelease(null, { dx: 100, dy: -40 });
    assert.equal(opens(), 0, 'horizontal, downward and mostly horizontal drags must not open');
    pan.onPanResponderMove(null, { dx: 0, dy: -1000 });
    assert.equal(values.at(-1), -12);
    pan.onPanResponderRelease(null, { dx: 0, dy: -40 });
    assert.equal(opens(), 1);
    assert.equal(values.at(-1), 0, 'slider must be reusable after closing the profile');
    pan.onPanResponderTerminate();
    assert.equal(opens(), 1);
});

test('screen readers can open the same premium profile without dragging', () => {
    const { tree, opens } = slider();
    tree.props.onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } });
    assert.equal(opens(), 0);
    tree.props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } });
    assert.equal(opens(), 1);
    tree.props.onAccessibilityTap();
    assert.equal(opens(), 2);
});

test('a controlled handle streams vertical movement to the same sheet without opening on release', () => {
    const events = [];
    const { pan, opens } = slider({
        onDragStart: () => events.push('start'), onDrag: dy => events.push(dy),
        onDragEnd: (dy, vy) => events.push([dy, vy]), onDragCancel: () => events.push('cancel'),
    });
    pan.onPanResponderGrant();
    pan.onPanResponderMove(null, { dx: 0, dy: -45 });
    assert.deepEqual(events, ['start', -45]);
    assert.equal(opens(), 0, 'progress is controlled by the sheet while the finger is held');
    pan.onPanResponderRelease(null, { dx: 0, dy: -45, vy: -0.2 });
    assert.deepEqual(events.at(-1), [-45, -0.2]);
    assert.equal(opens(), 0, 'release settles the existing sheet, not a second modal');
    pan.onPanResponderMove(null, { dx: 100, dy: -10 });
    pan.onPanResponderRelease(null, { dx: 100, dy: -10, vy: 0 });
    assert.equal(events.at(-1), 'cancel');
});
