import * as admin from 'firebase-admin';
import { defineSecret } from 'firebase-functions/params';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import type { SyncConfig } from './matchSync';

if (!admin.apps.length) admin.initializeApp();
const matchSyncConfig = defineSecret('MATCH_SYNC_CONFIG');

export const scheduledMatchSync = onSchedule({
    schedule: 'every 15 minutes',
    region: 'europe-west1',
    timeZone: 'Etc/UTC',
    secrets: [matchSyncConfig],
    timeoutSeconds: 480,
    maxInstances: 1,
    retryCount: 2,
    minBackoffSeconds: 60,
}, async () => {
    const { syncMatches } = await import('./matchSync');
    await syncMatches(admin.firestore(), JSON.parse(matchSyncConfig.value()) as SyncConfig);
});