const { test } = require('node:test');
const assert = require('node:assert/strict');

test('owner registration persists in real local Auth/Firestore and survives sign-out and sign-in', {
  skip: !process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST,
}, async () => {
  for (const name of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) {
    assert.match(process.env[name], /^127\.0\.0\.1:\d+$/);
  }
  assert.match(process.env.GCLOUD_PROJECT, /^demo-/);
  const admin = require('firebase-admin');
  const { registerBar } = require('../lib/index');
  const { initializeApp, deleteApp } = require('firebase/app');
  const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } = require('firebase/auth');
  const { getFirestore, connectFirestoreEmulator, doc, getDocFromServer, setDoc } = require('firebase/firestore');
  const client = initializeApp({ apiKey: 'demo-only-api-key', projectId: process.env.GCLOUD_PROJECT }, 'beta-test');
  const auth = getAuth(client);
  connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
  const firestore = getFirestore(client);
  const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
  connectFirestoreEmulator(firestore, host, Number(port));
  const email = `owner-${Date.now()}@example.test`;
  const password = 'Local-test-password-123!';
  let uid, stranger, barId;
  const data = { businessName: 'Bar emulador', address: 'Carrer 1', city: 'Barcelona',
    postalCode: '08001', nif: 'B12345674', contactName: 'Propietari local', billing: 'quarterly', acceptTerms: true,
    location: { latitude: 41.38, longitude: 2.17 } };
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    uid = credential.user.uid;
    const context = verified => ({ auth: { uid, token: { email, email_verified: verified } }, data });
    await assert.rejects(registerBar.run(context(false)), error => error.code === 'failed-precondition');
    await assert.rejects(createUserWithEmailAndPassword(auth, email, password), error => error.code === 'auth/email-already-in-use');
    await admin.auth().updateUser(uid, { emailVerified: true });
    await credential.user.reload();
    assert.equal((await credential.user.getIdTokenResult(true)).claims.email_verified, true);
    const result = await registerBar.run(context(true));
    barId = result.barId;
    const token = await credential.user.getIdTokenResult(true);
    assert.equal(token.claims.role, 'bar_owner');
    const profile = await getDocFromServer(doc(firestore, 'users', uid));
    assert.equal(profile.data().role, 'bar_owner');
    assert.equal(profile.data().ownedBars[0], barId);
    const owner = await getDocFromServer(doc(firestore, 'barOwners', uid));
    assert.equal(owner.data().barId, barId);
    const bar = await admin.firestore().collection('bars').doc(barId).get();
    assert.equal(bar.data().ownerId, uid);
    assert.equal(bar.data().premium, false);
    assert.equal(bar.data().location.latitude, 41.38);
    assert.equal('nif' in bar.data(), false);
    assert.equal(owner.data().nif, 'B12345674');
    await signOut(auth);
    const login = await signInWithEmailAndPassword(auth, email, password);
    assert.equal(login.user.uid, uid);
    assert.equal((await getDocFromServer(doc(firestore, 'barOwners', uid))).data().barId, barId);
    assert.equal((await registerBar.run(context(true))).barId, barId);
    await signOut(auth);
    stranger = (await createUserWithEmailAndPassword(auth, `stranger-${Date.now()}@example.test`, password)).user.uid;
    await assert.rejects(getDocFromServer(doc(firestore, 'barOwners', uid)), error => error.code === 'permission-denied');
    await assert.rejects(setDoc(doc(firestore, 'users', stranger), { id: stranger, role: 'bar_owner', ownedBars: [barId] }),
      error => error.code === 'permission-denied');
  } finally {
    await signOut(auth);
    await deleteApp(client);
    const writes = [];
    if (uid) {
      writes.push(admin.auth().deleteUser(uid));
      writes.push(admin.firestore().collection('users').doc(uid).delete());
      writes.push(admin.firestore().collection('barOwners').doc(uid).delete());
    }
    if (barId) writes.push(admin.firestore().collection('bars').doc(barId).delete());
    if (stranger) writes.push(admin.auth().deleteUser(stranger));
    await Promise.all(writes);
    await admin.app().delete();
  }
});
