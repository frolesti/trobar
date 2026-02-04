import { Platform } from 'react-native';
import { executeRequest } from '../api/core';
import { SPORTS_DATA, CompetitionSpec } from '../data/leagues';
import { collection, getDocs, query, where, Timestamp, orderBy, limit as firestoreLimit } from 'firebase/firestore';
import { db } from '../config/firebase';

export interface Match {
    id: string;
    teamHome: string;
    teamAway: string;
    date: Date;
    competition: string;
    location?: string;
}

// We intentionally do NOT hardcode team lists or fixtures.
// Instead we fetch competition-level calendars and derive teams + matchups from them.
// Source: fixtur.es (ics.fixtur.es)

// Important competitions (Spain national + Champions League)

const leagueIcsUrl = (leagueSlug: string) => `https://ics.fixtur.es/v2/league/${leagueSlug}.ics`;

// --- FIRESTORE SYNC SUPPORT ---

// Map slug -> Name (e.g. 'primera-division' -> 'La Liga')
const LEAGUE_SLUG_TO_NAME: Record<string, string> = {};
SPORTS_DATA.forEach(sport => {
    sport.competitions.forEach(comp => {
        LEAGUE_SLUG_TO_NAME[comp.slug] = comp.name;
    });
});

let cachedFirestoreMatches: Match[] | null = null;
let lastFirestoreFetchTime = 0;
const DB_CACHE_DURATION = 1000 * 60 * 60; // 1 Hour

async function fetchMatchesFromFirestore(): Promise<Match[]> {
    try {
        const nowTime = Date.now();
        if (cachedFirestoreMatches && (nowTime - lastFirestoreFetchTime < DB_CACHE_DURATION)) {
            console.log(`📦 [DB CACHE] Returning ${cachedFirestoreMatches.length} matches from memory.`);
            return cachedFirestoreMatches;
        }

        console.log('🔥 (Engine) Querying Firestore "matches" collection...');
        const matchesRef = collection(db, 'matches');
        
        // Filter: Matches from 2 hours ago onwards
        const now = new Date();
        const activeThreshold = new Date(now.getTime() - 2 * 60 * 60 * 1000); // -2h

        const q = query(
            matchesRef, 
            where('date', '>=', Timestamp.fromDate(activeThreshold)),
            orderBy('date', 'asc'),
            firestoreLimit(500) // Safety limit
        );

        const snapshot = await getDocs(q);
        const matches: Match[] = [];

        if (snapshot.empty) {
            console.log('⚠️ Internal database empty or no upcoming matches found.');
            return [];
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            // Data validation
            if (!data.homeTeam || !data.awayTeam || !data.date) return;

            // Resolve proper competition name
            const compName = LEAGUE_SLUG_TO_NAME[data.leagueSlug] || data.leagueSlug || 'Unknown League';

            matches.push({
                id: doc.id,
                teamHome: data.homeTeam,
                teamAway: data.awayTeam,
                date: (data.date as Timestamp).toDate(),
                competition: compName,
                location: data.location || ''
            });
        });

        console.log(`✅ [DB SUCCESS] Loaded ${matches.length} matches from Firestore.`);
        
        // Update cache
        cachedFirestoreMatches = matches;
        lastFirestoreFetchTime = Date.now();

        return matches;
    } catch (error: any) {
        if (error.code === 'permission-denied') {
            console.warn('⚠️ [DB PERMISSION] Could not read from Firestore. Rules are likely blocking access.');
        } else {
            console.error('❌ [DB ERROR]', error);
        }
        return [];
    }
}

// --- CACHE SYSTEM ---
let cachedMatches: Record<string, Match[]> = {};
let lastFetchTime: Record<string, number> = {};
let lastFailTime: Record<string, number> = {};
let localProxyFailed = false; // Circuit breaker for web proxy
const CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 Hours (Calendar doesn't change that often)
const FAILURE_CACHE_DURATION = 1000 * 60 * 15; // 15 min (avoid spam when an ICS is temporarily unavailable)

// Helper to handle CORS on web via Proxy
const getFetchUrl = (icsUrl: string) => {
    // NATIVE (iOS/Android): Fetch directly. No CORS issues, faster performance.
    if (Platform.OS !== 'web') {
        return icsUrl;
    }

    // WEB: Use centralized proxy config or fallback to localhost
    const proxyUrl = process.env.EXPO_PUBLIC_ICS_PROXY || 'http://127.0.0.1:8787/ics';
    return `${proxyUrl}?url=${encodeURIComponent(icsUrl)}`;
};

const mapWithConcurrency = async <T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>): Promise<R[]> => {
    const results: R[] = new Array(items.length);
    let index = 0;

    const worker = async () => {
        while (true) {
            const current = index;
            index += 1;
            if (current >= items.length) return;
            results[current] = await mapper(items[current]);
        }
    };

    const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
    await Promise.all(workers);
    return results;
};

// Simple helper to parse ICS date string (e.g., 20260125T200000Z)
const parseICSDate = (icsDate: string): Date => {
    if (!icsDate) return new Date();
    
    // Format: YYYYMMDDTHHmmSSZ
    const year = parseInt(icsDate.substring(0, 4), 10);
    const month = parseInt(icsDate.substring(4, 6), 10) - 1;
    const day = parseInt(icsDate.substring(6, 8), 10);
    const hour = parseInt(icsDate.substring(9, 11), 10);
    const minute = parseInt(icsDate.substring(11, 13), 10);
    const second = parseInt(icsDate.substring(13, 15), 10);

    return new Date(Date.UTC(year, month, day, hour, minute, second));
};

// --- CONFIGURACIÓ DE NORMALITZACIÓ ---

// Mapeig de noms alternatius o mal escrits a la seva forma canònica.
// Clau: nom en minúscules rebut de l'ICS. Valor: Nom oficial que volem mostrar.
const TEAM_NAME_MAPPINGS: Record<string, string> = {
    'paphos': 'Pafos FC',
    'paphos fc': 'Pafos FC',
    'pafos': 'Pafos FC',
    'atlético de madrid': 'Atlético Madrid',
    'athletic club': 'Athletic Club',
    'fc bayern münchen': 'Bayern München',
    'inter milan': 'Inter',
    'internazionale': 'Inter',
    'sporting cp': 'Sporting Portugal',
};

const cleanTeamName = (name: string) => {
    let cleaned = (name || '').trim();

    // Remove status markers anywhere (not only prefix)
    cleaned = cleaned.replace(/\b(suspended|postponed|canceled|cancelled|delayed)\s*:\s*/gi, '');

    // Remove leading non-letter symbols (warning icons, bullets, etc.)
    cleaned = cleaned.replace(/^[^A-Za-z0-9À-ÿ]+/g, '').trim();

    // Remove suffixes like [CL], [Copa], (0-0)
    cleaned = cleaned.replace(/\[.*?\]/g, '').trim(); // Remove brackets content
    cleaned = cleaned.replace(/\(.*?\)/g, '').trim(); // Remove score parenthesis

    // Collapse whitespace
    cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

    // Comprovació directa al diccionari de mappings
    const lower = cleaned.toLowerCase();
    
    // 1. Mapeig directe (gestiona errors ortogràfics concrets i preferències)
    if (TEAM_NAME_MAPPINGS[lower]) {
        return TEAM_NAME_MAPPINGS[lower];
    }
    
    // 2. Neteja genèrica de sufixos comuns si no hi ha mapeig (Opcional, per neteja general)
    // Ex: "Girona FC" -> "Girona", "Chelsea FC" -> "Chelsea"
    // Però mantenint-ho segur per evitar col·lisions si no es vol.
    // De moment ho deixem sense agressivitat per respectar noms curts, 
    // però el diccionari de dalt mana.

    return cleaned;
};

// Helper to decode text properly (fix "caracters raros" like Ã³)
const decodeICSText = (text: string): string => {
    try {
        // First, check if it looks like UTF-8 bytes interpreted as ISO-8859-1.
        // This is a common pattern for "Ã³" (ó), "Ã©" (é), etc.
        // We can try to "reverse" this by encoding to ISO-8859-1 (binary string) and decoding as UTF-8.
        return decodeURIComponent(escape(text));
    } catch (e) {
        // If that fails (e.g. it was already correct), return original
        return text;
    }
};

const fetchCompetitionMatches = async (spec: CompetitionSpec, forceRefresh = false): Promise<Match[]> => {
    const cacheKey = `league:${spec.slug}`;
    const nowTime = Date.now();
    if (!forceRefresh && cachedMatches[cacheKey] && (nowTime - (lastFetchTime[cacheKey] || 0) < CACHE_DURATION)) {
        return cachedMatches[cacheKey];
    }

    if (!forceRefresh && (nowTime - (lastFailTime[cacheKey] || 0) < FAILURE_CACHE_DURATION)) {
        return cachedMatches[cacheKey] || [];
    }

    const targetUrl = leagueIcsUrl(spec.slug);
    let icsData = '';

    try {
        if (Platform.OS === 'web') {
            // WEB: Attempt 1 - Local Proxy (Preferred)
            if (!localProxyFailed) {
                try {
                    const proxyUrl = getFetchUrl(targetUrl);
                    const response = await fetch(proxyUrl);
                    const text = await response.text();
                    if (response.ok && text.includes('BEGIN:VCALENDAR')) {
                        icsData = decodeICSText(text);
                    } else if (!response.ok) {
                        console.warn(`[MatchService] Proxy returned ${response.status} for ${spec.slug}`);
                    }
                } catch (e) {
                    console.warn(`[MatchService] Local proxy failed for ${spec.slug}. Attempting fallback...`);
                    localProxyFailed = true;
                }
            }

            // NOTE: We intentionally do not use public CORS proxies by default.
            // They are frequently blocked/unreliable and can break the app even when our local proxy works.
            // If you really need them (e.g. web prod without your own proxy), enable:
            //   EXPO_PUBLIC_ENABLE_PUBLIC_ICS_FALLBACKS=1
            const enablePublicFallbacks = String(process.env.EXPO_PUBLIC_ENABLE_PUBLIC_ICS_FALLBACKS || '') === '1';
            if (enablePublicFallbacks && !icsData) {
                // Attempt 2 - Public Proxy (Fallback - allorigins)
                try {
                    console.log(`[MatchService] Trying allorigins fallback for ${spec.slug}`);
                    const fallbackUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`;
                    const res = await fetch(fallbackUrl);
                    if (res.ok) {
                        const json = await res.json();
                        if (json.contents) {
                            icsData = decodeICSText(json.contents);
                        }
                    }
                } catch (fallbackError) {
                    console.warn(`[MatchService] allorigins failed for ${spec.slug}`, fallbackError);
                }

                // Attempt 3 - Public Proxy (Backup - corsproxy.io)
                if (!icsData) {
                    try {
                        console.log(`[MatchService] Trying corsproxy.io fallback for ${spec.slug}`);
                        const backupUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
                        const res = await fetch(backupUrl);
                        if (res.ok) {
                            const text = await res.text();
                            if (text.includes('BEGIN:VCALENDAR')) {
                                icsData = decodeICSText(text);
                            }
                        }
                    } catch (backupError) {
                        console.warn(`[MatchService] corsproxy.io failed for ${spec.slug}`, backupError);
                    }
                }
            }
        } else {
            // NATIVE: Direct fetch
            const response = await fetch(targetUrl);
            if (response.ok) {
                icsData = decodeICSText(await response.text());
            }
        }

        if (!icsData) {
            console.error(`[MatchService] Could not fetch data for ${spec.slug} (Proxy & Fallback failed).`);
            lastFailTime[cacheKey] = nowTime;
            if (!cachedMatches[cacheKey]) {
                cachedMatches[cacheKey] = [];
            }
            return cachedMatches[cacheKey] || [];
        }

        const matches: Match[] = [];
        const events = icsData.split('BEGIN:VEVENT');

        events.forEach((eventBlock) => {
            if (!eventBlock.includes('END:VEVENT')) return;

            const summaryMatch = eventBlock.match(/SUMMARY:(.*)/);
            const startMatch = eventBlock.match(/DTSTART:(.*)/);
            const locationMatch = eventBlock.match(/LOCATION:(.*)/);
            const uidMatch = eventBlock.match(/UID:(.*)/);

            if (!summaryMatch || !startMatch) return;

            const summary = summaryMatch[1].trim();
            const startDateStr = startMatch[1].trim();
            const location = locationMatch ? locationMatch[1].trim() : undefined;
            const id = uidMatch ? uidMatch[1].trim() : Math.random().toString();

            const date = parseICSDate(startDateStr);

            let teamHome = 'Unknown';
            let teamAway = 'Unknown';
            const separators = [' - ', ' vs ', ' v '];
            for (const sep of separators) {
                if (summary.includes(sep)) {
                    const parts = summary.split(sep);
                    teamHome = cleanTeamName(parts[0]);
                    teamAway = cleanTeamName(parts[1]);
                    break;
                }
            }

            if (!teamHome || !teamAway || teamHome === 'Unknown' || teamAway === 'Unknown') return;

            matches.push({
                id,
                teamHome,
                teamAway,
                date,
                competition: spec.name,
                location,
            });
        });

        matches.sort((a, b) => a.date.getTime() - b.date.getTime());

        const now = new Date();
        now.setHours(now.getHours() - 4);
        const finalMatches = matches.filter(m => m.date >= now);

        cachedMatches[cacheKey] = finalMatches;
        lastFetchTime[cacheKey] = Date.now();

        return finalMatches;
    } catch (error) {
        console.error('Failed to fetch competition matches:', error);
        return cachedMatches[cacheKey] || [];
    }
};

// --- MULTI-COMPETITION FETCHING ---

export const fetchAllMatches = async (): Promise<{ matches: Match[], teams: string[], competitions: string[] }> => {
    // 0. Try Internal DB First
    let futureMatches = await fetchMatchesFromFirestore();

    if (futureMatches.length > 0) {
        // If DB has matches, we use them directly.
        // They are already sorted and filtered by date >= now-2h in the query.
        console.log('✅ Using cached matches from internal DB.');
    } else {
        // Fallback: Fetch competition calendars via ICS
        console.log('🌍 DB empty. Fetching from external ICS sources...');
        const concurrency = Platform.OS === 'web' ? 3 : 6;

        // Get all competitions from all sports
        const allCompetitions = SPORTS_DATA.flatMap(sport => sport.competitions);

        const results = await mapWithConcurrency(allCompetitions, concurrency, (spec) => fetchCompetitionMatches(spec));

        // 2. Flatten and Deduplicate
        const allMatches: Match[] = [];
        const seenMatchIds = new Set<string>();

        results.forEach(teamMatches => {
            teamMatches.forEach(filterMatch => {
                // Create a unique ID/fingerprint (Date + Teams) to avoid "Barça vs Madrid" showing twice
                const fingerprint = `${filterMatch.date.getTime()}_${[filterMatch.teamHome, filterMatch.teamAway].sort().join('_')}`;
                
                if (!seenMatchIds.has(fingerprint)) {
                    seenMatchIds.add(fingerprint);
                    allMatches.push(filterMatch);
                }
            });
        });

        // 3. Sort by Date
        allMatches.sort((a, b) => a.date.getTime() - b.date.getTime());

        // 4. Filter for Future Matches ONLY
        const now = new Date();
        const activeThreshold = new Date(now.getTime() - 2 * 60 * 60 * 1000);
        futureMatches = allMatches.filter(m => m.date >= activeThreshold);
    }

    // 5. Extract Unique Lists from FUTURE matches only

    // 5. Extract Unique Lists from FUTURE matches only
    const teamsSet = new Set<string>();
    const compsSet = new Set<string>();

    futureMatches.forEach(m => {
        teamsSet.add(m.teamHome);
        teamsSet.add(m.teamAway);
        compsSet.add(m.competition);
    });

    // Return ALL matches (history + future) for the full list, but the teams/comps
    // lists are restricted to what is actually playable/watchable now/soon.
    // OR: Should we restrict the returned 'matches' too? 
    // The user says: "Els camps selectors... necessito que treguis els equips dels partits futurs"
    // implies the selectors should only have future teams.
    // If we return all matches in 'matches', the client might filter later?
    // Let's return only future matches in 'matches' to be safe and consistent with the app's purpose.
    
    return {
        matches: futureMatches,
        teams: Array.from(teamsSet).sort(),
        competitions: Array.from(compsSet).sort()
    };
};

export const getTeamsFromLeague = async (leagueSlug: string): Promise<string[]> => {
    // Reuse existing logic to fetch matches for a specific league
    // We use the slug as the name temporarily since we only care about the team names
    const matches = await fetchCompetitionMatches({ name: leagueSlug, slug: leagueSlug });
    const teams = new Set<string>();
    matches.forEach(m => {
        teams.add(m.teamHome);
        teams.add(m.teamAway);
    });
    return Array.from(teams).sort();
};

export const getNextMatch = async (competitionFilter?: string, teamFilter?: string): Promise<Match | null> => {
    // Otherwise, search in "All Matches" (or default to Barça if we want to save data, 
    // but user requested ALL matches capability).
    // Let's rely on cached data.
    const { matches } = await fetchAllMatches(); // Takes advantage of internal caching
    
    let filtered = matches;
    if (teamFilter) {
        const tf = teamFilter.toLowerCase();
        filtered = filtered.filter(m => m.teamHome.toLowerCase().includes(tf) || m.teamAway.toLowerCase().includes(tf));
    }
    if (competitionFilter) {
        filtered = filtered.filter(m => m.competition === competitionFilter);
    }

    return filtered.length > 0 ? filtered[0] : null;
};
