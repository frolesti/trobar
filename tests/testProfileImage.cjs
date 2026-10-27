const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function loadUpload(size = 100, status = 200) {
    const calls = [];
    const moduleStub = { exports: {} };
    const source = fs.readFileSync(require('node:path').join(__dirname, '../app/src/services/userService.ts'), 'utf8');
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
        module: moduleStub, exports: moduleStub.exports,
        fetch: () => { throw new Error('Local file URI must not be fetched'); },
        require: name => {
            if (name === 'firebase/storage') return {
                ref: (_, path) => path,
                uploadString: async () => { throw new Error('Firebase SDK Blob conversion must not be used'); },
                getDownloadURL: async () => 'https://example.com/avatar.jpg',
            };
            if (name === 'react-native') return { Platform: { OS: 'ios' } };
            if (name === 'expo-file-system/legacy') return { getInfoAsync: async () => ({ exists: true, size }), FileSystemUploadType: { BINARY_CONTENT: 0 }, uploadAsync: async (...args) => { calls.push(args); return { status }; } };
            if (name.includes('config/firebase')) return { auth: { currentUser: { uid: 'owner', getIdToken: async () => 'test-token' } }, storage: { app: { options: { storageBucket: 'test-bucket' } } } };
            if (name.includes('api/core')) return { executeOrThrow: operation => operation() };
            return {};
        },
    });
    return { upload: moduleStub.exports.uploadProfileImage, calls };
}

test('native file upload avoids Firebase SDK Blob conversion and JavaScript local-file fetch', async () => {
    const { upload, calls } = loadUpload();
    assert.equal(await upload('owner', 'file:///photo.heic', 'image/heic'), 'https://example.com/avatar.jpg');
    assert.equal(calls.length, 1);
    assert(calls[0][0].includes('name=avatars%2Fowner'));
    assert.equal(calls[0][1], 'file:///photo.heic');
    assert.equal(calls[0][2].headers.Authorization, 'Firebase test-token');
    assert.equal(calls[0][2].headers['Content-Type'], 'image/heic');
});

test('avatar upload rejects a different owner and oversized bytes before upload', async () => {
    const { upload, calls } = loadUpload();
    await assert.rejects(upload('other', 'file:///photo.jpg', 'image/jpeg'), /propietari/);
    const oversized = loadUpload(6 * 1024 * 1024);
    await assert.rejects(oversized.upload('owner', 'file:///photo.jpg', 'image/jpeg'), /5 MB/);
    assert.equal(oversized.calls.length, 0);
    assert.equal(calls.length, 0);
});

test('native transfer surfaces Storage rejection instead of returning a false success', async () => {
    const { upload } = loadUpload(100, 403);
    await assert.rejects(upload('owner', 'file:///photo.jpg', 'image/jpeg'), error => error.code === 'storage/unauthorized');
});

test('default avatar recovers linked Google photo without inventing an Apple photo', () => {
    const source = fs.readFileSync(require('node:path').join(__dirname, '../app/src/context/AuthContext.tsx'), 'utf8');
    const parsed = ts.createSourceFile('AuthContext.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let expression;
    const visit = node => {
        if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === 'defaultAvatar') expression = node.initializer.getText(parsed);
        ts.forEachChild(node, visit);
    };
    visit(parsed);
    assert(expression);
    const avatar = firebaseUser => vm.runInNewContext(expression, { firebaseUser });
    assert.equal(avatar({ photoURL: 'https://example.test/auth.jpg' }), 'https://example.test/auth.jpg');
    assert.equal(avatar({ photoURL: null, providerData: [{ providerId: 'google.com', photoURL: 'https://example.test/google.jpg' }] }), 'https://example.test/google.jpg');
    assert.equal(avatar({ photoURL: null, providerData: [{ providerId: 'apple.com', photoURL: null }] }), undefined);
    assert.match(source, /avatar: \(firestoreProfile\?\.avatar\) \? firestoreProfile\.avatar : defaultAvatar/);
});