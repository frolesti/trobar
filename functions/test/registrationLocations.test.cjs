const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness, request } = require('./betaHarness.cjs');

const place = { place_id: 1, name: 'Bar de prova', display_name: 'Bar de prova, Barcelona',
  lat: '41.38', lon: '2.17', address: { road: 'Carrer de prova', city: 'Barcelona', postcode: '08001' } };

test('location callable requires a verified account and a bounded query', async () => {
  const h = harness();
  await assert.rejects(h.api.searchRegistrationLocations({ data: { query: 'Barcelona' } }), { code: 'unauthenticated' });
  const unverified = request({ query: 'Barcelona' });
  unverified.auth.token.email_verified = false;
  await assert.rejects(h.api.searchRegistrationLocations(unverified), { code: 'failed-precondition' });
  for (const query of [null, {}, '  ', 'ab', 'x'.repeat(201)]) {
    await assert.rejects(h.api.searchRegistrationLocations(request({ query })), { code: 'invalid-argument' });
  }
  assert.equal(h.calls.length, 0);
});

test('location API returns coordinates and caches normalized queries without further traffic', async () => {
  const h = harness({ locationResults: [place] });
  const first = await h.api.searchRegistrationLocations(request({ query: ' Barcelona ' }));
  const cached = await h.api.searchRegistrationLocations(request({ query: 'BARCELONA' }));
  assert.equal(first.results[0].lat, '41.38');
  assert.equal(cached.results[0].display_name, place.display_name);
  assert.equal(h.calls.length, 1);
  const { args: [url, options] } = h.calls[0];
  assert.equal(url.searchParams.get('countrycodes'), 'es');
  assert.equal(url.searchParams.get('format'), 'jsonv2');
  assert.match(options.headers['User-Agent'], /troBar/);
  assert.ok(options.signal);
  await assert.rejects(h.api.searchRegistrationLocations(request({ query: 'Girona' })), { code: 'resource-exhausted' });
  assert.equal(h.calls.length, 1);
});

test('simultaneous searches across users share one upstream request slot', async () => {
  const h = harness({ locationResults: [place] });
  const results = await Promise.allSettled([
    h.api.searchRegistrationLocations(request({ query: 'Barcelona' })),
    h.api.searchRegistrationLocations({ ...request({ query: 'Girona' }), auth: { uid: 'other', token: { email_verified: true } } }),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.code, 'resource-exhausted');
  assert.equal(h.calls.length, 1);
});

test('HTTP errors, network errors and malformed locations fail explicitly and are not cached', async () => {
  for (const options of [{ locationStatus: 429 }, { locationStatus: 503 }, { locationError: true },
    { locationResults: {} }, { locationResults: [{ ...place, lat: 'NaN' }] },
    { locationResults: [{ ...place, lon: '181' }] }, { locationResults: [{ ...place, lat: '' }] }]) {
    const h = harness(options);
    await assert.rejects(h.api.searchRegistrationLocations(request({ query: 'Barcelona' })), { code: 'unavailable' });
    assert.equal([...h.documents.keys()].filter(key => key.startsWith('registrationLocationCache/')).length, 0);
  }
  const empty = harness();
  assert.equal((await empty.api.searchRegistrationLocations(request({ query: 'Unknown bar' }))).results.length, 0);
});
