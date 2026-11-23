const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

function load(relative, requireMock = name => { throw new Error(`Unexpected dependency: ${name}`); }, environment = {}) {
    const module = { exports: {} };
    const source = fs.readFileSync(path.join(__dirname, '..', ...relative.split('/')), 'utf8');
    vm.runInNewContext(ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
    }).outputText, { module, exports: module.exports, require: requireMock, console, Date, process: { env: environment } });
    return module.exports;
}

const demo = load('app/src/data/premiumDemoProfiles.ts');
const ids = ['test-terrassa-pantalles', 'test-terrassa-terrassa', 'test-terrassa-accessible'];
const fixture = (id = ids[0]) => ({
    id, isTestData: true, tier: 'premium', name: 'PROVA', address: 'Old fixture',
    latitude: 41.56, longitude: 2.01, ownerId: 'owner', source: 'verified',
    broadcastingMatches: ['actual-match'], usuallyShowsBarca: false,
    rating: 0, image: 'old-photo', amenities: ['wifi'], tags: [], isOpen: true,
});
const plain = value => JSON.parse(JSON.stringify(value));

test('demo enrichment requires a known ID, strict test flag and premium tier; never a name match', () => {
    for (const bar of [
        { ...fixture(), isTestData: false }, { ...fixture(), isTestData: 'true' },
        { ...fixture(), isTestData: undefined }, { ...fixture(), tier: 'free' },
        { ...fixture(), tier: undefined }, { ...fixture(), id: 'real', name: 'La Grada del Vapor · Demo' },
        { ...fixture(), id: 'el-classic' }, { ...fixture(), id: '__proto__' },
    ]) {
        assert.equal(demo.isPremiumDemoBar(bar), false);
        assert.equal(demo.enrichPremiumDemoBar(bar), bar);
        assert.equal(demo.getPremiumDemoReviews(bar), null);
        assert.equal(demo.getPremiumDemoReviewStats(bar), null);
        assert.equal(demo.getPremiumDemoHours(bar), null);
    }
    assert.equal(demo.isPremiumDemoBar(null), false);
    assert.equal(demo.isPremiumDemoBar(undefined), false);
});

test('all three identities have deterministic local content, sensible hours and honest review stats', () => {
    const names = new Set();
    const addresses = new Set();
    const galleries = new Set();
    for (const id of ids) {
        const original = fixture(id);
        const snapshot = plain(original);
        const enriched = demo.enrichPremiumDemoBar(original);
        assert.deepEqual(plain(original), snapshot, 'no input mutation');
        for (const key of ['id', 'latitude', 'longitude', 'ownerId', 'tier', 'source', 'broadcastingMatches', 'usuallyShowsBarca']) {
            assert.deepEqual(enriched[key], original[key], key);
        }
        assert.deepEqual(enriched, demo.enrichPremiumDemoBar(original));
        names.add(enriched.name);
        addresses.add(enriched.address);
        galleries.add(enriched.gallery.join('|'));
        assert.doesNotMatch(enriched.name, /demo|prova/i);
        assert.doesNotMatch(enriched.address, /fictici|fictícia/);
        assert.match(enriched.promotionalText, /€/);
        assert(enriched.description.length > 120);
        assert(enriched.amenities.length >= 5);
        assert.equal(enriched.gallery.length, 2);
        assert.equal(enriched.image, enriched.gallery[0]);
        assert.doesNotMatch(enriched.socialMedia.instagram, /@|_demo$/);
        assert.match(new URL(enriched.socialMedia.website).hostname, /\.example$/);
        assert(demo.getPremiumDemoHours(original).length);
        for (const period of enriched.openingPeriods) {
            assert(period.openDay >= 0 && period.openDay <= 6);
            assert(period.closeDay >= 0 && period.closeDay <= 6);
            assert(period.openHour >= 0 && period.openHour < 24);
            assert(period.closeHour >= 0 && period.closeHour < 24);
            assert.equal(period.closeDay, period.closeHour < period.openHour ? (period.openDay + 1) % 7 : period.openDay);
        }
        const reviews = demo.getPremiumDemoReviews(original);
        assert.deepEqual(reviews, demo.getPremiumDemoReviews(original));
        assert.equal(reviews.length, 3);
        for (const review of reviews) {
            assert.equal(review.barId, id);
            assert.match(review.id, /^demo-review-/);
            assert.match(review.userId, /^fictional-demo-/);
            assert.doesNotMatch(review.userName, /demo/i);
            assert.equal(review.userAvatar, undefined);
            assert(review.createdAt instanceof Date && Number.isFinite(review.createdAt.getTime()));
            assert(review.rating >= 1 && review.rating <= 5 && review.comment.length > 30);
        }
        const stats = demo.getPremiumDemoReviewStats(original);
        assert.equal(stats.totalReviews, reviews.length);
        assert.equal(stats.averageRating, reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length);
        assert.equal(enriched.rating, stats.averageRating);
        enriched.amenities.push('darts');
        enriched.gallery.pop();
        enriched.openingPeriods[0].openHour = 0;
        reviews[0].rating = 1;
        assert.deepEqual(demo.enrichPremiumDemoBar(original), demo.enrichPremiumDemoBar(fixture(id)));
    }
    assert.equal(names.size, 3);
    assert.equal(addresses.size, 3);
    assert.equal(galleries.size, 3);
    assert.match(demo.PREMIUM_DEMO_NOTICE, /ressenyes ficticis/);
});

test('Firestore reads enrich existing fixtures without performing any writes', async () => {
    const real = { ...fixture('real'), isTestData: false, name: 'Real business', description: 'Real description' };
    const docs = [fixture(), real];
    const service = load('app/src/services/barService.ts', name => {
        if (name.includes('premiumDemoProfiles')) return demo;
        if (name === 'firebase/firestore') return {
            collection: () => 'bars', doc: (_db, _collection, id) => id,
            getDocs: async () => ({ forEach: callback => docs.forEach(data => callback({ id: data.id, data: () => data })) }),
            getDoc: async id => ({ id, exists: () => true, data: () => docs.find(data => data.id === id) }),
            setDoc: () => assert.fail('must not write'), updateDoc: () => assert.fail('must not write'),
        };
        if (name.includes('api/core')) return { executeRequest: async operation => ({ success: true, data: await operation() }) };
        if (name.includes('barNavigation')) return { getBarCoordinates: data => ({ latitude: data.latitude, longitude: data.longitude }) };
        return {};
    });
    const bars = await service.fetchBars();
    assert.equal(bars[0].name, demo.enrichPremiumDemoBar(docs[0]).name);
    assert.equal(bars[1].name, real.name);
    assert.equal(bars[1].description, real.description);
    assert.equal(bars[1].rating, real.rating);
    assert.equal((await service.fetchBarById(ids[0])).gallery.length, 2);
    assert.equal(docs[0].name, 'PROVA');
});

const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : node?.props ? [node, ...nodes(node.props.children)] : [];
const text = node => Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : typeof node === 'string' ? node : '';

function modalHarness({ user = { id: 'visitor', name: 'Visitor' }, fetchReviews, getBarReviewStats, demoModule = demo, allMatches = [] } = {}) {
    const states = [], refs = [], effects = [], dependencies = [];
    let stateIndex, refIndex, effectIndex;
    const calls = { external: [], alerts: [], fetches: [], stats: [], subscriptions: [], writes: [] };
    const hooks = {
        ...React,
        useState(initial) {
            const index = stateIndex++;
            if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
            return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
        },
        useRef(initial) { const index = refIndex++; return refs[index] || (refs[index] = { current: initial }); },
        useCallback: callback => callback,
        useEffect(effect, deps) {
            const index = effectIndex++;
            if (!dependencies[index] || deps.some((value, i) => value !== dependencies[index][i])) {
                dependencies[index] = deps;
                effects.push(effect);
            }
        },
    };
    const native = Object.fromEntries(['View', 'TouchableOpacity', 'Image', 'ScrollView', 'Modal', 'TextInput'].map(name => [name, name]));
    Object.assign(native, {
        Linking: { openURL: url => calls.external.push(url) },
        Platform: { OS: 'web', select: options => options.web },
        useWindowDimensions: () => ({ height: 844, width: 390 }),
        Animated: { View: 'AnimatedView', Value: class {}, spring: () => ({ start() {} }), timing: () => ({ start() {} }) },
    });
    const component = load('app/src/components/BarProfileModal.tsx', name => {
        if (name === 'react') return hooks;
        if (name === 'react-native') return native;
        if (name === 'react-native-safe-area-context') return { useSafeAreaInsets: () => ({ top: 0, bottom: 34 }) };
        if (name.includes('premiumDemoProfiles')) return demoModule;
        if (name.endsWith('AppText') || name.endsWith('AppIcon') || name.endsWith('MatchCard')) return { __esModule: true, default: name.split('/').pop() };
        if (name.endsWith('GoogleRatingSection')) return { __esModule: true, default: 'GoogleRatingSection' };
        if (name.endsWith('UserNotice')) return { __esModule: true, default: 'UserNotice' };
        if (name.endsWith('VenuePhotoGallery')) return { __esModule: true, default: 'VenuePhotoGallery' };
        if (name.endsWith('BarReservationAction')) return { __esModule: true, default: 'BarReservationAction' };
        if (name.includes('premiumDemoReviewService')) return {
            fetchDemoUserReviews: async () => [],
            addDemoUserReview: async (...args) => { calls.writes.push(['addDemoUserReview', ...args]); },
            deleteDemoUserReview: async (...args) => { calls.writes.push(['deleteDemoUserReview', ...args]); },
        };
        if (name.includes('editorialTheme')) return { EDITORIAL: {} };
        if (name.includes('sketchTheme')) return { sketchShadow: () => ({}) };
        if (name.includes('AuthContext')) return { useAuth: () => ({ user }) };
        if (name.includes('placesService')) return { isOpenNow: () => true };
        if (name.includes('amenities')) return { AMENITY_OPTIONS: [], AMENITY_MAP: new Map(), AMENITY_CATEGORIES: [] };
        if (name.includes('AlertBanner')) return { showAlert: value => calls.alerts.push(value) };
        if (name.includes('reviewService')) return {
            fetchReviews: id => { calls.fetches.push(id); return fetchReviews ? fetchReviews(id) : Promise.resolve([]); },
            getBarReviewStats: id => { calls.stats.push(id); return getBarReviewStats ? getBarReviewStats(id) : Promise.resolve({ averageRating: 0, totalReviews: 0 }); },
            addReview: (...args) => { calls.writes.push(['addReview', ...args]); return Promise.resolve(); },
            deleteReview: (...args) => { calls.writes.push(['deleteReview', ...args]); return Promise.resolve(); },
            getUserReview: async () => null,
        };
        if (name.includes('barOwnerService')) return {
            isSubscribedToBar: (...args) => { calls.subscriptions.push(args); return Promise.resolve(false); },
            subscribeToBar: (...args) => calls.writes.push(['subscribe', ...args]),
            unsubscribeFromBar: (...args) => calls.writes.push(['unsubscribe', ...args]),
        };
        if (name.includes('barService')) return { updateBarAmenities: (...args) => calls.writes.push(['amenities', ...args]) };
        throw new Error(`Unexpected dependency: ${name}`);
    }).default;
    return {
        calls, states,
        render(bar, placeDetails = null) {
            stateIndex = refIndex = effectIndex = 0;
            const tree = component({ visible: true, bar, placeDetails, allMatches, onClose() {} });
            effects.splice(0).forEach(effect => effect());
            return tree;
        },
    };
}

test('friendly sample profiles retain local-only review and external-action safeguards', async () => {
    const harness = modalHarness({ user: { id: 'owner' } });
    const bar = fixture();
    let tree = harness.render(bar, { websiteUri: 'https://real-business.invalid', phoneNumber: '123', formattedAddress: 'Real address', photoUrls: ['real-photo'] });
    assert(!text(tree).includes(demo.PREMIUM_DEMO_NOTICE));
    assert(text(tree).includes('Laia'));
    assert(!text(tree).includes('Real address'));
    const social = nodes(tree).filter(node => /^Obrir (instagram|facebook|website)$/.test(node.props.accessibilityLabel || ''));
    assert.equal(social.length, 3);
    for (const action of social) {
        assert.equal(action.props.accessibilityRole, 'button');
        action.props.onPress();
    }
    const follow = nodes(tree).find(node => node.props.accessibilityLabel?.startsWith('Seguir '));
    await follow.props.onPress();
    assert.equal(harness.calls.alerts.length, 4);
    assert(harness.calls.alerts.every(alert => alert.tone === 'info' && /encara no està disponible/.test(alert.message)));
    assert.deepEqual(harness.calls.external, []);
    assert.deepEqual(harness.calls.fetches, []);
    assert.deepEqual(harness.calls.stats, []);
    assert.deepEqual(harness.calls.subscriptions, []);
    assert.deepEqual(harness.calls.writes, []);
    assert(!nodes(tree).some(node => node.props.accessibilityLabel === 'Editar serveis del bar'));
    assert(!text(tree).includes('Escriure'));
    const hoursToggle = nodes(tree).find(node => node.type === 'TouchableOpacity' && node.props.accessibilityState?.expanded === false);
    assert(hoursToggle, 'opening hours have an accessible toggle');
    hoursToggle.props.onPress();
    tree = harness.render(bar);
    assert(text(tree).includes('Dimarts–diumenge: 17:00–01:00'));
});

test('owner copy refresh preserves custom edits, empty clears and the sample safety identity', () => {
    const original = { ...fixture(), description: 'Bar fictici per provar el perfil premium, els serveis i les emissions. Fotos illustratives; no representa un establiment real.', promotionalText: 'Perfil de proves - sense subscripcio ni cobraments reals' };
    const refreshed = demo.ownerDemoCopy(original);
    assert.doesNotMatch(refreshed.description, /demo|prova/i);
    assert.doesNotMatch(refreshed.promotionalText, /demo|prova/i);
    for (const description of ['', 'El nostre local, la nostra gent.', 'Prova les nostres tapes.']) {
        const edited = { ...original, description, promotionalText: '', socialMedia: { instagram: 'my-edit' } };
        const copy = demo.ownerDemoCopy(edited);
        assert.equal(copy.description, description);
        assert.equal(copy.promotionalText, '');
        assert.equal(copy.socialMedia.instagram, 'my-edit');
        assert.equal(copy.isTestData, edited.isTestData);
        assert.equal(copy.id, edited.id);
        assert.equal(edited.description, description);
    }
    const real = { ...original, isTestData: false };
    assert.equal(demo.ownerDemoCopy(real), real);
});

test('a late real review response cannot overwrite a newly selected demo profile', async () => {
    let resolveReviews, resolveStats;
    const harness = modalHarness({
        fetchReviews: () => new Promise(resolve => { resolveReviews = resolve; }),
        getBarReviewStats: () => new Promise(resolve => { resolveStats = resolve; }),
    });
    harness.render({ ...fixture('real'), isTestData: false });
    harness.render(fixture());
    resolveReviews([{ id: 'real-review', userId: 'real-guest', userName: 'Real guest', rating: 1, createdAt: new Date() }]);
    resolveStats({ averageRating: 1, totalReviews: 1 });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(harness.states[1].length, 3);
    assert(harness.states[1].every(review => review.id.startsWith('demo-review-')));
    assert.equal(harness.states[2].totalReviews, 3);
    const tree = harness.render(fixture());
    assert(!text(tree).includes('Real guest'));
    assert(text(tree).includes('Laia'));
});

test('real profiles retain external socials and review submission', async () => {
    const harness = modalHarness();
    const bar = { ...fixture('real'), isTestData: false, socialMedia: { instagram: 'actual-owner-handle' } };
    let tree = harness.render(bar);
    nodes(tree).find(node => node.props.accessibilityLabel === 'Obrir instagram').props.onPress();
    assert.deepEqual(harness.calls.external, ['https://instagram.com/actual-owner-handle']);
    assert(!text(tree).includes(demo.PREMIUM_DEMO_NOTICE));
    nodes(tree).find(node => node.type === 'TouchableOpacity' && text(node) === 'Escriure').props.onPress();
    tree = harness.render(bar);
    await nodes(tree).find(node => node.type === 'TouchableOpacity' && text(node) === 'Publicar').props.onPress();
    assert.equal(harness.calls.writes[0][0], 'addReview');
    assert.equal(harness.calls.writes[0][1], 'real');
    assert(harness.calls.fetches.every(id => id === 'real'));
});

test('Zurito preview is exact-identity, development-only and never mutates the real venue', () => {
    const development = load('app/src/data/premiumDemoProfiles.ts', undefined, { EXPO_PUBLIC_TROBAR_ENV: 'development' });
    const production = load('app/src/data/premiumDemoProfiles.ts', undefined, { EXPO_PUBLIC_TROBAR_ENV: 'production' });
    const bar = { ...fixture(development.ZURITO_PREVIEW_ID), isTestData: false, name: 'Zurito Terrassa', address: 'Real address' };
    const snapshot = plain(bar);
    assert.equal(production.isPremiumDemoBar(bar), false);
    assert.equal(production.isPremiumDemoBar({ ...bar, isTestData: true }), false);
    assert.equal(production.enrichPremiumDemoBar(bar), bar);
    assert.equal(development.isPremiumDemoBar({ ...bar, ownerId: undefined }), false);
    assert.equal(development.isPremiumDemoBar({ ...bar, id: 'other', name: 'Zurito Terrassa' }), false);
    const preview = development.enrichPremiumDemoBar(bar);
    assert.equal(preview.name, bar.name);
    assert.equal(preview.address, bar.address);
    assert.equal(preview.id, bar.id);
    assert.equal(preview.ownerId, bar.ownerId);
    assert.equal(preview.gallery.length, 3);
    assert.equal(Object.keys(preview.socialMedia).length, 3);
    assert.equal(development.getPremiumDemoReviews(bar).length, 3);
    assert.equal(development.ownerDemoCopy(bar), bar);
    const matches = Array.from({ length: 5 }, (_, id) => ({ id: String(id), status: id === 0 ? 'finished' : 'scheduled' }));
    assert.deepEqual(Array.from(development.getPremiumDemoBroadcastMatches(bar, matches), match => match.id), ['1', '2', '3']);
    assert.equal(production.getPremiumDemoBroadcastMatches(bar, matches), null);
    assert.deepEqual(plain(bar), snapshot);
});

test('Zurito preview displays examples, preserves action safeguards and keeps directions outside the scroll', async () => {
    const development = load('app/src/data/premiumDemoProfiles.ts', undefined, { EXPO_PUBLIC_TROBAR_ENV: 'development' });
    const bar = { ...fixture(development.ZURITO_PREVIEW_ID), isTestData: false };
    const ui = modalHarness({ demoModule: development, allMatches: [{ id: 'future', status: 'scheduled' }] });
    const tree = ui.render(bar);
    assert(text(tree).includes(development.ZURITO_PREVIEW_NOTICE));
    assert.equal(nodes(tree).filter(node => node.type === 'MatchCard').length, 1);
    assert.equal(nodes(tree).filter(node => node.props.testID === 'premium-broadcasts').length, 1);
    const heading = nodes(tree).find(node => node.props.testID === 'premium-profile-heading');
    assert.equal(heading.props.style.borderLeftWidth, undefined);
    const scroll = nodes(tree).find(node => node.props.testID === 'premium-profile-scroll');
    assert.equal(nodes(scroll).some(node => node.props.testID === 'premium-profile-actions'), false);
    const actions = nodes(tree).find(node => node.props.testID === 'premium-profile-actions');
    assert.equal(actions.props.style.paddingBottom, 34);
    const follow = nodes(tree).find(node => node.props.testID === 'premium-follow-button');
    assert.equal(follow.props.style.minHeight, 44);
    await follow.props.onPress();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(ui.calls.writes.length, 0);
    assert.equal(ui.calls.fetches.length, 0);
});
