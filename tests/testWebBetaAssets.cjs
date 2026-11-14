const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('build synchronizes concrete deployable image, logo, video and animation directories', () => {
  require('../web-app/scripts/sync-shared-assets.js');
  for (const directory of ['img', 'logos', 'videos', 'gif']) {
    const destination = path.resolve(__dirname, '..', 'web-app', 'public', 'assets', directory);
    assert.equal(fs.lstatSync(destination).isSymbolicLink(), false);
  }
  for (const asset of [
    'logos\\logo-red.png', 'logos\\logo-white.png', 'img\\bar-fallout.jpg',
    'img\\canopy-poster.jpg', 'img\\glasses-beer-poster.jpg', 'img\\community-poster.jpg',
    'videos\\canopy.mp4', 'videos\\glasses-beer.mp4', 'videos\\community.mp4',
  ]) {
    const root = path.resolve(__dirname, '..');
    assert.deepEqual(fs.readFileSync(path.join(root, 'web-app', 'public', 'assets', asset)),
      fs.readFileSync(path.join(root, 'assets', 'web', asset)));
  }
});

test('Next deployment Firebase settings take precedence over Expo fallback without reading secrets', () => {
  const config = fs.readFileSync(require.resolve('../web-app/next.config.js'), 'utf8');
  const module = { exports: {} };
  let synchronized = false;
  vm.runInNewContext(config, {
    module, __dirname: path.resolve(__dirname, '..', 'web-app'),
    process: { env: { NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'demo-web', EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'demo-expo' } },
    require: name => {
      if (name === 'dotenv') return { config() {} };
      if (name === './scripts/sync-shared-assets.js') { synchronized = true; return {}; }
      return require(name);
    },
  });
  assert.equal(synchronized, true, 'direct next build must synchronize assets even without npm prebuild');
  assert.equal(module.exports.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, 'demo-web');
});
