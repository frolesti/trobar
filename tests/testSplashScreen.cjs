const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(require.resolve('../app/src/components/SplashScreen.tsx'), 'utf8');

function harness(platform) {
  const states = [], effects = [], pending = [], errors = [], refs = [];
  let stateIndex = 0, effectIndex = 0, refIndex = 0;
  const module = { exports: {} };
  const react = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState(initial) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = initial;
      return [states[index], value => { states[index] = value; }];
    },
    useRef(initial) {
      const index = refIndex++;
      if (!refs[index]) refs[index] = { current: initial };
      return refs[index];
    },
    useEffect(callback, deps) {
      const index = effectIndex++;
      if (!effects[index] || deps.some((value, i) => effects[index][i] !== value)) pending.push(callback);
      effects[index] = deps;
    },
  };
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText, { exports: module.exports, console: { error: (...args) => errors.push(args) },
    require(name) {
      if (name === 'react') return react;
      if (name === 'react-native') return { View: 'NativeView', Text: 'NativeText', Platform: { OS: platform } };
      if (name === 'expo-image') return { Image: 'CachedImage' };
      if (name.endsWith('editorialTheme')) return { EDITORIAL: { background: '#7a0033' } };
      if (name.endsWith('.gif')) return 'logo.gif';
      if (name.endsWith('.png')) return 'fallback.png';
      throw new Error(name);
    },
  });
  return {
    errors,
    render(props = { visible: true, fontReady: true }) {
      stateIndex = effectIndex = refIndex = 0;
      const tree = module.exports.default(props);
      pending.splice(0).forEach(effect => effect());
      return tree;
    },
  };
}
function nodes(tree, type) {
  const found = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === type) found.push(node);
    (node.children || []).flat(Infinity).forEach(visit);
  }
  visit(tree);
  return found;
}

test('web splash is viewport-fixed and never shows the wordmark before the image is displayed', () => {
  const app = harness('web');
  let tree = app.render();
  assert.equal(tree.type, 'div');
  assert.equal(tree.props.style.position, 'fixed');
  assert.equal(tree.props.style.inset, 0);
  assert.equal(nodes(tree, 'div').filter(node => node.props.dangerouslySetInnerHTML).length, 0);
  const image = nodes(tree, 'CachedImage')[0];
  assert.equal(image.props.source, 'logo.gif');
  assert.equal(image.props.cachePolicy, 'memory-disk');
  assert.equal(image.props.transition, 0);
  assert.equal(image.props.autoplay, true);
  image.props.onDisplay();
  tree = app.render();
  assert.equal(nodes(tree, 'div').filter(node => node.props.dangerouslySetInnerHTML).length, 1);
});

test('native branding waits for both fonts and actual GIF display, on every appearance', () => {
  for (const platform of ['ios', 'android']) {
    const app = harness(platform);
    let tree = app.render({ visible: true, fontReady: false });
    assert.equal(tree.type, 'NativeView');
    assert.equal(tree.props.style.position, 'absolute');
    assert.equal(nodes(tree, 'NativeText').length, 0);
    nodes(tree, 'CachedImage')[0].props.onDisplay();
    assert.equal(nodes(app.render({ visible: true, fontReady: false }), 'NativeText').length, 0);
    assert.equal(nodes(app.render(), 'NativeText').length, 6);
    const previousDisplay = nodes(app.render(), 'CachedImage')[0].props.onDisplay;
    assert.equal(app.render({ visible: false }), null);
    previousDisplay();
    assert.equal(nodes(app.render(), 'NativeText').length, 0, 'a previous display event must not expose title-only branding on the next appearance');
  }
});

test('GIF failure is logged and a bundled fallback must display before the wordmark can appear', () => {
  const app = harness('android');
  const failedImage = nodes(app.render(), 'CachedImage')[0];
  failedImage.props.onError({ error: 'decode failed' });
  failedImage.props.onDisplay();
  let tree = app.render();
  assert.equal(app.errors.length, 1);
  assert.equal(nodes(tree, 'NativeText').length, 0);
  assert.equal(nodes(tree, 'CachedImage')[0].props.source, 'fallback.png');
  nodes(tree, 'CachedImage')[0].props.onDisplay();
  assert.equal(nodes(app.render(), 'NativeText').length, 6);
});

test('bootstrap retains one global splash through font loading and static HTML never reveals a title before its GIF', () => {
  const app = fs.readFileSync(require.resolve('../App.tsx'), 'utf8');
  const html = fs.readFileSync(require.resolve('../public/index.html'), 'utf8');
  assert(app.includes('<GlobalSplash fontReady={fontsLoaded} assetsReady={iconsReady} />'));
  assert(app.includes('{appReady && <AppNavigator />}'));
  assert(app.includes('const appReady = fontsLoaded && iconsReady'));
  assert(!app.includes('return <SplashScreen'));
  assert(app.includes('CachedImage.prefetch'));
  assert(html.includes('visibility: hidden'));
  assert(html.includes('data-logo-ready="true"'));
  assert(html.includes("dataset.logoReady='true'"));
  assert(!html.includes('setTimeout(removeSplashStatic'));
});

test('native prefetch does not call the unsupported native asset resolver on web', () => {
  const source = fs.readFileSync(require.resolve('../App.tsx'), 'utf8');
  const ast = ts.createSourceFile('App.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let prefetch;
  const visit = node => {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'React.useEffect'
      && node.getText(ast).includes('CachedImage.prefetch')) prefetch = node.arguments[0].getText(ast);
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert(prefetch);
  let requested;
  const context = {
    Platform: { OS: 'web' }, NativeImage: {}, SPLASH_GIF: 1,
    CachedImage: { prefetch: uri => { requested = uri; return Promise.resolve(true); } }, console,
  };
  vm.runInNewContext(ts.transpileModule(`globalThis.prefetch = ${prefetch};`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, context);
  context.prefetch();
  assert.equal(requested, undefined);
  context.Platform.OS = 'android';
  context.NativeImage.resolveAssetSource = () => ({ uri: 'asset://logo.gif' });
  context.prefetch();
  assert.equal(requested, 'asset://logo.gif');
});
