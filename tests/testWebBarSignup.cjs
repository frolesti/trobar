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
  const location = { search: options.searchParams || '', origin: 'http://localhost:3000', assign: url => calls.push(['redirect', url]) };
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
  const auth = { currentUser: null, signOut: async () => { calls.push(['signOut']); auth.currentUser = null; } };
  const jsx = (type, props) => ({ type, props });
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../web-app/components/ContactForm.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    module, exports: module.exports, URLSearchParams, URL,
    window: { crypto: { randomUUID: () => '12345678-1234-4234-8234-123456789abc' },
      history: { length: options.historyLength ?? 2, back: () => calls.push(['historyBack']) },
      location },
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
          if (operation === 'getSubscriptionStatus') {
            if (options.statusError) throw { code: 'functions/unavailable' };
            return { data: options.subscriptionResponse || { active: false } };
          }
          if (operation === 'createCheckoutSession' && options.checkoutWait) await options.checkoutWait();
          if (operation === 'createCheckoutSession' && options.checkoutError) throw { code: 'functions/unavailable' };
          if (options.fakeSuccess) return { data: { ok: true, barId: 'unpersisted' } };
          return { data: await server.api[operation](request(data)) };
        },
      };
      if (name === '../lib/firebase') return { auth, db: {}, functions: {} };
      if (name === './Logo') return { default: () => null };
      if (name === './StoreBadges') return { __esModule: true, default: 'store-badges' };
      throw new Error(name);
    },
  });
  function render() {
    cursor = 0;
    const tree = module.exports.default({ onStepChange: options.onStepChange });
    for (const node of nodes(tree, node => node.props?.ref && typeof node.props.ref === 'object')) {
      node.props.ref.current = {
        scrollIntoView: settings => calls.push(['scrollCard', settings]),
        querySelector: selector => {
          if (selector === 'h2') return { setAttribute() {}, focus: () => calls.push(['focusHeading']) };
          const target = nodes(tree, node => selector === '[aria-invalid="true"]' ? node.props?.['aria-invalid'] === true
            : node.props?.role === 'alert')[0];
          return target ? {
            focus: () => calls.push(['focusField', target.props.id]),
            scrollIntoView: settings => calls.push(['scrollField', target.props.id, settings]),
          } : null;
        },
      };
    }
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
    server, user, slots, calls, options, location, render,
    settle: async () => { render(); await new Promise(resolve => setImmediate(resolve)); render(); },
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

test('final confirmation verifies the draft then opens Stripe directly without a premature success screen', async () => {
  const bar = { businessName: 'Bar Beta', address: 'Carrer 1', city: 'Barcelona', postalCode: '08001',
    nif: 'B12345674', contactName: 'Propietari', billing: 'quarterly', acceptTerms: true,
    location: { latitude: 41.38, longitude: 2.17 } };
  const h = formHarness({ server: { env: { FUNCTIONS_EMULATOR: 'true' } } });
  await h.restore();
  h.prepare(5, bar);
  await h.click('handleSubmit');
  assert.equal(h.slots[0], 5);
  assert.equal(h.server.documents.get('users/owner').ownedBars.length, 1);
  assert.equal('password' in h.calls.find(call => call[0] === 'registerBar')[1], false);
  assert.equal(h.server.documents.get('bars/bar1').status, 'pending_checkout');
  assert.equal(h.server.documents.get('bars/bar1').isActive, false);
  assert.equal(h.calls.filter(call => call[0] === 'createCheckoutSession').length, 1);
  assert.match(h.calls.find(call => call[0] === 'redirect')[1], /^https:\/\/checkout\.stripe\.com\//);
  assert.doesNotMatch(h.text(), /registrat correctament|Benvingut|Creant compte de bar/);
  const fake = formHarness({ fakeSuccess: true });
  await fake.restore();
  fake.prepare(5, bar);
  await fake.click('handleSubmit');
  assert.equal(fake.slots[0], 5);
  assert.match(fake.text(), /preparar les dades/);
  assert.equal(fake.calls.some(call => call[0] === 'createCheckoutSession'), false);
});

test('Checkout failure preserves the pending draft and exposes a retry without claiming activation', async () => {
  const h = formHarness({ checkoutError: true });
  await h.restore();
  h.prepare(5, { businessName: 'Bar Beta', address: 'Carrer 1', city: 'Barcelona', postalCode: '08001',
    nif: 'B12345674', acceptTerms: true, location: { latitude: 41.38, longitude: 2.17 } });
  await h.click('handleSubmit');
  assert.equal(h.slots[0], 5);
  assert.equal(h.server.documents.get('bars/bar1').isActive, false);
  assert.match(h.text(), /servei no està disponible/);
  assert.equal(h.calls.some(call => call[0] === 'redirect'), false);
});

test('opening Checkout shows one progress message in the button, without duplicated status text', async () => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  const h = formHarness({ checkoutWait: () => pending });
  h.location.origin = 'https://www.trobar.cat';
  await h.restore();
  h.prepare(5, { businessName: 'Bar Beta', address: 'Carrer 1', city: 'Barcelona', postalCode: '08001',
    nif: 'B12345674', acceptTerms: true, location: { latitude: 41.38, longitude: 2.17 } });
  const submission = h.click('handleSubmit');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal((h.text().match(/Obrint Stripe…/g) || []).length, 1);
  assert.equal(h.elements(node => node.props?.role === 'status').length, 0);
  assert.equal(h.elements(node => node.type === 'button' && node.props['aria-label']?.startsWith('Tornar')).length, 0);
  assert.equal(h.elements(node => node.type === 'button' && node.props.onClick?.name === 'handleSubmit')[0].props['aria-busy'], true);
  release();
  await submission;
  assert.equal(h.calls.filter(call => call[0] === 'redirect').length, 1);
  assert.equal((h.text().match(/Obrint Stripe…/g) || []).length, 1);
});

test('missing fields are identified individually, focused and scrolled into view in form order', async () => {
  const h = formHarness();
  await h.restore();
  h.prepare(4);
  await h.click('handleContinue');
  assert.equal(h.slots[0], 4);
  assert.equal(h.elements(node => node.props?.['aria-invalid'] === true).length, 6);
  assert.ok(h.calls.some(call => call[0] === 'focusField' && call[1] === 'registration-businessName'));
  assert.ok(h.calls.some(call => call[0] === 'scrollField' && call[1] === 'registration-businessName' && call[2].block === 'center'));
  const field = h.elements(node => node.props?.id === 'registration-businessName')[0];
  assert.equal(field.props.required, true);
  assert.equal(field.props['aria-describedby'], 'registration-businessName-error');
  const focused = h.calls.filter(call => call[0] === 'focusField').length;
  h.change('Bar Can Punyetes', 'Bar corregit');
  assert.equal(h.elements(node => node.props?.id === 'registration-businessName')[0].props['aria-invalid'], undefined);
  assert.equal(h.calls.filter(call => call[0] === 'focusField').length, focused, 'typing must not move focus to another error');
});

test('terms rejection focuses the checkbox and does not create a draft or payment', async () => {
  const h = formHarness();
  await h.restore();
  h.prepare(5, { businessName: 'Bar Beta', address: 'Carrer 1', city: 'Barcelona', postalCode: '08001',
    nif: 'B12345674', location: { latitude: 41.38, longitude: 2.17 } });
  await h.click('handleSubmit');
  assert.ok(h.calls.some(call => call[0] === 'focusField' && call[1] === 'registration-acceptTerms'));
  assert.equal(h.calls.some(call => call[0] === 'registerBar'), false);
});

test('search offers a working way back to the account without losing local draft fields', async () => {
  const h = formHarness();
  await h.restore();
  h.prepare(3, { businessName: 'El meu bar', description: 'Ambient de partit' });
  await h.click('handleBackToAccount');
  assert.equal(h.slots[0], 1);
  assert.ok(h.calls.some(call => call[0] === 'signOut'));
  assert.equal(h.slots[2].businessName, 'El meu bar');
  assert.equal(h.slots[2].description, 'Ambient de partit');
});

test('cancelled Checkout returns to the previous subscription step with the saved details', async () => {
  const documents = { 'barOwners/owner': { barId: 'bar', barName: 'Bar pendent', billingCycle: 'annual', nif: 'B12345674' },
    'users/owner': { role: 'bar_owner', ownedBars: ['bar'] },
    'bars/bar': { address: 'Carrer 1', city: 'Barcelona', postalCode: '08001', description: 'Ambient de partit',
      location: { latitude: 41.38, longitude: 2.17 }, status: 'pending_checkout' } };
  const h = formHarness({ searchParams: '?checkout=cancelled', claims: { role: 'bar_owner' }, server: { documents } });
  await h.restore();
  await h.settle();
  assert.equal(h.slots[0], 5);
  assert.match(h.text(), /Tria la facturació/);
  assert.doesNotMatch(h.text(), /ja està activat|registrat correctament|Descarrega/);
  assert.equal(h.slots[2].description, 'Ambient de partit');
  assert.equal(h.slots[2].nif, 'B12345674');
  assert.equal(h.calls.some(call => call[0] === 'createCheckoutSession'), false, 'cancel must not reopen Checkout automatically');
});

const validDraft = { businessName: 'Bar Beta', address: 'Carrer 1', city: 'Barcelona', postalCode: '08001',
  nif: 'B12345674', acceptTerms: true, location: { latitude: 41.38, longitude: 2.17 } };

async function savedDraft(options = {}) {
  const h = formHarness({ checkoutError: true, ...options });
  h.location.origin = 'https://www.trobar.cat';
  await h.restore();
  h.prepare(5, validDraft);
  await h.click('handleSubmit');
  h.calls.length = 0;
  return h;
}

test('reopening a pending registration connects to Stripe automatically exactly once', async () => {
  const h = await savedDraft();
  h.options.checkoutError = false;
  await h.restore();
  await h.settle();
  await h.settle();
  assert.equal(h.calls.filter(call => call[0] === 'createCheckoutSession').length, 1);
  assert.equal(h.calls.filter(call => call[0] === 'redirect').length, 1, h.text());
  assert.doesNotMatch(h.text(), /Falta confirmar|Hem conservat les dades|Tornar a comprovar/);
});

test('registrations saved before the pending status was introduced also connect to Stripe', async () => {
  const h = await savedDraft();
  Object.assign(h.server.documents.get('bars/bar1'), { status: 'registered', isActive: true });
  h.options.checkoutError = false;
  await h.restore();
  await h.settle();
  assert.equal(h.calls.filter(call => call[0] === 'createCheckoutSession').length, 1);
  assert.equal(h.calls.filter(call => call[0] === 'redirect').length, 1);
});

test('automatic Checkout failure shows a single retry without looping or losing the previous step', async () => {
  const h = await savedDraft();
  await h.restore();
  await h.settle();
  await h.settle();
  assert.equal(h.calls.filter(call => call[0] === 'createCheckoutSession').length, 1);
  assert.match(h.text(), /servei no està disponible/);
  assert.equal(h.elements(node => node.type === 'button' && node.props.onClick?.name === 'handleCheckout').length, 1);
  const back = h.elements(node => node.type === 'button' && node.props['aria-label'] === 'Tornar a la subscripció')[0];
  back.props.onClick();
  h.render();
  assert.equal(h.slots[0], 5);
  assert.equal(h.slots[2].businessName, 'Bar Beta');
});

test('confirmed trials and unresolved subscriptions never trigger automatic repeat Checkout', async () => {
  for (const response of [{ active: true, status: 'trialing' }, { active: false, status: 'past_due' }]) {
    const h = await savedDraft({ subscriptionResponse: response });
    h.options.checkoutError = false;
    await h.restore();
    await h.settle();
    assert.equal(h.calls.some(call => call[0] === 'createCheckoutSession'), false);
    if (response.active) {
      assert.match(h.text(), /ja està activat/);
      assert.match(h.text(), /Premium al mapa/);
    } else {
      assert.equal(h.elements(node => node.type === 'button' && node.props.onClick?.name === 'handleCheckout').length, 0);
    }
  }
});

test('a pending Stripe success return waits for confirmation instead of opening Checkout again', async () => {
  const h = await savedDraft({ searchParams: '?checkout=success' });
  h.options.checkoutError = false;
  await h.restore();
  await h.settle();
  assert.equal(h.calls.some(call => call[0] === 'createCheckoutSession'), false);
  assert.doesNotMatch(h.text(), /ja està activat/);
});

test('a success query parameter and unknown subscription state cannot claim activation or offer duplicate payment', async () => {
  const h = formHarness({ statusError: true, searchParams: '?checkout=success' });
  h.prepare(6);
  h.render();
  await h.settle();
  assert.match(h.text(), /No hem pogut comprovar/);
  assert.equal(h.elements(node => node.type === 'button' && node.props.onClick?.name === 'handleCheckout').length, 0);
  assert.doesNotMatch(h.text(), /ja està activat|Descarrega/);
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

test('editable steps have an accessible icon-only left arrow instead of a text back button', () => {
  const h = formHarness();
  assert.doesNotMatch(h.text(), /Hauràs de clicar|enllaç de verificació/);
  for (const step of [1, 2, 3, 4, 5]) {
    h.prepare(step);
    assert.equal(h.elements(node => node.type === 'img' || node.type?.name === 'Logo').length, 0);
    assert.doesNotMatch(h.text(), /[←→↗]/);
    const back = h.elements(node => node.type === 'button' && node.props['aria-label']?.startsWith('Tornar'));
    assert.equal(back.length, 1);
    assert.equal(back[0].props.children.type, 'svg');
    assert.equal(back[0].props.children.props['aria-hidden'], 'true');
    assert.doesNotMatch(h.text(), /Enrere|Canviar el correu/);
  }
});

test('step markers sit at the bottom of every editable card after its action, never above the title', () => {
  const h = formHarness();
  for (const step of [1, 2, 3, 4, 5]) {
    h.prepare(step);
    const tree = h.render();
    const all = h.elements(() => true);
    const progress = all.filter(node => node.props?.className === 'registration-progress');
    assert.equal(progress.length, 1);
    assert.equal(tree.props.children.at(-1).props.className, 'registration-progress');
    assert.ok(all.indexOf(all.find(node => node.type === 'h2')) < all.indexOf(progress[0]));
    assert.ok(all.filter(node => node.type === 'button').every(node => all.indexOf(node) < all.indexOf(progress[0])));
    assert.equal(progress[0].props.role, 'group');
    assert.match(progress[0].props['aria-label'], new RegExp(`^Pas ${step <= 2 ? 1 : step - 1} de 4:`));
    assert.equal(progress[0].props.children[1].props.children.length, 4);
  }
  h.prepare(6);
  assert.equal(h.elements(node => node.props?.className === 'registration-progress').length, 0);
});

test('confirmation reports its stage, shows the real trial date and Premium status without a back arrow', async () => {
  const stages = [];
  const h = formHarness({ searchParams: '?checkout=success', onStepChange: step => stages.push(step),
    subscriptionResponse: { active: true, status: 'trialing', trialEnd: 1795079482 } });
  h.prepare(6, { businessName: 'Bar Beta' });
  await h.settle();
  assert.ok(stages.includes(6));
  assert.match(h.text(), /Primer cobrament:\s+19 de novembre del? 2026/);
  assert.match(h.text(), /automàtic si no cancel·les/);
  assert.match(h.text(), /Premium al mapa/);
  assert.doesNotMatch(h.text(), /enviarem.*correu|rebràs.*correu/i, 'do not promise reminders before delivery is enabled');
  assert.equal(h.elements(node => node.type === 'button' && node.props['aria-label']?.startsWith('Tornar')).length, 0);
  assert.equal(h.elements(node => node.type === 'store-badges').length, 1);
});

test('pending confirmation never shows a back arrow or claims activation', () => {
  const h = formHarness({ searchParams: '?checkout=success' });
  h.prepare(6);
  h.render();
  assert.match(h.text(), /Confirmant/);
  assert.equal(h.elements(node => node.type === 'button' && node.props['aria-label']?.startsWith('Tornar')).length, 0);
  assert.doesNotMatch(h.text(), /Premium al mapa|ja està activat/);
});

test('cancelled renewal explains that there is no future charge, and a missing date is explicit', async () => {
  const cancelled = formHarness({ subscriptionResponse: {
    active: true, status: 'trialing', trialEnd: 1795079482, cancelAtPeriodEnd: true,
  } });
  cancelled.prepare(6);
  await cancelled.settle();
  assert.match(cancelled.text(), /Tens accés fins al\s+19 de novembre del? 2026/);
  assert.match(cancelled.text(), /No es farà cap cobrament/);
  assert.doesNotMatch(cancelled.text(), /Primer cobrament|cobrament és automàtic/);

  const missing = formHarness({ subscriptionResponse: { active: true, status: 'trialing' } });
  missing.prepare(6);
  await missing.settle();
  assert.match(missing.text(), /data de cobrament encara no està disponible/);
  assert.equal(missing.elements(node => node.type === 'button' && node.props.children === 'Tornar a comprovar').length, 1);
});

test('paid subscriptions show the actual next renewal date using Barcelona time, not the former trial end', async () => {
  const h = formHarness({ subscriptionResponse: { active: true, status: 'active', trialEnd: 1,
    currentPeriodEnd: Date.UTC(2026, 10, 18, 23, 30) / 1000 } });
  h.prepare(6);
  await h.settle();
  assert.match(h.text(), /Pròxima renovació:\s+19 de novembre del? 2026/);
  assert.doesNotMatch(h.text(), /1970/);
});

test('the first arrow navigates browser history, with a fallback for direct entry', async () => {
  for (const historyLength of [1, 2]) {
    const h = formHarness({ historyLength });
    await h.click('handleBackToPage');
    assert.ok(h.calls.some(call => historyLength === 2 ? call[0] === 'historyBack'
      : call[0] === 'redirect' && call[1] === '/per-a-bars'));
  }
});

test('arrows from subscription and business details go to the previous step and preserve inputs', () => {
  const h = formHarness();
  h.prepare(5, validDraft);
  h.elements(node => node.type === 'button' && node.props['aria-label'] === 'Tornar a les dades del bar')[0].props.onClick();
  h.render();
  assert.equal(h.slots[0], 4);
  h.elements(node => node.type === 'button' && node.props['aria-label'] === 'Tornar a la cerca del bar')[0].props.onClick();
  h.render();
  assert.equal(h.slots[0], 3);
  assert.equal(h.slots[2].businessName, 'Bar Beta');
  assert.equal(h.slots[2].nif, 'B12345674');
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
