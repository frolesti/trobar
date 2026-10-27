import { Bar } from '../models/Bar';
import { Match } from '../models/Match';

type BroadcastBar = Pick<Bar, 'id' | 'source' | 'ownerId' | 'verifiedAt' | 'broadcastingMatches'>;

export function isRegisteredBar(bar: BroadcastBar): boolean {
    return !!bar.ownerId || !!bar.verifiedAt || bar.source === 'verified' || (bar.source !== 'user_reported' && !bar.id.startsWith('osm_'));
}

export function nextBroadcastMatchId(matches: Match[], now = Date.now()): string | null {
    return matches.filter(match => match.date.getTime() > now && match.status !== 'postponed' && match.status !== 'finished')
        .sort((first, second) => first.date.getTime() - second.date.getTime())[0]?.id || null;
}

export function barShowsMatch(bar: BroadcastBar, matchId: string, nextMatchId: string | null): boolean {
    return isRegisteredBar(bar) && (matchId === nextMatchId || !!bar.broadcastingMatches?.includes(matchId));
}