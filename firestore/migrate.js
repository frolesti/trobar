/**
 * firestore/migrate.js
 *
 * Sistema de migracions per a Firestore.
 *
 * Cada migració és un fitxer a firestore/migrations/ amb:
 *   module.exports = { id, description, up(db) }
 *
 * L'estat s'emmagatzema a Firestore:  system/schema_version
 *   { version, migratedAt, migrations: ['001_initial', '002_xxx', …] }
 *
 * Usage:
 *   node firestore/migrate.js              # aplica migracions pendents
 *   node firestore/migrate.js --status     # mostra estat actual
 *   node firestore/migrate.js --dry-run    # mostra què s'aplicaria
 */

require('dotenv').config();
const fs   = require('fs');
const path = require('path');

const { initializeApp }  = require('firebase/app');
const { getFirestore, doc, getDoc, setDoc, serverTimestamp } = require('firebase/firestore');

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

// ── Paths ───────────────────────────────────────────────────────────────────
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const SCHEMA_REF     = () => doc(db, 'system', 'schema_version');

// ── Load schema version from JSON ───────────────────────────────────────────
function getSchemaVersion() {
    const schemaPath = path.join(__dirname, 'schema.json');
    if (!fs.existsSync(schemaPath)) return '0.0.0';
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
    return schema.version || '0.0.0';
}

// ── Load migration files (sorted) ──────────────────────────────────────────
function loadMigrations() {
    if (!fs.existsSync(MIGRATIONS_DIR)) {
        fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
        return [];
    }

    return fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.js'))
        .sort()
        .map(f => {
            const mod = require(path.join(MIGRATIONS_DIR, f));
            if (!mod.id || !mod.up) {
                console.warn(`⚠️  Skipping ${f}: missing 'id' or 'up' export.`);
                return null;
            }
            return { file: f, ...mod };
        })
        .filter(Boolean);
}

// ── Read applied migrations from Firestore ─────────────────────────────────
async function getAppliedMigrations() {
    const snap = await getDoc(SCHEMA_REF());
    if (!snap.exists()) return { version: '0.0.0', migrations: [] };
    const data = snap.data();
    return {
        version:    data.version    || '0.0.0',
        migrations: data.migrations || [],
    };
}

// ── Save state ─────────────────────────────────────────────────────────────
async function saveMigrationState(appliedIds) {
    await setDoc(SCHEMA_REF(), {
        version:    getSchemaVersion(),
        migratedAt: serverTimestamp(),
        migrations: appliedIds,
    });
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
    const args    = new Set(process.argv.slice(2));
    const status  = args.has('--status');
    const dryRun  = args.has('--dry-run');

    const allMigrations = loadMigrations();
    const applied       = await getAppliedMigrations();
    const appliedSet    = new Set(applied.migrations);
    const pending       = allMigrations.filter(m => !appliedSet.has(m.id));

    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║         troBar — Firestore Migrations           ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log(`  Schema version:  ${getSchemaVersion()}`);
    console.log(`  DB version:      ${applied.version}`);
    console.log(`  Applied:         ${applied.migrations.length}`);
    console.log(`  Pending:         ${pending.length}`);
    console.log();

    if (status) {
        if (applied.migrations.length > 0) {
            console.log('  Applied migrations:');
            applied.migrations.forEach(id => console.log(`    ✅ ${id}`));
        }
        if (pending.length > 0) {
            console.log('  Pending migrations:');
            pending.forEach(m => console.log(`    ⏳ ${m.id} — ${m.description || ''}`));
        }
        return;
    }

    if (pending.length === 0) {
        console.log('  ✅ Database is up to date. Nothing to migrate.');
        return;
    }

    const newApplied = [...applied.migrations];

    for (const migration of pending) {
        console.log(`  ${dryRun ? '[DRY-RUN]' : '🔄'} ${migration.id}: ${migration.description || ''}`);

        if (!dryRun) {
            try {
                await migration.up(db);
                newApplied.push(migration.id);
                console.log(`  ✅ ${migration.id} applied.`);
            } catch (err) {
                console.error(`  ❌ ${migration.id} FAILED:`, err);
                console.error('  ⛔ Stopping. Fix the migration and re-run.');
                // Save partial progress
                await saveMigrationState(newApplied);
                process.exit(1);
            }
        } else {
            newApplied.push(migration.id);
        }
    }

    if (!dryRun) {
        await saveMigrationState(newApplied);
        console.log(`\n  ✅ All ${pending.length} migrations applied. DB version: ${getSchemaVersion()}`);
    } else {
        console.log(`\n  ℹ️  Dry run complete. ${pending.length} migrations would be applied.`);
    }
}

main()
    .then(() => process.exit(0))
    .catch(err => { console.error('❌ Fatal:', err); process.exit(1); });
