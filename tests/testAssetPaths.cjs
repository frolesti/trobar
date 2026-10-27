const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const assets = path.join(root, 'assets', 'app');
const isAsset = filename => /\.(png|jpe?g|gif|webp|svg|mp4)$/i.test(filename);

function assertCanonicalAsset(origin, reference) {
    const resolved = path.resolve(path.dirname(origin), reference);
    const relative = path.relative(assets, resolved);
    assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative), `${origin}: ${reference} must resolve inside assets/app, not a local junction`);
    let current = assets;
    for (const segment of relative.split(path.sep)) {
        assert(fs.readdirSync(current).includes(segment), `${reference}: missing asset or incorrect filename case: ${segment}`);
        current = path.join(current, segment);
    }
    assert(fs.statSync(resolved).isFile(), `${reference}: not a file`);
}

function sources(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const filename = path.join(directory, entry.name);
        if (entry.isDirectory()) return sources(filename);
        return /\.(tsx?|jsx?)$/.test(entry.name) ? [filename] : [];
    });
}

test('all static application assets resolve without app/assets or filename-case aliases', () => {
    let count = 0;
    for (const filename of [path.join(root, 'App.tsx'), ...sources(path.join(root, 'app', 'src'))]) {
        const source = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true);
        function visit(node) {
            const reference = ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require'
                ? node.arguments[0]
                : ts.isImportDeclaration(node) ? node.moduleSpecifier : undefined;
            if (reference && ts.isStringLiteral(reference) && reference.text.startsWith('.') && isAsset(reference.text)) {
                assertCanonicalAsset(filename, reference.text);
                count++;
            }
            ts.forEachChild(node, visit);
        }
        visit(source);
    }
    assert(count > 50, 'asset validation must cover logos, competition badges and team crests');
});

test('Expo image configuration uses the same canonical asset paths', () => {
    let count = 0;
    function visit(value) {
        if (typeof value === 'string' && value.startsWith('./') && isAsset(value)) {
            assertCanonicalAsset(path.join(root, 'app.json'), value);
            count++;
        } else if (value && typeof value === 'object') {
            for (const child of Object.values(value)) visit(child);
        }
    }
    visit(JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')));
    assert(count > 0);
});
