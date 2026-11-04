const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const publicAssets = path.resolve(__dirname, '..', 'public', 'assets');
// Windows junctions are local-only: materialize every web asset for deployment.
for (const directory of ['img', 'logos', 'videos', 'gif']) {
  const destination = path.join(publicAssets, directory);
  if (fs.existsSync(destination) && fs.lstatSync(destination).isSymbolicLink()) {
    fs.unlinkSync(destination);
  }
}
for (const directory of ['img', 'logos', 'videos']) {
  const sourceDirectory = path.join(root, 'assets', 'web', directory);
  fs.cpSync(sourceDirectory, path.join(publicAssets, directory), { recursive: true });
}
const webPublicGifDir = path.resolve(__dirname, '..', 'public', 'assets', 'gif');

// Canonical source priority:
// 1) assets/web/gif/trobar.gif
// 2) assets/app/gif/trobar.gif
const candidates = [
  path.join(root, 'assets', 'web', 'gif', 'trobar.gif'),
  path.join(root, 'assets', 'app', 'gif', 'trobar.gif'),
];

const source = candidates.find((file) => fs.existsSync(file));

if (!source) {
  console.error('[sync-shared-assets] trobar.gif not found in shared assets.');
  console.error('[sync-shared-assets] Checked paths:');
  for (const p of candidates) console.error(`  - ${p}`);
  process.exit(1);
}

fs.mkdirSync(webPublicGifDir, { recursive: true });
const target = path.join(webPublicGifDir, 'trobar.gif');
fs.copyFileSync(source, target);

console.log(`[sync-shared-assets] Copied ${source} -> ${target}`);

const headerSource = path.join(root, 'assets', 'web', 'logos', 'email-header-pattern.png');
const headerTarget = path.resolve(__dirname, '..', 'public', 'assets', 'logos', 'email-header-pattern.png');
fs.mkdirSync(path.dirname(headerTarget), { recursive: true });
if (!fs.existsSync(headerTarget) || fs.realpathSync(headerSource) !== fs.realpathSync(headerTarget)) {
  fs.copyFileSync(headerSource, headerTarget);
}
console.log('[sync-shared-assets] Official email header ready.');
