const { test } = require('node:test');
const assert = require('node:assert/strict');
const { supercopaFixtures, SUPERCOPA_SOURCE } = require('../lib/supercopa');
const { importSupercopa } = require('../lib/matchSync');

test('only the Barcelona semifinal is imported, with confirmed Madrid kickoff and provenance; no invented final teams', () => {
    const fixtures = supercopaFixtures();
    assert.equal(fixtures.length, 1);
    assert.deepEqual(fixtures.map(match => [match.utcDate, match.homeTeam.id, match.awayTeam.id]), [
        ['2027-02-02T19:00:00.000Z', 81, 78],
    ]);
    for (const match of fixtures) {
        assert.equal(match.stage, 'SEMI_FINALS');
        assert.equal(match.category, 'masculino');
        assert.equal(match.timeConfirmed, true);
        assert.equal(match.sourceUrl, SUPERCOPA_SOURCE);
        assert.equal(match.stageSource, 'rfef');
        assert.equal(match.competition.name, 'Supercopa de España');
        assert.equal(new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' }).format(new Date(match.utcDate)), '20:00');
    }
});

test('official backfill creates only the Barcelona fixture once, preserves mappings and never overwrites later results', async () => {
    let writeCount = 0;
    const records = new Map([
        ['system/id_mappings', { competitions: {}, teams: { 81: 1, 78: 2, 92: 3, 86: 4 }, matches: {}, nextCompId: 1, nextTeamId: 5, nextMatchId: 559 }],
    ]);
    const snapshot = path => ({ data: () => records.has(path) ? structuredClone(records.get(path)) : undefined });
    const db = {
        doc: path => ({ path }),
        runTransaction: async callback => {
            const writes = [];
            await callback({
                get: async ref => snapshot(ref.path),
                getAll: async (...refs) => refs.map(ref => snapshot(ref.path)),
                set: (ref, data, options) => writes.push([ref.path, data, options]),
            });
            for (const [path, data, options] of writes) {
                writeCount++;
                records.set(path, options?.merge ? { ...records.get(path), ...data } : data);
            }
        },
    };
    await importSupercopa(db);
    assert.equal(records.get('matches/559').homeTeam.id, '1', 'reuse existing club IDs');
    assert.equal(records.get('matches/559').competition.name, 'Supercopa de España');
    assert.equal(records.has('matches/560'), false);
    const mapping = structuredClone(records.get('system/id_mappings'));
    const updated = { ...records.get('matches/559'), status: 'finished', homeScore: 2, awayScore: 1 };
    records.set('matches/559', updated);
    writeCount = 0;
    await importSupercopa(db);
    assert.equal(writeCount, 0, 'an existing official fixture does not even rewrite its ID mapping');
    assert.deepEqual(records.get('system/id_mappings'), mapping);
    assert.equal([...records.keys()].filter(key => key.startsWith('matches/')).length, 1);
    assert.equal(records.get('matches/559'), updated, 'create-only import leaves every existing field untouched');
});
