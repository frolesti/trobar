const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateContactData, storeContactMessage, submitContact, ensureContactApp } = require('../lib/contact');
const { initializeApp, getApps, deleteApp } = require('firebase-admin/app');

test('contact creates a default app even when Firebase Functions already owns a named admin app', async () => {
    const named = initializeApp({ projectId: 'demo-contact' }, 'metadata-only-contact-test');
    const before = getApps().find(app => app.name === '[DEFAULT]');
    const app = ensureContactApp();
    try {
        assert.equal(app.name, '[DEFAULT]');
        assert.equal(ensureContactApp(), app);
    } finally {
        await deleteApp(named);
        if (!before) await deleteApp(app);
    }
});

const requestId = '12345678-1234-1234-1234-123456789abc';
const input = (extra = {}) => ({
    requestId, kind: 'issue', subject: '  Una incidència  ', message: '  Aquest és un missatge de prova prou llarg.  ',
    consent: true, platform: 'web', appVersion: '1.0.0', ...extra,
});
const code = expected => error => error.code === expected;

function database() {
    const rows = new Map(), writes = [];
    return {
        rows, writes,
        collection: name => ({ doc: id => ({ id, path: `${name}/${id}` }) }),
        async runTransaction(callback) {
            const pending = [];
            const result = await callback({
                get: async ref => ({ exists: rows.has(ref.path), data: () => rows.get(ref.path) }),
                create: (ref, data) => pending.push([ref.path, data]),
                set: (ref, data) => pending.push([ref.path, data]),
            });
            pending.forEach(([path, data]) => { rows.set(path, data); writes.push(path); });
            return result;
        },
    };
}

test('contact validates consent, bounded strings, categories and safe idempotency keys', () => {
    const clean = validateContactData(input());
    assert.equal(clean.subject, 'Una incidència');
    assert.equal(clean.message, 'Aquest és un missatge de prova prou llarg.');
    for (const invalid of [null, {}, input({ consent: false }), input({ kind: 'admin' }), input({ requestId: '../private' }),
        input({ subject: ' ' }), input({ subject: 'x'.repeat(121) }), input({ message: 'short' }),
        input({ message: 'x'.repeat(5001) }), input({ platform: 'x'.repeat(25) })]) {
        assert.throws(() => validateContactData(invalid), code('invalid-argument'));
    }
});

test('contact requires a real signed-in account before accepting any message', async () => {
    await assert.rejects(submitContact.run({ data: input() }), code('unauthenticated'));
    await assert.rejects(submitContact.run({ auth: { uid: 'anon', token: { firebase: { sign_in_provider: 'anonymous' } } }, data: input() }), code('unauthenticated'));
});

test('contact stores the private inbox and throttle atomically and retries do not duplicate it', async () => {
    const db = database();
    const data = validateContactData(input());
    const saved = await storeContactMessage(db, 'uid', 'real@example.test', data, 100000);
    assert.equal(saved.id, requestId);
    const record = db.rows.get(`contactMessages/${requestId}`);
    assert.equal(record.userId, 'uid');
    assert.equal(record.email, 'real@example.test');
    assert.equal(record.status, 'new');
    assert.equal(record.consent, true);
    assert(record.createdAt);
    assert.equal(db.rows.get('contactRateLimits/uid').lastSentAt, 100000);
    await storeContactMessage(db, 'uid', 'real@example.test', data, 100001);
    assert.equal(db.writes.length, 2, 'retry returns the same receipt without another message');
    await assert.rejects(storeContactMessage(db, 'other', null, data, 100002), code('already-exists'));
    await assert.rejects(storeContactMessage(db, 'uid', null, { ...data, subject: 'Changed' }, 100002), code('already-exists'));
});

test('rate limit rejects a new message within one minute without a partial write', async () => {
    const db = database();
    const data = validateContactData(input());
    await storeContactMessage(db, 'uid', null, data, 100000);
    const next = { ...data, requestId: '87654321-1234-1234-1234-123456789abc' };
    await assert.rejects(storeContactMessage(db, 'uid', null, next, 159999), code('resource-exhausted'));
    assert.equal(db.writes.length, 2);
    await storeContactMessage(db, 'uid', null, next, 160000);
    assert.equal(db.writes.length, 4);
});
