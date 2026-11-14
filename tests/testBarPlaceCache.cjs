const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function harness({ fail = false } = {}) {
    const writes = [];
    const logs = [];
    const module = { exports: {} };
    const amenities = { exports: {} };
    const compile = file => ts.transpileModule(fs.readFileSync(require.resolve(file), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText;
    vm.runInNewContext(compile('../app/src/utils/googlePlaceAmenities.ts'), { exports: amenities.exports });
    vm.runInNewContext(compile('../app/src/services/barService.ts'), {
        exports: module.exports, console: { info: (...args) => logs.push(args), log() {} },
        require(name) {
            if (name === 'firebase/firestore') return {
                doc: (db, collection, id) => `${collection}/${id}`, serverTimestamp: () => 'server-time',
                updateDoc: async (ref, data) => {
                    if (fail) throw new Error('permission-denied');
                    writes.push({ ref, data });
                },
            };
            if (name.endsWith('/placesService')) return {
                ...amenities.exports, mergeAmenities: (old, next) => [...new Set([...old, ...next])],
            };
            return {};
        },
    });
    return { ...module.exports, writes, logs };
}

const periods = [{ openDay: 1, openHour: 10, openMinute: 0, closeDay: 1, closeHour: 23, closeMinute: 0 }];
const bar = { id: 'bar', name: 'Local', googlePlaceId: 'known', amenities: ['wifi'], openingPeriods: periods };
const details = { placeId: 'known', types: [], openingPeriods: periods };

test('identical enrichment writes nothing, including when period property order differs', async () => {
    const service = harness();
    const reordered = periods.map(period => Object.fromEntries(Object.entries(period).reverse()));
    await service.cacheBarPlaceData(bar, { ...details, openingPeriods: reordered });
    assert.equal(service.writes.length, 0);
});

test('updates changed fields only, refreshes obsolete IDs and preserves existing amenities', async () => {
    const service = harness();
    await service.cacheBarPlaceData(bar, { ...details, placeId: 'replacement', types: ['restaurant'] });
    assert.equal(service.writes.length, 1);
    const { data } = service.writes[0];
    assert.equal(data.googlePlaceId, 'replacement');
    assert.deepEqual([...data.amenities], ['wifi', 'food_served']);
    assert.equal(data.openingPeriods, undefined);
    assert.equal(data.placesEnrichedAt, 'server-time');
    await service.cacheBarPlaceData({ ...bar, ...data }, { ...details, placeId: 'replacement', types: ['restaurant'] });
    assert.equal(service.writes.length, 1);
});

test('changed opening hours persist, but unavailable hours never erase a known schedule', async () => {
    const service = harness();
    const updated = periods.map(period => ({ ...period, closeHour: 22 }));
    await service.cacheBarPlaceData(bar, { ...details, openingPeriods: updated });
    assert.equal(service.writes.length, 1);
    assert.equal(service.writes[0].data.openingPeriods[0].closeHour, 22);
    await service.cacheBarPlaceData(bar, { ...details, openingPeriods: undefined });
    assert.equal(service.writes.length, 1);
});

test('failed enrichment remains non-blocking and is explicitly logged', async () => {
    const service = harness({ fail: true });
    await service.cacheBarPlaceData(bar, { ...details, placeId: 'replacement' });
    assert.equal(service.writes.length, 0);
    assert.equal(service.logs.length, 1);
});
