'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { createHostedTemplate, fieldKinds } = require('../emails/resend.cjs');
const manifestPath = path.resolve(__dirname, '..', 'emails', 'resendTemplates.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const update = process.argv.includes('--update');
const lookup = 'npx.cmd ' + ['--offline', '--yes', '--package=resend-cli@latest', '--call', 'where.exe resend']
  .map(value => `"${value}"`).join(' ');
const located = execFileSync(process.env.ComSpec, ['/d', '/s', '/c', `"${lookup}"`],
{ encoding: 'utf8', windowsVerbatimArguments: true, stdio: ['ignore', 'pipe', 'pipe'] });
const shim = located.split(/\r?\n/).find(file => file.endsWith('\\node_modules\\.bin\\resend.cmd'));
if (!shim) throw new Error('Cached official Resend CLI not found');
const cliRoot = path.resolve(path.dirname(shim), '..', 'resend-cli');
const cliPackage = JSON.parse(fs.readFileSync(path.join(cliRoot, 'package.json'), 'utf8'));
const cliEntry = path.resolve(cliRoot, cliPackage.bin.resend);
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'trobar-resend-'));
const htmlPath = path.join(directory, 'template.html');

function cli(args) {
  const output = execFileSync(process.execPath, [cliEntry, ...args, '--profile', 'trobar-setup', '--json'], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  return JSON.parse(output);
}
function save() { fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n'); }

try {
  for (const kind of fieldKinds) {
    const template = createHostedTemplate(kind);
    if (!manifest[kind]) {
      fs.writeFileSync(htmlPath, template.html);
      const created = cli(['templates', 'create', '--name', template.name, '--alias', template.alias,
        '--html-file', htmlPath, '--subject', template.subject, '--from', template.from, '--reply-to', template.replyTo,
        ...template.variables.flatMap(variable => ['--var', `${variable.key}:string`])]);
      if (!created.id) throw new Error(`Template creation returned no ID: ${kind}`);
      manifest[kind] = { id: created.id, variables: template.variables.map(variable => variable.key), published: false };
      save();
    }
    const entry = manifest[kind];
    const remote = cli(['templates', 'get', entry.id]);
    const keys = remote.variables?.map(variable => variable.key).sort();
    if (!keys || remote.variables.some(variable => variable.type !== 'string')
      || JSON.stringify(keys) !== JSON.stringify([...entry.variables].sort())) {
      throw new Error(`Remote variable schema differs: ${kind}`);
    }
    const replies = Array.isArray(remote.reply_to) ? remote.reply_to : [remote.reply_to];
    if (update && remote.status === 'published' && !remote.has_unpublished_versions
      && remote.html === template.html && remote.subject === template.subject
      && remote.from === template.from && replies.length === 1 && replies[0] === template.replyTo) {
      if (!entry.published) { entry.published = true; save(); }
      console.log(`${kind}: ${entry.id} (already current; published content verified)`);
      continue;
    }
    if (update) {
      const expected = template.variables.map(variable => variable.key).sort();
      if (JSON.stringify(expected) !== JSON.stringify([...entry.variables].sort())) {
        throw new Error(`Variable migration requires a coordinated backend update: ${kind}`);
      }
      fs.writeFileSync(htmlPath, template.html);
      cli(['templates', 'update', entry.id, '--html-file', htmlPath, '--subject', template.subject,
        '--from', template.from, '--reply-to', template.replyTo,
        ...template.variables.flatMap(variable => ['--var', `${variable.key}:string`])]);
    }
    if (update || !entry.published) {
      cli(['templates', 'publish', entry.id]);
      const published = cli(['templates', 'get', entry.id]);
      if (published.status !== 'published' || published.has_unpublished_versions
        || published.html !== template.html || published.subject !== template.subject
        || JSON.stringify(published.variables?.map(variable => variable.key).sort())
          !== JSON.stringify(template.variables.map(variable => variable.key).sort())) {
        throw new Error(`Published template did not match the intended content: ${kind}`);
      }
      entry.published = true;
      save();
    }
    console.log(`${kind}: ${entry.id} (${update ? 'updated and ' : ''}published; variables verified)`);
  }
} finally {
  if (fs.existsSync(htmlPath)) fs.unlinkSync(htmlPath);
  fs.rmdirSync(directory);
}
