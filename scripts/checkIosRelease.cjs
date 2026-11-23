const fs = require('node:fs');
const path = require('node:path');

function iosReleaseIssues(config, environment, root) {
    const issues = [];
    for (const key of [
        'EXPO_PUBLIC_FIREBASE_API_KEY', 'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
        'EXPO_PUBLIC_FIREBASE_PROJECT_ID', 'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
        'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', 'EXPO_PUBLIC_FIREBASE_APP_ID',
        'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY', 'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID',
    ]) {
        if (!environment[key]?.trim()) issues.push(`Falta ${key}.`);
    }
    if (!['prod', 'production'].includes(environment.EXPO_PUBLIC_TROBAR_ENV)) {
        issues.push('EXPO_PUBLIC_TROBAR_ENV ha de ser prod o production.');
    }
    if (environment.EXPO_PUBLIC_FIREBASE_PROJECT_ID !== 'trobar-1123f') {
        issues.push('El projecte Firebase no correspon a la produccio de troBar.');
    }
    if (!config.ios?.bundleIdentifier) issues.push('Falta el bundle identifier iOS.');
    if (!config.ios?.usesAppleSignIn) issues.push('Cal habilitar Sign in with Apple.');
    const googlePlugin = config.plugins?.find(plugin => Array.isArray(plugin) && plugin[0] === '@react-native-google-signin/google-signin');
    const expectedScheme = environment.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.split('.').reverse().join('.');
    if (!expectedScheme || googlePlugin?.[1]?.iosUrlScheme !== expectedScheme) {
        issues.push('El retorn OAuth natiu de Google no esta configurat.');
    }
    const icon = config.ios?.icon || config.icon;
    if (typeof icon !== 'string' || !fs.existsSync(path.resolve(root, icon))) {
        issues.push('Falta la icona iOS.');
    } else {
        const png = fs.readFileSync(path.resolve(root, icon));
        if (png.length < 33 || png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
            || png.readUInt32BE(16) !== 1024 || png.readUInt32BE(20) !== 1024
            || png[25] !== 2) {
            issues.push('La icona iOS ha de ser un PNG RGB opac de 1024 x 1024.');
        }
    }
    return issues;
}

if (require.main === module) {
    const root = path.resolve(__dirname, '..');
    try {
        require('@expo/env').loadProjectEnv(root, { mode: 'production', silent: true });
        const { exp } = require('@expo/config').getConfig(root);
        const issues = iosReleaseIssues(exp, process.env, root);
        for (const issue of issues) console.error(`- ${issue}`);
        if (issues.length) {
            console.error('Preparacio iOS incompleta. Revisa la seccio App Store del README.');
            process.exitCode = 1;
        } else {
            console.log('Configuracio local iOS correcta. Aquest control no valida els valors remots d EAS, la signatura, les normes de compra ni la revisio d Apple.');
        }
    } catch (error) {
        console.error('No s ha pogut validar la configuracio iOS:', error.message);
        process.exitCode = 1;
    }
}

module.exports = { iosReleaseIssues };
