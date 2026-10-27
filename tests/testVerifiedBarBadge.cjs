const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const moduleStub = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../app/src/components/VerifiedBarBadge.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText, {
    module: moduleStub, exports: moduleStub.exports,
    require: name => name === 'react' ? React : name === 'react-native' ? {
        Image: 'Image', View: 'View', StyleSheet: { create: value => value }, Platform: { select: choices => choices.ios },
    } : 'crest.png',
});
const Badge = moduleStub.exports.default;

test('only registered bars with a paid subscription receive the crest', () => {
    for (const bar of [{}, { tier: 'premium' }, { ownerId: 'owner' }, { ownerId: 'owner', tier: 'free' }, { source: 'verified' }, { verifiedAt: new Date() }, { id: 'registered' }]) {
        assert.equal(Badge({ bar, onLoad: () => {} }), null);
    }
    assert(Badge({ bar: { ownerId: 'owner', tier: 'premium' }, onLoad: () => {} }));
});

test('verified crest has perspective, tilt and relief layers without changing the pin footprint', () => {
    const onLoad = () => {};
    const badge = Badge({ bar: { ownerId: 'owner', tier: 'premium' }, onLoad });
    assert.equal(badge.props.style.position, 'absolute');
    assert(badge.props.style.transform.some(transform => transform.rotateZ === '-18deg'));
    assert(badge.props.style.transform.some(transform => transform.rotateY === '-24deg'));
    assert.equal(badge.props.children.length, 3);
    assert.equal(badge.props.children[1].props.onLoad, onLoad);
    assert.equal(badge.props.children[2].props.accessible, false);
    const small = Badge({ bar: { ownerId: 'owner', tier: 'premium' }, onLoad, scale: 0.5 });
    assert.equal(small.props.style.width, 12.5);
    assert.equal(small.props.children[1].props.style.width, 11.5);
    assert.equal(small.props.children[1].props.style.height, 13.5);
});