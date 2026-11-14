const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, dependencies) {
    const module = { exports: {} };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve(file), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    }).outputText, { module, exports: module.exports, console, Date, process: { env: {} }, require: dependencies });
    return module.exports;
}

function serviceHarness() {
    const records = new Map(), writes = [], queries = [];
    const snapshot = (id, data) => ({ id, exists: () => !!data, data: () => data });
    const firestore = {
        collection: (_db, ...parts) => parts.join('/'),
        doc: (_db, ...parts) => ({ path: parts.join('/'), id: parts.at(-1) }),
        where: (...args) => ({ where: args }), orderBy: (...args) => ({ orderBy: args }), limit: value => ({ limit: value }),
        query: (path, ...constraints) => ({ path, constraints }),
        getDocs: async query => {
            queries.push(query);
            let docs = [...records].filter(([key]) => key.startsWith(`${query.path}/`)).map(([key, data]) => snapshot(key.split('/').at(-1), data));
            for (const constraint of query.constraints) {
                if (constraint.where) docs = docs.filter(doc => doc.data()[constraint.where[0]] === constraint.where[2]);
                if (constraint.limit) docs = docs.slice(0, constraint.limit);
            }
            return { docs };
        },
        serverTimestamp: () => ({ toDate: () => new Date() }),
        runTransaction: async (_db, operation) => operation({
            get: async ref => snapshot(ref.id, records.get(ref.path)),
            set: (ref, data) => { writes.push(ref.path); records.set(ref.path, data); },
        }),
        getAggregateFromServer: async path => {
            const ratings = [...records].filter(([key]) => key.startsWith(`${path}/`)).map(([, data]) => data.rating);
            return { data: () => ({ averageRating: ratings.length ? ratings.reduce((a, b) => a + b) / ratings.length : null, totalReviews: ratings.length }) };
        },
        average: value => value, count: () => 'count',
        deleteDoc: async ref => { writes.push(ref.path); records.delete(ref.path); },
    };
    const service = load('../app/src/services/reviewService.ts', name => name === 'firebase/firestore' ? firestore : {});
    return { service, records, writes, queries };
}

test('publishing uses a deterministic user document and does not rewrite aggregate data', async () => {
    const { service, writes } = serviceHarness();
    assert.equal(await service.addReview('bar', 'alice', 'Alice', undefined, 4, ' Good bar '), 'alice');
    assert.deepEqual(writes, ['bars/bar/reviews/alice']);
    await assert.rejects(service.addReview('bar', 'alice', 'Alice', undefined, 5), /Ja has publicat/);
    await assert.rejects(service.addReview('bar', 'bob', 'Bob', undefined, 3.5), /entre 1 i 5/);
    await assert.rejects(service.addReview('bar', 'bob', 'Bob', undefined, 4, 'x'.repeat(2001)), /2.000/);
    assert.deepEqual(writes, ['bars/bar/reviews/alice']);
});

test('legacy user reviews outside the first page still prevent duplicate submissions', async () => {
    const { service, records, queries } = serviceHarness();
    for (let i = 0; i < 60; i++) records.set(`bars/bar/reviews/old-${i}`, {
        userId: `user-${i}`, userName: 'Legacy', rating: 4, createdAt: { toDate: () => new Date() },
    });
    assert.equal((await service.getUserReview('bar', 'user-59')).id, 'old-59');
    await assert.rejects(service.addReview('bar', 'user-59', 'Legacy', undefined, 5), /Ja has publicat/);
    assert(queries.some(query => query.constraints.some(item => item.where?.[0] === 'userId')));
    const stats = await service.getBarReviewStats('bar');
    assert.equal(stats.totalReviews, 60);
    assert.equal(stats.averageRating, 4);
});

test('demo user reviews persist locally, preserve fixtures, and never write remotely', async () => {
    const { service } = serviceHarness();
    const storage = new Map();
    const local = load('../app/src/services/premiumDemoReviewService.ts', name => {
        if (name.includes('async-storage')) return { __esModule: true, default: {
            getItem: async key => storage.get(key) ?? null, setItem: async (key, value) => storage.set(key, value),
        } };
        if (name.includes('premiumDemoProfiles')) return { isPremiumDemoBar: bar => bar.id === 'demo' };
        if (name.includes('reviewService')) return service;
        throw new Error(name);
    });
    const bar = { id: 'demo' };
    await local.addDemoUserReview(bar, { id: 'alice', name: 'Alice' }, 5, 'Local test');
    const reviews = await local.fetchDemoUserReviews(bar);
    assert.equal(reviews.length, 1);
    assert.equal(reviews[0].comment, 'Local test');
    assert(reviews[0].createdAt instanceof Date);
    await assert.rejects(local.addDemoUserReview(bar, { id: 'alice', name: 'Alice' }, 4, ''), /Ja has publicat/);
    await assert.rejects(local.deleteDemoUserReview(bar, reviews[0].id, 'bob'), /Només pots eliminar/);
    await local.deleteDemoUserReview(bar, reviews[0].id, 'alice');
    assert.equal((await local.fetchDemoUserReviews(bar)).length, 0);
    await assert.rejects(local.fetchDemoUserReviews({ id: 'real' }), /només són per a perfils de demostració/);
    storage.set('trobar:demo-reviews:v1:demo', '{"invalid":true}');
    await assert.rejects(local.fetchDemoUserReviews(bar), /no són vàlides/);
});

test('Places requests ratings but never written Google reviews or their authors', () => {
    const source = fs.readFileSync(require.resolve('../app/src/services/placesService.ts'), 'utf8');
    assert(source.includes("'rating'"));
    assert(source.includes("'userRatingCount'"));
    assert(!source.includes('getPlaceReviews'));
    assert(!source.includes("'reviews'"));
    assert(!source.includes('authorAttribution'));
});
