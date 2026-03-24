import * as admin from "firebase-admin";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import Stripe from "stripe";

/* ── Stripe configuration ────────────────────────────────────────────────── */
const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

const STRIPE_PRICE_IDS: Record<string, string> = {
  monthly: process.env.STRIPE_PRICE_MONTHLY || "price_monthly_placeholder",
  quarterly: process.env.STRIPE_PRICE_QUARTERLY || "price_quarterly_placeholder",
  annual: process.env.STRIPE_PRICE_ANNUAL || "price_annual_placeholder",
};

function getStripe(secretKey: string): Stripe {
  return new Stripe(secretKey);
}

/* ═══════════════════════════════════════════════════════════════════════════
   troBar — Firebase Cloud Functions
   ═══════════════════════════════════════════════════════════════════════════
   registerBar: Registra un bar a Firestore i assigna el rol bar_owner.

   Flux de registre (web-app):
     Pas 1: Crea compte Firebase Auth (email/password) + verifica email
            → L'usuari existeix a Auth però NO té cap doc a Firestore ni rol.
            → Si abandona, no té accés a res (l'app comprova el doc 'users').
     Pas 2-4: Recull dades del bar
     Pas 5: Crida registerBar → Crea docs Firestore + assigna rol bar_owner
   ═══════════════════════════════════════════════════════════════════════════ */

admin.initializeApp();
const db = admin.firestore();

/* ═══════════════════════════════════════════════════════════════════════════
   registerBar
   ─────────────────────────────────────────────────────────────────────────
   L'usuari ja ha estat creat i verificat via Firebase Auth al client.
   Aquesta funció:
     1. Comprova que l'usuari està autenticat i verificat
     2. Assigna el custom claim { role: 'bar_owner' }
     3. Crea el document del bar a Firestore
     4. Crea el document del barOwner a Firestore
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

    const {
      businessName, address, city, postalCode, phone, website,
      nif, legalName,
      contactName, contactPhone,
      capacity, screens, openingHours, description,
      billing, acceptTerms,
    } = request.data;

    // Validació bàsica
    if (!businessName || !address || !city || !postalCode || !nif || !contactName) {
      throw new HttpsError("invalid-argument", "Falten camps obligatoris");
    }

    if (!acceptTerms) {
      throw new HttpsError("invalid-argument", "Has d'acceptar les condicions");
    }

    // Comprovar que l'usuari no tingui ja un bar registrat
    const existingOwner = await db.collection("barOwners").doc(uid).get();
    if (existingOwner.exists) {
      throw new HttpsError("already-exists", "Ja tens un bar registrat.");
    }

    // 1. Assignar custom claim de bar_owner
    await admin.auth().setCustomUserClaims(uid, { role: "bar_owner" });

    // 2. Crear document del bar
    const barRef = db.collection("bars").doc();
    const barId = barRef.id;

    await barRef.set({
      name: businessName,
      address,
      city,
      postalCode,
      phone: phone || null,
      website: website || null,
      nif,
      legalName: legalName || businessName,
      capacity: capacity ? Number(capacity) : null,
      screens: screens ? Number(screens) : null,
      openingHours: openingHours || null,
      description: description || null,
      ownerId: uid,
      ownerEmail: userEmail,
      billing: billing || "quarterly",
      status: "pending_review",
      premium: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 3. Crear document del barOwner
    await db.collection("barOwners").doc(uid).set({
      uid,
      email: userEmail,
      name: contactName,
      phone: contactPhone || null,
      barId,
      barName: businessName,
      role: "bar_owner",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`✅ Bar registrat: ${barId} (${businessName}) per ${userEmail}`);

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
    const { billingCycle, successUrl, cancelUrl } = request.data as {
      billingCycle: string;
      successUrl: string;
      cancelUrl: string;
    };

    if (!billingCycle || !STRIPE_PRICE_IDS[billingCycle]) {
      throw new HttpsError("invalid-argument", "Cicle de facturació invàlid.");
    }

    const stripe = getStripe(stripeSecretKey.value());

    // Obtenir o crear el Stripe customer
    const barOwnerSnap = await db.collection("barOwners").doc(uid).get();
    if (!barOwnerSnap.exists) {
      throw new HttpsError("not-found", "No s'ha trobat el compte de bar.");
    }

    const barOwnerData = barOwnerSnap.data()!;
    let customerId = barOwnerData.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: request.auth.token.email || undefined,
        metadata: { firebaseUid: uid, barId: barOwnerData.barId },
      });
      customerId = customer.id;
      await db.collection("barOwners").doc(uid).update({ stripeCustomerId: customerId });
    }

    // Crear la sessió de checkout
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: STRIPE_PRICE_IDS[billingCycle], quantity: 1 }],
      success_url: successUrl || "https://trobar-app.cat/dashboard?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: cancelUrl || "https://trobar-app.cat/dashboard",
      subscription_data: {
        metadata: { firebaseUid: uid, barId: barOwnerData.barId, billingCycle },
        trial_period_days: 14,
      },
      metadata: { firebaseUid: uid, barId: barOwnerData.barId },
    });

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
    const { newCycle } = request.data as { newCycle: string };

    if (!newCycle || !STRIPE_PRICE_IDS[newCycle]) {
      throw new HttpsError("invalid-argument", "Cicle de facturació invàlid.");
    }

    const stripe = getStripe(stripeSecretKey.value());

    // Obtenir dades del barOwner
    const barOwnerSnap = await db.collection("barOwners").doc(uid).get();
    if (!barOwnerSnap.exists) {
      throw new HttpsError("not-found", "No s'ha trobat el compte de bar.");
    }

    const barOwnerData = barOwnerSnap.data()!;
    const subscriptionId = barOwnerData.stripeSubscriptionId;

    if (!subscriptionId) {
      throw new HttpsError("failed-precondition", "No tens cap subscripció activa.");
    }

    // Obtenir subscripció actual
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    if (subscription.status !== "active" && subscription.status !== "trialing") {
      throw new HttpsError("failed-precondition", "La subscripció no està activa.");
    }

    // Actualitzar el preu de la subscripció
    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      items: [{
        id: subscription.items.data[0].id,
        price: STRIPE_PRICE_IDS[newCycle],
      }],
      proration_behavior: "create_prorations",
      metadata: { ...subscription.metadata, billingCycle: newCycle },
    });

    // Actualitzar Firestore
    await db.collection("barOwners").doc(uid).update({
      billingCycle: newCycle,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Actualitzar el bar
    if (barOwnerData.barId) {
      await db.collection("bars").doc(barOwnerData.barId).update({
        billing: newCycle,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    console.log(`✅ Cicle canviat a ${newCycle} per ${uid} (sub: ${subscriptionId})`);

    return {
      ok: true,
      newCycle,
      currentPeriodEnd: (updatedSubscription as any).current_period_end,
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
    const subscriptionId = barOwnerData.stripeSubscriptionId;
    const customerId = barOwnerData.stripeCustomerId;

    // Cancel·lar subscripció si existeix
    if (subscriptionId) {
      try {
        await stripe.subscriptions.cancel(subscriptionId);
        console.log(`✅ Subscripció ${subscriptionId} cancel·lada per ${uid}`);
      } catch (err) {
        console.error(`⚠️ Error cancel·lant subscripció ${subscriptionId}:`, err);
        // Continuar igualment per permetre eliminar el compte
      }
    }

    // Eliminar el customer de Stripe si existeix
    if (customerId) {
      try {
        await stripe.customers.del(customerId);
        console.log(`✅ Customer ${customerId} eliminat`);
      } catch (err) {
        console.error(`⚠️ Error eliminant customer ${customerId}:`, err);
      }
    }

    // Actualitzar barOwner
    await db.collection("barOwners").doc(uid).update({
      stripeSubscriptionId: admin.firestore.FieldValue.delete(),
      stripeCustomerId: admin.firestore.FieldValue.delete(),
      subscriptionStatus: "cancelled",
      cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
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
    const stripe = getStripe(stripeSecretKey.value());

    const barOwnerSnap = await db.collection("barOwners").doc(uid).get();
    if (!barOwnerSnap.exists) {
      return { active: false, billingCycle: null, trialEnd: null, currentPeriodEnd: null };
    }

    const barOwnerData = barOwnerSnap.data()!;
    const subscriptionId = barOwnerData.stripeSubscriptionId;

    if (!subscriptionId) {
      return {
        active: false,
        billingCycle: barOwnerData.billingCycle || null,
        trialEnd: null,
        currentPeriodEnd: null,
      };
    }

    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      return {
        active: subscription.status === "active" || subscription.status === "trialing",
        status: subscription.status,
        billingCycle: barOwnerData.billingCycle || "monthly",
        trialEnd: subscription.trial_end,
        currentPeriodEnd: (subscription as any).current_period_end,
        cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
      };
    } catch {
      return { active: false, billingCycle: null, trialEnd: null, currentPeriodEnd: null };
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
      console.error("⚠️ Webhook signature verification failed:", err);
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
          const billingCycle = sub.metadata?.billingCycle || "monthly";

          await db.collection("barOwners").doc(uid).update({
            stripeSubscriptionId: subscriptionId,
            stripeCustomerId: session.customer,
            subscriptionStatus: "active",
            billingCycle,
            subscribedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          if (barId) {
            await db.collection("bars").doc(barId).update({
              tier: "premium",
              billing: billingCycle,
              premium: true,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }

          console.log(`✅ Checkout completat per ${uid}, sub: ${subscriptionId}`);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const uid = subscription.metadata?.firebaseUid;
        const barId = subscription.metadata?.barId;

        if (uid) {
          await db.collection("barOwners").doc(uid).update({
            subscriptionStatus: subscription.status,
            billingCycle: subscription.metadata?.billingCycle || "monthly",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          if (barId) {
            const isPremium = subscription.status === "active" || subscription.status === "trialing";
            await db.collection("bars").doc(barId).update({
              tier: isPremium ? "premium" : "free",
              premium: isPremium,
              billing: subscription.metadata?.billingCycle || "monthly",
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const uid = subscription.metadata?.firebaseUid;
        const barId = subscription.metadata?.barId;

        if (uid) {
          await db.collection("barOwners").doc(uid).update({
            subscriptionStatus: "cancelled",
            cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          if (barId) {
            await db.collection("bars").doc(barId).update({
              tier: "free",
              premium: false,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          }

          console.log(`⚠️ Subscripció eliminada per ${uid}`);
        }
        break;
      }

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
            await ownerDoc.ref.update({
              subscriptionStatus: "payment_failed",
              lastPaymentError: admin.firestore.FieldValue.serverTimestamp(),
            });
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
