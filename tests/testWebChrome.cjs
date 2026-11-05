const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function footerHarness() {
  let state = null;
  const module = { exports: {} };
  const jsx = (type, props) => ({ type, props });
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../web-app/components/Footer.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    module, exports: module.exports,
    require: name => {
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'react') return { useState: () => [state, update => { state = update(state); }] };
      if (name === 'next/link') return { default: 'a' };
      if (name.endsWith('/contactEmails.json')) return { default: require('../app/src/data/contactEmails.json') };
      throw new Error(name);
    },
  });
  const nodes = (tree, predicate) => {
    if (!tree || typeof tree !== 'object') return [];
    if (Array.isArray(tree)) return tree.flatMap(node => nodes(node, predicate));
    return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
  };
  return predicate => nodes(module.exports.default(), predicate);
}

test('mobile footer sections open and close with a normal click and expose accessible state', () => {
  const elements = footerHarness();
  for (const section of ['producte', 'contacte', 'legal']) {
    const id = `footer-${section}-links`;
    const button = () => elements(node => node.props?.['aria-controls'] === id)[0];
    const panel = () => elements(node => node.props?.id === id)[0];
    assert.equal(button().props['aria-expanded'], false);
    assert.equal(panel().props.hidden, true);
    assert.equal(button().props.onTouchStart, undefined);
    assert.equal(button().props.onMouseDown, undefined);
    button().props.onClick();
    assert.equal(button().props['aria-expanded'], true);
    assert.equal(panel().props.hidden, false);
    assert.ok(elements(node => node.type === 'ul' && node.props.hidden === false).length === 1);
    button().props.onClick();
    assert.equal(button().props['aria-expanded'], false);
    assert.equal(panel().props.hidden, true);
  }
  const source = fs.readFileSync(require.resolve('../web-app/components/Footer.tsx'), 'utf8');
  assert.doesNotMatch(source, /Mantén premut|setTimeout|onTouchStart|onMouseDown/);
});

test('opening a footer section closes the previous one', () => {
  const elements = footerHarness();
  const button = id => elements(node => node.props?.['aria-controls'] === id)[0];
  button('footer-producte-links').props.onClick();
  button('footer-legal-links').props.onClick();
  assert.equal(button('footer-producte-links').props['aria-expanded'], false);
  assert.equal(button('footer-legal-links').props['aria-expanded'], true);
});

test('official favicon variants are concrete deployable images with the advertised sizes', () => {
  require('../web-app/scripts/sync-shared-assets.js');
  const publicDir = path.resolve(__dirname, '..', 'web-app', 'public');
  const icon = fs.readFileSync(path.join(publicDir, 'favicon.ico'));
  assert.equal(icon.readUInt16LE(0), 0);
  assert.equal(icon.readUInt16LE(2), 1);
  assert.equal(icon.readUInt16LE(4), 3);
  for (const [index, size] of [16, 32, 48].entries()) {
    const entry = 6 + index * 16;
    assert.equal(icon[entry], size);
    assert.equal(icon[entry + 1], size);
    const image = icon.subarray(icon.readUInt32LE(entry + 12), icon.readUInt32LE(entry + 12) + icon.readUInt32LE(entry + 8));
    assert.equal(image.readUInt32BE(16), size);
    assert.equal(image.readUInt32BE(20), size);
  }
  for (const [file, size] of [['favicon-32.png', 32], ['apple-touch-icon.png', 180]]) {
    const png = fs.readFileSync(path.join(publicDir, 'assets', 'logos', file));
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
  const document = fs.readFileSync(require.resolve('../web-app/pages/_document.tsx'), 'utf8');
  assert.match(document, /href="\/favicon\.ico\?v=1"/);
  assert.match(document, /sizes="32x32" href="\/assets\/logos\/favicon-32\.png"/);
  assert.match(document, /sizes="180x180" href="\/assets\/logos\/apple-touch-icon\.png"/);
});

test('download badges never link to generic stores and explain when the app is not published', () => {
  const render = env => {
    const module = { exports: {} };
    const jsx = (type, props) => ({ type, props });
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../web-app/components/StoreBadges.tsx'), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText, { module, exports: module.exports, process: { env },
      require: name => {
        assert.equal(name, 'react/jsx-runtime');
        return { jsx, jsxs: jsx };
      },
    });
    return JSON.stringify(module.exports.default({ center: true }));
  };
  assert.match(render({}), /encara no està publicada/);
  assert.doesNotMatch(render({}), /"href"/);
  const appStore = 'https://apps.apple.com/app/id0000000000';
  const googlePlay = 'https://play.google.com/store/apps/details?id=example.test.trobar';
  const configured = render({ NEXT_PUBLIC_APP_STORE_URL: appStore, NEXT_PUBLIC_GOOGLE_PLAY_URL: googlePlay });
  assert.ok(configured.includes(appStore));
  assert.ok(configured.includes(googlePlay));
  assert.doesNotMatch(configured, /encara no està publicada/);
});

test('registration hides the marketing hero on confirmation and keeps it for editable steps', () => {
  const render = (step, checkout) => {
    const module = { exports: {} };
    const jsx = (type, props) => ({ type, props });
    let cursor = 0;
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../web-app/pages/registra-bar.tsx'), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText, { module, exports: module.exports,
      require: name => {
        if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
        if (name === 'react') return { useState: initial => [cursor++ === 1 ? step : initial, () => {}] };
        if (name === 'next/router') return { useRouter: () => ({ query: { checkout } }) };
        return { default: name };
      },
    });
    return JSON.stringify(module.exports.default());
  };
  assert.match(render(5), /"className":"register-hero"/);
  for (const [step, checkout] of [[6, undefined], [1, 'success']]) {
    assert.doesNotMatch(render(step, checkout), /"className":"register-hero"/);
    assert.match(render(step, checkout), /register-page--confirmation/);
  }
});
