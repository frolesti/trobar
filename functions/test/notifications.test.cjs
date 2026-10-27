const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    preferences, millis, reminderEligible, resultEligible, newlyVerified, nearbyEligible,
    promotionEligible, validPushToken, deliver, checkReceipts, hash, MINUTE, WINDOW,
} = require('../lib/notificationDelivery');

const NOW = Date.UTC(2026, 9, 20, 18);
const match = (overrides = {}) => ({ timestamp: NOW + 60 * MINUTE, status: 'scheduled', timeConfirmed: true, ...overrides });
const bar = (overrides = {}) => ({ source: 'verified', tier: 'premium', ownerId: 'owner',
    verifiedAt: NOW, latitude: 41.38, longitude: 2.15, ...overrides });
const user = (overrides = {}) => ({
    preferences: { notifications: { newBarNearby: true, barPromotions: true }, display: { searchRadius: 2000 } },
    notificationLocation: { latitude: 41.38, longitude: 2.15, consent: 'foreground', updatedAt: NOW }, ...overrides,
});
const token = index => ({ id: `device-${index}`, token: `ExpoPushToken[token_${index}]`, platform: 'ios', updatedAt: NOW });
const notice = (overrides = {}) => ({ eventKey: 'event-1', kind: 'liveResults', title: 'Resultat', body: '1 - 0',
    data: { matchId: 'match-1' }, expiresAt: NOW + 60 * MINUTE, ...overrides });

function memoryStore(tokens = [token(0)]) {
    const ledgers = new Map();
    const removed = [];
    return {
        ledgers, removed, tokenList: tokens,
        async claim(uid, message, owner, now) {
            const key = `${uid}:${message.eventKey}`;
            const existing = ledgers.get(key);
            if (existing && (existing.state === 'done' || existing.leaseUntil > now || existing.nextAttemptAt > now)) return null;
            const ledger = structuredClone(existing ?? { notice: message, state: 'active', items: {}, nextAttemptAt: 0, expiresAt: message.expiresAt });
            for (const item of Object.values(ledger.items)) if (item.state === 'sending') item.state = 'unknown';
            ledger.lease = owner;
            ledger.leaseUntil = now + 10 * MINUTE;
            ledgers.set(key, structuredClone(ledger));
            return ledger;
        },
        async save(uid, ledger) { ledgers.set(`${uid}:${ledger.notice.eventKey}`, structuredClone(ledger)); },
        async tokens() { return this.tokenList; },
        async removeToken(uid, id, expectedHash) {
            removed.push({ uid, id, expectedHash });
            this.tokenList = this.tokenList.filter(value => value.id !== id || hash(value.token) !== expectedHash);
        },
    };
}
const ok = data => ({ ok: true, status: 200, json: async () => ({ data }) });
const tickets = async (_url, init) => ok(JSON.parse(init.body).map((_value, index) => ({ status: 'ok', id: `ticket-${index}` })));

test('preference defaults, partial defaults and invalid values fail closed', () => {
    assert.deepEqual(preferences({}), { matchReminder: 60, liveResults: true, newBarNearby: false, barPromotions: false });
    assert.equal(preferences({ preferences: { notifications: { liveResults: false } } }).matchReminder, 60);
    for (const value of [null, false, '60', -1, 15, 180]) {
        assert.equal(preferences({ preferences: { notifications: { matchReminder: value } } }).matchReminder, 0);
    }
    assert.equal(preferences({ preferences: { notifications: { newBarNearby: 'true', liveResults: null } } }).newBarNearby, false);
    assert.equal(preferences({ preferences: { notifications: { liveResults: null } } }).liveResults, false);
});

test('reminders honor all leads, opt-out and half-open five-minute window', () => {
    for (const lead of [30, 60, 120]) {
        const recipient = { preferences: { notifications: { matchReminder: lead } } };
        const fixture = match({ timestamp: NOW + lead * MINUTE });
        assert.equal(reminderEligible(fixture, recipient, NOW, lead), true);
        assert.equal(reminderEligible(fixture, recipient, NOW - 1), false);
        assert.equal(reminderEligible(fixture, recipient, NOW + WINDOW - 1), true);
        assert.equal(reminderEligible(fixture, recipient, NOW + WINDOW), false);
        assert.equal(reminderEligible(fixture, recipient, NOW, lead === 30 ? 60 : 30), false);
    }
    assert.equal(reminderEligible(match(), { preferences: { notifications: { matchReminder: 0 } } }, NOW), false);
});

test('reminders exclude unknown times, cancelled, duplicate and historical matches', () => {
    for (const change of [{ timestamp: undefined }, { timestamp: '2026-10-20' }, { timestamp: NaN },
        { timestamp: NOW - MINUTE }, { timeConfirmed: false }, { timeConfirmed: undefined },
        { status: 'finished' }, { status: 'postponed' }, { status: 'cancelled' }, { duplicateOf: 'canonical' }, { cancelled: true }]) {
        assert.equal(reminderEligible(match(change), {}, NOW), false, JSON.stringify(change));
    }
    assert.equal(millis({ toMillis: () => NOW }), NOW);
    assert.equal(Number.isNaN(millis({ toMillis: () => { throw new Error('invalid'); } })), true);
});

test('match category is checked against the users selected category', () => {
    const recipient = { preferences: { notifications: { matchReminder: 60 }, display: { defaultCategory: 'femenino' } } };
    assert.equal(reminderEligible(match({ category: 'femenino' }), recipient, NOW), true);
    assert.equal(reminderEligible(match({ category: 'masculino' }), recipient, NOW), false);
    assert.equal(reminderEligible(match({ category: 'masculino' }), { preferences: { display: { defaultCategory: 'all' } } }, NOW), true);
});

test('live results notify goals and scoreless final transitions, not corrections or historical imports', () => {
    const before = match({ timestamp: NOW - 90 * MINUTE, status: 'live', homeScore: 0, awayScore: 0 });
    const after = { ...before, homeScore: 1 };
    assert.equal(resultEligible(before, after, NOW), true);
    assert.equal(resultEligible(before, { ...after, status: 'finished' }, NOW), true);
    assert.equal(resultEligible(after, { ...after, status: 'finished' }, NOW), true);
    assert.equal(resultEligible(after, { ...after, homeScore: 0 }, NOW), false);
    assert.equal(resultEligible({ ...after, status: 'finished' }, { ...after, status: 'finished', homeScore: 2 }, NOW), false);
    for (const change of [{ homeScore: '1' }, { homeScore: 1.5 }, { awayScore: -1 }, { awayScore: null },
        { duplicateOf: 'other' }, { cancelled: true }, { timestamp: NOW + MINUTE },
        { timestamp: NOW - 5 * 60 * MINUTE }, { status: 'scheduled' }, { timeConfirmed: false }]) {
        assert.equal(resultEligible(before, { ...after, ...change }, NOW), false);
    }
    assert.equal(resultEligible({ ...before, timestamp: NOW - 5 * 60 * MINUTE }, after, NOW), false);
    assert.equal(resultEligible({}, after, NOW), false);
});

test('nearby requires paid verification, explicit fresh foreground consent and valid radius/location', () => {
    assert.equal(nearbyEligible(user(), bar(), 'newBarNearby', NOW), true);
    assert.equal(nearbyEligible(user(), bar(), 'barPromotions', NOW), true);
    assert.equal(nearbyEligible({}, bar(), 'newBarNearby', NOW), false);
    for (const location of [{ consent: undefined }, { updatedAt: NOW - 30 * 86400_000 - 1 },
        { updatedAt: NOW + 1 }, { latitude: NaN }, { longitude: 181 }, { latitude: 42 }]) {
        const recipient = user();
        Object.assign(recipient.notificationLocation, location);
        assert.equal(nearbyEligible(recipient, bar(), 'newBarNearby', NOW), false);
    }
    const boundary = user();
    boundary.notificationLocation.updatedAt = NOW - 30 * 86400_000;
    assert.equal(nearbyEligible(boundary, bar(), 'newBarNearby', NOW), true);
    for (const change of [{ tier: 'free' }, { ownerId: '' }, { source: 'user_reported' }, { latitude: Infinity }]) {
        assert.equal(nearbyEligible(user(), bar(change), 'newBarNearby', NOW), false);
    }
    const invalidRadius = user();
    invalidRadius.preferences.display.searchRadius = 100000;
    assert.equal(nearbyEligible(invalidRadius, bar(), 'barPromotions', NOW), false);
    assert.equal(newlyVerified({}, bar()), true);
    assert.equal(newlyVerified(bar({ tier: 'free' }), bar()), false);
    assert.equal(newlyVerified(bar(), bar()), false);
});

test('promotions require published content, expiry and the owner-paid gate', () => {
    const promotion = { status: 'published', title: 'Oferta', body: 'Oferta del bar', expiresAt: NOW + MINUTE };
    assert.equal(promotionEligible(promotion, bar(), NOW), true);
    for (const change of [{ status: 'draft' }, { title: ' ' }, { body: '' }, { title: 'a'.repeat(121) },
        { expiresAt: NOW }, { expiresAt: undefined }, { deleted: true }]) {
        assert.equal(promotionEligible({ ...promotion, ...change }, bar(), NOW), false);
    }
    assert.equal(promotionEligible(promotion, bar({ ownerId: null }), NOW), false);
});

test('token validation accepts only Expo tokens with native platform and timestamp', () => {
    assert.equal(validPushToken(token(0)), true);
    assert.equal(validPushToken({ ...token(0), token: 'ExponentPushToken[abc-123]' }), true);
    for (const change of [{ token: 'raw-apns-or-fcm' }, { platform: 'web' }, { updatedAt: null }, { token: null }]) {
        assert.equal(validPushToken({ ...token(0), ...change }), false);
    }
});

test('delivery chunks 100, deduplicates tokens and never sends tokens in payload data', async () => {
    const store = memoryStore([...Array.from({ length: 205 }, (_value, index) => token(index)), token(0)]);
    const sizes = [];
    await deliver(store, 'user', notice(), async () => true, async (url, init) => {
        assert.equal(url, 'https://exp.host/--/api/v2/push/send');
        const messages = JSON.parse(init.body);
        sizes.push(messages.length);
        assert.deepEqual(messages[0].data, { matchId: 'match-1' });
        assert.equal(messages[0].ttl, 3600);
        return ok(messages.map((_message, index) => ({ status: 'ok', id: `${sizes.length}-${index}` })));
    }, () => NOW);
    assert.deepEqual(sizes, [100, 100, 5]);
    const ledger = store.ledgers.get('user:event-1');
    assert.equal(Object.keys(ledger.items).length, 205);
    assert.equal(JSON.stringify(ledger).includes('ExpoPushToken['), false);
});

test('overlapping workers and later redelivery send an event only once per user/token', async () => {
    const store = memoryStore();
    let calls = 0;
    const fetcher = async (...args) => { calls++; return tickets(...args); };
    await Promise.all(Array.from({ length: 4 }, () => deliver(store, 'user', notice(), async () => true, fetcher, () => NOW)));
    await deliver(store, 'user', notice(), async () => true, fetcher, () => NOW + 20 * MINUTE);
    assert.equal(calls, 1);
    await deliver(store, 'another-user', notice(), async () => true, fetcher, () => NOW);
    assert.equal(calls, 2);
});

test('preferences are rechecked before every chunk and opt-out/expiry prevent sends', async () => {
    const store = memoryStore(Array.from({ length: 150 }, (_value, index) => token(index)));
    let checks = 0;
    let sends = 0;
    await deliver(store, 'user', notice(), async () => ++checks <= 2, async (...args) => { sends++; return tickets(...args); }, () => NOW);
    assert.equal(sends, 1);
    await deliver(store, 'opted-out', notice(), async () => false, async () => { throw new Error('must not send'); }, () => NOW);
    await deliver(store, 'expired', notice({ expiresAt: NOW }), async () => true, async () => { throw new Error('must not send'); }, () => NOW);
    assert.equal(store.ledgers.size, 1);
});

test('explicit throttles retry with backoff at most three attempts', async () => {
    const store = memoryStore();
    let calls = 0;
    const fetcher = async () => { calls++; return { ok: false, status: 429, json: async () => ({}) }; };
    await deliver(store, 'user', notice(), async () => true, fetcher, () => NOW);
    await deliver(store, 'user', notice(), async () => true, fetcher, () => NOW + 1);
    assert.equal(calls, 1);
    await deliver(store, 'user', notice(), async () => true, fetcher, () => NOW + MINUTE);
    await deliver(store, 'user', notice(), async () => true, fetcher, () => NOW + 2 * MINUTE);
    await deliver(store, 'user', notice(), async () => true, fetcher, () => NOW + 3 * MINUTE);
    assert.equal(calls, 3);
    assert.equal(store.ledgers.get('user:event-1').items[hash(token(0).token)].state, 'failed');
});

test('uncertain network, 5xx and malformed ticket responses are not blindly retried', async () => {
    for (const fetcher of [async () => { throw new Error('network'); }, async () => ({ ok: false, status: 503 }),
        async () => ok([]), async () => ok([{ status: 'ok' }])]) {
        const store = memoryStore();
        let calls = 0;
        const wrapped = async (...args) => { calls++; return fetcher(...args); };
        await deliver(store, 'user', notice(), async () => true, wrapped, () => NOW);
        await deliver(store, 'user', notice(), async () => true, wrapped, () => NOW + MINUTE);
        assert.equal(calls, 1);
        assert.equal(store.ledgers.get('user:event-1').items[hash(token(0).token)].state, 'unknown');
    }
});

test('ticket DeviceNotRegistered deletes only the matching token; permanent errors do not retry', async () => {
    const store = memoryStore([token(0), token(1)]);
    await deliver(store, 'user', notice(), async () => true, async () => ok([
        { status: 'error', details: { error: 'DeviceNotRegistered' } },
        { status: 'error', details: { error: 'MessageTooBig' } },
    ]), () => NOW);
    assert.deepEqual(store.removed, [{ uid: 'user', id: token(0).id, expectedHash: hash(token(0).token) }]);
    assert.equal(store.tokenList.length, 1);
    assert.equal(store.ledgers.get('user:event-1').state, 'done');
});

test('receipts are delayed, clean invalid tokens after message expiry, and never resend', async () => {
    const store = memoryStore([token(0), token(1)]);
    await deliver(store, 'user', notice({ expiresAt: NOW + MINUTE }), async () => true, tickets, () => NOW);
    const ledger = store.ledgers.get('user:event-1');
    let calls = 0;
    const receipts = async (url, init) => {
        calls++;
        assert.equal(url, 'https://exp.host/--/api/v2/push/getReceipts');
        assert.deepEqual(JSON.parse(init.body), { ids: ['ticket-0', 'ticket-1'] });
        return ok({ 'ticket-0': { status: 'error', details: { error: 'DeviceNotRegistered' } }, 'ticket-1': { status: 'ok' } });
    };
    await checkReceipts(store, 'user', ledger, receipts, NOW + MINUTE);
    assert.equal(calls, 0);
    await checkReceipts(store, 'user', ledger, receipts, NOW + 15 * MINUTE);
    assert.equal(calls, 1);
    assert.equal(store.removed.length, 1);
    assert.deepEqual(Object.values(ledger.items).map(item => item.state), ['failed', 'done']);
});

test('missing receipts retry polling until 24 hours then become unknown', async () => {
    const store = memoryStore();
    await deliver(store, 'user', notice(), async () => true, tickets, () => NOW);
    const ledger = store.ledgers.get('user:event-1');
    await checkReceipts(store, 'user', ledger, async () => ok({}), NOW + 15 * MINUTE);
    assert.equal(Object.values(ledger.items)[0].state, 'accepted');
    await checkReceipts(store, 'user', ledger, async () => ok({}), NOW + 24 * 60 * MINUTE);
    assert.equal(Object.values(ledger.items)[0].state, 'unknown');
});

test('a crashed sending lease becomes unknown rather than resending', async () => {
    const store = memoryStore();
    const ledger = await store.claim('user', notice(), 'old-owner', NOW);
    ledger.items[hash(token(0).token)] = { tokenId: token(0).id, tokenHash: hash(token(0).token), state: 'sending', attempts: 1 };
    await store.save('user', ledger);
    let sends = 0;
    await deliver(store, 'user', notice(), async () => true, async () => { sends++; return ok([]); }, () => NOW + 11 * MINUTE);
    assert.equal(sends, 0);
    assert.equal(store.ledgers.get('user:event-1').items[hash(token(0).token)].state, 'unknown');
});

test('Firestore adapter enforces event/user leases, stale-worker fencing and rotated-token protection', async () => {
    const Module = require('node:module');
    const originalLoad = Module._load;
    const records = new Map();
    const document = path => ({ path });
    const firestore = () => database;
    firestore.Timestamp = { fromMillis: value => ({ milliseconds: value }) };
    firestore.FieldPath = { documentId: () => '__name__' };
    const database = {
        collection: path => ({ doc: id => ({ ...document(`${path}/${id}`),
            collection: child => ({ doc: childId => document(`${path}/${id}/${child}/${childId}`) }) }) }),
        async runTransaction(callback) {
            return callback({
                get: async ref => ({ exists: records.has(ref.path), data: () => structuredClone(records.get(ref.path)) }),
                set: (ref, value) => records.set(ref.path, structuredClone(value)),
                delete: ref => records.delete(ref.path),
            });
        },
    };
    let store;
    try {
        Module._load = function (name, ...args) {
            if (name === 'firebase-admin') return { apps: [{}], firestore };
            if (name === 'firebase-functions/v2/scheduler') return { onSchedule: (_options, callback) => callback };
            if (name === 'firebase-functions/v2/firestore') return {
                onDocumentUpdated: (_options, callback) => callback, onDocumentWritten: (_options, callback) => callback,
            };
            return originalLoad.call(this, name, ...args);
        };
        store = require('../lib/notificationFunctions').deliveryStore;
    } finally { Module._load = originalLoad; }
    const now = Date.now();
    const message = notice({ expiresAt: now + 60 * MINUTE });
    const first = await store.claim('user', message, 'worker-1', now);
    assert.ok(first);
    assert.equal(await store.claim('user', message, 'worker-2', now), null);
    assert.ok(await store.claim('other-user', message, 'worker-2', now));
    const replacement = await store.claim('user', message, 'worker-3', now + 11 * MINUTE);
    await assert.rejects(store.save('user', first), /lease lost/);
    replacement.state = 'done';
    replacement.leaseUntil = 0;
    await store.save('user', replacement);
    assert.equal(await store.claim('user', message, 'worker-4', now + 12 * MINUTE), null);
    const persisted = records.get(`users/user/notificationDeliveries/${hash(message.eventKey)}`);
    assert.equal(persisted.retryAt, null);
    assert.equal(persisted.receiptAt, null);
    const path = 'users/user/pushDevices/device';
    records.set(path, token(1));
    await store.removeToken('user', 'device', hash(token(0).token));
    assert.equal(records.has(path), true);
    await store.removeToken('user', 'device', hash(token(1).token));
    assert.equal(records.has(path), false);
});