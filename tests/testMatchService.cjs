const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const barcelonaModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../app/src/utils/barcelona.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { module: barcelonaModule, exports: barcelonaModule.exports });

function loadMatchService(firestore) {
    const moduleStub = { exports: {} };
    const source = fs.readFileSync(path.join(__dirname, '../app/src/services/matchService.ts'), 'utf8');
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
        module: moduleStub, exports: moduleStub.exports, console, Date, Map, Set,
        require: name => name === 'firebase/firestore' ? firestore : name.includes('barcelona') ? barcelonaModule.exports : { db: {} },
    });
    return moduleStub.exports;
}

test('Barcelona identity includes both first teams and excludes other clubs, reserves and malformed names', () => {
    const { isBarcelonaMatch } = barcelonaModule.exports;
    for (const name of ['FC Barcelona', 'Barcelona', 'Barcelona Women', 'FC Barcelona Femení', 'Barça', 'Barça Femení']) {
        assert.equal(isBarcelonaMatch({ homeTeam: { name }, awayTeam: { name: 'Real Madrid' } }), true);
        assert.equal(isBarcelonaMatch({ homeTeam: 'Opponent', awayTeam: name }), true);
    }
    for (const name of ['Barcelona SC', 'Barcelona B', 'Espanyol de Barcelona', 'Real Sociedad', '', 81]) {
        assert.equal(isBarcelonaMatch({ homeTeam: { name }, awayTeam: { name: 'Real Madrid' } }), false);
    }
    assert.equal(isBarcelonaMatch({}), false);
});

test('competition history batches unique IDs, validates documents and sorts dates', async () => {
    const requests = [];
    const firestore = {
        collection: () => 'matches',
        where: (field, operator, ids) => ({ field, operator, ids }),
        query: (collection, condition) => { requests.push(condition); return condition; },
        getDocs: async condition => ({ forEach: callback => {
            if (condition.ids.includes('5')) {
                callback({ id: 'later', data: () => ({ homeTeam: 'Barcelona', awayTeam: 'Away', timestamp: { toDate: () => new Date('2026-03-03') } }) });
                callback({ id: 'invalid', data: () => ({ homeTeam: 'Home' }) });
                callback({ id: 'duplicate', data: () => ({ duplicateOf: 'earlier', homeTeam: 'Home', awayTeam: 'Away', timestamp: { toDate: () => new Date('2026-02-12') } }) });
                callback({ id: 'earlier', data: () => ({ homeTeam: 'Barcelona', awayTeam: 'Away', timestamp: { toDate: () => new Date('2026-02-12') } }) });
                callback({ id: 'other-semi', data: () => ({ homeTeam: { name: 'Real Sociedad' }, awayTeam: { name: 'Real Madrid' }, timestamp: { toDate: () => new Date('2027-02-03') } }) });
            }
        } }),
    };
    const service = loadMatchService(firestore);
    const ids = Array.from({ length: 31 }, (_, index) => String(index));
    const matches = await service.fetchCompetitionMatches([...ids, '5']);
    assert.equal(requests.length, 2);
    assert.equal(requests[0].field, 'league');
    assert.equal(requests[0].operator, 'in');
    assert.equal(requests[0].ids.length, 30);
    assert.equal(requests[1].ids.length, 1);
    assert.deepEqual(Array.from(matches, match => match.id), ['earlier', 'later']);
    requests.length = 0;
    assert.equal((await service.fetchCompetitionMatches([])).length, 0);
    assert.equal(requests.length, 0);
});

test('history continues across duplicates and other categories to return ten valid fixtures', async () => {
    const requests = [];
    let page = 0;
    const documents = (count, category, duplicate = false) => Array.from({ length: count }, (_, index) => ({ id: `${page}-${index}`, data: () => ({ homeTeam: 'Barcelona', awayTeam: 'Away', category, duplicateOf: duplicate ? 'canonical' : undefined, timestamp: { toDate: () => new Date('2025-01-01') } }) }));
    const firestore = {
        collection: () => 'matches', where: () => 'before', orderBy: () => 'descending', limit: value => value,
        Timestamp: { fromDate: date => date }, startAfter: document => ({ cursor: document.id }),
        query: (...parts) => { requests.push(parts); return parts; },
        getDocs: async () => {
            page++;
            return { docs: page === 1 ? documents(30, 'masculino') : page === 2 ? documents(30, 'femenino', true)
                : page === 3 ? documents(30, 'femenino').map(doc => ({ ...doc, data: () => ({ ...doc.data(), homeTeam: 'Real Sociedad' }) }))
                : documents(12, 'femenino') };
        },
    };
    const history = await loadMatchService(firestore).fetchPastMatches(new Date('2026-01-01'), 10, 'femenino');
    assert.equal(history.length, 10);
    assert.equal(requests.length, 4);
    assert(requests[1].some(part => part?.cursor === '1-29'));
    assert(history.every(match => match.category === 'femenino' && !match.duplicateOf));
});

test('upcoming list and realtime updates exclude the other semifinal, including legacy production records', async () => {
    const timestamp = { toDate: () => new Date('2027-02-02T19:00:00Z') };
    const documents = [
        { id: '559', data: () => ({ homeTeam: { name: 'FC Barcelona' }, awayTeam: { name: 'Atlético' }, timestamp }) },
        { id: '560', data: () => ({ homeTeam: { name: 'Real Sociedad' }, awayTeam: { name: 'Real Madrid' }, timestamp }) },
        { id: 'women', data: () => ({ homeTeam: { name: 'Benfica' }, awayTeam: { name: 'Barcelona Women' }, category: 'femenino', timestamp }) },
        { id: 'duplicate', data: () => ({ homeTeam: 'Barcelona', awayTeam: 'Atlético', timestamp, duplicateOf: '559' }) },
    ];
    let unsubscribed = false;
    const snapshot = { docs: documents, forEach: callback => documents.forEach(callback) };
    const service = loadMatchService({
        collection: () => 'matches', where: () => ({}), documentId: () => 'id',
        orderBy: () => ({}), limit: () => 100, query: (...parts) => parts,
        Timestamp: { fromDate: date => date },
        getDocs: async () => snapshot,
        onSnapshot: (request, callback) => { callback(snapshot); return () => { unsubscribed = true; }; },
    });
    const upcoming = await service.fetchAllMatches();
    assert.deepEqual(Array.from(upcoming.matches, match => match.id), ['559', 'women']);
    let realtime;
    const unsubscribe = service.subscribeToMatchUpdates(['559', '560', 'women', 'duplicate'], matches => { realtime = matches; });
    assert.deepEqual(Array.from(realtime, match => match.id), ['559', 'women']);
    unsubscribe();
    assert.equal(unsubscribed, true);
});