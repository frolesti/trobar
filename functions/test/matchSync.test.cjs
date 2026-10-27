const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseCalendar, resultUpdate, syncMatches, copaFixtureIdentity, reconcileCopaDuplicates, fixtureIdentity, calendarStage } = require('../lib/matchSync');
const admin = require('../node_modules/firebase-admin');

function calendar(summary, extra = '') {
    return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:fixture-123@example.com\r\nDTSTART;TZID=Europe/Madrid:20261010T183000\r\nSUMMARY:${summary}\r\n${extra}END:VEVENT\r\nEND:VCALENDAR`;
}

test('ICS timezone, stable legacy ID and zero scores', () => {
    const [fixture] = parseCalendar(calendar('FC Barcelona Women - Real Madrid Women [CL] (0-0)'), 'femenino');
    assert.equal(fixture.id, 'ics_fixture-123');
    assert.equal(fixture.utcDate, '2026-10-10T16:30:00.000Z');
    assert.equal(fixture.competition.id, 'ics_uwcl');
    assert.equal(fixture.homeTeam.id, 'ics_fc_barcelona');
    assert.deepEqual(resultUpdate(fixture), { status: 'finished', homeScore: 0, awayScore: 0, scorePending: false });
});

test('past calendar without scores is not falsely marked finished', () => {
    const [fixture] = parseCalendar(calendar('FC Barcelona - Opponent', 'DTSTAMP:20000101T000000Z\r\n').replace('20261010T183000', '20001010T183000'), 'femenino');
    assert.equal(fixture.status, 'SCHEDULED');
    assert.equal(resultUpdate(fixture).scorePending, true);
});

test('missing provider score does not erase a confirmed result', () => {
    const [fixture] = parseCalendar(calendar('FC Barcelona - Real Madrid'), 'femenino');
    assert.deepEqual(resultUpdate(fixture, { status: 'finished', homeScore: 7, awayScore: 0 }), {
        status: 'finished', homeScore: 7, awayScore: 0, scorePending: false,
    });
});

test('new confirmed scores correct previous scores', () => {
    const [fixture] = parseCalendar(calendar('FC Barcelona - Real Madrid (2-0)'), 'femenino');
    assert.equal(resultUpdate(fixture, { status: 'finished', homeScore: 1, awayScore: 0 }).homeScore, 2);
});

test('men calendar only imports Copa and preserves IDs', () => {
    assert.equal(parseCalendar(calendar('FC Barcelona - Getafe [Liga]'), 'masculino').length, 0);
    const [fixture] = parseCalendar(calendar('FC Barcelona - Getafe [Copa] (3-1)'), 'masculino');
    assert.equal(fixture.id, 'ics_copa_fixture-123');
    assert.equal(fixture.homeTeam.id, 'ics_m_fc_barcelona');
});

test('cancelled calendar events stay postponed rather than finished', () => {
    const [fixture] = parseCalendar(calendar('FC Barcelona - Getafe', 'STATUS:CANCELLED\r\n'), 'femenino');
    assert.equal(resultUpdate(fixture).status, 'postponed');
});

test('invalid calendar is a provider error rather than empty success', () => {
    assert.throws(() => parseCalendar('<html>Unavailable</html>', 'femenino'), /Invalid calendar/);
});

test('scheduled sync is idempotent and preserves ordinal IDs and confirmed results', async () => {
    const originalFetch = global.fetch;
    const records = new Map([
        ['system/id_mappings', { competitions: { 2014: 1 }, teams: { 81: 1, 82: 2 }, matches: { 564700: 464 }, nextCompId: 2, nextTeamId: 3, nextMatchId: 465 }],
        ['matches/464', { status: 'scheduled', homeScore: null, awayScore: null }],
    ]);
    const snapshot = path => ({ id: path.split('/').pop(), data: () => path === 'system/id_mappings' ? structuredClone(records.get(path)) : records.get(path) });
    const write = (path, data, options) => {
        const merged = options?.merge ? { ...records.get(path), ...data } : { ...data };
        for (const [key, value] of Object.entries(merged)) {
            if (value?.isEqual?.(admin.firestore.FieldValue.delete())) delete merged[key];
        }
        records.set(path, merged);
    };
    const fakeDb = {
        doc: path => ({ path, set: async (data, options) => write(path, data, options) }),
        collection: () => ({ get: async () => ({ docs: [] }), where: () => ({ get: async () => ({ docs: [] }) }) }),
        runTransaction: async operation => {
            const writes = [];
            const transaction = {
                get: async ref => snapshot(ref.path),
                getAll: async (...refs) => refs.map(ref => snapshot(ref.path)),
                set: (ref, data, options) => writes.push([ref.path, data, options]),
            };
            const result = await operation(transaction);
            for (const [path, data, options] of writes) write(path, data, options);
            return result;
        },
    };
    const fixture = { id: 564700, utcDate: '2026-10-10T16:30:00Z', status: 'FINISHED', competition: { id: 2014, name: 'Primera Division' }, homeTeam: { id: 81, name: 'FC Barcelona' }, awayTeam: { id: 82, name: 'Getafe' }, score: { fullTime: { home: 3, away: 0 } } };
    let calendarUid = 'first-import';
    global.fetch = async url => new Response(url.includes('football-data') ? JSON.stringify({ matches: [fixture] })
        : calendar(url.includes('women') ? 'FC Barcelona - Real Madrid (7-0)' : 'FC Barcelona - Getafe [Copa] (3-1)').replace('fixture-123@example.com', url.includes('women') ? 'fixture-123@example.com' : `${calendarUid}@example.com`), { status: 200 });
    const config = { footballDataApiKey: 'test', womenCalendarUrl: 'https://example.com/women.ics', menCalendarUrl: 'https://example.com/men.ics' };
    try {
        await syncMatches(fakeDb, config);
        const count = [...records.keys()].filter(path => path.startsWith('matches/')).length;
        const first = records.get('matches/464');
        assert.equal(first.homeScore, 3);
        assert.equal(first.awayScore, 0);
        assert.equal(first.status, 'finished');
        assert.equal(first.homeTeam.id, '1');
        fixture.score.fullTime = { home: null, away: null };
        fixture.status = 'SCHEDULED';
        calendarUid = 'second-import';
        await syncMatches(fakeDb, config);
        assert.equal([...records.keys()].filter(path => path.startsWith('matches/')).length, count);
        assert.equal(records.get('matches/464').homeScore, 3);
        assert.equal(records.get('matches/464').status, 'finished');
        assert.equal(records.get('system/id_mappings').matches['564700'], 464);
        assert.equal(records.get('system/sync_status').failedSources.length, 0);
        assert.equal([...records.values()].filter(record => record.competition?.name === 'Copa del Rey').length, 1);
    } finally { global.fetch = originalFetch; }
});

test('Copa reconciliation preserves documents and aliases unstable calendar IDs', async () => {
    const fixture = { competition: { name: 'Copa del Rey' }, timestamp: admin.firestore.Timestamp.fromDate(new Date('2016-02-03T20:00:00Z')), homeTeam: { name: 'FC Barcelona' }, awayTeam: { name: 'Valencia' } };
    const records = new Map([
        ['system/id_mappings', { matches: { ics_copa_old: 228, ics_copa_new: 294 } }],
        ['matches/228', { ...fixture, apiId: 'ics_copa_old', homeScore: 7, awayScore: 0 }],
        ['matches/294', { ...fixture, apiId: 'ics_copa_new', homeScore: 7, awayScore: 0 }],
    ]);
    const documents = [...records].filter(([path]) => path.startsWith('matches/')).map(([path, data]) => ({ id: path.split('/')[1], ref: { path }, data: () => data }));
    const db = {
        collection: () => ({ get: async () => ({ docs: documents }) }),
        doc: path => ({ path }),
        runTransaction: async operation => operation({
            get: async ref => ({ data: () => structuredClone(records.get(ref.path)) }),
            set: (ref, data, options) => records.set(ref.path, options?.merge ? { ...records.get(ref.path), ...data } : data),
        }),
    };
    await reconcileCopaDuplicates(db);
    assert.equal(records.get('matches/294').duplicateOf, '228');
    assert.equal(records.get('matches/228').duplicateOf, undefined);
    assert.equal(records.get('matches/294').homeScore, 7);
    assert.equal(records.get('system/id_mappings').matches.ics_copa_new, 228);
    assert.equal(records.get('system/id_mappings').matches[copaFixtureIdentity('2016-02-03', 'FC Barcelona', 'Valencia')], 228);
    assert.equal(records.size, 3);
});

test('Copa identity does not depend on unstable calendar UIDs or score', () => {
    assert.equal(copaFixtureIdentity('2016-02-03T20:00:00Z', 'FC Barcelona', 'València'), copaFixtureIdentity('2016-02-03T21:00:00Z', 'FC Barcelona', 'Valencia'));
    assert.notEqual(copaFixtureIdentity('2016-02-03', 'FC Barcelona', 'Valencia'), copaFixtureIdentity('2016-02-10', 'Valencia', 'FC Barcelona'));
});

test('all competitions use stable identity across provider names but never across categories, dates or competitions', () => {
    const identity = (home, away, competition = "UEFA Women's Champions League", category = 'femenino', date = '2025-12-10') => fixtureIdentity(date, home, away, competition, category);
    assert.equal(identity('FC Barcelona', 'SL Benfica'), identity('Barcelona Women', 'SL Benfica'));
    assert.notEqual(identity('Barcelona', 'Benfica'), identity('Barcelona', 'Benfica', 'Liga F'));
    assert.notEqual(identity('Barcelona', 'Benfica'), identity('Barcelona', 'Benfica', undefined, 'masculino'));
    assert.notEqual(identity('Barcelona', 'Benfica'), identity('Barcelona', 'Benfica', undefined, undefined, '2025-12-17'));
    assert.notEqual(identity('Barcelona', 'Benfica'), identity('Benfica', 'Barcelona'));
});

test('calendar stages are parsed only from explicit provider descriptions', () => {
    for (const [description, expected] of [['Semi-final', 'SEMI_FINALS'], ['Quarter-finals', 'QUARTER_FINALS'], ['Vuitens de final', 'LAST_16'], ['Round of 32', 'LAST_32'], ['Final', 'FINAL'], ['Group stage', 'GROUP_STAGE'], ['League phase', 'LEAGUE_STAGE']]) {
        assert.equal(calendarStage(description), expected);
        const [fixture] = parseCalendar(calendar('Barcelona - Opponent [CL]', `DESCRIPTION:${description}\r\n`), 'femenino');
        assert.equal(fixture.stage, expected);
    }
    assert.equal(calendarStage('Barcelona - Benfica [CL]'), undefined);
});

test('women Champions reconciliation merges Barcelona aliases and preserves a confirmed result', async () => {
    const base = { category: 'femenino', competition: { name: "UEFA Women's Champions League" }, timestamp: admin.firestore.Timestamp.fromDate(new Date('2025-12-10T20:00:00Z')), awayTeam: { name: 'Benfica' } };
    const records = new Map([
        ['system/id_mappings', { matches: {} }],
        ['matches/10', { ...base, apiId: 'old', homeTeam: { name: 'FC Barcelona' } }],
        ['matches/20', { ...base, apiId: 'new', homeTeam: { name: 'Barcelona' }, homeScore: 3, awayScore: 1, status: 'finished' }],
    ]);
    const documents = [...records.keys()].filter(key => key.startsWith('matches/')).map(key => ({ id: key.split('/')[1], ref: { path: key }, data: () => records.get(key) }));
    const database = {
        collection: () => ({ get: async () => ({ docs: documents }) }), doc: path => ({ path }),
        runTransaction: async operation => operation({
            get: async ref => ({ data: () => structuredClone(records.get(ref.path)) }),
            set: (ref, data, options) => records.set(ref.path, options?.merge ? { ...records.get(ref.path), ...data } : data),
        }),
    };
    await reconcileCopaDuplicates(database);
    await reconcileCopaDuplicates(database);
    assert.equal(records.get('matches/20').duplicateOf, '10');
    assert.equal(records.get('matches/10').homeScore, 3);
    assert.equal(records.get('matches/10').awayScore, 1);
    assert.equal(records.get('system/id_mappings').matches.new, 10);
    assert.equal(records.size, 3);
});