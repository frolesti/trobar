/**
 * Servei de ressenyes internes — Només per a bars PREMIUM
 * Col·lecció Firestore: bars/{barId}/reviews/{reviewId}
 */
import {
    collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
    query, orderBy, limit, serverTimestamp, Timestamp, getDoc, setDoc,
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
    const colRef = collection(db, 'bars', barId, 'reviews');
    const trimmedComment = (comment || '').trim();
    const docRef = await addDoc(colRef, {
        userId,
        userName,
        userAvatar: userAvatar || null,
        rating: Math.min(5, Math.max(1, Math.round(rating))),
        ...(trimmedComment ? { comment: trimmedComment } : {}),
        createdAt: serverTimestamp(),
    });

    // Actualitzar estadístiques agregades del bar
    await recalculateBarStats(barId);

    return docRef.id;
}

// ── Actualitzar ressenya ──────────────────────────────────

export async function updateReview(
    barId: string,
    reviewId: string,
    rating: number,
    comment: string,
): Promise<void> {
    const ref = doc(db, 'bars', barId, 'reviews', reviewId);
    await updateDoc(ref, {
        rating: Math.min(5, Math.max(1, Math.round(rating))),
        comment: comment.trim(),
        updatedAt: serverTimestamp(),
    });

    await recalculateBarStats(barId);
}

// ── Eliminar ressenya ────────────────────────────────────

export async function deleteReview(barId: string, reviewId: string): Promise<void> {
    await deleteDoc(doc(db, 'bars', barId, 'reviews', reviewId));
    await recalculateBarStats(barId);
}

// ── Obtenir estadístiques ────────────────────────────────

export async function getBarReviewStats(barId: string): Promise<BarReviewStats> {
    const statsRef = doc(db, 'bars', barId, 'reviewStats', 'aggregate');
    const snap = await getDoc(statsRef);
    if (snap.exists()) {
        const data = snap.data();
        return { averageRating: data.averageRating || 0, totalReviews: data.totalReviews || 0 };
    }
    return { averageRating: 0, totalReviews: 0 };
}

// ── Recalcular estadístiques agregades ───────────────────

async function recalculateBarStats(barId: string): Promise<void> {
    const colRef = collection(db, 'bars', barId, 'reviews');
    const snap = await getDocs(colRef);

    let total = 0;
    let sum = 0;
    snap.forEach(d => {
        const r = d.data().rating;
        if (typeof r === 'number') {
            sum += r;
            total++;
        }
    });

    const avg = total > 0 ? sum / total : 0;

    const statsRef = doc(db, 'bars', barId, 'reviewStats', 'aggregate');
    await setDoc(statsRef, {
        averageRating: Math.round(avg * 10) / 10,
        totalReviews: total,
        updatedAt: serverTimestamp(),
    }, { merge: true });
}

// ── Comprovar si l'usuari ja ha deixat ressenya ──────────

export async function getUserReview(barId: string, userId: string): Promise<Review | null> {
    const colRef = collection(db, 'bars', barId, 'reviews');
    const q = query(colRef, orderBy('createdAt', 'desc'));
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
