/**
 * scripts/seedPremiumBars.js
 *
 * Afegeix bars premium de prova a la base de dades de Firestore (DEV).
 * Bars reals de Barcelona coneguts per emetre partits del FC Barcelona.
 *
 * Ús:
 *   npm run db:seed-premium
 *   node scripts/seedPremiumBars.js          (usa .env)
 *   node scripts/seedPremiumBars.js --dry-run (només mostra, no escriu)
 */

const path = require('path');
const fs = require('fs');

// ── Carrega .env ────────────────────────────────────────────────────────────
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
}

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, getDoc, serverTimestamp } = require('firebase/firestore');

// ── Firebase init ───────────────────────────────────────────────────────────
const firebaseConfig = {
    apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

const dryRun = process.argv.includes('--dry-run');

// ── Premium Bars ────────────────────────────────────────────────────────────
// Bars reals de Barcelona amb coordenades precises i Google Place IDs.
const PREMIUM_BARS = [
    {
        id: 'la-cerveceria-born',
        name: 'La Cervecería del Born',
        address: 'Passeig del Born, 19, 08003 Barcelona',
        latitude: 41.3843,
        longitude: 2.1826,
        rating: 4.3,
        isOpen: true,
        image: '',
        amenities: ['terrassa', 'cervesa artesana', 'futbol'],
        source: 'verified',
        tier: 'premium',
        usuallyShowsBarca: true,
        broadcastingMatches: [],
        googlePlaceId: 'ChIJVfusiL-ipBIRCHqGT5JYd3A',
        isActive: true,
    },
    {
        id: 'belushi-bar-bcn',
        name: "Belushi's Barcelona",
        address: 'Carrer de Bergara, 3, 08002 Barcelona',
        latitude: 41.3878,
        longitude: 2.1699,
        rating: 4.1,
        isOpen: true,
        image: '',
        amenities: ['pantalla gran', 'esports', 'cervesa', 'hamburgueses'],
        source: 'verified',
        tier: 'premium',
        usuallyShowsBarca: true,
        broadcastingMatches: [],
        googlePlaceId: 'ChIJrxNRxS2ipBIRjK8OM7QRswI',
        isActive: true,
    },
    {
        id: 'george-payne-irish-pub',
        name: 'The George Payne Irish Pub',
        address: 'Plaça d\'Urquinaona, 5, 08010 Barcelona',
        latitude: 41.3893,
        longitude: 2.1737,
        rating: 4.2,
        isOpen: true,
        image: '',
        amenities: ['pub irlandès', 'pantalles múltiples', 'esports en viu', 'cervesa'],
        source: 'verified',
        tier: 'premium',
        usuallyShowsBarca: true,
        broadcastingMatches: [],
        googlePlaceId: 'ChIJ4dGzig2ipBIRKOUPEeyh8Xo',
        isActive: true,
    },
    {
        id: 'travel-bar-bcn',
        name: 'Travel Bar Barcelona',
        address: 'Carrer de la Boqueria, 27, 08002 Barcelona',
        latitude: 41.3815,
        longitude: 2.1748,
        rating: 4.4,
        isOpen: true,
        image: '',
        amenities: ['backpackers', 'pantalles', 'futbol', 'ambient internacional'],
        source: 'verified',
        tier: 'premium',
        usuallyShowsBarca: true,
        broadcastingMatches: [],
        googlePlaceId: 'ChIJGZb6pjuipBIRlb2cPo4R1EY',
        isActive: true,
    },
    {
        id: 'la-oveja-negra-raval',
        name: 'La Oveja Negra',
        address: 'Carrer de les Sitges, 5, 08001 Barcelona',
        latitude: 41.3812,
        longitude: 2.1710,
        rating: 4.0,
        isOpen: true,
        image: '',
        amenities: ['pub', 'pantalles', 'esports', 'ambient jove', 'cervesa barata'],
        source: 'verified',
        tier: 'premium',
        usuallyShowsBarca: true,
        broadcastingMatches: [],
        googlePlaceId: 'ChIJfZDJxTuipBIRCj-3XjS7Pvk',
        isActive: true,
    },
    {
        id: 'flahertys-irish-pub',
        name: "Flaherty's Irish Pub",
        address: 'Plaça Reial, 17, 08002 Barcelona',
        latitude: 41.3798,
        longitude: 2.1754,
        rating: 4.1,
        isOpen: true,
        image: '',
        amenities: ['pub irlandès', 'pantalles múltiples', 'terrassa', 'esports'],
        source: 'verified',
        tier: 'premium',
        usuallyShowsBarca: true,
        broadcastingMatches: [],
        googlePlaceId: 'ChIJT3bQbzuipBIRYzVCdg0HNv0',
        isActive: true,
    },
    {
        id: 'lennox-the-pub',
        name: 'Lennox The Pub',
        address: 'Carrer del Comerç, 19, 08003 Barcelona',
        latitude: 41.3851,
        longitude: 2.1834,
        rating: 4.3,
        isOpen: true,
        image: '',
        amenities: ['pub', 'cervesa artesana', 'pantalles', 'terrassa'],
        source: 'verified',
        tier: 'premium',
        usuallyShowsBarca: true,
        broadcastingMatches: [],
        googlePlaceId: 'ChIJc4OmYr-ipBIR_Jz3e7kJ6H8',
        isActive: true,
    },
    {
        id: 'bar-coppelia',
        name: 'Bar Coppelia',
        address: 'Carrer del Clot, 91, 08026 Barcelona',
        latitude: 41.4096,
        longitude: 2.1893,
        rating: 4.0,
        isOpen: true,
        image: '',
        amenities: ['pantalla gran', 'tapes', 'bar de barri'],
        source: 'verified',
        tier: 'premium',
        usuallyShowsBarca: true,
        broadcastingMatches: [],
        googlePlaceId: '',
        isActive: true,
    },
];

// ── Seed logic ──────────────────────────────────────────────────────────────
async function main() {
    console.log('════════════════════════════════════════════════════════');
    console.log(`🏅 Seed Premium Bars → ${firebaseConfig.projectId}`);
    console.log(`   Entorn: ${process.env.TROBAR_ENV || 'desconegut'}`);
    console.log(`   Mode: ${dryRun ? 'DRY RUN (no escriu)' : 'ESCRIPTURA'}`);
    console.log('════════════════════════════════════════════════════════');
    console.log('');

    let created = 0;
    let skipped = 0;

    for (const bar of PREMIUM_BARS) {
        const ref = doc(db, 'bars', bar.id);

        if (dryRun) {
            console.log(`  [DRY] ${bar.name} (${bar.id})`);
            created++;
            continue;
        }

        // Check si ja existeix
        const existing = await getDoc(ref);
        if (existing.exists()) {
            const data = existing.data();
            if (data.tier === 'premium') {
                console.log(`  ⏭ ${bar.name} — ja existeix com a premium`);
                skipped++;
                continue;
            }
            // Existeix però no és premium → actualitzem a premium
            await setDoc(ref, { tier: 'premium', isActive: true, googlePlaceId: bar.googlePlaceId }, { merge: true });
            console.log(`  🔄 ${bar.name} — actualitzat a premium`);
            created++;
            continue;
        }

        // Crear nou document
        const { id: _id, ...barData } = bar;
        await setDoc(ref, {
            ...barData,
            createdAt: serverTimestamp(),
        });
        console.log(`  ✅ ${bar.name}`);
        created++;
    }

    console.log('');
    console.log(`Resultat: ${created} creats/actualitzats, ${skipped} omesos`);
    console.log('════════════════════════════════════════════════════════');

    process.exit(0);
}

main().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
