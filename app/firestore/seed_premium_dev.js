/**
 * seed_premium_dev.js
 *
 * Pobla bars premium a la BD de dev amb dades simulades:
 *   - socialMedia (instagram, facebook, whatsapp, telegram)
 *   - description + promotionalText
 *   - broadcastingMatches (referenciats als partits reals de la BD)
 *   - amenities
 *
 * Usage:
 *   cd app
 *   node firestore/seed_premium_dev.js
 *
 * ⚠️  Només per a DEV (trobar-1123f). No executar mai en producció.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env.development') });

const { initializeApp } = require('firebase/app');
const {
    getFirestore, collection, getDocs, doc, writeBatch, query, where, orderBy, limit,
} = require('firebase/firestore');

// ── Firebase init ─────────────────────────────────────
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

// ── Dades simulades per bar ───────────────────────────
// Cada entrada mapeja per nom del bar (matching parcial) a dades fictícies però realistes
const SEED_DATA = [
    {
        nameContains: 'George Payne',
        data: {
            socialMedia: {
                instagram: 'georgepaynebcn',
                facebook: 'TheGeorgePayneBCN',
                whatsapp: '+34933041735',
            },
            description: 'El pub irlandès per excel·lència al cor de Barcelona. Pantalla gegant, ambient esportiu i les millors pintes.',
            promotionalText: '🍺 2x1 en pintes de Guinness durant tots els partits del Barça!',
            amenities: ['projector', 'multiple_screens', 'outdoor_seating', 'wifi', 'sports_bar', 'food_served', 'craft_beer'],
        },
    },
    {
        nameContains: 'Belushi',
        data: {
            socialMedia: {
                instagram: 'belushisbcn',
                facebook: 'BelushisBarcelona',
            },
            description: 'Sports bar al Raval amb pantalles a tots els racons. Hamburgueses americanes i cerveses artesanes.',
            promotionalText: 'Reserva taula gratis per partits de Champions! 📺',
            amenities: ['projector', 'multiple_screens', 'wifi', 'sports_bar', 'food_served', 'craft_beer', 'late_night'],
        },
    },
    {
        nameContains: 'Lennox',
        data: {
            socialMedia: {
                instagram: 'lennoxbcn',
                facebook: 'LennoxThePublicHouse',
                telegram: 'lennox_bcn',
            },
            description: 'Lennox The Pub: cerveses de qualitat, futbol en directe i l\'ambient més acollidor del Born.',
            promotionalText: 'Happy hour fins les 20h els dies de partit! 🎉',
            amenities: ['projector', 'multiple_screens', 'outdoor_seating', 'wifi', 'sports_bar', 'craft_beer'],
        },
    },
    {
        nameContains: 'Flaherty',
        data: {
            socialMedia: {
                instagram: 'flahertysbarcelona',
                facebook: 'FlahertysIrishPub',
                whatsapp: '+34934121263',
            },
            description: 'L\'autèntic pub irlandès a la Plaça Reial. Múltiples pantalles i una terrassa inoblidable.',
            promotionalText: 'Menú de partit: nachos + cervesa per 8,50€ ⚽',
            amenities: ['projector', 'multiple_screens', 'outdoor_seating', 'wifi', 'accessible', 'sports_bar', 'food_served'],
        },
    },
    {
        nameContains: 'Coppelia',
        data: {
            socialMedia: {
                instagram: 'coppelia_bcn',
            },
            description: 'Bar de barri al Clot amb pantalla gran i ambient familiar. Tapes catalanes i bon futbol.',
            promotionalText: 'Entrepà + canya a 5€ els dies de Barça! 🥪',
            amenities: ['projector', 'outdoor_seating', 'wifi', 'food_served', 'pet_friendly'],
        },
    },
    {
        nameContains: 'Oveja',
        data: {
            socialMedia: {
                instagram: 'ovellanegra_bcn',
                facebook: 'OvellaNegraBCN',
                whatsapp: '+34933172638',
            },
            description: 'L\'Ovella Negra: la sala de cerveses més gran de Barcelona! Ideal per veure el futbol amb la colla.',
            promotionalText: 'Jarra d\'1L a preu especial durant el partit! 🍻',
            amenities: ['projector', 'multiple_screens', 'wifi', 'sports_bar', 'craft_beer', 'food_served', 'late_night', 'live_music'],
        },
    },
    {
        nameContains: 'Travel',
        data: {
            socialMedia: {
                instagram: 'travelbar_bcn',
                facebook: 'TravelBarBCN',
            },
            description: 'Sports bar internacional a Gràcia. Tots els esports en directe, cocktails i bona vibra.',
            promotionalText: 'Cocktail del dia a 6€ en cada jornada de Lliga! 🍹',
            amenities: ['projector', 'multiple_screens', 'wifi', 'sports_bar', 'craft_beer', 'late_night'],
        },
    },
];

// ── Lògica principal ──────────────────────────────────

async function main() {
    const projectId = firebaseConfig.projectId;
    if (!projectId || !projectId.includes('1123f')) {
        console.error('❌ ATENCIÓ: projectId no sembla ser dev (trobar-1123f). Avortant.');
        process.exit(1);
    }

    console.log(`\n🌱 Seed premium dev — projecte: ${projectId}\n`);

    // 1. Obtenir IDs de partits reals (els 4 pròxims scheduled)
    let matchIds = [];
    try {
        const matchSnap = await getDocs(
            query(
                collection(db, 'matches'),
                where('status', '==', 'scheduled'),
                orderBy('timestamp', 'asc'),
                limit(4)
            )
        );
        matchIds = matchSnap.docs.map(d => d.id);
        console.log(`📅 Partits scheduled trobats: ${matchIds.length} → [${matchIds.join(', ')}]`);
    } catch (err) {
        console.warn('⚠️  No s\'han pogut obtenir partits scheduled. S\'assignaran IDs ficticis.');
        matchIds = ['1', '2', '3', '4'];
    }

    // 2. Obtenir tots els bars premium
    const barsSnap = await getDocs(collection(db, 'bars'));
    const premiumBars = barsSnap.docs.filter(d => d.data().tier === 'premium');
    console.log(`🏪 Bars premium trobats: ${premiumBars.length}\n`);

    if (premiumBars.length === 0) {
        console.log('Cap bar premium a la BD. No hi ha res a fer.');
        process.exit(0);
    }

    const batch = writeBatch(db);
    let updated = 0;

    for (const barDoc of premiumBars) {
        const barName = barDoc.data().name || '';

        // Buscar seed data que coincideixi amb el nom del bar
        const seed = SEED_DATA.find(s =>
            barName.toLowerCase().includes(s.nameContains.toLowerCase())
        );

        // Dades comunes: assignar partits aleatoris (2-3 per bar)
        const numMatches = 2 + Math.floor(Math.random() * 2); // 2 o 3
        const shuffled = [...matchIds].sort(() => Math.random() - 0.5);
        const barMatches = shuffled.slice(0, numMatches);

        const updates = {
            broadcastingMatches: barMatches,
        };

        if (seed) {
            Object.assign(updates, seed.data);
            console.log(`  ✅ ${barName} → dades personalitzades + ${barMatches.length} partits`);
        } else {
            // Dades genèriques per bars sense seed personalitzat
            updates.socialMedia = { instagram: barName.toLowerCase().replace(/[^a-z0-9]/g, '_') };
            updates.description = `Bar premium a Barcelona. Vine a gaudir dels partits del Barça en pantalla gran!`;
            updates.promotionalText = 'Oferta de benvinguda: primera canya gratis! 🍺';
            updates.amenities = ['projector', 'wifi', 'sports_bar', 'food_served'];
            console.log(`  📝 ${barName} → dades genèriques + ${barMatches.length} partits`);
        }

        batch.update(doc(db, 'bars', barDoc.id), updates);
        updated++;
    }

    await batch.commit();
    console.log(`\n🎉 Actualitzats ${updated} bars premium amb dades simulades.\n`);
    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
