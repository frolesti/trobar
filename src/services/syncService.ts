import { collection, doc, writeBatch, serverTimestamp, getDoc, setDoc, Timestamp, getDocs, QuerySnapshot } from 'firebase/firestore';
import { Platform } from 'react-native';
import { db } from '../config/firebase';
import { SPORTS_DATA } from '../data/leagues';
// @ts-ignore
import ICAL from 'ical.js';

const MATCHES_COLLECTION = 'matches';
const COMPETITIONS_COLLECTION = 'competitions';
const TEAMS_COLLECTION = 'teams';
const METADATA_COLLECTION = 'system';
const SYNC_METADATA_DOC = 'sync_status';

// Simple string hashing function to generate consistent alphanumeric IDs
const generateHashId = (str: string): string => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    // Convert to hex and ensure positive
    return Math.abs(hash).toString(16).padStart(8, '0');
};

const slugify = (str: string) => str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const SYNC_COOLDOWN_MS = 1000 * 5; // Debug mode

interface MatchData {
    leagueSlug: string;
    sport: string;
    homeTeam: string;
    awayTeam: string;
    date: Date;
    location: string;
    description: string;
}

const parseICSDate = (icalTime: any): Date => {
    try {
        return icalTime.toJSDate();
    } catch (e) {
        return new Date();
    }
};

const parseMatch = (vevent: any, leagueSlug: string, sport: string): MatchData | null => {
    try {
        const summary = vevent.getFirstPropertyValue('summary');
        const dtstart = vevent.getFirstPropertyValue('dtstart');
        const location = vevent.getFirstPropertyValue('location') || '';
        const description = vevent.getFirstPropertyValue('description') || '';

        if (!summary || !dtstart) return null;

        let homeTeam = '';
        let awayTeam = '';

        // Robust separator handling
        const separators = [' - ', ' vs ', ' v ', ' vs. ', ' V '];
        let foundSep = false;

        for (const sep of separators) {
            if (summary.includes(sep)) {
                const parts = summary.split(sep);
                if (parts.length >= 2) {
                    homeTeam = parts[0].trim();
                     // Join the rest in case team name has the separator
                    let rawAway = parts.slice(1).join(sep).trim();
                    
                    // Clean scores from team names (e.g. "Team A (2-1)")
                    const scoreRegex = /\s*\(\d+[-:]\d+\.*\)$|\s*\([A-Z]+\)$/i; 
                    homeTeam = homeTeam.replace(scoreRegex, '').trim();
                    awayTeam = rawAway.replace(scoreRegex, '').trim();

                    foundSep = true;
                    break;
                }
            }
        }
        
        if (!foundSep) return null;

        const dateObj = parseICSDate(dtstart);

        return {
            leagueSlug,
            sport,
            homeTeam,
            awayTeam,
            date: dateObj,
            location,
            description
        };
    } catch (e) {
        console.warn('Error parsing event:', e);
        return null;
    }
};

const clearCollection = async (collectionName: string) => {
    console.log(`🧹 Clearing ${collectionName}...`);
    const ref = collection(db, collectionName);
    const snapshot = await getDocs(ref);
    if (snapshot.empty) return;

    const batchSize = 400;
    const docs = snapshot.docs;
    for (let i = 0; i < docs.length; i += batchSize) {
        const batch = writeBatch(db);
        docs.slice(i, i + batchSize).forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }
    console.log(`✅ Cleared ${collectionName}`);
};

export const checkForUpdatesAndSync = async (): Promise<string> => {
    try {
        console.log('🔄 Checking sync status...');
        const metaRef = doc(db, METADATA_COLLECTION, SYNC_METADATA_DOC);
        const metaSnap = await getDoc(metaRef);

        const now = Date.now();
        let shouldSync = true;

        if (metaSnap.exists()) {
            const data = metaSnap.data();
            const lastUpdate = data.lastUpdated?.toMillis() || 0;
            if (now - lastUpdate < SYNC_COOLDOWN_MS) {
                console.log('⏳ Data is fresh. Skipping sync.');
                shouldSync = false;
                return 'skipped';
            }
        }

        if (shouldSync) {
            console.log('🚀 Starting automated sync (Merge Strategy)...');
            
            // NOTE: We do NOT clear collections anymore to prevent data loss on network failure.
            // Old data remains until overwritten or we implement a "prune" strategy later.
            
            // 2. RUN SYNC
            await performFullSync();
            
            // Update metadata
            await setDoc(metaRef, {
                lastUpdated: serverTimestamp(),
                updatedBy: 'app-auto-sync'
            });
            return 'synced';
        }
        return 'skipped';
    } catch (error: any) {
        if (error.code === 'permission-denied') {
            console.error('🚫 PERMISSION DENIED: Unable to sync database.');
            console.error('👉 ACTION REQUIRED: Go to Firebase Console > Firestore > Rules and change "allow read, write: if false;" to "if true;" (for development).');
        } else {
            console.error('❌ Sync Logic Error:', error);
        }
        return 'error';
    }
};

const performFullSync = async () => {
    // Stage 1: Gather all data in memory (Teams, Matches, Competitions)
    // Map<TeamSlug, TeamData>
    const globalTeams = new Map<string, { id: string, name: string, sport: string, competitions: Set<string> }>();
    const allMatches: any[] = [];
    const competitionsToWrite: any[] = [];

    // Helper to get or create team ID
    const registerTeam = (name: string, sport: string, leagueSlug: string): string | null => {
        if (!name || name.trim().length === 0 || name === '...' || name === '.') return null;
        
        const id = slugify(name); 
        if (!id || id.length === 0) return null;

        if (!globalTeams.has(id)) {
            globalTeams.set(id, {
                id,
                name,
                sport,
                competitions: new Set([leagueSlug])
            });
        } else {
            globalTeams.get(id)?.competitions.add(leagueSlug);
        }
        return id;
    };

    for (const category of SPORTS_DATA) {
        for (const league of category.competitions) {
            let url = `https://ics.fixtur.es/v2/league/${league.slug}.ics`;
            if (Platform.OS === 'web') {
                url = `http://localhost:8787/ics?url=${encodeURIComponent(url)}`;
            }

            console.log(`📅 Fetching ${league.name}...`);

            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const icsText = await response.text();

                const jcalData = ICAL.parse(icsText);
                const comp = new ICAL.Component(jcalData);
                const vevents = comp.getAllSubcomponents('vevent');

                const leagueTeamIds = new Set<string>();
                let leagueMatchCount = 0;
                
                const now = new Date();
                const yesterday = new Date();
                yesterday.setDate(now.getDate() - 1);

                vevents.forEach((vevent: any) => {
                    const matchData = parseMatch(vevent, league.slug, category.sport);
                    if (!matchData) return;

                    // REGISTER TEAMS & GET IDs
                    const homeId = registerTeam(matchData.homeTeam, category.sport, league.slug);
                    const awayId = registerTeam(matchData.awayTeam, category.sport, league.slug);
                    
                    if (homeId && awayId) {
                        leagueTeamIds.add(homeId);
                        leagueTeamIds.add(awayId);

                        if (matchData.date >= yesterday) {
                            // GENERATE SHORT DETERMINISTIC MATCH ID
                            // Hash(Date + HomeID + AwayID)
                            const rawIdString = `${matchData.date.toISOString()}-${homeId}-${awayId}`;
                            const matchId = generateHashId(rawIdString);

                            allMatches.push({
                                id: matchId,
                                leagueSlug: league.slug,
                                sport: category.sport,
                                homeTeamId: homeId,
                                awayTeamId: awayId,
                                homeTeamName: matchData.homeTeam,
                                awayTeamName: matchData.awayTeam,
                                date: Timestamp.fromDate(matchData.date),
                                location: matchData.location,
                                updatedAt: serverTimestamp()
                            });
                            leagueMatchCount++;
                        }
                    }
                });

                competitionsToWrite.push({
                    id: league.slug, 
                    data: {
                        name: league.name,
                        slug: league.slug,
                        type: league.type || 'domestic_league',
                        sport: category.sport,
                        teamIds: Array.from(leagueTeamIds), // Store IDs only
                        lastUpdated: serverTimestamp()
                    }
                });
                console.log(`   Processed ${leagueMatchCount} matches.`);

            } catch (err) {
                console.warn(`⚠️ Failed to sync ${league.name}:`, err);
            }
        }
    }

    // WRITE TEAMS
    console.log(`💾 Saving ${globalTeams.size} teams...`);
    const teamOps: Promise<any>[] = [];
    let currentBatch = writeBatch(db);
    let count = 0;

    for (const team of globalTeams.values()) {
        const teamRef = doc(db, TEAMS_COLLECTION, team.id);
        currentBatch.set(teamRef, {
            name: team.name,
            sport: team.sport,
            competitions: Array.from(team.competitions),
            updatedAt: serverTimestamp()
        }, { merge: true });

        count++;
        if (count >= 400) {
            teamOps.push(currentBatch.commit());
            currentBatch = writeBatch(db);
            count = 0;
        }
    }
    if (count > 0) teamOps.push(currentBatch.commit());
    await Promise.all(teamOps);

    // WRITE COMPETITIONS
    const compBatch = writeBatch(db);
    competitionsToWrite.forEach(c => {
        compBatch.set(doc(db, COMPETITIONS_COLLECTION, c.id), c.data, { merge: true });
    });
    await compBatch.commit();

    // WRITE MATCHES
    console.log(`💾 Saving ${allMatches.length} matches...`);
    for (let i = 0; i < allMatches.length; i += 400) {
        const chunk = allMatches.slice(i, i + 400);
        const batch = writeBatch(db);
        chunk.forEach(m => {
            const { id, ...data } = m;
            batch.set(doc(db, MATCHES_COLLECTION, id), data, { merge: true });
        });
        await batch.commit();
        console.log(`   Written matches chunk ${i}`);
    }
};
