'use strict';

const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
for (const name of ['template.cjs', 'artDirection.cjs', 'lifecycle.cjs', 'emailVerification.cjs', 'passwordReset.cjs', 'resend.cjs', 'resendTemplates.json']) {
  const target = path.join(root, 'functions', 'lib', 'emails', name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(root, 'emails', name), target);
}
for (const segments of [['theme', 'brandColors.json'], ['data', 'contactEmails.json']]) {
  const target = path.join(root, 'functions', 'lib', 'app', 'src', ...segments);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(path.join(root, 'app', 'src', ...segments), target);
}
fs.mkdirSync(path.join(root, 'functions', 'lib', 'brand'), { recursive: true });
fs.copyFileSync(path.join(root, 'brand', 'palette.json'), path.join(root, 'functions', 'lib', 'brand', 'palette.json'));
console.log('[Email] Shared templates and brand assets prepared for Functions deployment.');
