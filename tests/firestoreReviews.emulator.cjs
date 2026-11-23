const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, getDoc, getDocs, collection, updateDoc, deleteDoc, serverTimestamp, getAggregateFromServer, average, count } = require('firebase/firestore');

test('Firestore authorizes premium reviews and subscriptions without trusting client aggregates', {
    skip: !process.env.FIRESTORE_EMULATOR_HOST,
}, async t => {
    const [host, rawPort] = process.env.FIRESTORE_EMULATOR_HOST.split(':');
    const env = await initializeTestEnvironment({
        projectId: 'demo-trobar-reviews',
        firestore: {
            host, port: Number(rawPort),
            rules: fs.readFileSync(path.join(__dirname, '../firebase/firestore/firestore.rules'), 'utf8'),
        },
    });
    try {
        await env.withSecurityRulesDisabled(async context => {
            const db = context.firestore();
            await setDoc(doc(db, 'bars', 'premium'), { tier: 'premium', ownerId: 'owner' });
            await setDoc(doc(db, 'bars', 'free'), { tier: 'free', ownerId: 'owner' });
            await setDoc(doc(db, 'bars', 'premium', 'reviews', 'legacy-random-id'), {
                userId: 'legacy', userName: 'Legacy', rating: 4, comment: 'Original review', createdAt: new Date('2026-01-01'),
            });
            await setDoc(doc(db, 'bars', 'premium', 'reviewStats', 'aggregate'), { averageRating: 1, totalReviews: 99 });
            await setDoc(doc(db, 'matches', 'next'), { timestamp: new Date('2027-01-01'), status: 'scheduled' });
            await setDoc(doc(db, 'competitions', 'league'), { name: 'League' });
            await setDoc(doc(db, 'teams', 'team'), { name: 'Team' });
            await setDoc(doc(db, 'barOwners', 'owner'), { barId: 'premium', stripeCustomerId: 'server-managed' });
            await setDoc(doc(db, 'users', 'owner'), { name: 'Owner', role: 'bar_owner', ownedBars: ['premium'] });
            await setDoc(doc(db, 'notificationJobs', 'job'), { private: true });
            await setDoc(doc(db, 'system', 'sync'), { private: true });
            await setDoc(doc(db, 'contactMessages', 'private-message'), { userId: 'alice', message: 'Private support request' });
            await setDoc(doc(db, 'contactRateLimits', 'alice'), { lastSentAt: 1 });
        });
        const guest = env.unauthenticatedContext().firestore();
        const alice = env.authenticatedContext('alice').firestore();
        const owner = env.authenticatedContext('owner').firestore();
        const legacy = env.authenticatedContext('legacy').firestore();
        const admin = env.authenticatedContext('admin', { role: 'admin' }).firestore();
        const review = (userId, extra = {}) => ({ userId, userName: 'Visitor', rating: 5, createdAt: serverTimestamp(), ...extra });
        await t.test('support inbox and rate limits cannot be read or written directly by clients', async () => {
            for (const client of [guest, alice, owner]) {
                await assertFails(getDoc(doc(client, 'contactMessages', 'private-message')));
                await assertFails(getDocs(collection(client, 'contactMessages')));
                await assertFails(setDoc(doc(client, 'contactMessages', 'injected'), { message: 'Bypass callable' }));
                await assertFails(getDoc(doc(client, 'contactRateLimits', 'alice')));
                await assertFails(setDoc(doc(client, 'contactRateLimits', 'alice'), { lastSentAt: 0 }));
            }
            await assertSucceeds(getDoc(doc(admin, 'contactMessages', 'private-message')));
        });
        await t.test('public reads work but only a signed-in non-owner can create a valid review', async () => {
            await assertSucceeds(getDocs(collection(guest, 'bars', 'premium', 'reviews')));
            await assertFails(setDoc(doc(guest, 'bars', 'premium', 'reviews', 'anonymous'), review('anonymous')));
            await assertFails(setDoc(doc(owner, 'bars', 'premium', 'reviews', 'owner'), review('owner')));
            await assertFails(setDoc(doc(alice, 'bars', 'free', 'reviews', 'alice'), review('alice')));
            await assertFails(setDoc(doc(alice, 'bars', 'premium', 'reviews', 'alice'), review('alice', { rating: 6 })));
            await assertFails(setDoc(doc(alice, 'bars', 'premium', 'reviews', 'alice'), review('alice', { rating: 3.5 })));
            await assertFails(setDoc(doc(alice, 'bars', 'premium', 'reviews', 'alice'), review('alice', { comment: 'x'.repeat(2001) })));
            await assertFails(setDoc(doc(alice, 'bars', 'premium', 'reviews', 'other'), review('alice')));
            await assertSucceeds(setDoc(doc(alice, 'bars', 'premium', 'reviews', 'alice'), review('alice', { comment: 'Good matchday' })));
            await assertFails(setDoc(doc(alice, 'bars', 'premium', 'reviews', 'alice'), review('alice', { rating: 2 })));
        });
        await t.test('old IDs remain readable/editable by their author, never by someone else', async () => {
            const old = doc(legacy, 'bars', 'premium', 'reviews', 'legacy-random-id');
            await assertSucceeds(updateDoc(old, { rating: 3, comment: 'Updated legacy review', updatedAt: serverTimestamp() }));
            await assertFails(updateDoc(doc(alice, 'bars', 'premium', 'reviews', 'legacy-random-id'), { rating: 1, updatedAt: serverTimestamp() }));
            await assertFails(deleteDoc(doc(alice, 'bars', 'premium', 'reviews', 'legacy-random-id')));
            assert.equal((await getDoc(old)).data().userId, 'legacy');
        });
        await t.test('server aggregates reflect reviews; saved aggregate documents are not overwritten', async () => {
            const aggregate = await assertSucceeds(getAggregateFromServer(collection(guest, 'bars', 'premium', 'reviews'), { avg: average('rating'), total: count() }));
            assert.equal(aggregate.data().total, 2);
            assert.equal(aggregate.data().avg, 4);
            await assertFails(setDoc(doc(alice, 'bars', 'premium', 'reviewStats', 'aggregate'), { averageRating: 5, totalReviews: 1000 }));
            assert.equal((await getDoc(doc(guest, 'bars', 'premium', 'reviewStats', 'aggregate'))).data().totalReviews, 99);
            await assertSucceeds(deleteDoc(doc(alice, 'bars', 'premium', 'reviews', 'alice')));
        });
        await t.test('following is private to the signed-in user and targets a premium bar', async () => {
            const data = { barId: 'premium', subscribedAt: serverTimestamp(), notifications: true };
            const own = doc(alice, 'users', 'alice', 'barSubscriptions', 'premium');
            await assertSucceeds(setDoc(own, data));
            await assertSucceeds(getDoc(own));
            await assertFails(getDoc(doc(owner, 'users', 'alice', 'barSubscriptions', 'premium')));
            await assertFails(setDoc(doc(alice, 'users', 'other', 'barSubscriptions', 'premium'), data));
            await assertFails(setDoc(doc(alice, 'users', 'alice', 'barSubscriptions', 'free'), { ...data, barId: 'free' }));
            await assertSucceeds(deleteDoc(own));
        });
        await t.test('public match, competition, team and bar queries survive without opening writes', async () => {
            for (const name of ['matches', 'competitions', 'teams', 'bars']) {
                await assertSucceeds(getDocs(collection(guest, name)));
                await assertFails(setDoc(doc(guest, name, 'injected'), { name: 'Injected' }));
                await assertFails(setDoc(doc(owner, name, 'injected'), { name: 'Injected' }));
            }
            await assertSucceeds(setDoc(doc(admin, 'matches', 'admin-only'), { status: 'scheduled' }));
            await assertFails(getDoc(doc(alice, 'notificationJobs', 'job')));
            await assertFails(getDoc(doc(guest, 'system', 'sync')));
        });
        await t.test('owner dashboard edits, galleries, broadcasting and posts work only for the true owner', async () => {
            const ref = doc(owner, 'bars', 'premium');
            await assertSucceeds(updateDoc(ref, {
                description: 'Owner description', promotionalText: 'Matchday offer', socialMedia: { instagram: 'owner' },
                amenities: ['wifi'], gallery: ['https://example.test/cover.jpg'], broadcastingMatches: ['next'], updatedAt: serverTimestamp(),
            }));
            await assertSucceeds(updateDoc(ref, { amenities: ['wifi', 'projector'] }));
            await assertSucceeds(updateDoc(ref, { showGoogleRating: true, updatedAt: serverTimestamp() }));
            assert.equal((await getDoc(doc(guest, 'bars', 'premium'))).data().showGoogleRating, true);
            await assertSucceeds(updateDoc(ref, { showGoogleRating: false, updatedAt: serverTimestamp() }));
            await assertFails(updateDoc(ref, { showGoogleRating: 'yes' }));
            await assertFails(updateDoc(doc(alice, 'bars', 'premium'), { showGoogleRating: true }));
            await assertFails(updateDoc(doc(guest, 'bars', 'premium'), { showGoogleRating: true }));
            await assertFails(updateDoc(doc(alice, 'bars', 'premium'), { description: 'Unrelated visitor' }));
            await assertFails(updateDoc(ref, { tier: 'free' }));
            await assertFails(updateDoc(ref, { ownerId: 'alice' }));
            await assertSucceeds(updateDoc(ref, { googlePlaceId: 'place', openingPeriods: [], placesEnrichedAt: serverTimestamp() }));
            await assertFails(updateDoc(doc(guest, 'bars', 'premium'), { googlePlaceId: 'injected' }));
            const post = { type: 'news', title: 'Matchday', body: 'Doors open', expiresAt: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
            const postRef = doc(owner, 'bars', 'premium', 'posts', 'post');
            await assertSucceeds(setDoc(postRef, post));
            await assertSucceeds(getDocs(collection(guest, 'bars', 'premium', 'posts')));
            await assertFails(setDoc(doc(alice, 'bars', 'premium', 'posts', 'other'), post));
            await assertSucceeds(deleteDoc(postRef));
        });
        await t.test('only Premium owners can publish safe booking links and full capacity for their broadcast matches', async () => {
            const ref = doc(owner, 'bars', 'premium');
            await assertSucceeds(updateDoc(ref, {
                reservationUrl: 'https://bar.example/reservar?partit=next',
                fullMatchIds: ['next'], broadcastingMatches: ['next'], updatedAt: serverTimestamp(),
            }));
            const publicBar = (await assertSucceeds(getDoc(doc(guest, 'bars', 'premium')))).data();
            assert.deepEqual(publicBar.fullMatchIds, ['next']);
            assert.equal(publicBar.reservationUrl, 'https://bar.example/reservar?partit=next');
            for (const client of [guest, alice]) {
                await assertFails(updateDoc(doc(client, 'bars', 'premium'), { fullMatchIds: [] }));
                await assertFails(updateDoc(doc(client, 'bars', 'premium'), { reservationUrl: 'https://attacker.example/' }));
            }
            for (const url of ['javascript:alert(1)', 'http://bar.example/', 'https://user:pass@bar.example/', 'https://', 'https://bar.example/' + 'x'.repeat(2048)]) {
                await assertFails(updateDoc(ref, { reservationUrl: url }));
            }
            await assertFails(updateDoc(ref, { fullMatchIds: 'next' }));
            await assertFails(updateDoc(ref, { fullMatchIds: ['not-broadcast'] }));
            await assertFails(updateDoc(ref, { broadcastingMatches: [] }));
            await assertFails(updateDoc(ref, { fullMatchIds: Array(101).fill('next') }));
            await assertFails(updateDoc(doc(owner, 'bars', 'free'), { reservationUrl: 'https://bar.example/' }));
            await assertFails(updateDoc(doc(owner, 'bars', 'free'), { fullMatchIds: ['next'], broadcastingMatches: ['next'] }));
            await assertSucceeds(updateDoc(ref, { fullMatchIds: [], reservationUrl: '', broadcastingMatches: [] }));
            await assertSucceeds(updateDoc(doc(owner, 'bars', 'free'), { fullMatchIds: [], reservationUrl: '' }));
        });
        await t.test('anonymous and signed-in OSM reports stay restricted to inactive reports', async () => {
            const report = {
                name: 'Reported bar', location: { latitude: 41, longitude: 2 }, address: '', amenities: ['wifi'],
                source: 'user_reported', createdAt: serverTimestamp(), isActive: false, isOpen: true,
                rating: 0, usuallyShowsBarca: true, broadcastingMatches: [],
            };
            await assertSucceeds(setDoc(doc(guest, 'bars', 'osm_123'), report));
            await assertSucceeds(setDoc(doc(guest, 'bars', 'osm_node_123'), report));
            await assertSucceeds(setDoc(doc(guest, 'bars', 'osm_way_123'), report));
            await assertSucceeds(setDoc(doc(guest, 'bars', 'google_ChIJdemo'), { ...report, googlePlaceId: 'ChIJdemo' }));
            await assertFails(setDoc(doc(guest, 'bars', 'google_ChIJother'), { ...report, googlePlaceId: 'ChIJdemo' }));
            await assertFails(setDoc(doc(guest, 'bars', 'google_missing'), report));
            await assertSucceeds(setDoc(doc(alice, 'bars', 'osm_124'), { ...report, reportedBy: 'alice' }));
            await assertFails(setDoc(doc(alice, 'bars', 'osm_125'), { ...report, reportedBy: 'other' }));
            await assertFails(setDoc(doc(guest, 'bars', 'osm_126'), { ...report, isActive: true }));
            await assertFails(setDoc(doc(guest, 'bars', 'osm_127'), { ...report, ownerId: 'alice' }));
            await assertSucceeds(updateDoc(doc(guest, 'bars', 'premium'), { usuallyShowsBarca: true }));
            await assertSucceeds(updateDoc(doc(alice, 'bars', 'osm_123'), { usuallyShowsBarca: true }));
            await assertFails(deleteDoc(doc(alice, 'bars', 'osm_123')));
        });
        await t.test('profiles and preferences remain editable without allowing roles or ownership to be self-assigned', async () => {
            const own = doc(alice, 'users', 'alice');
            await assertFails(setDoc(own, { name: 'Alice', role: 'admin' }));
            await assertSucceeds(setDoc(own, { name: 'Alice', surname: 'Visitor', role: 'user' }));
            await assertSucceeds(updateDoc(own, { name: 'Anna', avatar: 'https://example.test/avatar.jpg', preferences: { display: { searchRadius: 1000 } } }));
            await assertSucceeds(getDoc(own));
            await assertFails(getDoc(doc(guest, 'users', 'alice')));
            await assertFails(getDoc(doc(owner, 'users', 'alice')));
            await assertFails(updateDoc(own, { role: 'bar_owner', ownedBars: ['premium'] }));
            await assertSucceeds(getDoc(doc(owner, 'barOwners', 'owner')));
            await assertFails(setDoc(doc(owner, 'barOwners', 'owner'), { barId: 'free' }));
            await assertFails(getDoc(doc(alice, 'barOwners', 'owner')));
        });
        await t.test('push devices and private area consent remain scoped to their authenticated user', async () => {
            const device = doc(alice, 'users', 'alice', 'pushDevices', 'device');
            await assertSucceeds(setDoc(device, { token: 'ExponentPushToken[test_123]', platform: 'ios', updatedAt: serverTimestamp() }));
            await assertSucceeds(getDocs(collection(alice, 'users', 'alice', 'pushDevices')));
            await assertFails(getDoc(doc(owner, 'users', 'alice', 'pushDevices', 'device')));
            const area = doc(alice, 'users', 'alice', 'notificationPrivate', 'area');
            await assertSucceeds(setDoc(area, { latitude: 41, longitude: 2, consent: 'foreground', updatedAt: serverTimestamp() }));
            await assertSucceeds(getDoc(area));
            await assertFails(getDoc(doc(owner, 'users', 'alice', 'notificationPrivate', 'area')));
            await assertSucceeds(deleteDoc(area));
            await assertSucceeds(deleteDoc(device));
        });
    } finally { await env.cleanup(); }
});
