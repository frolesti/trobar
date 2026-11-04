const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { harness, request } = require('../functions/test/betaHarness.cjs');

function formHarness(options = {}) {
  const server = harness(options.server || {});
  const slots = [];
  const dependencies = [];
  const effects = [];
  const cleanups = [];
  const timeouts = new Map();
  let timeoutId = 0;
  const timers = [];
  const calls = [];
  let cursor, subscriber;
  const user = {
    uid: 'owner', email: 'owner@example.test', displayName: 'Propietari',
    emailVerified: options.verified !== false,
    reload: async () => { if (options.networkError) throw new Error('network'); },
    getIdToken: async refresh => { calls.push(['token', refresh]); return 'local-token'; },
    getIdTokenResult: async refresh => {
      calls.push(['claims', refresh]);
      return { claims: server.claims.at(-1)?.data || options.claims || {} };
    },
  };
  const auth = { currentUser: null };
  const jsx = (type, props) => ({ type, props });
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../web-app/components/ContactForm.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    module, exports: module.exports, URLSearchParams,
    window: { crypto: { randomUUID: () => '12345678-1234-4234-8234-123456789abc' },
      location: { search: '', origin: 'http://localhost:3000', assign: url => calls.push(['redirect', url]) } },
    setInterval: callback => { timers.push(callback); return 1; }, clearInterval() {},
    setTimeout: (callback, delay) => { timeouts.set(++timeoutId, { callback, delay }); return timeoutId; },
    clearTimeout: id => timeouts.delete(id),
    require: name => {
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      if (name === 'stdnum') return require('../web-app/node_modules/stdnum');
      if (name === 'react') return {
        useRef: initial => {
          const index = cursor++;
          if (!(index in slots)) slots[index] = { current: initial };
          return slots[index];
        },
        useState: initial => {
          const index = cursor++;
          if (!(index in slots)) slots[index] = initial;
          return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
        },
        useEffect: (callback, deps) => {
          const index = cursor++;
          if (!dependencies[index] || deps.some((dep, i) => dep !== dependencies[index][i])) {
            dependencies[index] = deps;
            effects.push(() => { cleanups[index]?.(); cleanups[index] = callback(); });
          }
        },
      };
      if (name === 'firebase/auth') return {
        onAuthStateChanged: (client, callback) => { subscriber = callback; return () => {}; },
        fetchSignInMethodsForEmail: async () => [],
        createUserWithEmailAndPassword: async () => {
          calls.push(['create']);
          if (options.duplicate) throw { code: 'auth/email-already-in-use' };
          auth.currentUser = user; return { user };
        },
        signInWithEmailAndPassword: async () => {
          calls.push(['login']);
          if (options.wrongPassword) throw { code: 'auth/invalid-credential' };
          auth.currentUser = user; return { user };
        },
        updateProfile: async () => {},
        sendEmailVerification: async () => { calls.push(['verification']); if (options.emailError) throw { code: 'auth/network-request-failed' }; },
      };
      if (name === 'firebase/firestore') return {
        doc: (db, collection, id) => `${collection}/${id}`,
        getDocFromServer: async key => ({ exists: () => server.documents.has(key), data: () => server.documents.get(key) }),
      };
      if (name === 'firebase/functions') return {
        httpsCallable: (client, operation) => async data => {
          calls.push([operation, data]);
          if (operation === 'searchRegistrationLocations' && options.search) return { data: await options.search(data) };
          if (operation === 'getSubscriptionStatus') return { data: { active: false } };
          if (options.fakeSuccess) return { data: { ok: true, barId: 'unpersisted' } };
          return { data: await server.api[operation](request(data)) };
        },
      };
      if (name === '../lib/firebase') return { auth, db: {}, functions: {} };
      if (name === './Logo') return { default: () => null };
      throw new Error(name);
    },
  });
  function render() {
    cursor = 0;
    const tree = module.exports.default({});
    while (effects.length) effects.shift()();
    return tree;
  }
  function nodes(tree, predicate) {
    if (!tree || typeof tree !== 'object') return [];
    if (Array.isArray(tree)) return tree.flatMap(node => nodes(node, predicate));
    return [...(predicate(tree) ? [tree] : []), ...nodes(tree.props?.children, predicate)];
  }
  render();
  return {
    server, user, slots, calls, options, render,
    elements: predicate => nodes(render(), predicate),
    debounce: async () => {
      for (const [id, timer] of [...timeouts]) {
        if (timer.delay !== 450) continue;
        timeouts.delete(id);
        await timer.callback();
      }
      await new Promise(resolve => setImmediate(resolve));
      render();
    },
    restore: async () => { auth.currentUser = user; await subscriber(user); },
    tick: async () => { await timers.at(-1)(); },
    prepare: (step, data = {}) => { slots[0] = step; slots[1] = user.email; slots[2] = { ...slots[2],
      contactName: user.displayName, password: 'Strong-test-password-123!', ...data }; },
    click: async handler => {
      const button = nodes(render(), node => node.type === 'button' && node.props.onClick?.name === handler)[0];
      assert.ok(button, handler);
      await button.props.onClick();
      render();
    },
    clickResult: async () => {
      const button = nodes(render(), node => node.type === 'button' && node.props.onClick?.toString().includes('handleSelectBar'))[0];
      assert.ok(button, 'location result');
      await button.props.onClick();
      render();
    },
    change: (placeholder, value) => {
      const input = nodes(render(), node => node.type === 'input' && node.props.placeholder === placeholder)[0];
      assert.ok(input, placeholder);
      input.props.onChange({ target: { value, type: 'text' } });
      render();
    },
    blur: placeholder => {
      nodes(render(), node => node.type === 'input' && node.props.placeholder === placeholder)[0].props.onBlur?.();
      render();
    },
    focus: placeholder => {
      nodes(render(), node => node.type === 'input' && node.props.placeholder === placeholder)[0].props.onFocus?.();
      render();
    },
    key: async (placeholder, key) => {
      const input = nodes(render(), node => node.type === 'input' && node.props.placeholder === placeholder)[0];
      input.props.onKeyDown({ key, preventDefault() {} });
      await new Promise(resolve => setImmediate(resolve));
      render();
    },
    text: () => {
      const collect = tree => typeof tree === 'string' ? tree : Array.isArray(tree) ? tree.map(collect).join(' ')
        : tree && typeof tree === 'object' ? collect(tree.props?.children) : '';
      return collect(render());
    },
  };
}

test('duplicate email resumes an existing verified account instead of blocking signup', async () => {
  const h = formHarness({ duplicate: true });
  h.prepare(1);
  await h.click('handleCreateAccount');
  assert.equal(h.slots[0], 3);
  assert.ok(h.calls.some(call => call[0] === 'login'));
  assert.equal(h.calls.filter(call => call[0] === 'verification').length, 0);
});

test('wrong password is visible and cannot advance duplicate signup', async () => {
  const h = formHarness({ duplicate: true, wrongPassword: true });
  h.prepare(1);
  await h.click('handleCreateAccount');
  assert.equal(h.slots[0], 1);
  assert.match(h.text(), /Contrasenya incorrecta/);
});

test('verification refreshes ID token; network and email-send failures preserve recovery', async () => {
  const h = formHarness({ verified: false, emailError: true });
  h.prepare(1);
  await h.click('handleCreateAccount');
  assert.equal(h.slots[0], 2);
  h.options.networkError = true;
  await h.tick();
  assert.match(h.text(), /Reintentarem/);
  h.options.networkError = false;
  h.user.emailVerified = true;
  await h.tick();
  assert.equal(h.slots[0], 3);
  assert.ok(h.calls.some(call => call[0] === 'token' && call[1] === true));
});

test('completed registration restores persisted owner session after reload; partial profile returns to repair', async () => {
  const documents = { 'barOwners/owner': { barId: 'bar', barName: 'Bar restaurat', billingCycle: 'annual' },
    'users/owner': { role: 'bar_owner', ownedBars: ['bar'] } };
  const h = formHarness({ claims: { role: 'bar_owner' }, server: { documents } });
  await h.restore();
  assert.equal(h.slots[0], 6);
  assert.equal(h.slots[2].billing, 'annual');
  h.server.documents.delete('users/owner');
  await h.restore();
  assert.equal(h.slots[0], 3);
});

test('signup success requires server profile, ownership and refreshed claims, not a success flag', async () => {
  const bar = { businessName: 'Bar Beta', address: 'Carrer 1', city: 'Barcelona', postalCode: '08001',
    nif: 'B12345674', contactName: 'Propietari', billing: 'quarterly', acceptTerms: true,
    location: { latitude: 41.38, longitude: 2.17 } };
  const h = formHarness();
  await h.restore();
  h.prepare(5, bar);
  await h.click('handleSubmit');
  assert.equal(h.slots[0], 6);
  assert.equal(h.server.documents.get('users/owner').ownedBars.length, 1);
  assert.equal('password' in h.calls.find(call => call[0] === 'registerBar')[1], false);
  const fake = formHarness({ fakeSuccess: true });
  await fake.restore();
  fake.prepare(5, bar);
  await fake.click('handleSubmit');
  assert.equal(fake.slots[0], 5);
  assert.match(fake.text(), /confirmar el perfil desat/);
});

test('invalid NIF is rejected before submit and cannot advance business details', async () => {
  const h = formHarness();
  await h.restore();
  h.prepare(4, { businessName: 'Bar de prova', address: 'Carrer 1', city: 'Barcelona', postalCode: '08001',
    nif: 'B12345678', location: { latitude: 41.38, longitude: 2.17 }, acceptTerms: true });
  await h.click('handleContinue');
  assert.equal(h.slots[0], 4);
  assert.match(h.text(), /dígit de control/);
  h.prepare(5);
  await h.click('handleSubmit');
  assert.equal(h.calls.some(call => call[0] === 'registerBar'), false);
});

const placeServer = () => ({ fetch: async url => ({ ok: true, json: async () => url.includes('autocomplete')
  ? { suggestions: [{ placePrediction: { placeId: 'ChIJlocal', text: { text: 'Bar Beta, Barcelona' } } }] }
  : { id: 'ChIJlocal', displayName: { text: 'Bar Beta' }, formattedAddress: 'Carrer 1, Barcelona',
    location: { latitude: 41.38, longitude: 2.17 }, addressComponents: [
      { longText: 'Carrer 1', types: ['route'] }, { longText: 'Barcelona', types: ['locality'] },
      { longText: '08001', types: ['postal_code'] },
    ] } }) });

test('typing shows debounced suggestions without a search button and selection preserves coordinates', async () => {
  const h = formHarness({ server: placeServer() });
  await h.restore();
  h.change('Ex.: Zurito, Terrassa', 'Bar Beta');
  assert.equal(h.calls.some(call => call[0] === 'searchRegistrationLocations'), false);
  assert.equal(h.elements(node => node.type === 'button' && node.props.children === 'Cercar').length, 0);
  await h.debounce();
  assert.match(h.text(), /Bar Beta/);
  await h.clickResult();
  assert.equal(h.slots[0], 4);
  assert.equal(h.slots[2].businessName, 'Bar Beta');
  assert.equal(h.slots[2].location.latitude, 41.38);
  assert.equal(h.slots[2].googlePlaceId, 'ChIJlocal');
  h.change('Carrer de Sants 123', 'Carrer 2');
  assert.equal(h.slots[2].location, null);
});

test('manual address lookup confirms a location without replacing the business name', async () => {
  const h = formHarness({ server: placeServer() });
  await h.restore();
  h.prepare(4, { businessName: 'Bar manual', address: 'Carrer 2', city: 'Barcelona', postalCode: '08001', nif: ' ES b-12345674 ' });
  await h.click('handleContinue');
  assert.equal(h.slots[0], 4);
  await h.click('handleLocateAddress');
  await h.clickResult();
  assert.equal(h.slots[2].businessName, 'Bar manual');
  await h.click('handleContinue');
  assert.equal(h.slots[0], 5);
  assert.equal(h.slots[2].nif, 'B12345674');
});

test('email format feedback appears only after blur and disappears while correcting it', () => {
  const h = formHarness();
  h.change('joan@barcanpunyetes.cat', 'joan@hotmail');
  assert.doesNotMatch(h.text(), /Introdueix un email vàlid/);
  h.blur('joan@barcanpunyetes.cat');
  assert.match(h.text(), /Introdueix un email vàlid/);
  h.focus('joan@barcanpunyetes.cat');
  h.change('joan@barcanpunyetes.cat', 'joan@hotmail.c');
  assert.doesNotMatch(h.text(), /Introdueix un email vàlid/);
});

test('registration steps have no decorative logos or arrow button labels and account copy is concise', () => {
  const h = formHarness();
  assert.doesNotMatch(h.text(), /Hauràs de clicar|enllaç de verificació/);
  for (const step of [1, 2, 3, 4, 5, 6]) {
    h.prepare(step);
    assert.equal(h.elements(node => node.type === 'img' || node.type?.name === 'Logo').length, 0);
    assert.doesNotMatch(h.text(), /[←→↗]/);
  }
});

test('short queries do not search and late responses cannot replace newer suggestions', async () => {
  const pending = new Map();
  const h = formHarness({ search: data => new Promise(resolve => pending.set(data.query, resolve)) });
  await h.restore();
  h.change('Ex.: Zurito, Terrassa', 'zu');
  await h.debounce();
  assert.equal(h.calls.some(call => call[0] === 'searchRegistrationLocations'), false);
  h.change('Ex.: Zurito, Terrassa', 'Zurito');
  await h.debounce();
  h.change('Ex.: Zurito, Terrassa', 'Zurito Terrassa');
  await h.debounce();
  pending.get('Zurito Terrassa')({ results: [{ placeId: 'new', primaryText: 'Correcte', secondaryText: 'Terrassa' }] });
  await new Promise(resolve => setImmediate(resolve));
  pending.get('Zurito')({ results: [{ placeId: 'old', primaryText: 'Antic', secondaryText: 'Altre municipi' }] });
  await new Promise(resolve => setImmediate(resolve));
  assert.match(h.text(), /Correcte/);
  assert.doesNotMatch(h.text(), /Antic/);
});

test('keyboard navigation selects a suggestion and empty lists do not gain a phantom active option', async () => {
  const h = formHarness({ server: placeServer() });
  await h.restore();
  await h.key('Ex.: Zurito, Terrassa', 'ArrowDown');
  assert.equal(h.elements(node => node.props?.role === 'combobox')[0].props['aria-activedescendant'], undefined);
  h.change('Ex.: Zurito, Terrassa', 'Bar Beta');
  await h.debounce();
  await h.key('Ex.: Zurito, Terrassa', 'ArrowDown');
  assert.equal(h.elements(node => node.props?.role === 'combobox')[0].props['aria-activedescendant'], 'bar-suggestion-0');
  await h.key('Ex.: Zurito, Terrassa', 'Enter');
  assert.equal(h.slots[0], 4);
  assert.equal(h.slots[2].googlePlaceId, 'ChIJlocal');
});

test('changing queries cancels the previous debounce and Escape cancels a queued search', async () => {
  const h = formHarness({ server: placeServer() });
  await h.restore();
  h.change('Ex.: Zurito, Terrassa', 'Old query');
  h.change('Ex.: Zurito, Terrassa', 'New query');
  await h.debounce();
  const calls = h.calls.filter(call => call[0] === 'searchRegistrationLocations');
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].query, 'New query');
  h.change('Ex.: Zurito, Terrassa', 'Cancelled query');
  await h.key('Ex.: Zurito, Terrassa', 'Escape');
  await h.debounce();
  assert.equal(h.calls.filter(call => call[0] === 'searchRegistrationLocations').length, 1);
  assert.equal(h.elements(node => node.props?.role === 'option').length, 0);
});
