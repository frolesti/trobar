/**
 * Migració 003: Afegir camps premium a la col·lecció bars
 *
 * Camps nous:
 *   - socialMedia: map { instagram?, facebook?, whatsapp?, telegram? }
 *   - description: string — Descripció lliure del propietari
 *   - promotionalText: string — Text promocional
 *   - gallery: string[] — URLs de fotos pròpies (Firebase Storage)
 *   - amenities: string[] — Redefinit amb valors tipats (abans era genèric)
 *   - ownerId: string — UID del propietari verificat
 *   - verifiedAt: timestamp — Data de verificació
 *
 * Lògica:
 *   - Bars amb tier='premium' reben camps buits preparats
 *   - Bars amb tier='free' no es toquen (els camps són opcionals)
 */

const { collection, getDocs, doc, writeBatch } = require('firebase/firestore');

module.exports = {
    id: '003_add_premium_fields',
    description: 'Afegir camps premium: socialMedia, description, promotionalText, gallery, amenities tipats, ownerId, verifiedAt',

    async up(db) {
        const barsSnap = await getDocs(collection(db, 'bars'));

        if (barsSnap.empty) {
            console.log('  No hi ha bars — res a migrar.');
            return;
        }

        const batch = writeBatch(db);
        let updated = 0;

        barsSnap.forEach(docSnap => {
            const data = docSnap.data();
            const updates = {};

            // Només prepopular camps per a bars premium
            if (data.tier === 'premium') {
                // socialMedia: inicialitzar mapa buit si no existeix
                if (!data.socialMedia) {
                    updates.socialMedia = {};
                }

                // description: inicialitzar buit
                if (data.description === undefined) {
                    updates.description = '';
                }

                // promotionalText: inicialitzar buit
                if (data.promotionalText === undefined) {
                    updates.promotionalText = '';
                }

                // gallery: inicialitzar array buit
                if (!Array.isArray(data.gallery)) {
                    updates.gallery = [];
                }
            }

            // Amenitats: validar que siguin del nou conjunt tipat (per a TOTS els bars)
            const VALID_AMENITIES = new Set([
                'projector', 'multiple_screens', 'outdoor_seating', 'wifi',
                'accessible', 'air_conditioning', 'reservations', 'parking',
                'pet_friendly', 'live_music', 'darts', 'pool_table',
                'sports_bar', 'craft_beer', 'food_served', 'late_night',
            ]);

            if (Array.isArray(data.amenities)) {
                const filtered = data.amenities.filter(a => VALID_AMENITIES.has(a));
                if (filtered.length !== data.amenities.length) {
                    updates.amenities = filtered;
                }
            }

            if (Object.keys(updates).length > 0) {
                batch.update(doc(db, 'bars', docSnap.id), updates);
                updated++;
            }
        });

        if (updated > 0) {
            await batch.commit();
        }

        console.log(`  ✅ Actualitzats ${updated} bars amb camps premium.`);
    }
};
