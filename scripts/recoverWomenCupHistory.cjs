const { execSync } = require('node:child_process');
const path = require('node:path');
const { decode } = require('./recoverCupData.cjs');
const { cupTeamKey, fetchCupRecords, matchingCupRecord } = require('../functions/lib/cupData');
const { fixtureIdentity } = require('../functions/lib/matchSync');

// ESPN retains the on-field 0–9 despite Barça's subsequent disqualification.
const EXCLUDED_EVENTS = new Set(['658106']);

function isWomen(match) {
    return match.category === 'femenino' || /women|femen|reina|liga f/i.test(match.competition?.name || '');
}

function planHistory(matches, originalMappings, records, now = Date.now()) {
    const mappings = structuredClone(originalMappings);
    if (!mappings?.matches || !mappings.teams || !Number.isInteger(mappings.nextMatchId) || !Number.isInteger(mappings.nextTeamId)) {
        throw new Error('Existing ordinal mappings required');
    }
    const existing = matches.filter(match => !match.duplicateOf && isWomen(match));
    const cup = existing.find(match => /copa.*reina/i.test(match.competition?.name || ''));
    if (!cup?.competition?.id) throw new Error('Existing Copa de la Reina competition required');
    const teams = new Map();
    for (const match of existing) for (const team of [match.homeTeam, match.awayTeam]) {
        if (team?.id && team.name) teams.set(cupTeamKey(team.name), team);
    }
    const newTeams = [];
    const planned = [];
    const excluded = [];
    const seen = new Set();
    for (const record of [...records].sort((a, b) => a.date.localeCompare(b.date))) {
        if (EXCLUDED_EVENTS.has(record.eventId)) { excluded.push(record.eventId); continue; }
        if (!record.homeId || !record.awayId || !Number.isInteger(record.homeScore) || !Number.isInteger(record.awayScore)
            || record.homeScore < 0 || record.awayScore < 0 || !Number.isFinite(Date.parse(record.date))
            || Date.parse(record.date) >= now || (record.homeId !== '20091' && record.awayId !== '20091')) continue;
        if (records.filter(other => matchingCupRecord(record.date, record.home, record.away, [other])).length !== 1) continue;
        if (existing.some(match => match.timestamp && matchingCupRecord(match.timestamp, match.homeTeam.name, match.awayTeam.name, [record]))) continue;
        const identity = fixtureIdentity(record.date, record.home, record.away, 'Copa de la Reina', 'femenino');
        const apiId = `espn_copa_reina_${record.eventId}`;
        if (seen.has(identity) || mappings.matches[identity] || mappings.matches[apiId]) continue;
        seen.add(identity);
        const team = (name, providerId, badge) => {
            const key = cupTeamKey(name);
            const known = teams.get(key);
            if (known) return { id: String(known.id), name: known.name, shortName: known.shortName || known.name, badge: known.badge || badge || null };
            const apiKey = `espn_women_team_${providerId}`;
            if (mappings.teams[apiKey]) throw new Error(`Mapped team absent from existing fixtures: ${providerId}`);
            const id = String(mappings.nextTeamId++);
            mappings.teams[apiKey] = Number(id);
            const added = { id, name, shortName: name, badge: badge || null };
            teams.set(key, added);
            newTeams.push(added);
            return added;
        };
        const id = String(mappings.nextMatchId++);
        mappings.matches[identity] = Number(id);
        mappings.matches[apiId] = Number(id);
        planned.push({ id, data: {
            apiId, category: 'femenino', competition: cup.competition, league: String(cup.competition.id),
            timestamp: record.date, status: 'finished', homeScore: record.homeScore, awayScore: record.awayScore, scorePending: false,
            homeTeam: team(record.home, record.homeId, record.homeBadge), awayTeam: team(record.away, record.awayId, record.awayBadge),
            scoreSource: 'espn-cup-history', scoreSourceEventId: record.eventId,
            scoreSourceUrl: `https://www.espn.com/soccer/match/_/gameId/${record.eventId}`,
            ...(record.stage ? { stage: record.stage, stageSource: 'espn', stageSourceEventId: record.eventId } : {}),
        } });
    }
    return { mappings, planned, newTeams, excluded };
}

async function main() {
    const apply = process.argv.includes('--apply');
    const gcloud = path.join(process.env.LOCALAPPDATA, 'Google', 'Cloud SDK', 'google-cloud-sdk', 'bin', 'gcloud.cmd');
    const token = execSync(`"${gcloud}" auth print-access-token`, { encoding: 'utf8', windowsHide: true }).trim();
    const root = 'https://firestore.googleapis.com/v1/projects/trobar-1123f/databases/(default)/documents';
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const request = async (url, options = {}) => {
        const response = await fetch(url, { ...options, headers, signal: AbortSignal.timeout(20000) });
        if (!response.ok) throw new Error(`Firestore HTTP ${response.status}`);
        return response.json();
    };
    const fields = object => Object.fromEntries(Object.entries(object).map(([key, value]) => [key, encode(value)]));
    const encode = value => value === null ? { nullValue: null } : typeof value === 'string' ? { stringValue: value }
        : typeof value === 'number' ? { integerValue: String(value) } : typeof value === 'boolean' ? { booleanValue: value }
        : { mapValue: { fields: fields(value) } };
    const unpack = document => Object.fromEntries(Object.entries(document.fields).map(([key, value]) => [key, decode(value)]));
    {
        const matches = [];
        let next = '';
        do {
            const page = await request(`${root}/matches?pageSize=1000&pageToken=${encodeURIComponent(next)}`);
            matches.push(...(page.documents || []).map(document => ({ ...unpack(document), id: document.name.split('/').pop() })));
            next = page.nextPageToken || '';
        } while (next);
        const records = [];
        for (const year of ['2022', '2023', '2024', '2025', '2026']) records.push(...await fetchCupRecords('esp.copa_de_la_reina', year));
        const mappingDocument = await request(`${root}/system/id_mappings`);
        const mappings = unpack(mappingDocument);
        const preview = planHistory(matches, mappings, records);
        const summary = plan => ({ mode: apply ? 'apply' : 'preview', fixtures: plan.planned.length, newTeams: plan.newTeams,
            excludedEvents: plan.excluded, matches: plan.planned.map(({ id, data }) => ({
                id, date: data.timestamp, home: data.homeTeam.name, away: data.awayTeam.name,
                score: [data.homeScore, data.awayScore], eventId: data.scoreSourceEventId, stage: data.stage,
            })) });
        console.log(JSON.stringify(summary(preview), null, 2));
        if (!apply || !preview.planned.length) return;
        const documentRoot = root.replace('https://firestore.googleapis.com/v1/', '');
        const writes = preview.planned.map(entry => ({
            update: { name: `${documentRoot}/matches/${entry.id}`, fields: {
                ...fields(entry.data), timestamp: { timestampValue: new Date(entry.data.timestamp).toISOString() },
                recoveredAt: { timestampValue: new Date().toISOString() },
            } },
            currentDocument: { exists: false },
        }));
        for (const team of preview.newTeams) writes.push({ update: { name: `${documentRoot}/teams/${team.id}`, fields: fields(team) }, currentDocument: { exists: false } });
        writes.push({ update: { name: mappingDocument.name, fields: fields(preview.mappings) }, currentDocument: { updateTime: mappingDocument.updateTime } });
        await request(`${root}:commit`, { method: 'POST', body: JSON.stringify({ writes }) });
        const saved = await Promise.all(preview.planned.map(entry => request(`${root}/matches/${entry.id}`)));
        for (let i = 0; i < saved.length; i++) {
            const actual = unpack(saved[i]);
            const expected = preview.planned[i].data;
            if (!actual || actual.homeScore !== expected.homeScore || actual.awayScore !== expected.awayScore
                || actual.status !== 'finished' || actual.scoreSourceEventId !== expected.scoreSourceEventId) throw new Error('Persisted result verification failed');
        }
        console.log(JSON.stringify({ verifiedCreatedMatchIds: preview.planned.map(entry => entry.id), createdTeams: preview.newTeams.map(team => team.id), updatedMappingDocuments: ['system/id_mappings'] }));
    }
}

module.exports = { planHistory, EXCLUDED_EVENTS };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
