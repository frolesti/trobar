const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readReport, assertSameSdk, reviewUpdates } = require('../scripts/expoUpdates');

const pending = [{ packageName: 'expo', actualVersion: '58.0.23', expectedVersionOrRange: '~58.0.24' }];
const report = (dependencies = []) => ({
  status: dependencies.length ? 1 : 0,
  stdout: JSON.stringify({ dependencies, upToDate: !dependencies.length }),
});

function harness({ results = [report()], accepted = false, ...options } = {}) {
  const calls = [];
  const messages = [];
  let confirmations = 0;
  return {
    calls,
    messages,
    get confirmations() { return confirmations; },
    run: () => reviewUpdates({
      env: {},
      input: { isTTY: true },
      output: { isTTY: true },
      run: (...args) => { calls.push(args); return results.shift(); },
      log: { log: message => messages.push(message), warn: message => messages.push(message) },
      confirm: async () => { confirmations++; return accepted; },
      ...options,
    }),
  };
}

test('up-to-date check is read-only, bounded and never prompts', async () => {
  const h = harness();
  assert.equal(await h.run(), false);
  assert.equal(h.confirmations, 0);
  assert.equal(h.calls.length, 1);
  assert.deepEqual(h.calls[0][1].slice(1), ['install', '--check', '--json']);
  assert.equal(h.calls[0][2].env.CI, '1');
  assert.equal(h.calls[0][2].env.EXPO_NO_DOTENV, '1');
  assert.equal(h.calls[0][2].env.__EXPO_ENV_LOADED, '[]');
  assert.equal(h.calls[0][2].timeout, 60000);
  assert.equal(h.calls[0][2].shell, false);
});

test('declining changes does not install and allows startup', async () => {
  const h = harness({ results: [report(pending)] });
  assert.equal(await h.run(), false);
  assert.equal(h.confirmations, 1);
  assert.equal(h.calls.length, 1);
  assert(h.messages.some(message => message.includes('expo: 58.0.23 -> ~58.0.24')));
});

test('accepting uses Expo compatibility fix, verifies the result and requests fresh CLI startup', async () => {
  const h = harness({ results: [report(pending), { status: 0 }, report()], accepted: true });
  assert.equal(await h.run(), true);
  assert.equal(h.confirmations, 1);
  assert.deepEqual(h.calls[1][1].slice(1), ['install', '--fix', '--npm']);
  assert.equal(h.calls[1][2].stdio, 'inherit');
  assert.equal(h.calls[2][1].at(-1), '--json');
  assert(h.messages.some(message => message.includes('development build')));
});

test('CI, explicit offline and noninteractive startup never check or install', async () => {
  for (const options of [{ env: { CI: '1' } }, { env: { CI: 'true' } },
    { offline: true }, { env: { EXPO_OFFLINE: '1' } },
    { env: { TROBAR_EXPO_UPDATE_CHECK: '0' } }, { input: { isTTY: false } },
    { output: { isTTY: false } }]) {
    const h = harness(options);
    assert.equal(await h.run(), false);
    assert.equal(h.calls.length, 0);
    assert.equal(h.confirmations, 0);
  }
});

test('explicit check-only works in CI and never installs', async () => {
  const h = harness({ results: [report(pending)], env: { CI: '1' }, checkOnly: true });
  assert.equal(await h.run(), false);
  assert.equal(h.calls.length, 1);
  assert.equal(h.confirmations, 0);
});

test('failed or malformed check is reported, not mistaken for pending updates', async () => {
  for (const result of [{ error: new Error('network timeout') }, { status: 1, stdout: 'not JSON' },
    { status: 2, stderr: 'Expo error' }, { ...report(pending), status: 0 }]) {
    const h = harness({ results: [result], accepted: true });
    assert.equal(await h.run(), false);
    assert.equal(h.confirmations, 0);
    assert.equal(h.calls.length, 1);
    assert(h.messages.some(message => message.includes('No s\'ha pogut completar')));
  }
  await assert.rejects(harness({ results: [{ error: new Error('timeout') }], checkOnly: true }).run(), /timeout/);
});

test('install failure and incomplete fix prevent startup', async () => {
  for (const result of [{ status: 1 }, { status: null, signal: 'SIGINT' }, { error: new Error('spawn failed') }]) {
    const h = harness({ results: [report(pending), result], accepted: true });
    await assert.rejects(h.run(), /fallat|spawn failed/);
  }
  await assert.rejects(harness({
    results: [report(pending), { status: 0 }, report(pending)], accepted: true,
  }).run(), /Encara hi ha dependencies/);
});

test('major SDK upgrades and unrestricted Expo ranges are refused before prompting', async () => {
  for (const version of ['~59.0.0', 'latest', '^58.0.24', '>=58.0.24']) {
    assert.throws(() => assertSameSdk([{ ...pending[0], expectedVersionOrRange: version }], '58.0.23'), /SDK actual/);
    const h = harness({ results: [report([{ ...pending[0], expectedVersionOrRange: version }])], accepted: true });
    await h.run();
    assert.equal(h.confirmations, 0);
    assert.equal(h.calls.length, 1);
  }
  assertSameSdk(pending, '58.0.23');
});

test('report validation rejects missing fields and inconsistent status', () => {
  for (const body of [null, {}, { dependencies: [], upToDate: false },
    { dependencies: [{}], upToDate: false }]) {
    assert.throws(() => readReport({ status: 1, stdout: JSON.stringify(body) }));
  }
});

test('known Expo environment preambles, ANSI colours and CRLF do not corrupt JSON', () => {
  for (const dependencies of [[], pending]) {
    const result = report(dependencies);
    result.stdout = '\uFEFF\u001b[90menv: load .env.local .env.development .env\u001b[39m\r\n' +
      'env: export EXPO_PUBLIC_TROBAR_ENV\r\n' +
      'env: export (sensitive) FOOTBALL_DATA_API_KEY\r\n\r\n' + result.stdout + '\r\n';
    const parsed = readReport(result);
    assert.deepEqual(parsed.dependencies, dependencies);
    assert.equal(parsed.upToDate, !dependencies.length);
  }
});

test('unrecognised output and trailing logs are not silently accepted as a valid report', () => {
  for (const stdout of ['Warning: unexpected output\n' + report().stdout,
    report().stdout + '\nUnexpected trailing output', 'env: export EXPO_PUBLIC_TROBAR_ENV\n',
    'env: load .env\n{invalid JSON}', undefined]) {
    assert.throws(() => readReport({ status: 0, stdout }));
  }
});

test('start inherits real environment values but clears only the child logging marker', async () => {
  const env = {
    __EXPO_ENV_LOADED: '["EXPO_PUBLIC_TROBAR_ENV"]',
    EXPO_PUBLIC_TROBAR_ENV: 'development',
  };
  const h = harness({ env, results: [report(pending)] });
  assert.equal(await h.run(), false);
  assert.equal(h.confirmations, 1);
  const childEnv = h.calls[0][2].env;
  assert.equal(childEnv.__EXPO_ENV_LOADED, '[]');
  assert.equal(childEnv.EXPO_PUBLIC_TROBAR_ENV, 'development');
  assert.equal(env.__EXPO_ENV_LOADED, '["EXPO_PUBLIC_TROBAR_ENV"]');
});

test('an inherited env preamble still reaches confirmation, installation and final verification', async () => {
  const withPreamble = dependencies => {
    const result = report(dependencies);
    return { ...result, stdout: 'env: export EXPO_PUBLIC_TROBAR_ENV\r\n' + result.stdout };
  };
  const h = harness({ results: [withPreamble(pending), { status: 0 }, withPreamble([])], accepted: true });
  assert.equal(await h.run(), true);
  assert.equal(h.confirmations, 1);
  assert.equal(h.calls.length, 3);
  assert.equal(h.calls[0][2].env.__EXPO_ENV_LOADED, '[]');
  assert.equal(h.calls[2][2].env.__EXPO_ENV_LOADED, '[]');
});
