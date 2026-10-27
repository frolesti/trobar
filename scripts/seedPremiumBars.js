const { execSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const PROJECT = 'trobar-1123f';
const FIXTURE_SET = 'terrassa-premium-v1';
const FIXTURE_IDS = ['test-terrassa-pantalles', 'test-terrassa-terrassa', 'test-terrassa-accessible'];

function buildFixtures(matches, ownerId, now = Date.now()) {
    const future = matches.filter(match => {
        const date = new Date(match.timestamp || match.date);
        return !match.duplicateOf && !['finished', 'postponed'].includes(match.status)
            && date.getTime() > now && match.timeConfirmed !== false
            && (match.timeConfirmed === true || date.getUTCHours() !== 0 || date.getUTCMinutes() !== 0);
    }).sort((first, second) => new Date(first.timestamp || first.date) - new Date(second.timestamp || second.date));
    const women = future.filter(match => match.category === 'femenino');
    const men = future.filter(match => match.category !== 'femenino');
    if (!men.length || !women.length) throw new Error('Calen partits futurs reals amb horari confirmat de totes dues categories. No es crearan partits ficticis.');
    const photo = 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80';
    const definitions = [
        { name: 'PROVA - Pantalles Terrassa', latitude: 41.5635, longitude: 2.0102, amenities: ['projector', 'multiple_screens', 'wifi', 'reservations', 'food_served'], broadcasts: [men[0], women[0]] },
        { name: 'PROVA - Terrassa exterior', latitude: 41.5657, longitude: 2.0088, amenities: ['outdoor_seating', 'pet_friendly', 'wifi', 'craft_beer'], broadcasts: [men[1] || men[0]] },
        { name: 'PROVA - Accessible Terrassa', latitude: 41.5618, longitude: 2.0135, amenities: ['accessible', 'air_conditioning', 'multiple_screens', 'parking'], broadcasts: [women[1] || women[0]] },
    ];
    return definitions.map(({ broadcasts, ...definition }, index) => ({
        id: FIXTURE_IDS[index], ...definition,
        ownerId, tier: 'premium', source: 'verified', isActive: true, isOpen: true,
        isTestData: true, testFixtureSet: FIXTURE_SET,
        address: 'Ubicacio simulada de proves, Terrassa. No es un negoci real.',
        description: 'Bar fictici per provar el perfil premium, els serveis i les emissions. Fotos illustratives; no representa un establiment real.',
        promotionalText: 'Perfil de proves - sense subscripcio ni cobraments reals',
        image: photo, gallery: [photo], rating: 0,
        usuallyShowsBarca: false,
        broadcastingMatches: [...new Set(broadcasts.map(match => match.id))],
    }));
}

function decode(value) {
    if ('arrayValue' in value) return (value.arrayValue.values || []).map(decode);
    if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, field]) => [key, decode(field)]));
    if ('nullValue' in value) return null;
    if ('integerValue' in value) return Number(value.integerValue);
    return value.stringValue ?? value.doubleValue ?? value.timestampValue ?? value.booleanValue;
}

function encode(value) {
    if (value === null) return { nullValue: null };
    if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
    if (typeof value === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, field]) => [key, encode(field)])) } };
    if (typeof value === 'boolean') return { booleanValue: value };
    if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
    return { stringValue: value };
}

function planWrites(root, fixtures, existing, profile, owner, ownerEmail) {
    if (!root.startsWith('projects/')) throw new Error('Cal el nom de recurs de Firestore, no una URL.');
    const fields = value => encode(value).mapValue.fields;
    const ownerId = fixtures[0].ownerId;
    const writes = fixtures.filter(bar => !existing.includes(bar.id)).map(({ id, ...bar }) => ({
        update: { name: `${root}/bars/${id}`, fields: fields(bar) },
        currentDocument: { exists: false },
        updateTransforms: ['createdAt', 'updatedAt', 'verifiedAt'].map(fieldPath => ({ fieldPath, setToServerValue: 'REQUEST_TIME' })),
    }));
    writes.push({
        update: { name: profile?.name || `${root}/users/${ownerId}`, fields: fields({ role: 'bar_owner', ownedBars: FIXTURE_IDS, testBarFixtureSet: FIXTURE_SET }) },
        updateMask: { fieldPaths: ['role', 'ownedBars', 'testBarFixtureSet'] },
        currentDocument: profile ? { updateTime: profile.updateTime } : { exists: false },
    });
    if (!owner) writes.push({
        update: { name: `${root}/barOwners/${ownerId}`, fields: fields({ uid: ownerId, email: ownerEmail, barId: fixtures[0].id, barName: fixtures[0].name, role: 'bar_owner', isTestData: true, testFixtureSet: FIXTURE_SET }) },
        currentDocument: { exists: false },
        updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
    });
    return writes;
}

async function main() {
    const ownerEmail = process.argv.find(argument => argument.startsWith('--owner-email='))?.split('=').slice(1).join('=');
    if (!ownerEmail) throw new Error('Indica --owner-email=correu. La previsualitzacio no escriu dades.');
    const apply = process.argv.includes('--apply');
    const gcloud = path.join(process.env.LOCALAPPDATA, 'Google/Cloud SDK/google-cloud-sdk/bin/gcloud.cmd');
    const token = execSync(`"${gcloud}" auth print-access-token`, { encoding: 'utf8', windowsHide: true }).trim();
    const request = async (url, body) => {
        const response = await fetch(url, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-goog-user-project': PROJECT }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) });
        if (response.status === 404 && !body) return null;
        if (!response.ok) throw new Error(`Consulta de dades HTTP ${response.status}: ${(await response.json()).error?.message || 'Error'}`);
        return response.json();
    };
    const resource = `projects/${PROJECT}/databases/(default)/documents`;
    const root = `https://firestore.googleapis.com/v1/${resource}`;
    const account = (await request(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:lookup`, { email: [ownerEmail] })).users?.[0];
    if (!account) throw new Error('El compte indicat no existeix a Firebase Auth. Registra\'l a l\'app abans de vincular-hi els bars de prova.');
    const profile = await request(`${root}/users/${account.localId}`);
    const owner = await request(`${root}/barOwners/${account.localId}`);
    const data = document => document ? Object.fromEntries(Object.entries(document.fields || {}).map(([key, value]) => [key, decode(value)])) : {};
    const profileData = data(profile);
    const ownerData = data(owner);
    const claims = JSON.parse(account.customAttributes || '{}');
    if (claims.role === 'admin' || profileData.role === 'admin') throw new Error('No es canviara el rol d\'un compte administrador. Fes servir un compte de proves separat.');
    if (ownerData.barId && !FIXTURE_IDS.includes(ownerData.barId)) throw new Error('El compte ja te un bar real associat. No es reemplaçara.');
    if ((profileData.ownedBars || []).some(id => !FIXTURE_IDS.includes(id))) throw new Error('El compte ja te bars aliens a aquestes proves. No es modificaran.');
    if (ownerData.stripeCustomerId || ownerData.stripeSubscriptionId) throw new Error('El compte te dades de facturacio real. No es modificara.');
    const matches = [];
    let next = '';
    do {
        const page = await request(`${root}/matches?pageSize=1000&pageToken=${encodeURIComponent(next)}`);
        matches.push(...(page.documents || []).map(document => ({ ...data(document), id: document.name.split('/').pop() })));
        next = page.nextPageToken || '';
    } while (next);
    const fixtures = buildFixtures(matches, account.localId);
    const existing = [];
    for (const bar of fixtures) {
        const document = await request(`${root}/bars/${bar.id}`);
        if (document && (data(document).testFixtureSet !== FIXTURE_SET || data(document).ownerId !== account.localId)) throw new Error('Un identificador de prova coincideix amb dades alienes. No es sobreescriuran.');
        if (document) existing.push(bar.id);
    }
    console.log(JSON.stringify({ mode: 'preview', project: PROJECT, ownerEmail, currentRole: profileData.role || claims.role || 'user', existingFixtures: existing.length, primaryBar: fixtures[0].name, bars: fixtures.map(({ ownerId, ...bar }) => bar), matches: matches.filter(match => fixtures.some(bar => bar.broadcastingMatches.includes(match.id))).map(match => ({ id: match.id, homeTeam: match.homeTeam?.name || match.homeTeam, awayTeam: match.awayTeam?.name || match.awayTeam, category: match.category, timestamp: match.timestamp })) }, null, 2));
    if (!apply) return;
    const backupPath = path.join(__dirname, '../.expo/terrassa-premium-backup.json');
    fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    if (fs.existsSync(backupPath)) {
        if (JSON.parse(fs.readFileSync(backupPath, 'utf8')).ownerId !== account.localId) throw new Error('La copia de seguretat pertany a un altre compte. No es sobreescriura.');
    } else {
        fs.writeFileSync(backupPath, JSON.stringify({ project: PROJECT, fixtureSet: FIXTURE_SET, ownerId: account.localId, previousClaims: claims, profileBefore: profile ? { role: profile.fields.role, ownedBars: profile.fields.ownedBars, testBarFixtureSet: profile.fields.testBarFixtureSet } : null, ownerBefore: owner, createdFixtureIds: fixtures.filter(bar => !existing.includes(bar.id)).map(bar => bar.id) }, null, 2), { flag: 'wx' });
    }
    const authUpdate = attributes => request(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:update`, { localId: account.localId, customAttributes: JSON.stringify(attributes) });
    await authUpdate({ ...claims, role: 'bar_owner' });
    try {
        await request(`${root}:commit`, { writes: planWrites(resource, fixtures, existing, profile, owner, ownerEmail) });
    } catch (error) {
        await authUpdate(claims);
        throw error;
    }
    for (const fixture of fixtures) {
        const saved = data(await request(`${root}/bars/${fixture.id}`));
        if (saved.testFixtureSet !== FIXTURE_SET || saved.ownerId !== account.localId || saved.tier !== 'premium' || !saved.broadcastingMatches?.length) throw new Error('La verificacio posterior del bar ha fallat. Conserva la copia de seguretat.');
    }
    const savedProfile = data(await request(`${root}/users/${account.localId}`));
    const savedOwner = data(await request(`${root}/barOwners/${account.localId}`));
    if (savedProfile.role !== 'bar_owner' || savedOwner.barId !== fixtures[0].id) throw new Error('La verificacio del propietari ha fallat. Conserva la copia de seguretat.');
    console.log(JSON.stringify({ mode: 'applied-and-verified', created: fixtures.length - existing.length, retained: existing.length, primaryBar: fixtures[0].name, role: savedProfile.role, billingCreated: false }));
}

module.exports = { buildFixtures, decode, encode, planWrites, FIXTURE_SET, FIXTURE_IDS };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
