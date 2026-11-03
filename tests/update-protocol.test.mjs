import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { bundleId, verifyRelease, verifyDownload, isOlder } from '../packages/updates/protocol.mjs';
function fixture(overrides = {}) {
    const keys = generateKeyPairSync('ed25519');
    const bytes = Buffer.from('signed build payload');
    const release = { format: 1, version: '1.2.3', platform: 'win32', arch: 'x64', bundleId: 'a'.repeat(64), bundleUrl: 'https://github.com/OCHOO339/pulsecord/releases/latest/download/test.zip', sha256: createHash('sha256').update(bytes).digest('hex'), size: bytes.length, changelog: 'Release notes', ...overrides };
    const payload = Buffer.from(JSON.stringify(release));
    return { bytes, keys, release, envelope: { payload: payload.toString('base64'), signature: sign(null, payload, keys.privateKey).toString('base64') } };
}
test('a publisher-signed release and its matching download are accepted', () => {
    const f = fixture(); const release = verifyRelease(f.envelope, f.keys.publicKey, 'win32', 'x64');
    assert.equal(release.version, '1.2.3'); verifyDownload(f.bytes, release);
});
test('tampered metadata, wrong publisher and modified downloads are rejected', () => {
    const f = fixture(); const other = generateKeyPairSync('ed25519');
    assert.throws(() => verifyRelease(f.envelope, other.publicKey, 'win32', 'x64'), /signature/);
    const payload = Buffer.from(JSON.stringify({ ...f.release, bundleUrl: 'https://example.com/evil.zip' })).toString('base64');
    assert.throws(() => verifyRelease({ ...f.envelope, payload }, f.keys.publicKey, 'win32', 'x64'), /signature/);
    assert.throws(() => verifyDownload(Buffer.from('altered build'), f.release), /corrupted/);
});
test('platform mismatches, HTTP URLs and excessive downloads are rejected', () => {
    for (const values of [{ platform: 'linux' }, { arch: 'arm64' }, { bundleUrl: 'http://example.com/build.zip' }, { size: 128 * 1024 * 1024 }]) {
        const f = fixture(values); assert.throws(() => verifyRelease(f.envelope, f.keys.publicKey, 'win32', 'x64'));
    }
});
test('bundle identifiers are stable across key order and downgrade checks compare numeric versions', () => {
    assert.equal(bundleId({ 'a.js': '1', 'b.js': '2' }), bundleId({ 'b.js': '2', 'a.js': '1' }));
    assert.equal(isOlder('1.9.0', '1.10.0'), true); assert.equal(isOlder('1.10.0', '1.9.0'), false); assert.equal(isOlder('1.0.0', '1.0.0'), false);
    assert.throws(() => isOlder('not-a-version', '1.0.0'));
});
