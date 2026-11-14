const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(require.resolve('../app/src/screens/BarDashboard/BarDashboardScreen.tsx'), 'utf8');
const ast = ts.createSourceFile('Dashboard.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function initializer(name) {
    let result;
    const visit = node => {
        if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) result = node.initializer.getText(ast);
        ts.forEachChild(node, visit);
    };
    visit(ast);
    assert(result, name);
    return result;
}
function harness(overrides = {}) {
    const calls = [];
    const context = {
        bar: { id: 'bar', tier: 'free' }, pendingBillingCycle: 'annual', billingCycle: 'monthly',
        subscriptionActive: true, subscriptionLoaded: true, billingOperationRef: { current: false },
        subscriptionRequestRef: { current: null }, useCallback: callback => callback,
        BILLING_PLANS: { annual: { label: 'Anual' } },
        setIsChangingPlan(value) { context.isChangingPlan = value; },
        setBillingCycle(value) { context.billingCycle = value; },
        setSubscriptionActive(value) { context.subscriptionActive = value; },
        setSubscriptionDetails(value) { context.subscriptionDetails = value; },
        setSubscriptionLoaded(value) { context.subscriptionLoaded = value; },
        setIsOpeningPortal(value) { context.isOpeningPortal = value; },
        setBar(update) { context.bar = update(context.bar); },
        setShowBillingConfirm(value) { context.showBillingConfirm = value; },
        setPendingBillingCycle(value) { context.pendingBillingCycle = value; },
        stripeChangeBillingCycle: async cycle => { calls.push(['change', cycle]); },
        openCheckout: async cycle => { calls.push(['checkout', cycle]); },
        openBillingPortal: async () => { calls.push(['portal']); },
        getSubscriptionStatus: async () => ({ active: true, billingCycle: 'annual' }),
        showToast: (...args) => calls.push(['toast', ...args]),
        showAlert: notice => calls.push(['notice', notice]),
        getUserFriendlyError: (_error, fallback) => fallback,
        console: { info() {} }, ...overrides,
    };
    vm.createContext(context);
    for (const name of ['handleConfirmBillingChange', 'dismissBillingConfirmation', 'refreshSubscription', 'handleManageSubscription']) {
        vm.runInContext(ts.transpileModule(`globalThis.${name} = ${initializer(name)};`, {
            compilerOptions: { target: ts.ScriptTarget.ES2022 },
        }).outputText, context);
    }
    return { context, calls };
}

test('test bars simulate changes without checkout, Stripe or changing their stored identity', async () => {
    const { context, calls } = harness({ bar: { id: 'demo', isTestData: true, tier: 'premium' } });
    await context.handleConfirmBillingChange();
    assert.equal(context.billingCycle, 'annual');
    assert.equal(context.bar.tier, 'premium');
    assert.equal(context.bar.isTestData, true);
    assert.equal(calls.filter(call => ['change', 'checkout'].includes(call[0])).length, 0);
    assert.match(calls[0][1].message, /cap càrrec/);
    assert.equal(context.billingOperationRef.current, false);
});

test('subscription management opens the shared portal once and refreshes after returning', async () => {
    let finish;
    const { context, calls } = harness({
        openBillingPortal: () => new Promise(resolve => { finish = resolve; }),
    });
    const first = context.handleManageSubscription();
    assert.equal(context.isOpeningPortal, true);
    await context.handleManageSubscription();
    assert.equal(context.subscriptionDetails, undefined);
    finish();
    await first;
    assert.equal(context.subscriptionDetails.active, true);
    assert.equal(context.isOpeningPortal, false);
    assert.equal(context.billingOperationRef.current, false);
    assert.equal(calls.filter(call => call[0] === 'toast').length, 0);
});

test('demo bars never open billing and portal failures release controls without exposing provider details', async () => {
    const demo = harness({ bar: { isTestData: true } });
    await demo.context.handleManageSubscription();
    assert.equal(demo.calls.filter(call => call[0] === 'portal').length, 0);
    const failed = harness({ openBillingPortal: async () => { throw new Error('Private portal session'); } });
    await failed.context.handleManageSubscription();
    assert.equal(failed.context.isOpeningPortal, false);
    assert.equal(failed.context.billingOperationRef.current, false);
    assert.equal(failed.calls[0][2], 'error');
    assert.doesNotMatch(failed.calls[0][1], /Private/);
});

test('live changes cannot be submitted twice or dismissed during an in-flight write', async () => {
    const { context, calls } = harness();
    let finish;
    context.stripeChangeBillingCycle = cycle => {
        calls.push(['change', cycle]);
        return new Promise(resolve => { finish = resolve; });
    };
    const first = context.handleConfirmBillingChange();
    await context.handleConfirmBillingChange();
    context.dismissBillingConfirmation();
    assert.equal(context.pendingBillingCycle, 'annual');
    assert.equal(context.billingCycle, 'monthly');
    assert.equal(calls.length, 1);
    finish();
    await first;
    assert.equal(context.billingCycle, 'annual');
    assert.equal(context.pendingBillingCycle, null);
    assert.equal(context.isChangingPlan, false);
});

test('inactive accounts open checkout without pretending payment is completed; unknown status blocks it', async () => {
    for (const loaded of [true, false]) {
        const { context, calls } = harness({ subscriptionActive: false, subscriptionLoaded: loaded });
        await context.handleConfirmBillingChange();
        assert.equal(calls.filter(call => call[0] === 'checkout').length, loaded ? 1 : 0);
        assert.equal(context.subscriptionActive, false);
        assert.equal(context.billingCycle, 'monthly');
        if (!loaded) assert.equal(calls[0][2], 'error');
    }
});

test('failed subscription changes preserve the pending choice and never show success', async () => {
    const { context, calls } = harness({ stripeChangeBillingCycle: async () => { throw new Error('API details'); } });
    await context.handleConfirmBillingChange();
    assert.equal(context.billingCycle, 'monthly');
    assert.equal(context.pendingBillingCycle, 'annual');
    assert.equal(calls[0][2], 'error');
    assert(!calls[0][1].includes('API details'));
    assert.equal(context.billingOperationRef.current, false);
});

test('foreground refresh shares the request and uses authoritative status to update the owner preview', async () => {
    const { context } = harness();
    let finish, requests = 0;
    context.getSubscriptionStatus = () => { requests++; return new Promise(resolve => { finish = resolve; }); };
    const first = context.refreshSubscription();
    assert.equal(context.refreshSubscription(), first);
    await new Promise(resolve => setImmediate(resolve));
    finish({ active: true, billingCycle: 'annual' });
    await first;
    assert.equal(requests, 1);
    assert.equal(context.bar.tier, 'premium');
    assert.equal(context.subscriptionRequestRef.current, null);
    context.getSubscriptionStatus = async () => { throw new Error('Internal error'); };
    await context.refreshSubscription();
    assert.equal(context.subscriptionLoaded, false);
    assert.equal(context.subscriptionDetails, null);
    assert.equal(context.subscriptionRequestRef.current, null);
});

function portalService(platform, url, failure) {
    const calls = [];
    const popup = { closed: false, opener: {}, location: { replace: value => calls.push(['navigate', value]) },
        close() { this.closed = true; calls.push(['close']); } };
    const exports = {};
    const browserWindow = { open: () => { calls.push(['popup']); return popup; } };
    const service = fs.readFileSync(require.resolve('../app/src/services/subscriptionService.ts'), 'utf8');
    vm.runInNewContext(ts.transpileModule(service, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, {
        exports, URL: class { constructor() { throw new Error('Native URL parser is unavailable'); } },
        window: browserWindow,
        require: name => {
            if (name === 'firebase/functions') return { httpsCallable: (_functions, callable) => async data => {
                calls.push(['callable', callable, data]);
                if (failure) throw failure;
                return { data: { url } };
            } };
            if (name === 'react-native') return { Platform: { OS: platform } };
            if (name === 'expo-web-browser') return { openBrowserAsync: async value => calls.push(['browser', value]) };
            if (name === '../config/firebase') return { functions: {} };
            throw new Error(`Unexpected dependency: ${name}`);
        },
    });
    return { exports, calls, popup, window: browserWindow };
}

test('native and web use the same authenticated callable without customer IDs; web pre-opens and isolates its tab', async () => {
    for (const platform of ['ios', 'android', 'web']) {
        const result = portalService(platform, 'https://billing.stripe.com/p/session/test');
        await result.exports.openBillingPortal();
        const callable = result.calls.find(call => call[0] === 'callable');
        assert.equal(callable[1], 'createBillingPortalSession');
        assert.equal(Object.keys(callable[2]).length, 0);
        assert.equal(result.calls.filter(call => call[0] === (platform === 'web' ? 'navigate' : 'browser')).length, 1);
        if (platform === 'web') {
            assert.equal(result.calls[0][0], 'popup');
            assert.equal(result.popup.opener, null);
        }
    }
});

test('unsafe portal responses and backend failures never navigate and clean up the blank web tab', async () => {
    for (const url of [undefined, 'http://billing.stripe.com/x', 'https://billing.stripe.com.evil.invalid/x',
        'https://user:secret@billing.stripe.com/x', 'https://billing.stripe.com/\\evil.invalid',
        'https://billing.stripe.com/x\n', 'https://billing.stripe.com:444/x',
        'javascript:alert(1)', 'not a url']) {
        const result = portalService('web', url);
        await assert.rejects(result.exports.openBillingPortal(), /SUBSCRIPTION_PORTAL_UNAVAILABLE/);
        assert.equal(result.calls.filter(call => call[0] === 'navigate').length, 0);
        assert.equal(result.popup.closed, true);
    }
    const failed = portalService('web', undefined, new Error('Authentication required'));
    await assert.rejects(failed.exports.openBillingPortal(), /Authentication required/);
    assert.equal(failed.popup.closed, true);
});

test('blocked popups report an actionable error before creating any portal session', async () => {
    const result = portalService('web', 'https://billing.stripe.com/p/session/test');
    result.window.open = () => null;
    await assert.rejects(result.exports.openBillingPortal(), error => error.code === 'billing/popup-blocked');
    assert.equal(result.calls.length, 0);
});
