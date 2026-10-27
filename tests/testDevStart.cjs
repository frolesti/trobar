const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');

function harness({ listing = '', blocked = false, args = [], env = {}, projectProcesses = [], state, staleNetstat = false } = {}) {
  const calls = [];
  const parent = new EventEmitter();
  Object.assign(parent, { platform: 'win32', pid: 100, execPath: 'node.exe', argv: ['node', 'devStart.js', ...args], env, exit: code => calls.push(['exit', code]) });
  const child = new EventEmitter();
  child.pid = 200;
  let currentListing = listing;
  const module = { exports: {} };
  const requireMock = name => {
    if (name === 'child_process') return {
      execSync: command => command.startsWith('netstat') ? staleNetstat ? listing : currentListing : '"other.exe","123","Console","1","1 KB"',
      spawnSync: (command, parameters) => {
        calls.push([command, parameters]);
        if (command === 'taskkill' && !blocked) currentListing = '';
        return { status: command === 'taskkill' && blocked ? 1 : 0, stdout: command === 'powershell.exe' && parameters.some(value => value.includes('ConvertTo-Json')) ? JSON.stringify([...projectProcesses, { ProcessId: 100, CreationDate: 'test-current-process' }]) : '' };
      },
      spawn: (command, parameters, options) => { calls.push(['spawn', command, parameters, options]); return child; },
    };
    if (name === 'expo/bin/cli') { calls.push(['expo', parent.argv]); return {}; }
    if (name === 'node:net') return { createServer: () => {
      const server = new EventEmitter();
      server.close = callback => callback();
      server.listen = (_options, callback) => {
        if (currentListing) server.emit('error', Object.assign(new Error('Port occupied'), { code: 'EADDRINUSE' }));
        else callback();
      };
      return server;
    } };
    if (name === 'fs') return { existsSync: file => file.endsWith('dev-runner.json') && !!state, readFileSync: () => typeof state === 'string' ? state : JSON.stringify(state), mkdirSync() {}, writeFileSync: (_file, data) => { state = JSON.parse(data); }, unlinkSync: () => { state = undefined; } };
    return require(name);
  };
  requireMock.resolve = () => 'expo/bin/cli';
  const scriptsDir = path.join(__dirname, '../scripts');
  vm.runInNewContext(fs.readFileSync(path.join(scriptsDir, 'devStart.js'), 'utf8'), { require: requireMock, module, exports: module.exports, __dirname: scriptsDir, process: parent, setTimeout: callback => callback(), console: { log() {}, error() {} } });
  return { ...module.exports, calls, parent, child };
}

test('8081 is always reclaimed, without force-killing unrelated ports', () => {
  const runner = harness();
  assert.equal(runner.shouldKillProcess({ port: 8081, imageName: 'unknown.exe' }), true);
  assert.equal(runner.shouldKillProcess({ port: 19000, imageName: 'unknown.exe' }), false);
});

test('Windows listener detection matches the exact local port, not remote or prefixed ports', () => {
  const runner = harness({ listing: 'TCP 0.0.0.0:8081 0.0.0.0:0 LISTENING 123\nTCP [::]:8081 [::]:0 LISTENING 123\nTCP 0.0.0.0:80810 0.0.0.0:0 LISTENING 456\nTCP 0.0.0.0:9000 127.0.0.1:8081 LISTENING 789' });
  assert.deepEqual(Array.from(runner.getListeningPidsOnPortWin(8081)), [123]);
});

test('cleanup verifies release and fails explicitly when the listener cannot be stopped', async () => {
  const listing = 'TCP 0.0.0.0:8081 0.0.0.0:0 LISTENING 123';
  const runner = harness({ listing });
  await runner.freePorts();
  assert.equal(runner.getListeningPidsOnPortWin(8081).length, 0);
  await assert.rejects(harness({ listing, blocked: true }).freePorts(), /8081 is still occupied/);
  const preview = harness({ listing, args: ['--dry-run'] });
  await preview.freePorts();
  assert.equal(preview.calls.some(call => call[0] === 'taskkill'), false);
});

test('Expo runs in the controller process on 8081, with no child process to orphan', () => {
  const runner = harness({ args: ['--clear', '--go'] });
  runner.runStartRaw();
  const expo = runner.calls.find(call => call[0] === 'expo');
  assert.deepEqual(Array.from(expo[1]), ['node.exe', 'expo/bin/cli', 'start', '--port', '8081', '--offline', '--clear', '--go']);
  assert(!runner.calls.some(call => call[0] === 'spawn'));
  assert(!runner.calls.some(call => call[1]?.some?.(value => typeof value === 'string' && value.includes('migrate.js'))));
});

test('npm configuration preserves Expo flags when PowerShell consumes the argument separator', () => {
  const runner = harness({ env: { npm_config_clear: 'true', npm_config_go: 'true' } });
  runner.runStartRaw();
  const expo = runner.calls.find(call => call[0] === 'expo');
  assert(expo[1].includes('--clear'));
  assert(expo[1].includes('--go'));
});

test('cleanup also stops this project Expo when startup hangs before opening a port', async () => {
  const projectRoot = path.resolve(__dirname, '..');
  const runner = harness({ projectProcesses: [
    { ProcessId: 300, CommandLine: `node "${projectRoot}\\node_modules\\expo\\bin\\cli" start --port 8081` },
    { ProcessId: 400, CommandLine: 'node C:\\other\\node_modules\\expo\\bin\\cli start' },
  ] });
  await runner.freePorts();
  assert(runner.calls.some(call => call[0] === 'taskkill' && call[1].includes('300')));
  assert(!runner.calls.some(call => call[0] === 'taskkill' && call[1].includes('400')));
});

test('recorded runner identity allows recovery before listening but rejects reused PIDs', async () => {
  const projectProcesses = [{ ProcessId: 300, CreationDate: 'old-process', CommandLine: 'node scripts/devStart.js' }];
  const runner = harness({ projectProcesses, state: { pid: 300, creationDate: 'old-process' } });
  await runner.freePorts();
  assert(runner.calls.some(call => call[0] === 'taskkill' && call[1].includes('300')));
  const reused = harness({ projectProcesses, state: { pid: 300, creationDate: 'different-process' } });
  await reused.freePorts();
  assert(!reused.calls.some(call => call[0] === 'taskkill'));
});

test('a successful port reservation is authoritative even when netstat retains a stopped PID', async () => {
  const runner = harness({ listing: 'TCP 0.0.0.0:8081 0.0.0.0:0 LISTENING 123', staleNetstat: true });
  await runner.freePorts();
});

test('an interrupted state-file write cannot prevent port recovery', async () => {
  const runner = harness({ listing: 'TCP 0.0.0.0:8081 0.0.0.0:0 LISTENING 123', state: '{"pid":' });
  await runner.freePorts();
  assert.equal(runner.getListeningPidsOnPortWin(8081).length, 0);
});

test('npx expo start reclaims the port exactly once and protects its own process', () => {
  const runner = harness();
  runner.parent.argv = ['node.exe', path.join(__dirname, '../node_modules/expo/bin/cli'), 'start', '--clear'];
  runner.prepareDirectExpoStart();
  runner.prepareDirectExpoStart();
  const helpers = runner.calls.filter(call => call[0] === 'node.exe');
  assert.equal(helpers.length, 1);
  assert.equal(helpers[0][1].at(-1), '--free-only');
  assert.equal(runner.parent.env.TROBAR_DEV_PORT_READY_PID, '100');
});

test('build, export and ordinary configuration evaluation never reclaim ports', () => {
  for (const command of ['export', 'prebuild', 'config', 'run:android']) {
    const runner = harness();
    runner.parent.argv = ['node.exe', path.join(__dirname, '../node_modules/expo/bin/cli'), command];
    runner.prepareDirectExpoStart();
    assert.equal(runner.calls.length, 0);
  }
});

test('port cleanup never terminates the Expo process that requested it', async () => {
  const projectRoot = path.resolve(__dirname, '..');
  const runner = harness({ env: { TROBAR_DEV_OWNER_PID: '300' }, projectProcesses: [{ ProcessId: 300, CommandLine: `node ${projectRoot}\\node_modules\\expo\\bin\\cli start` }] });
  await runner.freePorts();
  assert(!runner.calls.some(call => call[0] === 'taskkill'));
});