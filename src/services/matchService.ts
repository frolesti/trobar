import { collection, getDocs, query, where, Timestamp, orderBy, limit as firestoreLimit } from 'firebase/firestore';
import { db } from '../config/firebase';

export interface Match {
    id: string;
    homeTeam: string;
    awayTeam: string;
    homeBadge?: string;
    awayBadge?: string;
    date: Date;
    league: string;
    location?: string;
    category?: 'masculino' | 'femenino';
}

// --- FIRESTORE SYNC SUPPORT ---

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
            // FALLBACK FOR DEMO: Return a dummy match so the UI isn't empty
            const now = new Date();
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(21, 0, 0, 0);
            
            return [{
                id: 'demo_match',
                homeTeam: 'FC Barcelona',
                awayTeam: 'Real Madrid',
                date: tomorrow,
                league: 'La Liga',
                location: 'Camp Nou'
            }];
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            // Data validation
            if (!data.homeTeam || !data.awayTeam || !data.date) return;

            matches.push({
                id: doc.id,
                homeTeam: data.homeTeam,
                awayTeam: data.awayTeam,
                homeBadge: data.homeBadge,
                awayBadge: data.awayBadge,
                date: (data.date as Timestamp).toDate(),
                league: data.league || 'La Liga',
                location: data.location || '',
                category: data.category
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
    // We only fetch from Firestore now, as the Sync Service handles the ingestion.
    const matches = await fetchMatchesFromFirestore();
    return { matches };
};

// CLEANUP: Removed deprecated fetching logic (fetchCompetitionMatches, getFetchUrl, etc.) 
// since we now rely 100% on the backend syncService storing data into Firestore.

