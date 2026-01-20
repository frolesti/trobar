const { initializeApp } = require("firebase/app");
const { getFirestore, collection, getDocs, updateDoc, doc, setDoc } = require("firebase/firestore");
const fs = require('fs');
const path = require('path');

// --- DATA ---
const dummyBars = [
  {
    id: '1',
    name: "Bar Sport 'El Camp Nou'",
    latitude: 41.380896,
    longitude: 2.122820,
    address: 'Carrer de Aristides Maillol, 12, Barcelona',
    rating: 4.5,
    isOpen: true,
    image: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?q=80&w=1000&auto=format&fit=crop',
    tags: ['Terrassa', 'Projector', 'Wifi'],
  },
  {
    id: '2',
    name: "La Cerveseria del Barri",
    latitude: 41.3825,
    longitude: 2.1700,
    address: 'Carrer de la Marina, 100, Barcelona',
    rating: 4.2,
    isOpen: true,
    image: 'https://images.unsplash.com/photo-1538488881038-e252a119ace7?q=80&w=1000&auto=format&fit=crop',
    tags: ['Cerveses Artesanes', 'Tapes']
  },
  {
    id: '3',
    name: "Pub Irlandès 'The Temple'",
    latitude: 41.3850,
    longitude: 2.1730,
    address: 'Carrer de Ferran, 20, Barcelona',
    rating: 4.7,
    isOpen: false,
    image: 'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?q=80&w=1000&auto=format&fit=crop',
    tags: ['Futbol', 'Rugby', 'Guinness']
  },
    {
    id: '4',
    name: "Bar 'Can Paixano'",
    latitude: 41.3810,
    longitude: 2.1850,
    address: 'Carrer de la Reina Cristina, 7, Barcelona',
    rating: 4.8,
    isOpen: true,
    image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1000&auto=format&fit=crop',
    tags: ['Entrepans', 'Cava', 'Econòmic']
  },
  {
    id: '5',
    name: "Sports Bar '4 Latas'",
    latitude: 41.3950,
    longitude: 2.1550,
    address: 'Carrer de Muntaner, 100, Barcelona',
    rating: 4.0,
    isOpen: true,
    image: 'https://images.unsplash.com/photo-1596701062351-8c2c14d1fdd0?q=80&w=1000&auto=format&fit=crop',
    tags: ['Terrassa', 'Cocktails']
  }
];

// ... (Rest of env loading) ...
const envPath = path.resolve(__dirname, '../.env');
console.log(`Loading env from ${envPath}`);
const envConfig = {};

try {
    if (fs.existsSync(envPath)) {
        const envFile = fs.readFileSync(envPath, 'utf8');
        envFile.split('\n').forEach(line => {
            if (!line || line.startsWith('#')) return;
            // Handle KEY=VALUE
            const idx = line.indexOf('=');
            if (idx > -1) {
                const key = line.substring(0, idx).trim();
                let value = line.substring(idx + 1).trim();
                // Remove quotes if present
                if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                }
                envConfig[key] = value;
            }
        });
    } else {
        console.error(".env file not found");
        process.exit(1);
    }
} catch (e) {
    console.error("Error reading .env:", e);
    process.exit(1);
}

// 2. Init Firebase
const firebaseConfig = {
  apiKey: envConfig.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: envConfig.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: envConfig.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: envConfig.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: envConfig.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: envConfig.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Basic Validation
if (!firebaseConfig.apiKey) {
    console.error("Missing API Key in .env");
    process.exit(1);
}

console.log(`Connecting to project: ${firebaseConfig.projectId}`);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 3. Seed Logic
const seed = async () => {
    try {
        const barsCollection = collection(db, 'bars');
        let snapshot = await getDocs(barsCollection);
        
        if (snapshot.empty) {
            console.log("No bars found in 'bars' collection. Inserting dummy bars...");
            for (const bar of dummyBars) {
                await setDoc(doc(db, 'bars', bar.id), bar);
                console.log(`Inserted ${bar.name}`);
            }
            // Re-fetch
            snapshot = await getDocs(barsCollection);
        }

        console.log(`Found ${snapshot.size} bars. Updating with matches...`);

        const matches = [
            {
                teamHome: 'SL Benfica',
                teamAway: 'FC Barcelona',
                competition: 'UEFA Champions League',
                time: '21:00'
            },
            {
                teamHome: 'FC Barcelona',
                teamAway: 'Real Madrid',
                competition: 'La Liga',
                time: '20:45'
            },
            {
                 teamHome: 'Espanyol',
                 teamAway: 'Girona',
                 competition: 'La Liga',
                 time: '18:00'
            }
        ];

        let updatedCount = 0;
        for (const d of snapshot.docs) {
            const barRef = doc(db, 'bars', d.id);
            const randomMatch = matches[Math.floor(Math.random() * matches.length)];

            await updateDoc(barRef, {
                nextMatch: randomMatch
            });
            updatedCount++;
        }

        console.log(`Success! Updated ${updatedCount} bars with fake matches.`);
    } catch (error) {
        console.error("Error seeding:", error);
    }
};

seed();
