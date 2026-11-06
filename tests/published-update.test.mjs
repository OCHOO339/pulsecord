import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';

const script = fileURLToPath(new URL('../scripts/verify-published-update.mjs', import.meta.url));
for (const scenario of ['valid', 'corrupt', 'stale']) {
    test(`public update verification: ${scenario}`, async t => {
        const root = await mkdtemp(join(tmpdir(), 'pulsecord-public-update-'));
        t.after(() => rm(root, { recursive: true, force: true }));
        const keys = generateKeyPairSync('ed25519');
        const bytes = Buffer.from('signed release payload');
        const release = { format: 1, version: '0.4.0', platform: process.platform, arch: process.arch,
            bundleId: 'a'.repeat(64), bundleUrl: 'https://example.com/update.zip',
            sha256: createHash('sha256').update(bytes).digest('hex'), size: bytes.length, changelog: 'Update' };
        const envelope = value => {
            const payload = Buffer.from(JSON.stringify(value));
            return { payload: payload.toString('base64'), signature: sign(null, payload, keys.privateKey).toString('base64') };
        };
        await mkdir(join(root, 'release/updates'), { recursive: true });
        await writeFile(join(root, 'updates.json'), JSON.stringify({ manifestUrl: 'https://example.com/manifest.json', publicKey: keys.publicKey.export({ type: 'spki', format: 'pem' }) }));
        await writeFile(join(root, 'release/updates/pulsecord-update.json'), JSON.stringify(envelope(release)));
        const remote = envelope(scenario === 'stale' ? { ...release, bundleId: 'b'.repeat(64) } : release);
        const preload = join(root, 'fetch.mjs');
        await writeFile(preload, `
            globalThis.setTimeout = callback => { queueMicrotask(callback); };
            globalThis.fetch = async url => {
                if (url.endsWith('/manifest.json')) return {ok:true,json:async()=>(${JSON.stringify(remote)})};
                if (url.endsWith('/update.zip')) return {ok:true,arrayBuffer:async()=>Buffer.from(${JSON.stringify(scenario === 'corrupt' ? 'corrupt' : bytes.toString())})};
                throw Error('Unexpected request: '+url);
            };
        `);
        const result = spawnSync(process.execPath, ['--import', pathToFileURL(preload).href, script], { cwd: root, encoding: 'utf8', timeout: 10000, windowsHide: true });
        assert.ifError(result.error);
        if (scenario === 'valid') {
            assert.equal(result.status, 0, result.stderr);
            assert.match(result.stdout, /Published update verified/);
        } else {
            assert.notEqual(result.status, 0);
            assert.match(result.stderr, scenario === 'corrupt' ? /corrupted/ : /does not match this build/);
        }
    });
}
