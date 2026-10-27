import { createHash, randomUUID } from 'node:crypto';

export type RecordData = Record<string, any>;
export type NotificationKind = 'matchReminder' | 'liveResults' | 'newBarNearby' | 'barPromotions';
export const MINUTE = 60_000;
export const WINDOW = 5 * MINUTE;
export const PAGE_SIZE = 100;
export const MAX_TOKENS = 300;
export const hash = (value: string): string => createHash('sha256').update(value).digest('hex');

export function millis(value: unknown): number {
    try {
        const result = value instanceof Date ? value.getTime()
            : value && typeof (value as any).toMillis === 'function' ? (value as any).toMillis()
                : typeof value === 'number' ? value : NaN;
        return Number.isFinite(result) ? result : NaN;
    } catch { return NaN; }
}

export function preferences(user: RecordData): Record<NotificationKind, number | boolean> {
    const value = user.preferences?.notifications;
    const reminder = value?.matchReminder;
    return {
        matchReminder: reminder === undefined ? 60 : [0, 30, 60, 120].includes(reminder) ? reminder : 0,
        liveResults: value?.liveResults === undefined ? true : value.liveResults === true,
        newBarNearby: value?.newBarNearby === true,
        barPromotions: value?.barPromotions === true,
    };
}

export function reminderEligible(match: RecordData, user: RecordData, now: number, lead?: number): boolean {
    const minutes = preferences(user).matchReminder;
    const start = millis(match.timestamp);
    const due = start - Number(minutes) * MINUTE;
    return typeof minutes === 'number' && minutes > 0 && (lead === undefined || minutes === lead)
        && match.status === 'scheduled' && match.timeConfirmed === true && !match.duplicateOf
        && !match.cancelled && !match.deleted && categoryEligible(match, user) && Number.isFinite(start) && start > now
        && now >= due && now < due + WINDOW;
}

export function categoryEligible(match: RecordData, user: RecordData): boolean {
    const category = user.preferences?.display?.defaultCategory;
    return !category || category === 'all' || category === match.category;
}

function validScore(value: unknown): boolean {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export function resultEligible(before: RecordData, after: RecordData, now: number): boolean {
    const start = millis(after.timestamp);
    return !after.duplicateOf && !after.cancelled && !after.deleted && after.timeConfirmed === true
        && (after.status === 'live' || after.status === 'finished')
        && ['scheduled', 'live', 'finished'].includes(before.status) && !before.duplicateOf
        && Number.isFinite(start) && start <= now && now - start <= 4 * 60 * MINUTE
        && millis(before.timestamp) === start
        && validScore(after.homeScore) && validScore(after.awayScore)
        && ((after.status === 'finished' && before.status !== 'finished')
            || (after.status === 'live' && before.status !== 'finished'
                && (after.homeScore > (before.homeScore ?? 0) || after.awayScore > (before.awayScore ?? 0))));
}

export function coordinates(value: RecordData): { latitude: number; longitude: number } | null {
    const latitude = value.latitude;
    const longitude = value.longitude;
    return typeof latitude === 'number' && typeof longitude === 'number'
        && Number.isFinite(latitude) && Number.isFinite(longitude)
        && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 ? { latitude, longitude } : null;
}

export function paidBar(bar: RecordData): boolean {
    return bar.source === 'verified' && typeof bar.ownerId === 'string' && !!bar.ownerId.trim()
        && bar.tier === 'premium' && !bar.deleted && !!coordinates(bar.location ?? bar);
}

export function newlyVerified(before: RecordData, after: RecordData): boolean {
    return (before.source !== 'verified' || !before.ownerId) && paidBar(after)
        && Number.isFinite(millis(after.verifiedAt));
}

export function nearbyEligible(user: RecordData, bar: RecordData, kind: 'newBarNearby' | 'barPromotions', now: number): boolean {
    if (!preferences(user)[kind] || !paidBar(bar)) return false;
    const location = user.notificationLocation;
    if (!location || location.consent !== 'foreground') return false;
    const updated = millis(location.updatedAt);
    if (!Number.isFinite(updated) || updated > now || now - updated > 30 * 86400_000) return false;
    const origin = coordinates(location);
    const target = coordinates(bar.location ?? bar);
    const radius = user.preferences?.display?.searchRadius ?? 2000;
    if (!origin || !target || ![500, 1000, 2000, 5000].includes(radius)) return false;
    const radians = (degrees: number): number => degrees * Math.PI / 180;
    const latitudeDelta = radians(target.latitude - origin.latitude);
    const longitudeDelta = radians(target.longitude - origin.longitude);
    const haversine = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(radians(origin.latitude))
        * Math.cos(radians(target.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
    return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, haversine))) <= radius;
}

export function promotionEligible(promotion: RecordData, bar: RecordData, now: number): boolean {
    return paidBar(bar) && promotion.status === 'published'
        && typeof promotion.title === 'string' && promotion.title.trim().length > 0 && promotion.title.length <= 120
        && typeof promotion.body === 'string' && promotion.body.trim().length > 0 && promotion.body.length <= 1000
        && millis(promotion.expiresAt) > now && !promotion.deleted;
}

export interface PushToken { id: string; token: string; platform: string }
export function validPushToken(value: RecordData): boolean {
    return typeof value.token === 'string' && /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/.test(value.token)
        && ['ios', 'android'].includes(value.platform) && Number.isFinite(millis(value.updatedAt));
}

export interface Notice {
    eventKey: string;
    kind: NotificationKind;
    title: string;
    body: string;
    expiresAt: number;
    data: RecordData;
}
export interface DeliveryItem {
    tokenId: string;
    tokenHash: string;
    state: 'sending' | 'accepted' | 'retry' | 'done' | 'unknown' | 'failed';
    ticket?: string;
    receiptAfter?: number;
    receiptUntil?: number;
    attempts: number;
}
export interface DeliveryLedger {
    notice: Notice;
    state: 'active' | 'done';
    lease: string;
    leaseUntil: number;
    nextAttemptAt: number;
    items: Record<string, DeliveryItem>;
    expiresAt: number;
}
export interface DeliveryStore {
    claim(uid: string, notice: Notice, owner: string, now: number): Promise<DeliveryLedger | null>;
    save(uid: string, ledger: DeliveryLedger): Promise<void>;
    tokens(uid: string): Promise<PushToken[]>;
    removeToken(uid: string, tokenId: string, expectedHash: string): Promise<void>;
}
export type Fetcher = (url: string, init: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>;
const SEND_URL = 'https://exp.host/--/api/v2/push/send';
const RECEIPT_URL = 'https://exp.host/--/api/v2/push/getReceipts';

async function request(fetcher: Fetcher, url: string, body: unknown): Promise<{ status: number; data?: any }> {
    try {
        const response = await fetcher(url, {
            method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(body), signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) return { status: response.status };
        const result = await response.json();
        return { status: response.status, data: result?.data };
    } catch { return { status: 0 }; }
}

export async function deliver(
    store: DeliveryStore, uid: string, notice: Notice,
    eligible: () => Promise<boolean>, fetcher: Fetcher = fetch, now: () => number = Date.now,
): Promise<void> {
    if (notice.expiresAt <= now() || !await eligible()) return;
    const ledger = await store.claim(uid, notice, randomUUID(), now());
    if (!ledger) return;
    const tokens = (await store.tokens(uid)).slice(0, MAX_TOKENS);
    const unique = [...new Map(tokens.map(token => [hash(token.token), token])).values()];
    const candidates = unique.filter(token => {
        const item = ledger.items[hash(token.token)];
        return !item || (item.state === 'retry' && item.attempts < 3);
    });
    for (let offset = 0; offset < candidates.length; offset += PAGE_SIZE) {
        if (notice.expiresAt <= now() || !await eligible()) break;
        const currentTokens = new Set((await store.tokens(uid)).map(token => hash(token.token)));
        const batch = candidates.slice(offset, offset + PAGE_SIZE).filter(token => currentTokens.has(hash(token.token)));
        if (!batch.length) continue;
        for (const token of batch) {
            const key = hash(token.token);
            ledger.items[key] = {
                tokenId: token.id, tokenHash: key, state: 'sending', attempts: (ledger.items[key]?.attempts ?? 0) + 1,
            };
        }
        await store.save(uid, ledger);
        const response = await request(fetcher, SEND_URL, batch.map(token => ({
            to: token.token, title: notice.title, body: notice.body, data: notice.data,
            sound: 'default', channelId: 'trobar', ttl: Math.max(1, Math.floor((notice.expiresAt - now()) / 1000)),
        })));
        const tickets = Array.isArray(response.data) && response.data.length === batch.length ? response.data : null;
        for (let index = 0; index < batch.length; index++) {
            const item = ledger.items[hash(batch[index].token)];
            const ticket = tickets?.[index];
            if (ticket?.status === 'ok' && typeof ticket.id === 'string') {
                item.state = 'accepted';
                item.ticket = ticket.id;
                item.receiptAfter = now() + 15 * MINUTE;
                item.receiptUntil = now() + 24 * 60 * MINUTE;
            } else if (ticket?.details?.error === 'DeviceNotRegistered') {
                await store.removeToken(uid, item.tokenId, item.tokenHash);
                item.state = 'failed';
            } else if (response.status === 429 || ticket?.details?.error === 'MessageRateExceeded') {
                item.state = item.attempts < 3 ? 'retry' : 'failed';
            } else {
                item.state = ticket?.status === 'error' || (response.status >= 400 && response.status < 500) ? 'failed' : 'unknown';
            }
        }
        await store.save(uid, ledger);
    }
    ledger.state = Object.values(ledger.items).some(item => item.state === 'retry') ? 'active' : 'done';
    ledger.nextAttemptAt = now() + MINUTE;
    ledger.leaseUntil = 0;
    await store.save(uid, ledger);
}

export async function checkReceipts(store: DeliveryStore, uid: string, ledger: DeliveryLedger, fetcher: Fetcher = fetch, now = Date.now()): Promise<void> {
    const pending = Object.values(ledger.items).filter(item => item.state === 'accepted' && (item.receiptAfter ?? 0) <= now);
    for (let offset = 0; offset < pending.length; offset += PAGE_SIZE) {
        const batch = pending.slice(offset, offset + PAGE_SIZE);
        const response = await request(fetcher, RECEIPT_URL, { ids: batch.map(item => item.ticket) });
        for (const item of batch) {
            const receipt = response.data?.[item.ticket!];
            if (receipt?.status === 'ok') item.state = 'done';
            else if (receipt?.status === 'error') {
                if (receipt.details?.error === 'DeviceNotRegistered') await store.removeToken(uid, item.tokenId, item.tokenHash);
                item.state = 'failed';
            } else if ((item.receiptUntil ?? 0) <= now) item.state = 'unknown';
            else item.receiptAfter = now + 15 * MINUTE;
        }
    }
    ledger.leaseUntil = 0;
    await store.save(uid, ledger);
}