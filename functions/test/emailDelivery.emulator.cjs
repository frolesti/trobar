const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const admin = require('../node_modules/firebase-admin');

if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.GCLOUD_PROJECT !== 'demo-trobar-email') {
  throw new Error('This test requires the isolated demo-trobar-email Firestore and Auth emulators.');
}
process.env.EMAIL_DELIVERY_MODE = 'internal';
process.env.EMAIL_INTERNAL_RECIPIENTS = 'internal@example.test';
admin.initializeApp({ projectId: 'demo-trobar-email' });
const db = admin.firestore();
const { enqueueEmail, deliverEmailJob } = require('../lib/emailDelivery');
after(async () => { await admin.app().delete(); });

test('real Firestore deduplicates concurrent jobs and keeps the queue inaccessible to clients', async () => {
  const password = 'Emulator-only-email-test-8321!';
  await admin.auth().createUser({ uid: 'fixture-only', email: 'internal@example.test', emailVerified: true, password });
  const job = { uid: 'fixture-only', to: 'internal@example.test', kind: 'welcome', input: {}, nextAttemptAt: Date.now() };
  await Promise.all([enqueueEmail(db, 'emulator-welcome', job), enqueueEmail(db, 'emulator-welcome', job)]);
  const snapshot = await db.collection('emailJobs').get();
  assert.equal(snapshot.size, 1);
  const ref = snapshot.docs[0].ref;
  const url = `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/demo-trobar-email/databases/(default)/documents/emailJobs/${ref.id}`;
  assert.equal((await fetch(url)).status, 403);
  assert.equal((await fetch(url, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { state: { stringValue: 'pending' } } }),
  })).status, 403);
  const login = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator-only`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: job.to, password, returnSecureToken: true }),
  });
  assert.equal(login.status, 200);
  const { idToken } = await login.json();
  assert.ok(idToken);
  const headers = { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' };
  assert.equal((await fetch(url, { headers })).status, 403);
  assert.equal((await fetch(url, {
    method: 'PATCH', headers, body: JSON.stringify({ fields: { state: { stringValue: 'pending' } } }),
  })).status, 403);
  let calls = 0;
  const provider = async payload => {
    assert.deepEqual(payload.to, ['internal@example.test']);
    assert.ok(payload.template.id);
    calls++;
    return { data: { id: 'emulated-provider-message' }, error: null, headers: null };
  };
  await Promise.all([
    deliverEmailJob(db, {}, ref, 'unused-fixture-key', Date.now(), provider),
    deliverEmailJob(db, {}, ref, 'unused-fixture-key', Date.now(), provider),
  ]);
  assert.equal(calls, 1);
  const accepted = (await ref.get()).data();
  assert.equal(accepted.state, 'accepted');
  assert.equal(accepted.payload, undefined);
  assert.equal(accepted.to, undefined);
  assert.equal(accepted.input, undefined);
  assert.equal(accepted.nextAttemptAt, undefined);
  await enqueueEmail(db, 'emulator-expired', job);
  const pending = (await db.collection('emailJobs').where('state', '==', 'pending').get()).docs[0].ref;
  await pending.update({ expiresAt: Date.now() - 1 });
  await deliverEmailJob(db, {}, pending, 'unused-fixture-key', Date.now(), () => { throw new Error('External sending is forbidden'); });
  const expired = (await pending.get()).data();
  assert.equal(expired.state, 'failed');
  assert.equal(expired.nextAttemptAt, undefined);
  await ref.delete();
  await pending.delete();
  await admin.auth().deleteUser('fixture-only');
});
