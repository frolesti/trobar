/**
 * Servei de ressenyes internes — Només per a bars PREMIUM
 * Col·lecció Firestore: bars/{barId}/reviews/{reviewId}
 */
import {
    collection, doc, getDocs, updateDoc, deleteDoc,
    query, orderBy, limit, where, serverTimestamp, Timestamp, runTransaction,
    getAggregateFromServer, average, count,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Review, BarReviewStats } from '../models/Review';

// ── Obtenir ressenyes d'un bar ─────────────────────────────

export async function fetchReviews(barId: string, maxResults = 50): Promise<Review[]> {
    const colRef = collection(db, 'bars', barId, 'reviews');
    const q = query(colRef, orderBy('createdAt', 'desc'), limit(maxResults));
    const snap = await getDocs(q);

    return snap.docs.map(d => {
        const data = d.data();
        return {
            id: d.id,
            barId,
            userId: data.userId,
            userName: data.userName,
            userAvatar: data.userAvatar || undefined,
            rating: data.rating,
            comment: data.comment || undefined,
            createdAt: (data.createdAt as Timestamp)?.toDate?.() || new Date(),
            updatedAt: (data.updatedAt as Timestamp)?.toDate?.() || undefined,
        };
    });
}

// ── Afegir ressenya ─────────────────────────────────────────

export async function addReview(
    barId: string,
    userId: string,
    userName: string,
    userAvatar: string | undefined,
    rating: number,
    comment?: string,
): Promise<string> {
    validateReview(rating, comment);
    if (await getUserReview(barId, userId)) {
        throw new Error('Ja has publicat una ressenya en aquest bar.');
    }
    const ref = doc(db, 'bars', barId, 'reviews', userId);
    const trimmedComment = (comment || '').trim();
    await runTransaction(db, async transaction => {
        if ((await transaction.get(ref)).exists()) {
            throw new Error('Ja has publicat una ressenya en aquest bar.');
        }
        transaction.set(ref, {
            userId, userName, userAvatar: userAvatar || null, rating,
            ...(trimmedComment ? { comment: trimmedComment } : {}),
            createdAt: serverTimestamp(),
        });
    });
    return ref.id;
}

// ── Actualitzar ressenya ──────────────────────────────────

export async function updateReview(
    barId: string,
    reviewId: string,
    rating: number,
    comment: string,
): Promise<void> {
    validateReview(rating, comment);
    const ref = doc(db, 'bars', barId, 'reviews', reviewId);
    await updateDoc(ref, {
        rating,
        comment: comment.trim(),
        updatedAt: serverTimestamp(),
    });
}

// ── Eliminar ressenya ────────────────────────────────────

export async function deleteReview(barId: string, reviewId: string): Promise<void> {
    await deleteDoc(doc(db, 'bars', barId, 'reviews', reviewId));
}

// ── Obtenir estadístiques ────────────────────────────────

export async function getBarReviewStats(barId: string): Promise<BarReviewStats> {
    const snap = await getAggregateFromServer(collection(db, 'bars', barId, 'reviews'), {
        averageRating: average('rating'), totalReviews: count(),
    });
    const data = snap.data();
    return { averageRating: data.averageRating ?? 0, totalReviews: data.totalReviews };
}

export function validateReview(rating: number, comment = '') {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw new Error('La valoració ha de ser entre 1 i 5 estrelles.');
    }
    if (comment.trim().length > 2000) {
        throw new Error('El comentari no pot superar els 2.000 caràcters.');
    }
}

// ── Comprovar si l'usuari ja ha deixat ressenya ──────────

export async function getUserReview(barId: string, userId: string): Promise<Review | null> {
    const colRef = collection(db, 'bars', barId, 'reviews');
    const q = query(colRef, where('userId', '==', userId), limit(1));
    const snap = await getDocs(q);

    for (const d of snap.docs) {
        if (d.data().userId === userId) {
            const data = d.data();
            return {
                id: d.id,
                barId,
                userId: data.userId,
                userName: data.userName,
                userAvatar: data.userAvatar || undefined,
                rating: data.rating,
                comment: data.comment,
                createdAt: (data.createdAt as Timestamp)?.toDate?.() || new Date(),
                updatedAt: (data.updatedAt as Timestamp)?.toDate?.() || undefined,
            };
        }
    }
    return null;
}
