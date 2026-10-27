const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sourceStages, planRecovery } = require('../scripts/recoverMatchStages.cjs');
const event = (slug = 'final') => ({ id: 'source-1', date: '2025-04-26T20:00Z', season: { slug }, competitions: [{ competitors: [{ homeAway: 'home', team: { displayName: 'Barcelona' } }, { homeAway: 'away', team: { displayName: 'Real Madrid' } }] }] });
const match = overrides => ({ id: '1', name: 'projects/example/matches/1', updateTime: 'version', timestamp: '2025-04-26T20:00:00Z', homeTeam: { name: 'FC Barcelona' }, awayTeam: { name: 'Real Madrid CF' }, competition: { name: 'Copa del Rey' }, ...overrides });

test('recovery uses explicit source round and matches both teams, day and competition', () => {
    const stages = sourceStages('esp.copa_del_rey', [event()]);
    const plan = planRecovery([match()], stages);
    assert.equal(plan.length, 1);
    assert.equal(plan[0].stage, 'FINAL');
    for (const changes of [{ timestamp: '2025-04-25T20:00Z' }, { awayTeam: { name: 'Atlético Madrid' } }, { competition: { name: 'Copa de la Reina' } }, { homeTeam: { name: 'Real Madrid' }, awayTeam: { name: 'Barcelona' } }]) {
        assert.equal(planRecovery([match(changes)], stages).length, 0);
    }
});
test('existing phases, duplicate fixtures, unknown rounds and conflicting source phases are untouched', () => {
    const stages = sourceStages('esp.copa_del_rey', [event()]);
    for (const changes of [{ stage: 'SEMI_FINALS' }, { round: 'Final' }, { duplicateOf: '2' }, { timestamp: '2099-04-26T20:00Z' }]) assert.equal(planRecovery([match(changes)], stages).length, 0);
    assert.equal(planRecovery([match()], sourceStages('esp.copa_del_rey', [event('unknown')])).length, 0);
    assert.equal(planRecovery([match()], sourceStages('esp.copa_del_rey', [event(), event('semifinals')])).length, 0);
});