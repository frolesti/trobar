const { execSync } = require('node:child_process');
const path = require('node:path');
const { fixtureIdentity } = require('../functions/lib/matchSync');

const decode = value => value.stringValue ?? value.integerValue ?? value.timestampValue
    ?? (value.mapValue ? Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, field]) => [key, decode(field)])) : value.booleanValue ?? value.nullValue);

async function main() {
    const gcloud = path.join(process.env.LOCALAPPDATA, 'Google/Cloud SDK/google-cloud-sdk/bin/gcloud.cmd');
    const token = execSync(`"${gcloud}" auth print-access-token`, { encoding: 'utf8' }).trim();
    const documents = [];
    let next = '';
    do {
        const response = await fetch(`https://firestore.googleapis.com/v1/projects/trobar-1123f/databases/(default)/documents/matches?pageSize=1000&pageToken=${encodeURIComponent(next)}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error(`Firestore HTTP ${response.status}`);
        const body = await response.json();
        documents.push(...(body.documents || []));
        next = body.nextPageToken || '';
    } while (next);
    const competitions = {};
    const groups = new Map();
    const invalid = [];
    for (const document of documents) {
        const match = Object.fromEntries(Object.entries(document.fields).map(([key, value]) => [key, decode(value)]));
        const name = match.competition?.name || 'Unknown';
        const totals = competitions[name] ||= { total: 0, active: 0, markedDuplicates: 0, withStage: 0 };
        totals.total++;
        if (match.duplicateOf) { totals.markedDuplicates++; continue; }
        totals.active++;
        if (match.stage) totals.withStage++;
        if (!match.timestamp || !match.homeTeam?.name || !match.awayTeam?.name || !match.competition?.name) { invalid.push(document.name); continue; }
        const category = match.category || (/women|femen|liga f|uwcl|reina/i.test(name) ? 'femenino' : 'masculino');
        const key = fixtureIdentity(match.timestamp, match.homeTeam.name, match.awayTeam.name, name, category);
        const entry = { id: document.name.split('/').pop(), competition: name, date: match.timestamp, home: match.homeTeam.name, away: match.awayTeam.name, score: [match.homeScore, match.awayScore] };
        groups.set(key, [...(groups.get(key) || []), entry]);
    }
    const duplicates = [...groups.values()].filter(group => group.length > 1);
    const conflicts = duplicates.filter(group => new Set(group.filter(match => match.score.every(score => score != null)).map(match => JSON.stringify(match.score))).size > 1);
    console.log(JSON.stringify({ competitions, activeDuplicateGroups: duplicates.length, conflictingScoreGroups: conflicts.length, invalidActiveDocuments: invalid, duplicates }, null, 2));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });