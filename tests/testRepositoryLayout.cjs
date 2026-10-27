const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = filename => fs.readFileSync(path.join(root, filename), 'utf8');

test('Firebase CLI resolves the centralized rules, indexes and functions', () => {
    const config = JSON.parse(read('firebase.json'));
    for (const filename of [config.firestore.rules, config.firestore.indexes, config.storage.rules]) {
        assert(filename.startsWith('firebase/'));
        assert(fs.statSync(path.join(root, filename)).isFile(), filename);
    }
    JSON.parse(read(config.firestore.indexes));
    JSON.parse(read('firebase/firestore/schema.json'));
    for (const entry of config.functions) assert(fs.statSync(path.join(root, entry.source)).isDirectory());
});

test('database commands and migrations resolve without executing remote operations', () => {
    const { scripts } = JSON.parse(read('package.json'));
    for (const command of ['db:migrate', 'db:migrate:status', 'db:migrate:dry-run', 'db:validate']) {
        const filename = scripts[command].split(' ')[1];
        assert(filename.startsWith('firebase/firestore/'));
        assert(fs.statSync(path.join(root, filename)).isFile(), filename);
    }
    const migrations = path.join(root, 'firebase/firestore/migrations');
    assert(fs.readdirSync(migrations).filter(filename => filename.endsWith('.js')).length > 0);
    assert(!fs.readdirSync(path.join(root, 'scripts')).some(filename => /^test.*\.cjs$/.test(filename)));
});

test('shared documentation links point to existing repository paths', () => {
    const guides = fs.readdirSync(path.join(root, 'docs/guides')).filter(filename => filename.endsWith('.md'));
    for (const filename of ['README.md', 'docs/README.md', ...guides.map(filename => `docs/guides/${filename}`)]) {
        for (const match of read(filename).matchAll(/\]\(([^)]+)\)/g)) {
            const target = match[1];
            if (/^(?:https?:|mailto:|#)/.test(target)) continue;
            const resolved = path.resolve(root, path.dirname(filename), target.split('#')[0]);
            assert(fs.existsSync(resolved), `${filename}: ${target}`);
        }
    }
});

test('export commands keep generated output outside source directories', () => {
    const { scripts } = JSON.parse(read('package.json'));
    assert.equal(scripts.test, 'node --test tests/*.cjs');
    for (const platform of ['web', 'ios']) {
        assert.equal(scripts[`export:${platform}`], `expo export --platform ${platform} --output-dir .local/exports/${platform}`);
    }
    assert(read('.gitignore').split(/\r?\n/).includes('.local/'));
    assert(read('.gitignore').split(/\r?\n/).includes('docs/local/'));
});
