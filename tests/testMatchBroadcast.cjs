const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const moduleStub = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../app/src/utils/matchBroadcast.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module: moduleStub, exports: moduleStub.exports, Date });
const { barShowsMatch, nextBroadcastMatchId } = moduleStub.exports;

test('only the global next fixture is implicit, regardless of category or usual broadcasting', () => {
    const bar = { id: 'registered', usuallyShowsBarca: true, broadcastingMatches: ['confirmed'] };
    assert.equal(barShowsMatch(bar, 'next', 'next'), true);
    assert.equal(barShowsMatch(bar, 'confirmed', 'next'), true);
    assert.equal(barShowsMatch(bar, 'other', 'next'), false);
    assert.equal(nextBroadcastMatchId([
        { id: 'women', date: new Date('2030-01-02'), category: 'femenino' },
        { id: 'men', date: new Date('2030-01-03'), category: 'masculino' },
        { id: 'cancelled', date: new Date('2030-01-01'), status: 'postponed' },
    ], new Date('2029-12-31').getTime()), 'women');
});

test('unregistered discovery and user reports do not imply broadcasts; free registered bars are included', () => {
    assert.equal(barShowsMatch({ id: 'osm_123', source: 'user_reported', broadcastingMatches: ['next'] }, 'next', 'next'), false);
    assert.equal(barShowsMatch({ id: 'osm_123', ownerId: 'owner', source: 'verified', tier: 'free' }, 'next', 'next'), true);
    assert.equal(barShowsMatch({ id: 'free', tier: 'free', broadcastingMatches: ['confirmed'] }, 'confirmed', null), true);
});

test('Firestore service and map eligibility agree on implicit and explicit broadcasts', async () => {
    const serviceModule = { exports: {} };
    const bars = [
        { id: 'free', tier: 'free', latitude: 41.4, longitude: 2.1, usuallyShowsBarca: true, broadcastingMatches: ['confirmed'] },
        { id: 'osm_123', source: 'user_reported', latitude: 41.4, longitude: 2.1, broadcastingMatches: ['unconfirmed'] },
    ];
    const source = fs.readFileSync(require('node:path').join(__dirname, '../app/src/services/barService.ts'), 'utf8');
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
        module: serviceModule, exports: serviceModule.exports, console,
        require: name => {
            if (name === 'firebase/firestore') return { collection: () => 'bars', getDocs: async () => ({ forEach: callback => bars.forEach(bar => callback({ id: bar.id, data: () => bar })) }) };
            if (name.includes('api/core')) return { executeRequest: async operation => ({ success: true, data: await operation() }) };
            if (name.includes('matchBroadcast')) return moduleStub.exports;
            if (name.includes('barNavigation')) return { getBarCoordinates: data => ({ latitude: data.latitude, longitude: data.longitude }) };
            return {};
        },
    });
    const ids = await serviceModule.exports.fetchBroadcastMatchIds(['next', 'confirmed', 'unconfirmed', 'other'], 'next');
    assert.deepEqual([...ids].sort(), ['confirmed', 'next']);
    assert.deepEqual(Array.from(await serviceModule.exports.fetchBarsForMatch('next', 'next'), bar => bar.id), ['free']);
    assert.deepEqual(Array.from(await serviceModule.exports.fetchBarsForMatch('confirmed', 'next'), bar => bar.id), ['free']);
    assert.equal((await serviceModule.exports.fetchBarsForMatch('other', 'next')).length, 0);
});