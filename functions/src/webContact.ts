import { createHash } from "node:crypto";
import { getFirestore } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { Resend } from "resend";
import { ensureContactApp } from "./contact";

const resendKey = defineSecret("RESEND_API_KEY");
const destinations: Record<string, string> = require("./app/src/data/contactEmails.json");
type Contact = { requestId: string; name: string; email: string; kind: string; message: string };

export function validateWebContact(input: unknown): Contact {
  if (!input || typeof input !== "object") throw new HttpsError("invalid-argument", "Revisa el formulari.");
  const data = input as Record<string, unknown>;
  const text = (key: string, min: number, max: number) => {
    const value = typeof data[key] === "string" ? data[key].trim() : "";
    if (value.length < min || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) {
      throw new HttpsError("invalid-argument", "Revisa els camps del formulari.");
    }
    return value;
  };
  const requestId = text("requestId", 36, 36);
  const name = text("name", 2, 100);
  const email = text("email", 3, 254).toLowerCase();
  const kind = text("kind", 1, 16);
  if (!/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(requestId)
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || /[\r\n]/.test(name)
    || !["general", "support", "billing"].includes(kind)
    || data.consent !== true || data.website !== "") {
    throw new HttpsError("invalid-argument", "Revisa les dades i accepta la política de privacitat.");
  }
  return { requestId, name, email, kind, message: text("message", 20, 5000) };
}

export async function deliverWebContact(
  db: FirebaseFirestore.Firestore, client: Resend, data: Contact, ip: string, now = Date.now(),
): Promise<{ id: string }> {
  if (!ip) throw new HttpsError("unavailable", "No hem pogut enviar el missatge. Torna-ho a provar.");
  const ref = db.collection("webContactMessages").doc(data.requestId);
  const rateRef = db.collection("webContactRateLimits").doc(createHash("sha256").update(ip).digest("hex"));
  const fingerprint = createHash("sha256").update(JSON.stringify(data)).digest("hex");
  const accepted = await db.runTransaction(async transaction => {
    const [existing, rate] = await Promise.all([transaction.get(ref), transaction.get(rateRef)]);
    if (existing.exists) {
      const previous = existing.data()!;
      if (previous.fingerprint !== fingerprint) throw new HttpsError("already-exists", "Envia la consulta amb una referència nova.");
      if (previous.state === "accepted") return true;
      if (now - previous.createdAt >= 23 * 60 * 60_000) {
        throw new HttpsError("failed-precondition", "No podem confirmar l’enviament anterior. Escriu-nos directament per correu.");
      }
      return false;
    }
    const limit = rate.data();
    const sameDay = typeof limit?.dayStart === "number" && now - limit.dayStart < 86_400_000;
    if ((typeof limit?.lastSentAt === "number" && now - limit.lastSentAt < 60_000)
      || (sameDay && limit.count >= 10)) {
      throw new HttpsError("resource-exhausted", "Has enviat diverses consultes. Espera una estona abans de tornar-ho a provar.");
    }
    transaction.set(ref, { ...data, consent: true, fingerprint, state: "pending", createdAt: now });
    transaction.set(rateRef, { lastSentAt: now, dayStart: sameDay ? limit!.dayStart : now, count: sameDay ? limit!.count + 1 : 1 });
    return false;
  });
  if (accepted) return { id: ref.id };
  const labels: Record<string, string> = { general: "Consulta general", support: "Suport", billing: "Facturació" };
  const response = await client.emails.send({
    from: `troBar <${destinations.general}>`,
    to: [destinations[data.kind]],
    replyTo: data.email,
    subject: `troBar · ${labels[data.kind]} · ${data.requestId}`,
    text: `${data.name}\n${data.email}\n\n${data.message}\n\nReferència: ${data.requestId}`,
  }, { idempotencyKey: `web-contact-${data.requestId}`, signal: AbortSignal.timeout(15_000) });
  if (response.error || !response.data?.id) {
    console.error("[WebContact] Provider did not confirm delivery", response.error?.statusCode || "invalid-response");
    throw new HttpsError("unavailable", "No hem pogut confirmar l’enviament. Torna-ho a provar sense canviar el missatge.");
  }
  await ref.update({ state: "accepted", providerId: response.data.id, acceptedAt: Date.now() });
  return { id: ref.id };
}

export const submitWebContact = onCall({
  region: "europe-west1", maxInstances: 3, secrets: [resendKey],
  cors: [/^https:\/\/(www\.)?trobar\.cat$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/],
}, async request => {
  const data = validateWebContact(request.data);
  try {
    return await deliverWebContact(getFirestore(ensureContactApp()), new Resend(resendKey.value()), data, request.rawRequest.ip || "");
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error("[WebContact] Submission failed", error instanceof Error ? error.name : "unknown");
    throw new HttpsError("unavailable", "No hem pogut confirmar l’enviament. Torna-ho a provar sense canviar el missatge.");
  }
});
