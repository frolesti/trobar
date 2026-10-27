const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const moduleStub = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../app/src/utils/matchHistory.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module: moduleStub, exports: moduleStub.exports, Map });
const { previousMatchPage } = moduleStub.exports;

test('history reveals ten most recent fixtures then ten older fixtures in chronological order', () => {
    const matches = Array.from({ length: 25 }, (_, index) => ({ id: String(index), date: new Date(2030, 0, index + 1) }));
    const first = previousMatchPage(matches, new Date(2030, 1, 1));
    assert.deepEqual(Array.from(first, match => match.id), Array.from({ length: 10 }, (_, index) => String(index + 15)));
    const second = previousMatchPage(matches, first[0].date);
    assert.deepEqual(Array.from(second, match => match.id), Array.from({ length: 10 }, (_, index) => String(index + 5)));
    assert.equal(previousMatchPage(matches, second[0].date).length, 5);
});

test('a new filter starts at its own next fixture with no inherited history', () => {
    const champions = [{ id: 'cl-old', date: new Date('2020-01-01') }];
    const league = [{ id: 'league-old', date: new Date('2025-01-01') }, { id: 'league-next', date: new Date('2031-01-01') }];
    previousMatchPage(champions, new Date('2030-01-01'));
    const page = previousMatchPage(league, new Date('2030-01-01'));
    assert.deepEqual(Array.from(page, match => match.id), ['league-old']);
});