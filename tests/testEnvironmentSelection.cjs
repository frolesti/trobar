const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseProjectEnv } = require('@expo/env');
const { selectEnvironment } = require('../scripts/loadEnv');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trobar-env-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const environment of ['development', 'production']) {
    fs.writeFileSync(path.join(root, `.env.${environment}`), [
      `EXPO_PUBLIC_TROBAR_ENV=${environment}`,
      `TROBAR_ENV=${environment}`,
      `EXPO_PUBLIC_FIREBASE_PROJECT_ID=demo-trobar-${environment}`,
      'EXPO_PUBLIC_FIREBASE_API_KEY=test-key',
      'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=example.invalid',
      'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=example.invalid',
      'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456',
      'EXPO_PUBLIC_FIREBASE_APP_ID=test-app',
      '',
    ].join('\n'));
  }
  return root;
}

test('selected dev and prod survive both Expo start and export dotenv modes', t => {
  const root = fixture(t);
  for (const [argument, environment] of [['dev', 'development'], ['prod', 'production'], ['dev', 'development']]) {
    assert.equal(selectEnvironment(argument, root).envName, environment);
    for (const mode of ['development', 'production']) {
      const { env } = parseProjectEnv(root, { mode, systemEnv: {} });
      assert.equal(env.EXPO_PUBLIC_TROBAR_ENV, environment);
      assert.equal(env.TROBAR_ENV, environment);
      assert.equal(env.EXPO_PUBLIC_FIREBASE_PROJECT_ID, `demo-trobar-${environment}`);
    }
    assert.equal(fs.readFileSync(path.join(root, '.env'), 'utf8'), fs.readFileSync(path.join(root, '.env.local'), 'utf8'));
  }
});

test('unconfigured production fails without replacing active dev', t => {
  const root = fixture(t);
  selectEnvironment('dev', root);
  const active = fs.readFileSync(path.join(root, '.env'), 'utf8');
  fs.writeFileSync(path.join(root, '.env.production'), 'EXPO_PUBLIC_FIREBASE_PROJECT_ID=__CANVIA_AQUI__\n');
  assert.throws(() => selectEnvironment('prod', root), /no esta configurat/);
  assert.equal(fs.readFileSync(path.join(root, '.env'), 'utf8'), active);
  assert.equal(fs.readFileSync(path.join(root, '.env.local'), 'utf8'), active);
});

test('valid keys containing consecutive underscores are not mistaken for placeholders', t => {
  const root = fixture(t);
  const filename = path.join(root, '.env.development');
  fs.writeFileSync(filename, fs.readFileSync(filename, 'utf8').replace('test-key', 'test__key'));
  assert.equal(selectEnvironment('dev', root).envName, 'development');
});

test('invalid environment names, missing files and inconsistent labels fail explicitly', t => {
  const root = fixture(t);
  assert.throws(() => selectEnvironment('preview', root), /Entorn no valid/);
  fs.unlinkSync(path.join(root, '.env.production'));
  assert.throws(() => selectEnvironment('prod', root), /No existeix/);
  const filename = path.join(root, '.env.development');
  const original = fs.readFileSync(filename, 'utf8');
  fs.writeFileSync(filename, original.replace('EXPO_PUBLIC_TROBAR_ENV=development', 'EXPO_PUBLIC_TROBAR_ENV=production'));
  assert.throws(() => selectEnvironment('dev', root), /EXPO_PUBLIC_TROBAR_ENV/);
  fs.writeFileSync(filename, original.replace('TROBAR_ENV=development', 'TROBAR_ENV=production'));
  assert.throws(() => selectEnvironment('dev', root), /TROBAR_ENV/);
  assert.equal(fs.existsSync(path.join(root, '.env')), false);
});

test('manual and mode-specific overrides are not silently overwritten or ignored', t => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, '.env.local'), 'CUSTOM_SETTING=manual\n');
  assert.throws(() => selectEnvironment('dev', root), /configuracio manual/);
  assert.equal(fs.readFileSync(path.join(root, '.env.local'), 'utf8'), 'CUSTOM_SETTING=manual\n');
  fs.unlinkSync(path.join(root, '.env.local'));
  for (const mode of ['development', 'production']) {
    const filename = path.join(root, `.env.${mode}.local`);
    fs.writeFileSync(filename, 'CUSTOM_SETTING=manual\n');
    assert.throws(() => selectEnvironment('dev', root), /tindria prioritat/);
    fs.unlinkSync(filename);
  }
});

test('Android defaults to dev and stops when environment activation fails', () => {
  const source = fs.readFileSync(path.join(__dirname, '../scripts/runAndroid.ps1'), 'utf8');
  assert.match(source, /\[string\]\$Env = "dev"/);
  assert.match(source, /npm run "env:\$Env"\s+if \(\$LASTEXITCODE -ne 0\)/);
});
