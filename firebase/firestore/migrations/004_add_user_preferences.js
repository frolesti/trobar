/**
 * Migració 004: Afegir preferències d'usuari a la col·lecció users
 *
 * Camp nou:
 *   - preferences: map {
 *       notifications: { matchReminder, liveResults, newBarNearby, barPromotions },
 *       display: { defaultCategory, searchRadius }
 *     }
 *
 * Lògica:
 *   - Tots els usuaris existents reben el camp amb valors per defecte
 *   - Si ja tenen preferences (parcials o completes), es fa merge
 */

const { collection, getDocs, doc, writeBatch } = require('firebase/firestore');

const DEFAULT_PREFERENCES = {
    notifications: {
        matchReminder: 60,
        liveResults: true,
        newBarNearby: false,
        barPromotions: false,
    },
    display: {
        defaultCategory: 'all',
        searchRadius: 2000,
    },
};

module.exports = {
    id: '004_add_user_preferences',
    description: 'Afegir camp preferences a users amb valors per defecte (notificacions + visualització)',

    async up(db) {
        const usersSnap = await getDocs(collection(db, 'users'));

        if (usersSnap.empty) {
            console.log('  No hi ha usuaris — res a migrar.');
            return;
        }

        const batch = writeBatch(db);
        let updated = 0;

        usersSnap.forEach(docSnap => {
            const data = docSnap.data();

            if (!data.preferences) {
                // Usuari sense preferències — afegir totes amb valors per defecte
                batch.update(doc(db, 'users', docSnap.id), {
                    preferences: DEFAULT_PREFERENCES,
                });
                updated++;
            } else {
                // Merge parcial: afegir subcamps que faltin
                const updates = {};
                const existing = data.preferences;

                if (!existing.notifications) {
                    updates['preferences.notifications'] = DEFAULT_PREFERENCES.notifications;
                } else {
                    // Comprovar camps individuals de notificacions
                    const n = existing.notifications;
                    if (n.matchReminder === undefined) updates['preferences.notifications.matchReminder'] = 60;
                    if (n.liveResults === undefined) updates['preferences.notifications.liveResults'] = true;
                    if (n.newBarNearby === undefined) updates['preferences.notifications.newBarNearby'] = false;
                    if (n.barPromotions === undefined) updates['preferences.notifications.barPromotions'] = false;
                }

                if (!existing.display) {
                    updates['preferences.display'] = DEFAULT_PREFERENCES.display;
                } else {
                    const d = existing.display;
                    if (d.defaultCategory === undefined) updates['preferences.display.defaultCategory'] = 'all';
                    if (d.searchRadius === undefined) updates['preferences.display.searchRadius'] = 2000;
                }

                if (Object.keys(updates).length > 0) {
                    batch.update(doc(db, 'users', docSnap.id), updates);
                    updated++;
                }
            }
        });

        if (updated > 0) {
            await batch.commit();
        }

        console.log(`  ✅ Actualitzats ${updated} usuaris amb preferències per defecte.`);
    }
};
