import type { Bar } from '../models/Bar';

export function reservationUrl(value: string | undefined): string | null {
    const text = value?.trim();
    if (!text || text.length > 2048) return null;
    try {
        const url = new URL(text);
        if (url.protocol !== 'https:' || url.username || url.password ||
            !/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(url.hostname)) return null;
        return url.href;
    } catch {
        return null;
    }
}

export function isBarFullForMatch(bar: Pick<Bar, 'tier' | 'fullMatchIds'>, matchId?: string): boolean {
    return bar.tier === 'premium' && !!matchId && !!bar.fullMatchIds?.includes(matchId);
}
