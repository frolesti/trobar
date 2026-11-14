'use strict';

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
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
const delivery = require('../lib/emailDelivery');
const events = require('../lib/accountEmailEvents');
const { submitContact } = require('../lib/contact');

async function main() {
  const key = execFileSync(process.env.ComSpec, ['/d', '/s', '/c',
    'gcloud.cmd secrets versions access latest --secret=RESEND_API_KEY --project=trobar-1123f'],
  { windowsVerbatimArguments: true, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const db = admin.firestore();
  const uid = `internal-extra-${Date.now()}`;
  const staffId = `${uid}-staff`;
  const messageId = randomUUID();
  const replyId = randomUUID();
  const now = Date.now();
  const subscription = {
    id: `sub_extra_${uid}`, customer: `cus_extra_${uid}`, status: 'active', livemode: false,
    metadata: { firebaseUid: uid, barId: uid }, trial_end: null, cancel_at: null, cancel_at_period_end: false,
    items: { data: [{ id: 'si_extra_fixture', quantity: 1, current_period_end: Math.floor(now / 1000) + 30 * 86400,
      price: { id: 'price_extra_monthly', recurring: { interval: 'month', interval_count: 1 } } }] },
  };
  const invoice = {
    id: `in_extra_${uid}`, customer: subscription.customer, currency: 'eur', number: 'PROVA-EXTRA-001',
    amount_due: 3900, amount_paid: 0, status: 'open', livemode: false,
    hosted_invoice_url: 'https://invoice.stripe.com/i/internal-preview-not-a-real-invoice',
    parent: { subscription_details: { subscription: subscription.id } },
    lines: { data: [{ parent: { subscription_item_details: { subscription: subscription.id } },
      period: { start: Math.floor(now / 1000), end: subscription.items.data[0].current_period_end } }], has_more: false },
  };
  const refund = { id: `re_extra_${uid}`, payment_intent: `pi_extra_${uid}`, amount: 1500, currency: 'eur', status: 'succeeded' };
  const stripe = {
    subscriptions: { retrieve: async () => subscription },
    invoices: { createPreview: async () => ({ amount_due: 3900, currency: 'eur' }), retrieve: async () => invoice },
    invoicePayments: { list: async () => ({ data: [{ invoice: invoice.id, payment: { payment_intent: refund.payment_intent } }], has_more: false }) },
    paymentIntents: { retrieve: async () => ({ status: 'requires_action' }) },
    refunds: { retrieve: async () => refund },
  };
  const event = (type, object, previous_attributes) => ({
    id: `evt_extra_${uid}_${type}`, type, livemode: false, created: Math.floor(Date.now() / 1000), data: { object, previous_attributes },
  });
  let lastSend = 0;
  const client = new Resend(key);
  const sender = async (payload, options) => {
    assert.deepEqual(payload.to, [email]);
    assert.equal(payload.template.variables.SUBJECT_PREFIX, '[PROVA INTERNA] ');
    await new Promise(resolve => setTimeout(resolve, Math.max(0, 650 - (Date.now() - lastSend))));
    lastSend = Date.now();
    return client.emails.send(payload, options);
  };
  const results = [];
  async function deliver(kind) {
    const jobs = await db.collection('emailJobs').where('uid', '==', uid).get();
    const matches = jobs.docs.filter(doc => doc.data().kind === kind);
    assert.equal(matches.length, 1, `${kind} must be deduplicated`);
    const ref = matches[0].ref;
    await delivery.deliverEmailJob(db, stripe, ref, key, matches[0].data().nextAttemptAt, sender);
    const accepted = (await ref.get()).data();
    assert.equal(accepted.state, 'accepted', kind);
    assert.equal(accepted.to, undefined);
    assert.equal(accepted.payload, undefined);
    assert.equal(accepted.input, undefined);
    results.push({ kind, providerId: accepted.providerId });
    console.log(JSON.stringify(results.at(-1)));
  }
  try {
    await admin.auth().createUser({ uid, email, emailVerified: true, displayName: 'Prova interna' });
    await admin.auth().createUser({ uid: staffId, email: `${staffId}@example.invalid`, emailVerified: true });
    await admin.auth().setCustomUserClaims(staffId, { role: 'admin' });
    await db.collection('barOwners').doc(uid).set({ barId: uid, stripeCustomerId: subscription.customer, stripeSubscriptionId: subscription.id });
    await db.collection('bars').doc(uid).set({ ownerId: uid, name: 'Bar de prova interna', isActive: true, tier: 'premium' });
    subscription.cancel_at = subscription.items.data[0].current_period_end;
    const cancellation = event('customer.subscription.updated', subscription, { cancel_at: null });
    for (let attempt = 0; attempt < 2; attempt++) await delivery.planSubscriptionEmails(db, stripe, cancellation, subscription);
    await deliver('subscription-cancelled');
    subscription.cancel_at = null;
    const change = event('customer.subscription.updated', subscription, { items: { data: [{ price: { id: 'price_old_fixture' } }] } });
    for (let attempt = 0; attempt < 2; attempt++) await delivery.planSubscriptionEmails(db, stripe, change, subscription);
    await deliver('subscription-updated');
    await delivery.planSubscriptionEmails(db, stripe, event('invoice.payment_action_required', invoice), subscription);
    await deliver('payment-action-required');
    invoice.status = 'paid'; invoice.amount_paid = 3900;
    for (let attempt = 0; attempt < 2; attempt++) await delivery.planRefundEmail(db, stripe, event('refund.updated', refund));
    await deliver('refund-confirmed');
    subscription.status = 'canceled';
    await delivery.planSubscriptionEmails(db, stripe, event('customer.subscription.deleted', subscription), subscription);
    await deliver('subscription-ended');
    const auth = { uid, token: { email, email_verified: true, firebase: { sign_in_provider: 'password' } } };
    await submitContact.run({ auth, data: {
      requestId: messageId, kind: 'issue', subject: 'Consulta de prova interna',
      message: 'Aquest missatge només comprova el circuit de suport de la beta.',
      consent: true, platform: 'test', appVersion: 'internal',
    } });
    const ticket = await db.collection('contactMessages').doc(messageId).get();
    for (let attempt = 0; attempt < 2; attempt++) await events.onContactEmail.run({ params: { messageId }, data: ticket });
    await deliver('support-received');
    await events.replyToContact.run({ auth: { uid: staffId, token: { role: 'admin' } }, data: {
      messageId, replyId, text: 'Gràcies per avisar-nos. Hem rebut la consulta de prova i el circuit de resposta funciona.',
    } });
    const reply = await ticket.ref.collection('replies').doc(replyId).get();
    await events.onSupportReplyEmail.run({ params: { messageId, replyId }, data: reply });
    await deliver('support-reply');
    await events.recordAccountSecurity.run({ auth, data: {} });
    await new Promise(resolve => setTimeout(resolve, 1100));
    await admin.auth().revokeRefreshTokens(uid);
    await events.recordAccountSecurity.run({ auth, data: {} });
    const security = await db.collection('accountSecurityEvents').where('uid', '==', uid).get();
    assert.equal(security.size, 1);
    await events.onAccountSecurityEmail.run({ params: { eventId: security.docs[0].id }, data: security.docs[0] });
    await deliver('security-alert');
    await events.setBarEmailTips.run({ auth, data: { enabled: true } });
    await events.setBarEmailTips.run({ auth, data: { enabled: true } });
    await deliver('bar-onboarding');
    const deleted = await admin.auth().getUser(uid);
    await admin.auth().deleteUser(uid);
    await events.onAccountDeletedEmail.run(deleted, { eventId: 'synthetic-delete' });
    await deliver('account-deleted');
    assert.equal(results.length, 10);
    console.log('Ten internal lifecycle emails accepted. Stripe facts and the 24-hour clock are fixtures; no real charge or production account mutation.');
  } finally {
    for (const collection of ['emailJobs', 'accountSecurityEvents']) {
      const docs = await db.collection(collection).where('uid', '==', uid).get();
      for (const doc of docs.docs) await doc.ref.delete();
    }
    await db.collection('contactMessages').doc(messageId).collection('replies').doc(replyId).delete();
    await db.collection('contactMessages').doc(messageId).delete();
    for (const collection of ['bars', 'barOwners', 'contactRateLimits', 'barEmailConsents', 'accountSecurityState']) await db.collection(collection).doc(uid).delete();
    for (const id of [uid, staffId]) {
      try { await admin.auth().deleteUser(id); }
      catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
    }
    await admin.app().delete();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
