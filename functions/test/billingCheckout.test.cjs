const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness, request, ownerDocuments, subscription } = require('./betaHarness.cjs');

test('checkout validates the published EUR plan and creates a 14-day trial with safe defaults', async () => {
  const h = harness({ documents: ownerDocuments() });
  const result = await h.api.createCheckoutSession(request({ billingCycle: 'quarterly' }));
  assert.match(result.url, /^https:\/\/checkout\.stripe\.com\//);
  const checkout = h.calls.find(call => call.action === 'checkout');
  assert.equal(checkout.data.subscription_data.trial_period_days, 14);
  assert.equal(checkout.data.line_items[0].price, 'price_quarterly');
  assert.equal(checkout.data.success_url, 'https://www.trobar.cat/registra-bar?checkout=success');
  assert.equal(checkout.data.subscription_data.metadata.firebaseUid, 'owner');
});

test('concurrent retries share the same checkout reservation and idempotency key', async () => {
  const h = harness({ documents: ownerDocuments() });
  await Promise.all([1, 2].map(() => h.api.createCheckoutSession(request({ billingCycle: 'quarterly' }))));
  const calls = h.calls.filter(call => call.action === 'checkout');
  assert.equal(calls[0].settings.idempotencyKey, calls[1].settings.idempotencyKey);
  assert.equal(h.documents.get('barOwners/owner').checkoutAttempt, 1);
  await assert.rejects(h.api.createCheckoutSession(request({ billingCycle: 'annual' })), { code: 'failed-precondition' });
});

test('missing prices, wrong price or currency, live billing, wrong owner and arbitrary domains fail closed', async () => {
  for (const options of [
    { env: { STRIPE_PRICE_QUARTERLY: '' } }, { price: { unit_amount: 1 } },
    { price: { currency: 'usd' } }, { price: { livemode: true } },
    { documents: { ...ownerDocuments(), 'bars/bar': { ownerId: 'another' } } },
    { documents: { ...ownerDocuments(), 'bars/bar': { ownerId: 'owner', isTestData: true } } },
  ]) {
    const h = harness({ documents: ownerDocuments(), ...options });
    await assert.rejects(h.api.createCheckoutSession(request({ billingCycle: 'quarterly' })));
    assert.equal(h.calls.filter(call => ['checkout', 'customer'].includes(call.action)).length, 0);
  }
  const h = harness({ documents: ownerDocuments() });
  await assert.rejects(h.api.createCheckoutSession(request({ billingCycle: 'quarterly', successUrl: 'https://evil.example/' })), { code: 'invalid-argument' });
  await assert.rejects(h.api.createCheckoutSession(request({ billingCycle: 'quarterly', successUrl: 'http://localhost:3000/' })), { code: 'invalid-argument' });
});

test('existing subscription blocks duplicate checkout; cancellation errors never report success', async () => {
  const documents = ownerDocuments();
  documents['barOwners/owner'].stripeSubscriptionId = 'sub';
  const h = harness({ documents, subscription: subscription('active'), failCancel: true });
  await assert.rejects(h.api.createCheckoutSession(request({ billingCycle: 'quarterly' })), { code: 'failed-precondition' });
  await assert.rejects(h.api.cancelSubscription(request({})), /stripe\/unavailable/);
  assert.equal(h.documents.get('barOwners/owner').stripeSubscriptionId, 'sub');
});

test('subscription discovery blocks duplicate billing even before its webhook persists', async () => {
  const h = harness({ documents: ownerDocuments(), unlinkedSubscriptions: [subscription('trialing')] });
  await assert.rejects(h.api.createCheckoutSession(request({ billingCycle: 'quarterly' })), { code: 'failed-precondition' });
  assert.equal(h.calls.filter(call => call.action === 'checkout').length, 0);
});

test('plan change and confirmed cancellation update the owned bar', async () => {
  const documents = ownerDocuments();
  documents['barOwners/owner'].stripeSubscriptionId = 'sub';
  const h = harness({ documents, subscription: subscription('active') });
  assert.equal((await h.api.changeBillingCycle(request({ newCycle: 'annual' }))).newCycle, 'annual');
  assert.equal(h.calls.find(call => call.action === 'change').data.items[0].price, 'price_annual');
  assert.equal((await h.api.cancelSubscription(request({}))).ok, true);
  assert.equal(h.documents.get('bars/bar').premium, false);
  assert.equal(h.documents.get('barOwners/owner').subscriptionStatus, 'canceled');
});
