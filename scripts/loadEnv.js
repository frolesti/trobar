/**
 * scripts/loadEnv.js
 * 
 * Copia .env.{entorn} a .env i .env.local per seleccionar dev o prod.
 * .env.local te prioritat sobre el mode automatic d'Expo.
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
const dotenv = require('dotenv');

const ROOT = path.resolve(__dirname, '..');

const aliasMap = {
    dev: 'development',
    development: 'development',
    prod: 'production',
    production: 'production',
};

const generatedMarker = '# GENERAT AUTOMÀTICAMENT — No editis manualment.';
const requiredKeys = [
    'EXPO_PUBLIC_FIREBASE_API_KEY',
    'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
    'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'EXPO_PUBLIC_FIREBASE_APP_ID',
];

function selectEnvironment(argument, root = ROOT) {
    const envName = aliasMap[String(argument || '').toLowerCase().trim()];
    if (!envName) throw new Error('Entorn no valid. Opcions: dev | development | prod | production.');

    const sourceFile = path.join(root, `.env.${envName}`);
    if (!fs.existsSync(sourceFile)) throw new Error(`No existeix .env.${envName}. Configura'l abans de seleccionar aquest entorn.`);
    const content = fs.readFileSync(sourceFile, 'utf8');
    const env = dotenv.parse(content);
    const invalidKeys = requiredKeys.filter(key => !env[key] || /^(?:__.*__|\.\.\.|.*placeholder.*|changeme|your[_ -].*)$/i.test(env[key]));
    if (invalidKeys.length) {
        throw new Error(`.env.${envName} no esta configurat. Revisa: ${invalidKeys.join(', ')}. L'entorn actiu no s'ha canviat.`);
    }
    if (env.EXPO_PUBLIC_TROBAR_ENV !== envName) {
        throw new Error(`EXPO_PUBLIC_TROBAR_ENV ha de ser "${envName}" a .env.${envName}. L'entorn actiu no s'ha canviat.`);
    }
    if (env.TROBAR_ENV && env.TROBAR_ENV !== envName) {
        throw new Error(`TROBAR_ENV no coincideix amb "${envName}". L'entorn actiu no s'ha canviat.`);
    }
    for (const mode of ['development', 'production']) {
        if (fs.existsSync(path.join(root, `.env.${mode}.local`))) {
            throw new Error(`Elimina o integra .env.${mode}.local: tindria prioritat sobre l'entorn seleccionat.`);
        }
    }
    const localFile = path.join(root, '.env.local');
    if (fs.existsSync(localFile) && !fs.readFileSync(localFile, 'utf8').includes(generatedMarker)) {
        throw new Error('.env.local conte configuracio manual. Integra-la als fitxers dev/prod abans de canviar d\'entorn.');
    }

    const header = [
        '# ═══════════════════════════════════════════════════════════════════',
        generatedMarker,
        `# Font: .env.${envName}`,
        `# Data: ${new Date().toISOString()}`,
        '# Per canviar d\'entorn: npm run env:dev | npm run env:prod',
        '# ═══════════════════════════════════════════════════════════════════',
        '',
    ].join('\n');
    fs.writeFileSync(path.join(root, '.env'), header + content, 'utf8');
    fs.writeFileSync(localFile, header + content, 'utf8');
    return { envName, projectId: env.EXPO_PUBLIC_FIREBASE_PROJECT_ID };
}

if (require.main === module) {
    try {
        const { envName, projectId } = selectEnvironment(process.argv[2]);
        console.log(`✅ Entorn canviat a: ${envName.toUpperCase()}`);
        console.log(`   .env.${envName} → .env + .env.local`);
        console.log(`   Projecte Firebase: ${projectId}`);
        console.log('   Reinicia Metro per aplicar el canvi. El tipus de build no canvia.');
    } catch (error) {
        console.error(`❌ ${error.message}`);
        process.exitCode = 1;
    }
}

module.exports = { selectEnvironment };
