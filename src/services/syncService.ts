import { collection, doc, writeBatch, serverTimestamp, getDoc, setDoc, Timestamp, getDocs, QuerySnapshot } from 'firebase/firestore';
import { Platform } from 'react-native';
import { db } from '../config/firebase';
import { BARCA_CALENDARS } from '../data/leagues';
// @ts-ignore
import ICAL from 'ical.js';

const MATCHES_COLLECTION = 'matches';
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

const SYNC_COOLDOWN_MS = 1000 * 60 * 60; // 1 Hour

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

const parseMatch = (vevent: any, calendarId: string): MatchData | null => {
    try {
        const summary = vevent.getFirstPropertyValue('summary') || '';
        const dtstart = vevent.getFirstPropertyValue('dtstart');
        const location = vevent.getFirstPropertyValue('location') || '';
        const description = vevent.getFirstPropertyValue('description') || '';

        if (!summary || !dtstart) return null;

        let homeTeam = 'FC Barcelona';
        let awayTeam = 'Unknown';
        
        // Parse "Home v Away" or "Home - Away"
        // Fixtur.es format: "HomeTeam - AwayTeam"
        const separators = [' - ', ' v ', ' vs '];
        let foundSep = false;
        
        for (const sep of separators) {
             if (summary.includes(sep)) {
                 const parts = summary.split(sep);
                 homeTeam = parts[0].trim();
                 awayTeam = parts[1].trim();
                 
                 // Clean scores e.g. "Team (2)"
                 homeTeam = homeTeam.replace(/\s*\(\d+\)$/, '').trim();
                 awayTeam = awayTeam.replace(/\s*\(\d+\)$/, '').trim();
                 foundSep = true;
                 break;
             }
        }
        
        // If no separator found, use summary as is (might be specific event name)
        if (!foundSep) {
             // Heuristic: If calendar is Barca, and Barca is not in title, maybe title is the opponent?
             // But usually fixtur.es is consistent.
        }

        const dateObj = parseICSDate(dtstart);
        
        // Competition Detection (often in description or summary suffix)
        // For now, we identify competition by the calendarId or keep it simple.
        let competition = "Unknown";
        if (calendarId === 'fc-barcelona') competition = "Masculí"; 
        if (calendarId === 'fc-barcelona-women') competition = "Femení";
        
        // Try to extract real competition from description if available (e.g. "Champions League")
        if (description && description.includes('Champions League')) competition += ' (UCL)';
        if (description && description.includes('La Liga')) competition += ' (Liga)';

        return {
            leagueSlug: competition, 
            sport: 'Futbol',
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
            console.log('🚀 Starting automated sync (Barça Only)...');
            await performFullSync();
            await setDoc(metaRef, {
                lastUpdated: serverTimestamp(),
                updatedBy: 'app-auto-sync'
            });
            return 'synced';
        }
        return 'skipped';
    } catch (error: any) {
        if (error.code === 'permission-denied') {
            console.warn('Sync permission denied (Rules). Skipping.');
        } else {
            console.error('❌ Sync Logic Error:', error);
        }
        return 'error';
    }
};

const performFullSync = async () => {
    const allMatches: any[] = [];

    for (const calendar of BARCA_CALENDARS) {
        console.log(`📅 Fetching ${calendar.name}...`);
        
        // Native fetches directly. Web tries directly (CORS might fail, but let's try).
        // If web fails, we handle it gracefully.
        let url = calendar.url;
        // if (Platform.OS === 'web') {
        //     // Use a public proxy if strictly needed or rely on no-cors mode (opaque, cant read)
        //     // For now, we assume direct fetch or local dev proxy if configured.
        //     // url = `https://cors-anywhere.herokuapp.com/${url}`; 
        // }

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const icsText = await response.text();

            const jcalData = ICAL.parse(icsText);
            const comp = new ICAL.Component(jcalData);
            const vevents = comp.getAllSubcomponents('vevent');

            const now = new Date();
            // Allow showing matches from yesterday (to show results or "just finished")
            const yesterday = new Date();
            yesterday.setDate(now.getDate() - 1);

            vevents.forEach((vevent: any) => {
                const matchData = parseMatch(vevent, calendar.id);
                if (!matchData) return;

                if (matchData.date >= yesterday) {
                    // ID: Date + Home + Away
                    const rawIdString = `${matchData.date.toISOString()}-${matchData.homeTeam}-${matchData.awayTeam}`;
                    const matchId = generateHashId(rawIdString);

                    allMatches.push({
                        id: matchId,
                        competition: matchData.leagueSlug, // Using simplified "Masculí/Femení" as competition or category
                        sport: 'Futbol',
                        teamHome: matchData.homeTeam,
                        teamAway: matchData.awayTeam,
                        date: Timestamp.fromDate(matchData.date),
                        location: matchData.location,
                        updatedAt: serverTimestamp()
                    });
                }
            });
        } catch (e) {
            console.error(`Failed to sync calendar ${calendar.name}:`, e);
        }
    }

    if (allMatches.length > 0) {
        console.log(`💾 Saving ${allMatches.length} Barça matches...`);
        const batch = writeBatch(db);
        
        // We overwrite matches with same ID. 
        // We do not delete old "Barça" matches yet unless we clear collection.
        // But since we pivot, we might want to clear EVERYTHING first if we can?
        // Let's just upsert.
        
        let operationCount = 0;
        for (const match of allMatches) {
            const ref = doc(db, MATCHES_COLLECTION, match.id);
            batch.set(ref, match, { merge: true });
            operationCount++;
            
            if (operationCount >= 450) {
                await batch.commit();
                operationCount = 0;
            }
        }
        if (operationCount > 0) await batch.commit();
        console.log('✅ Sync Complete');
    } else {
        console.log('⚠️ No matches found to sync.');
    }
};
