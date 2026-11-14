const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function harness({ googleStatus = 200, osmFailure = false, googlePlaces, osmBars = [] } = {}) {
    const calls = [];
    class OSMSearchError extends Error { constructor(code) { super(code); this.code = code; } }
    const module = { exports: {} };
    const amenities = { exports: {} };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../app/src/utils/googlePlaceAmenities.ts'), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText, { exports: amenities.exports });
    const place = { id: 'ChIJfixture', displayName: { text: 'Zurito' }, location: { latitude: 41.56, longitude: 2.01 }, types: ['restaurant'] };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../app/src/services/barDiscoveryService.ts'), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText, {
        exports: module.exports, process: { env: { EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: 'test-key-not-real' } },
        console: { info() {} },
        require(name) {
            if (name.endsWith('/googlePlaceAmenities')) return amenities.exports;
            if (name.endsWith('/osmService')) return { OSMSearchError, discoverUnregisteredBars: async () => {
                if (osmFailure) throw new Error('provider unavailable');
                return { bars: osmBars };
            } };
            if (name.endsWith('/core')) return { fetchWithTimeout: async (url, options) => {
                calls.push({ url, options });
                if (url.includes('nominatim')) return { ok: true, json: async () => [] };
                const body = JSON.parse(options.body);
                const status = typeof googleStatus === 'function' ? googleStatus(body) : googleStatus;
                return { ok: status === 200, status, json: async () => ({
                    places: typeof googlePlaces === 'function' ? googlePlaces(body) : googlePlaces || [place],
                }) };
            } };
            throw new Error(`Unexpected dependency ${name}`);
        },
    });
    return { ...module.exports, calls };
}

test('named search finds selectable venues when the geographic catalogue is empty', async () => {
    const service = harness();
    const result = await service.searchMapLocations('Zurito Terrassa', 41.56, 2.01);
    assert.equal(result.partial, false);
    assert.equal(result.suggestions.length, 1);
    assert.equal(result.suggestions[0].venue.googlePlaceId, 'ChIJfixture');
    assert.equal(result.suggestions[0].venue.id, 'google_ChIJfixture');
    assert.equal(result.suggestions[0].display_name, 'Zurito');
    assert.equal(result.suggestions[0].venue.amenities[0], 'food_served');
    assert.equal(JSON.parse(service.calls[0].options.body).maxResultCount, 5);
    assert(!service.calls[0].options.headers['X-Goog-FieldMask'].includes('reviews'));
});

test('manual discovery caps results and geographic reach; retains honest partial results on outages', async () => {
    const service = harness({ osmFailure: true });
    const result = await service.discoverMapBars(41.56, 2.01, 50);
    assert.equal(result.partial, true);
    assert.equal(result.bars.length, 1);
    const request = JSON.parse(service.calls[0].options.body);
    assert.equal(request.maxResultCount, 20);
    assert.equal(request.locationRestriction.circle.radius, 5000);
    const broken = harness({ googleStatus: 403, osmFailure: true });
    await assert.rejects(broken.discoverMapBars(41.56, 2.01, 2), /PLACES_HTTP_403/);
    await assert.rejects(service.discoverMapBars(41, 2, 2, { south: 40, north: 42, west: 1, east: 3 }), /OSM_AREA_TOO_LARGE/);
    assert.equal(service.calls.length, 3);
});

test('bars and cafes have independent result caps, broad categories and deduplicated provider identities', async () => {
    const service = harness({ googlePlaces: [
        { id: 'bar', displayName: { text: 'Bar' }, types: ['sports_bar'], location: { latitude: 41.56, longitude: 2.01 } },
        { id: 'cafe', displayName: { text: 'Cafeteria' }, types: ['cafeteria'], location: { latitude: 41.561, longitude: 2.01 } },
        { id: 'wine', displayName: { text: 'Vins' }, types: ['wine_bar'], location: { latitude: 41.562, longitude: 2.01 } },
        { id: 'grill', displayName: { text: 'Brasa' }, types: ['bar_and_grill'], location: { latitude: 41.563, longitude: 2.01 } },
    ] });
    const result = await service.discoverMapBars(41.56, 2.01, 1);
    assert.equal(result.bars.length, 4, 'each venue appears only once even if multiple category searches return it');
    const groups = service.calls.map(call => JSON.parse(call.options.body));
    assert.equal(groups.length, 3);
    assert(groups.every(group => group.maxResultCount === 20));
    const bars = groups.find(group => group.includedTypes.includes('bar'));
    assert(bars.includedTypes.includes('pub'));
    assert(bars.includedTypes.includes('sports_bar'));
    assert(!bars.includedTypes.includes('restaurant'), 'restaurants cannot exhaust the bar quota');
    assert(groups.some(group => group.includedTypes.includes('cafeteria') && !group.includedTypes.includes('restaurant')));
});

test('twenty restaurants cannot hide bars and cafes; saturation and individual group failures stay explicit', async () => {
    const make = (id, type) => ({
        id, displayName: { text: id }, types: [type], location: { latitude: 41.56, longitude: 2.01 },
    });
    const places = body => body.includedTypes.includes('restaurant')
        ? Array.from({ length: 20 }, (_, i) => make(`Restaurant ${i}`, 'restaurant'))
        : body.includedTypes.includes('bar') ? [make('Pub del barri', 'pub')] : [make('Cafeteria del barri', 'cafeteria')];
    const result = await harness({ googlePlaces: places }).discoverMapBars(41.56, 2.01, 1);
    assert.equal(result.bars.length, 22);
    assert(result.bars.some(bar => bar.name === 'Pub del barri'));
    assert(result.bars.some(bar => bar.name === 'Cafeteria del barri'));
    assert.equal(result.partial, true);
    const partial = await harness({
        googlePlaces: places,
        googleStatus: body => body.includedTypes.includes('bar') ? 503 : 200,
    }).discoverMapBars(41.56, 2.01, 1);
    assert.equal(partial.bars.length, 21);
    assert.equal(partial.partial, true);
});
test('reuses concurrent and recent requests; bounds the session Google request budget', async () => {
    const service = harness();
    await Promise.all([service.searchGoogleVenues('Local 1', 41, 2), service.searchGoogleVenues('Local 1', 41, 2)]);
    await service.searchGoogleVenues('Local 1', 41, 2);
    assert.equal(service.calls.length, 1);
    for (let i = 2; i <= 60; i++) await service.searchGoogleVenues(`Local ${i}`, 41, 2);
    await assert.rejects(service.searchGoogleVenues('Local 61', 41, 2), /PLACES_SESSION_LIMIT/);
    assert.equal(service.calls.length, 60);
});

test('keeps distinct neighboring bars, merges names only nearby and respects provider identity', () => {
    const { isSameVenue, mergeDiscoveredBars } = harness();
    const venue = { id: 'osm_node_1', name: 'Bar Veí', lat: 41, lon: 2 };
    const registered = { id: 'registered', name: 'Un altre bar', latitude: 41, longitude: 2 };
    assert.equal(isSameVenue(venue, registered), false);
    assert.equal(isSameVenue(venue, { ...registered, name: 'Bar Vei' }), true);
    assert.equal(isSameVenue(venue, { ...registered, name: 'Bar Vei', latitude: 42 }), false);
    assert.equal(mergeDiscoveredBars([venue], [{ ...venue, id: 'osm_way_1', name: 'Una altra cafeteria' }]).length, 2);
    assert.equal(mergeDiscoveredBars([venue], [{ ...venue, id: 'google_fixture', googlePlaceId: 'fixture' }]).length, 1);
});

test('Avril’s and Avril’s Café become one pin with Google details and both source credits', async () => {
    const osm = { id: 'osm_node_avril', name: "Avril's", lat: 41.388, lon: 2.154,
        source: 'openstreetmap', tags: { 'addr:housenumber': '137', 'addr:street': 'Rocafort' }, amenities: ['wifi'] };
    const google = { id: 'avril-place', displayName: { text: 'Avril’s Café' },
        location: { latitude: 41.38803, longitude: 2.15402 }, formattedAddress: 'Carrer de Rocafort, 137, Barcelona',
        types: ['cafe'], attributions: [{ provider: 'Provider', providerUri: 'https://example.test/credit' }] };
    const result = await harness({ osmBars: [osm], googlePlaces: [google] }).discoverMapBars(41.388, 2.154, 1);
    assert.equal(result.bars.length, 1);
    const venue = result.bars[0];
    assert.equal(venue.id, osm.id, 'keep the first marker identity stable while enriching it');
    assert.equal(venue.name, 'Avril’s Café');
    assert.equal(venue.googlePlaceId, google.id);
    assert.equal(venue.formattedAddress, google.formattedAddress);
    assert.equal(venue.tags['addr:street'], 'Rocafort');
    assert(venue.amenities.includes('wifi'));
    assert.deepEqual([...venue.sources].sort(), ['google', 'openstreetmap']);
    assert.equal(venue.attributions.length, 1);
    assert.equal(osm.googlePlaceId, undefined, 'never mutate provider input');
});

test('repeated or reversed scans retain Google metadata, OSM tags and every attribution', () => {
    const { mergeDiscoveredBars } = harness();
    const osm = { id: 'osm_avril', name: "Avril's", lat: 41, lon: 2, source: 'openstreetmap',
        tags: { wheelchair: 'yes' }, amenities: ['wheelchair_accessible'],
        attributions: [{ name: 'OSM provider', uri: 'https://example.test/osm' }] };
    const google = { id: 'google_avril', googlePlaceId: 'avril', name: "Avril's Café", lat: 41, lon: 2,
        source: 'google', formattedAddress: 'Rocafort, 137', tags: {}, amenities: ['food_served'],
        attributions: [{ name: 'Google provider', uri: 'https://example.test/google' }] };
    for (const [first, second] of [[osm, google], [google, osm]]) {
        const merged = mergeDiscoveredBars([first], [second]);
        const repeated = mergeDiscoveredBars(merged, [first, second]);
        assert.equal(repeated.length, 1);
        assert.equal(repeated[0].id, first.id);
        assert.equal(repeated[0].name, google.name);
        assert.equal(repeated[0].source, 'google');
        assert.equal(repeated[0].googlePlaceId, 'avril');
        assert.equal(repeated[0].tags.wheelchair, 'yes');
        assert.equal(repeated[0].amenities.length, 2);
        assert.equal(repeated[0].attributions.length, 2);
        assert.deepEqual([...repeated[0].sources].sort(), ['google', 'openstreetmap']);
    }
    assert.equal(mergeDiscoveredBars([osm, google], []).length, 1, 'clean up duplicates already present in session state');
});

test('descriptor matching is bounded and does not collapse nearby distinct identities or addresses', () => {
    const { isSameVenue, venueDistanceMeters } = harness();
    const venue = { id: 'osm_avril', name: "Avril's", lat: 41, lon: 2, tags: {} };
    const existing = { id: 'registered', name: "Avril's Cafè", latitude: 41, longitude: 2 };
    assert(isSameVenue(venue, existing));
    assert(isSameVenue({ ...venue, name: "Bar Avril's" }, existing));
    assert(!isSameVenue({ ...venue, name: 'Un altre cafè' }, existing));
    assert(!isSameVenue({ ...venue, name: 'Bar' }, { ...existing, name: 'Café' }));
    assert(!isSameVenue({ ...venue, tags: { 'addr:housenumber': '139' } }, { ...existing, address: 'Rocafort, 137' }));
    assert(!isSameVenue({ ...venue, googlePlaceId: 'first' }, { ...existing, googlePlaceId: 'second' }));
    assert(isSameVenue({ ...venue, googlePlaceId: 'same' }, { ...existing, googlePlaceId: 'same', latitude: 42 }));
    for (const [distance, expected] of [[34, true], [36, false]]) {
        const latitude = 41 + distance / 111194.9266;
        assert(Math.abs(venueDistanceMeters(41, 2, latitude, 2) - distance) < 0.01);
        assert.equal(isSameVenue(venue, { ...existing, latitude }), expected);
    }
    assert(!isSameVenue(venue, { ...existing, name: venue.name, latitude: 41.001 }));
    assert(isSameVenue(venue, { ...existing, name: venue.name, latitude: 41.001 }, 250), 'retain the existing detail-lookup range for exact names');
    assert(!isSameVenue(venue, { ...existing, latitude: 41.001 }, 250), 'a wider exact-name lookup must not widen descriptor-only matching');
});

test('does not turn a locality or an invalid location into a bar', async () => {
    const service = harness({ googlePlaces: [
        { id: 'city', displayName: { text: 'Terrassa' }, types: ['locality'], location: { latitude: 41, longitude: 2 } },
        { id: 'invalid', displayName: { text: 'Invalid' }, types: ['bar'], location: { latitude: 91, longitude: 2 } },
    ] });
    assert.equal((await service.searchGoogleVenues('Terrassa', 41, 2)).length, 0);
});
