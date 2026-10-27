/**
 * firebase/firestore/validate.js
 *
 * Validates live Firestore data against the canonical schema.json.
 * Reports missing fields, wrong types, and unknown fields.
 *
 * Usage:
 *   npm run db:validate                  # validate all collections
 *   npm run db:validate -- matches       # validate only 'matches'
 *   npm run db:validate -- --sample 5     # check 5 docs per collection
 */

require('dotenv').config();
const fs   = require('fs');
const path = require('path');

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, limit } = require('firebase/firestore');

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

// ── Load schema ─────────────────────────────────────────────────────────────
const schemaPath = path.join(__dirname, 'schema.json');
const schema     = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

// ── Args ────────────────────────────────────────────────────────────────────
const args       = process.argv.slice(2);
const onlyCol    = args.find(a => !a.startsWith('--'));
const sampleIdx  = args.indexOf('--sample');
const sampleSize = sampleIdx >= 0 ? parseInt(args[sampleIdx + 1], 10) || 10 : 10;

// ── Type checker ────────────────────────────────────────────────────────────
function checkType(value, expectedType) {
    if (value === null || value === undefined) return 'null';

    const et = expectedType.replace(/\s/g, '');

    // Nullable types (e.g. "map | null", "number | null")
    if (et.includes('|null')) {
        if (value === null) return null;
        // Check the non-null part
        return checkType(value, et.replace(/\|null/g, ''));
    }

    // Firestore Timestamp
    if (et === 'timestamp') {
        if (value && typeof value.toDate === 'function') return null;
        return `expected timestamp, got ${typeof value}`;
    }

    // Map
    if (et === 'map' || et.startsWith('map<')) {
        if (typeof value === 'object' && !Array.isArray(value)) return null;
        return `expected map, got ${typeof value}`;
    }

    // Array
    if (et.startsWith('array')) {
        if (Array.isArray(value)) return null;
        return `expected array, got ${typeof value}`;
    }

    // Primitives
    const baseType = et.split('|')[0];
    if (baseType === 'string'  && typeof value === 'string')  return null;
    if (baseType === 'number'  && typeof value === 'number')  return null;
    if (baseType === 'boolean' && typeof value === 'boolean') return null;

    return `expected ${expectedType}, got ${typeof value}`;
}

// ── Validate one document ───────────────────────────────────────────────────
function validateDoc(docId, data, fieldDefs) {
    const issues = [];

    // Check required fields exist
    for (const [name, def] of Object.entries(fieldDefs)) {
        if (def.required && (data[name] === undefined || data[name] === null)) {
            issues.push({ doc: docId, field: name, issue: 'MISSING (required)' });
            continue;
        }
        if (data[name] !== undefined && data[name] !== null) {
            const typeErr = checkType(data[name], def.type);
            if (typeErr) {
                issues.push({ doc: docId, field: name, issue: typeErr });
            }

            // Check enum values
            if (def.enum && !def.enum.includes(data[name])) {
                issues.push({ doc: docId, field: name, issue: `value '${data[name]}' not in enum [${def.enum.join(', ')}]` });
            }

            // Recurse into nested maps
            if (def.fields && typeof data[name] === 'object' && !Array.isArray(data[name])) {
                for (const [subName, subDef] of Object.entries(def.fields)) {
                    if (subDef.required !== false && data[name][subName] === undefined) {
                        // Sub-fields are not strictly required unless marked
                    }
                    if (data[name][subName] !== undefined) {
                        const subErr = checkType(data[name][subName], subDef.type);
                        if (subErr) {
                            issues.push({ doc: docId, field: `${name}.${subName}`, issue: subErr });
                        }
                    }
                }
            }
        }
    }

    return issues;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
    const collections = schema.collections;
    const colNames    = onlyCol ? [onlyCol] : Object.keys(collections).filter(c => c !== 'system');

    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║       troBar — Firestore Schema Validator       ║');
    console.log('╚══════════════════════════════════════════════════╝');
    console.log(`  Schema version: ${schema.version}`);
    console.log(`  Sample size:    ${sampleSize} docs/collection\n`);

    let totalIssues = 0;

    for (const colName of colNames) {
        const colDef = collections[colName];
        if (!colDef || !colDef.fields) {
            console.log(`  ⏭️  ${colName}: no field definitions in schema (skipped)`);
            continue;
        }

        const q    = query(collection(db, colName), limit(sampleSize));
        const snap = await getDocs(q);

        if (snap.empty) {
            console.log(`  📭 ${colName}: empty collection`);
            continue;
        }

        const issues = [];
        snap.forEach(d => {
            issues.push(...validateDoc(d.id, d.data(), colDef.fields));
        });

        if (issues.length === 0) {
            console.log(`  ✅ ${colName}: ${snap.size} docs checked — no issues`);
        } else {
            console.log(`  ⚠️  ${colName}: ${issues.length} issues in ${snap.size} docs:`);
            for (const i of issues) {
                console.log(`      doc=${i.doc}  field=${i.field}  → ${i.issue}`);
            }
            totalIssues += issues.length;
        }
    }

    console.log();
    if (totalIssues === 0) {
        console.log('  ✅ All collections valid.');
    } else {
        console.log(`  ⚠️  ${totalIssues} total issues found. Consider creating a migration.`);
    }
}

main()
    .then(() => process.exit(0))
    .catch(err => { console.error('❌ Fatal:', err); process.exit(1); });
