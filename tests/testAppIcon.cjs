const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

test('native, React and static web splash share the application background', () => {
    const path = require('node:path');
    const root = path.join(__dirname, '..');
    const brand = require('../app/src/theme/brandColors.json');
    const config = require('../app.json').expo;
    const splash = config.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen');
    assert.equal(splash[1].backgroundColor, brand.background);
    const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
    assert(html.includes(`name="theme-color" content="${brand.background}"`));
    for (const match of html.matchAll(/background-color:\s*(#[\da-f]+)/gi)) assert.equal(match[1], brand.background);
    for (const file of ['app/src/components/SplashScreen.tsx', 'app/src/screens/Startup/StartupScreen.styles.ts', 'App.tsx']) {
        assert.match(fs.readFileSync(path.join(root, file), 'utf8'), /EDITORIAL\.background/);
    }
    assert.match(fs.readFileSync(path.join(root, 'app.config.js'), 'utf8'), /backgroundColor: brandColors\.background/);
    const legal = fs.readFileSync(path.join(root, 'app/src/screens/Legal/LegalScreen.tsx'), 'utf8');
    assert.match(legal, /backgroundColor: EDITORIAL\.background/);
    assert.doesNotMatch(legal, /ED_TYPE\.display|EDITORIAL\.paper|style="dark"/);
    assert.match(fs.readFileSync(path.join(root, 'app/src/screens/LoginModal/LoginModal.styles.ts'), 'utf8'), /const PAPER = EDITORIAL\.background/);
});

test('interface icons use vector glyphs and requested colors, while map pins retain their assets', () => {
    const moduleStub = { exports: {} };
    const Feather = Object.assign(() => null, { glyphMap: { settings: 1, 'arrow-right': 2 } });
    const MaterialCommunityIcons = Object.assign(() => null, { glyphMap: { 'help-circle': 1 } });
    const Image = () => null;
    const source = fs.readFileSync(require('node:path').join(__dirname, '../app/src/components/AppIcon.tsx'), 'utf8');
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText, {
        module: moduleStub, exports: moduleStub.exports,
        require: name => name === 'react' ? React : name === 'react-native' ? { Image } : name === '@expo/vector-icons' ? { Feather, MaterialCommunityIcons } : name.includes('iconSources') ? { ICON_SOURCES: { 'registered-pin': 'pin' } } : { EDITORIAL: { ink: '#202631' } },
    });
    const Icon = moduleStub.exports.default;
    const settings = Icon({ name: 'settings', color: '#ffffff' });
    assert.equal(settings.type, Feather);
    assert.equal(settings.props.color, '#ffffff');
    assert.equal(Icon({ name: 'arrow-forward' }).props.name, 'arrow-right');
    assert.equal(Icon({ name: 'registered-pin' }).type, Image);
});