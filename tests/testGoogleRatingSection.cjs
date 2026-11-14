const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const moduleStub = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../app/src/components/GoogleRatingSection.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText, { module: moduleStub, exports: moduleStub.exports, console, require(name) {
    if (name === 'react') return React;
    if (name === 'react-native') return { View: 'View', TouchableOpacity: 'Button' };
    if (name.endsWith('AppText')) return { __esModule: true, default: 'Text' };
    if (name.includes('editorialTheme')) return { EDITORIAL: {} };
    if (name.includes('AlertBanner')) return {};
    throw new Error(`Unexpected dependency (rating must not fetch reviews): ${name}`);
} });
const Rating = moduleStub.exports.default;
const text = node => Array.isArray(node) ? node.map(text).join('') : node?.props ? text(node.props.children) : typeof node === 'string' || typeof node === 'number' ? String(node) : '';

test('Google score is opt-in and demo profiles never claim to have real Google ratings', () => {
    const placeDetails = { rating: 4.7, userRatingCount: 123 };
    assert.equal(Rating({ enabled: false, placeDetails, isDemo: false }), null);
    assert.equal(Rating({ enabled: true, placeDetails, isDemo: true }), null);
    const content = text(Rating({ enabled: true, placeDetails, isDemo: false }));
    assert(content.includes('4.7 / 5 · 123 valoracions'));
    assert(content.includes('Google Maps'));
    assert(content.includes('no es barreja'));
    assert(!content.includes('Ressenyes de Google'));
});

test('missing Google ratings are unavailable, never a fabricated score', () => {
    for (const placeDetails of [null, { rating: 0, userRatingCount: 0 }]) {
        const content = text(Rating({ enabled: true, placeDetails, isDemo: false }));
        assert(content.includes('no disponible'));
        assert(!content.includes('0.0 / 5'));
    }
});
