const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const compile = file => ts.transpileModule(fs.readFileSync(require.resolve(file), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

function harness() {
  const broadcast = { exports: {} };
  vm.runInNewContext(compile('../app/src/utils/matchBroadcast.ts'), { exports: broadcast.exports });
  const fixtures = [
    { id: 'pending', name: 'Bar pendent', ownerId: 'owner', status: 'pending_checkout', isActive: false },
    { id: 'registered', name: 'Bar actiu', ownerId: 'owner2', status: 'registered', isActive: true },
    { id: 'osm_node_1', name: 'Bar descobert', source: 'user_reported', isActive: false },
  ].map(data => ({ ...data, location: { latitude: 41.38, longitude: 2.17 } }));
  const service = { exports: {} };
  vm.runInNewContext(compile('../app/src/services/barService.ts'), {
    exports: service.exports, console,
    require: name => {
      if (name === 'firebase/firestore') return {
        collection: () => 'bars', query: () => 'bars', where() {}, limit() {},
        getDocs: async () => ({ forEach: callback => fixtures.forEach(data => callback({ id: data.id, data: () => data })) }),
      };
      if (name.endsWith('/core')) return { executeRequest: async operation => ({ success: true, data: await operation() }) };
      if (name.endsWith('/barNavigation')) return { getBarCoordinates: data => data.location };
      if (name.endsWith('/matchBroadcast')) return broadcast.exports;
      return {};
    },
  });
  return { ...service.exports, ...broadcast.exports, fixtures };
}

test('pending drafts stay out of public maps and broadcasts without hiding existing discovered places', async () => {
  const h = harness();
  assert.deepEqual(Array.from(await h.fetchBars(), bar => bar.id), ['registered', 'osm_node_1']);
  assert.deepEqual(Array.from(await h.fetchBarsInBounds(41, 42, 2, 3), bar => bar.id), ['registered', 'osm_node_1']);
  assert.deepEqual(Array.from(await h.fetchBarsForMatch('next', 'next'), bar => bar.id), ['registered']);
  assert.equal(h.isRegisteredBar(h.fixtures[0]), false);
  assert.equal(h.barShowsMatch({ ...h.fixtures[0], broadcastingMatches: ['next'] }, 'next', 'next'), false);
  assert.equal(h.isRegisteredBar(h.fixtures[1]), true);
});

test('a confirmed subscription makes the draft eligible for discovery and match broadcasts', async () => {
  const h = harness();
  Object.assign(h.fixtures[0], { status: 'registered', isActive: true, tier: 'premium' });
  assert.equal(h.isRegisteredBar(h.fixtures[0]), true);
  assert.ok((await h.fetchBars()).some(bar => bar.id === 'pending'));
  assert.ok((await h.fetchBarsForMatch('next', 'next')).some(bar => bar.id === 'pending'));
});
