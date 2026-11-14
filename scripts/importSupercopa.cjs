const { execSync } = require('node:child_process');
const path = require('node:path');
const { createRequire } = require('node:module');
const { Firestore } = require('../functions/node_modules/@google-cloud/firestore');
// This gax REST transport expects the plain header objects from its own auth version.
const gaxRequire = createRequire(require.resolve('../functions/node_modules/google-gax/package.json'));
const { GoogleAuth, OAuth2Client } = gaxRequire('google-auth-library');
const { importSupercopa } = require('../functions/lib/matchSync');
const { supercopaFixtures, SUPERCOPA_SOURCE } = require('../functions/lib/supercopa');

async function main() {
    const projectId = 'trobar-1123f';
    const fixtures = supercopaFixtures();
    console.log(JSON.stringify({ projectId, source: SUPERCOPA_SOURCE, apply: process.argv.includes('--apply'),
        fixtures: fixtures.map(fixture => ({ id: fixture.id, utcDate: fixture.utcDate, home: fixture.homeTeam.name, away: fixture.awayTeam.name })) }, null, 2));
    if (!process.argv.includes('--apply')) return;
    const gcloud = path.join(process.env.LOCALAPPDATA, 'Google', 'Cloud SDK', 'google-cloud-sdk', 'bin', 'gcloud.cmd');
    const token = execSync(`"${gcloud}" auth print-access-token`, { encoding: 'utf8', windowsHide: true }).trim();
    const authClient = new OAuth2Client();
    authClient.setCredentials({ access_token: token, expiry_date: Date.now() + 50 * 60_000 });
    const auth = new GoogleAuth({ projectId, authClient });
    const db = new Firestore({ projectId, auth, preferRest: true });
    try {
        await db.doc('system/id_mappings').get();
        console.log('Catalogue mapping read successfully; importing missing Barcelona fixtures.');
        await importSupercopa(db);
        const mappings = (await db.doc('system/id_mappings').get()).data();
        for (const fixture of fixtures) {
            const id = String(mappings.matches[fixture.id]);
            const data = (await db.doc(`matches/${id}`).get()).data();
            if (!data || data.competition?.name !== fixture.competition.name || data.stage !== 'SEMI_FINALS'
                || data.timestamp?.toDate().toISOString() !== fixture.utcDate) {
                throw new Error(`Catalogue verification failed for ${fixture.id}`);
            }
            console.log(JSON.stringify({ verifiedMatchId: id, date: data.timestamp.toDate().toISOString(),
                competition: data.competition.name, home: data.homeTeam.name, away: data.awayTeam.name }));
        }
    } finally { await db.terminate(); }
}

if (require.main === module) main().catch(error => {
    console.error('Supercopa import failed:', error.message);
    process.exitCode = 1;
});
