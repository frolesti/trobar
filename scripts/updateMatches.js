#!/usr/bin/env node
/**
 * scripts/updateMatches.js
 *
 * Syncs FC Barcelona data → Firestore.
 *
 * ─ Men:    football-data.org API  (GET /teams/81/matches)
 * ─ Women:  ICS calendar feed     (fixtur.es — free, no API key needed)
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

// ── api-football.com helpers ────────────────────────────────────────────────
//    (Kept for future use if paid plan is acquired. Not used on free tier
//    because season 2025+ is blocked.)

// ── Global crest fallback map (team name → api-sports logo URL) ─────────────
const GLOBAL_CREST_FALLBACKS = {
    // Women's teams (ICS)
    'Rosengård':                 'https://media.api-sports.io/football/teams/6694.png',
    'Alhama':                    'https://media.api-sports.io/football/teams/19895.png',
    'Brann':                     'https://media.api-sports.io/football/teams/319.png',
    'Logroño':                   'https://media.api-sports.io/football/teams/1923.png',
    'Avaldsnes IL':              'https://media.api-sports.io/football/teams/15950.png',
    'Villarreal':                'https://media.api-sports.io/football/teams/17169.png',
    'Sporting de Huelva':        'https://media.api-sports.io/football/teams/1916.png',
    'Rayo Vallecano':            'https://media.api-sports.io/football/teams/1914.png',
    'Bayern Munchen Frauen':     'https://media.api-sports.io/football/teams/1860.png',
    'Granadilla Tenerife':       'https://media.api-sports.io/football/teams/1913.png',
    'Deportivo Alavés':          'https://media.api-sports.io/football/teams/17168.png',
    // Men's Copa del Rey teams (ICS)
    'C.F. Villanovense':         'https://media.api-sports.io/football/teams/5282.png',
    'Athletic de Bilbao':        'https://media.api-sports.io/football/teams/531.png',
    'Athletic Club':             'https://media.api-sports.io/football/teams/531.png',
    'Hercules CF':               'https://media.api-sports.io/football/teams/1264.png',
    'Real Murcia':               'https://media.api-sports.io/football/teams/5275.png',
    'Celta de Vigo':             'https://media.api-sports.io/football/teams/538.png',
    'CyD Leonesa':               'https://media.api-sports.io/football/teams/725.png',
    'Levante':                   'https://media.api-sports.io/football/teams/539.png',
    'Ibiza':                     'https://media.api-sports.io/football/teams/9390.png',
    'UE Cornella':               'https://media.api-sports.io/football/teams/5258.png',
    'Granada CF':                'https://media.api-sports.io/football/teams/715.png',
    'Linares Deportivo':         'https://media.api-sports.io/football/teams/9398.png',
    'Intercity':                 'https://media.api-sports.io/football/teams/8160.png',
    'AD Ceuta FC':               'https://media.api-sports.io/football/teams/10139.png',
    'UD Barbastro':              'https://media.api-sports.io/football/teams/9879.png',
    'Unionistas de Salamanca':   'https://media.api-sports.io/football/teams/5281.png',
    'Guadalajara':               'https://media.api-sports.io/football/teams/9900.png',
    'Racing de Santander':       'https://media.api-sports.io/football/teams/4665.png',
    'Albacete':                  'https://media.api-sports.io/football/teams/722.png',
};

// ── ICS calendar parser (free, no API key needed) ──────────────────────────
//    Parses fixtur.es ICS feed → football-data.org match shape.
//    IDs are prefixed with "ics_" to avoid collisions.
function parseICSFeed(icsText, teamLabel) {
    const events = icsText.split('BEGIN:VEVENT').slice(1);
    const matches = [];

    for (const block of events) {
        const dtMatch   = block.match(/DTSTART:(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?/);
        const sumMatch  = block.match(/SUMMARY:(.+)/);
        const uidMatch  = block.match(/UID:(.+)/);
        // ICS DESCRIPTION pot ser multilínia (continuació amb espai/tab)
        const descRaw   = block.match(/DESCRIPTION:([\s\S]*?)(?=\r?\n[A-Z])/);
        const descMatch = descRaw ? [null, descRaw[1].replace(/\r?\n[ \t]/g, '').trim()] : block.match(/DESCRIPTION:(.+)/);
        if (!dtMatch || !sumMatch) continue;

        const [, yr, mo, dy, hh, mm, ss] = dtMatch;
        const utcDate = `${yr}-${mo}-${dy}T${hh}:${mm}:${ss}Z`;
        const summary = sumMatch[1].trim();
        const uid     = (uidMatch?.[1] || '').trim();

        // Parse: "Home Team - Away Team (score)" or "Home Team - Away Team [competition]"
        // Variants: "Team A - Team B (3-1)", "Team A - Team B [CL]", "Team A - Team B [CL] (3-1)"
        const compTag = summary.match(/\[([^\]]+)\]/)?.[1] || '';
        const cleaned = summary.replace(/\s*\[[^\]]*\]\s*/g, '').trim();
        const scoreMatch = cleaned.match(/\((\d+)-(\d+)\)\s*$/);
        const teamsStr   = cleaned.replace(/\s*\(\d+-\d+\)\s*$/, '').trim();
        const parts      = teamsStr.split(/\s+-\s+/);
        if (parts.length < 2) continue;

        const homeName = parts[0].replace(/ Women$/i, '').trim();
        const awayName = parts.slice(1).join(' - ').replace(/ Women$/i, '').trim();

        // Determine competition from tag + description + summary
        const desc = (descMatch?.[1] || '').trim();
        // Also check for LOCATION field (some ICS feeds put competition there)
        const locMatch = block.match(/LOCATION:(.+)/);
        const locText = (locMatch?.[1] || '').trim();
        let compName, compId;
        const tagL = compTag.toLowerCase();
        const descL = desc.toLowerCase();
        const locL = locText.toLowerCase();
        const summaryL = summary.toLowerCase();
        // Check tag first, then description + location + summary as fallback
        const combined = `${tagL} ${descL} ${locL} ${summaryL}`;
        if (tagL === 'cl' || tagL === 'ucl' || tagL === 'uwcl' || combined.includes('champion')) {
            compName = 'UEFA Women\'s Champions League';
            compId   = 'ics_uwcl';
        } else if (combined.includes('copa') || combined.includes('cup') || combined.includes('reina') || combined.includes('queen')) {
            compName = 'Copa de la Reina';
            compId   = 'ics_copa_reina';
        } else if (combined.includes('super')) {
            compName = 'Supercopa Femenina';
            compId   = 'ics_supercopa_f';
        } else {
            compName = 'Liga F';
            compId   = 'ics_ligaf';
        }

        // Heuristic: if labeled as Liga F but opponent is non-Spanish → likely UWCL
        if (compId === 'ics_ligaf') {
            const SPANISH_KEYWORDS = [
                'madrid', 'atl\u00e9tico', 'atletico', 'real sociedad', 'athletic',
                'levante', 'sevilla', 'betis', 'deportivo', 'valencia', 'eibar',
                'logro\u00f1o', 'granada', 'tenerife', 'granadilla', 'huelva',
                'villarreal', 'alav\u00e9s', 'alaves', 'sporting', 'rayo',
                'osasuna', 'celta', 'mallorca', 'getafe', 'espanyol',
                'zaragoza', 'albacete', 'alhama', 'tacón', 'tac\u00f3n',
                'las planas',
            ];
            const oppName = (homeName.toLowerCase().includes('barcelona') ? awayName : homeName).toLowerCase();
            const isSpanish = SPANISH_KEYWORDS.some(kw => oppName.includes(kw));
            if (!isSpanish && !oppName.toLowerCase().includes('barcelona')) {
                compName = 'UEFA Women\'s Champions League';
                compId   = 'ics_uwcl';
            }
        }

        // Determine status
        const matchDate = new Date(utcDate);
        const now = new Date();
        let status;
        if (scoreMatch) {
            status = 'FINISHED';
        } else if (matchDate < now) {
            // Past match without score → assume finished (ICS may not update score)
            status = 'FINISHED';
        } else {
            status = 'SCHEDULED';
        }

        // Stable ID from UID hash
        const stableId = `ics_${uid.replace(/@.*$/, '').substring(0, 20)}`;

        matches.push({
            id:          stableId,
            competition: { id: compId, name: compName, emblem: null },
            homeTeam: {
                id:        `ics_${homeName.substring(0, 12).replace(/\s/g, '_').toLowerCase()}`,
                name:      homeName,
                shortName: homeName.length > 15 ? homeName.substring(0, 12) + '…' : homeName,
                tla:       homeName.substring(0, 3).toUpperCase(),
                crest:     null,
            },
            awayTeam: {
                id:        `ics_${awayName.substring(0, 12).replace(/\s/g, '_').toLowerCase()}`,
                name:      awayName,
                shortName: awayName.length > 15 ? awayName.substring(0, 12) + '…' : awayName,
                tla:       awayName.substring(0, 3).toUpperCase(),
                crest:     null,
            },
            utcDate,
            status,
            score: {
                fullTime: {
                    home: scoreMatch ? parseInt(scoreMatch[1]) : null,
                    away: scoreMatch ? parseInt(scoreMatch[2]) : null,
                },
            },
        });
    }

    return matches;
}

// ── Men's ICS parser (Copa del Rey only) ────────────────────────────────────
//    fixtur.es men's calendar includes [Copa] tagged events.
//    We ONLY extract Copa del Rey matches; La Liga + CL come from football-data.org.
function parseMenICSCopa(icsText) {
    const events = icsText.split('BEGIN:VEVENT').slice(1);
    const matches = [];

    for (const block of events) {
        const sumMatch = block.match(/SUMMARY:(.+)/);
        if (!sumMatch) continue;
        const summary = sumMatch[1].trim();

        // Only Copa del Rey
        if (!summary.includes('[Copa]')) continue;

        const dtMatch = block.match(/DTSTART:(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?/);
        const uidMatch = block.match(/UID:(.+)/);
        if (!dtMatch) continue;

        const [, yr, mo, dy, hh, mm, ss] = dtMatch;
        const utcDate = `${yr}-${mo}-${dy}T${hh}:${mm}:${ss}Z`;
        const uid = (uidMatch?.[1] || '').trim();

        const cleaned = summary.replace(/\s*\[[^\]]*\]\s*/g, '').trim();
        const scoreMatch = cleaned.match(/\((\d+)-(\d+)\)\s*$/);
        const teamsStr = cleaned.replace(/\s*\(\d+-\d+\)\s*$/, '').trim();
        const parts = teamsStr.split(/\s+-\s+/);
        if (parts.length < 2) continue;

        const homeName = parts[0].trim();
        const awayName = parts.slice(1).join(' - ').trim();

        const matchDate = new Date(utcDate);
        const now = new Date();
        let status;
        if (scoreMatch) {
            status = 'FINISHED';
        } else if (matchDate < now) {
            status = 'FINISHED';
        } else {
            status = 'SCHEDULED';
        }

        const stableId = `ics_copa_${uid.replace(/@.*$/, '').substring(0, 20)}`;

        matches.push({
            id:          stableId,
            competition: { id: 'ics_copa_del_rey', name: 'Copa del Rey', emblem: null },
            homeTeam: {
                id:        `ics_m_${homeName.substring(0, 12).replace(/\s/g, '_').toLowerCase()}`,
                name:      homeName,
                shortName: homeName.length > 15 ? homeName.substring(0, 12) + '…' : homeName,
                tla:       homeName.substring(0, 3).toUpperCase(),
                crest:     null,
            },
            awayTeam: {
                id:        `ics_m_${awayName.substring(0, 12).replace(/\s/g, '_').toLowerCase()}`,
                name:      awayName,
                shortName: awayName.length > 15 ? awayName.substring(0, 12) + '…' : awayName,
                tla:       awayName.substring(0, 3).toUpperCase(),
                crest:     null,
            },
            utcDate,
            status,
            score: {
                fullTime: {
                    home: scoreMatch ? parseInt(scoreMatch[1]) : null,
                    away: scoreMatch ? parseInt(scoreMatch[2]) : null,
                },
            },
            _isMenCopa: true,
        });
    }

    return matches;
}

// ── Backfill Liga F scores from api-football.com ────────────────────────────
//    Fetches past fixtures for FC Barcelona Women from api-football.com
//    and patches ICS matches that are missing scores.
async function backfillLigaFScores(icsMatches) {
    if (!API_FOOTBALL_KEY) {
        console.log('   ℹ️  No API_FOOTBALL_KEY — skipping Liga F score backfill.');
        return;
    }

    const now = new Date();
    const missingScores = icsMatches.filter(m =>
        m.status === 'FINISHED' &&
        m.score.fullTime.home === null &&
        new Date(m.utcDate) < now
    );

    if (missingScores.length === 0) {
        console.log('   ✅ All past women\'s matches have scores.');
        return;
    }

    console.log(`   🔍 Backfilling scores for ${missingScores.length} women's matches from api-football.com…`);

    const headers = { 'x-apisports-key': API_FOOTBALL_KEY };
    // FC Barcelona Femení team ID in api-football.com = 1918
    // Free tier: seasons 2022-2024. Season 2024 = Aug 2024 - May 2025 fixtures.
    const allFixtures = [];
    for (const season of [2023, 2024]) {
        for (const leagueId of [142, 525]) { // Liga F, UWCL
            try {
                const url = `${AF_BASE}/fixtures?team=1918&league=${leagueId}&season=${season}`;
                const res = await fetch(url, { headers });
                if (!res.ok) { console.warn(`   ⚠️  Fixtures API ${res.status} for league ${leagueId} season ${season}`); continue; }
                const json = await res.json();
                const fixtures = json.response || [];
                allFixtures.push(...fixtures);
            } catch (e) {
                console.warn(`   ⚠️  Fixtures failed league ${leagueId} season ${season}: ${e.message}`);
            }
        }
    }

    console.log(`   📊 Fetched ${allFixtures.length} fixtures from api-football.com for score matching.`);

    // Build a lookup by date (YYYY-MM-DD) + approximate team matching
    const normalize = s => s.toLowerCase()
        .replace(/ women$/i, '').replace(/ w$/i, '')
        .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
        .replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ñ/g, 'n')
        .replace(/[^a-z0-9]/g, '');

    let patched = 0;
    for (const m of missingScores) {
        const mDate = new Date(m.utcDate);
        const mDateStr = mDate.toISOString().substring(0, 10);
        const mHome = normalize(m.homeTeam.name);
        const mAway = normalize(m.awayTeam.name);

        // Find matching fixture (same day, same teams)
        const match = allFixtures.find(f => {
            if (!f.fixture?.date) return false;
            const fDateStr = f.fixture.date.substring(0, 10);
            if (fDateStr !== mDateStr) return false;
            const fHome = normalize(f.teams.home.name);
            const fAway = normalize(f.teams.away.name);
            return (fHome.includes(mHome) || mHome.includes(fHome)) &&
                   (fAway.includes(mAway) || mAway.includes(fAway));
        });

        if (match && match.goals.home !== null) {
            m.score.fullTime.home = match.goals.home;
            m.score.fullTime.away = match.goals.away;
            patched++;
        }
    }

    console.log(`   ✅ Backfilled ${patched}/${missingScores.length} missing scores.`);
}

// ── Resolve men's team crests (api-football.com → La Liga teams) ────────────
async function resolveMenCrests(db, copaMatches) {
    const needCrests = new Set();
    for (const m of copaMatches) {
        if (!m.homeTeam.crest) needCrests.add(m.homeTeam.name);
        if (!m.awayTeam.crest) needCrests.add(m.awayTeam.name);
    }
    if (needCrests.size === 0) return;

    // Load cached crests
    const cacheRef = doc(db, 'system', 'men_team_crests');
    const cacheSnap = await getDoc(cacheRef);
    const cached = cacheSnap.exists() ? cacheSnap.data() : {};

    const missing = [...needCrests].filter(name => !cached[name]);
    if (missing.length === 0) {
        // Apply and return
        for (const m of copaMatches) {
            if (!m.homeTeam.crest && cached[m.homeTeam.name]) m.homeTeam.crest = cached[m.homeTeam.name];
            if (!m.awayTeam.crest && cached[m.awayTeam.name]) m.awayTeam.crest = cached[m.awayTeam.name];
        }
        return;
    }

    console.log(`   🔍 Fetching crests for ${missing.length} Copa teams…`);
    const afTeams = new Map();

    // La Liga + Copa del Rey relevant → fetch La Liga teams (if API key available)
    if (API_FOOTBALL_KEY) {
        const headers = { 'x-apisports-key': API_FOOTBALL_KEY };
        for (const leagueId of [140]) { // La Liga
            try {
                const res = await fetch(`${AF_BASE}/teams?league=${leagueId}&season=2024`, { headers });
                if (!res.ok) continue;
                const json = await res.json();
                for (const t of (json.response || [])) {
                    if (t.team.logo) afTeams.set(t.team.name, t.team.logo);
                }
            } catch (e) { /* skip */ }
        }
    }

    const normalize = s => s.toLowerCase()
        .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
        .replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ñ/g, 'n')
        .replace(/[^a-z0-9]/g, '');
    const afEntries = [...afTeams.entries()].map(([n, url]) => [normalize(n), url, n]);

    for (const teamName of missing) {
        const norm = normalize(teamName);
        let found = afEntries.find(([n]) => n === norm);
        if (!found) found = afEntries.find(([n]) => n.includes(norm) || norm.includes(n));
        if (found) {
            cached[teamName] = found[1];
        } else if (GLOBAL_CREST_FALLBACKS[teamName]) {
            cached[teamName] = GLOBAL_CREST_FALLBACKS[teamName];
        }
    }

    await setDoc(cacheRef, cached);

    for (const m of copaMatches) {
        if (!m.homeTeam.crest && cached[m.homeTeam.name]) m.homeTeam.crest = cached[m.homeTeam.name];
        if (!m.awayTeam.crest && cached[m.awayTeam.name]) m.awayTeam.crest = cached[m.awayTeam.name];
    }

    const resolved = missing.filter(n => cached[n]).length;
    console.log(`   ✅ Resolved ${resolved}/${missing.length} men's Copa crests.`);
}

// ── Team crest resolution (api-football.com) ────────────────────────────────
//    Fetches crests for women's teams from api-football.com and caches them
//    in Firestore (system/women_team_crests) so subsequent runs are free.
const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY;
const AF_BASE          = 'https://v3.football.api-sports.io';

async function resolveWomenCrests(db, icsMatches) {
    // 1. Collect unique team names that need crests
    const needCrests = new Set();
    for (const m of icsMatches) {
        if (!m.homeTeam.crest) needCrests.add(m.homeTeam.name);
        if (!m.awayTeam.crest) needCrests.add(m.awayTeam.name);
    }
    if (needCrests.size === 0) return;

    // 2. Load cached crests from Firestore
    const cacheRef  = doc(db, 'system', 'women_team_crests');
    const cacheSnap = await getDoc(cacheRef);
    const cached    = cacheSnap.exists() ? cacheSnap.data() : {};

    // Check which teams still missing
    const missing = [...needCrests].filter(name => !cached[name]);
    if (missing.length === 0) {
        console.log(`   📋 All ${needCrests.size} team crests found in cache.`);
    } else if (!API_FOOTBALL_KEY) {
        console.log(`   ⚠️  ${missing.length} teams need crests but no API_FOOTBALL_KEY set.`);
    } else {
        console.log(`   🔍 Fetching crests for ${missing.length} teams from api-football.com…`);

        // Fetch teams from Liga F + UWCL (2 API calls total)
        const headers = { 'x-apisports-key': API_FOOTBALL_KEY };
        // Use last available free season (2024 is the latest on free tier)
        const season  = 2024;
        const afTeams = new Map(); // name → logo URL

        for (const leagueId of [142, 525]) { // Liga F, UWCL
            try {
                const res = await fetch(`${AF_BASE}/teams?league=${leagueId}&season=${season}`, { headers });
                if (!res.ok) { console.warn(`   ⚠️  Teams API ${res.status} for league ${leagueId}`); continue; }
                const json = await res.json();
                for (const t of (json.response || [])) {
                    // Store with cleaned name (remove " W" suffix) for matching
                    const cleanName = t.team.name.replace(/ W$/, '').trim();
                    if (t.team.logo) afTeams.set(cleanName, t.team.logo);
                }
            } catch (e) {
                console.warn(`   ⚠️  Failed league ${leagueId}: ${e.message}`);
            }
        }

        // Match by fuzzy comparison (lowercase, stripped)
        const normalize = s => s.toLowerCase()
            .replace(/á/g, 'a').replace(/é/g, 'e').replace(/í/g, 'i')
            .replace(/ó/g, 'o').replace(/ú/g, 'u').replace(/ñ/g, 'n')
            .replace(/ü/g, 'u').replace(/ç/g, 'c')
            .replace(/[^a-z0-9]/g, '');

        const afEntries = [...afTeams.entries()].map(([n, url]) => [normalize(n), url, n]);

        // Hardcoded fallbacks for teams not in Liga F/UWCL 2024 leagues
        const CREST_FALLBACKS = {
            'Avaldsnes IL':          'https://media.api-sports.io/football/teams/15950.png',
            'Villarreal':            'https://media.api-sports.io/football/teams/17169.png',
            'Sporting de Huelva':    'https://media.api-sports.io/football/teams/1916.png',
            'Rayo Vallecano':        'https://media.api-sports.io/football/teams/1914.png',
            'Bayern Munchen Frauen': 'https://media.api-sports.io/football/teams/1860.png',
            'Granadilla Tenerife':   'https://media.api-sports.io/football/teams/1913.png',
            'Deportivo Alavés':      'https://media.api-sports.io/football/teams/17168.png',
        };

        for (const teamName of missing) {
            const norm = normalize(teamName);
            // 1. Exact normalized match
            let found = afEntries.find(([n]) => n === norm);
            // 2. Contains match
            if (!found) found = afEntries.find(([n]) => n.includes(norm) || norm.includes(n));
            if (found) {
                cached[teamName] = found[1];
            } else if (GLOBAL_CREST_FALLBACKS[teamName]) {
                cached[teamName] = GLOBAL_CREST_FALLBACKS[teamName];
            }
        }

        // Save updated cache
        await setDoc(cacheRef, cached);
        const resolved = missing.filter(n => cached[n]).length;
        console.log(`   ✅ Resolved ${resolved}/${missing.length} crests. ` +
                     `${missing.filter(n => !cached[n]).join(', ') || 'all matched!'}`);
    }

    // 3. Apply cached crests to match objects
    let applied = 0;
    for (const m of icsMatches) {
        if (!m.homeTeam.crest && cached[m.homeTeam.name]) {
            m.homeTeam.crest = cached[m.homeTeam.name];
            applied++;
        }
        if (!m.awayTeam.crest && cached[m.awayTeam.name]) {
            m.awayTeam.crest = cached[m.awayTeam.name];
            applied++;
        }
    }
    console.log(`   🖼️  Applied ${applied} crests to ICS matches.`);
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

    // ── 3.  API calls (masculí + femení) ───────────────────────────────────
    console.log('🌍 football-data.org  →  GET /teams/81/matches (masculí) …');
    const res = await fetch(`${BASE_URL}/teams/${BARCA_TEAM_ID}/matches?limit=200`, {
        headers: { 'X-Auth-Token': API_KEY },
    });

    if (res.status === 429) { console.warn('⚠️  Rate-limit hit. Try again later.'); return; }
    if (!res.ok) { console.error(`❌ API ${res.status}: ${res.statusText}`); return; }

    const json    = await res.json();
    let apiMatches = json.matches || [];
    console.log(`📊 ${apiMatches.length} men's matches received.`);

    // ── 3b. Barça Femení — ICS calendar feed (free, no API key needed) ─────
    const ICS_FEMENI_URL = process.env.ICS_FEMENI_URL;
    if (ICS_FEMENI_URL) {
        console.log('📅 Fetching Barça Femení calendar (ICS) …');
        try {
            const icsRes = await fetch(ICS_FEMENI_URL);
            if (!icsRes.ok) throw new Error(`ICS fetch ${icsRes.status}`);
            const icsText   = await icsRes.text();
            const icsEvents = parseICSFeed(icsText, 'FC Barcelona Women');
            console.log(`   📊 ${icsEvents.length} women's matches parsed from ICS.`);

            // Resolve team crests from api-football.com (cached in Firestore)
            await resolveWomenCrests(db, icsEvents);

            apiMatches = [...apiMatches, ...icsEvents];
            console.log(`   📊 ${apiMatches.length} total matches after women's ICS merge.`);

            // Backfill missing Liga F / UWCL scores from api-football.com
            await backfillLigaFScores(icsEvents);
        } catch (e) {
            console.warn(`   ⚠️  ICS calendar failed: ${e.message}. Continuing with men's only.`);
        }
    } else {
        console.log('ℹ️  No ICS_FEMENI_URL in .env — skipping women\'s calendar.');
    }

    // ── 3c. Copa del Rey — men's ICS calendar (only [Copa] events) ──────────
    const ICS_COPA_URL = process.env.ICS_COPA_URL;
    if (ICS_COPA_URL) {
        console.log('🏆 Fetching Copa del Rey from men\'s ICS calendar…');
        try {
            const copaRes = await fetch(ICS_COPA_URL);
            if (!copaRes.ok) throw new Error(`Copa ICS fetch ${copaRes.status}`);
            const copaText = await copaRes.text();
            const copaEvents = parseMenICSCopa(copaText);
            console.log(`   📊 ${copaEvents.length} Copa del Rey matches parsed.`);

            // Resolve crests for Copa teams
            await resolveMenCrests(db, copaEvents);

            apiMatches = [...apiMatches, ...copaEvents];
            console.log(`   📊 ${apiMatches.length} total matches after Copa merge.`);
        } catch (e) {
            console.warn(`   ⚠️  Copa ICS failed: ${e.message}. Continuing without Copa.`);
        }
    } else {
        console.log('ℹ️  No ICS_COPA_URL in .env — skipping Copa del Rey.');
    }

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
            !m._isMenCopa && (
            m.competition.name.toLowerCase().includes('women') ||
            m.competition.name.toLowerCase().includes('femenin') ||
            m.competition.name.toLowerCase().includes('liga f') ||
            (String(m.id).startsWith('ics_') && !String(m.id).startsWith('ics_copa_'))
            );  // ICS calendar women's fixtures (excluding Copa del Rey from men's ICS)

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

