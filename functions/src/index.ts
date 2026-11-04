import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import Stripe from "stripe";
import { persistBarRegistration } from "./barRegistration";
export { searchRegistrationLocations } from "./registrationLocations";

/* ── Stripe configuration ────────────────────────────────────────────────── */
const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

const STRIPE_PRICE_IDS: Record<string, string> = {
  monthly: process.env.STRIPE_PRICE_MONTHLY || "",
  quarterly: process.env.STRIPE_PRICE_QUARTERLY || "",
  annual: process.env.STRIPE_PRICE_ANNUAL || "",
};

function getStripe(secretKey: string): Stripe {
  return new Stripe(secretKey);
}

function configuredPrice(cycle: string): string {
  const price = STRIPE_PRICE_IDS[cycle];
  if (!price || !/^price_[A-Za-z0-9]+$/.test(price) || price.includes("placeholder")) {
    throw new HttpsError("failed-precondition", "La facturació encara no està configurada.");
  }

  return price;
}

async function validateStripePrice(stripe: Stripe, cycle: "monthly" | "quarterly" | "annual"): Promise<string> {
  const id = configuredPrice(cycle);
  const price = await stripe.prices.retrieve(id);
  const [amount, count] = { monthly: [3900, 1], quarterly: [9900, 3], annual: [34800, 1] }[cycle];
  if (!price.active || price.currency !== "eur" || price.unit_amount !== amount
    || price.recurring?.interval !== (cycle === "annual" ? "year" : "month")
    || price.recurring.interval_count !== count
    || (price.livemode && process.env.STRIPE_ALLOW_LIVE_BILLING !== "true")) {
    throw new HttpsError("failed-precondition", "El preu Stripe no coincideix amb el pla publicat o el mode autoritzat.");
  }
  return id;
}

function checkoutReturnUrl(value: unknown, outcome: string): string {
  if (value === undefined || value === "") return `https://www.trobar.cat/registra-bar?checkout=${outcome}`;
  if (typeof value !== "string") throw new HttpsError("invalid-argument", "URL de retorn invàlid.");
  try {
    const url = new URL(value);
    const origins = ["https://www.trobar.cat", "https://trobar.cat",
      ...(process.env.STRIPE_ALLOWED_RETURN_ORIGINS || "").split(",").map(origin => origin.trim()).filter(Boolean)];
    const local = process.env.FUNCTIONS_EMULATOR === "true"
      && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
    if (url.username || url.password || (!local && (url.protocol !== "https:" || !origins.includes(url.origin)))) {
      throw new Error("origin");
    }
    return url.toString();
  } catch {
    throw new HttpsError("invalid-argument", "El domini de retorn no està autoritzat.");
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   troBar — Firebase Cloud Functions
   ═══════════════════════════════════════════════════════════════════════════
   registerBar: Registra un bar a Firestore i assigna el rol bar_owner.

   Flux de registre (web-app):
     Pas 1: Crea compte Firebase Auth (email/password) + verifica email
            → L'usuari existeix a Auth però NO té cap doc a Firestore ni rol.
            → Pot reprendre el registre; l'app també admet informació bàsica d'Auth.
     Pas 2-4: Recull dades del bar
     Pas 5: Crida registerBar → Crea docs Firestore + assigna rol bar_owner
   ═══════════════════════════════════════════════════════════════════════════ */

admin.initializeApp();
const db = admin.firestore();

function isBillingCycle(value: unknown): value is "monthly" | "quarterly" | "annual" {
  return value === "monthly" || value === "quarterly" || value === "annual";
}

function subscriptionCycle(subscription: Stripe.Subscription) {
  const priceId = subscription.items.data[0]?.price.id;
  const cycle = Object.keys(STRIPE_PRICE_IDS).find(key => STRIPE_PRICE_IDS[key] === priceId);
  if (!isBillingCycle(cycle)) {
    throw new HttpsError("failed-precondition", "El preu de la subscripció no està configurat.");
  }
  return cycle;
}

function subscriptionPeriodEnd(subscription: Stripe.Subscription): number | null {
  return subscription.items.data[0]?.current_period_end ?? null;
}

async function assertBillableBar(owner: admin.firestore.DocumentData, uid: string): Promise<void> {
  if (typeof owner.barId !== "string" || !owner.barId) {
    throw new HttpsError("failed-precondition", "El compte no té cap bar vinculat.");
  }
  const bar = await db.collection("bars").doc(owner.barId).get();
  if (!bar.exists) throw new HttpsError("not-found", "No s'ha trobat el bar.");
  if (bar.data()?.ownerId !== uid) throw new HttpsError("permission-denied", "El bar no correspon al compte.");
  if (bar.data()?.isTestData === true) {
    throw new HttpsError("failed-precondition", "Els locals de prova no tenen facturació real.");
  }
}

function assertOwnedSubscription(subscription: Stripe.Subscription, owner: admin.firestore.DocumentData, uid: string): void {
  const customer = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  if (subscription.metadata.firebaseUid !== uid || subscription.metadata.barId !== owner.barId
    || (owner.stripeCustomerId && customer !== owner.stripeCustomerId)) {
    throw new HttpsError("failed-precondition", "La subscripció no correspon al compte de bar.");
  }
}

async function syncSubscriptionState(subscription: Stripe.Subscription, eventCreated: number, eventId?: string): Promise<void> {
  const uid = subscription.metadata.firebaseUid;
  const barId = subscription.metadata.barId;
  if (!uid || !barId) {
    console.info("[Billing] Ignoring subscription without troBar metadata", subscription.id);
    return;
  }
  const ownerRef = db.collection("barOwners").doc(uid);
  const barRef = db.collection("bars").doc(barId);
  await db.runTransaction(async transaction => {
    const receipt = eventId ? db.collection("stripeEvents").doc(eventId) : null;
    if (receipt && (await transaction.get(receipt)).exists) return;
    const owner = await transaction.get(ownerRef);
    const bar = await transaction.get(barRef);
    if (!owner.exists || !bar.exists || owner.data()?.barId !== barId || bar.data()?.ownerId !== uid) {
      throw new HttpsError("failed-precondition", "La subscripció no correspon al bar.");
    }
    if (bar.data()?.isTestData === true) {
      console.info("[Billing] Ignoring real billing event for test bar", barId);
      return;
    }
    const previous = owner.data()!;
    if ((previous.lastStripeEventCreated || 0) > eventCreated) return;
    if (previous.stripeSubscriptionId && previous.stripeSubscriptionId !== subscription.id
      && (previous.subscriptionStatus === "active" || previous.subscriptionStatus === "trialing")) {
      console.info("[Billing] Ignoring superseded subscription", subscription.id);
      return;
    }
    const cycle = subscriptionCycle(subscription);
    const active = subscription.status === "active" || subscription.status === "trialing";
    transaction.update(ownerRef, {
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
      subscriptionStatus: subscription.status,
      billingCycle: cycle,
      trialEnd: subscription.trial_end,
      currentPeriodEnd: subscriptionPeriodEnd(subscription),
      lastStripeEventCreated: eventCreated,
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.update(barRef, {
      tier: active ? "premium" : "free",
      premium: active,
      billing: cycle,
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (receipt) transaction.set(receipt, { created: eventCreated, processedAt: FieldValue.serverTimestamp() });
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   registerBar
   ─────────────────────────────────────────────────────────────────────────
   L'usuari ja ha estat creat i verificat via Firebase Auth al client.
   Aquesta funció:
     1. Comprova que l'usuari està autenticat i verificat
     2. Desa bar, barOwner i perfil users en una transacció idempotent
     3. Assigna el custom claim { role: 'bar_owner' }, reparable amb reintent
   ═══════════════════════════════════════════════════════════════════════════ */
export const registerBar = onCall(
  { region: "europe-west1", cors: true },
  async (request) => {
    // L'usuari HA d'estar autenticat (Firebase Auth)
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Has d'iniciar sessió per registrar un bar."
      );
    }

    const uid = request.auth.uid;
    const userEmail = request.auth.token.email;

    // Verificar que l'email està verificat
    if (!request.auth.token.email_verified) {
      throw new HttpsError(
        "failed-precondition",
        "L'email no ha estat verificat. Completa la verificació primer."
      );
    }

    if (typeof userEmail !== "string") throw new HttpsError("failed-precondition", "El compte necessita un email.");
    const barId = await persistBarRegistration(db, admin.auth(), uid, userEmail, request.data);

    return {
      ok: true,
      barId,
      message: "Compte de bar creat correctament",
    };
  }
);

/* ═══════════════════════════════════════════════════════════════════════════
   onNewReview — Notificació push al propietari quan algú deixa una ressenya
   ─────────────────────────────────────────────────────────────────────────
   Trigger: Firestore onCreate a bars/{barId}/reviews/{reviewId}
   ═══════════════════════════════════════════════════════════════════════════ */
export const onNewReview = onDocumentCreated(
  {
    document: "bars/{barId}/reviews/{reviewId}",
    region: "europe-west1",
  },
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const reviewData = snap.data();
    const barId = event.params.barId;

    // Obtenir el bar per saber qui és el propietari
    const barSnap = await db.collection("bars").doc(barId).get();
    if (!barSnap.exists) {
      console.log(`⚠️ Bar ${barId} no existeix, ignorem notificació.`);
      return;
    }

    const barData = barSnap.data()!;
    const ownerId = barData.ownerId;
    if (!ownerId) {
      console.log(`⚠️ Bar ${barId} no té ownerId, ignorem notificació.`);
      return;
    }

    // Obtenir tokens FCM del propietari
    const tokensSnap = await db
      .collection("users")
      .doc(ownerId)
      .collection("fcmTokens")
      .get();

    if (tokensSnap.empty) {
      console.log(`ℹ️ Propietari ${ownerId} no té tokens FCM registrats.`);
      return;
    }

    const tokens = tokensSnap.docs.map((d) => d.data().token).filter(Boolean);
    if (tokens.length === 0) return;

    // Construir la notificació
    const userName = reviewData.userName || "Un usuari";
    const rating = reviewData.rating || 0;
    const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
    const comment = reviewData.comment
      ? `: "${reviewData.comment.substring(0, 80)}${
          reviewData.comment.length > 80 ? "…" : ""
        }"`
      : "";

    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: {
        title: `Nova ressenya a ${barData.name || "el teu bar"}`,
        body: `${userName} ha valorat amb ${stars}${comment}`,
      },
      data: {
        type: "new_review",
        barId,
        reviewId: event.params.reviewId,
      },
      webpush: {
        fcmOptions: {
          link: `/bar-dashboard`,
        },
      },
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message);
      console.log(
        `✅ Notificació enviada: ${response.successCount} èxit, ${response.failureCount} errors`
      );

      // Netejar tokens invàlids
      const invalidTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (
          !resp.success &&
          resp.error?.code === "messaging/registration-token-not-registered"
        ) {
          invalidTokens.push(tokens[idx]);
        }
      });

      if (invalidTokens.length > 0) {
        const batch = db.batch();
        for (const doc of tokensSnap.docs) {
          if (invalidTokens.includes(doc.data().token)) {
            batch.delete(doc.ref);
          }
        }
        await batch.commit();
        console.log(`🧹 ${invalidTokens.length} tokens invàlids eliminats.`);
      }
    } catch (err) {
      console.error("❌ Error enviant notificació push:", err);
    }
  }
);

/* ═══════════════════════════════════════════════════════════════════════════
   createCheckoutSession — Crea una sessió de Stripe Checkout per subscriure's
   ═══════════════════════════════════════════════════════════════════════════ */
export const createCheckoutSession = onCall(
  { region: "europe-west1", cors: true, secrets: [stripeSecretKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Has d'iniciar sessió.");
    }

    const uid = request.auth.uid;
    const { billingCycle, successUrl, cancelUrl } = (request.data || {}) as {
      billingCycle: string;
      successUrl: string;
      cancelUrl: string;
    };

    if (!isBillingCycle(billingCycle)) {
      throw new HttpsError("invalid-argument", "Cicle de facturació invàlid.");
    }
    configuredPrice(billingCycle);
    const approvedSuccessUrl = checkoutReturnUrl(successUrl, "success");
    const approvedCancelUrl = checkoutReturnUrl(cancelUrl, "cancelled");
    if (!request.auth.token.email_verified) throw new HttpsError("failed-precondition", "Verifica el teu email primer.");

    // Obtenir o crear el Stripe customer
    const barOwnerSnap = await db.collection("barOwners").doc(uid).get();
    if (!barOwnerSnap.exists) {
      throw new HttpsError("not-found", "No s'ha trobat el compte de bar.");
    }

    const barOwnerData = barOwnerSnap.data()!;
    await assertBillableBar(barOwnerData, uid);
    const stripe = getStripe(stripeSecretKey.value());
    const priceId = await validateStripePrice(stripe, billingCycle);
    if (barOwnerData.stripeSubscriptionId) {
      const existing = await stripe.subscriptions.retrieve(barOwnerData.stripeSubscriptionId);
      assertOwnedSubscription(existing, barOwnerData, uid);
      if (existing.status !== "canceled" && existing.status !== "incomplete_expired") {
        throw new HttpsError("failed-precondition", "Ja tens una subscripció. Gestiona la periodicitat del pla actual.");
      }
    }
    let customerId = barOwnerData.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: request.auth.token.email || undefined,
        metadata: { firebaseUid: uid, barId: barOwnerData.barId },
      }, { idempotencyKey: `bar-customer-${uid}` });
      customerId = customer.id;
      await db.collection("barOwners").doc(uid).update({ stripeCustomerId: customerId });
    }

    const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 });
    if (subscriptions.data.some(sub => sub.metadata.firebaseUid === uid && sub.metadata.barId === barOwnerData.barId
      && sub.status !== "canceled" && sub.status !== "incomplete_expired")) {
      throw new HttpsError("failed-precondition", "Stripe ja té una subscripció per al bar. Espera la sincronització o contacta amb suport.");
    }

    // Concurrent requests share a persisted reservation and Stripe idempotency key.
    const ownerRef = db.collection("barOwners").doc(uid);
    const reservation = await db.runTransaction(async transaction => {
      const owner = (await transaction.get(ownerRef)).data()!;
      if (owner.checkoutExpiresAt > Math.floor(Date.now() / 1000)) {
        if (owner.checkoutBillingCycle !== billingCycle) {
          throw new HttpsError("failed-precondition", "Ja hi ha un Checkout pendent. Completa'l o espera una hora per canviar el pla.");
        }
        return owner;
      }
      const next = {
        checkoutAttempt: (owner.checkoutAttempt || 0) + 1,
        checkoutExpiresAt: Math.floor(Date.now() / 1000) + 3600,
        checkoutBillingCycle: billingCycle,
        checkoutSuccessUrl: approvedSuccessUrl,
        checkoutCancelUrl: approvedCancelUrl,
      };
      transaction.update(ownerRef, next);
      return next;
    });
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: reservation.checkoutSuccessUrl,
      cancel_url: reservation.checkoutCancelUrl,
      expires_at: reservation.checkoutExpiresAt,
      subscription_data: {
        metadata: { firebaseUid: uid, barId: barOwnerData.barId, billingCycle },
        trial_period_days: 14,
      },
      metadata: { firebaseUid: uid, barId: barOwnerData.barId },
    }, { idempotencyKey: `bar-checkout-${uid}-${reservation.checkoutAttempt}` });

    return { sessionId: session.id, url: session.url };
  }
);

/* ═══════════════════════════════════════════════════════════════════════════
   changeBillingCycle — Canvia el cicle de facturació d'una subscripció activa
   ═══════════════════════════════════════════════════════════════════════════ */
export const changeBillingCycle = onCall(
  { region: "europe-west1", cors: true, secrets: [stripeSecretKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Has d'iniciar sessió.");
    }

    const uid = request.auth.uid;
    const { newCycle } = (request.data || {}) as { newCycle: string };

    if (!isBillingCycle(newCycle)) {
      throw new HttpsError("invalid-argument", "Cicle de facturació invàlid.");
    }
    configuredPrice(newCycle);

    // Obtenir dades del barOwner
    const barOwnerSnap = await db.collection("barOwners").doc(uid).get();
    if (!barOwnerSnap.exists) {
      throw new HttpsError("not-found", "No s'ha trobat el compte de bar.");
    }

    const barOwnerData = barOwnerSnap.data()!;
    await assertBillableBar(barOwnerData, uid);
    const stripe = getStripe(stripeSecretKey.value());
    const priceId = await validateStripePrice(stripe, newCycle);
    const subscriptionId = barOwnerData.stripeSubscriptionId;

    if (!subscriptionId) {
      throw new HttpsError("failed-precondition", "No tens cap subscripció activa.");
    }

    // Obtenir subscripció actual
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    assertOwnedSubscription(subscription, barOwnerData, uid);
    if (subscription.status !== "active" && subscription.status !== "trialing") {
      throw new HttpsError("failed-precondition", "La subscripció no està activa.");
    }

    // Actualitzar el preu de la subscripció
    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      items: [{
        id: subscription.items.data[0].id,
        price: priceId,
      }],
      proration_behavior: "create_prorations",
      metadata: { ...subscription.metadata, billingCycle: newCycle },
    });

    // Actualitzar Firestore
    await db.collection("barOwners").doc(uid).update({
      billingCycle: newCycle,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Actualitzar el bar
    if (barOwnerData.barId) {
      await db.collection("bars").doc(barOwnerData.barId).update({
        billing: newCycle,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    console.log(`✅ Cicle canviat a ${newCycle} per ${uid} (sub: ${subscriptionId})`);

    return {
      ok: true,
      newCycle,
      currentPeriodEnd: subscriptionPeriodEnd(updatedSubscription),
    };
  }
);

/* ═══════════════════════════════════════════════════════════════════════════
   cancelSubscription — Cancel·la la subscripció de Stripe
   ═══════════════════════════════════════════════════════════════════════════ */
export const cancelSubscription = onCall(
  { region: "europe-west1", cors: true, secrets: [stripeSecretKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Has d'iniciar sessió.");
    }

    const uid = request.auth.uid;
    const stripe = getStripe(stripeSecretKey.value());

    // Obtenir barOwner
    const barOwnerSnap = await db.collection("barOwners").doc(uid).get();
    if (!barOwnerSnap.exists) {
      return { ok: true, message: "No hi ha subscripció per cancel·lar." };
    }

    const barOwnerData = barOwnerSnap.data()!;
    await assertBillableBar(barOwnerData, uid);
    const subscriptionId = barOwnerData.stripeSubscriptionId;
    const customerId = barOwnerData.stripeCustomerId;

    // Cancel·lar subscripció si existeix
    if (subscriptionId) {
      const current = await stripe.subscriptions.retrieve(subscriptionId);
      assertOwnedSubscription(current, barOwnerData, uid);
      if (current.status !== "canceled" && current.status !== "incomplete_expired") {
        await stripe.subscriptions.cancel(subscriptionId);
      }
    }

    await db.runTransaction(async transaction => {
      const ownerRef = db.collection("barOwners").doc(uid);
      const barRef = db.collection("bars").doc(barOwnerData.barId);
      const owner = await transaction.get(ownerRef);
      const bar = await transaction.get(barRef);
      if (owner.data()?.barId !== barRef.id || bar.data()?.ownerId !== uid) {
        throw new HttpsError("failed-precondition", "Cal revisar la vinculació del bar.");
      }
      transaction.update(ownerRef, {
        subscriptionStatus: "canceled", lastStripeEventCreated: Math.floor(Date.now() / 1000),
        cancelledAt: FieldValue.serverTimestamp(),
      });
      transaction.update(barRef, {
        tier: "free", premium: false, updatedAt: FieldValue.serverTimestamp(),
      });
    });

    // Eliminar el customer de Stripe si existeix
    if (customerId) {
      await stripe.customers.del(customerId);
    }

    // Actualitzar barOwner
    await db.collection("barOwners").doc(uid).update({
      stripeSubscriptionId: FieldValue.delete(),
      stripeCustomerId: FieldValue.delete(),
      subscriptionStatus: "canceled",
      cancelledAt: FieldValue.serverTimestamp(),
    });

    return { ok: true, message: "Subscripció cancel·lada correctament." };
  }
);

/* ═══════════════════════════════════════════════════════════════════════════
   getSubscriptionStatus — Retorna l'estat de la subscripció de l'usuari
   ═══════════════════════════════════════════════════════════════════════════ */
export const getSubscriptionStatus = onCall(
  { region: "europe-west1", cors: true, secrets: [stripeSecretKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Has d'iniciar sessió.");
    }

    const uid = request.auth.uid;
    const barOwnerSnap = await db.collection("barOwners").doc(uid).get();
    if (!barOwnerSnap.exists) {
      return { active: false, billingCycle: null, trialEnd: null, currentPeriodEnd: null };
    }

    const barOwnerData = barOwnerSnap.data()!;
    const subscriptionId = barOwnerData.stripeSubscriptionId;

    if (!subscriptionId) {
      return {
        active: false,
        billingCycle: isBillingCycle(barOwnerData.billingCycle) ? barOwnerData.billingCycle : null,
        trialEnd: null,
        currentPeriodEnd: null,
      };
    }

    await assertBillableBar(barOwnerData, uid);
    try {
      const stripe = getStripe(stripeSecretKey.value());
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      assertOwnedSubscription(subscription, barOwnerData, uid);
      return {
        active: subscription.status === "active" || subscription.status === "trialing",
        status: subscription.status,
        billingCycle: subscriptionCycle(subscription),
        trialEnd: subscription.trial_end,
        currentPeriodEnd: subscriptionPeriodEnd(subscription),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      };
    } catch (error) {
      console.error("[Billing] Cannot retrieve subscription");
      throw new HttpsError("unavailable", "No s'ha pogut comprovar la subscripció.");
    }
  }
);

/* ═══════════════════════════════════════════════════════════════════════════
   stripeWebhook — Webhook de Stripe per gestionar esdeveniments de pagament
   ═══════════════════════════════════════════════════════════════════════════ */
export const stripeWebhook = onRequest(
  { region: "europe-west1", secrets: [stripeSecretKey, stripeWebhookSecret] },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const stripe = getStripe(stripeSecretKey.value());
    const sig = req.headers["stripe-signature"] as string;

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        stripeWebhookSecret.value()
      );
    } catch (err) {
      console.error("⚠️ Webhook signature verification failed");
      res.status(400).send("Webhook signature verification failed");
      return;
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const uid = session.metadata?.firebaseUid;
        const barId = session.metadata?.barId;

        if (uid && session.subscription) {
          const subscriptionId = typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id;

          // Obtenir la subscripció per saber el cicle
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          await syncSubscriptionState(sub, event.created, event.id);

          console.log(`✅ Checkout completat per ${uid}, sub: ${subscriptionId}`);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const latest = await stripe.subscriptions.retrieve(subscription.id);
        await syncSubscriptionState(latest, event.created, event.id);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await syncSubscriptionState(subscription, event.created, event.id);
        break;
      }

      case "invoice.paid":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string"
          ? invoice.customer
          : invoice.customer?.id;

        if (customerId) {
          const ownerSnap = await db.collection("barOwners")
            .where("stripeCustomerId", "==", customerId)
            .limit(1)
            .get();

          if (!ownerSnap.empty) {
            const ownerDoc = ownerSnap.docs[0];
            const subscriptionId = ownerDoc.data().stripeSubscriptionId;
            if (subscriptionId) {
              const latest = await stripe.subscriptions.retrieve(subscriptionId);
              await syncSubscriptionState(latest, event.created, event.id);
            } else {
              console.info("[Billing] Failed invoice has no linked subscription", ownerDoc.id);
            }
            console.log(`⚠️ Pagament fallat per customer ${customerId}`);
          }
        }
        break;
      }

      default:
        console.log(`ℹ️ Webhook event no gestionat: ${event.type}`);
    }

    res.status(200).json({ received: true });
  }
);
