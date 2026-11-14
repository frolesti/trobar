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
    } : name === 'expo-image' ? { Image: 'Image' } : name.endsWith('mapIcons') ? { getMapIcon: () => 'map-pin-premium-grana-3d.png' } : name,
});
const Badge = moduleStub.exports.default;

test('only registered bars with a paid subscription receive the crest', () => {
    for (const bar of [{}, { tier: 'premium' }, { ownerId: 'owner' }, { ownerId: 'owner', tier: 'free' }, { source: 'verified' }, { verifiedAt: new Date() }, { id: 'registered' }]) {
        assert.equal(Badge({ bar, onLoad: () => {} }), null);
    }
    assert(Badge({ bar: { ownerId: 'owner', tier: 'premium' }, onLoad: () => {} }));
});

test('premium pin is a single precomposed image without native perspective, tint or stacked layers', () => {
    const onLoad = () => {};
    const badge = Badge({ bar: { ownerId: 'owner', tier: 'premium' }, onLoad });
    assert.equal(badge.type, 'Image');
    assert.match(badge.props.source, /map-pin-premium-grana-3d\.png$/);
    assert.equal(badge.props.onDisplay, onLoad);
    assert.equal(badge.props.style.width, 52);
    assert.equal(badge.props.style.transform, undefined);
    assert.equal(badge.props.style.tintColor, undefined);
    assert.equal(badge.props.children, undefined);
    const selected = Badge({ bar: { ownerId: 'owner', tier: 'premium' }, onLoad, size: 64 });
    assert.equal(selected.props.style.width, 64);
    assert.equal(selected.props.style.height, 64);
});

function decodePin(filename) {
    const bytes = fs.readFileSync(path.join(__dirname, '../assets/app/img/map-icons', filename));
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
    assert.equal(bytes[24], 8);
    assert.equal(bytes[25], 6, 'the artwork must be RGBA');
    const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20), stride = width * 4;
    const chunks = [];
    for (let offset = 8; offset < bytes.length;) {
        const length = bytes.readUInt32BE(offset);
        if (bytes.toString('ascii', offset + 4, offset + 8) === 'IDAT') chunks.push(bytes.subarray(offset + 8, offset + 8 + length));
        offset += length + 12;
    }
    const filtered = require('node:zlib').inflateSync(Buffer.concat(chunks));
    const data = Buffer.alloc(stride * height);
    const paeth = (left, up, corner) => {
        const p = left + up - corner;
        const a = Math.abs(p - left), b = Math.abs(p - up), c = Math.abs(p - corner);
        return a <= b && a <= c ? left : b <= c ? up : corner;
    };
    for (let y = 0; y < height; y++) {
        const filter = filtered[y * (stride + 1)];
        assert(filter <= 4);
        for (let x = 0; x < stride; x++) {
            const index = y * stride + x;
            const left = x >= 4 ? data[index - 4] : 0;
            const up = y ? data[index - stride] : 0;
            const corner = y && x >= 4 ? data[index - stride - 4] : 0;
            const predictor = [0, left, up, Math.floor((left + up) / 2), paeth(left, up, corner)][filter];
            data[index] = (filtered[y * (stride + 1) + x + 1] + predictor) & 255;
        }
    }
    return { data, width, height };
}

test('premium 3D pin has a distinct wine colour and keeps its crest at the upper-right', () => {
    const { data, width, height } = decodePin('map-pin-premium-grana-3d.png');
    const original = decodePin('map-pin-registered-3d.png').data;
    let side = 0, changedFace = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (x > 145 && x < 225 && y > 95 && y < 175 && original[i + 3] === 255 &&
            [0, 1, 2].some(channel => Math.abs(data[i + channel] - original[i + channel]) > 2)) changedFace++;
        if (data[i + 3] < 200 || data[i] < 150 || data[i + 1] < 100 || data[i + 2] > 90) continue;
        if (x > 250 && y < 180) side++;
    }
    assert(side > 1500, 'the gold crest must be visible at the upper-right');
    assert(changedFace > 3000, 'the premium face must differ from the standard registered colour');
    const i = (200 * width + 240) * 4;
    assert(data[i] > data[i + 2] && data[i + 2] > data[i + 1] * 2, 'the face must remain wine-coloured, not neutral grey');
    assert(data[i] < original[i] - 25, 'the premium wine must be visibly deeper than the standard red');
});

test('unregistered pin uses the registered silhouette in white with a solid black outline', () => {
    const { data, width, height } = decodePin('map-pin-unregistered-white-3d.png');
    const original = decodePin('map-pin-registered-3d.png');
    assert.equal(width, original.width);
    assert.equal(height, original.height);
    let white = 0, outline = 0, body = 0;
    assert.equal(data[3], 0);
    for (let i = 0; i < data.length; i += 4) {
        if (original.data[i + 3] === 255) {
            body++;
            assert.equal(data[i + 3], 255, 'the original solid shape must be retained');
            assert(Math.abs(data[i] - data[i + 1]) <= 1 && Math.abs(data[i + 1] - data[i + 2]) <= 1);
            if (data[i] >= 225) white++;
        }
        if (data[i + 3] === 255 && data[i] <= 12 && data[i + 1] <= 12 && data[i + 2] <= 12) outline++;
    }
    assert(body > 10000);
    assert(white / body >= 0.7, 'most of the original solid pin must read as white');
    assert(outline > 4000, 'the outline must be thick enough to survive downscaling to map size');
    const leftEdge = (image, predicate) => {
        for (let x = 0; x < width; x++) {
            const i = (150 * width + x) * 4;
            if (predicate(image, i)) return x;
        }
        throw new Error('Missing pin edge');
    };
    const bodyEdge = leftEdge(original.data, (pixels, i) => pixels[i + 3] === 255);
    const blackEdge = leftEdge(data, (pixels, i) => pixels[i + 3] === 255 && pixels[i] <= 12);
    assert(bodyEdge - blackEdge >= 5, 'the black stroke must extend at least five source pixels beyond the body');
});

test('all map surfaces preload the ringless variants', () => {
    const source = fs.readFileSync(path.join(__dirname, '../app/src/utils/mapIcons.ts'), 'utf8');
    assert.match(source, /registered: require\('[^']+\/map-pin-registered-3d\.png'\)/);
    assert.match(source, /discovered: require\('[^']+\/map-pin-unregistered-white-3d\.png'\)/);
    assert.match(source, /premium: require\('[^']+\/map-pin-premium-grana-3d\.png'\)/);
});

test('white pin outlines the front face seam and the complete recessed opening, not just its silhouette', () => {
    const { data, width } = decodePin('map-pin-unregistered-white-3d.png');
    for (const [x, y] of [[203, 70], [145, 162], [176, 259], [231, 102], [259, 141], [226, 193], [187, 186]]) {
        const i = (y * width + x) * 4;
        assert.equal(data[i + 3], 255, `the internal stroke at ${x},${y} must be opaque`);
        assert(data[i] <= 12 && data[i + 1] <= 12 && data[i + 2] <= 12,
            `the internal stroke at ${x},${y} must remain black`);
    }
});

test('all three pins remove the base rings without removing the tapered tip', () => {
    for (const name of ['map-pin-registered-3d.png', 'map-pin-unregistered-white-3d.png', 'map-pin-premium-grana-3d.png']) {
        const { data, width, height } = decodePin(name);
        let tip = 0;
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
            const alpha = data[(y * width + x) * 4 + 3];
            if (y >= 314) assert.equal(alpha, 0, `${name} must not retain any base ring below the tip`);
            if (y >= 295 && y <= 304 && x >= 210 && x <= 219 && alpha === 255) tip++;
            if (y >= 250 && (x < 140 || x > 260)) assert.equal(alpha, 0, `${name} must not retain side fragments of the rings`);
        }
        assert(tip > 20, `${name} must keep the original tapered pin tip`);
    }
});