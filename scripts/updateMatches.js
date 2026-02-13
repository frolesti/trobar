#!/usr/bin/env node
/**
 * scripts/updateMatches.js
 *
 * Syncs FC Barcelona data from football-data.org → Firestore.
 *
 * ─ Single API call  (GET /teams/81/matches)
 * ─ Ordinal IDs      (competitions 1,2,3… / teams 1,2,3… / matches 1,2,3…)
 * ─ Upsert only      (merge:true — never duplicates, only adds or updates)
 * ─ Local logos       (assets/img/competicions/ → Firebase Storage)
 *
 * Called automatically by `npm start` via devStart.js.
 * Manual:  node scripts/updateMatches.js [--force]
 */

require('dotenv').config();
const fs   = require('fs');
const path = require('path');

// ── Firebase (client SDK, works in Node 18+) ───────────────────────────────
const { initializeApp }  = require('firebase/app');
const {
    getFirestore, doc, getDoc, setDoc,
    writeBatch, serverTimestamp, Timestamp
} = require('firebase/firestore');
const { getStorage, ref, uploadBytes, getDownloadURL } = require('firebase/storage');

// ── Config ──────────────────────────────────────────────────────────────────
const API_KEY       = process.env.FOOTBALL_DATA_API_KEY;
const BASE_URL      = 'https://api.football-data.org/v4';
const BARCA_TEAM_ID = 81;
const COOLDOWN_MS   = 4 * 60 * 60 * 1000; // 4 h

const firebaseConfig = {
    apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app     = initializeApp(firebaseConfig);
const db      = getFirestore(app);
const storage = getStorage(app);

// ── Competition → local logo file mapping ───────────────────────────────────
//    football-data.org competition IDs we know + the filename in assets/img/competicions/
const COMP_LOGO_FILE = {
    2014: 'liga.png',           // Primera División (La Liga)
    2001: 'champions.png',     // UEFA Champions League
    2079: 'copa-del-rey.png',  // Copa del Rey
};

// Known Firebase Storage URLs (already uploaded previously) as reliable fallback
const LOGO_STORAGE_URLS = {
    'liga.png':           'https://firebasestorage.googleapis.com/v0/b/trobar-1123f.firebasestorage.app/o/competitions%2Flogos%2Fliga.png?alt=media&token=d035d3f5-5ab1-405f-861b-d94009c858f0',
    'champions.png':      'https://firebasestorage.googleapis.com/v0/b/trobar-1123f.firebasestorage.app/o/competitions%2Flogos%2Fchampions.png?alt=media&token=eafb909f-a41d-463a-81ee-c3fbbbb5a98d',
    'champions-w.png':    'https://firebasestorage.googleapis.com/v0/b/trobar-1123f.firebasestorage.app/o/competitions%2Flogos%2Fchampions-w.png?alt=media&token=ff772840-f75e-4d8b-9c1e-3a42ac395237',
    'copa-del-rey.png':   'https://firebasestorage.googleapis.com/v0/b/trobar-1123f.firebasestorage.app/o/competitions%2Flogos%2Fcopa-del-rey.png?alt=media&token=d66387f6-cb30-4e4f-bedd-1703d26d7171',
    'copa-reina.png':     'https://firebasestorage.googleapis.com/v0/b/trobar-1123f.firebasestorage.app/o/competitions%2Flogos%2Fcopa-reina.png?alt=media',
    'ligaf.png':          'https://firebasestorage.googleapis.com/v0/b/trobar-1123f.firebasestorage.app/o/competitions%2Flogos%2Fligaf.png?alt=media&token=46bfc314-95d9-4a7d-862a-ef477389ebd6',
};

// Name-based fallback when competition ID is unknown
function guessLogoFile(name) {
    const l = name.toLowerCase();
    if (l.includes('women') && l.includes('champions'))           return 'champions-w.png';
    if (l.includes('champions'))                                   return 'champions.png';
    if (l.includes('copa del rey') || l.includes("king's cup"))   return 'copa-del-rey.png';
    if (l.includes('copa de la reina'))                            return 'copa-reina.png';
    if (l.includes('liga f') || (l.includes('liga') && l.includes('women'))) return 'ligaf.png';
    if (l.includes('primera') || l.includes('la liga') || l.includes('liga')) return 'liga.png';
    return null;
}

// ── Logo upload ─────────────────────────────────────────────────────────────
async function resolveLogoUrl(filename) {
    if (!filename) return null;

    // 1. Try uploading from the local assets folder
    const localPath = path.resolve(__dirname, '..', 'assets', 'img', 'competicions', filename);
    if (fs.existsSync(localPath)) {
        try {
            const buffer   = fs.readFileSync(localPath);
            const storRef  = ref(storage, `competitions/logos/${filename}`);
            await uploadBytes(storRef, new Uint8Array(buffer), { contentType: 'image/png' });
            const url = await getDownloadURL(storRef);
            console.log(`   📤 Uploaded ${filename} → Storage`);
            return url;
        } catch (e) {
            console.warn(`   ⚠️  Upload failed for ${filename}: ${e.message || e}`);
        }
    }

    // 2. Fall back to known Storage URL
    if (LOGO_STORAGE_URLS[filename]) {
        console.log(`   🔗 Using cached Storage URL for ${filename}`);
        return LOGO_STORAGE_URLS[filename];
    }

    return null;
}

// ── Status mapper ───────────────────────────────────────────────────────────
function mapStatus(st) {
    switch (st) {
        case 'FINISHED': case 'AWARDED':                     return 'finished';
        case 'IN_PLAY':  case 'PAUSED':                      return 'live';
        case 'POSTPONED': case 'SUSPENDED': case 'CANCELLED': return 'postponed';
        default:                                              return 'scheduled';
    }
}

// ── Ordinal-ID helper ───────────────────────────────────────────────────────
//    Persisted in Firestore as  system/id_mappings  so subsequent runs reuse
//    the same ordinal for the same API entity.
function createIdManager(mappings) {
    return {
        comp(apiId) {
            const k = String(apiId);
            if (mappings.competitions[k]) return mappings.competitions[k];
            const id = mappings.nextCompId;
            mappings.competitions[k] = id;
            mappings.nextCompId = id + 1;
            return id;
        },
        team(apiId) {
            const k = String(apiId);
            if (mappings.teams[k]) return mappings.teams[k];
            const id = mappings.nextTeamId;
            mappings.teams[k] = id;
            mappings.nextTeamId = id + 1;
            return id;
        },
        match(apiId) {
            const k = String(apiId);
            if (mappings.matches[k]) return mappings.matches[k];
            const id = mappings.nextMatchId;
            mappings.matches[k] = id;
            mappings.nextMatchId = id + 1;
            return id;
        },
    };
}

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════════════════
async function main() {
    if (!API_KEY) {
        console.error('❌ FOOTBALL_DATA_API_KEY not set in .env');
        return;
    }

    const force = process.argv.includes('--force');

    // ── 1.  Cooldown check ──────────────────────────────────────────────────
    const metaRef  = doc(db, 'system', 'sync_status');
    const metaSnap = await getDoc(metaRef);

    if (!force && metaSnap.exists()) {
        const last    = metaSnap.data().lastUpdated?.toMillis() || 0;
        const elapsed = Date.now() - last;
        if (elapsed < COOLDOWN_MS) {
            const mins = Math.round(elapsed / 60000);
            console.log(`⏳ Data is fresh (synced ${mins} min ago). Use --force to override.`);
            return;
        }
    }

    // ── 2.  Load / init ordinal-ID mappings ─────────────────────────────────
    const mapRef  = doc(db, 'system', 'id_mappings');
    const mapSnap = await getDoc(mapRef);
    const mappings = mapSnap.exists() ? mapSnap.data() : {
        competitions: {},
        teams:        {},
        matches:      {},
        nextCompId:   1,
        nextTeamId:   1,
        nextMatchId:  1,
    };
    const ids = createIdManager(mappings);

    // ── 3.  Single API call ─────────────────────────────────────────────────
    console.log('🌍 football-data.org  →  GET /teams/81/matches …');
    const res = await fetch(`${BASE_URL}/teams/${BARCA_TEAM_ID}/matches?limit=200`, {
        headers: { 'X-Auth-Token': API_KEY },
    });

    if (res.status === 429) { console.warn('⚠️  Rate-limit hit. Try again later.'); return; }
    if (!res.ok) { console.error(`❌ API ${res.status}: ${res.statusText}`); return; }

    const json    = await res.json();
    const apiMatches = json.matches || [];
    console.log(`📊 ${apiMatches.length} matches received.`);
    if (apiMatches.length === 0) { console.log('⚠️  Nothing to sync.'); return; }

    // ── 4.  Extract unique competitions & teams ─────────────────────────────
    const compsRaw  = new Map();   // apiId → { name, emblem }
    const teamsRaw  = new Map();   // apiId → { name, shortName, tla, crest }

    for (const m of apiMatches) {
        if (!compsRaw.has(m.competition.id)) {
            compsRaw.set(m.competition.id, {
                name:   m.competition.name,
                emblem: m.competition.emblem,
            });
        }
        for (const t of [m.homeTeam, m.awayTeam]) {
            if (!teamsRaw.has(t.id)) {
                teamsRaw.set(t.id, {
                    name:      t.name,
                    shortName: t.shortName || t.name,
                    tla:       t.tla,
                    crest:     t.crest,
                });
            }
        }
    }

    console.log(`🏆 ${compsRaw.size} competitions   ⚽ ${teamsRaw.size} teams`);

    // ── 5.  Resolve logos ───────────────────────────────────────────────────
    console.log('🖼️  Resolving competition logos…');
    const compDocs = {};
    for (const [apiId, c] of compsRaw) {
        const ordId    = ids.comp(apiId);
        const logoFile = COMP_LOGO_FILE[apiId] || guessLogoFile(c.name);
        let   logoUrl  = c.emblem;                         // default = API emblem

        if (logoFile) {
            const resolved = await resolveLogoUrl(logoFile);
            if (resolved) logoUrl = resolved;
        }

        compDocs[ordId] = {
            name:      c.name,
            logo:      logoUrl,
            apiId:     apiId,
            updatedAt: serverTimestamp(),
        };
    }

    // ── 6.  Build team docs ─────────────────────────────────────────────────
    const teamDocs = {};
    for (const [apiId, t] of teamsRaw) {
        const ordId = ids.team(apiId);
        teamDocs[ordId] = {
            name:      t.name,
            shortName: t.shortName,
            tla:       t.tla,
            badge:     t.crest,
            apiId:     apiId,
            updatedAt: serverTimestamp(),
        };
    }

    // ── 7.  Build match docs (denormalized team/comp objects) ────────────────
    const matchDocs = {};
    for (const m of apiMatches) {
        const ordId      = ids.match(m.id);
        const compOrdId  = ids.comp(m.competition.id);
        const homeOrdId  = ids.team(m.homeTeam.id);
        const awayOrdId  = ids.team(m.awayTeam.id);
        const homeRaw    = teamsRaw.get(m.homeTeam.id);
        const awayRaw    = teamsRaw.get(m.awayTeam.id);
        const compDoc    = compDocs[compOrdId];
        const matchDate  = new Date(m.utcDate);

        const isWomen =
            m.competition.name.toLowerCase().includes('women') ||
            m.competition.name.toLowerCase().includes('femenin');

        matchDocs[ordId] = {
            homeTeam: {
                id:        String(homeOrdId),
                name:      homeRaw.name,
                shortName: homeRaw.shortName,
                badge:     homeRaw.crest,
            },
            awayTeam: {
                id:        String(awayOrdId),
                name:      awayRaw.name,
                shortName: awayRaw.shortName,
                badge:     awayRaw.crest,
            },
            league: String(compOrdId),
            competition: {
                id:   String(compOrdId),
                name: compDoc.name,
                logo: compDoc.logo,
            },
            timestamp:  Timestamp.fromDate(matchDate),
            status:     mapStatus(m.status),
            homeScore:  m.score?.fullTime?.home ?? null,
            awayScore:  m.score?.fullTime?.away ?? null,
            category:   isWomen ? 'femenino' : 'masculino',
            apiId:      m.id,
            updatedAt:  serverTimestamp(),
        };
    }

    // ── 8.  Write to Firestore (batch, max ~450 ops) ────────────────────────
    console.log('💾 Writing to Firestore…');
    let batch   = writeBatch(db);
    let ops     = 0;
    const LIMIT = 450;

    async function flush() {
        if (ops > 0) { await batch.commit(); batch = writeBatch(db); ops = 0; }
    }

    for (const [id, data] of Object.entries(compDocs)) {
        batch.set(doc(db, 'competitions', String(id)), data, { merge: true });
        if (++ops >= LIMIT) await flush();
    }
    for (const [id, data] of Object.entries(teamDocs)) {
        batch.set(doc(db, 'teams', String(id)), data, { merge: true });
        if (++ops >= LIMIT) await flush();
    }
    for (const [id, data] of Object.entries(matchDocs)) {
        batch.set(doc(db, 'matches', String(id)), data, { merge: true });
        if (++ops >= LIMIT) await flush();
    }
    await flush();

    // ── 9.  Persist mappings & metadata ─────────────────────────────────────
    await setDoc(mapRef, mappings);
    await setDoc(metaRef, {
        lastUpdated:      serverTimestamp(),
        provider:         'football-data.org',
        matchCount:       apiMatches.length,
        competitionCount: compsRaw.size,
        teamCount:        teamsRaw.size,
    });

    console.log(`✅ Sync complete — ${Object.keys(compDocs).length} competitions, ` +
                `${Object.keys(teamDocs).length} teams, ${Object.keys(matchDocs).length} matches.`);
}

// ── Run ─────────────────────────────────────────────────────────────────────
main()
    .then(() => process.exit(0))
    .catch(err => { console.error('❌ Fatal:', err); process.exit(1); });

