const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
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
