import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { createRequire } from 'node:module';
import * as core from '../packages/installer/core.mjs';
import * as protocol from '../packages/updates/protocol.mjs';
const require = createRequire(new URL('../upstream/equicord/package.json', import.meta.url));
const { transform } = require('esbuild'); const fflate = require('fflate');
const compiled = await transform(await fs.readFile('packages/pulsecord/native.ts', 'utf8'), { loader: 'ts', format: 'cjs' });
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
async function fixture(t, fault) {
    const root = await fs.mkdtemp(path.join(tmpdir(), 'pulsecord-updater-'));
    t.after(() => fs.rm(root, { recursive: true, force: true }));
    const resources = path.join(root, 'resources'); const initial = path.join(root, 'initial');
    await fs.mkdir(resources); await fs.mkdir(initial);
    const original = Buffer.from('original application archive'); await fs.writeFile(path.join(resources, 'app.asar'), original);
    await fs.writeFile(path.join(initial, 'patcher.js'), '// original mod');
    await fs.writeFile(path.join(initial, 'bundle.json'), JSON.stringify({ format: 1, version: '1.0.0', files: { 'patcher.js': digest('// original mod') } }));
    await core.install(resources, initial, new URL('../packages/updates/loader.cjs', import.meta.url));
    const old = await core.getInstallation(resources); const wrapper = await fs.readFile(path.join(resources, 'app.asar'));
    const payload = Object.fromEntries(['patcher.js', 'preload.js', 'renderer.js', 'renderer.css'].map(name => [name, Buffer.from('// new ' + name)]));
    const files = Object.fromEntries(Object.entries(payload).map(([name, bytes]) => [name, digest(bytes)]));
    payload['bundle.json'] = Buffer.from(JSON.stringify({ format: 1, version: '1.1.0', files }));
    if (fault === 'traversal') payload['../outside.js'] = Buffer.from('not allowed');
    const zip = Buffer.from(fflate.zipSync(payload));
    const release = { format: 1, version: '1.1.0', platform: 'win32', arch: 'x64', bundleId: protocol.bundleId(files), bundleUrl: 'https://github.com/OCHOO339/pulsecord/releases/latest/download/build.zip', sha256: digest(zip), size: zip.length, changelog: 'Update notes' };
    const keys = generateKeyPairSync('ed25519'); const releaseBytes = Buffer.from(JSON.stringify(release));
    const envelope = { payload: releaseBytes.toString('base64'), signature: sign(null, releaseBytes, keys.privateKey).toString('base64') };
    if (fault === 'signature') envelope.signature = Buffer.alloc(64).toString('base64');
    const downloaded = Buffer.from(zip); if (fault === 'corruption') downloaded[downloaded.length - 1] ^= 1;
    const scheduled = []; let relaunched = 0; let exitCode;
    const config = { manifestUrl: 'https://github.com/OCHOO339/pulsecord/releases/latest/download/pulsecord-update.json', publicKey: keys.publicKey.export({ type: 'spki', format: 'pem' }) };
    const context = { module: { exports: {} }, URL, Buffer, AbortSignal, console,
        process: { resourcesPath: resources, platform: 'win32', arch: 'x64' },
        setTimeout(fn) { scheduled.push(fn); return scheduled.length; },
        async fetch(url, options) {
            assert.deepEqual(Object.keys(options.headers), ['User-Agent']);
            const bytes = url === config.manifestUrl ? Buffer.from(JSON.stringify(envelope)) : downloaded;
            const response = new Response(bytes); Object.defineProperty(response, 'url', { value: url }); return response;
        },
        require(name) {
            if (name === '@main/utils/constants') return { DATA_DIR: path.join(root, 'data') };
            if (name === '@pulsecord/brand') return { brand: { version: '1.0.0', updates: config } };
            if (name === '@pulsecord/update-core') return core;
            if (name === '@pulsecord/update-protocol') return protocol;
            if (name === 'electron') return { app: { relaunch() { relaunched++; }, exit(code) { exitCode = code; } } };
            if (name === 'fflate') return fflate;
            if (name === 'original-fs') return { promises: fs };
            if (name === 'path') return path;
            throw Error(name);
        }
    };
    vm.createContext(context); vm.runInContext(compiled.code, context);
    return { api: context.module.exports, resources, old, wrapper, release, scheduled, relaunched: () => relaunched, exitCode: () => exitCode };
}
test('native updater verifies, stages, activates and schedules a Discord relaunch', async t => {
    const f = await fixture(t); const checked = await f.api.checkForUpdates({}); assert.equal(checked.phase, 'available');
    const applied = await f.api.applyUpdate({}); assert.equal(applied.phase, 'restarting');
    assert.equal((await core.getInstallation(f.resources)).current, f.release.bundleId);
    assert.deepEqual(await fs.readFile(path.join(f.resources, 'app.asar')), f.wrapper);
    assert.equal(f.scheduled.length, 1); assert.equal(f.relaunched(), 0); f.scheduled[0](); assert.equal(f.relaunched(), 1); assert.equal(f.exitCode(), 0);
});
test('native updater rejects an invalid signature before offering an update', async t => {
    const f = await fixture(t, 'signature'); assert.equal((await f.api.checkForUpdates({})).phase, 'error');
    await assert.rejects(f.api.applyUpdate({}), /No verified update/);
    assert.equal((await core.getInstallation(f.resources)).current, f.old.current); assert.equal(f.scheduled.length, 0);
});
for (const fault of ['corruption', 'traversal']) test(`native updater rejects ${fault} without changing the active bundle`, async t => {
    const f = await fixture(t, fault); assert.equal((await f.api.checkForUpdates({})).phase, 'available');
    assert.equal((await f.api.applyUpdate({})).phase, 'error');
    assert.equal((await core.getInstallation(f.resources)).current, f.old.current); assert.equal(f.scheduled.length, 0);
});
