const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cupSource, cupTeamKey, cupRecords, matchingCupRecord, applyCupRecord, fetchCupRecords } = require('../lib/cupData');

function event(completed = true, homeScore = '0', awayScore = '4') {
    return {
        id: '401846984', date: '2026-02-05T20:00Z', status: { type: { completed } },
        competitions: [{ competitors: [
            { homeAway: 'away', team: { displayName: 'Barcelona', logo: 'https://example.com/barca.png' }, score: awayScore },
            { homeAway: 'home', team: { displayName: 'Real Madrid', logo: 'https://example.com/madrid.png' }, score: homeScore },
        ] }],
    };
}

test('cup sources and aliases are explicit, not substring guesses', () => {
    assert.equal(cupSource('Copa del Rey'), 'esp.copa_del_rey');
    assert.equal(cupSource('Copa de la Reina'), 'esp.copa_de_la_reina');
    assert.equal(cupSource('Supercopa Femenina'), undefined);
    for (const [first, second] of [['Albacete Balompie', 'Albacete'], ['CD Guadalajara', 'Guadalajara'],
        ['FC Barcelona Women', 'Barcelona'], ['Racing de Santander', 'Racing Santander'], ['Deportivo Alavés', 'Alavés']]) {
        assert.equal(cupTeamKey(first), cupTeamKey(second));
    }
    assert.notEqual(cupTeamKey('Real Madrid'), cupTeamKey('Atlético Madrid'));
});

test('provider parser preserves zero scores, home-away order and completed evidence', () => {
    const [record] = cupRecords([event()]);
    assert.equal(record.home, 'Real Madrid');
    assert.equal(record.homeScore, 0);
    assert.equal(record.awayScore, 4);
    assert.equal(cupRecords([event(false)])[0].homeScore, undefined);
    for (const invalid of ['', null, undefined, '-1', '1.5', 'unknown']) {
        const candidate = event();
        candidate.competitions[0].competitors[1].score = invalid;
        assert.equal(cupRecords([candidate])[0].homeScore, undefined);
        assert.equal(cupRecords([candidate])[0].awayScore, undefined);
    }
    const candidate = event();
    candidate.competitions[0].status = { type: { completed: false } };
    assert.equal(cupRecords([candidate])[0].homeScore, undefined);
});

test('cup ingestion and history share legacy and early-round stage normalization without default phases', () => {
    for (const [slug, stage] of [['quarter-finals', 'QUARTER_FINALS'], ['semi-finals', 'SEMI_FINALS'],
        ['round-of-32', 'LAST_32'], ['fourth-round', 'FOURTH_ROUND'], ['unknown', undefined]]) {
        const candidate = event();
        candidate.season = { slug };
        assert.equal(cupRecords([candidate])[0].stage, stage);
    }
    const candidate = event();
    candidate.season = { slug: 'round-of-16' };
    const [record] = cupRecords([candidate]);
    const fixture = { homeTeam: {}, awayTeam: {}, status: 'SCHEDULED' };
    applyCupRecord(fixture, record);
    assert.equal(fixture.stage, 'LAST_16');
    assert.equal(fixture.stageSourceEventId, record.eventId);
    fixture.stage = 'QUARTER_FINALS';
    applyCupRecord(fixture, record);
    assert.equal(fixture.stage, 'QUARTER_FINALS');
});

test('matching rejects wrong opponents, reversed sides, dates and ambiguous events', () => {
    const records = cupRecords([event()]);
    assert.equal(matchingCupRecord('2026-02-05T21:00Z', 'Real Madrid', 'FC Barcelona', records).eventId, '401846984');
    assert.equal(matchingCupRecord('2026-02-06', 'Real Madrid', 'Barcelona', records), undefined);
    assert.equal(matchingCupRecord('2026-02-05', 'Barcelona', 'Real Madrid', records), undefined);
    assert.equal(matchingCupRecord('2026-02-05', 'Atlético Madrid', 'Barcelona', records), undefined);
    assert.equal(matchingCupRecord('2026-02-05', 'Real Madrid', 'Barcelona', [...records, ...records]), undefined);
});

test('official Guadalajara crest fallback requires Spanish cup source, provider ID and exact name', () => {
    const candidate = event();
    candidate.competitions[0].competitors[1].team = { id: '11484', displayName: 'CD Guadalajara', logo: '' };
    assert.match(cupRecords([candidate], 'esp.copa_del_rey')[0].homeBadge, /^https:\/\/www\.cdguadalajara\.es\//);
    assert.equal(cupRecords([candidate], 'esp.copa_de_la_reina')[0].homeBadge, undefined);
    candidate.competitions[0].competitors[1].team.id = 'different-club';
    assert.equal(cupRecords([candidate], 'esp.copa_del_rey')[0].homeBadge, undefined);
});

test('enrichment fills incomplete scores and badges without replacing confirmed data', () => {
    const [record] = cupRecords([event()]);
    const fixture = { homeTeam: { name: 'Real Madrid' }, awayTeam: { name: 'Barcelona', crest: 'https://existing.com/crest.png' },
        score: { fullTime: { home: null, away: null } }, status: 'SCHEDULED' };
    applyCupRecord(fixture, record);
    assert.deepEqual(fixture.score.fullTime, { home: 0, away: 4 });
    assert.equal(fixture.status, 'FINISHED');
    assert.equal(fixture.homeTeam.crest, 'https://example.com/madrid.png');
    assert.equal(fixture.awayTeam.crest, 'https://existing.com/crest.png');
    fixture.score.fullTime = { home: 1, away: 2 };
    applyCupRecord(fixture, record);
    assert.deepEqual(fixture.score.fullTime, { home: 1, away: 2 });
    const cancelled = { homeTeam: {}, awayTeam: {}, status: 'CANCELLED' };
    applyCupRecord(cancelled, record);
    assert.equal(cancelled.status, 'CANCELLED');
    assert.equal(cancelled.score, undefined);
});

test('provider failures and truncated responses are errors, never empty success', async () => {
    const original = global.fetch;
    try {
        global.fetch = async () => new Response('unavailable', { status: 503 });
        await assert.rejects(fetchCupRecords('esp.copa_del_rey', '2026'), /HTTP 503/);
        global.fetch = async () => new Response(JSON.stringify({ events: Array(1000).fill({}) }));
        await assert.rejects(fetchCupRecords('esp.copa_del_rey', '2026'), /truncated/);
        await assert.rejects(fetchCupRecords('esp.copa_del_rey', 'invalid'), /Invalid cup year/);
    } finally { global.fetch = original; }
});
