const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function harness({ responses = [], searchId = 'place', fetch } = {}) {
    const calls = [];
    const searches = [];
    const identities = [];
    const logs = [];
    const module = { exports: {} };
    const place = id => ({
        id, displayName: { text: 'Local' }, types: ['bar'],
        photos: Array.from({ length: 5 }, (_, i) => ({ name: `places/${id}/photos/photo${i}` })),
    });
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../app/src/services/placesService.ts'), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText, {
        exports: module.exports, process: { env: { EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: 'test-key-not-real' } },
        console: { info: (...args) => logs.push(args) },
        require(name) {
            if (name.endsWith('/googlePlaceAmenities')) return {};
            if (name.endsWith('/barDiscoveryService')) return {
                isSameVenue: (...args) => { identities.push(args); return true; },
                searchGoogleVenues: async (...args) => {
                    searches.push(args);
                    return [{ name: args[0], lat: args[1], lon: args[2], googlePlaceId: searchId }];
                },
            };
            if (name.endsWith('/core')) return { fetchWithTimeout: async (url, options) => {
                calls.push({ url, options });
                if (fetch) return fetch(url);
                const next = responses.length ? responses.shift() : { status: 200 };
                if (next instanceof Error) throw next;
                const id = url.split('/').pop();
                return { ok: next.status === 200, status: next.status, json: async () => next.data || place(id) };
            } };
            throw new Error(`Unexpected dependency ${name}`);
        },
    });
    return { ...module.exports, calls, searches, identities, logs, place };
}

test('shares concurrent place details across callers, but refreshes completed responses and keeps three photos', async () => {
    let release;
    const service = harness({ fetch: () => new Promise(resolve => { release = resolve; }) });
    const first = service.getPlaceDetails('place');
    const second = service.fetchBarPlaceDetails('Local', 41, 2, 'place');
    assert.equal(service.calls.length, 1);
    release({ ok: true, status: 200, json: async () => service.place('place') });
    const [details, bar] = await Promise.all([first, second]);
    assert.equal(details, bar);
    assert.equal(details.photoUrls.length, 3);
    assert(details.photoUrls.every(url => url.includes('maxWidthPx=400')));
    const fresh = service.getPlaceDetails('place');
    assert.equal(service.calls.length, 2, 'completed content is not retained as a permanent cache');
    release({ ok: true, status: 200, json: async () => ({ ...service.place('place'), rating: 4.7 }) });
    assert.equal((await fresh).rating, 4.7);
});

test('deduplicates complete discovery pipelines and remembers only place IDs for later openings', async () => {
    const service = harness();
    const results = await Promise.all(Array.from({ length: 10 }, () => service.fetchBarPlaceDetails('Local', 41, 2)));
    assert.equal(results.length, 10);
    assert.equal(service.searches.length, 1);
    assert.equal(service.identities[0][1].name, 'Local');
    assert.equal(service.identities[0][1].latitude, 41);
    assert.equal(service.identities[0][1].longitude, 2);
    assert.equal(service.identities[0][2], 250, 'delegate to the shared matcher while retaining the exact-name lookup radius');
    assert.equal(service.calls.length, 1);
    await service.fetchBarPlaceDetails('Local', 41, 2);
    assert.equal(service.searches.length, 1, 'a later opening reuses the known place ID');
    assert.equal(service.calls.length, 2, 'details and photo references are freshly requested');
    await service.fetchBarPlaceDetails('Local', 42, 2);
    await service.fetchBarPlaceDetails('Another local', 41, 2);
    assert.equal(service.searches.length, 3, 'different venues cannot share an ID just by name or location');
});

test('recovers a 404 once and reuses the replacement even when callers still supply the old ID', async () => {
    const service = harness({ responses: [{ status: 404 }, { status: 200 }] });
    assert.equal((await service.fetchBarPlaceDetails('Local', 41, 2, 'old')).placeId, 'place');
    await service.fetchBarPlaceDetails('Local', 41, 2, 'old');
    assert.deepEqual(service.calls.map(call => call.url.split('/').pop()), ['old', 'place', 'place']);
    assert.equal(service.searches.length, 1);
    await service.fetchBarPlaceDetails('Local', 41, 2, 'explicit-new-id');
    assert.equal(service.calls.at(-1).url.split('/').pop(), 'explicit-new-id', 'a changed supplied ID takes precedence');
});

test('does not duplicate a failed lookup when discovery returns the same missing ID', async () => {
    const service = harness({ responses: [{ status: 404 }], searchId: 'old' });
    assert.equal(await service.fetchBarPlaceDetails('Local', 41, 2, 'old'), null);
    assert.equal(service.calls.length, 1);
    assert.equal(service.searches.length, 1);
});

test('provider failures are logged, not cached and never trigger paid fallback searches', async () => {
    for (const response of [{ status: 403 }, { status: 429 }, { status: 503 }, new Error('timeout'), { status: 200, data: {} }]) {
        const service = harness({ responses: [response] });
        const first = service.fetchBarPlaceDetails('Local', 41, 2, 'known');
        const second = service.fetchBarPlaceDetails('Local', 41, 2, 'known');
        assert.deepEqual(await Promise.all([first, second]), [null, null]);
        assert.equal(service.calls.length, 1);
        assert.equal(service.searches.length, 0);
        assert.equal(service.logs.length, 1);
        assert((await service.fetchBarPlaceDetails('Local', 41, 2, 'known')).placeId, 'a later retry succeeds');
        assert.equal(service.calls.length, 2);
    }
});

test('place-ID reuse is bounded to 200 venue keys', async () => {
    const service = harness();
    for (let i = 0; i < 201; i++) await service.fetchBarPlaceDetails(`Local ${i}`, 41, 2);
    assert.equal(service.searches.length, 201);
    await service.fetchBarPlaceDetails('Local 200', 41, 2);
    assert.equal(service.searches.length, 201);
    await service.fetchBarPlaceDetails('Local 0', 41, 2);
    assert.equal(service.searches.length, 202);
});
