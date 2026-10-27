/**
 * Migration 001: Initial Schema
 *
 * Marca la base de dades actual com a "versió 1.0.0".
 * No fa canvis reals — simplement registra l'estat inicial
 * perquè futures migracions tinguin un punt de partida.
 */

const { doc, getDoc, setDoc, serverTimestamp } = require('firebase/firestore');

module.exports = {
    id: '001_initial_schema',
    description: 'Registra l\'esquema inicial (v1.0.0) sense canvis destructius.',

    async up(db) {
        // Verify core collections exist by checking a known doc
        const syncRef = doc(db, 'system', 'sync_status');
        const syncSnap = await getDoc(syncRef);

        if (syncSnap.exists()) {
            console.log('    📊 system/sync_status exists — data found.');
        } else {
            console.log('    ⚠️  system/sync_status missing — DB may be empty. Marking baseline anyway.');
        }

        // Write a marker so we know this migration ran
        await setDoc(doc(db, 'system', 'schema_version'), {
            version:    '1.0.0',
            migratedAt: serverTimestamp(),
            migrations: ['001_initial_schema'],
            note:       'Baseline — no structural changes applied.',
        });

        console.log('    ✅ Baseline schema v1.0.0 registered.');
    }
};
