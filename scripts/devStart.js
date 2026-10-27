/*
  Dev runner for this repo.

  Why:
  - Expo/Metro commonly leaves ports (8081/19000/19001/19002) occupied after a crash.
  - Our local ICS proxy uses 8787.
  - On Windows this often makes `expo start` hang on "Waiting on http://localhost:8081".

  What it does:
  1) Tries to detect which PIDs are LISTENING on the known dev ports.
  2) Reclaims the dedicated 8081 port; other ports retain safe-target checks.
  3) Loads Expo in this process, retaining its terminal and native Ctrl+C handling.

  Controls:
  - TROBAR_DEV_FORCE=1 : also kill unknown node processes on these ports.
  - TROBAR_DEV_KILL_ALL=1 : kill any process on these ports (dangerous).
  - --dry-run : only print what would be killed.
*/

const path = require('path');
const { spawnSync, execSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const runnerStatePath = path.join(projectRoot, '.expo', 'dev-runner.json');

const DEV_PORTS = [8081, 19000, 19001, 19002];

function getNpmArgvFallback() {
  // npm sets npm_config_argv for scripts. On some Windows setups, args after `--` don't
  // reliably show up in process.argv, so we also parse this env var.
  try {
    const parsed = JSON.parse(process.env.npm_config_argv || '{}');
    const original = Array.isArray(parsed?.original) ? parsed.original : [];
    const remain = Array.isArray(parsed?.remain) ? parsed.remain : [];

    // Keep only likely flags to avoid noise like "start".
    const configuredFlags = ['clear', 'go', 'dev-client', 'lan', 'localhost', 'tunnel', 'web', 'dry-run', 'free-only']
      .filter(flag => /^(true|1)$/i.test(process.env[`npm_config_${flag}`] || process.env[`npm_config_${flag.replace(/-/g, '_')}`] || ''))
      .map(flag => `--${flag}`);
    return [...original, ...remain, ...configuredFlags]
      .map(String)
      .filter((s) => s.startsWith('-'));
  } catch {
    return [];
  }
}

const argv = new Set([...process.argv.slice(2), ...getNpmArgvFallback()]);
const dryRun = argv.has('--dry-run');
const freeOnly = argv.has('--free-only');
const ownerPid = Number(process.env.TROBAR_DEV_OWNER_PID || process.pid);

const force = /^1|true|yes$/i.test(String(process.env.TROBAR_DEV_FORCE || ''));
const killAll = /^1|true|yes$/i.test(String(process.env.TROBAR_DEV_KILL_ALL || ''));

function runCmd(cmd, opts = {}) {
  return execSync(cmd, {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    ...opts
  });
}

function uniq(arr) {
  return Array.from(new Set(arr));
}

function parseTasklistCsvLine(line) {
  // Example: "node.exe","22844","Console","1","186,440 KB"
  const trimmed = line.trim();
  if (!trimmed || trimmed === 'INFO: No tasks are running which match the specified criteria.') return null;

  // Very small CSV parser (quotes + commas)
  const out = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  out.push(current);

  if (out.length < 2) return null;
  return {
    imageName: out[0],
    pid: Number(out[1])
  };
}

function getProcessNameWin(pid) {
  try {
    const raw = runCmd(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, { shell: 'cmd.exe' });
    const line = raw.split(/\r?\n/).find(Boolean);
    const parsed = parseTasklistCsvLine(line || '');
    return parsed?.imageName || null;
  } catch {
    return null;
  }
}

function getCommandLineWin(pid) {
  try {
    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `(Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}').CommandLine`], { encoding: 'utf8', windowsHide: true });
    const cmdline = String(result.stdout || '').trim();
    return cmdline || null;
  } catch {
    return null;
  }
}

function getListeningPidsOnPortWin(port) {
  // netstat output contains e.g.
  // TCP    0.0.0.0:8081   0.0.0.0:0   LISTENING   22844
  try {
    const raw = runCmd('netstat -ano -p tcp', { shell: 'cmd.exe' });
    const pids = [];
    for (const line of raw.split(/\r?\n/)) {
      if (!line || !/LISTENING/i.test(line)) continue;
      const parts = line.trim().split(/\s+/);
      if (!parts[1]?.endsWith(`:${port}`)) continue;
      const pidStr = parts[parts.length - 1];
      const pid = Number(pidStr);
      if (Number.isFinite(pid) && pid > 0) pids.push(pid);
    }
    return uniq(pids);
  } catch (error) {
    throw new Error(`Cannot inspect port ${port}: ${error.message}`);
  }
}

function getListeningPidsOnPortPosix(port) {
  // Best-effort: lsof is common on mac/linux; if missing, skip.
  try {
    const raw = runCmd(`lsof -ti tcp:${port} -sTCP:LISTEN`, { shell: '/bin/sh' });
    return uniq(raw.split(/\r?\n/).map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0));
  } catch {
    return [];
  }
}

function killPidWin(pid) {
  const args = ['/PID', String(pid), '/T', '/F'];
  const res = spawnSync('taskkill', args, { stdio: 'inherit', shell: false });
  return res.status === 0;
}

function getWindowsNodeProcesses() {
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Select-Object ProcessId,CommandLine,CreationDate | ConvertTo-Json -Compress"], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error('Cannot inspect running Expo processes.');
  const processes = JSON.parse(result.stdout || '[]');
  return (Array.isArray(processes) ? processes : [processes]).filter(Boolean);
}

function getProjectExpoPidsWin() {
  const fs = require('fs');
  let state;
  try {
    if (fs.existsSync(runnerStatePath)) state = JSON.parse(fs.readFileSync(runnerStatePath, 'utf8'));
  } catch {}
  return getWindowsNodeProcesses()
    .filter(item => item.ProcessId !== process.pid && item.ProcessId !== ownerPid && (
      (item.CommandLine?.toLowerCase().includes(projectRoot.toLowerCase()) && /expo[\\/]bin[\\/]cli["\s].*\bstart\b/i.test(item.CommandLine)) ||
      (state?.pid === item.ProcessId && state.creationDate === item.CreationDate && /scripts[\\/]devStart\.js/i.test(item.CommandLine || ''))
    ))
    .map(item => item.ProcessId);
}

function registerRunner() {
  if (process.platform !== 'win32') return;
  const fs = require('fs');
  const identity = getWindowsNodeProcesses().find(item => item.ProcessId === process.pid);
  if (!identity?.CreationDate) throw new Error('Cannot record the Expo process identity.');
  fs.mkdirSync(path.dirname(runnerStatePath), { recursive: true });
  fs.writeFileSync(runnerStatePath, JSON.stringify({ pid: process.pid, creationDate: identity.CreationDate }));
  process.once('exit', () => {
    try {
      if (JSON.parse(fs.readFileSync(runnerStatePath, 'utf8')).pid === process.pid) fs.unlinkSync(runnerStatePath);
    } catch {}
  });
}

function killPidPosix(pid) {
  const res = spawnSync('kill', ['-9', String(pid)], { stdio: 'inherit', shell: false });
  return res.status === 0;
}

function isLikelyExpoOrMetroCmdline(cmdline) {
  if (!cmdline) return false;
  const v = cmdline.toLowerCase();
  return (
    v.includes('expo start') ||
    v.includes('expo\\') ||
    v.includes('expo/') ||
    v.includes('metro') ||
    v.includes('react-native')
  );
}

function isLikelyIcsProxyCmdline(cmdline) {
  if (!cmdline) return false;
  const v = cmdline.toLowerCase();
  return v.includes('icsproxyserver.js') || v.includes('ics-proxy');
}

function shouldKillProcess({ port, pid, imageName, cmdline }) {
  if (port === 8081) return true;
  if (killAll) return true;

  const isNode = (imageName || '').toLowerCase() === 'node.exe' || (imageName || '').toLowerCase() === 'node';
  const cmdlineHasProject = cmdline ? cmdline.toLowerCase().includes(projectRoot.toLowerCase()) : false;

  // Safest: our repo.
  if (cmdlineHasProject && isNode) return true;

  // Also safe: anything that looks like Expo/Metro on the dev ports.
  if (isNode && (isLikelyExpoOrMetroCmdline(cmdline) || isLikelyIcsProxyCmdline(cmdline))) return true;

  // If we couldn't fetch command line, we still allow killing node on the dedicated proxy port.
  if (isNode && !cmdline && port === 8787) return true;

  // Force mode: kill node on these ports even if unknown.
  if (force && isNode) return true;

  return false;
}

async function waitForPortFree() {
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      await new Promise((resolve, reject) => {
        const server = require('node:net').createServer();
        server.once('error', reject);
        server.listen({ port: 8081, exclusive: true }, () => server.close(resolve));
      });
      return;
    } catch (error) {
      if (error.code !== 'EADDRINUSE') throw error;
      if (attempt === 19) {
        const remaining = process.platform === 'win32' ? getListeningPidsOnPortWin(8081) : getListeningPidsOnPortPosix(8081);
        throw new Error(`Port 8081 is still occupied by PID ${remaining.join(', ') || 'unknown'}. Stop that process before starting Expo; no alternate port will be used.`);
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

async function freePorts() {
  const isWin = process.platform === 'win32';
  const killed = [];
  const skipped = [];
  const stoppedPids = new Set();

  if (isWin) {
    for (const pid of getProjectExpoPidsWin()) {
      const label = `[project Expo] pid=${pid}`;
      if (dryRun) killed.push(`[dry-run] ${label}`);
      else if (killPidWin(pid)) { killed.push(label); stoppedPids.add(pid); }
      else throw new Error(`Cannot stop project Expo PID ${pid}.`);
    }
  }

  for (const port of DEV_PORTS) {
    const pids = isWin ? getListeningPidsOnPortWin(port) : getListeningPidsOnPortPosix(port);
    for (const pid of pids) {
      if (pid === process.pid || pid === ownerPid || stoppedPids.has(pid)) continue;

      const imageName = isWin ? getProcessNameWin(pid) : null;
      const cmdline = isWin ? getCommandLineWin(pid) : null;

      const decision = shouldKillProcess({ port, pid, imageName, cmdline });

      const label = `[port ${port}] pid=${pid}${imageName ? ` (${imageName})` : ''}${cmdline ? ` :: ${cmdline}` : ''}`;

      if (!decision) {
        skipped.push(label);
        continue;
      }

      if (dryRun) {
        killed.push(`[dry-run] ${label}`);
        continue;
      }

      const ok = isWin ? killPidWin(pid) : killPidPosix(pid);
      if (ok) killed.push(label);
      else skipped.push(`[failed] ${label}`);
    }
  }

  if (killed.length) {
    console.log('Freed ports by stopping processes:');
    for (const line of killed) console.log(`- ${line}`);
  } else {
    console.log('No dev-port processes needed stopping.');
  }

  if (skipped.length) {
    console.log('Skipped (not safe to kill automatically):');
    for (const line of skipped) console.log(`- ${line}`);
    console.log('Tip: set TROBAR_DEV_FORCE=1 (node only) or TROBAR_DEV_KILL_ALL=1 (any process).');
  }
  if (!dryRun) await waitForPortFree();
}

function runSyncScript() {
  console.log('-------------------------------------------------------');
  console.log('🔄 Running Match Sync Script (Server Simulation)...');
  const res = spawnSync(process.execPath, ['scripts/updateMatches.js'], {
    stdio: 'inherit',
    cwd: projectRoot,
    env: process.env,
    shell: false
  });
  console.log('-------------------------------------------------------');
}

function runStartRaw() {
  const expoCli = require.resolve('expo/bin/cli');
  const expoArgs = [expoCli, 'start', '--port', '8081'];
  if (!argv.has('--tunnel')) expoArgs.push('--offline');
  for (const flag of ['--clear', '--go', '--dev-client', '--lan', '--localhost', '--tunnel', '--web']) {
    if (argv.has(flag)) expoArgs.push(flag);
  }
  registerRunner();
  process.env.TROBAR_DEV_PORT_READY_PID = String(process.pid);
  process.argv = [process.execPath, ...expoArgs];
  require(expoCli);
}

function prepareDirectExpoStart() {
  const entry = process.argv[1] || '';
  if (!/[\\/]expo[\\/]bin[\\/]cli(?:\.js)?$/i.test(entry) || process.argv[2] !== 'start') return;
  if (process.env.TROBAR_DEV_PORT_READY_PID === String(process.pid)) return;
  const portIndex = process.argv.findIndex(argument => argument === '--port' || argument === '-p');
  if (portIndex !== -1 && process.argv[portIndex + 1] !== '8081') return;
  const result = spawnSync(process.execPath, [path.join(__dirname, 'devStart.js'), '--free-only'], {
    stdio: 'inherit',
    cwd: projectRoot,
    env: { ...process.env, TROBAR_DEV_OWNER_PID: String(process.pid) },
    shell: false,
  });
  if (result.status !== 0) throw new Error('Cannot recover port 8081. Expo startup was stopped.');
  registerRunner();
  process.env.TROBAR_DEV_PORT_READY_PID = String(process.pid);
}

async function main() {
  try {
    await freePorts();
    if (!dryRun && !freeOnly) runStartRaw();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

if (require.main === module) void main();

module.exports = { shouldKillProcess, getListeningPidsOnPortWin, freePorts, runStartRaw, prepareDirectExpoStart };
