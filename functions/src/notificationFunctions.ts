import * as admin from 'firebase-admin';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentUpdated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import {
    categoryEligible, checkReceipts, deliver, DeliveryLedger, DeliveryStore, hash, MAX_TOKENS, millis, MINUTE,
    nearbyEligible, newlyVerified, Notice, PAGE_SIZE, paidBar, preferences, promotionEligible,
    reminderEligible, resultEligible, validPushToken, WINDOW,
} from './notificationDelivery';

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const region = 'europe-west1';
const LEASE = 10 * MINUTE;
const MAX_PAGES = 2;
const MAX_JOBS = 10;
const MAX_MAINTENANCE = 100;
const timestamp = (value: number): admin.firestore.Timestamp => admin.firestore.Timestamp.fromMillis(value);
const ledgerRef = (uid: string, eventKey: string): admin.firestore.DocumentReference =>
    db.collection('users').doc(uid).collection('notificationDeliveries').doc(hash(eventKey));

export const deliveryStore: DeliveryStore = {
    async claim(uid, notice, owner, now) {
        return db.runTransaction(async transaction => {
            const ref = ledgerRef(uid, notice.eventKey);
            const existing = (await transaction.get(ref)).data() as DeliveryLedger | undefined;
            if (existing && (existing.state === 'done' || existing.leaseUntil > now || existing.nextAttemptAt > now)) return null;
            const ledger: DeliveryLedger = existing ?? {
                notice, state: 'active', lease: owner, leaseUntil: 0, nextAttemptAt: 0, items: {},
                expiresAt: notice.expiresAt,
            };
            for (const item of Object.values(ledger.items)) {
                if (item.state === 'sending') item.state = 'unknown';
            }
            ledger.lease = owner;
            ledger.leaseUntil = now + LEASE;
            transaction.set(ref, { ...ledger, retryAt: null });
            return ledger;
        });
    },
    async save(uid, ledger) {
        await db.runTransaction(async transaction => {
            const ref = ledgerRef(uid, ledger.notice.eventKey);
            const current = (await transaction.get(ref)).data();
            if (current?.lease !== ledger.lease || current.leaseUntil < Date.now()) throw new Error('Notification lease lost');
            const receipts = Object.values(ledger.items).filter(item => item.state === 'accepted');
            transaction.set(ref, {
                ...ledger,
                retryAt: ledger.state === 'active' ? timestamp(Math.max(ledger.nextAttemptAt, Date.now() + MINUTE)) : null,
                receiptAt: receipts.length ? timestamp(Math.min(...receipts.map(item => item.receiptAfter!))) : null,
                cleanupAt: timestamp(Date.now() + 30 * 86400_000),
            });
        });
    },
    async tokens(uid) {
        const result = await db.collection('users').doc(uid).collection('pushDevices')
            .orderBy(admin.firestore.FieldPath.documentId()).limit(MAX_TOKENS).get();
        return result.docs.filter(document => validPushToken(document.data())).map(document => ({
            id: document.id, token: document.data().token, platform: document.data().platform,
        }));
    },
    async removeToken(uid, tokenId, expectedHash) {
        const ref = db.collection('users').doc(uid).collection('pushDevices').doc(tokenId);
        await db.runTransaction(async transaction => {
            const value = (await transaction.get(ref)).data();
            if (typeof value?.token === 'string' && hash(value.token) === expectedHash) transaction.delete(ref);
        });
    },
};

type Job = { notice: Notice; cursor: string | null; leaseUntil: number; owner: string; done: boolean };

async function enqueue(notice: Notice): Promise<void> {
    const ref = db.collection('notificationJobs').doc(hash(notice.eventKey));
    await db.runTransaction(async transaction => {
        if ((await transaction.get(ref)).exists) return;
        transaction.create(ref, {
            notice, cursor: null, leaseUntil: 0, owner: '', done: false,
            runAt: timestamp(Date.now()), cleanupAt: timestamp(Date.now() + 30 * 86400_000),
        });
    });
}

async function eligible(uid: string, notice: Notice): Promise<boolean> {
    const user = (await db.collection('users').doc(uid).get()).data();
    const now = Date.now();
    if (!user || notice.expiresAt <= now) return false;
    if (notice.kind === 'matchReminder' || notice.kind === 'liveResults') {
        const match = (await db.collection('matches').doc(notice.data.matchId).get()).data();
        if (!match) return false;
        if (notice.kind === 'matchReminder') return reminderEligible(match, user, now, notice.data.lead)
            && millis(match.timestamp) === notice.data.kickoff;
        return preferences(user).liveResults === true && categoryEligible(match, user) && resultEligible(notice.data.before, match, now)
            && match.homeScore === notice.data.homeScore && match.awayScore === notice.data.awayScore;
    }
    const bar = (await db.collection('bars').doc(notice.data.barId).get()).data();
    const area = (await db.collection('users').doc(uid).collection('notificationPrivate').doc('area').get()).data();
    if (!bar || !nearbyEligible({ ...user, notificationLocation: area }, bar, notice.kind, now)) return false;
    if (notice.kind === 'newBarNearby') return millis(bar.verifiedAt) === notice.data.verifiedAt;
    const promotion = (await db.collection('bars').doc(notice.data.barId)
        .collection('promotions').doc(notice.data.promotionId).get()).data();
    return !!promotion && promotionEligible(promotion, bar, now)
        && promotion.title === notice.title && promotion.body === notice.body;
}

async function processJobs(): Promise<void> {
    const jobs = await db.collection('notificationJobs').where('runAt', '<=', timestamp(Date.now()))
        .orderBy('runAt').limit(MAX_JOBS).get();
    for (const snapshot of jobs.docs) {
        const owner = db.collection('notificationJobs').doc().id;
        const job = await db.runTransaction(async transaction => {
            const current = (await transaction.get(snapshot.ref)).data() as Job;
            if (current.done || current.leaseUntil > Date.now()) return null;
            current.owner = owner;
            current.leaseUntil = Date.now() + LEASE;
            transaction.update(snapshot.ref, { owner, leaseUntil: current.leaseUntil, runAt: timestamp(current.leaseUntil) });
            return current;
        });
        if (!job) continue;
        for (let page = 0; page < MAX_PAGES && !job.done; page++) {
            if (job.notice.expiresAt <= Date.now()) { job.done = true; break; }
            let query = db.collection('users').orderBy(admin.firestore.FieldPath.documentId()).limit(PAGE_SIZE);
            if (job.cursor) query = query.startAfter(job.cursor);
            const users = await query.get();
            for (const user of users.docs) {
                if (job.leaseUntil <= Date.now()) throw new Error('Notification job lease expired');
                await deliver(deliveryStore, user.id, job.notice, () => eligible(user.id, job.notice));
            }
            job.cursor = users.docs[users.docs.length - 1]?.id ?? job.cursor;
            job.done = users.size < PAGE_SIZE;
            await db.runTransaction(async transaction => {
                const current = (await transaction.get(snapshot.ref)).data();
                if (current?.owner !== owner || current.leaseUntil < Date.now()) throw new Error('Notification job lease lost');
                transaction.update(snapshot.ref, { cursor: job.cursor, done: job.done });
            });
        }
        await db.runTransaction(async transaction => {
            const current = (await transaction.get(snapshot.ref)).data();
            if (current?.owner !== owner || current.leaseUntil < Date.now()) return;
            transaction.update(snapshot.ref, {
                done: job.done, leaseUntil: 0, runAt: job.done ? null : timestamp(Date.now() + MINUTE),
            });
        });
    }
}

async function maintainDeliveries(): Promise<void> {
    const retries = await db.collectionGroup('notificationDeliveries').where('retryAt', '<=', timestamp(Date.now()))
        .orderBy('retryAt').limit(MAX_MAINTENANCE).get();
    for (const snapshot of retries.docs) {
        const ledger = snapshot.data() as DeliveryLedger;
        const uid = snapshot.ref.parent.parent!.id;
        if (ledger.notice.expiresAt <= Date.now() || !await eligible(uid, ledger.notice)) {
            await snapshot.ref.update({ retryAt: null });
        } else await deliver(deliveryStore, uid, ledger.notice, () => eligible(uid, ledger.notice));
    }
    const receipts = await db.collectionGroup('notificationDeliveries').where('receiptAt', '<=', timestamp(Date.now()))
        .orderBy('receiptAt').limit(MAX_MAINTENANCE).get();
    for (const snapshot of receipts.docs) {
        const ledger = await db.runTransaction(async transaction => {
            const current = (await transaction.get(snapshot.ref)).data() as DeliveryLedger;
            if (current.leaseUntil > Date.now()) return null;
            current.lease = db.collection('notificationJobs').doc().id;
            current.leaseUntil = Date.now() + LEASE;
            transaction.update(snapshot.ref, { lease: current.lease, leaseUntil: current.leaseUntil });
            return current;
        });
        if (ledger) await checkReceipts(deliveryStore, snapshot.ref.parent.parent!.id, ledger);
    }
}

async function enqueueReminders(): Promise<void> {
    const now = Date.now();
    for (const lead of [30, 60, 120]) {
        let cursor: admin.firestore.QueryDocumentSnapshot | undefined;
        for (let page = 0; page < MAX_PAGES; page++) {
            let query = db.collection('matches').where('timestamp', '>', timestamp(now + lead * MINUTE - WINDOW))
                .where('timestamp', '<=', timestamp(now + lead * MINUTE)).orderBy('timestamp').limit(PAGE_SIZE);
            if (cursor) query = query.startAfter(cursor);
            const matches = await query.get();
            for (const match of matches.docs) {
                const data = match.data();
                if (!reminderEligible(data, { preferences: { notifications: { matchReminder: lead } } }, now)) continue;
                const kickoff = millis(data.timestamp);
                await enqueue({
                    eventKey: `reminder:${match.id}:${kickoff}:${lead}`, kind: 'matchReminder',
                    title: 'Recordatori de partit', body: `${data.homeTeam?.name || 'Local'} - ${data.awayTeam?.name || 'Visitant'}: en ${lead} minuts.`,
                    expiresAt: kickoff - lead * MINUTE + WINDOW,
                    data: { matchId: match.id, kickoff, lead },
                });
            }
            if (matches.size < PAGE_SIZE) break;
            cursor = matches.docs[matches.docs.length - 1];
            if (page === MAX_PAGES - 1) console.warn('Notification reminder match scan capped');
        }
    }
}

export const scheduledNotificationReminders = onSchedule({
    schedule: 'every 5 minutes', region, timeZone: 'Etc/UTC', timeoutSeconds: 540,
    maxInstances: 1, retryCount: 0,
}, async () => {
    await enqueueReminders();
    await processJobs();
    await maintainDeliveries();
});

export const notificationMatchUpdated = onDocumentUpdated({ document: 'matches/{matchId}', region, retry: true }, async event => {
    if (!event.data) return;
    const before = event.data.before.data();
    const after = event.data.after.data();
    const now = Date.now();
    if (!resultEligible(before, after, now) || now - Date.parse(event.time) > 15 * MINUTE) return;
    const kickoff = millis(after.timestamp);
    await enqueue({
        eventKey: `result:${event.params.matchId}:${kickoff}:${after.homeScore}:${after.awayScore}:${after.status}`,
        kind: 'liveResults', title: after.status === 'finished' ? 'Resultat final' : 'Resultat en directe',
        body: `${after.homeTeam?.name || 'Local'} ${after.homeScore} - ${after.awayScore} ${after.awayTeam?.name || 'Visitant'}`, expiresAt: Date.parse(event.time) + 15 * MINUTE,
        data: { matchId: event.params.matchId, homeScore: after.homeScore, awayScore: after.awayScore,
            before: { status: before.status, timestamp: millis(before.timestamp),
                homeScore: before.homeScore ?? null, awayScore: before.awayScore ?? null } },
    });
});

export const notificationBarUpdated = onDocumentWritten({ document: 'bars/{barId}', region, retry: true }, async event => {
    if (!event.data?.after.exists) return;
    const after = event.data.after.data()!;
    const verifiedAt = millis(after.verifiedAt);
    const now = Date.now();
    if (!newlyVerified(event.data.before.data() ?? {}, after) || verifiedAt > now
        || now - verifiedAt > 15 * MINUTE || now - Date.parse(event.time) > 15 * MINUTE) return;
    await enqueue({
        eventKey: `bar:${event.params.barId}:${verifiedAt}`, kind: 'newBarNearby',
        title: 'Nou bar a prop', body: typeof after.name === 'string' ? after.name.slice(0, 120) : 'Nou bar verificat',
        expiresAt: Date.parse(event.time) + 24 * 60 * MINUTE, data: { barId: event.params.barId, verifiedAt },
    });
});

export const notificationPromotionPublished = onDocumentWritten({
    document: 'bars/{barId}/promotions/{promotionId}', region, retry: true,
}, async event => {
    if (!event.data?.after.exists) return;
    const before = event.data.before.data();
    const after = event.data.after.data()!;
    if (before?.status === 'published') return;
    const now = Date.now();
    if (now - Date.parse(event.time) > 15 * MINUTE) return;
    const bar = (await db.collection('bars').doc(event.params.barId).get()).data();
    if (!bar || !paidBar(bar) || !promotionEligible(after, bar, now)) return;
    await enqueue({
        eventKey: `promotion:${event.params.barId}:${event.params.promotionId}`, kind: 'barPromotions',
        title: after.title, body: after.body,
        expiresAt: Math.min(millis(after.expiresAt), Date.parse(event.time) + 24 * 60 * MINUTE),
        data: { barId: event.params.barId, promotionId: event.params.promotionId },
    });
});