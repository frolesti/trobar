const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

async function dispatch(type, object, subscription = {}) {
  const updates = [];
  const write = (collection, id) => ({ update: async data => updates.push({ collection, id, data }) });
  const owner = { ref: write('barOwners', 'owner'), data: () => ({ barId: 'bar' }) };
  const database = { collection: collection => ({
    doc: id => write(collection, id),
    where: () => ({ limit: () => ({ get: async () => ({ empty: false, docs: [owner] }) }) }),
  }) };
  const firestore = Object.assign(() => database, { FieldValue: { serverTimestamp: () => 'timestamp' } });
  class Stripe {
    webhooks = { constructEvent: () => ({ type, data: { object } }) };
    subscriptions = { retrieve: async () => subscription };
  }
  const moduleStub = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(require.resolve('../src/index.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, {
    module: moduleStub, exports: moduleStub.exports, process,
    console: { log() {}, error() {} },
    require: name => {
      if (name === 'firebase-admin') return { initializeApp() {}, firestore };
      if (name === 'stripe') return Stripe;
      if (name.endsWith('/https')) return { onCall: (...args) => args.at(-1), onRequest: (...args) => args.at(-1), HttpsError: Error };
      if (name.endsWith('/firestore')) return { onDocumentCreated: (...args) => args.at(-1) };
      if (name.endsWith('/params')) return { defineSecret: () => ({ value: () => 'test' }) };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  let status;
  const response = { status(code) { status = code; return this; }, json() {}, send() {} };
  await moduleStub.exports.stripeWebhook({ method: 'POST', headers: {}, rawBody: Buffer.alloc(0) }, response);
  assert.equal(status, 200);
  return updates.find(update => update.collection === 'bars').data;
}

test('checkout only grants premium after an active paid subscription', async () => {
  for (const [status, payment, expected] of [['active', 'paid', true], ['trialing', 'no_payment_required', false], ['incomplete', 'unpaid', false], ['active', 'unpaid', false]]) {
    const result = await dispatch('checkout.session.completed', { metadata: { firebaseUid: 'owner', barId: 'bar' }, subscription: 'sub', payment_status: payment }, { status, metadata: {} });
    assert.equal(result.premium, expected);
    assert.equal(result.tier, expected ? 'premium' : 'free');
  }
});

test('subscription changes remove verification for trials, overdue and cancelled subscriptions', async () => {
  for (const status of ['active', 'trialing', 'past_due', 'unpaid', 'canceled']) {
    const result = await dispatch('customer.subscription.updated', { metadata: { firebaseUid: 'owner', barId: 'bar' }, status });
    assert.equal(result.premium, status === 'active');
  }
});

test('failed payment immediately downgrades the public bar', async () => {
  const result = await dispatch('invoice.payment_failed', { customer: 'customer' });
  assert.equal(result.premium, false);
  assert.equal(result.tier, 'free');
});