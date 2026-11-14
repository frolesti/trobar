const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sourceStages, planRecovery, auditRecovery } = require('../scripts/recoverMatchStages.cjs');
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
test('canonical verified phases and duplicates are untouched; unknown and ambiguous source phases never supply a stage', () => {
    const stages = sourceStages('esp.copa_del_rey', [event()]);
    for (const changes of [{ stage: 'FINAL' }, { duplicateOf: '2' }, { timestamp: '2099-04-26T20:00Z' }]) assert.equal(planRecovery([match(changes)], stages).length, 0);
    assert.equal(planRecovery([match()], sourceStages('esp.copa_del_rey', [event('unknown')])).length, 0);
    assert.equal(planRecovery([match()], sourceStages('esp.copa_del_rey', [event(), event('semifinals')])).length, 0);
});

test('verified source corrects wrong stages and normalizes round-only metadata with previous values in preview', () => {
    const stages = sourceStages('esp.copa_del_rey', [event()]);
    assert.equal(planRecovery([match({ stage: 'SEMI_FINALS' })], stages)[0].previousStage, 'SEMI_FINALS');
    assert.equal(planRecovery([match({ round: 'Final' })], stages)[0].stage, 'FINAL');
    const planned = planRecovery([match({ round: 'Final' })], stages);
    assert.equal(planRecovery([match({ stage: planned[0].stage })], stages).length, 0);
});

test('future confirmed fixtures are included and every unresolved active fixture has an explicit reason', () => {
    const future = event('league-phase');
    future.date = '2099-04-26T20:00Z';
    const stages = sourceStages('uefa.wchampions', [future]);
    const fixture = match({ competition: { name: "UEFA Women's Champions League" }, timestamp: future.date });
    assert.equal(planRecovery([fixture], stages)[0].stage, 'LEAGUE_STAGE');
    const report = auditRecovery([fixture, match(), match({ id: '3', duplicateOf: '1' })], stages);
    assert.equal(report.totalScoped, 2);
    assert.equal(report.missingStages, 2);
    assert.equal(report.verified, 1);
    assert.equal(report.unresolved[0].id, '1');
    assert.equal(report.unresolved[0].reason, 'no-matching-provider-event');
    const other = { ...future, id: 'other' };
    assert.equal(planRecovery([fixture], sourceStages('uefa.wchampions', [future, other])).length, 0);
});