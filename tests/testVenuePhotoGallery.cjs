const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');

function harness() {
    let failed = false;
    const errors = [];
    const module = { exports: {} };
    vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../app/src/components/VenuePhotoGallery.tsx'), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
    }).outputText, { exports: module.exports, console: { info: (...args) => errors.push(args) }, require(name) {
        if (name === 'react') return { ...React, useState: () => [failed, value => { failed = value; }] };
        if (name === 'react-native') return Object.fromEntries(['ActivityIndicator', 'Image', 'ScrollView', 'Text', 'View'].map(type => [type, type]));
        if (name === '@expo/vector-icons') return { Feather: 'Feather' };
        if (name.includes('editorialTheme')) return { EDITORIAL: {} };
        throw new Error(name);
    } });
    return { errors, render: props => module.exports.default({ name: 'Local', height: 96, photoWidth: 152, photos: [], ...props }) };
}
const nodes = node => Array.isArray(node) ? node.flatMap(nodes) : node?.props ? [node, ...nodes(node.props.children)] : [];

test('gallery geometry is identical while loading, empty and after receiving photos', () => {
    const ui = harness();
    for (const props of [{ loading: true }, {}, { photos: ['one'] }, { photos: ['one', 'two', 'three'] }]) {
        const tree = ui.render(props);
        assert.equal(tree.props.style.height, 96);
        assert.equal(ui.render({ ...props, height: 72 }).props.style.height, 72);
    }
    assert(nodes(ui.render({ loading: true })).some(node => node.props.accessibilityLabel === 'Carregant fotos'));
    assert(nodes(ui.render()).some(node => node.props.accessibilityLabel === 'Sense fotos disponibles'));
});

test('single images fill the viewport, multiple photos scroll only horizontally', () => {
    const ui = harness();
    const single = nodes(ui.render({ photos: ['one'] })).find(node => node.type === 'ScrollView');
    assert.equal(single.props.scrollEnabled, false);
    assert.equal(single.props.children[0].props.style.width, '100%');
    const multiple = nodes(ui.render({ photos: ['one', 'two', 'three'] })).find(node => node.type === 'ScrollView');
    assert.equal(multiple.props.horizontal, true);
    assert.equal(multiple.props.directionalLockEnabled, true);
    assert.equal(multiple.props.scrollEnabled, true);
    assert(multiple.props.children.every(tile => tile.props.style.width === 152 && tile.props.style.height === 96));
});

test('failed photo requests are logged and show an explicit state without changing the tile size', () => {
    const ui = harness();
    const photo = nodes(ui.render({ photos: ['broken'] })).find(node => typeof node.type === 'function');
    const image = photo.type(photo.props);
    assert.equal(image.type, 'Image');
    image.props.onError({ nativeEvent: { error: 'network unavailable' } });
    assert.equal(ui.errors.length, 1);
    assert.equal(photo.type(photo.props).props.accessibilityLabel, 'Foto no disponible');
    assert.equal(ui.render({ photos: ['broken'] }).props.style.height, 96);
});
