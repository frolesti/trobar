import * as admin from 'firebase-admin';
import { defineSecret } from 'firebase-functions/params';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import type { SyncConfig } from './matchSync';

if (!admin.apps.length) admin.initializeApp();
const matchSyncConfig = defineSecret('MATCH_SYNC_CONFIG');

export const scheduledMatchSync = onSchedule({
    schedule: '15 5 * * *',
    region: 'europe-west1',
    timeZone: 'Europe/Madrid',
    secrets: [matchSyncConfig],
    timeoutSeconds: 480,
    maxInstances: 1,
    retryCount: 2,
    minBackoffSeconds: 60,
}, async () => {
    const { syncMatches } = await import('./matchSync');
    await syncMatches(admin.firestore(), JSON.parse(matchSyncConfig.value()) as SyncConfig);
});

export const scheduledLiveMatchSync = onSchedule({
    schedule: 'every 1 minutes',
    region: 'europe-west1',
    timeZone: 'Etc/UTC',
    secrets: [matchSyncConfig],
    timeoutSeconds: 480,
    maxInstances: 1,
    concurrency: 1,
    retryCount: 0,
}, async () => {
    const { syncLiveMatches } = await import('./liveMatchSync');
    const config = JSON.parse(matchSyncConfig.value()) as SyncConfig;
    const result = await syncLiveMatches(admin.firestore(), config);
    if (result.finished) {
        const { syncMatches } = await import('./matchSync');
        await syncMatches(admin.firestore(), config);
    }
});