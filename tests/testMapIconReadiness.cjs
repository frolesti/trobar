const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function harness(loadAsync) {
    const module = { exports: {} };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../app/src/utils/mapIcons.ts'), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText, { exports: module.exports, require(name) {
        if (name === 'expo-image') return { Image: { loadAsync } };
        if (name.endsWith('.png')) return name;
        throw new Error(name);
    } });
    return module.exports;
}

test('all six map icons decode once and their retained image references are reused', async () => {
    const requests = [];
    const icons = harness(source => new Promise(resolve => requests.push({ source, resolve })));
    assert.throws(() => icons.getMapIcon('target'), /not been preloaded/);
    const pending = icons.preloadMapIcons();
    assert.equal(icons.preloadMapIcons(), pending);
    assert.equal(requests.length, 6);
    let ready = false;
    pending.then(() => { ready = true; });
    for (const [index, request] of requests.entries()) {
        request.image = { decoded: request.source };
        request.resolve(request.image);
        await Promise.resolve();
        if (index < 5) assert.equal(ready, false);
    }
    await pending;
    for (const key of ['target', 'search', 'hide', 'registered', 'discovered', 'premium']) {
        assert(requests.some(request => request.image === icons.getMapIcon(key)));
    }
    await icons.preloadMapIcons();
    assert.equal(requests.length, 6);
});

test('a failed icon rejects readiness and can be retried without discarding decoded icons', async () => {
    let failed = true, attempts = 0;
    const icons = harness(async source => {
        attempts++;
        if (source.includes('target-3d') && failed) throw new Error('decode failed');
        return { decoded: source };
    });
    await assert.rejects(icons.preloadMapIcons(), /decode failed/);
    assert.throws(() => icons.getMapIcon('target'), /not been preloaded/);
    failed = false;
    await icons.preloadMapIcons();
    assert(icons.getMapIcon('target'));
    assert.equal(attempts, 7);
});

test('startup blocks navigation on pending icons, surfaces failures and exposes retry', () => {
    const source = fs.readFileSync(require.resolve('../App.tsx'), 'utf8');
    assert.match(source, /const appReady = fontsLoaded && iconsReady/);
    assert.match(source, /\{appReady && <AppNavigator/);
    assert.match(source, /setIconsReady\(true\)/);
    assert.match(source, /setIconError\(true\)/);
    assert.match(source, /onPress=\{\(\) => setIconAttempt\(attempt => attempt \+ 1\)\}/);
    for (const font of ['Feather', 'Ionicons', 'MaterialCommunityIcons']) assert(source.includes(`...${font}.font`));
    const splash = fs.readFileSync(require.resolve('../app/src/components/GlobalSplash.tsx'), 'utf8');
    assert.match(splash, /const visible = !fontReady \|\| !assetsReady/);
    const map = fs.readFileSync(require.resolve('../app/src/screens/Map/MapScreen.tsx'), 'utf8');
    assert.match(map, /rotateEnabled\s+pitchEnabled/);
    assert(!map.includes('rotateEnabled={false}'));
});
