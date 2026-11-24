const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const ts = require('typescript');

const webRoot = path.resolve(__dirname, '../web-app');
const webRequire = createRequire(path.join(webRoot, 'package.json'));
const { renderToStaticMarkup } = webRequire('react-dom/server');

test('direct Next builds materialize deployment assets without npm lifecycle hooks', () => {
  let synchronized = false;
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(webRoot, 'next.config.js'), 'utf8'), {
    module, __dirname: webRoot, process: { env: {} },
    require: name => {
      if (name === './scripts/sync-shared-assets.js') { synchronized = true; return {}; }
      if (name === 'dotenv') return { config() {} };
      return require(name);
    },
  });
  assert.equal(synchronized, true);
});

function loadComponent(name) {
  const filename = path.join(webRoot, 'components', `${name}.tsx`);
  return loadSource(filename);
}

function loadSource(filename) {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  const module = { exports: {} };
  vm.runInNewContext(outputText, {
    module, exports: module.exports, process: { env: {} },
    require: name => {
      if (!name.startsWith('.')) return webRequire(name);
      const resolved = path.resolve(path.dirname(filename), name);
      if (name.endsWith('.module.css')) {
        const css = fs.readFileSync(resolved, 'utf8');
        return Object.fromEntries([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map(([, key]) => [key, key]));
      }
      return name.endsWith('.json') ? JSON.parse(fs.readFileSync(resolved, 'utf8')) : loadSource(`${resolved}.tsx`);
    },
    console,
  });

  return module.exports;
}

test('home alternates media columns on desktop while preserving media-first stacking on mobile', () => {
  const Home = loadSource(path.join(webRoot, 'pages', 'index.tsx')).default;
  const root = Home();
  const main = root.props.children.find(child => child?.type === 'main');
  const html = renderToStaticMarkup(main);
  const app = html.match(/<section id="app"[\s\S]*?<\/section>/)[0];
  const community = html.match(/<section id="comunitat"[\s\S]*?<\/section>/)[0];
  assert(app.indexOf('class="media"') < app.indexOf('class="copy"'));
  assert(community.indexOf('class="copy"') < community.indexOf('class="media"'));
  assert.deepEqual([...html.matchAll(/<section id="([^"]+)"/g)].map(([, id]) => id), [
    'intro', 'qui-som', 'app', 'comunitat', 'com-funciona', 'descarrega', 'per-a-bars',
  ]);
  const css = fs.readFileSync(path.join(webRoot, 'styles', 'Home.module.css'), 'utf8');
  assert.match(css, /\.split \{[^}]*grid-template-columns: 1fr 1fr/);
  assert.match(css, /@media \(max-width: 600px\)[\s\S]*?\.split \{ grid-template-columns: 1fr/);
  assert.match(css, /\.community \.media \{ grid-row: 1; \}/);
});

test('all background videos keep playback attributes and a real poster when playback is unavailable', () => {
  const Video = loadComponent('BackgroundVideo').default;
  for (const name of ['canopy', 'glasses-beer', 'community']) {
    const element = Video({ name });
    const props = element.props;
    assert.equal(props.src, `/assets/videos/${name}.mp4`);
    assert.equal(props.poster, `/assets/img/${name}-poster.jpg`);
    for (const attribute of ['autoPlay', 'muted', 'loop', 'playsInline']) assert.equal(props[attribute], true);
    assert.equal(props.preload, 'metadata');
    assert.equal(props['aria-hidden'], 'true');
    assert.equal(typeof props.onError, 'function');
    const poster = fs.readFileSync(path.join(webRoot, '..', 'assets', 'web', 'img', `${name}-poster.jpg`));
    assert.equal(poster.readUInt16BE(0), 0xffd8, 'poster must be a JPEG, not an HTML error page');
    assert.match(renderToStaticMarkup(element), /class="background-video"/);
  }
});

test('header displays the full official icon and a readable wordmark, without the old magnified crop', () => {
  const Header = loadComponent('Header').default;
  const html = renderToStaticMarkup(webRequire('react').createElement(Header));
  assert.match(html, /aria-label="troBar — inici"/);
  assert.match(html, /class="site-header-lockup"/);
  assert.match(html, /src="\/assets\/logos\/wordmark-grana\.svg"/);
  assert.match(html, /src="\/assets\/logos\/mascot-ball-grana\.png"/);
  assert.match(html, /transform:scale\(1\)/);
  assert.match(html, /width="40" height="40"/);
  assert.doesNotMatch(html, /scale\(1\.42\)/);
});

test('pricing keeps common benefits and signup outside the changing price panel', () => {
  const Pricing = loadComponent('Pricing').default;
  const html = renderToStaticMarkup(webRequire('react').createElement(Pricing));
  const cardStart = html.indexOf('class="pricing-card"');
  const includedStart = html.indexOf('class="pricing-included"');
  assert(cardStart >= 0 && includedStart > cardStart);
  const card = html.slice(cardStart, includedStart);
  assert.doesNotMatch(card, /pricing-features|Prova 14 dies gratis|registra-bar/);
  assert.match(card, /aria-live="polite"/);
  assert.equal((html.match(/class="pricing-features"/g) || []).length, 1);
  assert.match(html.slice(includedStart), /href="\/registra-bar\?billing=quarterly"/);
});

test('hero preserves the animated logo and provides its static fallback for reduced motion', () => {
  const Hero = loadComponent('Hero').default;
  const html = renderToStaticMarkup(webRequire('react').createElement(Hero));
  assert.match(html, /<picture class="heroLogo">/);
  assert.match(html, /<source media="\(prefers-reduced-motion: reduce\)" srcSet="\/assets\/logos\/mascot-ball-cream.png"/);
  assert.match(html, /<img src="\/assets\/gif\/trobar.gif"/);
  for (const file of ['mascot-ball-cream.png', 'mascot-ball-grana.png']) {
    const png = fs.readFileSync(path.join(webRoot, '..', 'assets', 'web', 'logos', file));
    assert.equal(png.readUInt32BE(12), 0x49484452);
    assert(png.readUInt32BE(20) > png.readUInt32BE(16));
  }
});

test('simplified landing has no broken feature navigation and retains rounded accessible actions', () => {
  const Home = loadSource(path.join(webRoot, 'pages', 'index.tsx')).default;
  const main = Home().props.children.find(child => child?.type === 'main');
  assert.doesNotMatch(renderToStaticMarkup(main), /caracteristiques|Per què troBar|Tot el que/);
  const Header = loadComponent('Header').default;
  assert.doesNotMatch(renderToStaticMarkup(webRequire('react').createElement(Header)), /#caracteristiques|>Funcions</);
  const PerABars = loadSource(path.join(webRoot, 'pages', 'per-a-bars.tsx')).default;
  assert.doesNotMatch(renderToStaticMarkup(webRequire('react').createElement(PerABars)), /per-a-bars-benefits|Tot per fer créixer/);
  const css = fs.readFileSync(path.join(webRoot, 'styles', 'globals.css'), 'utf8');
  assert.match(css, /\.btn, \.btn-slab, \.btn-ghost\s*\{[^}]*border-radius: 999px;[^}]*min-height: 44px;/);
});

test('web headings share the corporate Lora typography and light palette', () => {
  const Features = loadComponent('Features').default;
  const html = renderToStaticMarkup(webRequire('react').createElement(Features));
  assert.equal((html.match(/<h3\b/g) || []).length, 4);
  assert.doesNotMatch(html, /font-display|font-weight:700/);
  const css = fs.readFileSync(path.join(webRoot, 'styles', 'globals.css'), 'utf8');
  const homeCss = fs.readFileSync(path.join(webRoot, 'styles', 'Home.module.css'), 'utf8');
  assert.match(homeCss, /\.home h1, \.home h2, \.home h3\s*\{[^}]*font-family:\s*var\(--font-heading\)/);
  assert.match(css, /body\s*\{[^}]*background:\s*var\(--brand-cream\)/);
  assert.match(css, /--font-heading: 'Lora', Georgia/);
  const app = fs.readFileSync(path.join(webRoot, 'pages', '_app.tsx'), 'utf8');
  assert.match(app, /brand\/palette\.json/);
  assert.match(app, /app\/src\/theme\/brandColors\.json/);
  assert.match(css, /\.background-video\s*\{[^}]*position:\s*absolute;[^}]*object-fit:\s*cover;/);
});
