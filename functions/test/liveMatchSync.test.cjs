const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const admin = require('../node_modules/firebase-admin');
const { syncLiveMatches, liveResult, liveSource } = require('../lib/liveMatchSync');
const { resultUpdate } = require('../lib/matchSync');

const now = Date.parse('2026-11-03T20:00:00Z');
const timestamp = admin.firestore.Timestamp.fromMillis(now - 3600_000);
const fixture = overrides => ({
    timestamp, homeTeam: { name: 'FC Barcelona' }, awayTeam: { name: 'Getafe' },
    competition: { name: 'Primera Division' }, category: 'masculino', status: 'scheduled',
    timeConfirmed: true, homeScore: null, awayScore: null, scorePending: false, ...overrides,
});
const event = (overrides = {}) => ({
    id: 'espn-1', date: timestamp.toDate().toISOString(), status: { type: { state: 'in', name: 'STATUS_IN_PROGRESS' } },
    competitions: [{ competitors: [
        { homeAway: 'home', team: { displayName: 'Barcelona' }, score: '0' },
        { homeAway: 'away', team: { displayName: 'Getafe' }, score: '0' },
    ] }], ...overrides,
});
function database(entries, beforeTransaction = () => {}) {
    const records = new Map(entries.map(([id, value]) => [`matches/${id}`, value]));
    const writes = [], bounds = [];
    const ref = path => ({ path, set: async patch => write(path, patch) });
    const write = (path, patch) => { writes.push(path); records.set(path, { ...records.get(path), ...patch }); };
    const query = {
        where(field, operator, value) { bounds.push([field, operator, value]); return query; },
        async get() {
            return { docs: [...records].filter(([path, value]) => path.startsWith('matches/')
                && bounds.every(([field, op, bound]) => op === '>=' ? value[field].toMillis() >= bound.toMillis() : value[field].toMillis() <= bound.toMillis()))
                .map(([path, value]) => ({ id: path.split('/')[1], data: () => value, ref: ref(path) })) };
        },
    };
    const db = {
        collection(name) { assert.equal(name, 'matches'); return query; }, doc: ref,
        async runTransaction(operation) {
            beforeTransaction(records);
            return operation({
                get: async reference => ({ data: () => records.get(reference.path) }),
                set: (reference, patch) => write(reference.path, patch),
            });
        },
    };
    return { db, records, writes, bounds };
}
function provider(t, events) {
    const requests = [];
    t.mock.method(global, 'fetch', async url => {
        requests.push(url);
        return new Response(JSON.stringify({ events }));
    });
    return requests;
}

test('idle ticks read only the playing window, with no provider requests or writes', async t => {
    const requests = provider(t, []);
    const store = database([
        ['finished', fixture({ status: 'finished' })], ['postponed', fixture({ status: 'postponed' })],
        ['unknown-time', fixture({ timeConfirmed: false })], ['duplicate', fixture({ duplicateOf: 'other' })],
        ['not-barca', fixture({ homeTeam: { name: 'Real Madrid' } })],
        ['future', fixture({ timestamp: admin.firestore.Timestamp.fromMillis(now + 1) })],
        ['old', fixture({ timestamp: admin.firestore.Timestamp.fromMillis(now - 4 * 3600_000 - 1) })],
    ]);
    assert.deepEqual(await syncLiveMatches(store.db, {}, now), { active: 0, updated: 0, finished: 0 });
    assert.equal(requests.length, 0);
    assert.deepEqual(store.writes, []);
    assert.equal(store.bounds[0][2].toMillis(), now - 4 * 3600_000);
    assert.equal(store.bounds[1][2].toMillis(), now);
});

test('zero scores, half-time, extra time, final and postponed events are handled explicitly', () => {
    for (const name of ['STATUS_IN_PROGRESS', 'STATUS_HALFTIME', 'STATUS_EXTRA_TIME']) {
        assert.deepEqual(liveResult(event({ status: { type: { state: 'in', name } } })), {
            status: 'live', homeScore: 0, awayScore: 0, eventId: 'espn-1',
        });
    }
    assert.equal(liveResult(event({ status: { type: { state: 'post', completed: true } } })).status, 'finished');
    assert.equal(liveResult(event({ status: { type: { state: 'pre' } } })), null);
    assert.equal(liveResult(event({ status: { type: { name: 'STATUS_POSTPONED' } } })).status, 'postponed');
    assert.throws(() => liveResult(event({ competitions: [] })), /Missing live score/);
    assert.throws(() => liveResult(event({ id: undefined })), /Invalid live event/);
});

test('active matches share one competition/day request and unchanged scores do not rewrite matches', async t => {
    const requests = provider(t, [event()]);
    const store = database([['1', fixture()], ['2', fixture()]]);
    assert.deepEqual(await syncLiveMatches(store.db, {}, now), { active: 2, updated: 2, finished: 0 });
    assert.equal(requests.length, 1);
    assert.match(requests[0], /esp\.1\/scoreboard\?dates=20261103/);
    assert.equal(store.records.get('matches/1').homeScore, 0);
    store.writes.length = 0;
    await syncLiveMatches(store.db, {}, now);
    assert.deepEqual(store.writes, ['system/live_sync_status']);
});

test('final transitions happen once; concurrent final, postponement and kickoff edits win over stale responses', async t => {
    provider(t, [event({ status: { type: { completed: true, state: 'post' } } })]);
    const normal = database([['1', fixture()]]);
    assert.equal((await syncLiveMatches(normal.db, {}, now)).finished, 1);
    assert.equal((await syncLiveMatches(normal.db, {}, now)).active, 0);
    for (const patch of [
        { status: 'finished', homeScore: 3, awayScore: 1 }, { status: 'postponed' },
        { timestamp: admin.firestore.Timestamp.fromMillis(now + 3600_000) },
    ]) {
        const store = database([['1', fixture()]], records => records.set('matches/1', { ...records.get('matches/1'), ...patch }));
        assert.equal((await syncLiveMatches(store.db, {}, now)).updated, 0);
        assert.deepEqual(store.writes, ['system/live_sync_status']);
    }
});

test('missing, ambiguous, malformed, truncated and failed sources fail rather than inventing results', async t => {
    for (const [body, status] of [
        [{ events: [] }, 200], [{ events: [event(), event()] }, 200], [{ events: [event({ competitions: [] })] }, 200],
        [{}, 200], [{ events: Array(100).fill(event()) }, 200], [{}, 429],
    ]) {
        t.mock.method(global, 'fetch', async () => new Response(JSON.stringify(body), { status }));
        const store = database([['1', fixture()]]);
        await assert.rejects(syncLiveMatches(store.db, {}, now), /Live sync incomplete/);
        assert.deepEqual(store.writes, ['system/live_sync_status']);
        assert.equal(store.records.get('system/live_sync_status').failedSources.length, 1);
        t.mock.restoreAll();
    }
    const unsupported = database([['1', fixture({ competition: { name: 'Unknown tournament' } })]]);
    await assert.rejects(syncLiveMatches(unsupported.db, {}, now), /Live sync incomplete/);
    assert.deepEqual(unsupported.records.get('system/live_sync_status').failedSources, ['competition:1']);
});

test('women competitions have distinct routing; Supercopa calendar supplies only verified final scores', async t => {
    assert.equal(liveSource('Liga F', 'femenino'), 'esp.w.1');
    assert.equal(liveSource('UEFA Champions League', 'femenino'), 'uefa.wchampions');
    assert.equal(liveSource('Supercopa', 'masculino'), 'esp.super_cup');
    assert.equal(liveSource('Supercopa', 'femenino'), 'women-calendar');
    let response = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:women-final@example.com\r\nDTSTART:20261103T190000Z\r\nSUMMARY:FC Barcelona - Getafe [Supercopa]\r\nEND:VEVENT\r\nEND:VCALENDAR';
    const urls = [];
    t.mock.method(global, 'fetch', async url => { urls.push(url); return new Response(response); });
    const store = database([['1', fixture({ category: 'femenino', competition: { name: 'Supercopa' } })]]);
    assert.equal((await syncLiveMatches(store.db, { womenCalendarUrl: 'https://calendar.example/women' }, now)).updated, 0);
    response = response.replace('[Supercopa]', '[Supercopa] (2-0)');
    assert.equal((await syncLiveMatches(store.db, { womenCalendarUrl: 'https://calendar.example/women' }, now)).finished, 1);
    assert.equal(store.records.get('matches/1').homeScore, 2);
    assert(urls.every(url => url === 'https://calendar.example/women'));
});

test('daily calendar cannot downgrade live or confirmed final scores', t => {
    t.mock.method(Date, 'now', () => now);
    const providerFixture = { status: 'SCHEDULED', utcDate: timestamp.toDate().toISOString() };
    assert.equal(resultUpdate(providerFixture, { status: 'live', homeScore: 1, awayScore: 0 }).status, 'live');
    assert.equal(resultUpdate({ ...providerFixture, status: 'IN_PLAY' }, { status: 'finished', homeScore: 3, awayScore: 0 }).status, 'finished');
});

test('daily cron and minute live entrypoints are isolated; full refresh is attempted only after a new final', async () => {
    const module = { exports: {} }, calls = [];
    let finished = 0;
    vm.runInNewContext(fs.readFileSync(require.resolve('../lib/scheduledMatchSync'), 'utf8'), {
        exports: module.exports, require(name) {
            if (name === 'firebase-admin') return { apps: [{}], firestore: () => 'db' };
            if (name === 'firebase-functions/params') return { defineSecret: () => ({ value: () => '{}' }) };
            if (name === 'firebase-functions/v2/scheduler') return { onSchedule: (options, run) => ({ options, run }) };
            if (name === './liveMatchSync') return { syncLiveMatches: async () => ({ finished }) };
            if (name === './matchSync') return { syncMatches: async () => calls.push('full') };
            throw new Error(name);
        },
    });
    const { scheduledMatchSync: daily, scheduledLiveMatchSync: live } = module.exports;
    assert.equal(daily.options.schedule, '15 5 * * *');
    assert.equal(daily.options.timeZone, 'Europe/Madrid');
    assert.equal(live.options.schedule, 'every 1 minutes');
    assert.equal(live.options.concurrency, 1);
    await live.run();
    assert.deepEqual(calls, []);
    finished = 1;
    await live.run();
    assert.deepEqual(calls, ['full']);
    await daily.run();
    assert.deepEqual(calls, ['full', 'full']);
});
