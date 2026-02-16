/*
  Dev runner for this repo.

  Why:
  - Expo/Metro commonly leaves ports (8081/19000/19001/19002) occupied after a crash.
  - Our local ICS proxy uses 8787.
  - On Windows this often makes `expo start` hang on "Waiting on http://localhost:8081".

  What it does:
  1) Tries to detect which PIDs are LISTENING on the known dev ports.
  2) Kills only "safe" targets by default (node-based Expo/Metro or our proxy).
  3) Runs `npm run start:raw` with stdio inherited.

  Controls:
  - TROBAR_DEV_FORCE=1 : also kill unknown node processes on these ports.
  - TROBAR_DEV_KILL_ALL=1 : kill any process on these ports (dangerous).
  - --dry-run : only print what would be killed.
*/

const path = require('path');
const { spawn, spawnSync, execSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');

const DEV_PORTS = [8081, 19000, 19001, 19002];

function getNpmArgvFallback() {
  // npm sets npm_config_argv for scripts. On some Windows setups, args after `--` don't
  // reliably show up in process.argv, so we also parse this env var.
  try {
    const raw = process.env.npm_config_argv;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const original = Array.isArray(parsed?.original) ? parsed.original : [];
    const remain = Array.isArray(parsed?.remain) ? parsed.remain : [];

    // Keep only likely flags to avoid noise like "start".
    return [...original, ...remain]
      .map(String)
      .filter((s) => s.startsWith('-'));
  } catch {
    return [];
  }
}

const argv = new Set([...process.argv.slice(2), ...getNpmArgvFallback()]);
const dryRun = argv.has('--dry-run');
const freeOnly = argv.has('--free-only');
const noProxy = argv.has('--no-proxy');
const expoClear = argv.has('--clear');

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
    // Use PowerShell because tasklist doesn't include command line.
    const ps = `powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter \\\"ProcessId=${pid}\\\").CommandLine"`;
    const raw = runCmd(ps, { shell: 'cmd.exe' });
    const cmdline = String(raw || '').trim();
    return cmdline || null;
  } catch {
    return null;
  }
}

function getListeningPidsOnPortWin(port) {
  // netstat output contains e.g.
  // TCP    0.0.0.0:8081   0.0.0.0:0   LISTENING   22844
  try {
    const raw = runCmd(`netstat -ano -p tcp | findstr :${port}`, { shell: 'cmd.exe' });
    const pids = [];
    for (const line of raw.split(/\r?\n/)) {
      if (!line || !/LISTENING/i.test(line)) continue;
      const parts = line.trim().split(/\s+/);
      const pidStr = parts[parts.length - 1];
      const pid = Number(pidStr);
      if (Number.isFinite(pid) && pid > 0) pids.push(pid);
    }
    return uniq(pids);
  } catch {
    return [];
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

function freePorts() {
  const isWin = process.platform === 'win32';
  const killed = [];
  const skipped = [];

  for (const port of DEV_PORTS) {
    const pids = isWin ? getListeningPidsOnPortWin(port) : getListeningPidsOnPortPosix(port);
    for (const pid of pids) {
      if (pid === process.pid) continue;

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
}

function runMigrations() {
  console.log('-------------------------------------------------------');
  console.log('🗄️  Running Firestore Migrations...');
  const res = spawnSync(process.execPath, ['firestore/migrate.js'], {
    stdio: 'inherit',
    cwd: projectRoot,
    env: process.env,
    shell: false
  });
  console.log('-------------------------------------------------------');
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
  // Run migrations first, then sync data
  runMigrations();
  runSyncScript();

  if (noProxy) {
    const res = spawnSync('npm', ['run', 'start:raw', ...(expoClear ? ['--', '--clear'] : [])], {
      stdio: 'inherit',
      shell: true,
      env: process.env,
      cwd: projectRoot,
    });
    process.exit(res.status ?? 1);
  }

  // Run proxy + Expo without concurrently (more reliable on Windows).
  // Proxy server file scripts/icsProxyServer.js is missing, so we skip it.
  
  const expoCmd = 'npm';
  const expoArgs = ['run', 'start:raw'];
  if (expoClear) {
    expoArgs.push('--', '--clear');
  }

  const expoProc = spawn(expoCmd, expoArgs, {
    stdio: 'inherit',
    cwd: projectRoot,
    env: process.env,
    shell: true,
  });

  expoProc.on('exit', (code) => {
    process.exit(code ?? 1);
  });

  expoProc.on('error', () => {
    process.exit(1);
  });

  process.on('SIGINT', () => {
    process.exit(130);
  });
}

freePorts();
if (dryRun || freeOnly) {
  process.exit(0);
}

runStartRaw();
