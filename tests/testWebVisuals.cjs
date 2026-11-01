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
    module, exports: module.exports,
    require: name => name.startsWith('.') ? loadSource(path.resolve(path.dirname(filename), `${name}.tsx`)) : webRequire(name),
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
  assert.doesNotMatch(app, /split-grid--reverse/);
  assert.match(community, /class="split-grid split-grid--reverse"/);
  for (const section of [app, community]) {
    assert(section.indexOf('class="split-media"') < section.indexOf('class="split-copy"'));
  }
  const css = fs.readFileSync(path.join(webRoot, 'styles', 'globals.css'), 'utf8');
  assert.match(css, /\.split-grid--reverse \.split-media \{ grid-column: 2; grid-row: 1; \}/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*?\.split-grid--reverse \.split-media \{ grid-column: 1; grid-row: 1; \}/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*?\.split-grid--reverse \.split-copy \{ grid-column: 1; grid-row: 2; \}/);
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
  assert.match(html, /class="site-header-wordmark"[^>]*>troBar</);
  assert.match(html, /src="\/assets\/logos\/logo-red\.png"/);
  assert.match(html, /transform:scale\(1\)/);
  assert.match(html, /width="40" height="40"/);
  assert.doesNotMatch(html, /scale\(1\.42\)/);
});

test('feature headings inherit readable typography rather than forcing heavy Oi lettering', () => {
  const Features = loadComponent('Features').default;
  const html = renderToStaticMarkup(webRequire('react').createElement(Features));
  assert.equal((html.match(/<h3\b/g) || []).length, 4);
  assert.doesNotMatch(html, /font-display|font-weight:700/);
  const css = fs.readFileSync(path.join(webRoot, 'styles', 'globals.css'), 'utf8');
  assert.match(css, /h1, h2, h3, h4\s*\{[^}]*font-family:\s*var\(--font-body\)/);
  assert.match(css, /\.background-video\s*\{[^}]*position:\s*absolute;[^}]*object-fit:\s*cover;/);
});
