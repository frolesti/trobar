import { collection, getDocs, query, where, Timestamp, orderBy, limit as firestoreLimit } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Match } from '../models/Match';

export type { Match };

// --- FIRESTORE SYNC SUPPORT ---

let cachedFirestoreMatches: Match[] | null = null;
let lastFirestoreFetchTime = 0;
const DB_CACHE_DURATION = 1000 * 60 * 60; // 1 Hour

export async function fetchPastMatches(beforeDate: Date, limitCount: number = 5): Promise<Match[]> {
    try {
        console.log('📜 Loading history matches from DB before:', beforeDate);
        const matchesRef = collection(db, 'matches');
        
        // Query database for matches OLDER than "beforeDate", ordered desc
        const q = query(
            matchesRef, 
            where('timestamp', '<', Timestamp.fromDate(beforeDate)),
            orderBy('timestamp', 'desc'),
            firestoreLimit(limitCount)
        );

        const snapshot = await getDocs(q);
        const matches: Match[] = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            if (!data.homeTeam || !data.awayTeam) return;

             // Handle potential date/timestamp format field
             let dateObj = new Date();
             if (data.timestamp && data.timestamp.toDate) {
                 dateObj = data.timestamp.toDate();
             } else if (data.date && data.date.toDate) {
                 dateObj = data.date.toDate();
             } else if (typeof data.date === 'string') {
                 dateObj = new Date(data.date);
             }

            matches.push({
                id: doc.id,
                homeTeam: data.homeTeam,
                awayTeam: data.awayTeam,
                date: dateObj,
                league: data.league || (data.competition ? data.competition.id : 'Unknown'),
                competition: data.competition,
                location: data.location || '',
                category: data.category,
                homeScore: data.homeScore, 
                awayScore: data.awayScore, 
                status: data.status || 'finished' 
            });
        });
        
        return matches;
    } catch (error) {
        console.error('❌ Error loading past matches:', error);
        return [];
    }
}

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

        // QUERY FIX: Use 'timestamp' field (Firestore Timestamp) instead of 'date' (String)
        const q = query(
            matchesRef, 
            where('timestamp', '>=', Timestamp.fromDate(activeThreshold)),
            orderBy('timestamp', 'asc'),
            firestoreLimit(100)
        );

        const snapshot = await getDocs(q);
        const matches: Match[] = [];

        if (snapshot.empty) {
            console.log('⚠️ Internal database empty or no upcoming matches found.');
            // Fallback: Check if we have mismatched data (date vs timestamp)
            // Or maybe just fetch recent past matches if upcoming is empty?
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            // Data validation
            if (!data.homeTeam || !data.awayTeam) return;

            // Handle potential date/timestamp format field
            let dateObj = new Date();
            if (data.timestamp && data.timestamp.toDate) {
                dateObj = data.timestamp.toDate();
            } else if (data.date && data.date.toDate) {
                dateObj = data.date.toDate();
            } else if (typeof data.date === 'string') {
                dateObj = new Date(data.date);
            }

            matches.push({
                id: doc.id,
                homeTeam: data.homeTeam,
                awayTeam: data.awayTeam,
                date: dateObj,
                league: data.league || (data.competition ? data.competition.id : 'Unknown'),
                competition: data.competition,
                location: data.location || '',
                category: data.category,
                status: data.status
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

export const fetchAllMatches = async (): Promise<{ matches: Match[] }> => {
    const matches = await fetchMatchesFromFirestore();
    return { matches };
};

