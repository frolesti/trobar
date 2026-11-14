import * as admin from 'firebase-admin';
import { isDeepStrictEqual } from 'node:util';
import { isBarcelonaFixture, parseCalendar, SyncConfig } from './matchSync';
import { stageTeamKey } from './stageData';
import { score } from './cupData';

type LiveEvent = {
    id?: string;
    date?: string;
    status?: { type?: { state?: string; completed?: boolean; name?: string } };
    competitions?: { status?: LiveEvent['status']; competitors?: {
        homeAway?: string; team?: { displayName?: string }; score?: unknown;
    }[] }[];
};
type LiveResult = { status: string; homeScore: number | null; awayScore: number | null; eventId: string };

export function liveSource(name: string, category: string): string {
    if (/supercopa|super.?cup/i.test(name)) return category === 'femenino' ? 'women-calendar' : 'esp.super_cup';
    if (/reina/i.test(name)) return 'esp.copa_de_la_reina';
    if (/copa.*(?:rey|rei)/i.test(name)) return 'esp.copa_del_rey';
    if (/champion|uwcl/i.test(name)) return category === 'femenino' ? 'uefa.wchampions' : 'uefa.champions';
    if (/liga|primera division/i.test(name)) return category === 'femenino' ? 'esp.w.1' : 'esp.1';
    throw new Error(`Unsupported live competition: ${name}`);
}

export function liveResult(event: LiveEvent): LiveResult | null {
    const competition = event.competitions?.[0];
    const status = (competition?.status || event.status)?.type;
    if (!event.id || !status) throw new Error('Invalid live event');
    if (/POSTPONED|CANCELED|CANCELLED|SUSPENDED/.test(status.name || '')) {
        return { status: 'postponed', homeScore: null, awayScore: null, eventId: event.id };
    }
    if (!status.completed && status.state !== 'in') return null;
    const homeScore = score(competition?.competitors?.find(team => team.homeAway === 'home')?.score) ?? null;
    const awayScore = score(competition?.competitors?.find(team => team.homeAway === 'away')?.score) ?? null;
    if (homeScore === null || awayScore === null) throw new Error(`Missing live score: ${event.id}`);
    return { status: status.completed ? 'finished' : 'live', homeScore, awayScore, eventId: event.id };
}

export async function syncLiveMatches(db: admin.firestore.Firestore, config: Pick<SyncConfig, 'womenCalendarUrl'>, now = Date.now()) {
    const snapshot = await db.collection('matches')
        .where('timestamp', '>=', admin.firestore.Timestamp.fromMillis(now - 4 * 3600_000))
        .where('timestamp', '<=', admin.firestore.Timestamp.fromMillis(now)).get();
    const candidates = snapshot.docs.filter(document => {
        const data = document.data();
        return !data.duplicateOf && data.timeConfirmed !== false && !['finished', 'postponed'].includes(data.status)
            && typeof data.homeTeam?.name === 'string' && typeof data.awayTeam?.name === 'string'
            && isBarcelonaFixture({ homeTeam: data.homeTeam, awayTeam: data.awayTeam });
    });
    if (!candidates.length) {
        console.info('Live sync idle: no Barcelona match in its playing window');
        return { active: 0, updated: 0, finished: 0 };
    }
    const requests = new Map<string, typeof candidates>();
    const failedSources: string[] = [];
    for (const document of candidates) {
        try {
            const data = document.data();
            const category = data.category || (/women|femen|liga f|uwcl|reina/i.test(data.competition?.name || '') ? 'femenino' : 'masculino');
            const source = liveSource(data.competition?.name || '', category);
            const key = `${source}|${data.timestamp.toDate().toISOString().slice(0, 10)}`;
            requests.set(key, [...(requests.get(key) || []), document]);
        } catch (error) {
            failedSources.push(`competition:${document.id}`);
            console.error('Live competition unavailable', { matchId: document.id, error });
        }
    }
    let updated = 0;
    let finished = 0;
    for (const [key, documents] of requests) {
        try {
            const [source, day] = key.split('|');
            const url = source === 'women-calendar' ? config.womenCalendarUrl
                : `https://site.api.espn.com/apis/site/v2/sports/soccer/${source}/scoreboard?dates=${day.replace(/-/g, '')}&limit=100`;
            const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
            if (!response.ok) throw new Error(`Live provider HTTP ${response.status}`);
            let events: LiveEvent[];
            if (source === 'women-calendar') {
                events = parseCalendar(await response.text(), 'femenino').map(fixture => ({
                    id: String(fixture.id), date: fixture.utcDate,
                    status: { type: { completed: fixture.status === 'FINISHED', state: 'pre', name: fixture.status } },
                    competitions: [{ competitors: [
                        { homeAway: 'home', team: { displayName: fixture.homeTeam.name }, score: fixture.score?.fullTime?.home },
                        { homeAway: 'away', team: { displayName: fixture.awayTeam.name }, score: fixture.score?.fullTime?.away },
                    ] }],
                }));
            } else {
                const body: { events?: LiveEvent[] } = await response.json();
                if (!Array.isArray(body.events) || body.events.length >= 100) throw new Error('Invalid or truncated live response');
                events = body.events;
            }
            for (const document of documents) {
                const data = document.data();
                const matches = events.filter(event => event.date?.slice(0, 10) === day &&
                    stageTeamKey(event.competitions?.[0]?.competitors?.find(team => team.homeAway === 'home')?.team?.displayName || '') === stageTeamKey(data.homeTeam.name) &&
                    stageTeamKey(event.competitions?.[0]?.competitors?.find(team => team.homeAway === 'away')?.team?.displayName || '') === stageTeamKey(data.awayTeam.name));
                if (matches.length !== 1) throw new Error(`Missing or ambiguous live fixture: ${document.id}`);
                const result = liveResult(matches[0]);
                if (!result) continue;
                const changed = await db.runTransaction(async transaction => {
                    const latest = (await transaction.get(document.ref)).data();
                    if (!latest || latest.duplicateOf || latest.timestamp.toMillis() !== data.timestamp.toMillis()
                        || latest.status === 'finished' || latest.status === 'postponed') return false;
                    const patch = {
                        status: result.status,
                        homeScore: result.homeScore ?? latest.homeScore ?? null,
                        awayScore: result.awayScore ?? latest.awayScore ?? null,
                        scorePending: false, liveSource: source, liveSourceEventId: result.eventId,
                    };
                    if (Object.entries(patch).every(([field, value]) => isDeepStrictEqual(latest[field], value))) return false;
                    transaction.set(document.ref, { ...patch, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
                    return latest.status !== 'finished' && result.status === 'finished' ? 'finished' : true;
                });
                if (changed) updated++;
                if (changed === 'finished') finished++;
            }
        } catch (error) {
            failedSources.push(key);
            console.error('Live match source failed', { source: key, error });
        }
    }
    await db.doc('system/live_sync_status').set({
        lastAttempt: admin.firestore.FieldValue.serverTimestamp(), active: candidates.length, updated, finished, failedSources,
    }, { merge: true });
    if (failedSources.length) throw new Error(`Live sync incomplete: ${failedSources.join(', ')}`);
    console.info('Live sync completed', { active: candidates.length, updated, finished });
    return { active: candidates.length, updated, finished };
}
