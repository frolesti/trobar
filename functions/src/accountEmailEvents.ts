import * as admin from "firebase-admin";
import * as functionsV1 from "firebase-functions/v1";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { createHash } from "node:crypto";
import { emailEnabledFor, enqueueEmail, queueWelcome } from "./emailDelivery";

const region = "europe-west1";
const options = { region, cors: true, maxInstances: 3 };

export const onBarWelcomeEmail = onDocumentCreated({ region, document: "barOwners/{uid}", retry: true }, async event => {
  if (!event.data) throw new Error("Missing bar owner event");
  const result = await queueWelcome(event.params.uid);
  console.info("[Email] Bar registration welcome", result.status);
});

async function verifiedUser(uid: string) {
  const user = await admin.auth().getUser(uid);
  if (!user.emailVerified || !user.email || user.disabled) {
    throw new HttpsError("failed-precondition", "Verifica el correu del compte abans de continuar.");
  }
  return user;
}

async function eligibleUser(uid: string) {
  try {
    const user = await admin.auth().getUser(uid);
    if (user.emailVerified && user.email && !user.disabled && emailEnabledFor(user.email)) return user;
    console.info("[Email] Account event suppressed by recipient policy");
    return null;
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "auth/user-not-found") {
      console.info("[Email] Account event suppressed because account no longer exists");
      return null;
    }
    throw error;
  }
}

export const onContactEmail = onDocumentCreated({ region, document: "contactMessages/{messageId}", retry: true }, async event => {
  const data = event.data?.data();
  if (!data) throw new Error("Missing contact event");
  const user = await eligibleUser(data.userId);
  if (!user) return;
  await enqueueEmail(admin.firestore(), `support-received:${event.params.messageId}`, {
    uid: user.uid, to: user.email!, kind: "support-received", sourceId: event.params.messageId,
    input: {}, nextAttemptAt: Date.now(),
  });
});

export const replyToContact = onCall(options, async request => {
  if (!request.auth || request.auth.token.role !== "admin") throw new HttpsError("permission-denied", "Cal ser administrador.");
  const { messageId, replyId, text } = request.data || {};
  const uuid = /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
  if (typeof messageId !== "string" || !uuid.test(messageId) || typeof replyId !== "string" || !uuid.test(replyId)
    || typeof text !== "string" || text.trim().length < 1 || text.length > 1800 || /[\u0000-\u001f\u007f]/u.test(text)) {
    throw new HttpsError("invalid-argument", "La resposta no és vàlida. Escriu fins a 1.800 caràcters en un sol paràgraf.");
  }
  const db = admin.firestore();
  const ref = db.collection("contactMessages").doc(messageId);
  const reply = ref.collection("replies").doc(replyId);
  await db.runTransaction(async transaction => {
    const [ticket, existing] = await Promise.all([transaction.get(ref), transaction.get(reply)]);
    if (!ticket.exists) throw new HttpsError("not-found", "No hem trobat la consulta.");
    if (existing.exists) {
      if (existing.data()?.text !== text.trim()) throw new HttpsError("already-exists", "La referència ja s'ha utilitzat.");
      return;
    }
    try {
      require("./emails/resend.cjs").createHostedMessage("support-reply", {
        displayName: "", reference: messageId, supportSubject: ticket.data()!.subject, replyText: text.trim(),
        logoUrl: "https://www.trobar.cat/assets/logos/logo-brand.png",
        allowedActionOrigins: ["https://www.trobar.cat"],
      });
    } catch (error) {
      if (typeof error === "object" && error !== null && "name" in error && error.name === "TypeError") {
        throw new HttpsError("invalid-argument", "La resposta és massa llarga per enviar-la per correu. Escurça-la.");
      }
      throw error;
    }
    transaction.set(reply, { text: text.trim(), approvedBy: request.auth!.uid, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    transaction.update(ref, { status: "answered" });
  });
  return { status: "saved" };
});

export const onSupportReplyEmail = onDocumentCreated({
  region, document: "contactMessages/{messageId}/replies/{replyId}", retry: true,
}, async event => {
  const data = event.data?.data();
  if (!data || typeof data.approvedBy !== "string") throw new Error("Missing support reply approval");
  const staff = await admin.auth().getUser(data.approvedBy);
  if (staff.disabled || staff.customClaims?.role !== "admin") throw new Error("Support reply author is not an administrator");
  const db = admin.firestore();
  const ticket = (await db.collection("contactMessages").doc(event.params.messageId).get()).data();
  if (!ticket) throw new Error("Support reply has no ticket");
  const user = await eligibleUser(ticket.userId);
  if (!user) return;
  await enqueueEmail(db, `support-reply:${event.params.messageId}:${event.params.replyId}`, {
    uid: user.uid, to: user.email!, kind: "support-reply", sourceId: event.params.messageId,
    revision: event.params.replyId, input: {}, nextAttemptAt: Date.now(),
  });
});

export const onAccountDeletedEmail = functionsV1.region(region).runWith({ failurePolicy: true }).auth.user().onDelete(async user => {
  const db = admin.firestore();
  if (user.emailVerified && user.email && emailEnabledFor(user.email)) {
    await enqueueEmail(db, `account-deleted:${user.uid}:${user.metadata.creationTime}`, {
      uid: user.uid, to: user.email, kind: "account-deleted", deletionConfirmed: true,
      input: { displayName: user.displayName || "" }, nextAttemptAt: Date.now(),
    });
  }
  await Promise.all([
    db.collection("accountSecurityState").doc(user.uid).delete(),
    db.collection("barEmailConsents").doc(user.uid).delete(),
  ]);
  const securityEvents = await db.collection("accountSecurityEvents").where("uid", "==", user.uid).select().get();
  for (let offset = 0; offset < securityEvents.docs.length; offset += 400) {
    const batch = db.batch();
    for (const event of securityEvents.docs.slice(offset, offset + 400)) batch.delete(event.ref);
    await batch.commit();
  }
});

export const recordAccountSecurity = onCall(options, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Inicia sessió.");
  const user = await verifiedUser(request.auth.uid);
  if (!emailEnabledFor(user.email!)) return { status: "suppressed" };
  const observed = {
    email: user.email!, providers: user.providerData.map(provider => provider.providerId).sort().join(","),
    sessionsSince: user.tokensValidAfterTime || "",
  };
  const revision = createHash("sha256").update(JSON.stringify(observed)).digest("hex");
  const db = admin.firestore();
  const ref = db.collection("accountSecurityState").doc(user.uid);
  await db.runTransaction(async transaction => {
    const previous = (await transaction.get(ref)).data();
    if (previous?.revision === revision) return;
    const sequence = previous?.sequence === undefined ? 1 : previous.sequence + 1;
    if (!Number.isSafeInteger(sequence) || sequence < 1) throw new Error("Invalid account security sequence");
    transaction.set(ref, { ...observed, revision, sequence });
    if (!previous) return; // First observation establishes a baseline, not a security incident.
    const changes = [
      previous.email !== observed.email ? "Correu del compte actualitzat" : "",
      previous.providers !== observed.providers ? "Mètodes d'accés actualitzats" : "",
      previous.sessionsSince !== observed.sessionsSince ? "Credencials o sessions del compte renovades" : "",
    ].filter(Boolean);
    if (!changes.length) return;
    transaction.set(db.collection("accountSecurityEvents").doc(`${user.uid}_${sequence}_${revision}`), {
      uid: user.uid, to: user.email, securityChange: changes.join(". "), createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
  return { status: "recorded" };
});

export const onAccountSecurityEmail = onDocumentCreated({
  region, document: "accountSecurityEvents/{eventId}", retry: true,
}, async event => {
  const data = event.data?.data();
  if (!data) throw new Error("Missing security event");
  await enqueueEmail(admin.firestore(), `security-alert:${event.params.eventId}`, {
    uid: data.uid, to: data.to, kind: "security-alert", sourceId: event.params.eventId, input: {}, nextAttemptAt: Date.now(),
  });
});

export const getBarEmailTips = onCall(options, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Inicia sessió.");
  const saved = (await admin.firestore().collection("barEmailConsents").doc(request.auth.uid).get()).data();
  return { enabled: saved?.enabled === true };
});

export const setBarEmailTips = onCall(options, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Inicia sessió.");
  if (typeof request.data?.enabled !== "boolean") throw new HttpsError("invalid-argument", "La preferència no és vàlida.");
  const user = await verifiedUser(request.auth.uid);
  const enabled = request.data.enabled;
  const db = admin.firestore();
  const ref = db.collection("barEmailConsents").doc(user.uid);
  let barId: string | undefined;
  let consentedAt = Date.now();
  await db.runTransaction(async transaction => {
    const [owner, consent] = await Promise.all([
      transaction.get(db.collection("barOwners").doc(user.uid)), transaction.get(ref),
    ]);
    barId = owner.data()?.barId;
    if (enabled && !barId) throw new HttpsError("failed-precondition", "Primer registra el teu bar.");
    const previousDate = consent.data()?.consentedAt;
    if (typeof previousDate === "number") consentedAt = previousDate;
    transaction.set(ref, { enabled, barId: barId || null, consentedAt: enabled || typeof previousDate === "number" ? consentedAt : null,
      version: "one-tip-after-24h-v1", updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  });
  if (enabled && barId) {
    await enqueueEmail(db, `bar-onboarding:${barId}`, {
      uid: user.uid, to: user.email!, kind: "bar-onboarding", sourceId: barId, input: {},
      nextAttemptAt: consentedAt + 86400000,
    });
  }
  return { enabled };
});
