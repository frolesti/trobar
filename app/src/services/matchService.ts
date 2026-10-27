import { collection, getDocs, query, where, Timestamp, orderBy, limit as firestoreLimit, documentId, onSnapshot, startAfter, QueryDocumentSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Match } from '../models/Match';

export type { Match };

// --- SUPORT DE SINCRONITZACIÓ AMB FIRESTORE ---

export function subscribeToMatchUpdates(ids: string[], onUpdate: (matches: Match[]) => void): () => void {
    const unique = [...new Set(ids)];
    const subscriptions: (() => void)[] = [];
    for (let offset = 0; offset < unique.length; offset += 30) {
        const request = query(collection(db, 'matches'), where(documentId(), 'in', unique.slice(offset, offset + 30)));
        subscriptions.push(onSnapshot(request, snapshot => {
            onUpdate(snapshot.docs.filter(snapshotDoc => !snapshotDoc.data().duplicateOf).map(snapshotDoc => {
                const data = snapshotDoc.data();
                return { ...data, id: snapshotDoc.id, date: data.timestamp.toDate() } as Match;
            }));
        }, error => console.warn('Match subscription unavailable', error.code)));
    }
    return () => subscriptions.forEach(unsubscribe => unsubscribe());
}

export async function fetchPastMatches(
    beforeDate: Date, 
    limitCount: number = 5,
    category?: 'masculino' | 'femenino'
): Promise<Match[]> {
    const matches: Match[] = [];
    let cursor: QueryDocumentSnapshot | undefined;
    while (matches.length < limitCount) {
        const batchSize = Math.max(30, limitCount);
        const request = query(
            collection(db, 'matches'),
            where('timestamp', '<', Timestamp.fromDate(beforeDate)),
            orderBy('timestamp', 'desc'),
            ...(cursor ? [startAfter(cursor)] : []),
            firestoreLimit(batchSize),
        );
        const snapshot = await getDocs(request);
        for (const document of snapshot.docs) {
            const data = document.data();
            if (data.duplicateOf || !data.homeTeam || !data.awayTeam || !data.timestamp?.toDate) continue;
            const women = data.category === 'femenino' || /women|femen|liga f|uwcl|reina/i.test(data.competition?.name || '');
            if (category && women !== (category === 'femenino')) continue;
            matches.push({ ...data, id: document.id, date: data.timestamp.toDate() } as Match);
            if (matches.length === limitCount) break;
        }
        if (snapshot.docs.length < batchSize) break;
        cursor = snapshot.docs[snapshot.docs.length - 1];
    }
    return matches;
}

async function fetchMatchesFromFirestore(): Promise<Match[]> {
    try {
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
            if (data.duplicateOf || !data.homeTeam || !data.awayTeam) return;

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
                status: data.status,
                stage: data.stage,
                group: data.group,
                round: data.round,
                timeConfirmed: data.timeConfirmed,
            });
        });

        // console.log(`✅ [DB SUCCESS] Loaded ${matches.length} matches from Firestore.`);
        
        // Actualitzar cache

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

export async function fetchCompetitionMatches(competitionIds: string[]): Promise<Match[]> {
    const ids = [...new Set(competitionIds)];
    const matches: Match[] = [];
    for (let offset = 0; offset < ids.length; offset += 30) {
        const request = query(collection(db, 'matches'), where('league', 'in', ids.slice(offset, offset + 30)));
        const snapshot = await getDocs(request);
        snapshot.forEach(snapshotDoc => {
            const data = snapshotDoc.data();
            if (data.duplicateOf || !data.homeTeam || !data.awayTeam || !data.timestamp?.toDate) return;
            matches.push({ ...data, id: snapshotDoc.id, date: data.timestamp.toDate() } as Match);
        });
    }
    return matches.sort((first, second) => first.date.getTime() - second.date.getTime());
}

