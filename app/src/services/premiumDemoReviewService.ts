import AsyncStorage from '@react-native-async-storage/async-storage';
import { Bar } from '../models/Bar';
import { Review } from '../models/Review';
import { isPremiumDemoBar } from '../data/premiumDemoProfiles';
import { validateReview } from './reviewService';

function storageKey(bar: Bar) {
    if (!isPremiumDemoBar(bar)) throw new Error('Les ressenyes locals només són per a perfils de demostració.');
    return `trobar:demo-reviews:v1:${bar.id}`;
}

export async function fetchDemoUserReviews(bar: Bar): Promise<Review[]> {
    const raw = await AsyncStorage.getItem(storageKey(bar));
    if (raw === null) return [];
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) throw new Error('Les ressenyes locals desades no són vàlides.');
    return data.map((item: unknown) => {
        if (!item || typeof item !== 'object' || !('id' in item) || typeof item.id !== 'string'
            || !('userId' in item) || typeof item.userId !== 'string'
            || !('userName' in item) || typeof item.userName !== 'string'
            || !('rating' in item) || typeof item.rating !== 'number'
            || !('createdAt' in item) || typeof item.createdAt !== 'string'
            || ('comment' in item && typeof item.comment !== 'string')
            || ('userAvatar' in item && typeof item.userAvatar !== 'string')) {
            throw new Error('Una ressenya local desada no és vàlida.');
        }
        const comment = 'comment' in item && typeof item.comment === 'string' ? item.comment : undefined;
        validateReview(item.rating, comment);
        const createdAt = new Date(item.createdAt);
        if (!Number.isFinite(createdAt.getTime())) throw new Error('La data de la ressenya local no és vàlida.');
        return {
            id: item.id, barId: bar.id, userId: item.userId, userName: item.userName, rating: item.rating,
            comment, createdAt, userAvatar: 'userAvatar' in item && typeof item.userAvatar === 'string' ? item.userAvatar : undefined,
        };
    });
}

export async function addDemoUserReview(bar: Bar, user: { id: string; name: string; avatar?: string }, rating: number, comment: string) {
    validateReview(rating, comment);
    const reviews = await fetchDemoUserReviews(bar);
    if (reviews.some(review => review.userId === user.id)) throw new Error('Ja has publicat una ressenya de prova.');
    const review: Review = {
        id: `local-demo-review-${user.id}`, barId: bar.id, userId: user.id, userName: user.name,
        rating, createdAt: new Date(), ...(user.avatar ? { userAvatar: user.avatar } : {}),
        ...(comment.trim() ? { comment: comment.trim() } : {}),
    };
    await AsyncStorage.setItem(storageKey(bar), JSON.stringify([review, ...reviews]));
}

export async function deleteDemoUserReview(bar: Bar, reviewId: string, userId: string) {
    const reviews = await fetchDemoUserReviews(bar);
    const review = reviews.find(item => item.id === reviewId);
    if (!review || review.userId !== userId) throw new Error('Només pots eliminar la teva ressenya de prova.');
    await AsyncStorage.setItem(storageKey(bar), JSON.stringify(reviews.filter(item => item.id !== reviewId)));
}
