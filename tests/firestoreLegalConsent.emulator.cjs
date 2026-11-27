const { test } = require('node:test');
const fs = require('node:fs');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, getDoc, updateDoc, serverTimestamp, deleteField } = require('firebase/firestore');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const ts = require('typescript');

const legalPath = require.resolve('../app/src/data/legalContent.ts');
const legalModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(legalPath, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, { module: legalModule, exports: legalModule.exports, require: createRequire(legalPath) });
const { LEGAL_VERSIONS } = legalModule.exports;

test('legal acceptance rules validate identity, current versions, explicit reading and server time', { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
    const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
    const env = await initializeTestEnvironment({
        projectId: 'demo-trobar-legal',
        firestore: { host, port: Number(port), rules: fs.readFileSync(process.env.LEGAL_RULES_PATH || require.resolve('../firebase/firestore/firestore.rules'), 'utf8') },
    });
    try {
        const alice = env.authenticatedContext('alice').firestore();
        const bob = env.authenticatedContext('bob').firestore();
        const guest = env.unauthenticatedContext().firestore();
        const acceptance = (privacyVersion = LEGAL_VERSIONS.privacy) => ({ termsVersion: LEGAL_VERSIONS.terms, privacyVersion, termsRead: true, privacyRead: true, acceptedAt: serverTimestamp(), platform: 'ios' });
        const own = doc(alice, 'users', 'alice');
        await assertFails(setDoc(doc(guest, 'users', 'alice'), { legalAcceptance: acceptance() }));
        await assertFails(setDoc(doc(bob, 'users', 'alice'), { legalAcceptance: acceptance() }));
        for (const invalid of [
            { termsVersion: 'old' }, { privacyVersion: 'old' }, { privacyVersion: '2099-01-01' }, { acceptedAt: new Date('2026-01-01') },
            { termsRead: false }, { privacyRead: false }, { platform: 'unknown' }, { extra: 'unexpected' },
        ]) await assertFails(setDoc(own, { legalAcceptance: { ...acceptance(), ...invalid } }));
        await assertSucceeds(setDoc(own, { name: 'Alice', legalAcceptance: acceptance() }));
        assert.equal((await getDoc(own)).data().legalAcceptance.termsRead, true);
        await assertSucceeds(updateDoc(own, { name: 'Alice updated' }));
        await assertFails(updateDoc(own, { legalAcceptance: deleteField() }));
        await assertFails(updateDoc(own, { 'legalAcceptance.termsRead': false }));
        await assertFails(updateDoc(own, { 'legalAcceptance.acceptedAt': new Date('2026-01-01') }));
        await assertSucceeds(updateDoc(own, { legalAcceptance: acceptance() }));
        const legacy = doc(env.authenticatedContext('legacy').firestore(), 'users', 'legacy');
        await assertSucceeds(setDoc(legacy, { legalAcceptance: acceptance('2026-11-10') }));
        await assertSucceeds(updateDoc(legacy, { legalAcceptance: acceptance() }));
        assert.equal((await getDoc(legacy)).data().legalAcceptance.privacyVersion, LEGAL_VERSIONS.privacy);
        await env.withSecurityRulesDisabled(async context => {
            await setDoc(doc(context.firestore(), 'users', 'owner'), { name: 'Owner', role: 'bar_owner', ownedBars: ['bar'] });
        });
        const owner = env.authenticatedContext('owner').firestore();
        await assertSucceeds(setDoc(doc(owner, 'users', 'owner'), { legalAcceptance: acceptance() }, { merge: true }));
        const profile = (await getDoc(doc(owner, 'users', 'owner'))).data();
        assert.equal(profile.role, 'bar_owner');
        assert.deepEqual(profile.ownedBars, ['bar']);
        await assertFails(updateDoc(doc(owner, 'users', 'owner'), { role: 'admin', legalAcceptance: acceptance() }));
        await assertFails(getDoc(doc(bob, 'users', 'alice')));
    } finally { await env.cleanup(); }
});
