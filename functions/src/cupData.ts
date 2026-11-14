import type { Fixture } from './matchSync';
import { normalizeStage } from './stageData';

export type CupSource = 'esp.copa_del_rey' | 'esp.copa_de_la_reina';
export type CupRecord = {
    eventId: string;
    date: string;
    home: string;
    away: string;
    homeId?: string;
    awayId?: string;
    stage?: string;
    homeBadge?: string;
    awayBadge?: string;
    homeScore?: number;
    awayScore?: number;
};

export function cupSource(name: string): CupSource | undefined {
    if (/copa.*reina/i.test(name)) return 'esp.copa_de_la_reina';
    if (/copa.*rey/i.test(name)) return 'esp.copa_del_rey';
    return undefined;
}

export function cupTeamKey(name: string): string {
    const key = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        .replace(/\b(fc|cf|cd|ud|ad|women|femenino|femenina|femeni|wfc)\b/g, '').replace(/[^a-z0-9]/g, '');
    const aliases: Record<string, string> = {
        albacetebalompie: 'albacete', racingdesantander: 'racingsantander',
        clubatleticodemadrid: 'atleticomadrid', atleticodemadrid: 'atleticomadrid',
        athleticclub: 'athleticbilbao', athleticdebilbao: 'athleticbilbao',
        athleticclubbilbao: 'athleticbilbao', deportivoalaves: 'alaves',
    };
    return aliases[key] || key;
}

function badge(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    try { return new URL(value).protocol === 'https:' ? value : undefined; }
    catch { return undefined; }
}

export function score(value: unknown): number | undefined {
    if (typeof value !== 'number' && !(typeof value === 'string' && /^\d+$/.test(value))) return undefined;
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0 ? number : undefined;
}

function teamBadge(team: any, source?: CupSource): string | undefined {
    const provided = badge(team.logo);
    if (provided) return provided;
    // ESPN's Spanish Guadalajara record has no logo; use the club's published crest.
    if (source === 'esp.copa_del_rey' && String(team.id) === '11484' && cupTeamKey(team.displayName) === 'guadalajara') {
        return 'https://www.cdguadalajara.es/wp-content/uploads/2025/06/1-Escudo-principalcontorno-150x144.png';
    }
    return undefined;
}

export function cupRecords(events: any[], source?: CupSource): CupRecord[] {
    return events.flatMap(event => {
        const competition = event.competitions?.[0];
        const home = competition?.competitors?.find((team: any) => team.homeAway === 'home');
        const away = competition?.competitors?.find((team: any) => team.homeAway === 'away');
        if (!event.id || !Number.isFinite(Date.parse(event.date)) || !home?.team?.displayName || !away?.team?.displayName) return [];
        const completed = (competition.status || event.status)?.type?.completed === true;
        const homeScore = completed ? score(home.score) : undefined;
        const awayScore = completed ? score(away.score) : undefined;
        const stage = normalizeStage(event.season?.slug);
        return [{
            eventId: String(event.id), date: event.date, home: home.team.displayName, away: away.team.displayName,
            ...(home.team.id ? { homeId: String(home.team.id) } : {}),
            ...(away.team.id ? { awayId: String(away.team.id) } : {}),
            ...(stage ? { stage } : {}),
            homeBadge: teamBadge(home.team, source), awayBadge: teamBadge(away.team, source),
            ...(homeScore !== undefined && awayScore !== undefined ? { homeScore, awayScore } : {}),
        }];
    });
}

export function matchingCupRecord(date: string, home: string, away: string, records: CupRecord[]): CupRecord | undefined {
    const candidates = records.filter(record => record.date.slice(0, 10) === date.slice(0, 10)
        && cupTeamKey(record.home) === cupTeamKey(home) && cupTeamKey(record.away) === cupTeamKey(away));
    return candidates.length === 1 ? candidates[0] : undefined;
}

export function applyCupRecord(fixture: Fixture, record: CupRecord): void {
    if (!normalizeStage(fixture.stage) && record.stage) {
        fixture.stage = record.stage;
        fixture.stageSource = 'espn';
        fixture.stageSourceEventId = record.eventId;
    }
    fixture.homeTeam.crest ||= record.homeBadge;
    fixture.awayTeam.crest ||= record.awayBadge;
    if (!['CANCELLED', 'POSTPONED', 'SUSPENDED'].includes(fixture.status)
        && (!Number.isInteger(fixture.score?.fullTime?.home) || !Number.isInteger(fixture.score?.fullTime?.away))
        && record.homeScore !== undefined && record.awayScore !== undefined) {
        fixture.score = { fullTime: { home: record.homeScore, away: record.awayScore } };
        fixture.scoreSource = 'espn-cup';
        fixture.status = 'FINISHED';
    }
}

export async function fetchCupRecords(source: CupSource, year: string): Promise<CupRecord[]> {
    if (!/^\d{4}$/.test(year)) throw new Error('Invalid cup year');
    const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${source}/scoreboard?dates=${year}&limit=1000`, {
        signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`Cup provider HTTP ${response.status}`);
    const body = await response.json();
    if (!Array.isArray(body.events) || body.events.length >= 1000) throw new Error('Invalid or truncated cup provider response');
    return cupRecords(body.events, source);
}
