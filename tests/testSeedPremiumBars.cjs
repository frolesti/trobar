const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { buildFixtures, decode, encode, planWrites, FIXTURE_IDS, FIXTURE_SET } = require('../scripts/seedPremiumBars');

const matches = [
    { id: 'men', category: 'masculino', timestamp: '2070-01-02T20:00:00Z', timeConfirmed: true },
    { id: 'women', category: 'femenino', timestamp: '2070-01-01T18:00:00Z', timeConfirmed: true },
    { id: 'men-2', category: 'masculino', timestamp: '2070-01-04T20:00:00Z', timeConfirmed: true },
    { id: 'women-2', category: 'femenino', timestamp: '2070-01-03T18:00:00Z', timeConfirmed: true },
];

test('Terrassa fixtures use real future matches, valid filter keys and explicit test identities', () => {
    const bars = buildFixtures(matches, 'test-owner');
    assert.equal(bars.length, 3);
    assert.deepEqual(bars.map(bar => bar.id), FIXTURE_IDS);
    assert.deepEqual(bars.map(bar => bar.broadcastingMatches), [['men', 'women'], ['men-2'], ['women-2']]);
    for (const bar of bars) {
        assert.equal(bar.ownerId, 'test-owner');
        assert.equal(bar.isTestData, true);
        assert.equal(bar.testFixtureSet, FIXTURE_SET);
        assert.equal(bar.tier, 'premium');
        assert.match(bar.name, /^PROVA/);
        assert(bar.latitude > 41.55 && bar.latitude < 41.58);
        assert(bar.longitude > 2 && bar.longitude < 2.03);
        assert.equal(bar.googlePlaceId, undefined);
        assert.equal(bar.stripeSubscriptionId, undefined);
    }
    assert(bars[0].amenities.includes('projector'));
    assert(bars[0].amenities.includes('multiple_screens'));
    assert(bars[1].amenities.includes('outdoor_seating'));
    assert(bars[2].amenities.includes('accessible'));
});

test('seed rejects incomplete match coverage instead of inventing broadcasts', () => {
    for (const invalid of [[], [matches[0]], matches.map(match => ({ ...match, timeConfirmed: false })), matches.map(match => ({ ...match, duplicateOf: 'original' })), matches.map(match => ({ ...match, status: 'finished' }))]) {
        assert.throws(() => buildFixtures(invalid, 'test-owner'), /Calen partits futurs/);
    }
    assert.deepEqual(decode({ arrayValue: { values: [{ stringValue: 'wifi' }, { booleanValue: false }] } }), ['wifi', false]);
});

test('atomic seed plan cannot overwrite existing bars or unrelated profile fields', () => {
    const root = 'projects/test/databases/(default)/documents';
    const bars = buildFixtures(matches, 'test-owner');
    const profile = { name: `${root}/users/test-owner`, updateTime: 'version-before-read' };
    assert.throws(() => planWrites(`https://firestore.googleapis.com/v1/${root}`, bars, [], profile, null, 'owner@example.com'), /no una URL/);
    const writes = planWrites(root, bars, [], profile, null, 'owner@example.com');
    assert.equal(writes.length, 5);
    for (const write of writes.slice(0, 3)) assert.deepEqual(write.currentDocument, { exists: false });
    assert.deepEqual(writes[3].currentDocument, { updateTime: 'version-before-read' });
    assert.deepEqual(writes[3].updateMask.fieldPaths, ['role', 'ownedBars', 'testBarFixtureSet']);
    assert.equal(writes[3].update.fields.preferences, undefined);
    assert.equal(writes[4].update.fields.stripeSubscriptionId, undefined);
    assert.equal(planWrites(root, bars, FIXTURE_IDS, profile, { exists: true }, 'owner@example.com').length, 1);
    const newProfile = planWrites(root, bars, [], null, null, 'owner@example.com')[3];
    assert.deepEqual(newProfile.currentDocument, { exists: false });
    assert.equal(newProfile.update.name, `${root}/users/test-owner`);
    assert.equal(newProfile.update.fields.name, undefined);
    assert.deepEqual(decode(encode({ status: false, amenities: ['wifi'], rating: 0 })), { status: false, amenities: ['wifi'], rating: 0 });
});

test('test owner loads the editable fixture without contacting Stripe or Google Places', async () => {
    const source = fs.readFileSync(require.resolve('../app/src/screens/BarDashboard/BarDashboardScreen.tsx'), 'utf8');
    const parsed = ts.createSourceFile('BarDashboardScreen.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let effect;
    const visit = node => {
        if (ts.isCallExpression(node) && node.expression.getText(parsed) === 'useEffect' && node.arguments[0]?.getText(parsed).includes('const ownedBar')) effect = node.arguments[0].getText(parsed);
        ts.forEachChild(node, visit);
    };
    visit(parsed);
    let loaded;
    const context = {
        user: { id: 'test-owner' }, Date, Set, console,
        getOwnedBar: async () => buildFixtures(matches, 'test-owner')[0],
        getSubscriptionStatus: () => { throw new Error('Stripe must not be called'); },
        fetchBarPlaceDetails: () => { throw new Error('Google Places must not be called'); },
        getBarReviewStats: async () => ({}), getUserPreferences: async () => ({}),
        getNotificationPermissionStatus: () => 'default', fetchAllMatches: async () => ({ matches: [] }),
        AMENITY_OPTIONS: [{ key: 'projector' }],
        setBar: bar => { loaded = bar; },
    };
    for (const name of ['Loading', 'Description', 'PromotionalText', 'Socials', 'SelectedAmenities', 'BroadcastingIds', 'LoadingPlaceDetails', 'PlaceDetails', 'ReviewStats', 'NotifPrefs', 'SubscriptionActive', 'BillingCycle', 'NotifPermission', 'UpcomingMatches']) context[`set${name}`] = () => {};
    vm.runInNewContext(ts.transpileModule(`(${effect})();`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(loaded?.isTestData, true);
    assert.equal(loaded?.name, 'PROVA - Pantalles Terrassa');
    assert.match(source, /currentTier === 'premium' && !bar\?\.isTestData/);
});