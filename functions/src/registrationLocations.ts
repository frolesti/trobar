import * as admin from "firebase-admin";
import { createHash } from "node:crypto";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";

const placesKey = defineSecret("GOOGLE_PLACES_API_KEY");
const SESSION_TOKEN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PLACE_ID = /^[A-Za-z0-9_-]{1,255}$/;

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Places response");
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  const result = object(value).text;
  if (typeof result !== "string" || !result.trim()) throw new Error("Invalid Places text");
  return result;
}

function validateSessionToken(value: unknown): string {
  if (typeof value !== "string" || !SESSION_TOKEN.test(value)) {
    throw new HttpsError("invalid-argument", "La sessió de cerca no és vàlida. Torna-ho a provar.");
  }
  return value;
}

async function reserveRequest(db: admin.firestore.Firestore, uid: string, spacing = 250): Promise<void> {
  const ref = db.collection("registrationLocationLimits").doc(createHash("sha256").update(uid).digest("hex"));
  await db.runTransaction(async transaction => {
    const saved = (await transaction.get(ref)).data();
    const now = Date.now();
    const currentWindow = saved && now - saved.windowStart < 60000;
    if (currentWindow && (saved.count >= 60 || now - saved.lastRequestAt < spacing)) {
      throw new HttpsError("resource-exhausted", "Espera un moment abans de tornar a cercar.");
    }
    transaction.set(ref, {
      windowStart: currentWindow ? saved.windowStart : now,
      count: currentWindow ? saved.count + 1 : 1,
      lastRequestAt: now,
    });
  });
}

async function requestPlaces(path: string, method: "GET" | "POST", fields: string, body?: unknown): Promise<unknown> {
  const key = placesKey.value().trim();
  if (!key) throw new HttpsError("failed-precondition", "La cerca de locals encara no està configurada.");
  try {
    const response = await fetch(`https://places.googleapis.com/v1/${path}`, {
      method,
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": fields },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`Places HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("[BarRegistration] Places request failed", error instanceof Error ? error.message : "Unknown error");
    throw new HttpsError("unavailable", "No podem consultar els locals ara mateix. Torna-ho a provar d'aquí a un moment.");
  }
}

function requireVerifiedAccount(request: { auth?: { uid: string; token: { email_verified?: unknown } } }): string {
  if (!request.auth) throw new HttpsError("unauthenticated", "Inicia sessió per cercar el teu bar.");
  if (request.auth.token.email_verified !== true) {
    throw new HttpsError("failed-precondition", "Confirma el teu correu abans de cercar el bar.");
  }
  return request.auth.uid;
}

const options = { region: "europe-west1", cors: true, secrets: [placesKey] };

export const searchRegistrationLocations = onCall(options, async request => {
  const uid = requireVerifiedAccount(request);
  const query = request.data?.query;
  if (typeof query !== "string" || query.trim().length < 3 || query.length > 200) {
    throw new HttpsError("invalid-argument", "Escriu entre 3 i 200 caràcters per cercar el bar o l'adreça.");
  }
  const sessionToken = validateSessionToken(request.data?.sessionToken);
  await reserveRequest(admin.firestore(), uid);
  const response = await requestPlaces("places:autocomplete", "POST", "suggestions.placePrediction", {
    input: query.trim(), includedRegionCodes: ["es"], languageCode: "ca", sessionToken,
  });
  try {
    const data = object(response);
    if (data.suggestions === undefined) return { results: [] };
    if (!Array.isArray(data.suggestions)) throw new Error("Invalid suggestions");
    const results = data.suggestions.slice(0, 5).map(value => {
      const prediction = object(object(value).placePrediction);
      if (typeof prediction.placeId !== "string" || !PLACE_ID.test(prediction.placeId)) throw new Error("Invalid place ID");
      const label = text(prediction.text);
      const format = prediction.structuredFormat ? object(prediction.structuredFormat) : null;
      return {
        placeId: prediction.placeId,
        primaryText: format?.mainText ? text(format.mainText) : label.split(",")[0],
        secondaryText: format?.secondaryText ? text(format.secondaryText) : label,
      };
    });
    return { results };
  } catch {
    console.error("[BarRegistration] Invalid Places autocomplete response");
    throw new HttpsError("unavailable", "No hem pogut llegir les coincidències.");
  }
});

export const getRegistrationLocationDetails = onCall(options, async request => {
  const uid = requireVerifiedAccount(request);
  const placeId = request.data?.placeId;
  if (typeof placeId !== "string" || !PLACE_ID.test(placeId)) {
    throw new HttpsError("invalid-argument", "Selecciona un local de la llista.");
  }
  const sessionToken = validateSessionToken(request.data?.sessionToken);
  await reserveRequest(admin.firestore(), uid, 0);
  const response = await requestPlaces(
    `places/${encodeURIComponent(placeId)}?languageCode=ca&sessionToken=${encodeURIComponent(sessionToken)}`,
    "GET", "id,displayName,formattedAddress,addressComponents,location",
  );
  try {
    const data = object(response);
    const location = object(data.location);
    if (data.id !== placeId || typeof data.formattedAddress !== "string"
      || typeof location.latitude !== "number" || !Number.isFinite(location.latitude) || Math.abs(location.latitude) > 90
      || typeof location.longitude !== "number" || !Number.isFinite(location.longitude) || Math.abs(location.longitude) > 180) {
      throw new Error("Invalid place location");
    }
    if (data.addressComponents !== undefined && !Array.isArray(data.addressComponents)) throw new Error("Invalid address");
    const components = (data.addressComponents || []) as unknown[];
    const part = (...types: string[]) => {
      for (const type of types) {
        for (const value of components) {
          const item = object(value);
          if (Array.isArray(item.types) && item.types.includes(type) && typeof item.longText === "string") return item.longText;
        }
      }
      return "";
    };
    return { place: {
      placeId, name: data.displayName ? text(data.displayName) : data.formattedAddress.split(",")[0],
      address: [part("route"), part("street_number")].filter(Boolean).join(" ") || data.formattedAddress.split(",")[0],
      city: part("locality", "postal_town", "administrative_area_level_3", "administrative_area_level_2"),
      postalCode: part("postal_code"), latitude: location.latitude, longitude: location.longitude,
    } };
  } catch {
    console.error("[BarRegistration] Invalid Places details response");
    throw new HttpsError("unavailable", "No hem pogut localitzar aquest resultat. Selecciona'n un altre.");
  }
});
