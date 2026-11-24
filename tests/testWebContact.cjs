const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function contactHarness(options = {}) {
  const slots = [], calls = [];
  let cursor = 0, sequence = 0;
  const module = { exports: {} };
  const jsx = (type, props) => ({ type, props });
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../web-app/pages/contacte.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, {
    module, exports: module.exports, console: { error() {} },
    crypto: { randomUUID: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}` },
    requestAnimationFrame: callback => callback(),
    require(name) {
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'react') return {
        useState: initial => { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = value; }]; },
        useRef: initial => { const i = cursor++; if (!(i in slots)) slots[i] = { current: initial }; return slots[i]; },
      };
      if (name === 'firebase/functions') return { httpsCallable: (_client, method) => async payload => {
        calls.push({ method, payload });
        if (options.wait) await options.wait;
        if (options.error) throw { code: options.error };
        return { data: { id: options.wrongReceipt ? 'wrong' : payload.requestId } };
      } };
      if (name === '../lib/firebase') return { functions: {} };
      if (name.endsWith('contactEmails.json')) return require('../app/src/data/contactEmails.json');
      if (name.endsWith('.css')) return { __esModule: true, default: {} };
      return { __esModule: true, default: name };
    },
  });
  const render = () => { cursor = 0; return module.exports.default(); };
  const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree)
    ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
  render();
  slots[0] = { name: 'Bar de prova', email: 'consulta@example.test', kind: 'general',
    message: 'Necessito ajuda amb el registre del bar.', consent: true, website: '' };
  return {
    calls, options, slots,
    elements: () => nodes(render()),
    submit: () => nodes(render()).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }),
  };
}

test('contact only confirms the matching backend receipt, and blocks double submissions while sending', async () => {
  let release;
  const h = contactHarness({ wait: new Promise(resolve => { release = resolve; }) });
  const pending = h.submit();
  await h.submit();
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].method, 'submitWebContact');
  assert.equal(h.elements().find(node => node.type === 'form').props['aria-busy'], true);
  assert.equal(h.elements().some(node => node.type === 'h2' && node.props.children === 'Missatge enviat'), false);
  release();
  await pending;
  assert.equal(h.elements().some(node => node.type === 'h2' && node.props.children === 'Missatge enviat'), true);
});

test('failed and mismatched confirmations preserve the form; unchanged retries reuse their reference', async () => {
  const h = contactHarness({ error: 'functions/unavailable' });
  await h.submit();
  assert.equal(h.elements().some(node => node.props?.role === 'alert'), true);
  assert.equal(h.slots[0].message, 'Necessito ajuda amb el registre del bar.');
  await h.submit();
  assert.equal(h.calls[0].payload.requestId, h.calls[1].payload.requestId);
  h.slots[0] = { ...h.slots[0], message: 'Una altra consulta sobre el meu bar.' };
  await h.submit();
  assert.notEqual(h.calls[1].payload.requestId, h.calls[2].payload.requestId);
  h.options.error = null;
  h.options.wrongReceipt = true;
  await h.submit();
  assert.equal(h.elements().some(node => node.type === 'h2' && node.props.children === 'Missatge enviat'), false);
  h.options.wrongReceipt = false;
  await h.submit();
  assert.equal(h.elements().some(node => node.type === 'h2' && node.props.children === 'Missatge enviat'), true);
});
