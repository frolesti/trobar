const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeStage, stageSource, stageTeamKey, stageRecords, matchingStageRecord, fetchStageRecords } = require('../lib/stageData');
const { supplementStages } = require('../lib/matchSync');

const event = (slug = 'league-phase') => ({ id: '123', date: '2026-11-12T17:45Z', season: { slug },
    competitions: [{ competitors: [
        { homeAway: 'home', team: { displayName: 'Barcelona' } },
        { homeAway: 'away', team: { displayName: 'Arsenal' } },
    ] }] });

test('explicit modern, legacy, early-round and canonical phases normalize without date guesses', () => {
    for (const [raw, expected] of [['quarter-finals', 'QUARTER_FINALS'], ['semi-finals', 'SEMI_FINALS'],
        ['Round of 32', 'LAST_32'], ['fourth-round', 'FOURTH_ROUND'], ['first-round', 'FIRST_ROUND'],
        ['LEAGUE_STAGE', 'LEAGUE_STAGE'], ['knockout-round-playoffs', 'PLAYOFFS'],
        ['PLAY_OFF_ROUND', 'PLAYOFFS']]) assert.equal(normalizeStage(raw), expected);
    for (const raw of [null, '', 'Group A', '2026-05-23', 'Barcelona', 'unknown']) assert.equal(normalizeStage(raw), undefined);
    assert.equal(stageSource('Champions League', 'femenino'), 'uefa.wchampions');
    assert.equal(stageSource('Copa del Rei'), 'esp.copa_del_rey');
    assert.equal(stageSource('Supercopa Femenina'), undefined);
});

test('verified provider club variants match, but different teams and genders remain separate', () => {
    for (const [a, b] of [['C.F. Villanovense', 'Villanovense'], ['FC København', 'F.C. København'],
        ['FC Bayern München Ladies', 'Bayern Munich'], ['Bayern Munchen Frauen', 'Bayern Munich'],
        ['Eintracht Frankfurt Frauen', 'Eintracht Frankfurt'], ['Brann', 'SK Brann'],
        ['Køge', 'HB Køge'], ['Servette Chênois', 'Servette'], ['Olympique Lyon', 'OL Lyonnes'],
        ['Hammarby', 'Hammarby IF'], ['Sporting Clube de Portugal', 'Sporting CP']]) assert.equal(stageTeamKey(a), stageTeamKey(b));
    assert.notEqual(stageTeamKey('Atlético Madrid'), stageTeamKey('Real Madrid'));
    const records = stageRecords([event()]);
    assert.equal(matchingStageRecord('2026-11-12', 'FC Barcelona', 'Arsenal', records).stage, 'LEAGUE_STAGE');
    assert.equal(matchingStageRecord('2026-11-12', 'Arsenal', 'Barcelona', records), undefined);
    assert.equal(matchingStageRecord('2026-11-13', 'Barcelona', 'Arsenal', records), undefined);
    assert.equal(matchingStageRecord('2026-11-12', 'Barcelona', 'Arsenal', [...records, ...records]), undefined);
});

test('scheduled ingestion enriches future UWCL, groups requests, preserves explicit phases and never supplies defaults', async () => {
    const original = global.fetch;
    const fixture = () => ({ utcDate: '2026-11-12T17:45Z', competition: { name: "UEFA Women's Champions League" },
        category: 'femenino', homeTeam: { name: 'FC Barcelona' }, awayTeam: { name: 'Arsenal' } });
    let requests = 0;
    try {
        global.fetch = async () => { requests++; return new Response(JSON.stringify({ events: [event()] })); };
        const fixtures = [fixture(), { ...fixture(), stage: 'QUARTER_FINALS' }, { ...fixture(), awayTeam: { name: 'Unknown' } }, fixture()];
        await supplementStages(fixtures);
        assert.equal(requests, 1);
        assert.equal(fixtures[0].stage, 'LEAGUE_STAGE');
        assert.equal(fixtures[0].stageSourceEventId, '123');
        assert.equal(fixtures[1].stage, 'QUARTER_FINALS');
        assert.equal(fixtures[2].stage, undefined);
        global.fetch = async () => new Response('unavailable', { status: 503 });
        await assert.rejects(supplementStages([fixture()]), /Stage enrichment failed/);
        global.fetch = async () => new Response(JSON.stringify({ events: Array(1000).fill({}) }));
        await assert.rejects(fetchStageRecords('uefa.champions', '2026'), /truncated/);
        await assert.rejects(fetchStageRecords('uefa.champions', 'invalid'), /Invalid stage year/);
    } finally { global.fetch = original; }
});

test('official historical fallback reads UEFA phase metadata and validates competition instead of hard-coding a stage', async () => {
    const original = global.fetch;
    try {
        global.fetch = async url => new Response(JSON.stringify(url.includes('espn') ? { events: [] } : {
            id: url.split('/').pop(), round: { competitionId: '28', metaData: { name: 'Round of 32' } },
            kickOffTime: { dateTime: url.endsWith('2023207') ? '2017-10-04T16:00Z' : '2017-10-11T16:30Z' },
            homeTeam: { internationalName: 'Avaldsnes' }, awayTeam: { internationalName: 'Barcelona' },
        }));
        const records = await fetchStageRecords('uefa.wchampions', '2017');
        assert.equal(records.length, 2);
        assert.equal(records[0].stage, 'LAST_32');
        assert.equal(records[0].provider, 'uefa');
        global.fetch = async url => new Response(JSON.stringify(url.includes('espn') ? { events: [] } : { id: url.split('/').pop(), round: { competitionId: '1' } }));
        await assert.rejects(fetchStageRecords('uefa.wchampions', '2017'), /Invalid UEFA/);
    } finally { global.fetch = original; }
});
