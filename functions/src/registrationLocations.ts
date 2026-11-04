import * as admin from "firebase-admin";
import { createHash, randomUUID } from "node:crypto";
import { HttpsError, onCall } from "firebase-functions/v2/https";

export interface RegistrationLocation {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
  address: Record<string, string>;
}

function parseLocations(input: unknown): RegistrationLocation[] {
  if (!Array.isArray(input)) throw new Error("Expected an array of locations");
  return input.slice(0, 6).map(value => {
    if (!value || typeof value !== "object" || typeof value.display_name !== "string"
      || typeof value.lat !== "string" || !value.lat.trim() || typeof value.lon !== "string" || !value.lon.trim()
      || !Number.isFinite(Number(value.lat)) || Math.abs(Number(value.lat)) > 90
      || !Number.isFinite(Number(value.lon)) || Math.abs(Number(value.lon)) > 180
      || typeof value.place_id !== "number") {
      throw new Error("Invalid location response");
    }
    const address: Record<string, string> = {};
    if (value.address && typeof value.address === "object") {
      for (const [key, field] of Object.entries(value.address)) {
        if (typeof field === "string") address[key] = field;
      }
    }
    return {
      place_id: value.place_id, display_name: value.display_name, lat: value.lat, lon: value.lon,
      ...(typeof value.name === "string" ? { name: value.name } : {}), address,
    };
  });
}

export async function searchLocations(db: admin.firestore.Firestore, query: unknown): Promise<RegistrationLocation[]> {
  if (typeof query !== "string" || query.trim().length < 3 || query.length > 200) {
    throw new HttpsError("invalid-argument", "Escriu entre 3 i 200 caràcters per cercar el bar o l'adreça.");
  }
  const normalized = query.trim().replace(/\s+/g, " ").toLowerCase();
  const cache = db.collection("registrationLocationCache").doc(createHash("sha256").update(normalized).digest("hex"));
  const throttle = db.collection("registrationLocationLimits").doc("nominatim");
  const requestId = randomUUID();
  const cached = await db.runTransaction(async transaction => {
    const saved = await transaction.get(cache);
    const limit = await transaction.get(throttle);
    if (saved.exists && saved.data()!.expiresAt > Date.now()) {
      return parseLocations(saved.data()!.results);
    }
    if ((limit.data()?.blockedUntil || 0) > Date.now()) {
      throw new HttpsError("resource-exhausted", "La cerca està ocupada. Espera uns segons i torna-ho a provar.");
    }
    // A global lease serializes requests across all function instances.
    transaction.set(throttle, { requestId, blockedUntil: Date.now() + 20000 });
    return null;
  });
  if (cached) return cached;

  try {
    const endpoint = new URL(process.env.REGISTRATION_NOMINATIM_URL || "https://nominatim.openstreetmap.org/search");
    if (endpoint.protocol !== "https:") throw new Error("Location service requires HTTPS");
    endpoint.search = new URLSearchParams({
      q: normalized, format: "jsonv2", addressdetails: "1", limit: "6", countrycodes: "es",
    }).toString();
    const response = await fetch(endpoint, {
      headers: { "User-Agent": "troBar/1.0 (https://www.trobar.cat)", "Accept-Language": "ca" },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error(`Location service HTTP ${response.status}`);
    const results = parseLocations(await response.json());
    await cache.set({ results, expiresAt: Date.now() + 86400000 });
    return results;
  } catch (error) {
    console.error("[BarRegistration] Location search failed", error instanceof Error ? error.message : "Unknown error");
    throw new HttpsError("unavailable", "No s'ha pogut consultar el servei de localitzacions. Torna-ho a provar.");
  } finally {
    await db.runTransaction(async transaction => {
      const current = await transaction.get(throttle);
      if (current.data()?.requestId === requestId) {
        transaction.set(throttle, { requestId, blockedUntil: Date.now() + 1100 });
      }
    });
  }
}

export const searchRegistrationLocations = onCall({ region: "europe-west1", cors: true }, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Inicia sessió per cercar el teu bar.");
  if (request.auth.token.email_verified !== true) {
    throw new HttpsError("failed-precondition", "Verifica l'email abans de cercar el bar.");
  }
  return { results: await searchLocations(admin.firestore(), request.data?.query) };
});
