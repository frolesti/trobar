const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function loadCard(component = 'MatchCard', react = React, clock = Date, nativeOverrides = {}) {
    const source = fs.readFileSync(path.join(__dirname, `../app/src/components/${component}.tsx`), 'utf8');
    const moduleStub = { exports: {} };
    const container = ({ children, style, accessibilityLabel }) => {
        const flat = Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
        return React.createElement('div', { 'data-background': flat.backgroundColor, 'data-category': flat.borderTopColor, 'aria-label': accessibilityLabel }, children);
    };
    const text = ({ children }) => React.createElement('span', null, children);
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText, {
        module: moduleStub, exports: moduleStub.exports, Date: clock,
        require: name => {
            if (name === 'react') return react;
            if (name === 'react-native') return { View: container, TouchableOpacity: container, Platform: { OS: 'web' }, PanResponder: { create: handlers => ({ panHandlers: handlers }) }, StyleSheet: { create: value => value }, Animated: { View: container, Value: class { setValue() {} stopAnimation() {} interpolate() { return 0; } }, timing: () => ({ start: callback => callback?.({ finished: true }), stop() {} }) }, ...nativeOverrides };
            if (name === 'expo-image') return { Image: props => React.createElement('img', { alt: props.accessibilityLabel, 'data-tint': props.tintColor }) };
            if (name === '@expo/vector-icons') return { Feather: () => null };
            if (name === './AppText') return { default: text, __esModule: true };
            if (name === './MatchCard') return { default: loadCard(), __esModule: true };
            if (name.includes('editorialTheme')) return { EDITORIAL: { masculine: '#8C003B', feminine: '#AD2857' } };
            if (name.includes('teamName')) return { formatTeamNameForDisplay: value => value };
            if (name.includes('womenTeamCrests')) return { getWomenTeamCrest: () => undefined };
            if (name.includes('mapMatches')) {
                const module = { exports: {} };
                vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../app/src/utils/mapMatches.ts'), 'utf8'), {
                    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
                }).outputText, { module, exports: module.exports });
                return module.exports;
            }
            if (name.endsWith('.png')) return name;
            throw new Error(`Unexpected import: ${name}`);
        },
    });

    return moduleStub.exports.default;
}

test('deck reserves its reveal in a non-animated front frame, separate from the absolute back card', () => {
        let refIndex = 0, stateIndex = 0;
        const refs = [], states = [];
        const hooks = {
            ...React, useEffect() {}, useLayoutEffect() {}, useMemo: create => create(),
            useRef(value) { const i = refIndex++; return refs[i] ||= { current: value }; },
            useState(value) { const i = stateIndex++; if (!(i in states)) states[i] = value; return [states[i], next => { states[i] = next; }]; },
        };
        const Stack = loadCard('MatchCardStack', hooks);
        const men = { id: 'men', category: 'masculino', date: new Date('2030-10-10') };
        const women = { ...men, id: 'women', category: 'FEMENI' };
        const render = (match, alternativeMatch) => { refIndex = 0; stateIndex = 0; return Stack({ match, alternativeMatch, onSwitchMatch() {}, onToggleFilter() {} }); };
        for (const height of [0, 130, 180, 260, 140]) {
            for (const [front, back] of [[men, women], [women, men]]) {
                const tree = render(front, back);
                assert.equal(tree.props.collapsable, false);
                assert.equal(tree.props.style.paddingTop, undefined);
                assert.equal(tree.props.style.flexShrink, 0);
                const [rear, frame] = tree.props.children;
                const foreground = frame.props.children;
                assert.equal(frame.props.style[1].paddingTop, 48);
                assert.equal(frame.props.style[0].zIndex, 2);
                assert.equal(frame.props.collapsable, false);
                assert.equal(rear.props.style[0].zIndex, 1);
                assert.equal(rear.props.style[0].top, 0);
                assert.equal(rear.props.style[0].position, 'absolute');
                assert.equal(rear.props.collapsable, false);
                assert.equal(foreground.props.style.marginTop, undefined);
                foreground.props.onLayout({ nativeEvent: { layout: { height } } });
            }
        }
        assert.equal(render(men, null).props.children[1].props.style[1].paddingTop, 0);
        assert.equal(render(men, women).props.children.filter(Boolean).length, 2);
});

test('Supercopa keeps its own name and semifinal label instead of the Copa del Rey logo', () => {
    const Card = loadCard();
    const html = renderToStaticMarkup(React.createElement(Card, { match: {
        id: 'supercopa', date: new Date('2027-02-02T19:00:00Z'),
        homeTeam: 'FC Barcelona', awayTeam: 'Atlético de Madrid',
        competition: { id: 'supercup', name: 'Supercopa de España' },
        stage: 'SEMI_FINALS', timeConfirmed: true, category: 'masculino', status: 'scheduled',
    } }));
    assert.match(html, /Supercopa de España/);
    assert.match(html, /Semifinals/);
    assert(!html.includes('Copa del Rey'));
});

test('carousel sizing reaches the actual compact card surface without changing default card sizing', () => {
    const Card = loadCard('MatchCard', { ...React, memo: component => component });
    const match = {
        id: 'fixture', homeTeam: 'Barcelona', awayTeam: 'Opponent',
        date: new Date('2030-10-10T18:30:00Z'),
        competition: { id: 'cup', name: 'Champions League' }, stage: 'LEAGUE_STAGE',
    };
    const style = { flex: 1 };
    for (const compact of [false, true]) {
        const card = Card({ match, compact, style });
        assert.equal(card.props.style.at(-1), style);
        const normal = Card({ match, compact });
        assert.equal(normal.props.style.at(-1), undefined);
    }
});
test('result has exactly one competition logo between the goals and no duplicate competition text', () => {
    const Card = loadCard();
    const html = renderToStaticMarkup(React.createElement(Card, { match: {
        id: 'match', homeTeam: 'Barcelona', awayTeam: 'Getafe', date: new Date('2026-10-10'),
        league: '1', competition: { id: '1', name: 'Primera Division' }, homeScore: 3, awayScore: 0, status: 'finished',
    } }));
    assert.match(html, /<span>3<\/span><div[^>]*><img alt="La Liga" data-tint="#FFFFFF"\/><\/div><span>0<\/span>/);
    assert.equal((html.match(/alt="La Liga"/g) || []).length, 1);
    assert(!html.includes('>La Liga<'));
    assert(!html.includes('>Primera Division<'));
    assert(!html.includes('>Final<'));
    assert(!html.includes('Trobar bars'));
    assert(!html.includes('>Masculí<'));
    assert(!html.includes('>Femení<'));
});

test('upcoming matches show no score dashes and include a full date above teams', () => {
    const Card = loadCard();
    const html = renderToStaticMarkup(React.createElement(Card, { match: {
        id: 'future', homeTeam: 'Barcelona', awayTeam: 'Getafe', date: new Date('2030-10-10T18:30:00Z'),
        league: '1', competition: { id: '1', name: 'Primera Division' }, status: 'scheduled',
    } }));
    assert(!html.includes('–'));
    assert(html.includes('2030'));
    const visibleText = html.replace(/<[^>]+>/g, '');
    assert(visibleText.indexOf('2030') < visibleText.indexOf('Barcelona'));
    assert.equal((html.match(/alt="La Liga"/g) || []).length, 1);
});

test('finished knockout fixtures keep the phase without the redundant final status', () => {
    const Card = loadCard();
    for (const stage of ['LAST_16', 'QUARTER_FINALS', 'FINAL']) {
        const html = renderToStaticMarkup(React.createElement(Card, { match: {
            id: 'cup', homeTeam: 'Barcelona', awayTeam: 'Opponent', date: new Date('2026-01-01'),
            competition: { id: 'cup', name: 'Copa del Rey' }, status: 'finished',
            homeScore: 3, awayScore: 0, stage,
        } }));
        assert.equal((html.match(/>Final</g) || []).length, stage === 'FINAL' ? 1 : 0);
        assert(html.includes(stage === 'LAST_16' ? 'Vuitens de final' : stage === 'QUARTER_FINALS' ? 'Quarts de final' : 'Final'));
    }
});

test('find bars only appears for eligible upcoming fixtures, not finished or postponed matches', () => {
    const Card = loadCard();
    const match = { id: 'future', homeTeam: 'Barcelona', awayTeam: 'Getafe', date: new Date('2030-10-10'), league: '1', status: 'scheduled' };
    const render = (hasBroadcast, status = 'scheduled') => renderToStaticMarkup(React.createElement(Card, { match: { ...match, status }, hasBroadcast, onPress: () => {}, grana: true }));
    assert(render(true).includes('Trobar bars'));
    assert(!render(false).includes('Trobar bars'));
    assert(!render(true, 'finished').includes('Trobar bars'));
    assert(!render(true, 'postponed').includes('Trobar bars'));
});

test('match list uses grana cards and consistent category colors without visible category labels', () => {
    const Card = loadCard();
    const render = category => renderToStaticMarkup(React.createElement(Card, { grana: true, match: { id: 'fixture', category, homeTeam: 'Barcelona', awayTeam: 'Opponent', date: new Date('2030-10-10'), league: '1' } }));
    const men = render('masculino');
    const women = render('femenino');
    assert(men.includes('data-background="#8C003B"'));
    assert(women.includes('data-background="#AD2857"'));
    assert(!men.includes('data-category='));
    assert(!women.includes('data-category='));
    assert(women.includes('aria-label="Barcelona - Opponent, femení"'));
    assert(!men.includes('>Masculí<'));
    assert(!women.includes('>Femení<'));
});

test('competition logos are white without a white background in list and compact cards', () => {
    const Card = loadCard();
    for (const compact of [false, true]) {
        const html = renderToStaticMarkup(React.createElement(Card, { compact, match: {
            id: 'champions', homeTeam: 'Barcelona', awayTeam: 'PSG', date: new Date('2030-10-10T18:30:00Z'),
            competition: { id: '2', name: 'UEFA Champions League' }, status: 'scheduled',
        } }));
        assert.match(html, /alt="UEFA Champions League" data-tint="#FFFFFF"/);
        assert(!html.includes('data-background="#FFFFFF"'));
    }
});

test('unknown kickoffs show only the confirmation message and explicit phases are translated', () => {
    const Card = loadCard();
    const match = { id: 'future', homeTeam: 'Barcelona', awayTeam: 'Opponent', date: new Date('2030-10-10T00:00:00Z'), status: 'scheduled' };
    for (const compact of [false, true]) {
        const html = renderToStaticMarkup(React.createElement(Card, { compact, match: { ...match, stage: 'QUARTER_FINALS' } }));
        assert(html.includes('Horari per confirmar'));
        assert(html.includes('Quarts de final'));
        assert(!html.includes('--:--'));
        assert(!html.includes('>00:00<'));
        const explicit = renderToStaticMarkup(React.createElement(Card, { compact, match: { ...match, date: new Date('2030-10-10T18:00:00Z'), timeConfirmed: false, stage: 'LEAGUE_STAGE' } }));
        assert(explicit.includes('Horari per confirmar'));
        assert(explicit.includes('Fase de lliga'));
    }
    const unknown = renderToStaticMarkup(React.createElement(Card, { match }));
    assert(!unknown.includes('Fase de grups'));
});

test('compact upcoming card does not repeat the next match label', () => {
    const Card = loadCard();
    const html = renderToStaticMarkup(React.createElement(Card, { compact: true, isNextMatch: true, onToggleFilter: () => {}, match: {
        id: 'future', homeTeam: 'Barcelona', awayTeam: 'Getafe', date: new Date('2030-10-10'), status: 'scheduled',
    } }));
    assert(!html.includes('Proper partit'));
});

test('early cup rounds and preliminary rounds always have visible phase labels', () => {
    const Card = loadCard();
    for (const [stage, label] of [['FIRST_ROUND', '1a ronda'], ['SECOND_ROUND', '2a ronda'], ['THIRD_ROUND', '3a ronda'],
        ['FOURTH_ROUND', '4a ronda'], ['LAST_64', 'Trenta-dosens de final'], ['PRELIMINARY_ROUND', 'Ronda preliminar']]) {
        const html = renderToStaticMarkup(React.createElement(Card, { match: {
            id: 'cup', homeTeam: 'Barcelona', awayTeam: 'Opponent', date: new Date('2030-01-01'),
            competition: { id: 'cup', name: 'Copa del Rey' }, status: 'scheduled', stage,
        } }));
        assert(html.includes(label), `missing ${stage}`);
    }
});

test('compact card taps only toggle the match filter and have no separate action row', () => {
    const Card = loadCard();
    let switches = 0;
    let filters = 0;
    const tree = Card.type({ compact: true, onSwitchMatch: () => switches++, onToggleFilter: () => filters++, match: {
        id: 'future', homeTeam: 'Barcelona', awayTeam: 'Getafe', date: new Date('2030-10-10'), status: 'scheduled',
    } });
    const elements = node => Array.isArray(node) ? node.flatMap(elements) : node?.props ? [node, ...elements(node.props.children)] : [];
    const controls = elements(tree).filter(node => node.props.onPress);
    controls.find(node => node.props.accessibilityLabel.startsWith('Aplicar filtre')).props.onPress();
    assert.equal(filters, 1);
    assert.equal(switches, 0);
    assert(!renderToStaticMarkup(React.createElement(Card, { compact: true, onToggleFilter() {}, match: { id: 'future', homeTeam: 'Barcelona', awayTeam: 'Getafe', date: new Date('2030-10-10') } })).includes('Trobar bars'));
});

test('map stack reveals the full alternative with hold-to-drag and keeps filter taps independent', () => {
    const Stack = loadCard('MatchCardStack');
    const match = { id: 'men', category: 'masculino', homeTeam: 'Barcelona', awayTeam: 'Getafe', date: new Date('2030-10-10'), status: 'scheduled' };
    const alternativeMatch = { ...match, id: 'women', category: 'femenino', awayTeam: 'Chelsea' };
    const html = renderToStaticMarkup(React.createElement(Stack, { match, alternativeMatch, onSwitchMatch: () => {}, onToggleFilter: () => {} }));
    assert.equal((html.match(/>Chelsea</g) || []).length, 1, 'the alternative has one representation, not a preview plus a second card');
    assert.equal((html.match(/>Getafe</g) || []).length, 1);
    assert(html.includes('data-background="#AD2857"'));
    assert(html.includes('data-background="#8C003B"'));
    assert(!html.includes('Trobar bars'));
    const single = renderToStaticMarkup(React.createElement(Stack, { match, alternativeMatch: null, onToggleFilter: () => {} }));
    assert(!single.includes('Mostrar Barcelona - Chelsea'));
    let now = 1000;
    class Clock extends Date { static now() { return now; } }
    const hooks = { ...React, useMemo: factory => factory(), useRef: value => ({ current: value }), useState: value => [value, () => {}], useEffect() {}, useLayoutEffect() {} };
    const SwipeStack = loadCard('MatchCardStack', hooks, Clock);
    let switches = 0;
    let filters = 0;
    const tree = SwipeStack({ match, alternativeMatch, isFilter: true, onSwitchMatch: () => switches++, onToggleFilter: () => filters++ });
    const backCard = tree.props.children[0];
    assert.equal(backCard.props['aria-hidden'], true);
    assert.equal(backCard.props.children.props.match.id, 'women');
    assert.equal(backCard.props.children.props.isFilter, false, 'the alternative is never highlighted as selected');
    const frontLayer = tree.props.children[1].props.children;
    const frontCard = frontLayer.props.children;
    assert.equal(frontCard.props.isFilter, true, 'only the foreground match carries the active filter');
    const transforms = frontLayer.props.style.transform;
    assert('translateY' in transforms[0]);
    assert(!transforms.some(transform => 'translateX' in transform));
    const gesture = tree.props;
    const move = (dy, dx = 0, numberActiveTouches = 1) => ({ dx, dy, numberActiveTouches, vx: 0, vy: 0 });
    assert.equal(gesture.onStartShouldSetPanResponderCapture(), false);
    now += 249;
    assert.equal(gesture.onMoveShouldSetPanResponderCapture(null, move(65)), false);
    now += 1;
    assert.equal(gesture.onMoveShouldSetPanResponderCapture(null, move(65)), true);
    assert.equal(gesture.onMoveShouldSetPanResponderCapture(null, move(10, 65)), false);
    assert.equal(gesture.onMoveShouldSetPanResponderCapture(null, move(65, 0, 2)), false);
    gesture.onPanResponderGrant();
    gesture.onPanResponderMove(null, move(-65));
    gesture.onPanResponderRelease(null, move(-65));
    frontCard.props.onToggleFilter();
    assert.equal(filters, 0, 'a swipe release must not activate the filter');
    gesture.onPanResponderRelease(null, move(65));
    assert.equal(switches, 2);
    gesture.onPanResponderRelease(null, move(10));
    assert.equal(switches, 2);
    gesture.onPanResponderRelease(null, { ...move(20), vy: 0.8 });
    assert.equal(switches, 3, 'a vertical flick completes the exchange');
    gesture.onStartShouldSetPanResponderCapture();
    frontCard.props.onLongPress();
    frontCard.props.onToggleFilter();
    assert.equal(filters, 0, 'holding without dragging must not activate the filter');
    gesture.onStartShouldSetPanResponderCapture();
    gesture.onMoveShouldSetPanResponderCapture(null, move(20));
    frontCard.props.onToggleFilter();
    assert.equal(filters, 0, 'a drag before the hold threshold must not become a filter tap');
    gesture.onStartShouldSetPanResponderCapture();
    frontCard.props.onToggleFilter();
    assert.equal(filters, 1, 'the next deliberate tap must still work');
    const loneCard = SwipeStack({ match, alternativeMatch: null, onToggleFilter() {} });
    loneCard.props.onStartShouldSetPanResponderCapture();
    now += 300;
    assert.equal(loneCard.props.onMoveShouldSetPanResponderCapture(null, move(65)), false);
});

test('match images cannot hijack a card gesture with the browser image drag', () => {
    const source = fs.readFileSync(path.join(__dirname, '../app/src/components/MatchCard.tsx'), 'utf8');
    const parsed = ts.createSourceFile('MatchCard.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let images = 0;
    function visit(node) {
        if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(parsed) === 'Image') {
            images++;
            const draggable = node.attributes.properties.find(prop => ts.isJsxAttribute(prop) && prop.name.text === 'draggable');
            assert.equal(draggable?.initializer?.expression?.kind, ts.SyntaxKind.FalseKeyword);
        }
        ts.forEachChild(node, visit);
    }
    visit(parsed);
    assert.equal(images, 2, 'both team crests and competition logos must yield to the card gesture');
});

test('animated exchanges keep exactly two distinct cards and reset before the next paint', () => {
    let refIndex = 0;
    const refs = [];
    let layoutEffects = [];
    let finish;
    let switched = false;
    const hooks = {
        ...React, useEffect() {}, useState: initial => [typeof initial === 'boolean' ? false : initial, () => {}], useMemo: create => create(),
        useRef(value) { const index = refIndex++; return refs[index] ||= { current: value }; },
        useLayoutEffect(effect) { layoutEffects.push(effect); },
    };
    const animated = {
        View: 'AnimatedView',
        Value: class {
            constructor(value) { this.value = value; }
            setValue(value) { this.value = value; }
            stopAnimation() {}
            interpolate() { return 0; }
        },
        timing: (value, { toValue }) => ({ start: callback => { finish = () => { value.setValue(toValue); callback?.({ finished: true }); }; } }),
    };
    const Stack = loadCard('MatchCardStack', hooks, Date, { Animated: animated });
    const men = { id: 'men', category: 'masculino', homeTeam: 'Barcelona', awayTeam: 'Getafe', date: new Date('2030-10-10') };
    const women = { ...men, id: 'women', category: 'femenino', awayTeam: 'Chelsea' };
    function render() {
        refIndex = 0;
        const tree = Stack({
            match: switched ? women : men, alternativeMatch: switched ? men : women,
            onSwitchMatch: () => { switched = !switched; }, onToggleFilter() {},
        });
        const cards = [tree.props.children[0], tree.props.children[1].props.children].filter(Boolean);
        assert.equal(cards.length, 2, 'no independent preview can duplicate the back card');
        assert.equal(new Set(cards.map(card => card.props.children.props.match.id)).size, 2);
        layoutEffects.forEach(effect => effect());
        layoutEffects = [];
        return tree;
    }
    for (const direction of [-1, 1]) {
        const tree = render();
        const offset = tree.props.children[1].props.children.props.style.transform[0].translateY;
        tree.props.onPanResponderGrant();
        tree.props.onPanResponderMove(null, { dy: direction * 80 });
        assert.equal(offset.value, direction * 80);
        tree.props.onPanResponderRelease(null, { dy: direction * 80, vy: 0 });
        assert.equal(offset.value, direction * 80, 'outgoing card stays in place until the animation finishes');
        finish();
        render();
        assert.equal(offset.value, 0, 'incoming card must be settled in the layout phase, not a later passive effect');
    }
});

test('iOS exchanges ignore late completions after data changes or unmount and never mix animation drivers', () => {
    let refIndex = 0, pendingLayout, cleanup, dependencies;
    const refs = [], completions = [], drivers = [];
    const hooks = {
        ...React, useEffect() {}, useMemo: create => create(),
        useState: initial => [typeof initial === 'boolean' ? false : initial, () => {}],
        useRef(value) { const i = refIndex++; return refs[i] ||= { current: value }; },
        useLayoutEffect(effect, next) {
            if (!dependencies || next.some((value, i) => value !== dependencies[i])) {
                dependencies = next;
                pendingLayout = () => { cleanup?.(); cleanup = effect(); };
            }
        },
    };
    const animated = {
        View: 'AnimatedView',
        Value: class {
            constructor(value) { this.value = value; }
            setValue(value) { this.value = value; }
            stopAnimation() {}
            interpolate() { return 0; }
        },
        timing: (_value, config) => {
            drivers.push(config.useNativeDriver);
            return { start: callback => { if (callback) completions.push(callback); } };
        },
    };
    const Stack = loadCard('MatchCardStack', hooks, Date, { Platform: { OS: 'ios' }, Animated: animated });
    const men = { id: 'men', category: 'masculino', date: new Date('2030-10-10') };
    const women = { ...men, id: 'women', category: 'femenino' };
    let switches = 0;
    const render = (match = men, alternativeMatch = women) => {
        refIndex = 0;
        const tree = Stack({ match, alternativeMatch, onSwitchMatch: () => switches++, onToggleFilter() {} });
        pendingLayout?.(); pendingLayout = null;
        return tree;
    };
    const exchange = tree => tree.props.children[1].props.children.props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } });
    exchange(render());
    exchange(render());
    assert.equal(completions.length, 1, 'unrelated renders cannot unlock an in-flight exchange');
    render(women, men);
    completions[0]({ finished: true });
    assert.equal(switches, 0, 'old data cannot switch the newly rendered pair');
    let tree = render(women, men);
    const offset = tree.props.children[1].props.children.props.style.transform[0].translateY;
    exchange(tree);
    completions[1]({ finished: true });
    assert.equal(switches, 1);
    assert.equal(offset.value, 0, 'completion settles the offset even if the parent does not change IDs');
    exchange(tree);
    completions[2]({ finished: false });
    exchange(tree);
    assert.equal(completions.length, 4, 'interrupted exchanges must not lock the deck');
    render(women, null);
    completions[3]({ finished: true });
    assert.equal(switches, 1, 'removing the alternative cancels its pending exchange');
    tree = render();
    exchange(tree);
    cleanup();
    completions[4]({ finished: true });
    assert.equal(switches, 1, 'unmount cancels callbacks before they update the map');
    assert(drivers.length >= 5);
    assert(drivers.every(driver => driver === false), 'gestures, animations and resets must use the same JS driver on iOS');
});

test('every catalogued female identity has a validated local crest, with distinct Levante clubs', () => {
    const file = path.join(__dirname, '../app/src/data/womenTeamCrests.ts');
    const module = { exports: {} };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, {
        module, exports: module.exports,
        require: name => name.endsWith('.json') ? require(path.resolve(path.dirname(file), name)) : name,
    });
    const lookup = module.exports.getWomenTeamCrest;
    const manifest = require('../app/src/data/womenTeamCrests.json');
    const calendarNames = [
        'Alavés', 'Alhama', 'Arsenal', 'Athletic Club', 'Atlético Madrid', 'Avaldsnes IL',
        'Badalona', 'Barcelona', 'Bayern Munchen Frauen', 'Bayern Munich', 'Benfica', 'Brann',
        'Chelsea', 'Deportivo Alavés', 'Deportivo de La Coruña', 'Eintracht Frankfurt Frauen',
        'Espanyol', 'FC Badalona', 'FC Barcelona', 'FC Bayern München Ladies', 'Granada',
        'Granadilla Tenerife', 'Hammarby', 'Køge', 'Levante', 'Levante Las Planas', 'Logroño',
        'Madrid', 'Manchester City', 'OH Leuven', 'Olympique Lyon', 'Paris FC', 'Rayo Vallecano',
        'Real Betis', 'Real Madrid', 'Real Sociedad', 'Roma', 'Rosengård', 'SD Eibar',
        'Servette Chênois', 'Sevilla FC', 'Sporting de Huelva', 'St. Pölten', 'Valencia',
        'VFL Wolfsburg Frauen', 'Villarreal',
    ];
    for (const name of calendarNames) assert(lookup(name), `Missing calendar team ${name}`);
    for (const team of manifest) {
        for (const alias of team.names) assert(lookup(alias), `Missing alias ${alias}`);
        const bytes = fs.readFileSync(path.resolve(path.dirname(file), lookup(team.names[0])));
        assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
        assert(bytes.readUInt32BE(16) >= 16 && bytes.readUInt32BE(20) >= 16);
    }
    assert(lookup('Køge Women'));
    assert(lookup('FC Bayern München Ladies'));
    assert.notEqual(lookup('Levante'), lookup('Levante Las Planas'));
    assert.equal(lookup('Unknown FC'), undefined);
});

test('unknown crests leave empty slots and known crests render directly without initials', () => {
    const Card = loadCard();
    const html = renderToStaticMarkup(React.createElement(Card, { match: { id: 'unknown', homeTeam: 'Queens Park', awayTeam: { name: 'Unknown Club', badge: 'https://example.test/broken.png' }, date: new Date('2030-10-10') } }));
    assert(!html.includes('>QP</span>'));
    assert(!html.includes('>UC</span>'));
    assert(!html.includes('Equip: Queens Park'));
    assert(!html.includes('Equip: Unknown Club'));
    assert(html.includes('alt="Escut de Unknown Club"'));
    assert(!html.includes('alt="Escut de Queens Park"'));
});

test('crests are immediately visible, hide after failure and recover when their source changes', () => {
    const source = fs.readFileSync(path.join(__dirname, '../app/src/components/MatchCard.tsx'), 'utf8');
    const ast = ts.createSourceFile('MatchCard.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === 'TeamCrest');
    let failedSource;
    const warnings = [];
    const crest = vm.runInNewContext(ts.transpileModule(`(${fn.getText(ast)})`, {
        compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
    }).outputText, {
        React, View: 'div', Image: 'img', console: { warn: (...args) => warnings.push(args) },
        useState: () => [failedSource, value => { failedSource = value; }],
    });
    const props = { name: 'Barcelona', uri: 'https://example.test/crest.png', size: 38 };
    const image = crest(props).props.children;
    assert.equal(image.type, 'img');
    assert.notEqual(image.props.style.opacity, 0);
    assert.equal(image.props.transition, 0);
    assert.equal(image.props.cachePolicy, 'memory-disk');
    image.props.onError();
    assert.equal(warnings.length, 1);
    assert.equal(crest(props).props.children, false);
    assert.equal(crest({ ...props, uri: 'https://example.test/replacement.png' }).props.children.type, 'img');
    assert.equal(crest({ name: 'Unknown', size: 38 }).props.children, false);
    assert.equal(crest({ ...props, localSource: 42 }).props.children.props.source, 42);
});