const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const destination = path.join(root, '.expo', 'contact-functions');
fs.mkdirSync(path.join(destination, 'lib'), { recursive: true });
fs.copyFileSync(path.join(root, 'functions', 'lib', 'contact.js'), path.join(destination, 'lib', 'contact.js'));
const dependencies = require('../functions/package.json').dependencies;
fs.writeFileSync(path.join(destination, 'package.json'), JSON.stringify({
    name: 'trobar-contact', private: true, main: 'lib/contact.js', engines: { node: '22' },
    dependencies: Object.fromEntries(['firebase-admin', 'firebase-functions'].map(name => [name, dependencies[name]])),
}, null, 2));
fs.writeFileSync(path.join(root, '.expo', 'contact.firebase.json'), JSON.stringify({
    functions: [{ source: 'contact-functions', codebase: 'contact' }],
}, null, 2));
console.log('Prepared isolated contact deployment, without match sync, Stripe handlers or secrets.');
