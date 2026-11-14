const { test } = require('node:test');
const assert = require('node:assert/strict');
const { planHistory } = require('../scripts/recoverWomenCupHistory.cjs');
const existing = [{ competition: { id: '8', name: 'Copa de la Reina' }, category: 'femenino', timestamp: '2025-12-21T18:00Z',
    homeTeam: { id: '101', name: 'Alavés' }, awayTeam: { id: '93', name: 'Barcelona' } }];
const mapping = { teams: {}, matches: {}, nextTeamId: 110, nextMatchId: 500 };
const record = { date: '2026-05-16T19:00Z', eventId: '401859862', home: 'Barcelona', away: 'Atlético Madrid',
    homeId: '20091', awayId: '20093', homeScore: 3, awayScore: 1, stage: 'FINAL' };

test('history recovery preserves references, allocates ordinal IDs and is idempotent', () => {
    const result = planHistory(existing, mapping, [record], Date.parse('2026-10-28'));
    assert.equal(result.planned[0].id, '500');
    assert.equal(result.planned[0].data.homeTeam.id, '93');
    assert.equal(result.planned[0].data.awayTeam.id, '110');
    assert.equal(result.planned[0].data.stage, 'FINAL');
    assert.equal(result.newTeams.length, 1);
    assert.equal(mapping.nextMatchId, 500);
    assert.equal(planHistory(existing, result.mappings, [record]).planned.length, 0);
    const saved = result.planned.map(entry => entry.data);
    assert.equal(planHistory([...existing, ...saved], mapping, [record]).planned.length, 0);
});

test('history excludes annulled, incomplete, future and ambiguous fixtures', () => {
    for (const candidate of [{ ...record, eventId: '658106' }, { ...record, homeScore: undefined },
        { ...record, date: '2099-01-01' }, { ...record, homeId: 'different-club' }]) {
        assert.equal(planHistory(existing, mapping, [candidate]).planned.length, 0);
    }
    assert.equal(planHistory(existing, mapping, [record, record]).planned.length, 0);
    assert.deepEqual(planHistory(existing, mapping, [{ ...record, eventId: '658106' }]).excluded, ['658106']);
});
