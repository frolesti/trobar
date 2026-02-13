export interface SyncStatus {
    state: 'fresh' | 'stale' | 'unknown';
    lastUpdated: Date | null;
    matchCount: number;
    competitionCount: number;
    teamCount: number;
}
