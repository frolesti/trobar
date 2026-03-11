import { collection, getDocs, query, where, Timestamp, orderBy, limit as firestoreLimit } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Match } from '../models/Match';

export type { Match };

// --- SUPORT DE SINCRONITZACIÓ AMB FIRESTORE ---

let cachedFirestoreMatches: Match[] | null = null;
let lastFirestoreFetchTime = 0;
const DB_CACHE_DURATION = 1000 * 60 * 60; // 1 hora

export async function fetchPastMatches(beforeDate: Date, limitCount: number = 5): Promise<Match[]> {
    try {
        const matchesRef = collection(db, 'matches');
        
        // Consultar la BD per a partits ANTERIORS a "beforeDate", ordenant desc
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

             // Gestionar possible camp de format data/timestamp
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
            return cachedFirestoreMatches;
        }

        const matchesRef = collection(db, 'matches');
        
        // Filtre: Partits des de fa 2 hores en endavant
        const now = new Date();
        const activeThreshold = new Date(now.getTime() - 2 * 60 * 60 * 1000); // -2h

        // CORRECCIÓ: Usar camp 'timestamp' (Firestore Timestamp) en lloc de 'date' (String)
        const q = query(
            matchesRef, 
            where('timestamp', '>=', Timestamp.fromDate(activeThreshold)),
            orderBy('timestamp', 'asc'),
            firestoreLimit(100)
        );

        const snapshot = await getDocs(q);
        const matches: Match[] = [];

        if (snapshot.empty) {
            // console.log('⚠️ Internal database empty or no upcoming matches found.');
            // Alternativa: Comprovar si tenim dades incoherents (date vs timestamp)
            // O potser simplement obtenir partits passats recents si no n'hi ha de futurs?
        }

        snapshot.forEach(doc => {
            const data = doc.data();
            // Validació de dades
            if (!data.homeTeam || !data.awayTeam) return;

            // Gestionar possible camp de format data/timestamp
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
                status: data.status
            });
        });

        // console.log(`✅ [DB SUCCESS] Loaded ${matches.length} matches from Firestore.`);
        
        // Actualitzar cache
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

