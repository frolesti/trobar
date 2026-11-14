'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const admin = require('../node_modules/firebase-admin');
const { Resend } = require('../node_modules/resend');

if (process.env.GCLOUD_PROJECT !== 'demo-trobar-email' || !process.env.FIRESTORE_EMULATOR_HOST
  || !process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.EMAIL_REAL_SEND_CONFIRM !== 'trobar-internal') {
  throw new Error('Requires isolated demo-trobar-email emulators and explicit internal real-send confirmation.');
}
const email = 'frolesti4@gmail.com';
process.env.EMAIL_DELIVERY_MODE = 'internal';
process.env.EMAIL_INTERNAL_RECIPIENTS = email;
admin.initializeApp({ projectId: 'demo-trobar-email' });
const { recordFirstLogin, deliverEmailJob } = require('../lib/emailDelivery');

async function main() {
  let key;
  try {
    key = execFileSync(process.env.ComSpec, ['/d', '/s', '/c',
      'gcloud.cmd secrets versions access latest --secret=RESEND_API_KEY --project=trobar-1123f'],
    { windowsVerbatimArguments: true, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    throw new Error('Could not securely read the restricted Resend key from trobar-1123f.');
  }
  const uid = `resend-internal-${Date.now()}`;
  const db = admin.firestore();
  let ref;
  try {
    await admin.auth().createUser({ uid, email, emailVerified: true });
    const request = { auth: { uid, token: { email, email_verified: true } }, data: {} };
    assert.equal((await recordFirstLogin.run(request)).status, 'queued');
    assert.equal((await recordFirstLogin.run(request)).status, 'queued');
    const jobs = await db.collection('emailJobs').where('uid', '==', uid).get();
    assert.equal(jobs.size, 1);
    ref = jobs.docs[0].ref;
    const client = new Resend(key);
    let providerId;
    const sender = async (payload, options) => {
      assert.deepEqual(payload.to, [email]);
      assert.equal(payload.template.variables.SUBJECT_PREFIX, '[PROVA INTERNA] ');
      const first = await client.emails.send(payload, options);
      if (first.error) throw new Error(`Real Resend test failed: ${first.error.name}/${first.error.statusCode}`);
      const second = await client.emails.send(payload, options);
      if (second.error) throw new Error(`Resend idempotency test failed: ${second.error.name}/${second.error.statusCode}`);
      assert.ok(first.data.id);
      assert.equal(second.data.id, first.data.id);
      providerId = first.data.id;
      return first;
    };
    await deliverEmailJob(db, {}, ref, key, Date.now(), sender);
    const accepted = (await ref.get()).data();
    assert.equal(accepted.state, 'accepted');
    assert.equal(accepted.to, undefined);
    assert.equal(accepted.payload, undefined);
    assert.equal(accepted.providerId, providerId);
    console.log(JSON.stringify({ kind: 'welcome', providerId, duplicateRequestSameId: true, queueContentRemoved: true }));
  } finally {
    key = undefined;
    if (ref) await ref.delete();
    await admin.auth().deleteUser(uid);
    await admin.app().delete();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
