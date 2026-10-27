const { execSync } = require('node:child_process');
const path = require('node:path');

const PHASES = {
    'round-of-32': 'LAST_32', 'round-of-16': 'LAST_16',
    quarterfinals: 'QUARTER_FINALS', semifinals: 'SEMI_FINALS', final: 'FINAL',
    'group-stage': 'GROUP_STAGE', 'league-phase': 'LEAGUE_STAGE',
    'knockout-round-playoffs': 'PLAYOFFS',
};

function competitionSource(match) {
    const name = match.competition?.name || '';
    if (/women.*champion|uwcl/i.test(name)) return 'uefa.wchampions';
    if (/champion/i.test(name)) return 'uefa.champions';
    if (/copa.*reina/i.test(name)) return 'esp.copa_de_la_reina';
    if (/copa.*rey/i.test(name)) return 'esp.copa_del_rey';
    return null;
}

function teamKey(team) {
    const name = typeof team === 'string' ? team : team?.name || '';
    const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        .replace(/\b(fc|cf|afc|women|femenino|femenina|femeni|wfc)\b/g, '').replace(/[^a-z0-9]/g, '');
    const aliases = { clubatleticodemadrid: 'atleticomadrid', athleticclub: 'athleticbilbao', athleticclubbilbao: 'athleticbilbao', manchestercitywomen: 'manchestercity' };
    return aliases[normalized] || normalized;
}

function fixtureKey(source, date, home, away) {
    return `${source}|${date.slice(0, 10)}|${teamKey(home)}|${teamKey(away)}`;
}

function sourceStages(source, events) {
    const stages = new Map();
    for (const event of events) {
        const stage = PHASES[event.season?.slug];
        const competition = event.competitions?.[0];
        const home = competition?.competitors?.find(team => team.homeAway === 'home');
        const away = competition?.competitors?.find(team => team.homeAway === 'away');
        if (!stage || !home || !away || !event.date || !event.id) continue;
        const key = fixtureKey(source, event.date, home.team?.displayName, away.team?.displayName);
        const candidate = { stage, source: 'espn', eventId: String(event.id) };
        const existing = stages.get(key);
        stages.set(key, existing && existing.stage !== stage ? { ambiguous: true } : existing?.ambiguous ? existing : candidate);
    }
    return stages;
}

function planRecovery(matches, stages, now = Date.now()) {
    return matches.flatMap(match => {
        if (match.duplicateOf || match.stage || match.round || Date.parse(match.timestamp) > now || !match.timestamp) return [];
        const source = competitionSource(match);
        if (!source || !teamKey(match.homeTeam) || !teamKey(match.awayTeam)) return [];
        const candidate = stages.get(fixtureKey(source, match.timestamp, match.homeTeam, match.awayTeam));
        if (!candidate || candidate.ambiguous) return [];
        return [{ ...candidate, id: match.id, name: match.name, updateTime: match.updateTime, date: match.timestamp, home: match.homeTeam.name, away: match.awayTeam.name, competition: match.competition.name }];
    });
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
    const requests = new Set(matches.filter(match => !match.duplicateOf && !match.stage && !match.round && match.timestamp && Date.parse(match.timestamp) <= Date.now() && competitionSource(match))
        .map(match => `${competitionSource(match)}|${match.timestamp.slice(0, 4)}`));
    const stages = new Map();
    for (const request of requests) {
        const [source, year] = request.split('|');
        const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${source}/scoreboard?dates=${year}&limit=1000`, { signal: AbortSignal.timeout(20000) });
        if (!response.ok) throw new Error(`Stage provider HTTP ${response.status}`);
        const page = await response.json();
        if (!Array.isArray(page.events)) throw new Error('Invalid stage provider response');
        if (page.events.length >= 1000) throw new Error('Stage provider response may be truncated');
        for (const [key, value] of sourceStages(source, page.events)) stages.set(key, value);
    }
    const planned = planRecovery(matches, stages);
    console.log(JSON.stringify({ mode: apply ? 'apply' : 'preview', providerRequests: requests.size, planned: planned.length, matches: planned.map(({ name, updateTime, ...summary }) => summary) }, null, 2));
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

module.exports = { teamKey, competitionSource, fixtureKey, sourceStages, planRecovery };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });