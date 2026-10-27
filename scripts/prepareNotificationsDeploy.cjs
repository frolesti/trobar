const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const destination = path.join(root, '.expo', 'notification-functions');
fs.mkdirSync(path.join(destination, 'lib'), { recursive: true });
for (const filename of ['notificationDelivery.js', 'notificationFunctions.js']) {
    fs.copyFileSync(path.join(root, 'functions', 'lib', filename), path.join(destination, 'lib', filename));
}
const dependencies = require('../functions/package.json').dependencies;
fs.writeFileSync(path.join(destination, 'package.json'), JSON.stringify({
    name: 'trobar-notifications', private: true, main: 'lib/notificationFunctions.js', engines: { node: '22' },
    dependencies: Object.fromEntries(['firebase-admin', 'firebase-functions'].map(name => [name, dependencies[name]])),
}, null, 2));
fs.writeFileSync(path.join(root, '.expo', 'notifications.firebase.json'), JSON.stringify({
    functions: [{ source: 'notification-functions', codebase: 'notifications' }],
}, null, 2));
console.log('Prepared isolated notifications codebase; nothing deployed. Complete security and device gates in docs/guides/NOTIFICATIONS.md first.');