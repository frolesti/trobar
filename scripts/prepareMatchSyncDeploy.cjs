const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const destination = path.join(root, '.expo', 'match-sync-functions');
fs.mkdirSync(path.join(destination, 'lib'), { recursive: true });
for (const filename of ['matchSync.js', 'scheduledMatchSync.js']) {
    fs.copyFileSync(path.join(root, 'functions', 'lib', filename), path.join(destination, 'lib', filename));
}
const dependencies = require('../functions/package.json').dependencies;
fs.writeFileSync(path.join(destination, 'package.json'), JSON.stringify({
    name: 'trobar-match-sync', private: true, main: 'lib/scheduledMatchSync.js', engines: { node: '22' },
    dependencies: Object.fromEntries(['firebase-admin', 'firebase-functions', 'node-ical'].map(name => [name, dependencies[name]])),
}, null, 2));
fs.writeFileSync(path.join(root, '.expo', 'match-sync.firebase.json'), JSON.stringify({
    functions: [{ source: 'match-sync-functions', codebase: 'match-sync' }],
}, null, 2));
console.log('Prepared isolated match-sync deployment, without Stripe handlers or secrets.');