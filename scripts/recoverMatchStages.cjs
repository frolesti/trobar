const { execSync } = require('node:child_process');
const path = require('node:path');
const { normalizeStage, stageSource, stageTeamKey, stageRecords, fetchStageRecords } = require('../functions/lib/stageData');

function competitionSource(match) {
    return stageSource(match.competition?.name || '', match.category) || null;
}

function teamKey(team) {
    const name = typeof team === 'string' ? team : team?.name || '';
    return stageTeamKey(name);
}

function fixtureKey(source, date, home, away) {
    return `${source}|${date.slice(0, 10)}|${teamKey(home)}|${teamKey(away)}`;
}

function sourceStages(source, events) {
    const stages = new Map();
    for (const record of stageRecords(events)) {
        const key = fixtureKey(source, record.date, record.home, record.away);
        const candidate = { ...record, source: 'espn' };
        const existing = stages.get(key);
        stages.set(key, existing && (existing.stage !== record.stage || existing.eventId !== record.eventId) ? { ambiguous: true } : existing?.ambiguous ? existing : candidate);
    }
    return stages;
}

function planRecovery(matches, stages) {
    return matches.flatMap(match => {
        if (match.duplicateOf || !Number.isFinite(Date.parse(match.timestamp))) return [];
        const source = competitionSource(match);
        if (!source || !teamKey(match.homeTeam) || !teamKey(match.awayTeam)) return [];
        const candidate = stages.get(fixtureKey(source, match.timestamp, match.homeTeam, match.awayTeam));
        if (!candidate?.stage || candidate.ambiguous || match.stage === candidate.stage) return [];
        return [{ ...candidate, previousStage: match.stage || null, previousRound: match.round || null,
            id: match.id, name: match.name, updateTime: match.updateTime, date: match.timestamp, home: match.homeTeam.name, away: match.awayTeam.name, competition: match.competition.name }];
    });
}

function auditRecovery(matches, stages) {
    const scoped = matches.filter(match => !match.duplicateOf && competitionSource(match));
    const unresolved = [];
    const verifiedMatches = [];
    let verified = 0;
    for (const match of scoped) {
        const candidate = match.timestamp && stages.get(fixtureKey(competitionSource(match), match.timestamp, match.homeTeam, match.awayTeam));
        if (candidate?.stage && !candidate.ambiguous) {
            verified++;
            verifiedMatches.push({ id: match.id, apiId: match.apiId, date: match.timestamp, home: match.homeTeam.name, away: match.awayTeam.name,
                competition: competitionSource(match), stage: candidate.stage, rawStage: candidate.rawStage,
                source: candidate.source, eventId: candidate.eventId,
                sourceUrl: candidate.source === 'uefa' ? `https://match.uefa.com/v5/matches/${candidate.eventId}`
                    : `https://www.espn.com/soccer/match/_/gameId/${candidate.eventId}` });
            continue;
        }
        unresolved.push({ id: match.id, date: match.timestamp, home: match.homeTeam?.name, away: match.awayTeam?.name,
            competition: match.competition?.name, stage: match.stage || null, round: match.round || null,
            source: competitionSource(match), reason: candidate?.ambiguous ? 'ambiguous-provider-events' : candidate ? 'unknown-provider-phase' : 'no-matching-provider-event',
            ...(candidate?.eventId ? { eventId: candidate.eventId, rawStage: candidate.rawStage } : {}) });
    }
    return { totalScoped: scoped.length, missingStages: scoped.filter(match => !normalizeStage(match.stage) && !normalizeStage(match.round)).length,
        verified, verifiedMatches, competitions: scoped.reduce((counts, match) => { const key = competitionSource(match); counts[key] = (counts[key] || 0) + 1; return counts; }, {}), unresolved };
}

function decode(value) {
    if (value.mapValue) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, field]) => [key, decode(field)]));
    return value.stringValue ?? value.integerValue ?? value.timestampValue ?? value.booleanValue ?? value.nullValue;
}

async function main() {
    const apply = process.argv.includes('--apply');
    const gcloud = path.join(process.env.LOCALAPPDATA, 'Google/Cloud SDK/google-cloud-sdk/bin/gcloud.cmd');
    const token = execSync(`"${gcloud}" auth print-access-token`, { encoding: 'utf8', windowsHide: true }).trim();
    const headers = { Authorization: `Bearer ${token}` };
    const root = 'https://firestore.googleapis.com/v1/projects/trobar-1123f/databases/(default)/documents';
    const matches = [];
    let next = '';
    do {
        const response = await fetch(`${root}/matches?pageSize=1000&pageToken=${encodeURIComponent(next)}`, { headers, signal: AbortSignal.timeout(20000) });
        if (!response.ok) throw new Error(`Firestore read HTTP ${response.status}`);
        const page = await response.json();
        matches.push(...(page.documents || []).map(document => ({ ...Object.fromEntries(Object.entries(document.fields).map(([key, field]) => [key, decode(field)])), id: document.name.split('/').pop(), name: document.name, updateTime: document.updateTime })));
        next = page.nextPageToken || '';
    } while (next);
    const requests = new Set(matches.filter(match => !match.duplicateOf && Number.isFinite(Date.parse(match.timestamp)) && competitionSource(match))
        .map(match => `${competitionSource(match)}|${match.timestamp.slice(0, 4)}`));
    const stages = new Map();
    for (const request of requests) {
        const [source, year] = request.split('|');
        const records = await fetchStageRecords(source, year);
        for (const record of records) {
            const key = fixtureKey(source, record.date, record.home, record.away);
            const existing = stages.get(key);
            stages.set(key, existing && (existing.eventId !== record.eventId || existing.stage !== record.stage)
                ? { ambiguous: true } : existing?.ambiguous ? existing : { ...record, source: record.provider || 'espn' });
        }
    }
    const planned = planRecovery(matches, stages);
    const report = { mode: apply ? 'apply' : 'preview', ...auditRecovery(matches, stages), providerRequests: requests.size, planned: planned.length,
        matches: planned.map(({ name, updateTime, ...summary }) => summary) };
    const reportIndex = process.argv.indexOf('--report');
    if (reportIndex >= 0) {
        const filename = process.argv[reportIndex + 1];
        if (!filename || filename.startsWith('--')) throw new Error('--report requires a filename');
        require('node:fs').writeFileSync(filename, JSON.stringify(report, null, 2) + '\n');
        console.log(JSON.stringify({ ...report, matches: undefined, verifiedMatches: undefined, unresolved: undefined, unresolvedCount: report.unresolved.length, report: filename }, null, 2));
    } else console.log(JSON.stringify(report, null, 2));
    let updated = 0;
    let changedSinceRead = 0;
    if (apply) for (const match of planned) {
        const query = new URLSearchParams({ 'currentDocument.updateTime': match.updateTime });
        for (const field of ['stage', 'stageSource', 'stageSourceEventId', 'stageRecoveredAt']) query.append('updateMask.fieldPaths', field);
        const response = await fetch(`https://firestore.googleapis.com/v1/${match.name}?${query}`, {
            method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(20000),
            body: JSON.stringify({ fields: { stage: { stringValue: match.stage }, stageSource: { stringValue: match.source }, stageSourceEventId: { stringValue: match.eventId }, stageRecoveredAt: { timestampValue: new Date().toISOString() } } }),
        });
        if (response.status === 409 || response.status === 412) { changedSinceRead++; continue; }
        if (!response.ok) throw new Error(`Stage update HTTP ${response.status}`);
        updated++;
    }
    console.log(JSON.stringify({ updated, changedSinceRead }));
}

module.exports = { teamKey, competitionSource, fixtureKey, sourceStages, planRecovery, auditRecovery };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });