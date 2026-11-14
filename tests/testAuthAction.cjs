const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const moduleStub = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../web-app/lib/authAction.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports: moduleStub.exports });
const { prepareAuthAction, authActionMessage } = moduleStub.exports;
const params = mode => new URLSearchParams({ mode, oobCode: 'inert-test-code', apiKey: 'ignored', continueUrl: 'https://untrusted.invalid' });

test('reset verifies the code and password policy, does not consume until submission and prevents duplicate writes', async () => {
    const calls = [];
    let release;
    const client = {
        verifyPasswordResetCode: async code => { calls.push(['verify', code]); return 'fixture@example.invalid'; },
        validatePassword: async password => password.length > 10,
        confirmPasswordReset: (code, password) => { calls.push(['confirm', code, password]); return new Promise(resolve => { release = resolve; }); },
    };
    const action = await prepareAuthAction(params('resetPassword'), client);
    assert.equal(action.kind, 'reset');
    assert.equal(action.email, 'fixture@example.invalid');
    assert.equal(calls.length, 1);
    await assert.rejects(action.complete('weak'), error => error.code === 'auth/password-does-not-meet-requirements');
    const first = action.complete('strong-test-password');
    let secondFinished = false;
    const second = action.complete('strong-test-password').then(() => { secondFinished = true; });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls.length, 2);
    assert.equal(secondFinished, false);
    release();
    await Promise.all([first, second]);
    await action.complete('strong-test-password');
    assert.equal(calls.length, 2);
});

test('email verification applies only the configured project action, invalid and unsupported links never invoke Firebase', async () => {
    let applications = 0;
    const client = { applyActionCode: async code => { assert.equal(code, 'inert-test-code'); applications++; } };
    assert.equal((await prepareAuthAction(params('verifyEmail'), client)).kind, 'verified');
    assert.equal(applications, 1);
    for (const invalid of ['', 'mode=resetPassword', 'mode=unknown&oobCode=fixture', 'mode=verifyEmail&mode=resetPassword&oobCode=fixture', 'mode=verifyEmail&oobCode=a&oobCode=b']) {
        await assert.rejects(prepareAuthAction(new URLSearchParams(invalid), client), error => error.code === 'auth/invalid-action-code');
    }
    assert.equal(applications, 1);
});

test('expired, network and unknown failures are safe and never expose tokens or backend details', async () => {
    const client = { verifyPasswordResetCode: async () => { throw { code: 'auth/expired-action-code', message: 'private-token' }; } };
    await assert.rejects(prepareAuthAction(params('resetPassword'), client), error => authActionMessage(error).includes('caducat'));
    for (const error of [new Error('private-token'), { code: 'auth/internal-error', message: 'private-token' }, 'HTTP 500 private-token']) {
        assert(!authActionMessage(error).includes('private-token'));
        assert(!authActionMessage(error).includes('HTTP'));
    }
    assert(authActionMessage({ code: 'auth/network-request-failed' }).includes('connexió'));
});
