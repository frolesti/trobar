const { execSync, spawn } = require('child_process');

const PORT = process.env.PORT || 3000;

function killOnPort(port) {
  try {
    if (process.platform === 'win32') {
      const out = execSync(`netstat -ano | findstr :${port}`, { stdio: ['pipe', 'pipe', 'ignore'] }).toString();
      const pids = new Set();
      out.split(/\r?\n/).forEach(line => {
        line = line.trim();
        if (!line) return;
        const parts = line.split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0') pids.add(pid);
      });
      pids.forEach(pid => {
        try {
          execSync(`taskkill /PID ${pid} /F`);
          console.log(`Killed process ${pid} on port ${port}`);
        } catch (e) {
          console.warn(`Failed to kill ${pid}: ${e.message}`);
        }
      });
    } else {
      // unix-like
      const out = execSync(`lsof -i :${port} -t || true`).toString();
      out.split(/\r?\n/).forEach(pid => {
        pid = pid.trim();
        if (!pid) return;
        try {
          process.kill(Number(pid), 'SIGKILL');
          console.log(`Killed process ${pid} on port ${port}`);
        } catch (e) {
          console.warn(`Failed to kill ${pid}: ${e.message}`);
        }
      });
    }
  } catch (e) {
    // no process found or other error
    // swallow and continue
  }
}

function startServer() {
  const fs = require('fs');
  const path = require('path');
  const nextDir = path.join(__dirname, '..', '.next');
  const hasProdBuild = fs.existsSync(path.join(nextDir, 'server')) || fs.existsSync(path.join(nextDir, 'BUILD_ID'));
  const mode = hasProdBuild ? 'start' : 'dev';
  console.log(`Starting Next.js (${mode}) on port ${PORT}...`);
  const command = `npx next ${mode} -p ${PORT}`;
  const child = spawn(command, { stdio: 'inherit', shell: true });
  child.on('exit', code => process.exit(code));
  child.on('error', err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

(async function main() {
  console.log(`autostart: ensuring port ${PORT} is free`);
  killOnPort(PORT);
  startServer();
})();
