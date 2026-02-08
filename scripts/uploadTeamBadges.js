/**
 * Script per pujar escuts d'equips a Firebase Storage
 * 
 * Puja els escuts des de la carpeta assets/img/teams/ a Firebase Storage
 * i actualitza els partits a Firestore amb les URLs correctes.
 * 
 * Ús: node scripts/uploadTeamBadges.js
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, updateDoc } = require('firebase/firestore');
const { getStorage, ref, uploadBytes, getDownloadURL } = require('firebase/storage');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
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
const storage = getStorage(app);

// Mapa de normalització de noms d'equips
const TEAM_NAME_MAP = {
    // Noms complets → nom del fitxer
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
};

function normalizeTeamName(teamName) {
    if (!teamName) return 'unknown';
    
    // Eliminar "Women" per a equips femenins
    let clean = teamName.replace(/\s*Women\s*/gi, '').trim();
    
    // Buscar al mapa
    if (TEAM_NAME_MAP[clean]) {
        return TEAM_NAME_MAP[clean];
    }
    
    // Si no es troba, normalitzar: minúscules, sense accents, guions
    return clean
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

async function uploadBadge(teamFileName, extension) {
    const assetsDir = path.join(__dirname, '..', 'assets', 'img', 'teams');
    const filePath = path.join(assetsDir, `${teamFileName}.${extension}`);
    
    if (!fs.existsSync(filePath)) {
        return null;
    }
    
    try {
        const fileBuffer = fs.readFileSync(filePath);
        const contentType = extension === 'svg' ? 'image/svg+xml' : 'image/png';
        const storageRef = ref(storage, `team-badges/${teamFileName}.${extension}`);
        
        await uploadBytes(storageRef, fileBuffer, {
            contentType,
            cacheControl: 'public, max-age=31536000'
        });
        
        const downloadURL = await getDownloadURL(storageRef);
        console.log(`   ✅ Pujat: ${teamFileName}.${extension}`);
        return downloadURL;
    } catch (error) {
        console.error(`   ❌ Error pujant ${teamFileName}:`, error.message);
        return null;
    }
}

async function main() {
    console.log('🔵 Pujant escuts d\'equips a Firebase Storage...\n');
    
    // Obtenir tots els fitxers de la carpeta assets/img/teams/
    const assetsDir = path.join(__dirname, '..', 'assets', 'img', 'teams');
    
    if (!fs.existsSync(assetsDir)) {
        console.error('❌ No existeix la carpeta assets/img/teams/');
        console.log('   Crea-la i posa-hi els escuts dels equips en format PNG.');
        process.exit(1);
    }
    
    const files = fs.readdirSync(assetsDir).filter(f => f.endsWith('.png') || f.endsWith('.svg'));
    
    if (files.length === 0) {
        console.log('⚠️ No s\'ha trobat cap escut a assets/img/teams/');
        process.exit(0);
    }
    
    console.log(`📁 Trobats ${files.length} escuts a pujar:\n`);
    
    // Pujar cada escut
    const uploadedBadges = {};
    for (const file of files) {
        const extension = file.endsWith('.svg') ? 'svg' : 'png';
        const teamFileName = file.replace(`.${extension}`, '');
        const url = await uploadBadge(teamFileName, extension);
        if (url) {
            uploadedBadges[teamFileName] = url;
        }
    }
    
    console.log(`\n✅ Pujats ${Object.keys(uploadedBadges).length} escuts correctament.`);
    console.log('\n🔄 Actualitzant partits a Firestore...\n');
    
    // Obtenir tots els partits
    const matchesRef = collection(db, 'matches');
    const snapshot = await getDocs(matchesRef);
    
    let updated = 0;
    let skipped = 0;
    
    for (const matchDoc of snapshot.docs) {
        const match = matchDoc.data();
        const homeTeamFile = normalizeTeamName(match.homeTeam);
        const awayTeamFile = normalizeTeamName(match.awayTeam);
        
        const updates = {};
        
        if (uploadedBadges[homeTeamFile]) {
            updates.homeBadge = uploadedBadges[homeTeamFile];
        }
        
        if (uploadedBadges[awayTeamFile]) {
            updates.awayBadge = uploadedBadges[awayTeamFile];
        }
        
        if (Object.keys(updates).length > 0) {
            await updateDoc(doc(db, 'matches', matchDoc.id), updates);
            updated++;
        } else {
            skipped++;
        }
    }
    
    console.log(`\n✅ Actualitzats ${updated} partits amb escuts.`);
    if (skipped > 0) {
        console.log(`   ⚠️ ${skipped} partits sense escuts disponibles.`);
    }
    
    console.log('\n✅ Procés completat!');
}

main().catch(console.error);
