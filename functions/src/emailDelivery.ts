import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { createHash } from "node:crypto";
import Stripe from "stripe";
import { Resend } from "resend";

export type Kind = "welcome" | "bar-activated" | "trial-reminder-7" | "trial-reminder-1" | "payment-received" | "payment-failed"
  | "payment-action-required" | "subscription-cancelled" | "subscription-ended" | "subscription-updated" | "refund-confirmed"
  | "support-received" | "support-reply" | "account-deleted" | "security-alert" | "bar-onboarding";
type Input = {
  displayName?: string; barName?: string; billingCycle?: string; trialEnd?: number;
  amount?: number; currency?: string; invoiceNumber?: string; invoiceUrl?: string;
  periodStart?: number; periodEnd?: number;
  reference?: string; supportSubject?: string; replyText?: string; securityChange?: string;
};
type Mail = { from: string; replyTo: string; template: { id: string; variables: Record<string, string> } };
type Sender = Resend["emails"]["send"];
type Job = {
  uid: string; to: string; kind: Kind; input: Input; subscriptionId?: string; invoiceId?: string; refundId?: string;
  sourceCreatedAt?: number;
  sourceId?: string; revision?: string; cancelAt?: number; deletionConfirmed?: boolean;
  state: string; nextAttemptAt: number; expiresAt: number; attempts: number; firstAttemptAt?: number; payload?: Mail;
};
const region = "europe-west1";
const stripeKey = defineSecret("STRIPE_SECRET_KEY");
const resendKey = defineSecret("RESEND_API_KEY");
const origin = "https://www.trobar.cat";

class DeliveryError extends Error {
  constructor(readonly code: string, readonly retryable: boolean, readonly retryAfter?: number) { super(code); }
}

function providerRetryAfter(value: string | undefined, now: number): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  const result = Number.isFinite(seconds) ? now + Math.max(0, seconds) * 1000 : Date.parse(value);
  return Number.isFinite(result) ? result : undefined;
}

function publicWelcomeEnabled(): boolean {
  return process.env.EMAIL_DELIVERY_MODE === "public" && process.env.EMAIL_PUBLIC_WELCOME_READY === "true";
}

function transactionalSince(): number | null {
  if (process.env.EMAIL_DELIVERY_MODE !== "transactional") return null;
  const since = Date.parse(process.env.EMAIL_TRANSACTIONAL_SINCE || "");
  return Number.isFinite(since) ? since : null;
}

export function passesDeliveryCutover(sourceCreatedAt: number | undefined): boolean {
  if (process.env.EMAIL_DELIVERY_MODE !== "transactional") return true;
  const since = transactionalSince();
  return since !== null && typeof sourceCreatedAt === "number" && Number.isFinite(sourceCreatedAt) && sourceCreatedAt >= since;
}

function billingDeliveryEnabled(): boolean {
  return process.env.EMAIL_DELIVERY_MODE === "internal" || transactionalSince() !== null;
}

export function emailEnabledFor(email: string, kind?: Kind): boolean {
  if (transactionalSince() !== null) return kind !== "bar-onboarding";
  if (publicWelcomeEnabled() && kind === "welcome") return true;
  if (process.env.EMAIL_DELIVERY_MODE !== "internal") return false;
  const allowed = (process.env.EMAIL_INTERNAL_RECIPIENTS || "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

function jobId(key: string): string {
  return createHash("sha256").update(`email-v1:${key}`).digest("hex");
}

export async function enqueueEmail(db: admin.firestore.Firestore, key: string, job: Omit<Job, "state" | "attempts" | "expiresAt">): Promise<void> {
  if (!emailEnabledFor(job.to, job.kind) || !passesDeliveryCutover(job.sourceCreatedAt)) {
    console.info("[Email] Recipient suppressed by delivery policy", job.kind);
    return;
  }
  const ref = db.collection("emailJobs").doc(jobId(key));
  await db.runTransaction(async transaction => {
    if ((await transaction.get(ref)).exists) return;
    transaction.set(ref, {
      ...job, state: "pending", attempts: 0, createdAt: FieldValue.serverTimestamp(),
      expiresAt: job.nextAttemptAt + (job.kind.startsWith("trial-reminder") ? 1 : 23) * 60 * 60 * 1000,
    });
  });
}

function id(value: string | { id: string } | null | undefined): string | undefined {
  return typeof value === "string" ? value : value?.id;
}

async function recipient(db: admin.firestore.Firestore, uid: string, subscription: Stripe.Subscription) {
  const account = await admin.auth().getUser(uid);
  if (!account.email || !account.emailVerified || account.disabled || !emailEnabledFor(account.email)) return null;
  const owner = (await db.collection("barOwners").doc(uid).get()).data();
  const barId = subscription.metadata.barId;
  if (!barId) throw new Error("Email subscription has no bar");
  const bar = (await db.collection("bars").doc(barId).get()).data();
  if (!owner || !bar) {
    console.info("[Email] Subscription suppressed because the bar registration was removed");
    return null;
  }
  if (owner.barId !== barId || owner.stripeCustomerId !== id(subscription.customer)
    || owner.stripeSubscriptionId !== subscription.id || subscription.metadata.firebaseUid !== uid) {
    throw new Error("Email subscription ownership mismatch");
  }
  if (bar.ownerId !== uid || bar.isTestData === true) return null;
  return { to: account.email, displayName: account.displayName || owner.name || "", barName: bar.name };
}

function isTrialAvailable(subscription: Stripe.Subscription, trialEnd: number, now: number): boolean {
  return subscription.status === "trialing" && subscription.trial_end === trialEnd && now < trialEnd * 1000
    && !subscription.cancel_at_period_end && !subscription.cancel_at && !subscription.pause_collection;
}

async function trialInput(stripe: Stripe, subscription: Stripe.Subscription): Promise<Input> {
  const preview = await stripe.invoices.createPreview({ customer: id(subscription.customer), subscription: subscription.id });
  const price = subscription.items.data[0]?.price;
  const interval = price?.recurring;
  const billingCycle = interval?.interval === "year" && interval.interval_count === 1 ? "annual"
    : interval?.interval === "month" && interval.interval_count === 3 ? "quarterly"
      : interval?.interval === "month" && interval.interval_count === 1 ? "monthly" : null;
  if (!billingCycle || preview.currency !== "eur" || !Number.isSafeInteger(preview.amount_due)) {
    throw new Error("Unsupported invoice preview");
  }
  return { amount: preview.amount_due, currency: preview.currency, billingCycle, trialEnd: subscription.trial_end! };
}

function endOfPeriod(subscription: Stripe.Subscription): number {
  const end = Math.max(0, ...subscription.items.data.map(item => item.current_period_end));
  if (!Number.isSafeInteger(end) || end <= 0) throw new Error("Missing subscription period end");
  return end;
}

function cancellationDate(subscription: Stripe.Subscription): number | undefined {
  return subscription.cancel_at || (subscription.cancel_at_period_end ? endOfPeriod(subscription) : undefined);
}

function planRevision(subscription: Pick<Stripe.Subscription, "items">): string {
  return JSON.stringify(subscription.items.data.map(item => [id(item.price), item.quantity ?? 1]).sort());
}

export async function planSubscriptionEmails(
  db: admin.firestore.Firestore, stripe: Stripe, event: Stripe.Event, subscription: Stripe.Subscription, now = Date.now(),
): Promise<void> {
  if (!billingDeliveryEnabled() || !passesDeliveryCutover(event.created * 1000)) return;
  if (process.env.EMAIL_PORTAL_READY !== "true") {
    console.info("[Email] Billing delivery waits for a verified cancellation portal");
    return;
  }
  if (subscription.livemode) {
    console.info("[Email] Live billing emails are not enabled");
    return;
  }
  if (now - event.created * 1000 > 23 * 60 * 60 * 1000) {
    console.info("[Email] Historical billing event is outside the delivery window");
    return;
  }
  const uid = subscription.metadata.firebaseUid;
  if (!uid) return;
  const person = await recipient(db, uid, subscription);
  if (!person) { console.info("[Email] Subscription recipient is not eligible for internal delivery"); return; }
  const basic = { uid, to: person.to, subscriptionId: subscription.id, sourceCreatedAt: event.created * 1000 };
  if (event.type === "customer.subscription.updated") {
    const previous = event.data.previous_attributes;
    const changed = event.data.object;
    const cancelAt = cancellationDate(subscription);
    if (previous && ("cancel_at" in previous || "cancel_at_period_end" in previous)
      && cancelAt && cancelAt > now / 1000 && cancellationDate(changed) === cancelAt) {
      await enqueueEmail(db, `subscription-cancelled:${event.id}`, {
        ...basic, kind: "subscription-cancelled", input: person, cancelAt, nextAttemptAt: now,
      });
    }
    if (previous?.items && planRevision({ items: previous.items }) !== planRevision(changed)
      && planRevision(changed) === planRevision(subscription) && ["active", "trialing"].includes(subscription.status)) {
      await enqueueEmail(db, `subscription-updated:${event.id}`, {
        ...basic, kind: "subscription-updated", input: person, revision: planRevision(subscription), nextAttemptAt: now,
      });
    }
  }
  if (event.type === "customer.subscription.deleted" && subscription.status === "canceled") {
    await enqueueEmail(db, `subscription-ended:${subscription.id}`, {
      ...basic, kind: "subscription-ended", input: person, nextAttemptAt: now,
    });
  }
  if (["checkout.session.completed", "customer.subscription.created", "customer.subscription.updated"].includes(event.type)
    && subscription.trial_end && isTrialAvailable(subscription, subscription.trial_end, now)) {
    // Updates reschedule reminders; only creation/Checkout can send the activation message.
    const input = { ...person, ...await trialInput(stripe, subscription) };
    if (event.type !== "customer.subscription.updated" && now - event.created * 1000 < 60 * 60 * 1000) {
      await enqueueEmail(db, `bar-activated:${subscription.id}`, { ...basic, kind: "bar-activated", input, nextAttemptAt: now });
    }
    for (const [kind, days] of [["trial-reminder-7", 7], ["trial-reminder-1", 1]] as const) {
      const due = subscription.trial_end * 1000 - days * 86400000;
      if (due > now) {
        await enqueueEmail(db, `${kind}:${subscription.id}:${subscription.trial_end}`, {
          ...basic, kind, input, nextAttemptAt: due,
        });
      }
    }
  }
  if (event.type === "invoice.paid" || event.type === "invoice.payment_failed" || event.type === "invoice.payment_action_required") {
    const invoice = event.data.object as Stripe.Invoice;
    if (id(invoice.parent?.subscription_details?.subscription) !== subscription.id || id(invoice.customer) !== id(subscription.customer)) {
      console.info("[Email] Invoice is not linked to the current subscription");
      return;
    }
    if (event.type === "invoice.paid" && (invoice.status !== "paid" || invoice.amount_paid <= 0)) return;
    await enqueueEmail(db, `${event.type}:${invoice.id}`, {
      ...basic, invoiceId: invoice.id, kind: event.type === "invoice.paid" ? "payment-received"
        : event.type === "invoice.payment_action_required" ? "payment-action-required" : "payment-failed",
      input: person, nextAttemptAt: now,
    });
  }
}

export async function planRefundEmail(db: admin.firestore.Firestore, stripe: Stripe, event: Stripe.Event, now = Date.now()): Promise<void> {
  if (process.env.EMAIL_PORTAL_READY !== "true" || !billingDeliveryEnabled() || !passesDeliveryCutover(event.created * 1000)
    || now - event.created * 1000 > 23 * 60 * 60 * 1000) return;
  if (event.type !== "refund.created" && event.type !== "refund.updated") return;
  const refund = event.data.object;
  if (event.livemode || refund.status !== "succeeded" || refund.amount <= 0) return;
  const paymentIntent = id(refund.payment_intent);
  if (!paymentIntent) throw new Error("Refund has no payment intent");
  const payments = await stripe.invoicePayments.list({ payment: { type: "payment_intent", payment_intent: paymentIntent }, limit: 2 });
  if (payments.data.length !== 1 || payments.has_more) {
    console.info("[Email] Refund is not associated with one subscription invoice");
    return;
  }
  const invoice = await stripe.invoices.retrieve(id(payments.data[0].invoice)!);
  const subscriptionId = id(invoice.parent?.subscription_details?.subscription);
  if (!subscriptionId) return;
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const uid = subscription.metadata.firebaseUid;
  if (!uid || subscription.livemode || id(invoice.customer) !== id(subscription.customer)) return;
  const person = await recipient(db, uid, subscription);
  if (!person) return;
  await enqueueEmail(db, `refund-confirmed:${refund.id}`, {
    uid, to: person.to, kind: "refund-confirmed", input: person, subscriptionId, invoiceId: invoice.id,
    refundId: refund.id, sourceCreatedAt: event.created * 1000, nextAttemptAt: now,
  });
}

export async function queueWelcome(uid: string): Promise<{ status: "unverified" | "suppressed" | "not-new" | "queued" }> {
  const account = await admin.auth().getUser(uid);
  if (!account.emailVerified || !account.email || account.disabled) return { status: "unverified" };
  if (!emailEnabledFor(account.email, "welcome")) return { status: "suppressed" };
  const created = Date.parse(account.metadata.creationTime);
  if (!Number.isFinite(created) || !passesDeliveryCutover(created) || Date.now() - created > 7 * 86400000) return { status: "not-new" };
  await enqueueEmail(admin.firestore(), `welcome:${account.uid}`, {
    uid: account.uid, to: account.email, kind: "welcome",
    input: { displayName: account.displayName || "" }, sourceCreatedAt: created, nextAttemptAt: Date.now(),
  });
  return { status: "queued" };
}

export const recordFirstLogin = onCall({ region, cors: true }, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Has d'iniciar sessió.");
  return queueWelcome(request.auth.uid);
});

async function currentInput(db: admin.firestore.Firestore, stripe: Stripe, job: Job, now: number): Promise<Input | null> {
  if (job.kind === "account-deleted") {
    if (!job.deletionConfirmed || !emailEnabledFor(job.to)) return null;
    try {
      await admin.auth().getUser(job.uid);
      return null;
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "auth/user-not-found") return job.input;
      throw error;
    }
  }
  let account: admin.auth.UserRecord;
  try {
    account = await admin.auth().getUser(job.uid);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "auth/user-not-found") return null;
    throw error;
  }
  if (!account.email || account.email.toLowerCase() !== job.to.toLowerCase() || !account.emailVerified || account.disabled || !emailEnabledFor(job.to, job.kind)) return null;
  if (job.kind === "welcome") return job.input;
  if (job.kind === "support-received" || job.kind === "support-reply") {
    if (!job.sourceId) throw new Error("Support email has no reference");
    const ticket = (await db.collection("contactMessages").doc(job.sourceId).get()).data();
    if (!ticket || ticket.userId !== job.uid) return null;
    const input = { displayName: account.displayName || "", reference: job.sourceId, supportSubject: ticket.subject };
    if (job.kind === "support-received") return input;
    if (!job.revision) throw new Error("Support email has no reply");
    const reply = (await db.collection("contactMessages").doc(`${job.sourceId}/replies/${job.revision}`).get()).data();
    if (!reply || typeof reply.approvedBy !== "string") return null;
    const staff = await admin.auth().getUser(reply.approvedBy);
    if (staff.disabled || staff.customClaims?.role !== "admin") return null;
    return { ...input, replyText: reply.text };
  }
  if (job.kind === "security-alert") {
    if (!job.sourceId) throw new Error("Security email has no event");
    const event = (await db.collection("accountSecurityEvents").doc(job.sourceId).get()).data();
    return event?.uid === job.uid && event.to === job.to
      ? { displayName: account.displayName || "", securityChange: event.securityChange } : null;
  }
  if (job.kind === "bar-onboarding") {
    const consent = (await db.collection("barEmailConsents").doc(job.uid).get()).data();
    if (!consent?.enabled || consent.barId !== job.sourceId || now < consent.consentedAt + 86400000) return null;
    if (!job.sourceId) throw new Error("Profile tip has no bar");
    const bar = (await db.collection("bars").doc(job.sourceId).get()).data();
    if (!bar || bar.ownerId !== job.uid || bar.isTestData || !bar.isActive || bar.tier !== "premium") return null;
    if (typeof bar.description === "string" && bar.description.trim() && Array.isArray(bar.gallery) && bar.gallery.length
      && Array.isArray(bar.amenities) && bar.amenities.length) return null;
    return { displayName: account.displayName || "", barName: bar.name };
  }
  if (process.env.EMAIL_PORTAL_READY !== "true") return null;
  if (!job.subscriptionId) throw new Error("Email has no subscription");
  const subscription = await stripe.subscriptions.retrieve(job.subscriptionId);
  if (subscription.livemode) return null;
  const person = await recipient(db, job.uid, subscription);
  if (!person) return null;
  if (job.kind === "bar-activated" || job.kind.startsWith("trial-reminder")) {
    if (!job.input.trialEnd || !isTrialAvailable(subscription, job.input.trialEnd, now)) return null;
    if (job.kind.startsWith("trial-reminder") && now - job.nextAttemptAt > 60 * 60 * 1000 && !job.firstAttemptAt) return null;
    return { ...person, ...await trialInput(stripe, subscription) };
  }
  if (job.kind === "subscription-cancelled") {
    const end = cancellationDate(subscription);
    return end && end === job.cancelAt && end > now / 1000 ? { ...person, periodEnd: end } : null;
  }
  if (job.kind === "subscription-ended") return subscription.status === "canceled" ? person : null;
  if (job.kind === "subscription-updated") {
    if (planRevision(subscription) !== job.revision || !["active", "trialing"].includes(subscription.status)) return null;
    return { ...person, ...await trialInput(stripe, subscription), periodEnd: endOfPeriod(subscription) };
  }
  if (!job.invoiceId) throw new Error("Email has no invoice");
  const invoice = await stripe.invoices.retrieve(job.invoiceId);
  if (id(invoice.parent?.subscription_details?.subscription) !== subscription.id || id(invoice.customer) !== id(subscription.customer)) {
    throw new Error("Email invoice ownership mismatch");
  }
  if (job.kind === "payment-received" && (invoice.status !== "paid" || invoice.amount_paid <= 0)) return null;
  if ((job.kind === "payment-failed" || job.kind === "payment-action-required") && invoice.status !== "open") return null;
  if (job.kind === "payment-action-required") {
    const payments = await stripe.invoicePayments.list({ invoice: invoice.id, limit: 10 });
    if (payments.has_more) throw new Error("Invoice payment list is incomplete");
    const intents = await Promise.all(payments.data.map(payment => id(payment.payment.payment_intent))
      .filter((value): value is string => !!value).map(value => stripe.paymentIntents.retrieve(value)));
    if (!intents.some(intent => intent.status === "requires_action")) return null;
  }
  if (job.kind === "refund-confirmed") {
    if (!job.refundId) throw new Error("Refund email has no refund");
    const refund = await stripe.refunds.retrieve(job.refundId);
    if (invoice.livemode || refund.status !== "succeeded" || refund.amount <= 0) return null;
    const paymentIntent = id(refund.payment_intent);
    if (!paymentIntent) throw new Error("Refund has no payment intent");
    const payments = await stripe.invoicePayments.list({ invoice: invoice.id, payment: { type: "payment_intent", payment_intent: paymentIntent }, limit: 2 });
    if (payments.data.length !== 1 || payments.has_more || !invoice.hosted_invoice_url) throw new Error("Refund invoice mismatch");
    return { ...person, amount: refund.amount, currency: refund.currency, invoiceUrl: invoice.hosted_invoice_url };
  }
  const lines = invoice.lines.data.filter(item => id(item.parent?.subscription_item_details?.subscription) === subscription.id);
  if (!lines.length || invoice.lines.has_more || !invoice.number
    || ((job.kind === "payment-received" || job.kind === "payment-action-required") && !invoice.hosted_invoice_url)) {
    throw new Error("Invoice receipt details are incomplete");
  }
  return {
    ...person, amount: job.kind === "payment-received" ? invoice.amount_paid : invoice.amount_due, currency: invoice.currency,
    invoiceNumber: invoice.number, invoiceUrl: invoice.hosted_invoice_url || undefined,
    periodStart: Math.min(...lines.map(line => line.period.start)), periodEnd: Math.max(...lines.map(line => line.period.end)),
  };
}

export async function deliverEmailJob(
  db: admin.firestore.Firestore, stripe: Stripe, ref: admin.firestore.DocumentReference, apiKey: string,
  now = Date.now(), sender?: Sender,
): Promise<void> {
  if (!billingDeliveryEnabled() && !publicWelcomeEnabled()) return;
  const job = await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.data() as Job | undefined;
    if (!data || !["pending", "processing"].includes(data.state) || data.nextAttemptAt > now) return null;
    if (!passesDeliveryCutover(data.sourceCreatedAt)) {
      transaction.update(ref, { state: "suppressed", nextAttemptAt: FieldValue.delete(), reason: "before-transactional-cutover",
        to: FieldValue.delete(), input: FieldValue.delete(), payload: FieldValue.delete() });
      console.info("[Email] Historical queued job suppressed", ref.id);
      return null;
    }
    if (data.expiresAt <= now || data.attempts >= 5 || (data.firstAttemptAt && now - data.firstAttemptAt >= 23 * 60 * 60 * 1000)) {
      transaction.update(ref, { state: "failed", nextAttemptAt: FieldValue.delete(), errorCode: "retry-window-exhausted",
        to: FieldValue.delete(), input: FieldValue.delete(), payload: FieldValue.delete() });
      console.error("[Email] Retry window exhausted", ref.id);
      return null;
    }
    transaction.update(ref, { state: "processing", attempts: data.attempts + 1, nextAttemptAt: now + 120000, firstAttemptAt: data.firstAttemptAt || now });
    return data;
  });
  if (!job) return;
  try {
    const input = await currentInput(db, stripe, job, now);
    if (!input) {
      await ref.update({ state: "suppressed", nextAttemptAt: FieldValue.delete(), reason: "no-longer-eligible",
        to: FieldValue.delete(), input: FieldValue.delete(), payload: FieldValue.delete() });
      console.info("[Email] Job suppressed after current-state check", ref.id);
      return;
    }
    if (!apiKey) throw new DeliveryError("missing-resend-configuration", false);
    if (job.payload && !job.payload.template) throw new DeliveryError("unsupported-cached-email-payload", false);
    const render: (kind: Kind, input: object, options: { internalTest: boolean; sandbox: boolean }) => Mail = require("./emails/resend.cjs").createHostedMessage;
    const payload = job.payload || render(job.kind, {
      ...input, logoUrl: `${origin}/assets/logos/logo-red.png`,
      allowedActionOrigins: [origin, "https://invoice.stripe.com"],
      appUrl: origin,
      manageUrl: job.kind === "payment-action-required" ? input.invoiceUrl : `${origin}/subscripcio`,
      profileUrl: `${origin}/consells-bar`, unsubscribeUrl: `${origin}/consells-bar`,
    }, { internalTest: process.env.EMAIL_DELIVERY_MODE === "internal", sandbox: !!job.subscriptionId });
    // A retry must reuse the exact payload inside Resend's 24-hour idempotency window.
    if (!job.payload) await ref.update({ payload });
    const client = new Resend(apiKey);
    const response = await (sender || client.emails.send.bind(client.emails))(
      { ...payload, to: [job.to] },
      { idempotencyKey: `trobar-${ref.id}`, signal: AbortSignal.timeout(15000) },
    );
    if (response.error) {
      const status = response.error.statusCode;
      throw new DeliveryError(
        `resend-${status || "network"}`, !status || status === 429 || status >= 500,
        providerRetryAfter(response.headers?.["retry-after"], now),
      );
    }
    const result = response.data;
    if (!result?.id || typeof result.id !== "string") throw new DeliveryError("resend-invalid-response", true);
    await ref.update({
      state: "accepted", providerId: result.id, acceptedAt: FieldValue.serverTimestamp(),
      nextAttemptAt: FieldValue.delete(), payload: FieldValue.delete(), input: FieldValue.delete(), to: FieldValue.delete(),
    });
    console.info("[Email] Provider accepted", ref.id, result.id);
  } catch (error) {
    const failure = error instanceof DeliveryError ? error : null;
    const next = Math.max(now + Math.min(20, 2 ** job.attempts) * 60000, failure?.retryAfter || 0);
    const retryable = (failure ? failure.retryable : !(error instanceof TypeError))
      && job.attempts + 1 < 5 && next < job.expiresAt;
    console.error("[Email] Delivery attempt failed", ref.id, failure?.code || "delivery-failed", retryable ? "retry" : "terminal");
    await ref.update({
      state: retryable ? "pending" : "failed", errorCode: failure?.code || "delivery-failed",
      nextAttemptAt: retryable ? next : FieldValue.delete(),
      ...(!retryable ? { to: FieldValue.delete(), input: FieldValue.delete(), payload: FieldValue.delete() } : {}),
    });
    throw error;
  }
}

export const processEmailQueue = onSchedule({
  region, schedule: "every 5 minutes", timeZone: "Etc/UTC", maxInstances: 1, concurrency: 1,
  timeoutSeconds: 120, retryCount: 0, secrets: [stripeKey, resendKey],
}, async () => {
  if (!billingDeliveryEnabled() && !publicWelcomeEnabled()) { console.info("[Email] Delivery is disabled"); return; }
  const db = admin.firestore();
  const stripe = new Stripe(stripeKey.value(), { timeout: 15000, maxNetworkRetries: 0 });
  const jobs = await db.collection("emailJobs").where("nextAttemptAt", "<=", Date.now()).limit(2).get();
  for (const job of jobs.docs) {
    try { await deliverEmailJob(db, stripe, job.ref, resendKey.value()); }
    catch (error) {
      console.error("[Email] Queue job failed", job.id, error instanceof Error ? error.name : "unknown");
    }
  }
});
