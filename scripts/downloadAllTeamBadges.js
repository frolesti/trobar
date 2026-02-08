/**
 * Script per descarregar TOTS els escuts necessaris des de múltiples fonts
 * 
 * Prioritats:
 * 1. Logo.dev API (gratuïta, bona cobertura)
 * 2. Clearbit Logo API (fallback)
 * 3. Wikipedia/Commons (amb retry logic)
 * 
 * Ús: node scripts/downloadAllTeamBadges.js
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuració Firebase
const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// URLs alternatives per equips específics (PNG directes)
const BADGE_URLS = {
    'barcelona': 'https://assets.stickpng.com/images/584a9b47b519ea740c32f825.png',
    'real-madrid': 'https://assets.stickpng.com/images/584a9b88b519ea740c32f82b.png',
    'atletico-madrid': 'https://assets.stickpng.com/images/584a9b1cb519ea740c32f822.png',
    'valencia': 'https://assets.stickpng.com/images/584a9b94b519ea740c32f82d.png',
    'sevilla': 'https://assets.stickpng.com/images/584a9b6cb519ea740c32f827.png',
    'athletic-bilbao': 'https://assets.stickpng.com/images/584a9afcb519ea740c32f81e.png',
    'real-sociedad': 'https://assets.stickpng.com/images/584a9b61b519ea740c32f826.png',
    'villarreal': 'https://assets.stickpng.com/images/584a9b9eb519ea740c32f82e.png',
    'betis': 'https://assets.stickpng.com/images/584a9b10b519ea740c32f820.png',
    'celta': 'https://assets.stickpng.com/images/584a9b24b519ea740c32f823.png',
    'espanyol': 'https://assets.stickpng.com/images/584a9b33b519ea740c32f824.png',
    'getafe': 'https://assets.stickpng.com/images/584a9b3eb519ea740c32f825.png',
    'levante': 'https://assets.stickpng.com/images/584a9b54b519ea740c32f826.png',
    'osasuna': 'https://assets.stickpng.com/images/62e1becee06c921b11cc2e85.png',
    'rayo-vallecano': 'https://assets.stickpng.com/images/62e1bf00e06c921b11cc2e8a.png',
    'mallorca': 'https://assets.stickpng.com/images/62e1bed1e06c921b11cc2e86.png',
    'cadiz': 'https://assets.stickpng.com/images/62e1be1be06c921b11cc2e7f.png',
    'elche': 'https://assets.stickpng.com/images/62e1beb4e06c921b11cc2e84.png',
    'alaves': 'https://assets.stickpng.com/images/62e1bdfae06c921b11cc2e7d.png',
    'granada': 'https://assets.stickpng.com/images/62e1bec7e06c921b11cc2e85.png',
    'valladolid': 'https://assets.stickpng.com/images/62e1bf2ee06c921b11cc2e8c.png',
    'eibar': 'https://assets.stickpng.com/images/62e1beb0e06c921b11cc2e83.png',
    'girona': 'https://assets.stickpng.com/images/62e1bec3e06c921b11cc2e85.png',
    'las-palmas': 'https://assets.stickpng.com/images/62e1becbe06c921b11cc2e86.png',
    'almeria': 'https://assets.stickpng.com/images/62e1be04e06c921b11cc2e7b.png',
    'huesca': 'https://assets.stickpng.com/images/62e1bec8e06c921b11cc2e85.png',
    'leganes': 'https://assets.stickpng.com/images/62e1becd e06c921b11cc2e86.png',
    'logroño': 'https://www.thesportsdb.com/images/media/team/badge/cd_logrono_feminino.png',
    'eibar-women': 'https://www.thesportsdb.com/images/media/team/badge/sd_eibar.png',
};

// Mapa de normalització de noms
const TEAM_NAME_MAP = {
    'FC Barcelona': 'barcelona',
    'FC Barcelona Women': 'barcelona',
    'Barcelona': 'barcelona',
    'Real Madrid': 'real-madrid',
    'Real Madrid Women': 'real-madrid',
    'Madrid': 'real-madrid',
    'Atlético Madrid': 'atletico-madrid',
    'Atlético Madrid Women': 'atletico-madrid',
    'Atlético': 'atletico-madrid',
    'Valencia': 'valencia',
    'Valencia Women': 'valencia',
    'Sevilla': 'sevilla',
    'Sevilla Women': 'sevilla',
    'Athletic Bilbao': 'athletic-bilbao',
    'Athletic': 'athletic-bilbao',
    'Real Sociedad': 'real-sociedad',
    'Sociedad': 'real-sociedad',
    'Real Sociedad Women': 'real-sociedad',
    'Villarreal': 'villarreal',
    'Real Betis': 'betis',
    'Betis': 'betis',
    'Celta Vigo': 'celta',
    'Celta': 'celta',
    'Espanyol': 'espanyol',
    'RCD Espanyol': 'espanyol',
    'Getafe': 'getafe',
    'Granada': 'granada',
    'Levante': 'levante',
    'Mallorca': 'mallorca',
    'Osasuna': 'osasuna',
    'Rayo Vallecano': 'rayo-vallecano',
    'Rayo': 'rayo-vallecano',
    'Real Valladolid': 'valladolid',
    'Valladolid': 'valladolid',
    'Alavés': 'alaves',
    'Deportivo Alavés': 'alaves',
    'Cádiz': 'cadiz',
    'Elche': 'elche',
    'SD Eibar': 'eibar',
    'Eibar': 'eibar',
    'Real Zaragoza': 'zaragoza',
    'Zaragoza': 'zaragoza',
    'Sporting Gijón': 'sporting',
    'Sporting': 'sporting',
    'Girona': 'girona',
    'Las Palmas': 'las-palmas',
    'Almería': 'almeria',
    'Huesca': 'huesca',
    'Leganés': 'leganes',
    'Logroño': 'logroño',
    'CD Logroño': 'logroño',
    'SD Eibar Women': 'eibar',
};

function normalizeTeamName(teamName) {
    if (!teamName) return null;
    const clean = teamName.replace(/\s*Women\s*/gi, '').trim();
    
    if (TEAM_NAME_MAP[clean]) {
        return TEAM_NAME_MAP[clean];
    }
    
    return clean
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

async function downloadImage(url, outputPath, retries = 3) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        };
        
        protocol.get(url, options, (res) => {
            if (res.statusCode === 200) {
                const fileStream = fs.createWriteStream(outputPath);
                res.pipe(fileStream);
                fileStream.on('finish', () => {
                    fileStream.close();
                    resolve();
                });
                fileStream.on('error', reject);
            } else if (res.statusCode === 301 || res.statusCode === 302) {
                downloadImage(res.headers.location, outputPath, retries).then(resolve).catch(reject);
            } else if (res.statusCode === 429 && retries > 0) {
                // Rate limit - esperar i tornar a intentar
                setTimeout(() => {
                    downloadImage(url, outputPath, retries - 1).then(resolve).catch(reject);
                }, 2000);
            } else {
                reject(new Error(`HTTP ${res.statusCode}`));
            }
        }).on('error', reject);
    });
}

// API de TheSportsDB (Free Tier)
const TSDB_SEARCH_URL = 'https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=';

async function searchTeamBadge(teamName) {
    return new Promise((resolve) => {
        // Netejar nom per a la cerca
        const searchTerm = teamName
            .replace(/-/g, ' ')
            .replace(/\d+/g, '') // Treure números
            .replace(/women/gi, '')
            .trim();
            
        const url = `${TSDB_SEARCH_URL}${encodeURIComponent(searchTerm)}`;
        
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.teams && json.teams.length > 0) {
                        // Preferir badge, després logo
                        const team = json.teams[0];
                        resolve(team.strTeamBadge || team.strTeamLogo);
                    } else {
                        resolve(null);
                    }
                } catch (e) {
                    resolve(null);
                }
            });
        }).on('error', () => resolve(null));
    });
}

async function main() {
    console.log('🔵 Buscant tots els equips necessaris...\n');
    
    const outputDir = path.join(__dirname, '..', 'assets', 'img', 'teams');
    
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Obtenir tots els equips dels partits
    const matchesRef = collection(db, 'matches');
    const snapshot = await getDocs(matchesRef);
    
    const teams = new Set();
    snapshot.docs.forEach(doc => {
        const match = doc.data();
        const homeFile = normalizeTeamName(match.homeTeam);
        const awayFile = normalizeTeamName(match.awayTeam);
        if (homeFile) teams.add(homeFile);
        if (awayFile) teams.add(awayFile);
    });
    
    console.log(`📋 Trobats ${teams.size} equips únics:\n`);
    
    let downloaded = 0;
    let skipped = 0;
    let failed = 0;
    
    for (const teamFile of teams) {
        const pngPath = path.join(outputDir, `${teamFile}.png`);
        
        if (fs.existsSync(pngPath)) {
            console.log(`   ⏭️ Ja existeix: ${teamFile}`);
            skipped++;
            continue;
        }
        
        // 1. Mirar llista manual
        let url = BADGE_URLS[teamFile];
        
        // 2. Si no, buscar a API
        if (!url) {
            console.log(`   🔍 Buscant a API: ${teamFile}...`);
            url = await searchTeamBadge(teamFile);
        }
        
        if (url) {
            try {
                await downloadImage(url, pngPath);
                console.log(`   ✅ Descarregat: ${teamFile}.png`);
                downloaded++;
            } catch (error) {
                console.error(`   ❌ Error descarregant ${teamFile}:`, error.message);
                failed++;
            }
        } else {
            console.log(`   ⚠️ No trobat: ${teamFile}`);
            failed++;
        }
        
        // Delay per respectar API limits
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`\n✅ Descarregats: ${downloaded}`);
    console.log(`⏭️ Ja existien: ${skipped}`);
    if (failed > 0) {
        console.log(`❌ No trobats/errors: ${failed}`);
    }
    
    console.log('\n💡 Executa ara: node scripts/uploadTeamBadges.js');
}

main().catch(console.error);
