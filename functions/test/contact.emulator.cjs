const { test } = require('node:test');
const assert = require('node:assert/strict');
const admin = require('firebase-admin');
const { submitContact } = require('../lib/contact');

test('authenticated callable persists one private message and prevents concurrent duplicates or spam', {
    skip: !process.env.FIRESTORE_EMULATOR_HOST,
}, async () => {
    const app = admin.initializeApp({ projectId: 'demo-trobar-reviews' });
    const db = app.firestore();
    const uid = `contact-emulator-${Date.now()}`;
    const firstId = '12345678-4321-4321-4321-123456789abc';
    const nextId = '87654321-4321-4321-4321-123456789abc';
    const auth = { uid, token: { email: 'contact-test@example.test', firebase: { sign_in_provider: 'password' } } };
    const data = {
        requestId: firstId, kind: 'improvement', subject: 'Prova local del formulari',
        message: 'Proposta de prova desada exclusivament a l’emulador.',
        platform: 'web', appVersion: '1.0.0', consent: true,
        userId: 'spoofed', email: 'spoofed@example.test', status: 'closed',
    };
    const first = db.collection('contactMessages').doc(firstId);
    const next = db.collection('contactMessages').doc(nextId);
    const rate = db.collection('contactRateLimits').doc(uid);
    try {
        const [a, b] = await Promise.all([
            submitContact.run({ auth, data }), submitContact.run({ auth, data }),
        ]);
        assert.deepEqual(a, { id: firstId });
        assert.deepEqual(b, a);
        const saved = (await first.get()).data();
        assert.equal(saved.userId, uid);
        assert.equal(saved.email, auth.token.email);
        assert.equal(saved.status, 'new');
        assert(saved.createdAt.toDate() instanceof Date);
        await assert.rejects(submitContact.run({ auth, data: { ...data, requestId: nextId } }), error => error.code === 'resource-exhausted');
        assert.equal((await next.get()).exists, false);
        assert.equal(typeof (await rate.get()).data().lastSentAt, 'number');
    } finally {
        await Promise.all([first.delete(), next.delete(), rate.delete()]);
        await app.delete();
    }
});
