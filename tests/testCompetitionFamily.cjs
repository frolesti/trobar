const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const moduleStub = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../app/src/utils/competition.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: moduleStub.exports, require: name => name });

test('Supercopa has its own catalogue filter and is never folded into Copa del Rey or Liga F', () => {
    const { competitionFamily, COMPETITION_FILTERS } = moduleStub.exports;
    for (const name of ['Supercopa de España', 'Supercopa Femenina', 'Spanish Super Cup']) assert.equal(competitionFamily(name), 'supercup');
    assert.equal(competitionFamily('Copa del Rey'), 'cup');
    assert.equal(competitionFamily('Copa de la Reina'), 'cup');
    assert.equal(COMPETITION_FILTERS.filter(filter => filter.id === 'supercup').length, 1);
    assert.equal(COMPETITION_FILTERS.find(filter => filter.id === 'supercup').label, 'Supercopa');
});
