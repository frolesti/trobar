const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function harness(options = {}) {
  const documents = new Map(Object.entries(options.documents || {}));
  const updates = [];
  const calls = [];
  const claims = [];
  let counter = 0;
  let queue = Promise.resolve();
  const snapshot = key => ({ exists: documents.has(key), data: () => documents.get(key) });
  const ref = key => ({
    id: key.split('/').at(-1), key, get: async () => snapshot(key),
    collection: name => ({ doc: id => ref(`${key}/${name}/${id}`) }),
    delete: async () => { documents.delete(key); },
    set: async data => { documents.set(key, data); updates.push({ key, data }); },
    update: async data => { documents.set(key, { ...documents.get(key), ...data }); updates.push({ key, data }); },
  });
  const database = {
    collection: collection => ({
      doc: id => ref(`${collection}/${id || `bar${++counter}`}`),
      where: (field, operator, value) => ({
        select: () => ({ get: async () => ({ docs: [...documents.entries()]
          .filter(([key, data]) => key.startsWith(`${collection}/`) && data[field] === value)
          .map(([key]) => ({ ref: ref(key) })) }) }),
        limit: () => ({
          get: async () => {
            const docs = [...documents.entries()].filter(([key, data]) => key.startsWith(`${collection}/`)
              && (operator === "<=" ? typeof data[field] === 'number' && data[field] <= value : data[field] === value))
              .map(([key]) => ({ ...snapshot(key), ...ref(key), ref: ref(key) }));
            return { empty: !docs.length, docs };
          },
        }),
      }),
    }),
    batch: () => {
      const removals = [];
      return { delete: reference => removals.push(reference.key), commit: async () => { for (const key of removals) documents.delete(key); } };
    },
    runTransaction: operation => {
      const execute = async () => {
        const writes = [];
        const result = await operation({
          get: async reference => snapshot(reference.key),
          set: (reference, data, settings) => writes.push({ key: reference.key, data, merge: settings?.merge }),
          update: (reference, data) => writes.push({ key: reference.key, data, merge: true }),
        });
        if (options.failCommit) throw new Error('firestore/unavailable');
        for (const write of writes) {
          documents.set(write.key, write.merge ? { ...documents.get(write.key), ...write.data } : write.data);
          updates.push(write);
        }
        return result;
      };
      const result = queue.then(execute);
      queue = result.catch(() => {});
      return result;
    },
  };
  const auth = {
    getUser: async uid => {
      if (options.authErrors?.[uid]) throw Object.assign(new Error(options.authErrors[uid]), { code: options.authErrors[uid] });
      return { customClaims: options.customClaims || {}, ...options.authUser, ...options.authUsers?.[uid] };
    },
    setCustomUserClaims: async (uid, data) => {
      if (options.failClaims) { options.failClaims = false; throw new Error('auth/unavailable'); }
      claims.push({ uid, data });
    },
  };
  const firestore = Object.assign(() => database, {
    FieldValue: { serverTimestamp: () => 'timestamp', delete: () => null },
  });
  const sessions = new Map();
  class Stripe {
    webhooks = {
      constructEvent: (...args) => {
        calls.push({ action: 'signature', args });
        if (options.badSignature) throw new Error('bad signature');
        return options.event;
      },
    };
    prices = {
      retrieve: async id => {
        const [amount, interval, count] = id === 'price_monthly' ? [3900, 'month', 1]
          : id === 'price_quarterly' ? [9900, 'month', 3] : [34800, 'year', 1];
        return { active: true, currency: 'eur', unit_amount: amount, recurring: { interval, interval_count: count }, ...options.price };
      },
    };
    customers = {
      create: async (data, settings) => { calls.push({ action: 'customer', data, settings }); return { id: 'customer' }; },
      del: async () => { if (options.failCancel) throw new Error('stripe/unavailable'); },
    };
    billingPortal = { sessions: { create: async data => {
      calls.push({ action: 'portal', data }); return { url: 'https://billing.stripe.com/p/session/test-only' };
    } } };
    invoices = {
      createPreview: async () => options.invoicePreview || { amount_due: 9900, currency: 'eur' },
      retrieve: async () => options.invoice,
    };
    checkout = { sessions: { create: async (data, settings) => {
      calls.push({ action: 'checkout', data, settings });
      if (!sessions.has(settings.idempotencyKey)) sessions.set(settings.idempotencyKey, { id: 'session', url: 'https://checkout.stripe.com/c/pay/test' });
      return sessions.get(settings.idempotencyKey);
    } } };
    subscriptions = {
      list: async () => ({ data: options.unlinkedSubscriptions || [] }),
      retrieve: async () => { if (options.failRetrieve) throw new Error('stripe/unavailable'); return options.subscription; },
      update: async (id, data) => { calls.push({ action: 'change', data }); return options.subscription; },
      cancel: async () => { if (options.failCancel) throw new Error('stripe/unavailable'); return { ...options.subscription, status: 'canceled' }; },
    };
  }
  class HttpsError extends Error {
    constructor(code, message) { super(message); this.code = code; }
  }
  const modules = new Map();
  function load(filename) {
    if (modules.has(filename)) return modules.get(filename);
    const module = { exports: {} };
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(source, {
      module, exports: module.exports, URL, URLSearchParams, Date, AbortSignal,
      fetch: async (...args) => {
        calls.push({ action: 'location', args });
        if (options.fetch) return options.fetch(...args);
        if (options.locationError) throw new Error('location/network');
        return { ok: options.locationStatus === undefined || options.locationStatus === 200,
          status: options.locationStatus || 200,
          json: async () => options.locationResults ?? {} };
      },
      process: { env: { STRIPE_PRICE_MONTHLY: 'price_monthly', STRIPE_PRICE_QUARTERLY: 'price_quarterly', STRIPE_PRICE_ANNUAL: 'price_annual', ...options.env } },
      console: { log() {}, error() {}, info() {} },
      require: name => {
        if (name.startsWith('node:') || name === 'stdnum') return require(name);
        if (name === 'firebase-admin') return { initializeApp() {}, firestore, auth: () => auth };
        if (name === 'firebase-admin/app') return { getApps: () => [{ name: '[DEFAULT]' }], initializeApp: () => ({ name: '[DEFAULT]' }) };
        if (name === 'firebase-admin/firestore') return { FieldValue: firestore.FieldValue, getFirestore: () => database };
        if (name === 'firebase-functions/v1') return { region: () => ({ runWith: () => ({ auth: { user: () => ({ onDelete: callback => callback }) } }) }) };
        if (name === 'stripe') return Stripe;
        if (name === 'resend') return require('../node_modules/resend');
        if (name.endsWith('/https')) return { onCall: (...args) => args.at(-1), onRequest: (...args) => args.at(-1), HttpsError };
        if (name.endsWith('/firestore')) return { onDocumentCreated: (...args) => args.at(-1) };
        if (name.endsWith('/scheduler')) return { onSchedule: (...args) => args.at(-1) };
        if (name.endsWith('/params')) return { defineSecret: () => ({ value: () => 'sk_test_mock' }) };
        if (name.startsWith('./emails/')) return require(path.resolve(__dirname, '..', '..', 'emails', path.basename(name)));
        if (name === './app/src/data/contactEmails.json') return require('../../app/src/data/contactEmails.json');
        if (name.startsWith('./')) return load(path.resolve(path.dirname(filename), `${name}.ts`));
        throw new Error(`Unexpected import: ${name}`);
      },
    });
    modules.set(filename, module.exports);
    return module.exports;
  }
  return { api: load(path.resolve(__dirname, '..', 'src', 'index.ts')),
    email: load(path.resolve(__dirname, '..', 'src', 'emailDelivery.ts')),
    webContact: load(path.resolve(__dirname, '..', 'src', 'webContact.ts')),
    database, ref, documents, updates, calls, claims };
}

const request = data => ({ auth: { uid: 'owner', token: { email: 'owner@example.test', email_verified: true } }, data });
const ownerDocuments = () => ({
  'barOwners/owner': { barId: 'bar', billingCycle: 'quarterly', stripeCustomerId: 'customer' },
  'bars/bar': { ownerId: 'owner', tier: 'free', premium: false },
});
const subscription = status => ({
  id: 'sub', customer: 'customer', status, metadata: { firebaseUid: 'owner', barId: 'bar' },
  trial_end: 123, items: { data: [{ id: 'item', price: { id: 'price_quarterly' }, current_period_end: 456 }] },
});
module.exports = { harness, request, ownerDocuments, subscription };
