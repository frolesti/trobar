const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function loadService(fetchWithTimeout) {
    const moduleStub = { exports: {} };
    const source = fs.readFileSync(require('node:path').join(__dirname, '../app/src/services/osmService.ts'), 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    vm.runInNewContext(code, {
        module: moduleStub, exports: moduleStub.exports,
        require: () => ({ fetchWithTimeout }),
        Date, Map, console: { warn() {}, error() {} },
        process: { env: { EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: 'test-key' } },
        setTimeout: callback => { callback(); return 0; },
    });
    return moduleStub.exports;
}

function response(elements, extra = {}) {
    return { ok: true, status: 200, json: async () => ({ elements, ...extra }) };
}

test('rejects unbounded areas and invalid inputs before making a network call', async () => {
    let calls = 0;
    const service = loadService(async () => { calls++; return response([]); });
    await assert.rejects(service.fetchBarsFromOSMBounds(40, 1, 43, 4), { code: 'OSM_AREA_TOO_LARGE' });
    await assert.rejects(service.fetchBarsFromOSM(NaN, 2, 1), { code: 'OSM_INVALID_COORDINATES' });
    assert.equal(calls, 0);
});

test('shares concurrent requests, caches results and drops invalid coordinates', async () => {
    let calls = 0;
    const service = loadService(async (url, options) => {
        assert.match(options.headers['User-Agent'], /Trobar/);
        assert.equal(url, 'https://overpass.kumi.systems/api/interpreter');
        calls++;
        return response([
            { id: 1, type: 'node', lat: 0, lon: 0, tags: { name: 'Zero' } },
            { id: 2, type: 'way', center: { lat: 1, lon: 1 }, tags: { name: 'Way' } },
            { id: 3, type: 'node', tags: { name: 'Invalid' } },
        ]);
    });
    const [first, second] = await Promise.all([service.fetchBarsFromOSM(0, 0, 1), service.fetchBarsFromOSM(0, 0, 1)]);
    assert.equal(calls, 1);
    assert.equal(first, second);
    assert.equal(first.length, 2);
    assert.equal(first[0].lat, 0);
    assert.match(first[0].id, /^osm_[0-9]+$/);
    await service.fetchBarsFromOSM(0, 0, 1);
    assert.equal(calls, 1);
});

test('timeout on first mirror tries the next mirror instead of returning false empty success', async () => {
    let calls = 0;
    const service = loadService(async () => {
        if (++calls === 1) { const error = new Error('timeout'); error.name = 'AbortError'; throw error; }
        return response([{ id: 1, lat: 41, lon: 2, tags: { name: 'Bar' } }]);
    });
    assert.equal((await service.fetchBarsFromOSM(41, 2, 1)).length, 1);
    assert.equal(calls, 2);
});

test('partial HTTP 200 response is retried and never cached as empty success', async () => {
    let calls = 0;
    const service = loadService(async () => ++calls === 1 ? response([], { remark: 'runtime error: timeout' }) : response([{ id: 1, lat: 41, lon: 2, tags: { name: 'Bar' } }]));
    assert.equal((await service.fetchBarsFromOSM(41, 2, 1)).length, 1);
    assert.equal(calls, 2);
});

test('provider outage preserves errors and backs off repeated requests', async () => {
    let calls = 0;
    const service = loadService(async () => { calls++; return { ok: false, status: 503 }; });
    await assert.rejects(service.fetchBarsFromOSM(41, 2, 1), { code: 'OSM_OVERPASS_UNAVAILABLE' });
    await assert.rejects(service.fetchBarsFromOSM(41, 2, 1), { code: 'OSM_OVERPASS_UNAVAILABLE' });
    assert.equal(calls, 2);
});

test('OSM map fallback produces map markers after Overpass fails and caches its bounded area', async () => {
    const calls = [];
    const service = loadService(async (url, options) => {
        calls.push(url);
        if (!url.includes('api.openstreetmap.org')) return { ok: false, status: 500 };
        const bbox = url.split('bbox=')[1].split(',').map(Number);
        assert(bbox[2] - bbox[0] <= 0.01001);
        assert(bbox[3] - bbox[1] <= 0.01001);
        return response([
            { id: 1, type: 'node', lat: 41, lon: 2, tags: { name: 'Bar nearby', amenity: 'bar' } },
            { id: 2, type: 'node', lat: 41.001, lon: 2.001 },
            { id: 3, type: 'node', lat: 41.002, lon: 2.002 },
            { id: 4, type: 'way', nodes: [2, 3], tags: { name: 'Pub way', amenity: 'pub' } },
            { id: 5, type: 'node', lat: 43, lon: 2, tags: { name: 'Outside', amenity: 'bar' } },
        ]);
    });
    const result = await service.discoverUnregisteredBars(41, 2, 1);
    assert.equal(result.provider, 'openstreetmap');
    assert.equal(result.bars.length, 2);
    assert.equal(result.bars[0].id, 'osm_1');
    assert.equal(result.bars[1].id, 'osm_4');
    assert.equal(result.limitedArea, true);
    await service.discoverUnregisteredBars(41, 2, 1);
    assert.equal(calls.length, 3);
});

test('successful OSM and invalid search areas never trigger billable fallback', async () => {
    let calls = 0;
    const service = loadService(async url => { calls++; assert(!url.includes('googleapis')); return response([]); });
    assert.equal((await service.discoverUnregisteredBars(41, 2, 1)).provider, 'openstreetmap');
    await assert.rejects(service.discoverUnregisteredBars(41, 2, 1, { south: 40, west: 1, north: 43, east: 4 }), { code: 'OSM_AREA_TOO_LARGE' });
    assert.equal(calls, 1);
});

test('temporarily skips a failed mirror when a different area is searched', async () => {
    const calls = [];
    const service = loadService(async url => {
        calls.push(url);
        return url.includes('kumi') ? { ok: false, status: 500 } : response([]);
    });
    await service.fetchBarsFromOSM(41, 2, 1);
    await service.fetchBarsFromOSM(42, 2, 1);
    assert.equal(calls.length, 3);
    assert.equal(calls.filter(url => url.includes('kumi')).length, 1);
});

test('small visible areas use map API immediately without waiting for two Overpass timeouts', async () => {
    const calls = [];
    const service = loadService(async (url, options, context, timeout, level) => {
        calls.push(url);
        assert(url.includes('api.openstreetmap.org'));
        assert.equal(level, 'warn');
        assert.equal(timeout, 10000);
        return response([{ id: 10, type: 'node', lat: 41, lon: 2, tags: { name: 'Nearby', amenity: 'bar' } }]);
    });
    const bounds = { south: 40.999, north: 41.001, west: 1.999, east: 2.001 };
    const result = await service.discoverUnregisteredBars(41, 2, 1, bounds);
    assert.equal(result.bars.length, 1);
    await service.discoverUnregisteredBars(41, 2, 1, bounds);
    assert.equal(calls.length, 1);
});

test('recoverable mirror timeouts use warning severity and bounded waits before successful fallback', async () => {
    const calls = [];
    const service = loadService(async (url, options, context, timeout, level) => {
        calls.push(url);
        assert.equal(level, 'warn');
        if (url.includes('overpass')) {
            assert.equal(timeout, 4000);
            throw new Error('timeout');
        }
        return response([]);
    });
    const result = await service.discoverUnregisteredBars(41, 2, 1);
    assert.equal(result.provider, 'openstreetmap');
    assert.equal(calls.length, 3);
});