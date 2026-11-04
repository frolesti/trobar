const { test } = require('node:test');
const assert = require('node:assert/strict');
const { harness, request } = require('./betaHarness.cjs');
const { createHash } = require('node:crypto');

const sessionToken = '12345678-1234-4234-8234-123456789abc';
const prediction = { placePrediction: { placeId: 'ChIJlocal', text: { text: 'Zurito Terrassa, Terrassa' },
  structuredFormat: { mainText: { text: 'Zurito Terrassa' }, secondaryText: { text: 'Carrer de la Rasa, Terrassa' } } } };
const place = { id: 'ChIJlocal', displayName: { text: 'Zurito Terrassa' }, formattedAddress: 'Carrer de la Rasa 2, Terrassa',
  location: { latitude: 41.56, longitude: 2.01 }, addressComponents: [
    { longText: 'Carrer de la Rasa', types: ['route'] }, { longText: '2', types: ['street_number'] },
    { longText: 'Terrassa', types: ['locality'] }, { longText: '08221', types: ['postal_code'] },
  ] };
const search = (query = 'Zurito Terrassa') => request({ query, sessionToken });
const details = (patch = {}) => request({ placeId: 'ChIJlocal', sessionToken, ...patch });

test('location callables require a verified account, bounded inputs and a UUID session', async () => {
  const h = harness();
  for (const name of ['searchRegistrationLocations', 'getRegistrationLocationDetails']) {
    await assert.rejects(h.api[name]({ data: {} }), { code: 'unauthenticated' });
    const unverified = search();
    unverified.auth.token.email_verified = false;
    await assert.rejects(h.api[name](unverified), { code: 'failed-precondition' });
  }
  for (const query of [null, {}, '  ', 'ab', 'x'.repeat(201)]) {
    await assert.rejects(h.api.searchRegistrationLocations(search(query)), { code: 'invalid-argument' });
  }
  for (const sessionToken of [undefined, {}, 'not-a-session']) {
    await assert.rejects(h.api.searchRegistrationLocations(request({ query: 'Zurito', sessionToken })), { code: 'invalid-argument' });
  }
  for (const placeId of ['', '../private', 'x'.repeat(256)]) {
    await assert.rejects(h.api.getRegistrationLocationDetails(details({ placeId })), { code: 'invalid-argument' });
  }
  assert.equal(h.calls.length, 0);
});

test('autocomplete returns business suggestions and forwards the session without caching Google content', async () => {
  const h = harness({ locationResults: { suggestions: [prediction] } });
  const response = await h.api.searchRegistrationLocations(search());
  assert.equal(response.results[0].primaryText, 'Zurito Terrassa');
  assert.equal(response.results[0].placeId, 'ChIJlocal');
  const [url, options] = h.calls[0].args;
  assert.equal(url, 'https://places.googleapis.com/v1/places:autocomplete');
  const body = JSON.parse(options.body);
  assert.equal(body.sessionToken, sessionToken);
  assert.deepEqual(body.includedRegionCodes, ['es']);
  assert.equal(body.languageCode, 'ca');
  assert.ok(options.signal);
  assert.equal([...h.documents.keys()].filter(key => key.startsWith('registrationLocationCache/')).length, 0);
});

test('details complete the session and return address components and coordinates for the selected business', async () => {
  const h = harness({ fetch: async url => ({ ok: true, json: async () =>
    url.includes('autocomplete') ? { suggestions: [prediction] } : place }) });
  await h.api.searchRegistrationLocations(search());
  const { place: result } = await h.api.getRegistrationLocationDetails(details());
  assert.equal(result.name, 'Zurito Terrassa');
  assert.equal(result.address, 'Carrer de la Rasa 2');
  assert.equal(result.city, 'Terrassa');
  assert.equal(result.postalCode, '08221');
  assert.equal(result.latitude, 41.56);
  assert.ok(h.calls[1].args[0].includes(`sessionToken=${sessionToken}`));
  assert.equal(h.calls[1].args[1].headers['X-Goog-FieldMask'], 'id,displayName,formattedAddress,addressComponents,location');
});

test('rapid searches are limited per account without blocking other owners or selection details', async () => {
  const h = harness();
  await h.api.searchRegistrationLocations(search());
  await assert.rejects(h.api.searchRegistrationLocations(search('Another place')), { code: 'resource-exhausted' });
  const other = search();
  other.auth.uid = 'other-owner';
  await h.api.searchRegistrationLocations(other);
  assert.equal(h.calls.length, 2);
});

test('the sixty-request window rejects request sixty-one and resets after one minute', async () => {
  const h = harness();
  const key = `registrationLocationLimits/${createHash('sha256').update('owner').digest('hex')}`;
  h.documents.set(key, { windowStart: Date.now(), lastRequestAt: Date.now() - 1000, count: 59 });
  await h.api.searchRegistrationLocations(search());
  assert.equal(h.documents.get(key).count, 60);
  await assert.rejects(h.api.getRegistrationLocationDetails(details()), { code: 'resource-exhausted' });
  h.documents.set(key, { windowStart: Date.now() - 60001, lastRequestAt: Date.now() - 1000, count: 60 });
  await h.api.searchRegistrationLocations(search());
  assert.equal(h.documents.get(key).count, 1);
});

test('HTTP errors, network errors and malformed data are visible instead of becoming empty results', async () => {
  for (const options of [{ locationStatus: 429 }, { locationStatus: 403 }, { locationError: true },
    { locationResults: [] }, { locationResults: { suggestions: {} } },
    { locationResults: { suggestions: [{ placePrediction: { placeId: '../private' } }] } }]) {
    const h = harness(options);
    await assert.rejects(h.api.searchRegistrationLocations(search()), { code: 'unavailable' });
  }
  for (const broken of [{ ...place, id: 'other-place' }, { ...place, location: { latitude: '41', longitude: 2 } },
    { ...place, location: { latitude: 91, longitude: 2 } }, { ...place, addressComponents: {} }]) {
    const h = harness({ locationResults: broken });
    await assert.rejects(h.api.getRegistrationLocationDetails(details()), { code: 'unavailable' });
  }
  const empty = harness();
  assert.equal((await empty.api.searchRegistrationLocations(search())).results.length, 0);
});
