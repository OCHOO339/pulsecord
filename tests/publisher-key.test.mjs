import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createPublicKey } from 'node:crypto';
import { readPublisherKey } from '../scripts/publisher-key.mjs';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

test('publisher PEM accepts real or escaped newlines and surrounding whitespace', () => {
    const pair = generateKeyPairSync('ed25519');
    const pem = pair.privateKey.export({ type: 'pkcs8', format: 'pem' });
    const expected = pair.publicKey.export({ type: 'spki', format: 'pem' });
    for (const value of [pem, '\uFEFF  ' + pem + '  ', pem.replaceAll('\n', '\r\n'), pem.replaceAll('\n', '\\n'), pem.replaceAll('\n', '\\r\\n')]) {
        assert.equal(createPublicKey(readPublisherKey(value)).export({ type: 'spki', format: 'pem' }), expected);
    }
});

test('invalid secrets get actionable errors without revealing their contents', () => {
    for (const value of ['', 'secret-placeholder-1234', 'C:/private-key.pem', generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'pem' })]) {
        assert.throws(() => readPublisherKey(value), error => error.message.includes('complete PEM file contents') && !error.message.includes('secret-placeholder-1234'));
    }
});

test('publisher key rejects other key algorithms', () => {
    const pair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    assert.throws(() => readPublisherKey(pair.privateKey.export({ type: 'pkcs8', format: 'pem' })), /must be an Ed25519/);
});

test('setup validates the trusted key before saving a normalized secret', async t => {
    const root = await mkdtemp(join(tmpdir(), 'pulsecord-key-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    const pair = generateKeyPairSync('ed25519');
    const config = JSON.stringify({ manifestUrl: 'https://example.com/update.json', publicKey: pair.publicKey.export({ type: 'spki', format: 'pem' }) });
    await writeFile(join(root, 'updates.json'), config);
    const script = fileURLToPath(new URL('../scripts/setup-updates.mjs', import.meta.url));
    const run = secret => spawnSync(process.execPath, [script], { cwd: root, env: { ...process.env, PULSECORD_UPDATE_KEY_PEM: secret }, encoding: 'utf8', windowsHide: true });
    const other = generateKeyPairSync('ed25519').privateKey.export({ type: 'pkcs8', format: 'pem' });
    const rejected = run(other);
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /does not match the public key/);
    await assert.rejects(readFile(join(root, '.pulsecord-publisher/private-key.pem')), { code: 'ENOENT' });
    assert.equal(await readFile(join(root, 'updates.json'), 'utf8'), config);
    const pem = pair.privateKey.export({ type: 'pkcs8', format: 'pem' });
    const accepted = run(pem.replaceAll('\n', '\\n'));
    assert.equal(accepted.status, 0, accepted.stderr);
    assert.equal(await readFile(join(root, '.pulsecord-publisher/private-key.pem'), 'utf8'), pem);
});
