/**
 * Script per pujar logos de competicions a Firebase Storage
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');
const { getStorage, ref, uploadBytes, getDownloadURL } = require('firebase/storage');
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
const storage = getStorage(app);

const LOGOS_DIR = path.join(__dirname, '../assets/img/competicions');

async function uploadLogo(filename, competitionId) {
    try {
        const filePath = path.join(LOGOS_DIR, filename);
        
        if (!fs.existsSync(filePath)) {
            console.log(`   ⚠️ Fitxer no trobat: ${filename}`);
            return null;
        }

        const fileBuffer = fs.readFileSync(filePath);
        const storageRef = ref(storage, `competition-logos/${competitionId}.png`);
        
        await uploadBytes(storageRef, fileBuffer, {
            contentType: 'image/png',
            cacheControl: 'public, max-age=31536000'
        });
        
        const downloadURL = await getDownloadURL(storageRef);
        console.log(`   ✅ Pujat: ${competitionId}`);
        
        return downloadURL;
    } catch (error) {
        console.error(`   ❌ Error pujant ${filename}:`, error.message);
        return null;
    }
}

async function main() {
    console.log('🏆 Pujant logos de competicions a Firebase Storage...\n');
    
    const competitions = {
        'laliga-ea-sports': 'liga.png',
        'ligaf': 'ligaf.png'
    };
    
    const logoUrls = {};
    
    for (const [id, filename] of Object.entries(competitions)) {
        const url = await uploadLogo(filename, id);
        if (url) {
            logoUrls[id] = url;
        }
    }
    
    // Guardar URLs a Firestore
    console.log('\n💾 Guardant URLs a Firestore...');
    await setDoc(doc(db, 'config', 'competition-logos'), logoUrls);
    
    console.log('\n✅ Logos pujats amb èxit!');
    console.log('URLs:', logoUrls);
    
    process.exit(0);
}

main().catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
});
