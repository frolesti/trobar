const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function loadCard(component = 'MatchCard', react = React, clock = Date) {
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
            if (name === 'react-native') return { View: container, TouchableOpacity: container, Platform: { OS: 'web' }, PanResponder: { create: handlers => ({ panHandlers: handlers }) }, StyleSheet: { create: value => value }, Animated: { View: container, Value: class { setValue() {} stopAnimation() {} interpolate() { return 0; } }, timing: () => ({ start: callback => callback?.({ finished: true }), stop() {} }) } };
            if (name === 'expo-image') return { Image: props => React.createElement('img', { alt: props.accessibilityLabel, 'data-tint': props.tintColor }) };
            if (name === '@expo/vector-icons') return { Feather: () => null };
            if (name === './AppText') return { default: text, __esModule: true };
            if (name === './MatchCard') return { default: loadCard(), __esModule: true };
            if (name.includes('editorialTheme')) return { EDITORIAL: { masculine: '#8C003B', feminine: '#AD2857' } };
            if (name.includes('teamName')) return { formatTeamNameForDisplay: value => value };
            if (name.includes('womenTeamCrests')) return { getWomenTeamCrest: () => undefined };
            if (name.endsWith('.png')) return name;
            throw new Error(`Unexpected import: ${name}`);
        },
    });
    return moduleStub.exports.default;
}

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
    assert(html.includes('Final'));
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
    assert(html.indexOf('2030') < html.indexOf('Barcelona'));
    assert.equal((html.match(/alt="La Liga"/g) || []).length, 1);
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
    assert(women.includes('aria-label="Barça femení"'));
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
    assert(html.includes('Al darrere: Barcelona - Chelsea, femení'));
    assert(html.indexOf('Barcelona - Chelsea') < html.indexOf('>Getafe<'));
    assert(html.includes('data-background="#AD2857"'));
    assert(html.includes('data-background="#8C003B"'));
    assert(!html.includes('Trobar bars'));
    const single = renderToStaticMarkup(React.createElement(Stack, { match, alternativeMatch: null, onToggleFilter: () => {} }));
    assert(!single.includes('Mostrar Barcelona - Chelsea'));
    let now = 1000;
    class Clock extends Date { static now() { return now; } }
    const hooks = { ...React, useMemo: factory => factory(), useRef: value => ({ current: value }), useState: value => [value, () => {}], useEffect() {} };
    const SwipeStack = loadCard('MatchCardStack', hooks, Clock);
    let switches = 0;
    let filters = 0;
    const tree = SwipeStack({ match, alternativeMatch, onSwitchMatch: () => switches++, onToggleFilter: () => filters++ });
    const backCard = tree.props.children[1];
    assert.equal(backCard.props['aria-hidden'], true);
    assert.equal(backCard.props.children.props.match.id, 'women');
    const frontCard = tree.props.children[2].props.children;
    const gesture = tree.props;
    const move = (dx, dy = 0, numberActiveTouches = 1) => ({ dx, dy, numberActiveTouches, vx: 0 });
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

test('unknown and loading crests retain a visible named fallback rather than an empty slot', () => {
    const Card = loadCard();
    const html = renderToStaticMarkup(React.createElement(Card, { match: { id: 'unknown', homeTeam: 'Queens Park', awayTeam: { name: 'Unknown Club', badge: 'https://example.test/broken.png' }, date: new Date('2030-10-10') } }));
    assert(html.includes('>QP</span>'));
    assert(html.includes('>UC</span>'));
    assert(html.includes('Equip: Queens Park'));
    assert(html.includes('Equip: Unknown Club'));
});