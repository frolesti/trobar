const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

test('competition history batches unique IDs, validates documents and sorts dates', async () => {
    const requests = [];
    const source = fs.readFileSync(path.join(__dirname, '../app/src/services/matchService.ts'), 'utf8');
    const moduleStub = { exports: {} };
    const firestore = {
        collection: () => 'matches',
        where: (field, operator, ids) => ({ field, operator, ids }),
        query: (collection, condition) => { requests.push(condition); return condition; },
        getDocs: async condition => ({ forEach: callback => {
            if (condition.ids.includes('5')) {
                callback({ id: 'later', data: () => ({ homeTeam: 'Home', awayTeam: 'Away', timestamp: { toDate: () => new Date('2026-03-03') } }) });
                callback({ id: 'invalid', data: () => ({ homeTeam: 'Home' }) });
                callback({ id: 'duplicate', data: () => ({ duplicateOf: 'earlier', homeTeam: 'Home', awayTeam: 'Away', timestamp: { toDate: () => new Date('2026-02-12') } }) });
                callback({ id: 'earlier', data: () => ({ homeTeam: 'Home', awayTeam: 'Away', timestamp: { toDate: () => new Date('2026-02-12') } }) });
            }
        } }),
    };
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
        module: moduleStub, exports: moduleStub.exports,
        require: name => name === 'firebase/firestore' ? firestore : { db: {} },
        console, Date, Map, Set,
    });
    const ids = Array.from({ length: 31 }, (_, index) => String(index));
    const matches = await moduleStub.exports.fetchCompetitionMatches([...ids, '5']);
    assert.equal(requests.length, 2);
    assert.equal(requests[0].field, 'league');
    assert.equal(requests[0].operator, 'in');
    assert.equal(requests[0].ids.length, 30);
    assert.equal(requests[1].ids.length, 1);
    assert.deepEqual(Array.from(matches, match => match.id), ['earlier', 'later']);
    requests.length = 0;
    assert.equal((await moduleStub.exports.fetchCompetitionMatches([])).length, 0);
    assert.equal(requests.length, 0);
});

test('history continues across duplicates and other categories to return ten valid fixtures', async () => {
    const requests = [];
    let page = 0;
    const documents = (count, category, duplicate = false) => Array.from({ length: count }, (_, index) => ({ id: `${page}-${index}`, data: () => ({ homeTeam: 'Home', awayTeam: 'Away', category, duplicateOf: duplicate ? 'canonical' : undefined, timestamp: { toDate: () => new Date('2025-01-01') } }) }));
    const firestore = {
        collection: () => 'matches', where: () => 'before', orderBy: () => 'descending', limit: value => value,
        Timestamp: { fromDate: date => date }, startAfter: document => ({ cursor: document.id }),
        query: (...parts) => { requests.push(parts); return parts; },
        getDocs: async () => { page++; return { docs: page === 1 ? documents(30, 'masculino') : page === 2 ? documents(30, 'femenino', true) : documents(12, 'femenino') }; },
    };
    const moduleStub = { exports: {} };
    const source = fs.readFileSync(path.join(__dirname, '../app/src/services/matchService.ts'), 'utf8');
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
        module: moduleStub, exports: moduleStub.exports, Date,
        require: name => name === 'firebase/firestore' ? firestore : { db: {} },
    });
    const history = await moduleStub.exports.fetchPastMatches(new Date('2026-01-01'), 10, 'femenino');
    assert.equal(history.length, 10);
    assert.equal(requests.length, 3);
    assert(requests[1].some(part => part?.cursor === '1-29'));
    assert(history.every(match => match.category === 'femenino' && !match.duplicateOf));
});