import * as admin from "firebase-admin";
import { getApps, initializeApp, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";

type ContactData = {
  requestId: string;
  kind: "issue" | "improvement" | "other";
  subject: string;
  message: string;
  platform: string;
  appVersion: string;
};

export function ensureContactApp(): App {
  return getApps().find(app => app.name === "[DEFAULT]") || initializeApp();
}

export function validateContactData(input: unknown): ContactData {
  if (!input || typeof input !== "object") {
    throw new HttpsError("invalid-argument", "El formulari no és vàlid.");
  }
  const data = input as Record<string, unknown>;
  const string = (key: string, min: number, max: number) => {
    const value = typeof data[key] === "string" ? data[key].trim() : "";
    if (value.length < min || value.length > max) {
      throw new HttpsError("invalid-argument", `El camp ${key} no és vàlid.`);
    }
    return value;
  };
  const requestId = string("requestId", 36, 36);
  if (!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(requestId)) {
    throw new HttpsError("invalid-argument", "La referència del missatge no és vàlida.");
  }
  const kind = data.kind;
  if (kind !== "issue" && kind !== "improvement" && kind !== "other") {
    throw new HttpsError("invalid-argument", "Selecciona un tipus de consulta.");
  }
  if (data.consent !== true) {
    throw new HttpsError("invalid-argument", "Cal acceptar el tractament de la consulta.");
  }
  return {
    requestId, kind,
    subject: string("subject", 3, 120),
    message: string("message", 20, 5000),
    platform: string("platform", 1, 24),
    appVersion: string("appVersion", 1, 64),
  };
}

export async function storeContactMessage(
  db: admin.firestore.Firestore, uid: string, email: string | null, data: ContactData, now = Date.now(),
): Promise<{ id: string }> {
  const messageRef = db.collection("contactMessages").doc(data.requestId);
  const rateRef = db.collection("contactRateLimits").doc(uid);
  return db.runTransaction(async transaction => {
    const [existing, rate] = await Promise.all([transaction.get(messageRef), transaction.get(rateRef)]);
    if (existing.exists) {
      const previous = existing.data()!;
      if (previous.userId !== uid || previous.subject !== data.subject || previous.message !== data.message || previous.kind !== data.kind) {
        throw new HttpsError("already-exists", "La referència ja s'ha utilitzat per a una altra consulta.");
      }
      return { id: messageRef.id };
    }
    const lastSentAt = rate.data()?.lastSentAt;
    if (typeof lastSentAt === "number" && now - lastSentAt < 60_000) {
      throw new HttpsError("resource-exhausted", "Espera un minut abans d'enviar una altra consulta.");
    }
    transaction.create(messageRef, {
      ...data, userId: uid, email, status: "new", consent: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    transaction.set(rateRef, { lastSentAt: now });
    return { id: messageRef.id };
  });
}

export const submitContact = onCall({ region: "europe-west1", cors: true, maxInstances: 3 }, async request => {
  if (!request.auth || request.auth.token.firebase?.sign_in_provider === "anonymous") {
    throw new HttpsError("unauthenticated", "Inicia sessió per enviar una consulta.");
  }
  const data = validateContactData(request.data);
  try {
    return await storeContactMessage(
      getFirestore(ensureContactApp()), request.auth.uid,
      typeof request.auth.token.email === "string" ? request.auth.token.email : null, data,
    );
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error("[Contact] No s'ha pogut desar la consulta", error);
    throw new HttpsError("internal", "No s'ha pogut enviar la consulta. Torna-ho a provar.");
  }
});
