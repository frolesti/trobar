const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createInterface } = require('node:readline/promises');
const { stripVTControlCharacters } = require('node:util');

const projectRoot = path.resolve(__dirname, '..');

function readReport(result) {
  if (result.error) throw result.error;
  if (result.signal || ![0, 1].includes(result.status)) {
    throw new Error(result.stderr?.trim() || `Expo ha acabat amb codi ${result.status}.`);
  }
  if (typeof result.stdout !== 'string') throw new Error('Expo no ha retornat cap informe de versions.');
  const lines = stripVTControlCharacters(result.stdout).trim().split(/\r?\n/);
  while (lines.length && (/^env: (?:load|export(?: \(sensitive\))?)(?:\s|$)/.test(lines[0]) || !lines[0].trim())) {
    lines.shift();
  }
  const report = JSON.parse(lines.join('\n'));
  if (!report || !Array.isArray(report.dependencies) || typeof report.upToDate !== 'boolean' ||
      report.upToDate !== (report.dependencies.length === 0) ||
      result.status !== (report.upToDate ? 0 : 1)) {
    throw new Error('Resposta de versions d\'Expo no valida.');
  }
  for (const dependency of report.dependencies) {
    if (typeof dependency.packageName !== 'string' ||
        typeof dependency.actualVersion !== 'string' ||
        typeof dependency.expectedVersionOrRange !== 'string') {
      throw new Error('Dependencia d\'Expo no valida.');
    }
  }
  return report;
}

function assertSameSdk(dependencies, installedVersion) {
  const expo = dependencies.find(dependency => dependency.packageName === 'expo');
  if (!expo) return;
  const target = /^~?(\d+)\.\d+\.\d+$/.exec(expo.expectedVersionOrRange);
  if (!target || target[1] !== installedVersion.split('.')[0]) {
    throw new Error('El canvi proposat d\'Expo no es limita al SDK actual. Revisa\'l manualment.');
  }
}

async function reviewUpdates({
  checkOnly = false,
  offline = false,
  env = process.env,
  input = process.stdin,
  output = process.stdout,
  run = spawnSync,
  log = console,
  confirm = async () => {
    const prompt = createInterface({ input, output });
    try {
      return /^(s|si|sí|y|yes)$/i.test((await prompt.question('Instal·lar aquestes versions abans de continuar? [s/N] ')).trim());
    } finally {
      prompt.close();
    }
  },
} = {}) {
  if (!checkOnly && (offline || /^(1|true)$/i.test(env.EXPO_OFFLINE || '') ||
      env.TROBAR_EXPO_UPDATE_CHECK === '0' || /^(1|true)$/i.test(env.CI || '') ||
      !input.isTTY || !output.isTTY)) {
    log.log('[Expo versions] Revisio omesa (offline, CI, terminal no interactiu o TROBAR_EXPO_UPDATE_CHECK=0).');
    return false;
  }
  log.log('[Expo versions] Revisant les versions compatibles amb el SDK actual...');
  const check = () => readReport(run(process.execPath, [require.resolve('expo/bin/cli'), 'install', '--check', '--json'], {
    cwd: projectRoot,
    // Expo logs inherited loaded keys even with dotenv disabled.
    env: { ...env, CI: '1', EXPO_NO_DOTENV: '1', __EXPO_ENV_LOADED: '[]' },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60000,
    maxBuffer: 1024 * 1024,
    shell: false,
  }));
  let report;
  try {
    report = check();
    assertSameSdk(report.dependencies, require('expo/package.json').version);
  } catch (error) {
    log.warn(`[Expo versions] No s'ha pogut completar la revisio: ${error.message}`);
    log.warn('[Expo versions] No s\'ha instal·lat res. Revisa-ho amb: npx expo install --check');
    if (checkOnly) throw error;
    return false;
  }
  if (report.upToDate) {
    log.log('[Expo versions] Les dependencies estan al dia.');
    return false;
  }
  for (const dependency of report.dependencies) {
    log.log(`  ${dependency.packageName}: ${dependency.actualVersion} -> ${dependency.expectedVersionOrRange}`);
  }
  if (checkOnly) return false;
  log.log('[Expo versions] Els canvis natius poden requerir recompilar i reinstal·lar la development build de l\'iPhone.');
  if (!await confirm()) {
    log.log('[Expo versions] Actualitzacio ajornada. Expo continuara amb les versions instal·lades.');
    return false;
  }
  const result = run(process.execPath, [require.resolve('expo/bin/cli'), 'install', '--fix', '--npm'], {
    cwd: projectRoot,
    env: { ...env, CI: '1' },
    stdio: 'inherit',
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 || result.signal) {
    throw new Error('La instal·lacio ha fallat. Revisa la sortida anterior i executa npx expo install --check abans de tornar a iniciar Expo.');
  }
  if (!check().upToDate) {
    throw new Error('Encara hi ha dependencies incompatibles despres d\'instal·lar. Executa npx expo install --check; Expo no s\'ha iniciat.');
  }
  // Expo can update its own CLI; the start process must not retain old modules.
  log.log('[Expo versions] Actualitzacio completada. Torna a executar la mateixa ordre d\'arrencada per carregar la CLI nova.');
  return true;
}

if (require.main === module) {
  reviewUpdates({
    checkOnly: process.argv.includes('--check-only'),
    offline: process.argv.includes('--offline'),
  }).then(updated => { process.exitCode = updated ? 10 : 0; }).catch(error => {
    console.error(`[Expo versions] ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { readReport, assertSameSdk, reviewUpdates };
