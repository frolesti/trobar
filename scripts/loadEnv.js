/**
 * scripts/loadEnv.js
 * 
 * Copia el fitxer .env.{entorn} a .env per canviar entre dev i prod.
 * 
 * Ús:
 *   node scripts/loadEnv.js development    (o simplement "dev")
 *   node scripts/loadEnv.js production     (o simplement "prod")
 * 
 * Integrat als scripts de package.json:
 *   npm run env:dev
 *   npm run env:prod
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const aliasMap = {
    dev: 'development',
    development: 'development',
    prod: 'production',
    production: 'production',
};

const arg = (process.argv[2] || '').toLowerCase().trim();
const envName = aliasMap[arg];

if (!envName) {
    console.error(`❌ Entorn no vàlid: "${arg}"`);
    console.error(`   Opcions: dev | development | prod | production`);
    process.exit(1);
}

const sourceFile = path.join(ROOT, `.env.${envName}`);
const targetFile = path.join(ROOT, '.env');

if (!fs.existsSync(sourceFile)) {
    console.error(`❌ No existeix el fitxer: .env.${envName}`);
    console.error(`   Crea'l primer amb les variables del projecte Firebase de ${envName}.`);
    process.exit(1);
}

// Llegim el contingut i afegim un header
const content = fs.readFileSync(sourceFile, 'utf8');

const header = [
    `# ═══════════════════════════════════════════════════════════════════`,
    `# GENERAT AUTOMÀTICAMENT — No editis manualment.`,
    `# Font: .env.${envName}`,
    `# Data: ${new Date().toISOString()}`,
    `# Per canviar d'entorn: npm run env:dev | npm run env:prod`,
    `# ═══════════════════════════════════════════════════════════════════`,
    '',
].join('\n');

fs.writeFileSync(targetFile, header + content, 'utf8');

console.log(`✅ Entorn canviat a: ${envName.toUpperCase()}`);
console.log(`   .env.${envName} → .env`);
console.log(`   Projecte Firebase: ${extractProjectId(content) || '(no configurat)'}`);
console.log('');

function extractProjectId(text) {
    const match = text.match(/EXPO_PUBLIC_FIREBASE_PROJECT_ID\s*=\s*(.+)/);
    return match ? match[1].trim() : null;
}
