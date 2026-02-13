import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * syncService  –  Read-only checker.
 *
 * The actual sync (API call → Firestore) happens at dev-start via
 *   node scripts/updateMatches.js
 *
 * This module only exposes a lightweight status check so the app UI
 * can know whether data is available / fresh.
 */

const METADATA_COLLECTION = 'system';
const SYNC_METADATA_DOC   = 'sync_status';

export interface SyncStatus {
    state: 'fresh' | 'stale' | 'unknown';
    lastUpdated: Date | null;
    matchCount: number;
    competitionCount: number;
    teamCount: number;
}

/**
 * Returns the current sync metadata without making any external API call.
 * The pre-start script `scripts/updateMatches.js` is responsible for
 * populating the data.
 */
export const checkSyncStatus = async (): Promise<SyncStatus> => {
    try {
        const metaRef  = doc(db, METADATA_COLLECTION, SYNC_METADATA_DOC);
        const metaSnap = await getDoc(metaRef);

        if (!metaSnap.exists()) {
            console.log('ℹ️  No sync metadata found. Run `node scripts/updateMatches.js --force` to populate.');
            return { state: 'unknown', lastUpdated: null, matchCount: 0, competitionCount: 0, teamCount: 0 };
        }

        const data       = metaSnap.data();
        const lastMillis = data.lastUpdated?.toMillis() || 0;
        const ageMs      = Date.now() - lastMillis;
        const STALE_MS   = 1000 * 60 * 60 * 8; // consider stale after 8 h

        return {
            state:            ageMs < STALE_MS ? 'fresh' : 'stale',
            lastUpdated:      lastMillis ? new Date(lastMillis) : null,
            matchCount:       data.matchCount       ?? 0,
            competitionCount: data.competitionCount  ?? 0,
            teamCount:        data.teamCount         ?? 0,
        };
    } catch (error) {
        console.error('❌ Error checking sync status:', error);
        return { state: 'unknown', lastUpdated: null, matchCount: 0, competitionCount: 0, teamCount: 0 };
    }
};

/** Backwards-compatible alias (returns 'synced' | 'skipped') */
export const checkForUpdatesAndSync = async (): Promise<string> => {
    const status = await checkSyncStatus();
    return status.state === 'fresh' ? 'skipped' : 'skipped';
};
