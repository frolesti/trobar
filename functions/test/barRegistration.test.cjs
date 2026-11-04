const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness, request } = require('./betaHarness.cjs');
const data = () => ({
  businessName: 'Bar Beta', address: 'Carrer 1', city: 'Barcelona', postalCode: '08001',
  nif: 'B12345674', contactName: 'Propietari', billing: 'quarterly', acceptTerms: true,
  location: { latitude: 41.38, longitude: 2.17 },
  capacity: '30', screens: '2', role: 'admin', premium: true,
});

test('bar, owner and app profile persist atomically without granting unpaid premium', async () => {
  const h = harness({ customClaims: { unrelated: true }, documents: { 'users/owner': { preferences: { display: {} } } } });
  const result = await h.api.registerBar(request(data()));
  assert.equal(result.ok, true);
  assert.equal(h.documents.get(`bars/${result.barId}`).premium, false);
  assert.equal(h.documents.get(`bars/${result.barId}`).tier, 'free');
  assert.equal(h.documents.get(`bars/${result.barId}`).status, 'pending_checkout');
  assert.equal(h.documents.get(`bars/${result.barId}`).isActive, false);
  assert.equal(h.documents.get(`bars/${result.barId}`).location.latitude, 41.38);
  assert.equal('nif' in h.documents.get(`bars/${result.barId}`), false);
  assert.equal(h.documents.get('barOwners/owner').nif, 'B12345674');
  assert.equal(h.documents.get('barOwners/owner').taxIdValidation.method, 'checksum');
  assert.equal('verifiedAt' in h.documents.get(`bars/${result.barId}`), false);
  assert.equal(h.documents.get('barOwners/owner').barId, result.barId);
  assert.equal(h.documents.get('users/owner').ownedBars[0], result.barId);
  assert.equal(h.documents.get('users/owner').role, 'bar_owner');
  assert.ok(h.documents.get('users/owner').preferences);
  assert.equal(h.claims[0].data.unrelated, true);
});

test('retry and partial claims failure reuse the same persisted bar', async () => {
  const h = harness({ failClaims: true });
  await assert.rejects(h.api.registerBar(request(data())), /auth\/unavailable/);
  const id = h.documents.get('barOwners/owner').barId;
  const result = await h.api.registerBar(request(data()));
  assert.equal(result.barId, id);
  assert.equal([...h.documents.keys()].filter(key => key.startsWith('bars/')).length, 1);
  assert.equal(h.claims.length, 1);
});

test('pending drafts can be corrected without creating a second bar or activating them', async () => {
  const h = harness();
  const first = await h.api.registerBar(request(data()));
  const corrected = await h.api.registerBar(request({ ...data(), businessName: 'Bar corregit', description: 'Ambient de partit', billing: 'annual' }));
  assert.equal(corrected.barId, first.barId);
  const bar = h.documents.get(`bars/${first.barId}`);
  assert.equal(bar.name, 'Bar corregit');
  assert.equal(bar.description, 'Ambient de partit');
  assert.equal(bar.status, 'pending_checkout');
  assert.equal(bar.isActive, false);
  assert.equal(h.documents.get('barOwners/owner').billingCycle, 'annual');
  assert.equal([...h.documents.keys()].filter(key => key.startsWith('bars/')).length, 1);
});

test('a pending Stripe reservation blocks draft changes, while active bars are not overwritten by registration retries', async () => {
  const h = harness();
  const first = await h.api.registerBar(request(data()));
  const owner = h.documents.get('barOwners/owner');
  owner.checkoutExpiresAt = Math.floor(Date.now() / 1000) + 3600;
  assert.equal((await h.api.registerBar(request(data()))).barId, first.barId, 'identical retry must be able to resume Checkout');
  await assert.rejects(h.api.registerBar(request({ ...data(), businessName: 'No canviar' })), { code: 'failed-precondition' });
  assert.equal(h.documents.get(`bars/${first.barId}`).name, 'Bar Beta');
  h.documents.get(`bars/${first.barId}`).status = 'registered';
  await h.api.registerBar(request({ ...data(), businessName: 'No canviar' }));
  assert.equal(h.documents.get(`bars/${first.barId}`).name, 'Bar Beta');
});

test('failed transaction writes neither a partial profile nor claims', async () => {
  const h = harness({ failCommit: true });
  await assert.rejects(h.api.registerBar(request(data())), /firestore\/unavailable/);
  assert.equal(h.documents.size, 0);
  assert.equal(h.claims.length, 0);
});

test('invalid data, unauthenticated and unverified accounts fail without writes', async () => {
  for (const patch of [{ acceptTerms: 'yes' }, { businessName: {} }, { postalCode: 'abc' }, { billing: 'invalid' },
    { screens: '-1' }, { capacity: 'NaN' }, { description: {} }, { nif: 'B12345678' },
    { location: null }, { location: { latitude: '41.38', longitude: 2.17 } },
    { location: { latitude: 91, longitude: 2 } }, { location: { latitude: 41, longitude: Infinity } }]) {
    const h = harness();
    await assert.rejects(h.api.registerBar(request({ ...data(), ...patch })), { code: 'invalid-argument' });
    assert.equal(h.documents.size, 0);
  }
  const h = harness();
  await assert.rejects(h.api.registerBar({ data: data() }), { code: 'unauthenticated' });
  const unverified = request(data());
  unverified.auth.token.email_verified = false;
  await assert.rejects(h.api.registerBar(unverified), { code: 'failed-precondition' });
});

test('tax IDs accept valid CIF, DNI, NIE and special NIF and normalize without external lookups', async () => {
  for (const [input, expected] of [[' ES b-12345674 ', 'B12345674'], ['12345678z', '12345678Z'],
    ['X2482300W', 'X2482300W'], ['K1234567L', 'K1234567L'], ['P4622000J', 'P4622000J']]) {
    const h = harness();
    await h.api.registerBar(request({ ...data(), nif: input }));
    assert.equal(h.documents.get('barOwners/owner').nif, expected);
    assert.equal(h.calls.filter(call => call.action === 'location').length, 0);
  }
  for (const nif of ['12345678A', 'X2482300A', 'K1234567A', 'P4622000A', 'not-a-nif', '']) {
    const h = harness();
    await assert.rejects(h.api.registerBar(request({ ...data(), nif })), { code: 'invalid-argument' });
    assert.equal(h.documents.size, 0);
    assert.equal(h.claims.length, 0);
  }
});
