const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

test('contact service requires the matching backend receipt, never success-shaped fallbacks', async () => {
    let reply = { data: { id: 'request' } }, failure = null;
    const calls = [];
    const moduleStub = { exports: {} };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../app/src/services/contactService.ts'), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText, { module: moduleStub, exports: moduleStub.exports, require(name) {
        if (name === 'firebase/functions') return { httpsCallable: (_functions, method) => async payload => {
            calls.push({ method, payload });
            if (failure) throw failure;
            return reply;
        } };
        if (name.includes('config/firebase')) return { functions: {} };
        throw new Error(name);
    } });
    const payload = { requestId: 'request' };
    assert.equal(await moduleStub.exports.submitContact(payload), 'request');
    assert.equal(calls[0].method, 'submitContact');
    reply = { data: { id: 'wrong' } };
    await assert.rejects(moduleStub.exports.submitContact(payload), /confirmar/);
    failure = new Error('unavailable');
    await assert.rejects(moduleStub.exports.submitContact(payload), /unavailable/);
});
