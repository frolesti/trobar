const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

test('web lifecycle calls use authenticated handlers and reject unconfirmed responses', async () => {
    const module = { exports: {} };
    const calls = [];
    let status;
    let failure;
    const source = fs.readFileSync(require.resolve('../web-app/lib/lifecycleEmail.ts'), 'utf8');
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
        module, exports: module.exports,
        require(name) {
            if (name === './firebase') return { functions: 'client' };
            if (name === 'firebase/functions') return { httpsCallable: (client, handler) => async (...args) => {
                calls.push({ client, handler, args });
                if (failure) throw failure;
                return { data: { status } };
            } };
            throw new Error(`Unexpected dependency ${name}`);
        },
    });
    for (status of ['queued', 'suppressed', 'unverified', 'not-new']) await module.exports.recordFirstWebLogin();
    assert(calls.every(call => call.handler === 'recordFirstLogin' && call.client === 'client' && call.args.length === 0));
    for (status of ['recorded', 'suppressed']) await module.exports.recordWebAccountSecurity();
    assert.equal(calls.at(-1).handler, 'recordAccountSecurity');
    status = 'unexpected';
    await assert.rejects(module.exports.recordFirstWebLogin(), /Invalid welcome/);
    await assert.rejects(module.exports.recordWebAccountSecurity(), /Invalid security/);
    failure = new Error('functions/unavailable');
    await assert.rejects(module.exports.recordFirstWebLogin(), /functions\/unavailable/);
});

test('verified token refresh observes account events and unsubscribe route remains authenticated and default off', () => {
    const app = fs.readFileSync(require.resolve('../web-app/pages/_app.tsx'), 'utf8');
    assert.match(app, /onIdTokenChanged\(auth/);
    assert.match(app, /if \(!user\?\.emailVerified\) return/);
    assert.match(app, /recordFirstWebLogin\(\)\.catch/);
    assert.match(app, /recordWebAccountSecurity\(\)\.catch/);
    const page = fs.readFileSync(require.resolve('../web-app/pages/consells-bar.tsx'), 'utf8');
    assert.match(page, /useState\(false\)/);
    assert.match(page, /if \(!user\?\.emailVerified\) return/);
    assert.match(page, /'getBarEmailTips'/);
    assert.match(page, /'setBarEmailTips'/);
    assert.match(page, /result\.data\.enabled !== value/);
    assert.match(page, /save\(false\)/);
});
