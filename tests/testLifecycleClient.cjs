const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function compile(filename, requireMock, globals = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve(filename), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, { module, exports: module.exports, require: requireMock, ...globals });
  return module.exports;
}
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree?.props ? [tree, ...nodes(tree.props.children)] : [];
const text = tree => Array.isArray(tree) ? tree.map(text).join('') : tree?.props ? text(tree.props.children) : typeof tree === 'string' ? tree : '';

test('first-login client sends no UID or recipient and rejects an unconfirmed server response', async () => {
  const calls = [];
  let status = 'queued';
  const { recordFirstAppLogin } = compile('../app/src/services/emailService.ts', name => {
    if (name.includes('config/firebase')) return { functions: 'functions' };
    if (name === 'firebase/functions') return { httpsCallable: (instance, method) => async (...args) => {
      calls.push({ instance, method, args }); return { data: { status } };
    } };
    throw new Error(name);
  });
  for (const value of ['queued', 'suppressed', 'unverified', 'not-new']) { status = value; await recordFirstAppLogin(); }
  assert.ok(calls.every(call => call.method === 'recordFirstLogin' && call.args.length === 0));
  status = 'unexpected';
  await assert.rejects(recordFirstAppLogin());
});

function portalHarness(account = null, url = 'https://billing.stripe.com/p/session/example') {
  const slots = [], calls = [], errors = [];
  let cursor = 0, effect = false, listener;
  const Page = compile('../web-app/pages/subscripcio.tsx', name => {
    if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
    if (name === 'react') return {
      useState: initial => { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = value; }]; },
      useEffect: callback => { if (!effect) { effect = true; callback(); } },
    };
    if (name === 'firebase/auth') return {
      onAuthStateChanged: (auth, callback) => { listener = callback; callback(account); return () => {}; },
      signInWithEmailAndPassword: async (auth, email) => { calls.push(['login', email]); listener({ email }); },
      signOut: async () => { calls.push(['logout']); listener(null); },
    };
    if (name === 'firebase/functions') return { httpsCallable: (instance, method) => async (...args) => {
      calls.push([method, ...args]); return { data: { url } };
    } };
    if (name === '../lib/firebase') return { auth: {}, functions: {} };
    if (name.endsWith('contactEmails.json')) return require('../app/src/data/contactEmails.json');
    return { __esModule: true, default: name };
  }, { URL, window: { location: { assign: value => calls.push(['redirect', value]) } }, console: { error: (...args) => errors.push(args) } }).default;
  const render = () => { cursor = 0; Page(); cursor = 0; return Page(); };
  return { calls, errors, render, find: predicate => nodes(render()).find(predicate) };
}

test('the permanent management page signs in and requests a fresh authenticated portal without URL/customer arguments', async () => {
  const h = portalHarness();
  for (const [type, value] of [['email', ' owner@example.test '], ['password', 'fixture-password']]) {
    h.find(node => node.type === 'input' && node.props.type === type).props.onChange({ target: { value } });
  }
  await h.find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.deepEqual(h.calls, [
    ['login', 'owner@example.test'], ['createBillingPortalSession'], ['redirect', 'https://billing.stripe.com/p/session/example'],
  ]);
});

test('portal responses cannot redirect to another origin and an existing wrong account can be changed', async () => {
  const h = portalHarness({ email: 'owner@example.test' }, 'https://evil.invalid/phish');
  await h.find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.ok(!h.calls.some(call => call[0] === 'redirect'));
  assert.ok(h.find(node => node.props.role === 'alert'));
  assert.equal(h.errors.length, 1);
  await h.find(node => node.type === 'button' && text(node) === 'Canviar de compte').props.onClick();
  assert.ok(h.find(node => node.type === 'input' && node.props.type === 'email'));
  assert.ok(h.calls.some(call => call[0] === 'logout'));
});
