'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const admin = require('../node_modules/firebase-admin');
const { Resend } = require('../node_modules/resend');

if (process.env.GCLOUD_PROJECT !== 'demo-trobar-email' || !process.env.FIRESTORE_EMULATOR_HOST
  || !process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.EMAIL_REAL_SEND_CONFIRM !== 'trobar-internal') {
  throw new Error('Requires isolated emulators and explicit authorization for internal real emails.');
}
const email = 'frolesti4@gmail.com';
process.env.EMAIL_DELIVERY_MODE = 'internal';
process.env.EMAIL_INTERNAL_RECIPIENTS = email;
process.env.EMAIL_PORTAL_READY = 'true';
admin.initializeApp({ projectId: 'demo-trobar-email' });
const { recordFirstLogin, planSubscriptionEmails, deliverEmailJob } = require('../lib/emailDelivery');

async function main() {
  const key = execFileSync(process.env.ComSpec, ['/d', '/s', '/c',
    'gcloud.cmd secrets versions access latest --secret=RESEND_API_KEY --project=trobar-1123f'],
  { windowsVerbatimArguments: true, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const client = new Resend(key);
  const db = admin.firestore();
  const uid = `internal-billing-${Date.now()}`;
  const barId = uid;
  const now = Date.now();
  const subscription = {
    id: 'sub_internal_fixture', customer: 'cus_internal_fixture', status: 'trialing', livemode: false,
    metadata: { firebaseUid: uid, barId }, trial_end: Math.floor(now / 1000) + 14 * 86400,
    cancel_at: null, cancel_at_period_end: false,
    items: { data: [{ id: 'si_internal_fixture', price: { recurring: { interval: 'month', interval_count: 1 } } }] },
  };
  let invoice;
  const stripe = {
    subscriptions: { retrieve: async () => subscription },
    invoices: { createPreview: async () => ({ amount_due: 3900, currency: 'eur' }), retrieve: async () => invoice },
  };
  const event = (type, object = {}) => ({ id: `evt_internal_${type}`, type, created: Math.floor(now / 1000), data: { object } });
  let lastSend = 0;
  const sender = async (payload, options) => {
    assert.deepEqual(payload.to, [email]);
    assert.equal(payload.template.variables.SUBJECT_PREFIX, '[PROVA INTERNA] ');
    await new Promise(resolve => setTimeout(resolve, Math.max(0, 600 - (Date.now() - lastSend))));
    lastSend = Date.now();
    return client.emails.send(payload, options);
  };
  const results = [];
  async function deliver(kind) {
    const jobs = await db.collection('emailJobs').where('uid', '==', uid).get();
    const matches = jobs.docs.filter(doc => doc.data().kind === kind);
    assert.equal(matches.length, 1, `${kind} must be deduplicated`);
    const ref = matches[0].ref;
    await deliverEmailJob(db, stripe, ref, key, matches[0].data().nextAttemptAt, sender);
    const accepted = (await ref.get()).data();
    assert.equal(accepted.state, 'accepted', kind);
    assert.equal(accepted.to, undefined);
    assert.equal(accepted.payload, undefined);
    assert.equal(accepted.input, undefined);
    results.push({ kind, providerId: accepted.providerId });
    console.log(JSON.stringify({ kind, providerId: accepted.providerId, state: accepted.state, destination: email }));
  }
  try {
    await admin.auth().createUser({ uid, email, emailVerified: true, displayName: 'Prova interna' });
    await db.collection('barOwners').doc(uid).set({ barId, stripeCustomerId: subscription.customer, stripeSubscriptionId: subscription.id });
    await db.collection('bars').doc(barId).set({ ownerId: uid, name: 'Bar de prova interna' });
    for (let attempt = 0; attempt < 2; attempt++) await recordFirstLogin.run({ auth: { uid }, data: {} });
    await deliver('welcome');
    for (let attempt = 0; attempt < 2; attempt++) {
      await planSubscriptionEmails(db, stripe, event('checkout.session.completed'), subscription, now);
    }
    for (const kind of ['bar-activated', 'trial-reminder-7', 'trial-reminder-1']) await deliver(kind);
    subscription.status = 'active';
    const baseInvoice = {
      customer: subscription.customer, currency: 'eur', number: 'PROVA-INTERNA-001', amount_due: 3900,
      parent: { subscription_details: { subscription: subscription.id } },
      lines: { data: [{ parent: { subscription_item_details: { subscription: subscription.id } },
        period: { start: Math.floor(now / 1000), end: Math.floor(now / 1000) + 30 * 86400 } }], has_more: false },
    };
    invoice = { ...baseInvoice, id: 'in_internal_paid_fixture', status: 'paid', amount_paid: 3900,
      hosted_invoice_url: 'https://invoice.stripe.com/i/internal-preview-not-a-real-invoice' };
    for (let attempt = 0; attempt < 2; attempt++) await planSubscriptionEmails(db, stripe, event('invoice.paid', invoice), subscription, now);
    await deliver('payment-received');
    invoice = { ...baseInvoice, id: 'in_internal_failed_fixture', status: 'open', amount_paid: 0 };
    for (let attempt = 0; attempt < 2; attempt++) await planSubscriptionEmails(db, stripe, event('invoice.payment_failed', invoice), subscription, now);
    await deliver('payment-failed');
    assert.equal(results.length, 6);
    console.log(JSON.stringify({ summary: 'Six internal lifecycle emails accepted; fixtures only, no production Auth/Firestore writes or charges.' }));
  } finally {
    const jobs = await db.collection('emailJobs').where('uid', '==', uid).get();
    for (const doc of jobs.docs) await doc.ref.delete();
    await db.collection('bars').doc(barId).delete();
    await db.collection('barOwners').doc(uid).delete();
    await admin.auth().deleteUser(uid);
    await admin.app().delete();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
