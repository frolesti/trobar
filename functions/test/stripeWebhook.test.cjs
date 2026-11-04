const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness, ownerDocuments, subscription } = require('./betaHarness.cjs');

async function dispatch(h) {
  let status;
  const body = Buffer.from('signed original payload');
  await h.api.stripeWebhook({ method: 'POST', headers: { 'stripe-signature': 'signature' }, rawBody: body }, {
    status(code) { status = code; return this; }, json() {}, send() {},
  });
  return { status, body };
}

test('checkout relies on Stripe subscription state, preserving the advertised 14-day trial', async () => {
  for (const state of ['active', 'trialing', 'incomplete', 'past_due', 'unpaid', 'canceled']) {
    const h = harness({
      documents: ownerDocuments(), subscription: subscription(state),
      event: { id: `evt_${state}`, created: 100, type: 'checkout.session.completed', data: { object: {
        metadata: { firebaseUid: 'owner', barId: 'bar' }, subscription: 'sub', payment_status: 'unpaid',
      } } },
    });
    h.documents.get('bars/bar').status = 'pending_checkout';
    h.documents.get('bars/bar').isActive = false;
    assert.equal((await dispatch(h)).status, 200);
    assert.equal(h.documents.get('bars/bar').premium, ['active', 'trialing'].includes(state));
    assert.equal(h.documents.get('barOwners/owner').subscriptionStatus, state);
    assert.equal(h.documents.get('bars/bar').status, ['active', 'trialing'].includes(state) ? 'registered' : 'pending_checkout');
    assert.equal(h.documents.get('bars/bar').isActive, ['active', 'trialing'].includes(state));
  }
});

test('signed webhook is deduplicated and does not roll back newer subscription state', async () => {
  const options = {
    documents: ownerDocuments(), subscription: subscription('active'),
    event: { id: 'evt_1', created: 200, type: 'customer.subscription.updated', data: { object: subscription('past_due') } },
  };
  const h = harness(options);
  const { body } = await dispatch(h);
  assert.equal(h.calls[0].args[0], body);
  assert.equal(h.calls[0].args[1], 'signature');
  const writes = h.updates.length;
  await dispatch(h);
  assert.equal(h.updates.length, writes);
  options.event = { ...options.event, id: 'evt_older', created: 100 };
  options.subscription = subscription('past_due');
  await dispatch(h);
  assert.equal(h.documents.get('bars/bar').premium, true);
});

test('failed payment downgrades and invoice renewal recovers from Stripe current state', async () => {
  const documents = ownerDocuments();
  documents['barOwners/owner'].stripeSubscriptionId = 'sub';
  const options = { documents, subscription: subscription('past_due'),
    event: { id: 'evt_failed', created: 100, type: 'invoice.payment_failed', data: { object: { customer: 'customer' } } } };
  const h = harness(options);
  await dispatch(h);
  assert.equal(h.documents.get('bars/bar').premium, false);
  options.subscription = subscription('active');
  options.event = { ...options.event, id: 'evt_paid', created: 101, type: 'invoice.paid' };
  await dispatch(h);
  assert.equal(h.documents.get('bars/bar').premium, true);
});

test('deleted subscription uses its signed canceled snapshot without a retrieve dependency', async () => {
  const h = harness({ documents: ownerDocuments(), failRetrieve: true,
    event: { id: 'evt_deleted', created: 100, type: 'customer.subscription.deleted', data: { object: subscription('canceled') } } });
  assert.equal((await dispatch(h)).status, 200);
  assert.equal(h.documents.get('barOwners/owner').subscriptionStatus, 'canceled');
  assert.equal(h.documents.get('bars/bar').premium, false);
});

test('bad signatures cannot write billing state', async () => {
  const h = harness({ documents: ownerDocuments(), badSignature: true });
  assert.equal((await dispatch(h)).status, 400);
  assert.equal(h.updates.length, 0);
});
