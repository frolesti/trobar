/**
 * barOwnerService.ts — Gestió del perfil de bar per a propietaris
 *
 * Permet als propietaris verificats:
 * - Editar informació del bar (descripció, promo, xarxes socials)
 * - Gestionar la galeria de fotos
 * - Publicar novetats/anuncis (feed) visibles als usuaris subscripts
 * - Configurar amenitats i horaris d'emissió
 */

import {
    doc, getDoc, setDoc, collection, addDoc, query,
    where, orderBy, getDocs, serverTimestamp, Timestamp,
    limit as firestoreLimit, deleteDoc,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { executeRequest, executeOrThrow } from '../api/core';
import { Bar, BarSocialMedia, BarAmenity } from '../models/Bar';

// ── Tipus ────────────────────────────────────────────────────────────────────

/** Una publicació/novetat del bar (feed) */
export interface BarPost {
    id: string;
    barId: string;
    type: 'promo' | 'event' | 'news' | 'broadcast';
    title: string;
    body: string;
    imageUrl?: string;
    /** Data d'expiració automàtica (p.ex. promo vàlida fins…) */
    expiresAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

/** Dades editables pel propietari */
export interface BarProfileUpdate {
    description?: string;
    promotionalText?: string;
    socialMedia?: BarSocialMedia;
    amenities?: BarAmenity[];
    broadcastingMatches?: string[];
}

// ── Lectura ──────────────────────────────────────────────────────────────────

/** Obtenir el bar propietat d'un usuari */
export async function getOwnedBar(userId: string): Promise<Bar | null> {
    const result = await executeRequest(async () => {
        // Primer mirem el perfil de l'usuari per obtenir l'ID del bar
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) return null;

        const ownedBars = userSnap.data().ownedBars as string[] | undefined;
        if (!ownedBars || ownedBars.length === 0) return null;

        // Carregar el primer bar (per ara, un propietari = un bar)
        const barRef = doc(db, 'bars', ownedBars[0]);
        const barSnap = await getDoc(barRef);
        if (!barSnap.exists()) return null;

        return { id: barSnap.id, ...barSnap.data() } as Bar;
    }, `getOwnedBar:${userId}`);

    return result.data ?? null;
}

/** Obtenir les publicacions d'un bar */
export async function getBarPosts(barId: string, maxPosts = 20): Promise<BarPost[]> {
    const result = await executeRequest(async () => {
        const postsRef = collection(db, 'bars', barId, 'posts');
        const q = query(
            postsRef,
            orderBy('createdAt', 'desc'),
            firestoreLimit(maxPosts)
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                barId,
                type: data.type || 'news',
                title: data.title || '',
                body: data.body || '',
                imageUrl: data.imageUrl,
                expiresAt: data.expiresAt?.toDate?.() || undefined,
                createdAt: data.createdAt?.toDate?.() || new Date(),
                updatedAt: data.updatedAt?.toDate?.() || new Date(),
            } as BarPost;
        });
    }, `getBarPosts:${barId}`);

    return result.data ?? [];
}

// ── Escriptura ───────────────────────────────────────────────────────────────

/** Actualitzar el perfil del bar */
export async function updateBarProfile(barId: string, update: BarProfileUpdate): Promise<void> {
    await executeOrThrow(async () => {
        const barRef = doc(db, 'bars', barId);
        // Netejar undefined/null per evitar errors de Firestore
        const clean = JSON.parse(JSON.stringify(update));
        await setDoc(barRef, {
            ...clean,
            updatedAt: serverTimestamp(),
        }, { merge: true });
    }, `updateBarProfile:${barId}`);
}

/** Publicar una novetat al feed del bar */
export async function createBarPost(barId: string, post: Omit<BarPost, 'id' | 'barId' | 'createdAt' | 'updatedAt'>): Promise<string> {
    return await executeOrThrow(async () => {
        const postsRef = collection(db, 'bars', barId, 'posts');
        const docRef = await addDoc(postsRef, {
            ...post,
            expiresAt: post.expiresAt ? Timestamp.fromDate(post.expiresAt) : null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        return docRef.id;
    }, `createBarPost:${barId}`);
}

/** Eliminar una publicació */
export async function deleteBarPost(barId: string, postId: string): Promise<void> {
    await executeOrThrow(async () => {
        await deleteDoc(doc(db, 'bars', barId, 'posts', postId));
    }, `deleteBarPost:${barId}/${postId}`);
}

/** Pujar una foto a la galeria del bar */
export async function uploadBarPhoto(barId: string, uri: string): Promise<string> {
    return await executeOrThrow(async () => {
        const response = await fetch(uri);
        const blob = await response.blob();
        const filename = `bars/${barId}/gallery/${Date.now()}.jpg`;
        const storageRef = ref(storage, filename);
        await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
        return await getDownloadURL(storageRef);
    }, `uploadBarPhoto:${barId}`);
}

/** Actualitzar la galeria (llista d'URLs) */
export async function updateBarGallery(barId: string, gallery: string[]): Promise<void> {
    await executeOrThrow(async () => {
        const barRef = doc(db, 'bars', barId);
        await setDoc(barRef, { gallery, updatedAt: serverTimestamp() }, { merge: true });
    }, `updateBarGallery:${barId}`);
}

/** Actualitzar els partits que el bar emet */
export async function updateBroadcasting(barId: string, matchIds: string[]): Promise<void> {
    await executeOrThrow(async () => {
        const barRef = doc(db, 'bars', barId);
        await setDoc(barRef, {
            broadcastingMatches: matchIds,
            updatedAt: serverTimestamp(),
        }, { merge: true });
    }, `updateBroadcasting:${barId}`);
}

// ── Subscripcions de notificacions ──────────────────────────────────────────

/** Subscriure un usuari a novetats d'un bar */
export async function subscribeToBar(userId: string, barId: string): Promise<void> {
    await executeOrThrow(async () => {
        const subRef = doc(db, 'users', userId, 'barSubscriptions', barId);
        await setDoc(subRef, {
            barId,
            subscribedAt: serverTimestamp(),
            notifications: true,
        });
    }, `subscribeToBar:${userId}/${barId}`);
}

/** Dessubscriure */
export async function unsubscribeFromBar(userId: string, barId: string): Promise<void> {
    await executeOrThrow(async () => {
        await deleteDoc(doc(db, 'users', userId, 'barSubscriptions', barId));
    }, `unsubscribeFromBar:${userId}/${barId}`);
}

/** Comprovar si un usuari està subscrit a un bar */
export async function isSubscribedToBar(userId: string, barId: string): Promise<boolean> {
    const result = await executeRequest(async () => {
        const subRef = doc(db, 'users', userId, 'barSubscriptions', barId);
        const snap = await getDoc(subRef);
        return snap.exists();
    }, `isSubscribedToBar:${userId}/${barId}`);

    return result.data ?? false;
}

/** Obtenir tots els bars als quals un usuari està subscrit */
export async function getUserBarSubscriptions(userId: string): Promise<string[]> {
    const result = await executeRequest(async () => {
        const subsRef = collection(db, 'users', userId, 'barSubscriptions');
        const snap = await getDocs(subsRef);
        return snap.docs.map(d => d.id);
    }, `getUserBarSubscriptions:${userId}`);

    return result.data ?? [];
}
