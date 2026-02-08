/**
 * Script per actualitzar els partits del FC Barcelona (masculí i femení)
 * 
 * Descarrega els calendaris ICS, els parseja i els puja a Firestore.
 * Pot executar-se manualment o com a cron job.
 * 
 * Ús: node scripts/updateMatches.js
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp } = require('firebase/firestore');
const { getStorage, ref, uploadBytes, getDownloadURL } = require('firebase/storage');
const https = require('https');
const http = require('http');
const ICAL = require('ical.js');
const crypto = require('crypto');
require('dotenv').config();

// Configuració Firebase (usa les mateixes variables d'entorn que l'app)
const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Inicialitzar Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// URLs dels calendaris ICS del Barça (via fixtur.es)
const ICS_URLS = {
    masculino: 'https://ics.fixtur.es/v2/fc-barcelona.ics',
    femenino: 'https://ics.fixtur.es/v2/fc-barcelona-women.ics'
};

/**
 * Descarrega un fitxer ICS des d'una URL
 */
function downloadICS(url) {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        
        protocol.get(url, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve(data);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                }
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

/**
 * Descarrega una imatge i retorna el buffer
 */
function downloadImage(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            const chunks = [];
            
            res.on('data', (chunk) => chunks.push(chunk));
            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve(Buffer.concat(chunks));
                } else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
            });
        }).on('error', reject);
    });
}

/**
 * Puja una imatge a Firebase Storage i retorna la URL
 */
async function uploadTeamBadge(teamName, imageUrl) {
    try {
        const imageBuffer = await downloadImage(imageUrl);
        const hash = crypto.createHash('md5').update(teamName).digest('hex');
        const storageRef = ref(storage, `team-badges/${hash}.png`);
        
        await uploadBytes(storageRef, imageBuffer, {
            contentType: 'image/png',
            cacheControl: 'public, max-age=31536000'
        });
        
        const downloadURL = await getDownloadURL(storageRef);
        return downloadURL;
    } catch (error) {
        console.warn(`   ⚠️ No s'ha pogut descarregar l'escut de ${teamName}:`, error.message);
        return null;
    }
}

/**
 * Obté l'escut d'un equip des de TheSportsDB API (gratuïta)
 */
async function getTeamBadge(teamName) {
    const cleanName = teamName.replace(/\s*Women\s*/gi, '').trim();
    
    // Mapa d'equips espanyols coneguts amb els seus IDs de TheSportsDB
    const teamBadges = {
        'FC Barcelona': 'https://www.thesportsdb.com/images/media/team/badge/xzqdr11517661315.png',
        'Real Madrid': 'https://www.thesportsdb.com/images/media/team/badge/vwpvry1467462651.png',
        'Atlético Madrid': 'https://www.thesportsdb.com/images/media/team/badge/vrtrtp1448813175.png',
        'Valencia': 'https://www.thesportsdb.com/images/media/team/badge/qtwwqv1448806551.png',
        'Sevilla': 'https://www.thesportsdb.com/images/media/team/badge/uqspup1517489912.png',
        'Athletic Bilbao': 'https://www.thesportsdb.com/images/media/team/badge/qtxwwr1448813397.png',
        'Real Sociedad': 'https://www.thesportsdb.com/images/media/team/badge/sqxtsy1449059119.png',
        'Villarreal': 'https://www.thesportsdb.com/images/media/team/badge/tsqwvx1517753757.png',
        'Real Betis': 'https://www.thesportsdb.com/images/media/team/badge/bvjzag1550141460.png',
        'Celta Vigo': 'https://www.thesportsdb.com/images/media/team/badge/svqyqr1448814224.png'
    };
    
    if (teamBadges[cleanName]) {
        try {
            return await uploadTeamBadge(cleanName, teamBadges[cleanName]);
        } catch (error) {
            console.warn(`   ⚠️ Error pujant ${cleanName}:`, error.message);
            return null;
        }
    }
    
    return null;
}

/**
 * Parseja un fitxer ICS i retorna els esdeveniments
 */
function parseICS(icsData) {
    try {
        const jcalData = ICAL.parse(icsData);
        const comp = new ICAL.Component(jcalData);
        const vevents = comp.getAllSubcomponents('vevent');
        
        return vevents.map(vevent => {
            const event = new ICAL.Event(vevent);
            
            // Extreure informació bàsica
            const summary = event.summary || '';
            const location = event.location || '';
            const description = event.description || '';
            
            // Parsejar equips des del summary
            let homeTeam = 'FC Barcelona';
            let awayTeam = '';
             
            // Netejar el summary de resultats entre parèntesis al final: "Team A - Team B (1-0)"
            let cleanSummary = summary.replace(/\s*\(\d+-\d+\)$/, '');
            
            if (cleanSummary.includes(' - ')) {
                const parts = cleanSummary.split(' - ');
                
                // Funció de neteja específica per noms d'equips
                const cleanName = (name) => {
                    return name
                        .replace(/\[.*?\]/g, '') // Treure [Copa], [CL], etc
                        .replace(/\s+\d+$/, '')  // Treure gols al final (format antic)
                        .replace(/^\d+\s+/, '')  // Treure gols al principi (format antic)
                        .trim();
                };

                homeTeam = cleanName(parts[0]);
                awayTeam = cleanName(parts[1]);
            } else if (cleanSummary.includes(' vs ')) {
                const parts = cleanSummary.split(' vs ');
                homeTeam = parts[0].trim();
                awayTeam = parts[1].trim();
            }
            
            // Extreure competició des de la descripció o summary
            let league = 'La Liga';
            const lowerDesc = description.toLowerCase();
            const lowerSummary = summary.toLowerCase();
            
            if (lowerDesc.includes('champions') || lowerSummary.includes('champions')) {
                league = 'Champions League';
            } else if (lowerDesc.includes('copa') || lowerSummary.includes('copa')) {
                league = 'Copa del Rey';
            } else if (lowerDesc.includes('supercopa') || lowerSummary.includes('supercopa')) {
                league = 'Supercopa';
            } else if (lowerDesc.includes('liga f') || lowerSummary.includes('liga f')) {
                league = 'Liga F';
            }
            
            return {
                uid: event.uid,
                homeTeam,
                awayTeam,
                date: event.startDate.toJSDate(),
                location,
                league,
                description,
                summary
            };
        });
    } catch (error) {
        console.error('Error parseant ICS:', error);
        return [];
    }
}

/**
 * Puja o actualitza els partits a Firestore
 */
async function uploadMatches(matches, category) {
    let added = 0;
    let updated = 0;
    
    for (const match of matches) {
        // Utilitzar UID com a document ID per evitar duplicats
        const docRef = doc(db, 'matches', match.uid);
        
        // Comprovar si existeix
        const docSnap = await getDoc(docRef);
        
        // Obtenir escuts dels equips
        const homeBadge = await getTeamBadge(match.homeTeam);
        const awayBadge = await getTeamBadge(match.awayTeam);
        
        const matchData = {
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            homeBadge,
            awayBadge,
            date: Timestamp.fromDate(match.date),
            location: match.location,
            league: match.league,
            category, // 'masculino' o 'femenino'
            updatedAt: serverTimestamp()
        };
        
        if (!docSnap.exists()) {
            // Nou partit
            await setDoc(docRef, {
                ...matchData,
                createdAt: serverTimestamp()
            });
            added++;
        } else {
            // Actualitzar partit existent
            await updateDoc(docRef, matchData);
            updated++;
        }
    }
    
    return { added, updated };
}

/**
 * Funció principal
 */
async function main() {
    console.log('🔵 Iniciant actualització de partits del FC Barcelona...\n');
    
    try {
        // Processar masculí
        console.log('⚽ Descarregant calendari masculí...');
        const icsDataMasculino = await downloadICS(ICS_URLS.masculino);
        const matchesMasculino = parseICS(icsDataMasculino);
        console.log(`   Trobats ${matchesMasculino.length} partits masculins`);
        
        const resultMasculino = await uploadMatches(matchesMasculino, 'masculino');
        console.log(`   ✅ Afegits: ${resultMasculino.added} | Actualitzats: ${resultMasculino.updated}\n`);
        
        // Processar femení
        console.log('⚽ Descarregant calendari femení...');
        const icsDataFemenino = await downloadICS(ICS_URLS.femenino);
        const matchesFemenino = parseICS(icsDataFemenino);
        console.log(`   Trobats ${matchesFemenino.length} partits femenins`);
        
        const resultFemenino = await uploadMatches(matchesFemenino, 'femenino');
        console.log(`   ✅ Afegits: ${resultFemenino.added} | Actualitzats: ${resultFemenino.updated}\n`);
        
        console.log('✅ Actualització completada amb èxit!');
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error durant l\'actualització:', error);
        process.exit(1);
    }
}

// Executar
main();
