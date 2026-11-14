const { execSync } = require('node:child_process');
const path = require('node:path');
const { cupSource, fetchCupRecords, matchingCupRecord } = require('../functions/lib/cupData');

function needsRecovery(match, now = Date.now()) {
    return !match.duplicateOf && match.timestamp && Number.isFinite(Date.parse(match.timestamp))
        && cupSource(match.competition?.name || '') && match.homeTeam?.name && match.awayTeam?.name
        && (!match.homeTeam.badge || !match.awayTeam.badge
            || (cupSource(match.competition.name) === 'esp.copa_de_la_reina' && Date.parse(match.timestamp) < now - 3 * 3600_000
                && (!Number.isInteger(match.homeScore) || !Number.isInteger(match.awayScore))));
}

function planRecovery(matches, sources, now = Date.now()) {
    return matches.flatMap(match => {
        if (!needsRecovery(match, now)) return [];
        const source = cupSource(match.competition.name);
        const record = matchingCupRecord(match.timestamp, match.homeTeam.name, match.awayTeam.name,
            sources.get(`${source}|${match.timestamp.slice(0, 4)}`) || []);
        if (!record) return [];
        const fields = {};
        if (!match.homeTeam.badge && record.homeBadge) fields['homeTeam.badge'] = record.homeBadge;
        if (!match.awayTeam.badge && record.awayBadge) fields['awayTeam.badge'] = record.awayBadge;
        if (source === 'esp.copa_de_la_reina' && match.status !== 'postponed' && Date.parse(match.timestamp) < now - 3 * 3600_000
            && (!Number.isInteger(match.homeScore) || !Number.isInteger(match.awayScore))
            && record.homeScore !== undefined && record.awayScore !== undefined) {
            Object.assign(fields, { homeScore: record.homeScore, awayScore: record.awayScore, status: 'finished', scorePending: false });
        }
        if (!Object.keys(fields).length) return [];
        return [{ id: match.id, name: match.name, updateTime: match.updateTime, date: match.timestamp,
            home: match.homeTeam.name, away: match.awayTeam.name, source, eventId: record.eventId, fields }];
    });
}

function decode(value) {
    if (value.mapValue) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, field]) => [key, decode(field)]));
    if (value.integerValue !== undefined) return Number(value.integerValue);
    return value.stringValue ?? value.doubleValue ?? value.timestampValue ?? value.booleanValue ?? value.nullValue;
}

function encodeFields(updates) {
    const fields = {};
    for (const [key, value] of Object.entries(updates)) {
        const encoded = typeof value === 'number' ? { integerValue: String(value) }
            : typeof value === 'boolean' ? { booleanValue: value } : { stringValue: value };
        const [parent, child] = key.split('.');
        if (child) {
            fields[parent] ||= { mapValue: { fields: {} } };
            fields[parent].mapValue.fields[child] = encoded;
        } else fields[key] = encoded;
    }
    return fields;
}

async function main() {
    const apply = process.argv.includes('--apply');
    const gcloud = path.join(process.env.LOCALAPPDATA, 'Google', 'Cloud SDK', 'google-cloud-sdk', 'bin', 'gcloud.cmd');
    const token = execSync(`"${gcloud}" auth print-access-token`, { encoding: 'utf8', windowsHide: true }).trim();
    const headers = { Authorization: `Bearer ${token}` };
    const root = 'https://firestore.googleapis.com/v1/projects/trobar-1123f/databases/(default)/documents';
    const matches = [];
    let next = '';
    do {
        const response = await fetch(`${root}/matches?pageSize=1000&pageToken=${encodeURIComponent(next)}`, { headers, signal: AbortSignal.timeout(20000) });
        if (!response.ok) throw new Error(`Firestore read HTTP ${response.status}`);
        const page = await response.json();
        matches.push(...(page.documents || []).map(document => ({
            ...Object.fromEntries(Object.entries(document.fields).map(([key, field]) => [key, decode(field)])),
            id: document.name.split('/').pop(), name: document.name, updateTime: document.updateTime,
        })));
        next = page.nextPageToken || '';
    } while (next);
    const requests = new Set(matches.filter(match => needsRecovery(match))
        .map(match => `${cupSource(match.competition.name)}|${match.timestamp.slice(0, 4)}`));
    const sources = new Map();
    for (const request of requests) {
        const [source, year] = request.split('|');
        sources.set(request, await fetchCupRecords(source, year));
    }
    const planned = planRecovery(matches, sources);
    console.log(JSON.stringify({ mode: apply ? 'apply' : 'preview', providerRequests: requests.size, planned: planned.length,
        matches: planned.map(({ name, updateTime, ...summary }) => summary) }, null, 2));
    let updated = 0;
    let changedSinceRead = 0;
    if (apply) for (const match of planned) {
        const query = new URLSearchParams({ 'currentDocument.updateTime': match.updateTime });
        for (const field of Object.keys(match.fields)) query.append('updateMask.fieldPaths', field);
        const response = await fetch(`https://firestore.googleapis.com/v1/${match.name}?${query}`, {
            method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20000),
            body: JSON.stringify({ fields: encodeFields(match.fields) }),
        });
        if (response.status === 409 || response.status === 412) { changedSinceRead++; continue; }
        if (!response.ok) throw new Error(`Cup recovery HTTP ${response.status}`);
        updated++;
    }
    console.log(JSON.stringify({ updated, changedSinceRead }));
}

module.exports = { needsRecovery, planRecovery, decode, encodeFields };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
