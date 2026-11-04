const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

test('signup callables work over HTTP with local Auth, Firestore, refreshed claims and private NIF', {
  skip: !process.env.BAR_SIGNUP_FUNCTIONS_EMULATOR_HOST || !process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST,
}, async () => {
  for (const key of ['BAR_SIGNUP_FUNCTIONS_EMULATOR_HOST', 'FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) {
    assert.match(process.env[key], /^127\.0\.0\.1:\d+$/);
  }
  assert.match(process.env.GCLOUD_PROJECT, /^demo-/);
  const admin = require('firebase-admin');
  const { initializeApp, deleteApp } = require('firebase/app');
  const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } = require('firebase/auth');
  const { getFunctions, connectFunctionsEmulator, httpsCallable } = require('firebase/functions');
  const { getFirestore, connectFirestoreEmulator, doc, getDocFromServer } = require('firebase/firestore');
  const server = admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT }, 'signup-transport');
  const client = initializeApp({ apiKey: 'demo-only-api-key', projectId: process.env.GCLOUD_PROJECT }, 'signup-transport');
  const auth = getAuth(client);
  connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
  const firestore = getFirestore(client);
  const [dbHost, dbPort] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
  connectFirestoreEmulator(firestore, dbHost, Number(dbPort));
  const functions = getFunctions(client, 'europe-west1');
  const [functionHost, functionPort] = process.env.BAR_SIGNUP_FUNCTIONS_EMULATOR_HOST.split(':');
  connectFunctionsEmulator(functions, functionHost, Number(functionPort));
  const search = httpsCallable(functions, 'searchRegistrationLocations');
  const details = httpsCallable(functions, 'getRegistrationLocationDetails');
  const register = httpsCallable(functions, 'registerBar');
  const email = `transport-${Date.now()}@example.test`;
  const password = 'Local-transport-test-123!';
  const query = `bar transport fixture ${Date.now()}`;
  let uid, barId, stranger;
  try {
    await assert.rejects(search({ query }), error => error.code === 'functions/unauthenticated');
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    uid = user.uid;
    await assert.rejects(search({ query }), error => error.code === 'functions/failed-precondition');
    await server.auth().updateUser(uid, { emailVerified: true });
    await user.reload();
    await user.getIdToken(true);
    await assert.rejects(search({ query, sessionToken: 'invalid' }), error => error.code === 'functions/invalid-argument');
    await assert.rejects(details({ placeId: '../invalid', sessionToken: randomUUID() }),
      error => error.code === 'functions/invalid-argument');
    const data = { businessName: 'Bar transport', address: 'Carrer de prova 1', city: 'Barcelona',
      postalCode: '08001', nif: 'ES b-12345674', contactName: 'Propietari local',
      billing: 'quarterly', acceptTerms: true,
      googlePlaceId: 'ChIJlocal', location: { latitude: 41.38, longitude: 2.17 } };
    await assert.rejects(register({ ...data, nif: 'B12345678' }), error => error.code === 'functions/invalid-argument');
    const { data: result } = await register(data);
    barId = result.barId;
    assert.equal(result.ok, true);
    assert.equal((await user.getIdTokenResult(true)).claims.role, 'bar_owner');
    assert.equal((await getDocFromServer(doc(firestore, 'barOwners', uid))).data().nif, 'B12345674');
    assert.equal((await getDocFromServer(doc(firestore, 'users', uid))).data().ownedBars[0], barId);
    const bar = (await getDocFromServer(doc(firestore, 'bars', barId))).data();
    assert.equal(bar.location.latitude, 41.38);
    assert.equal(bar.googlePlaceId, 'ChIJlocal');
    assert.equal(bar.status, 'registered');
    assert.equal('nif' in bar, false);
    const { data: subscription } = await httpsCallable(functions, 'getSubscriptionStatus')({});
    assert.equal(subscription.active, false);
    await signOut(auth);
    await signInWithEmailAndPassword(auth, email, password);
    assert.equal((await register(data)).data.barId, barId);
    await signOut(auth);
    stranger = (await createUserWithEmailAndPassword(auth, `other-${Date.now()}@example.test`, password)).user.uid;
    await assert.rejects(getDocFromServer(doc(firestore, 'barOwners', uid)), error => error.code === 'permission-denied');
  } finally {
    await signOut(auth);
    await deleteApp(client);
    const cleanup = [];
    if (uid) cleanup.push(server.auth().deleteUser(uid), server.firestore().collection('users').doc(uid).delete(),
      server.firestore().collection('barOwners').doc(uid).delete());
    if (barId) cleanup.push(server.firestore().collection('bars').doc(barId).delete());
    if (stranger) cleanup.push(server.auth().deleteUser(stranger));
    await Promise.all(cleanup);
    await server.delete();
  }
});
