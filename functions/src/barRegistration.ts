import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { stdnum } from "stdnum";

export function validateBarRegistration(input: unknown): Record<string, unknown> & { location: { latitude: number; longitude: number } } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new HttpsError("invalid-argument", "Dades de registre invàlides.");
  }
  const data = input as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const field of ["businessName", "address", "city", "postalCode", "nif", "contactName"]) {
    if (typeof data[field] !== "string" || !data[field].trim() || data[field].length > 250) {
      throw new HttpsError("invalid-argument", `Revisa el camp ${field}.`);
    }
    result[field] = data[field].trim();
  }
  if (!/^\d{5}$/.test(result.postalCode as string)) {
    throw new HttpsError("invalid-argument", "El codi postal ha de tenir 5 dígits.");
  }
  const taxId = stdnum.ES.nif.validate(result.nif as string);
  if (!taxId.isValid || !taxId.compact) {
    throw new HttpsError("invalid-argument", "El NIF no és vàlid. Revisa el número i el dígit de control.");
  }
  result.nif = taxId.compact;
  const location = data.location;
  if (!location || typeof location !== "object" || Array.isArray(location)) {
    throw new HttpsError("invalid-argument", "Localitza i confirma l'adreça del bar abans de continuar.");
  }
  const { latitude, longitude } = location as Record<string, unknown>;
  if (typeof latitude !== "number" || !Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || typeof longitude !== "number" || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new HttpsError("invalid-argument", "Les coordenades del bar no són vàlides.");
  }
  result.location = { latitude, longitude };
  if (data.googlePlaceId != null && (typeof data.googlePlaceId !== "string" || !/^[A-Za-z0-9_-]{1,255}$/.test(data.googlePlaceId))) {
    throw new HttpsError("invalid-argument", "L'identificador del local no és vàlid.");
  }
  result.googlePlaceId = data.googlePlaceId || null;
  if (data.acceptTerms !== true) throw new HttpsError("invalid-argument", "Has d'acceptar les condicions.");
  if (!["monthly", "quarterly", "annual"].includes(data.billing as string)) {
    throw new HttpsError("invalid-argument", "Cicle de facturació invàlid.");
  }
  result.billing = data.billing;
  for (const field of ["phone", "website", "legalName", "contactPhone", "openingHours", "description"]) {
    if (data[field] !== undefined && (typeof data[field] !== "string" || data[field].length > 2000)) {
      throw new HttpsError("invalid-argument", `Revisa el camp ${field}.`);
    }
    result[field] = typeof data[field] === "string" ? data[field].trim() || null : null;
  }
  for (const field of ["capacity", "screens"]) {
    const value = data[field];
    const number = value === "" || value == null ? null : Number(value);
    if (number !== null && (typeof value !== "string" && typeof value !== "number"
      || !Number.isInteger(number) || number < 0 || number > 100000)) {
      throw new HttpsError("invalid-argument", `Revisa el camp ${field}.`);
    }
    result[field] = number;
  }
  return { ...result, location: { latitude, longitude } };
}

export async function persistBarRegistration(
  db: admin.firestore.Firestore, auth: admin.auth.Auth, uid: string, email: string, input: unknown,
): Promise<string> {
  const data = validateBarRegistration(input);
  const account = await auth.getUser(uid);
  if (account.customClaims?.role === "admin") {
    throw new HttpsError("failed-precondition", "Fes servir un compte de propietari.");
  }
  const ownerRef = db.collection("barOwners").doc(uid);
  const userRef = db.collection("users").doc(uid);
  const newBarRef = db.collection("bars").doc();
  const barId = await db.runTransaction(async transaction => {
    const owner = await transaction.get(ownerRef);
    const user = await transaction.get(userRef);
    if (user.data()?.role === "admin") {
      throw new HttpsError("failed-precondition", "Fes servir un compte de propietari.");
    }
    let barRef = newBarRef;
    if (owner.exists) {
      const id = owner.data()?.barId;
      if (typeof id !== "string" || !id) throw new HttpsError("failed-precondition", "Cal revisar el compte de bar.");
      barRef = db.collection("bars").doc(id);
      const bar = await transaction.get(barRef);
      if (!bar.exists || bar.data()?.ownerId !== uid) {
        throw new HttpsError("failed-precondition", "Cal revisar la vinculació del bar.");
      }
      if (bar.data()?.status === "pending_checkout") {
        const savedBar = bar.data()!;
        const savedOwner = owner.data()!;
        const paymentPending = !!savedOwner.stripeSubscriptionId || savedOwner.checkoutExpiresAt > Math.floor(Date.now() / 1000);
        const unchanged = savedBar.name === data.businessName
          && ["address", "city", "postalCode", "phone", "website", "capacity", "screens", "openingHours", "description"]
            .every(field => (savedBar[field] ?? null) === data[field])
          && (savedBar.googlePlaceId ?? null) === data.googlePlaceId
          && savedBar.location?.latitude === data.location.latitude
          && savedBar.location?.longitude === data.location.longitude
          && savedOwner.nif === data.nif && savedOwner.name === data.contactName
          && (savedOwner.phone ?? null) === data.contactPhone && savedOwner.billingCycle === data.billing
          && savedOwner.legalName === (data.legalName || data.businessName);
        if (paymentPending && !unchanged) {
          throw new HttpsError("failed-precondition", "Ja hi ha un pagament pendent a Stripe. Reprèn-lo o espera que caduqui abans de modificar les dades.");
        }
        if (!paymentPending) {
          transaction.update(barRef, {
            name: data.businessName, address: data.address, city: data.city, postalCode: data.postalCode,
            phone: data.phone, website: data.website, location: data.location,
            googlePlaceId: data.googlePlaceId, legalName: data.legalName || data.businessName,
            capacity: data.capacity, screens: data.screens, openingHours: data.openingHours,
            description: data.description, billing: data.billing, updatedAt: FieldValue.serverTimestamp(),
          });
          transaction.update(ownerRef, {
            name: data.contactName, phone: data.contactPhone, barName: data.businessName,
            billingCycle: data.billing, nif: data.nif, legalName: data.legalName || data.businessName,
            termsAcceptedAt: FieldValue.serverTimestamp(),
            taxIdValidation: { method: "checksum", status: "valid", checkedAt: FieldValue.serverTimestamp() },
          });
        }
      }
    } else {
      transaction.set(barRef, {
        name: data.businessName, address: data.address, city: data.city, postalCode: data.postalCode,
        phone: data.phone, website: data.website, location: data.location,
        ...(data.googlePlaceId ? { googlePlaceId: data.googlePlaceId } : {}),
        legalName: data.legalName || data.businessName, capacity: data.capacity, screens: data.screens,
        openingHours: data.openingHours, description: data.description, ownerId: uid, ownerEmail: email,
        billing: data.billing, status: "pending_checkout", isActive: false, tier: "free", premium: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.set(ownerRef, {
        uid, email, name: data.contactName, phone: data.contactPhone, barId: barRef.id,
        barName: data.businessName, role: "bar_owner", billingCycle: data.billing,
        subscriptionStatus: "none", termsAcceptedAt: FieldValue.serverTimestamp(),
        nif: data.nif, legalName: data.legalName || data.businessName,
        taxIdValidation: { method: "checksum", status: "valid", checkedAt: FieldValue.serverTimestamp() },
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    transaction.set(userRef, {
      id: uid, email, name: user.data()?.name || data.contactName,
      role: "bar_owner", ownedBars: [barRef.id],
    }, { merge: true });
    return barRef.id;
  });
  // Claims follow the atomic write. A retry repairs failed claims without creating another bar.
  await auth.setCustomUserClaims(uid, { ...account.customClaims, role: "bar_owner" });
  return barId;
}
