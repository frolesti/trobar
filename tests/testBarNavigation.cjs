const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const moduleStub = { exports: {} };
const source = fs.readFileSync(require('node:path').join(__dirname, '../app/src/utils/barNavigation.ts'), 'utf8');
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module: moduleStub, exports: moduleStub.exports });
const { getBarCoordinates, buildBarNavigationUrls } = moduleStub.exports;

test('all navigators receive the same exact point, without name search or fake origin', () => {
    const point = { latitude: 41.3809, longitude: 2.1228, name: 'Ambiguous bar', googlePlaceId: 'wrong-place' };
    const urls = buildBarNavigationUrls(point);
    assert.equal(new URL(urls.googleUrl).searchParams.get('destination'), '41.3809,2.1228');
    assert.equal(new URL(urls.wazeUrl).searchParams.get('ll'), '41.3809,2.1228');
    assert.equal(new URL(urls.appleMapsUrl).searchParams.get('daddr'), '41.3809,2.1228');
    for (const url of Object.values(urls)) {
        assert(!url.includes('wrong-place'));
        assert(!url.includes('origin='));
        assert(!url.includes('saddr='));
    }
});

test('missing coordinates never fall back to Barcelona', () => {
    assert.equal(getBarCoordinates({}), null);
    assert.equal(getBarCoordinates({ location: { latitude: 91, longitude: 2 } }), null);
    assert.throws(() => buildBarNavigationUrls({ latitude: NaN, longitude: 2 }), /Invalid/);
});

test('zero coordinates and flat fallback are preserved', () => {
    const zero = { latitude: 0, longitude: 0 };
    assert.equal(getBarCoordinates({ location: zero }), zero);
    assert.equal(getBarCoordinates({ location: {}, latitude: 41, longitude: 2 }).latitude, 41);
});