/**
 * Migration 002: Add broadcast fields to bars collection
 * 
 * Adds:
 *   - broadcastingMatches: string[] — match IDs a bar explicitly broadcasts (verified bars)
 *   - usuallyShowsBarca: boolean — true if bar "usually shows Barça" (user-reported bars)
 * 
 * Logic:
 *   - Bars with source='user_reported' get usuallyShowsBarca=true
 *   - All bars get empty broadcastingMatches[] if not already set
 */

const { collection, getDocs, doc, writeBatch } = require('firebase/firestore');

// dotenv loaded by migrate.js runner

module.exports = {
    id: '002_add_broadcast_fields',
    description: 'Add broadcastingMatches and usuallyShowsBarca fields to bars',

    async up(db) {
        const barsSnap = await getDocs(collection(db, 'bars'));
        
        if (barsSnap.empty) {
            console.log('  No bars found — nothing to migrate.');
            return;
        }

        const batch = writeBatch(db);
        let updated = 0;

        barsSnap.forEach(docSnap => {
            const data = docSnap.data();
            const updates = {};

            // Add broadcastingMatches if not present
            if (!Array.isArray(data.broadcastingMatches)) {
                updates.broadcastingMatches = [];
            }

            // Set usuallyShowsBarca based on source
            if (data.usuallyShowsBarca === undefined) {
                updates.usuallyShowsBarca = data.source === 'user_reported' ? true : false;
            }

            if (Object.keys(updates).length > 0) {
                batch.update(doc(db, 'bars', docSnap.id), updates);
                updated++;
            }
        });

        if (updated > 0) {
            await batch.commit();
        }

        console.log(`  ✅ Updated ${updated} bars with broadcast fields.`);
    }
};
