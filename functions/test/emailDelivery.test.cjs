const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness, ownerDocuments, subscription, request } = require('./betaHarness.cjs');

function setup(overrides = {}) {
  const now = Date.now();
  const sub = {
    ...subscription('trialing'), livemode: false, trial_end: Math.floor(now / 1000) + 14 * 86400,
    items: { data: [{ id: 'item', current_period_end: Math.floor(now / 1000) + 90 * 86400,
      price: { id: 'price_quarterly', recurring: { interval: 'month', interval_count: 3 } } }] },
  };
  const documents = ownerDocuments();
  documents['barOwners/owner'].stripeSubscriptionId = 'sub';
  documents['bars/bar'].name = 'Bar del Partit';
  const options = {
    documents, subscription: sub,
    authUser: { uid: 'owner', email: 'owner@example.test', emailVerified: true, displayName: 'Laia', metadata: { creationTime: new Date(now).toISOString() } },
    env: { EMAIL_DELIVERY_MODE: 'internal', EMAIL_INTERNAL_RECIPIENTS: 'owner@example.test', EMAIL_PORTAL_READY: 'true' },
    ...overrides,
  };
  const h = harness(options);
  return {
    ...h, options, now, sub: options.subscription,
    jobs: () => [...h.documents.entries()].filter(([key]) => key.startsWith('emailJobs/')),
    stripe: { subscriptions: { retrieve: async () => options.subscription }, invoices: {
      createPreview: async () => options.invoicePreview || { amount_due: 9900, currency: 'eur' },
      retrieve: async () => options.invoice,
    } },
  };
}
const event = (h, type = 'checkout.session.completed', object = {}) => ({ id: 'evt_email', type, created: Math.floor(h.now / 1000), data: { object } });
const accepted = async () => ({ data: { id: 'provider-message' }, error: null, headers: null });
const invoice = (h, amount = 9900) => ({
  id: 'in_example', status: 'paid', customer: 'customer', amount_paid: amount, amount_due: amount, currency: 'eur',
  number: 'EXAMPLE-001', hosted_invoice_url: 'https://invoice.stripe.com/i/example',
  parent: { subscription_details: { subscription: 'sub' } },
  lines: { data: [{ parent: { subscription_item_details: { subscription: 'sub' } }, period: { start: Math.floor(h.now / 1000), end: Math.floor(h.now / 1000) + 90 * 86400 } }] },
});

test('cancellation and actual end are different events, deduplicated and rechecked before delivery', async () => {
  const h = setup();
  h.sub.cancel_at = Math.floor(h.now / 1000) + 3600;
  const changed = { ...event(h, 'customer.subscription.updated', h.sub), data: { object: h.sub, previous_attributes: { cancel_at: null } } };
  await h.email.planSubscriptionEmails(h.database, h.stripe, changed, h.sub, h.now);
  await h.email.planSubscriptionEmails(h.database, h.stripe, changed, h.sub, h.now);
  const [key] = h.jobs().find(([, job]) => job.kind === 'subscription-cancelled');
  assert.equal(h.jobs().length, 1);
  h.sub.cancel_at = null;
  await h.email.deliverEmailJob(h.database, h.stripe, h.ref(key), 'fixture', h.now, () => { throw new Error('Resumed subscription must suppress cancellation'); });
  assert.equal(h.documents.get(key).state, 'suppressed');
  h.sub.status = 'canceled';
  await h.email.planSubscriptionEmails(h.database, h.stripe, event(h, 'customer.subscription.deleted', h.sub), h.sub, h.now);
  const [ended] = h.jobs().find(([, job]) => job.kind === 'subscription-ended');
  await h.email.deliverEmailJob(h.database, h.stripe, h.ref(ended), 'fixture', h.now, accepted);
  assert.equal(h.documents.get(ended).state, 'accepted');
});

test('a plan email requires a real price change and is suppressed if superseded', async () => {
  const h = setup();
  h.sub.status = 'active';
  const changed = { ...event(h, 'customer.subscription.updated', h.sub), data: {
    object: h.sub, previous_attributes: { items: { data: [{ price: { id: 'old_monthly' } }] } },
  } };
  await h.email.planSubscriptionEmails(h.database, h.stripe, changed, h.sub, h.now);
  const [key] = h.jobs().find(([, job]) => job.kind === 'subscription-updated');
  let payload;
  await h.email.deliverEmailJob(h.database, h.stripe, h.ref(key), 'fixture', h.now, async mail => { payload = mail; return accepted(); });
  assert.match(payload.template.variables.AMOUNT, /99,00/);
  assert.equal(payload.template.variables.BILLING_CYCLE, 'Cada tres mesos');
  const count = h.jobs().length;
  await h.email.planSubscriptionEmails(h.database, h.stripe, { ...changed, id: 'evt_quantity_same', data: { object: h.sub, previous_attributes: { items: h.sub.items } } }, h.sub, h.now);
  assert.equal(h.jobs().length, count);
  await h.email.planSubscriptionEmails(h.database, h.stripe, { ...changed, id: 'evt_plan_changed' }, h.sub, h.now);
  const [pending] = h.jobs().find(([, job]) => job.kind === 'subscription-updated' && job.state === 'pending');
  h.sub.items.data[0].price.id = 'new_annual';
  await h.email.deliverEmailJob(h.database, h.stripe, h.ref(pending), 'fixture', h.now, () => { throw new Error('Stale plan'); });
  assert.equal(h.documents.get(pending).state, 'suppressed');
});

test('bank authentication notice uses the invoice URL and suppresses recovered payments', async () => {
  for (const status of ['requires_action', 'succeeded']) {
    const h = setup();
    h.sub.status = 'active';
    h.options.invoice = { ...invoice(h), status: 'open', amount_paid: 0 };
    h.stripe.invoicePayments = { list: async () => ({ data: [{ payment: { payment_intent: 'pi_test' } }], has_more: false }) };
    h.stripe.paymentIntents = { retrieve: async () => ({ status }) };
    await h.email.planSubscriptionEmails(h.database, h.stripe, event(h, 'invoice.payment_action_required', h.options.invoice), h.sub, h.now);
    const [key] = h.jobs()[0];
    let payload;
    await h.email.deliverEmailJob(h.database, h.stripe, h.ref(key), 'fixture', h.now, async mail => { payload = mail; return accepted(); });
    assert.equal(h.documents.get(key).state, status === 'requires_action' ? 'accepted' : 'suppressed');
    if (payload) assert.equal(payload.template.variables.MANAGE_URL, h.options.invoice.hosted_invoice_url);
  }
});

test('only succeeded refunds linked to the owned subscription invoice send their actual partial amount', async () => {
  const h = setup();
  h.sub.status = 'active';
  h.options.invoice = invoice(h);
  const refund = { id: 're_test', status: 'succeeded', amount: 1500, currency: 'eur', payment_intent: 'pi_test' };
  h.stripe.invoicePayments = { list: async () => ({ data: [{ invoice: h.options.invoice.id }], has_more: false }) };
  h.stripe.refunds = { retrieve: async () => refund };
  const e = event(h, 'refund.updated', refund);
  await h.email.planRefundEmail(h.database, h.stripe, { ...e, livemode: true }, h.now);
  await h.email.planRefundEmail(h.database, h.stripe, event(h, 'refund.updated', { ...refund, status: 'pending' }), h.now);
  assert.equal(h.jobs().length, 0);
  await h.email.planRefundEmail(h.database, h.stripe, e, h.now);
  await h.email.planRefundEmail(h.database, h.stripe, e, h.now);
  assert.equal(h.jobs().length, 1);
  const [key] = h.jobs()[0];
  let payload;
  await h.email.deliverEmailJob(h.database, h.stripe, h.ref(key), 'fixture', h.now, async mail => { payload = mail; return accepted(); });
  assert.match(payload.template.variables.AMOUNT, /15,00/);
});

test('support receipts and approved replies read private source data and keep the customer recipient', async () => {
  const h = setup({ authUsers: { staff: { customClaims: { role: 'admin' } } } });
  const messageId = '12345678-1234-1234-1234-123456789abc';
  const replyId = '87654321-1234-1234-1234-123456789abc';
  const ticket = { userId: 'owner', subject: 'Una consulta de prova' };
  h.documents.set(`contactMessages/${messageId}`, ticket);
  await h.api.onContactEmail({ params: { messageId }, data: { data: () => ticket } });
  await h.api.onContactEmail({ params: { messageId }, data: { data: () => ticket } });
  await assert.rejects(h.api.replyToContact(request({ messageId, replyId, text: 'Una resposta.' })), error => error.code === 'permission-denied');
  await h.api.replyToContact({ auth: { uid: 'staff', token: { role: 'admin' } }, data: { messageId, replyId, text: 'Gràcies. Ja ho hem resolt.' } });
  const reply = h.documents.get(`contactMessages/${messageId}/replies/${replyId}`);
  await h.api.onSupportReplyEmail({ params: { messageId, replyId }, data: { data: () => reply } });
  for (const kind of ['support-received', 'support-reply']) {
    const [key] = h.jobs().find(([, job]) => job.kind === kind);
    await h.email.deliverEmailJob(h.database, {}, h.ref(key), 'fixture', h.documents.get(key).nextAttemptAt, accepted);
    assert.equal(h.documents.get(key).state, 'accepted');
  }
  assert.equal(h.jobs().length, 2);
});

test('account-deleted needs a real deletion event and confirms Auth absence before sending', async () => {
  const h = setup();
  const user = h.options.authUser;
  await h.api.onAccountDeletedEmail(user);
  let [key] = h.jobs()[0];
  await h.email.deliverEmailJob(h.database, {}, h.ref(key), 'fixture', h.documents.get(key).nextAttemptAt, () => { throw new Error('Existing account'); });
  assert.equal(h.documents.get(key).state, 'suppressed');
  const absent = setup({ authErrors: { owner: 'auth/user-not-found' } });
  absent.documents.set('accountSecurityState/owner', { email: user.email });
  absent.documents.set('barEmailConsents/owner', { enabled: true });
  absent.documents.set('accountSecurityEvents/private', { uid: 'owner', to: user.email });
  absent.documents.set('accountSecurityEvents/unrelated', { uid: 'other' });
  await absent.api.onAccountDeletedEmail(user);
  assert.equal(absent.documents.has('accountSecurityState/owner'), false);
  assert.equal(absent.documents.has('barEmailConsents/owner'), false);
  assert.equal(absent.documents.has('accountSecurityEvents/private'), false);
  assert.equal(absent.documents.has('accountSecurityEvents/unrelated'), true);
  [key] = absent.jobs()[0];
  await absent.email.deliverEmailJob(absent.database, {}, absent.ref(key), 'fixture', absent.documents.get(key).nextAttemptAt, accepted);
  assert.equal(absent.documents.get(key).state, 'accepted');
});

test('security uses a server baseline, never invents first-login alerts and deduplicates unchanged credentials', async () => {
  const h = setup();
  h.options.authUser.providerData = [{ providerId: 'password' }];
  h.options.authUser.tokensValidAfterTime = '2026-11-06T10:00:00Z';
  await h.api.recordAccountSecurity(request({ securityChange: 'Ignore client text' }));
  assert.equal(h.jobs().length, 0);
  assert.equal([...h.documents.keys()].filter(key => key.startsWith('accountSecurityEvents/')).length, 0);
  h.options.authUser.tokensValidAfterTime = '2026-11-06T11:00:00Z';
  await h.api.recordAccountSecurity(request({}));
  await h.api.recordAccountSecurity(request({}));
  const events = [...h.documents.entries()].filter(([key]) => key.startsWith('accountSecurityEvents/'));
  assert.equal(events.length, 1);
  const [path, data] = events[0];
  await h.api.onAccountSecurityEmail({ params: { eventId: path.split('/')[1] }, data: { data: () => data } });
  const [key] = h.jobs()[0];
  let payload;
  await h.email.deliverEmailJob(h.database, {}, h.ref(key), 'fixture', h.documents.get(key).nextAttemptAt, async mail => { payload = mail; return accepted(); });
  assert.match(payload.template.variables.SECURITY_CHANGE, /sessions del compte renovades/);
  assert.doesNotMatch(payload.template.variables.SECURITY_CHANGE, /Ignore client text/);
});

test('profile tips require explicit opt-in, wait 24h, send only once and recheck unsubscribe/profile completion', async () => {
  for (const stop of ['none', 'unsubscribe', 'complete']) {
    const h = setup();
    const bar = h.documents.get('bars/bar');
    bar.isActive = true; bar.tier = 'premium';
    assert.equal((await h.api.getBarEmailTips(request({}))).enabled, false);
    await h.api.setBarEmailTips(request({ enabled: true }));
    await h.api.setBarEmailTips(request({ enabled: true }));
    assert.equal(h.jobs().length, 1);
    const [key, job] = h.jobs()[0];
    assert(job.nextAttemptAt >= h.now + 86400000);
    await h.email.deliverEmailJob(h.database, {}, h.ref(key), 'fixture', h.now, () => { throw new Error('Too early'); });
    assert.equal(h.documents.get(key).state, 'pending');
    if (stop === 'unsubscribe') await h.api.setBarEmailTips(request({ enabled: false }));
    if (stop === 'complete') Object.assign(bar, { description: 'Un bon ambient', gallery: ['photo'], amenities: ['screen'] });
    let payload;
    await h.email.deliverEmailJob(h.database, {}, h.ref(key), 'fixture', job.nextAttemptAt, async mail => { payload = mail; return accepted(); });
    assert.equal(h.documents.get(key).state, stop === 'none' ? 'accepted' : 'suppressed');
    if (payload) assert.equal(payload.template.variables.PREFERENCES_URL, 'https://www.trobar.cat/consells-bar');
  }
});

test('returning to an earlier account email still creates a distinct security event', async () => {
  const h = setup({ env: { EMAIL_DELIVERY_MODE: 'internal', EMAIL_INTERNAL_RECIPIENTS: 'owner@example.test,other@example.test' } });
  h.options.authUser.providerData = [{ providerId: 'password' }];
  await h.api.recordAccountSecurity(request({}));
  h.options.authUser.email = 'other@example.test';
  await h.api.recordAccountSecurity(request({}));
  h.options.authUser.email = 'owner@example.test';
  await h.api.recordAccountSecurity(request({}));
  const events = [...h.documents.entries()].filter(([key]) => key.startsWith('accountSecurityEvents/'));
  assert.equal(events.length, 2);
  assert.equal(h.documents.get('accountSecurityState/owner').sequence, 3);
});

test('default-off, unlisted recipients, live subscriptions and unverified accounts cannot queue mail', async () => {
  for (const overrides of [
    { env: {} }, { env: { EMAIL_DELIVERY_MODE: 'live' } },
    { env: { EMAIL_DELIVERY_MODE: 'internal', EMAIL_INTERNAL_RECIPIENTS: 'someone-else@example.test', EMAIL_PORTAL_READY: 'true' } },
    { env: { EMAIL_DELIVERY_MODE: 'internal', EMAIL_INTERNAL_RECIPIENTS: 'owner@example.test' } },
    { authUser: { uid: 'owner', email: 'owner@example.test', emailVerified: false } },
  ]) {
    const h = setup(overrides);
    await h.email.planSubscriptionEmails(h.database, h.stripe, event(h), h.sub, h.now);
    assert.equal(h.jobs().length, 0);
  }
  const h = setup();
  h.sub.livemode = true;
  await h.email.planSubscriptionEmails(h.database, h.stripe, event(h), h.sub, h.now);
  assert.equal(h.jobs().length, 0);
});

test('first verified app access queues one welcome, ignores client UID and never backfills old accounts', async () => {
  const h = setup();
  const input = { auth: { uid: 'owner' }, data: { uid: 'victim' } };
  await Promise.all([h.api.recordFirstLogin(input), h.api.recordFirstLogin(input)]);
  assert.equal(h.jobs().length, 1);
  assert.equal(h.jobs()[0][1].uid, 'owner');
  assert.equal(h.jobs()[0][1].kind, 'welcome');
  await assert.rejects(h.api.recordFirstLogin({}), error => error.code === 'unauthenticated');
  h.options.authUser.metadata.creationTime = new Date(h.now - 8 * 86400000).toISOString();
  assert.equal((await h.api.recordFirstLogin(input)).status, 'not-new');
});

test('activation and two absolute-date reminders are idempotent; updates do not send another welcome', async () => {
  const h = setup();
  await h.email.planSubscriptionEmails(h.database, h.stripe, event(h), h.sub, h.now);
  await h.email.planSubscriptionEmails(h.database, h.stripe, event(h), h.sub, h.now);
  assert.equal(h.jobs().length, 3);
  for (const [, job] of h.jobs()) {
    if (job.kind.startsWith('trial-reminder')) {
      const days = job.kind.endsWith('7') ? 7 : 1;
      assert.equal(job.nextAttemptAt, h.sub.trial_end * 1000 - days * 86400000);
    }
  }
  h.sub.trial_end += 86400;
  await h.email.planSubscriptionEmails(h.database, h.stripe, event(h, 'customer.subscription.updated'), h.sub, h.now);
  assert.equal(h.jobs().filter(([, job]) => job.kind === 'bar-activated').length, 1);
  assert.equal(h.jobs().length, 5);
});

test('only signed paid positive subscription invoices queue receipts; zero invoices and another subscription do not', async () => {
  const h = setup();
  h.sub.status = 'active';
  const paid = invoice(h);
  for (const invalid of [{ ...paid, amount_paid: 0 }, { ...paid, status: 'open' }, { ...paid, parent: { subscription_details: { subscription: 'another' } } }]) {
    await h.email.planSubscriptionEmails(h.database, h.stripe, event(h, 'invoice.paid', invalid), h.sub, h.now);
    assert.equal(h.jobs().length, 0);
  }
  await h.email.planSubscriptionEmails(h.database, h.stripe, event(h, 'invoice.paid', paid), h.sub, h.now);
  await h.email.planSubscriptionEmails(h.database, h.stripe, event(h, 'invoice.paid', paid), h.sub, h.now);
  assert.equal(h.jobs().length, 1);
  assert.equal(h.jobs()[0][1].kind, 'payment-received');
});

test('the verified Stripe webhook wires a paid invoice into the queue exactly once', async () => {
  const h = setup();
  h.sub.status = 'active';
  h.options.event = event(h, 'invoice.paid', invoice(h));
  let status;
  const response = { status(code) { status = code; return this; }, json() {}, send() {} };
  for (let attempt = 0; attempt < 2; attempt++) {
    await h.api.stripeWebhook({ method: 'POST', headers: { 'stripe-signature': 'fixture-signature' }, rawBody: Buffer.from('signed fixture') }, response);
    assert.equal(status, 200);
  }
  assert.equal(h.jobs().length, 1);
  assert.equal(h.jobs()[0][1].kind, 'payment-received');
});

test('cancelled, extended and expired trials suppress already scheduled mail just before delivery', async () => {
  for (const mutation of [
    sub => { sub.cancel_at_period_end = true; }, sub => { sub.trial_end += 86400; }, sub => { sub.status = 'canceled'; },
  ]) {
    const h = setup();
    await h.email.planSubscriptionEmails(h.database, h.stripe, event(h), h.sub, h.now);
    const [key, job] = h.jobs().find(([, job]) => job.kind === 'trial-reminder-1');
    mutation(h.sub);
    let calls = 0;
    await h.email.deliverEmailJob(h.database, h.stripe, h.ref(key), 'fixture-key', job.nextAttemptAt, async () => { calls++; return accepted(); });
    assert.equal(calls, 0);
    assert.equal(h.documents.get(key).state, 'suppressed');
  }
});

test('receipt delivery checks current invoice and real amounts; a recovered failed invoice sends no failure notice', async () => {
  const h = setup();
  h.sub.status = 'active';
  h.options.invoice = invoice(h);
  await h.email.planSubscriptionEmails(h.database, h.stripe, event(h, 'invoice.paid', h.options.invoice), h.sub, h.now);
  const [key] = h.jobs();
  let payload;
  await h.email.deliverEmailJob(h.database, h.stripe, h.ref(key[0]), 'fixture-key', h.now, async message => {
    payload = message;
    return accepted();
  });
  assert.equal(h.documents.get(key[0]).state, 'accepted');
  assert.match(payload.template.variables.AMOUNT, /99,00/);
  assert.equal(payload.html, undefined);
  assert.equal(payload.text, undefined);
  assert.equal(payload.replyTo, 'facturacio@trobar.cat');
  assert.deepEqual(Array.from(payload.to), ['owner@example.test']);
  await h.email.planSubscriptionEmails(h.database, h.stripe, event(h, 'invoice.payment_failed', h.options.invoice), h.sub, h.now);
  const [failedKey] = h.jobs().find(([, job]) => job.kind === 'payment-failed');
  await h.email.deliverEmailJob(h.database, h.stripe, h.ref(failedKey), 'fixture-key', h.now, () => { throw new Error('Must not send'); });
  assert.equal(h.documents.get(failedKey).state, 'suppressed');
});

test('concurrent workers reserve once; ambiguous provider failures retry the identical payload and idempotency key', async () => {
  const h = setup();
  await h.api.recordFirstLogin({ auth: { uid: 'owner' } });
  const [key] = h.jobs()[0];
  const due = h.documents.get(key).nextAttemptAt;
  const requests = [];
  const transport = async (payload, settings) => {
    requests.push({ payload, settings });
    if (requests.length === 1) throw new Error('network-timeout');
    return accepted();
  };
  const results = await Promise.allSettled([
    h.email.deliverEmailJob(h.database, h.stripe, h.ref(key), 'fixture-key', due, transport),
    h.email.deliverEmailJob(h.database, h.stripe, h.ref(key), 'fixture-key', due, transport),
  ]);
  assert.equal(results.filter(result => result.status === 'rejected').length, 1);
  assert.equal(requests.length, 1);
  const next = h.documents.get(key).nextAttemptAt;
  await h.email.deliverEmailJob(h.database, h.stripe, h.ref(key), 'fixture-key', next, transport);
  assert.equal(requests.length, 2);
  assert.equal(JSON.stringify(requests[0].payload), JSON.stringify(requests[1].payload));
  assert.equal(requests[0].settings.idempotencyKey, requests[1].settings.idempotencyKey);
  assert.equal(h.documents.get(key).state, 'accepted');
});

test('retries are bounded and an invalid success-shaped provider reply is never accepted', async () => {
  const h = setup();
  h.sub.status = 'active';
  h.options.invoice = invoice(h);
  await h.email.planSubscriptionEmails(h.database, h.stripe, event(h, 'invoice.paid', h.options.invoice), h.sub, h.now);
  const [key] = h.jobs()[0];
  for (let attempt = 0; attempt < 5; attempt++) {
    await assert.rejects(h.email.deliverEmailJob(h.database, h.stripe, h.ref(key), 'fixture-key', h.documents.get(key).nextAttemptAt,
      async () => ({ data: {}, error: null, headers: null })));
    assert.notEqual(h.documents.get(key).state, 'accepted');
  }
  await h.email.deliverEmailJob(h.database, h.stripe, h.ref(key), 'fixture-key', h.documents.get(key).nextAttemptAt, () => { throw new Error('No sixth request'); });
  assert.equal(h.documents.get(key).state, 'failed');
  assert.equal(h.documents.get(key).attempts, 5);
});

test('permanent provider 4xx failures stop immediately; 429 and 5xx honor Retry-After', async () => {
  for (const status of [400, 401, 403, 404, 422, 429, 503]) {
    const h = setup();
    await h.api.recordFirstLogin({ auth: { uid: 'owner' } });
    const [key, job] = h.jobs()[0];
    const delay = 7 * 60000;
    await assert.rejects(h.email.deliverEmailJob(h.database, h.stripe, h.ref(key), 'fixture-key', job.nextAttemptAt,
      async () => ({
        data: null, error: { name: 'validation_error', message: 'not logged', statusCode: status },
        headers: { 'retry-after': status === 503 ? new Date(job.nextAttemptAt + delay).toUTCString() : '420' },
      })));
    const updated = h.documents.get(key);
    if (status === 429 || status === 503) {
      assert.equal(updated.state, 'pending');
      assert.ok(updated.nextAttemptAt >= job.nextAttemptAt + delay - 1000);
    } else {
      assert.equal(updated.state, 'failed');
      assert.equal(updated.nextAttemptAt, null);
    }
    assert.equal(updated.errorCode, `resend-${status}`);
  }
});

test('billing portal verifies the authenticated bar owner and does not accept a customer or return URL from clients', async () => {
  const h = setup();
  await h.api.createBillingPortalSession(request({ customer: 'victim', return_url: 'https://evil.invalid' }));
  const portal = h.calls.find(call => call.action === 'portal');
  assert.equal(portal.data.customer, 'customer');
  assert.equal(portal.data.return_url, 'https://www.trobar.cat/subscripcio');
  h.options.subscription.metadata.firebaseUid = 'victim';
  await assert.rejects(h.api.createBillingPortalSession(request({})), error => error.code === 'failed-precondition');
});

test('an address changed or disabled after queueing cannot receive the queued message', async () => {
  for (const change of [account => { account.email = 'other@example.test'; }, account => { account.disabled = true; }]) {
    const h = setup();
    await h.api.recordFirstLogin({ auth: { uid: 'owner' } });
    const [key, job] = h.jobs()[0];
    change(h.options.authUser);
    await h.email.deliverEmailJob(h.database, h.stripe, h.ref(key), 'fixture-key', job.nextAttemptAt, () => { throw new Error('Must not send'); });
    assert.equal(h.documents.get(key).state, 'suppressed');
  }
});
