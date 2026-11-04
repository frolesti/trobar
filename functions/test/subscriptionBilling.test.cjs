const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(require.resolve('../src/index.ts'), 'utf8');
const ast = ts.createSourceFile('index.ts', source, ts.ScriptTarget.Latest, true);
function element(name) {
    let result;
    const visit = node => {
        if (ts.isFunctionDeclaration(node) && node.name?.text === name) result = node.getText(ast);
        if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) result = `globalThis.${name} = ${node.initializer.getText(ast)};`;
        ts.forEachChild(node, visit);
    };
    visit(ast);
    assert(result, name);
    return result;
}
function harness({ demo = false, status = 'active', failRetrieve = false } = {}) {
    const calls = [];
    const records = {
        'barOwners/u': { barId: 'b', stripeSubscriptionId: 'sub', stripeCustomerId: 'customer', subscriptionStatus: status, billingCycle: 'monthly' },
        'bars/b': { ownerId: 'u', isTestData: demo, tier: 'free' },
    };
    const subscription = {
        id: 'sub', customer: 'customer', status, trial_end: null, cancel_at_period_end: false,
        metadata: { firebaseUid: 'u', barId: 'b', billingCycle: 'monthly' },
        items: { data: [{ id: 'item', price: { id: 'price_monthly' }, current_period_end: 123456 }] },
    };
    const ref = (collection, id) => ({
        key: `${collection}/${id}`, id,
        async get() { return { exists: !!records[this.key], data: () => structuredClone(records[this.key]), id, ref: this }; },
        async update(data) { Object.assign(records[this.key], data); },
    });
    const db = {
        collection(name) { return {
            doc: id => ref(name, id),
            where() { return { limit() { return { get: async () => ({ empty: false, docs: [await ref('barOwners', 'u').get()] }) }; } }; },
        }; },
        async runTransaction(callback) {
            const writes = [];
            const result = await callback({ get: item => item.get(), update: (item, data) => writes.push([item, data]),
                set: (item, data) => writes.push([item, data]) });
            for (const [item, data] of writes) await item.update(data);
            return result;
        },
    };
    const stripe = {
        prices: { retrieve: async id => ({
            active: true, currency: 'eur', unit_amount: id === 'price_monthly' ? 3900 : id === 'price_quarterly' ? 9900 : 34800,
            recurring: { interval: id === 'price_annual' ? 'year' : 'month', interval_count: id === 'price_quarterly' ? 3 : 1 },
        }) },
        subscriptions: {
            list: async () => ({ data: [] }),
            async retrieve(id) { calls.push(['retrieve', id]); if (failRetrieve) throw new Error('Stripe internal error'); return structuredClone(subscription); },
            async update(id, data) { calls.push(['update', id, data]); subscription.items.data[0].price.id = data.items[0].price; Object.assign(subscription.metadata, data.metadata); return structuredClone(subscription); },
        },
        customers: { create: async () => ({ id: 'customer' }) },
        checkout: { sessions: { create: async data => { calls.push(['checkout', data]); return { id: 'session', url: 'https://checkout.stripe.com/c/pay/test' }; } } },
        webhooks: { constructEvent: () => context.event },
    };
    class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
    const context = {
        db, console: { info() {}, log() {}, error() {} }, HttpsError, URL, process: { env: {} },
        stripeSecretKey: { value: () => '' }, stripeWebhookSecret: { value: () => '' },
        getStripe: () => { calls.push(['client']); return stripe; },
        STRIPE_PRICE_IDS: { monthly: 'price_monthly', quarterly: 'price_quarterly', annual: 'price_annual' },
        FieldValue: { serverTimestamp: () => 999 },
        onCall: (_config, callback) => callback, onRequest: (_config, callback) => callback,
    };
    vm.createContext(context);
    for (const name of ['configuredPrice', 'validateStripePrice', 'checkoutReturnUrl', 'isBillingCycle', 'subscriptionCycle',
        'subscriptionPeriodEnd', 'assertBillableBar', 'assertOwnedSubscription', 'syncSubscriptionState',
        'createCheckoutSession', 'changeBillingCycle', 'getSubscriptionStatus', 'stripeWebhook']) {
        vm.runInContext(ts.transpileModule(element(name), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
    }
    return { context, calls, records, subscription };
}
const request = data => ({ auth: { uid: 'u', token: { email_verified: true } }, data });

test('demo bars cannot create or change a real subscription, including direct callable access', async () => {
    const { context, calls } = harness({ demo: true });
    for (const [name, data] of [['createCheckoutSession', { billingCycle: 'monthly' }], ['changeBillingCycle', { newCycle: 'annual' }], ['getSubscriptionStatus', {}]]) {
        await assert.rejects(context[name](request(data)), error => error.code === 'failed-precondition');
    }
    assert.equal(calls.length, 0);
});

test('checkout rejects an existing subscription; a canceled account gets the selected price and 14-day trial', async () => {
    const live = harness();
    await assert.rejects(live.context.createCheckoutSession(request({ billingCycle: 'monthly' })), error => error.code === 'failed-precondition');
    assert(!live.calls.some(call => call[0] === 'checkout'));
    const canceled = harness({ status: 'canceled' });
    await canceled.context.createCheckoutSession(request({ billingCycle: 'quarterly' }));
    const checkout = canceled.calls.find(call => call[0] === 'checkout')[1];
    assert.equal(checkout.line_items[0].price, 'price_quarterly');
    assert.equal(checkout.subscription_data.trial_period_days, 14);
});

test('status reads the actual Stripe price and item period, and never disguises provider failures as inactive', async () => {
    const fixture = harness();
    fixture.subscription.items.data[0].price.id = 'price_annual';
    const status = await fixture.context.getSubscriptionStatus(request({}));
    assert.equal(status.billingCycle, 'annual');
    assert.equal(status.currentPeriodEnd, 123456);
    const failed = harness({ failRetrieve: true });
    await assert.rejects(failed.context.getSubscriptionStatus(request({})), error => error.code === 'unavailable');
});

test('live cycle changes persist the cycle without changing the feature tier', async () => {
    const { context, records, calls } = harness();
    const result = await context.changeBillingCycle(request({ newCycle: 'annual' }));
    assert.equal(result.ok, true);
    assert.equal(result.currentPeriodEnd, 123456);
    assert.equal(records['barOwners/u'].billingCycle, 'annual');
    assert.equal(records['bars/b'].billing, 'annual');
    assert.equal(calls.find(call => call[0] === 'update')[2].proration_behavior, 'create_prorations');
});

test('atomic webhook synchronization grants trial Premium, revokes inactive plans, ignores stale events and protects demos', async () => {
    for (const state of ['trialing', 'active', 'past_due', 'canceled']) {
        const { context, records, subscription } = harness({ status: state });
        await context.syncSubscriptionState(subscription, 10);
        assert.equal(records['bars/b'].tier, ['trialing', 'active'].includes(state) ? 'premium' : 'free');
        assert.equal(records['barOwners/u'].subscriptionStatus, state);
        assert.equal(records['barOwners/u'].currentPeriodEnd, 123456);
    }
    const old = harness({ status: 'past_due' });
    old.records['barOwners/u'].lastStripeEventCreated = 20;
    await old.context.syncSubscriptionState(old.subscription, 10);
    assert.equal(old.records['barOwners/u'].lastStripeEventCreated, 20);
    const demo = harness({ demo: true });
    await demo.context.syncSubscriptionState(demo.subscription, 10);
    assert.equal(demo.records['bars/b'].tier, 'free');
    assert.equal(demo.records['barOwners/u'].lastStripeEventCreated, undefined);
});

test('delayed subscription webhook uses the latest Stripe state rather than its stale payload', async () => {
    const { context, records, subscription } = harness();
    context.event = { type: 'customer.subscription.updated', created: 10, data: { object: { ...subscription, status: 'past_due' } } };
    let received = false;
    const response = { status(code) { assert.equal(code, 200); return this; }, json(data) { received = data.received; } };
    await context.stripeWebhook({ method: 'POST', headers: { 'stripe-signature': 'fixture' }, rawBody: Buffer.from('fixture') }, response);
    assert.equal(received, true);
    assert.equal(records['bars/b'].tier, 'premium');
});
