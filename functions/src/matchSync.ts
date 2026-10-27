import * as admin from 'firebase-admin';
import * as ical from 'node-ical';
import { createHash } from 'node:crypto';

export interface SyncConfig {
    footballDataApiKey: string;
    womenCalendarUrl: string;
    menCalendarUrl: string;
    apiFootballKey?: string;
}

type Category = 'masculino' | 'femenino';
type Team = { id: string | number; name: string; shortName?: string; crest?: string | null };
export interface Fixture {
    id: string | number;
    utcDate: string;
    status: string;
    competition: { id: string | number; name: string; emblem?: string | null };
    homeTeam: Team;
    awayTeam: Team;
    score?: { fullTime?: { home: number | null; away: number | null } };
    category: Category;
    stage?: string;
    group?: string | null;
    round?: string;
    timeConfirmed?: boolean;
}

export function calendarStage(text: string): string | undefined {
    const value = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (/semi.?final/.test(value)) return 'SEMI_FINALS';
    if (/quarter.?final|quarts|cuartos/.test(value)) return 'QUARTER_FINALS';
    if (/round of 32|last 32|setzens|dieciseisavos|1\/16/.test(value)) return 'LAST_32';
    if (/round of 16|last 16|vuitens|octavos|1\/8/.test(value)) return 'LAST_16';
    if (/\bfinal\b/.test(value)) return 'FINAL';
    if (/group stage|fase de grup|fase de grupo/.test(value)) return 'GROUP_STAGE';
    if (/league phase|fase de lliga|fase de liga/.test(value)) return 'LEAGUE_STAGE';
    if (/play.?off/.test(value)) return 'PLAYOFFS';
    if (/qualif|previa/.test(value)) return 'QUALIFICATION';
    return undefined;
}

export function parseCalendar(text: string, category: Category): Fixture[] {
    if (!text.includes('BEGIN:VCALENDAR')) throw new Error('Invalid calendar response');
    const events = Object.values(ical.sync.parseICS(text));
    const fixtures: Fixture[] = [];
    for (const event of events) {
        if (!event || event.type !== 'VEVENT' || !event.start || !event.uid) continue;
        const summary = String(event.summary || '');
        const isMen = category === 'masculino';
        if (isMen && !/\[Copa\]/i.test(summary)) continue;
        const score = summary.match(/\((\d+)\s*-\s*(\d+)\)\s*$/);
        const names = summary.replace(/\[[^\]]*\]/g, '').replace(/\(\d+\s*-\s*\d+\)\s*$/, '').trim().split(/\s+-\s+/);
        if (names.length !== 2) continue;
        const details = `${summary} ${event.description || ''} ${event.location || ''}`.toLowerCase();
        const competition = isMen ? { id: 'ics_copa_del_rey', name: 'Copa del Rey' }
            : /\[(cl|ucl|uwcl)\]|champion/.test(details) ? { id: 'ics_uwcl', name: "UEFA Women's Champions League" }
            : /super/.test(details) ? { id: 'ics_supercopa_f', name: 'Supercopa Femenina' }
            : /copa|cup|reina|queen/.test(details) ? { id: 'ics_copa_reina', name: 'Copa de la Reina' }
            : { id: 'ics_ligaf', name: 'Liga F' };
        const team = (rawName: string): Team => {
            const name = rawName.replace(/ Women$/i, '').trim();
            return { id: `${isMen ? 'ics_m_' : 'ics_'}${name.substring(0, 12).replace(/\s/g, '_').toLowerCase()}`, name, shortName: name };
        };
        fixtures.push({
            id: `${isMen ? 'ics_copa_' : 'ics_'}${event.uid.replace(/@.*$/, '').substring(0, 20)}`,
            utcDate: event.start.toISOString(),
            status: event.status === 'CANCELLED' ? 'CANCELLED' : score ? 'FINISHED' : 'SCHEDULED',
            competition,
            homeTeam: team(names[0]),
            awayTeam: team(names[1]),
            score: { fullTime: { home: score ? Number(score[1]) : null, away: score ? Number(score[2]) : null } },
            category,
            stage: calendarStage(details),
            timeConfirmed: !(event.start as Date & { dateOnly?: boolean }).dateOnly,
        });
    }
    return fixtures;
}

export function resultUpdate(fixture: Fixture, previous: admin.firestore.DocumentData = {}) {
    const fullTime = fixture.score?.fullTime;
    const hasScore = Number.isInteger(fullTime?.home) && Number.isInteger(fullTime?.away)
        && fullTime!.home! >= 0 && fullTime!.away! >= 0;
    const status = ['FINISHED', 'AWARDED'].includes(fixture.status) ? 'finished'
        : ['IN_PLAY', 'PAUSED', 'LIVE', 'EXTRA_TIME', 'PENALTY_SHOOTOUT'].includes(fixture.status) ? 'live'
        : ['POSTPONED', 'SUSPENDED', 'CANCELLED'].includes(fixture.status) ? 'postponed' : 'scheduled';
    if (!hasScore && previous.status === 'finished' && Number.isInteger(previous.homeScore) && Number.isInteger(previous.awayScore)) {
        return { status: previous.status, homeScore: previous.homeScore, awayScore: previous.awayScore, scorePending: false };
    }
    return {
        status,
        homeScore: hasScore ? fullTime!.home : previous.homeScore ?? null,
        awayScore: hasScore ? fullTime!.away : previous.awayScore ?? null,
        scorePending: !hasScore && Date.parse(fixture.utcDate) < Date.now() - 3 * 60 * 60 * 1000 && status !== 'postponed',
    };
}

async function download(url: string, headers: Record<string, string> = {}): Promise<Response> {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`Provider HTTP ${response.status} (${new URL(url).hostname})`);
    return response;
}

async function supplementScores(fixtures: Fixture[], key: string): Promise<void> {
    const missing = fixtures.filter(fixture => !Number.isInteger(fixture.score?.fullTime?.home)
        && Date.parse(fixture.utcDate) > Date.now() - 60 * 86400_000
        && Date.parse(fixture.utcDate) < Date.now() - 3 * 60 * 60 * 1000);
    const seasons = [...new Set(missing.map(fixture => {
        const date = new Date(fixture.utcDate);
        return date.getUTCMonth() >= 6 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
    }))];
    for (const season of seasons) {
        const response = await download(`https://v3.football.api-sports.io/fixtures?team=1918&season=${season}`, { 'x-apisports-key': key });
        const data = await response.json();
        if (!Array.isArray(data.response) || Object.keys(data.errors || {}).length) throw new Error('Score provider rejected request');
        for (const fixture of missing) {
            const sameDay = data.response.filter((candidate: any) =>
                candidate.fixture.date.slice(0, 10) === fixture.utcDate.slice(0, 10)
                && ['FT', 'AET', 'PEN'].includes(candidate.fixture.status.short)
                && (candidate.teams.home.id === 1918) === /barcelona/i.test(fixture.homeTeam.name));
            if (sameDay.length !== 1) continue;
            const candidate = sameDay[0];
            if (!Number.isInteger(candidate.goals.home) || !Number.isInteger(candidate.goals.away)) continue;
            fixture.score = { fullTime: { home: candidate.goals.home, away: candidate.goals.away } };
            fixture.status = 'FINISHED';
        }
    }
}

export function copaFixtureIdentity(date: string, home: string, away: string): string {
    const normalize = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return `copa_fixture_${createHash('sha256').update([date.slice(0, 10), normalize(home), normalize(away)].join('|')).digest('hex').slice(0, 24)}`;
}

export function fixtureIdentity(date: string, home: string, away: string, competition: string, category: string): string {
    const normalize = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        .replace(/\b(fc|cf|afc|women|femenino|femenina|femeni|wfc)\b/g, '').replace(/[^a-z0-9]/g, '');
    const competitionKey = /champion|uwcl|ucl/i.test(competition) ? 'champions'
        : /copa.*reina|queen/i.test(competition) ? 'copareina'
        : /copa.*rey|king/i.test(competition) ? 'coparey' : normalize(competition);
    return `fixture_${createHash('sha256').update([category, competitionKey, date.slice(0, 10), normalize(home), normalize(away)].join('|')).digest('hex').slice(0, 24)}`;
}

export async function reconcileCopaDuplicates(db: admin.firestore.Firestore): Promise<void> {
    const snapshot = await db.collection('matches').get();
    const groups = new Map<string, admin.firestore.QueryDocumentSnapshot[]>();
    for (const document of snapshot.docs) {
        const data = document.data();
        if (!data.timestamp?.toDate || !data.homeTeam?.name || !data.awayTeam?.name || !data.competition?.name) continue;
        const category = data.category || (/women|femen|liga f|uwcl|reina/i.test(data.competition.name) ? 'femenino' : 'masculino');
        const key = fixtureIdentity(data.timestamp.toDate().toISOString(), data.homeTeam.name, data.awayTeam.name, data.competition.name, category);
        groups.set(key, [...(groups.get(key) || []), document]);
    }
    const entries = [...groups.entries()];
    for (let offset = 0; offset < entries.length; offset += 50) {
        await db.runTransaction(async transaction => {
            const mappingRef = db.doc('system/id_mappings');
            const mapping = (await transaction.get(mappingRef)).data();
            if (!mapping) throw new Error('Missing existing match ID mappings');
            for (const [key, documents] of entries.slice(offset, offset + 50)) {
                documents.sort((first, second) => Number(first.id) - Number(second.id) || first.id.localeCompare(second.id));
                const canonical = documents[0];
                mapping.matches[key] = Number(canonical.id);
                const canonicalData = canonical.data();
                const scored = documents.find(document => Number.isInteger(document.data().homeScore) && Number.isInteger(document.data().awayScore) && document.data().status === 'finished');
                if (scored && (!Number.isInteger(canonicalData.homeScore) || !Number.isInteger(canonicalData.awayScore))) {
                    const result = scored.data();
                    transaction.set(canonical.ref, { homeScore: result.homeScore, awayScore: result.awayScore, status: result.status }, { merge: true });
                }
                for (const document of documents) {
                    const data = document.data();
                    if (data.apiId != null) mapping.matches[String(data.apiId)] = Number(canonical.id);
                    if (data.competition.name === 'Copa del Rey') mapping.matches[copaFixtureIdentity(data.timestamp.toDate().toISOString(), data.homeTeam.name, data.awayTeam.name)] = Number(canonical.id);
                    if (document.id !== canonical.id && document.data().duplicateOf !== canonical.id) {
                        transaction.set(document.ref, { duplicateOf: canonical.id }, { merge: true });
                    }
                }
            }
            transaction.set(mappingRef, mapping);
        });
    }
}

export async function syncMatches(db: admin.firestore.Firestore, config: SyncConfig): Promise<void> {
    if (!config.footballDataApiKey || !config.womenCalendarUrl || !config.menCalendarUrl) {
        throw new Error('MATCH_SYNC_CONFIG requires footballDataApiKey, womenCalendarUrl and menCalendarUrl');
    }
    const metaRef = db.doc('system/sync_status');
    const acquired = await db.runTransaction(async transaction => {
        const snapshot = await transaction.get(metaRef);
        if ((snapshot.data()?.leaseUntil?.toMillis() || 0) > Date.now()) return false;
        transaction.set(metaRef, { leaseUntil: admin.firestore.Timestamp.fromMillis(Date.now() + 9 * 60_000) }, { merge: true });
        return true;
    });
    if (!acquired) return;
    const errors: string[] = [];
    let count = 0;
    try {
        await reconcileCopaDuplicates(db);
        const sources: [string, () => Promise<Fixture[]>][] = [
            ['football-data', async () => {
                const response = await download('https://api.football-data.org/v4/teams/81/matches?limit=200', { 'X-Auth-Token': config.footballDataApiKey });
                const data = await response.json();
                if (!Array.isArray(data.matches) || !data.matches.length) throw new Error('No fixtures returned');
                return data.matches.map((fixture: Fixture) => ({ ...fixture, category: 'masculino' as Category }));
            }],
            ['women-calendar', async () => parseCalendar(await (await download(config.womenCalendarUrl)).text(), 'femenino')],
            ['men-calendar', async () => parseCalendar(await (await download(config.menCalendarUrl)).text(), 'masculino')],
        ];
        for (const [source, load] of sources) {
            try {
                const fixtures = await load();
                if (!fixtures.length && source !== 'men-calendar') throw new Error('No fixtures returned');
                if (source === 'women-calendar' && config.apiFootballKey) {
                    try { await supplementScores(fixtures, config.apiFootballKey); }
                    catch (error) { errors.push('women-scores'); console.error('Women score provider failed', error); }
                }
                for (let offset = 0; offset < fixtures.length; offset += 50) {
                    await persistFixtures(db, fixtures.slice(offset, offset + 50));
                }
                count += fixtures.length;
            } catch (error) {
                errors.push(source);
                console.error(`Match sync failed: ${source}`, error);
            }
        }
        const overdue = await db.collection('matches').where('timestamp', '>=', admin.firestore.Timestamp.fromMillis(Date.now() - 60 * 86400_000)).get();
        const pendingIds = overdue.docs.filter(snapshot => {
            const data = snapshot.data();
            return !data.duplicateOf && data.timestamp.toMillis() < Date.now() - 3 * 3600_000 && data.status !== 'postponed'
                && (!Number.isInteger(data.homeScore) || !Number.isInteger(data.awayScore));
        }).map(snapshot => snapshot.id);
        if (pendingIds.length) console.error('Matches still missing results', { matchIds: pendingIds });
        await metaRef.set({
            lastAttempt: admin.firestore.FieldValue.serverTimestamp(),
            ...(errors.length ? {} : { lastUpdated: admin.firestore.FieldValue.serverTimestamp() }),
            failedSources: errors,
            pendingResultIds: pendingIds,
            matchCount: count,
            provider: 'scheduled-sync',
        }, { merge: true });
        if (errors.length) throw new Error(`Match sync incomplete: ${errors.join(', ')}`);
    } finally {
        await metaRef.set({ leaseUntil: admin.firestore.FieldValue.delete() }, { merge: true });
    }
}

async function persistFixtures(db: admin.firestore.Firestore, fixtures: Fixture[]): Promise<void> {
    const mapRef = db.doc('system/id_mappings');
    await db.runTransaction(async transaction => {
        const mapSnap = await transaction.get(mapRef);
        const mappings = mapSnap.data() || { competitions: {}, teams: {}, matches: {}, nextCompId: 1, nextTeamId: 1, nextMatchId: 1 };
        const allocate = (kind: 'competitions' | 'teams' | 'matches', counter: string, apiId: string | number): string => {
            const key = String(apiId);
            if (!mappings[kind][key]) mappings[kind][key] = mappings[counter]++;
            return String(mappings[kind][key]);
        };
        const records = fixtures.map(fixture => {
            const key = fixtureIdentity(fixture.utcDate, fixture.homeTeam.name, fixture.awayTeam.name, fixture.competition.name, fixture.category);
            if (!mappings.matches[String(key)] && mappings.matches[String(fixture.id)]) mappings.matches[String(key)] = mappings.matches[String(fixture.id)];
            const id = allocate('matches', 'nextMatchId', key);
            mappings.matches[String(fixture.id)] = Number(id);
            return {
            fixture,
            id,
            comp: allocate('competitions', 'nextCompId', fixture.competition.id),
            home: allocate('teams', 'nextTeamId', fixture.homeTeam.id),
            away: allocate('teams', 'nextTeamId', fixture.awayTeam.id),
        }; });
        const refs = records.map(record => db.doc(`matches/${record.id}`));
        const oldDocs = refs.length ? await transaction.getAll(...refs) : [];
        records.forEach((record, index) => {
            const { fixture, comp, home, away } = record;
            if (!Number.isFinite(Date.parse(fixture.utcDate))) throw new Error('Invalid fixture date');
            const old = oldDocs[index]?.data() || {};
            const team = (input: Team, id: string, previous: any) => ({
                id, name: input.name, shortName: input.shortName || input.name, badge: input.crest || previous?.badge || null,
            });
            const homeTeam = team(fixture.homeTeam, home, old.homeTeam);
            const awayTeam = team(fixture.awayTeam, away, old.awayTeam);
            const competition = { id: comp, name: fixture.competition.name, logo: fixture.competition.emblem || old.competition?.logo || null };
            transaction.set(refs[index], {
                homeTeam, awayTeam, competition, league: comp,
                timestamp: admin.firestore.Timestamp.fromDate(new Date(fixture.utcDate)),
                ...resultUpdate(fixture, old),
                category: fixture.category,
                ...(fixture.stage ? { stage: fixture.stage } : {}),
                ...(fixture.group ? { group: fixture.group } : {}),
                ...(fixture.round ? { round: fixture.round } : {}),
                ...(fixture.timeConfirmed !== undefined ? { timeConfirmed: fixture.timeConfirmed } : {}),
                apiId: fixture.id,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            transaction.set(db.doc(`competitions/${comp}`), { name: competition.name, apiId: fixture.competition.id }, { merge: true });
            transaction.set(db.doc(`teams/${home}`), homeTeam, { merge: true });
            transaction.set(db.doc(`teams/${away}`), awayTeam, { merge: true });
        });
        transaction.set(mapRef, mappings);
    });
}