import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, realpath, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { install, uninstall, rollback, makeAsar, discover, getInstallation, activateUpdate } from '../packages/installer/core.mjs';
const sha = data => createHash('sha256').update(data).digest('hex');
async function fixture(t) {
    // Windows runner TEMP can use a short-name alias; fixtures need canonical paths.
    const root = await realpath(await mkdtemp(path.join(tmpdir(), 'mycord-test-')));
    t.after(() => rm(root, { recursive: true, force: true }));
    const resources = path.join(root, 'resources'); await mkdir(resources);
    const original = Buffer.from('original Discord fixture — never a live installation');
    await writeFile(path.join(resources, 'app.asar'), original);
    async function bundle(name, code = '// test patcher') {
        const dir = path.join(root, name); await mkdir(dir);
        await writeFile(path.join(dir, 'patcher.js'), code);
        await writeFile(path.join(dir, 'bundle.json'), JSON.stringify({ format: 1, files: { 'patcher.js': sha(code) } }));
        return dir;
    }
    return { root, resources, original, bundle };
}
test('install, idempotent repair, update, rollback and byte-identical restore', async t => {
    const f = await fixture(t); const a = await f.bundle('a'); const b = await f.bundle('b', '// second');
    await install(f.resources, a);
    const first = await readFile(path.join(f.resources, 'app.asar'));
    assert.deepEqual(await readFile(path.join(f.resources, '_app.asar')), f.original);
    await install(f.resources, a); assert.deepEqual(await readFile(path.join(f.resources, 'app.asar')), first);
    await install(f.resources, b); assert.notDeepEqual(await readFile(path.join(f.resources, 'app.asar')), first);
    await rollback(f.resources); assert.deepEqual(await readFile(path.join(f.resources, 'app.asar')), first);
    await uninstall(f.resources); assert.deepEqual(await readFile(path.join(f.resources, 'app.asar')), f.original);
});
test('refuses another mod without changing files', async t => {
    const f = await fixture(t); await writeFile(path.join(f.resources, '_app.asar'), 'other');
    await assert.rejects(install(f.resources, await f.bundle('a')), /Another mod/);
    assert.deepEqual(await readFile(path.join(f.resources, 'app.asar')), f.original);
});

test('refuses a genuinely redirected installation without changing its archive', async t => {
    const f = await fixture(t);
    const redirected = path.join(f.root, 'redirected-resources');
    await symlink(f.resources, redirected, process.platform === 'win32' ? 'junction' : 'dir');
    await assert.rejects(install(redirected, await f.bundle('a')), /Symlinked installation paths/);
    assert.deepEqual(await readFile(path.join(f.resources, 'app.asar')), f.original);
});
test('refuses corrupt payload and path traversal', async t => {
    const f = await fixture(t); const bundle = await f.bundle('a');
    await writeFile(path.join(bundle, 'patcher.js'), 'tampered');
    await assert.rejects(install(f.resources, bundle), /integrity failure/);
    await writeFile(path.join(bundle, 'bundle.json'), JSON.stringify({ format: 1, files: { 'patcher.js': sha('tampered'), '../escape.js': sha('x') } }));
    await assert.rejects(install(f.resources, bundle), /Invalid bundle entry/);
    assert.deepEqual(await readFile(path.join(f.resources, 'app.asar')), f.original);
});
test('refuses modified backup and Discord update', async t => {
    const f = await fixture(t); await install(f.resources, await f.bundle('a'));
    await writeFile(path.join(f.resources, '_app.asar'), 'changed');
    await assert.rejects(uninstall(f.resources), /backup changed/);
    await writeFile(path.join(f.resources, '_app.asar'), f.original);
    await writeFile(path.join(f.resources, 'app.asar'), 'Discord updated');
    await assert.rejects(uninstall(f.resources), /archive changed/);
});
test('exclusive operation lock prevents simultaneous mutation', async t => {
    const f = await fixture(t); await writeFile(path.join(f.resources, '.mycord.lock'), 'busy');
    await assert.rejects(install(f.resources, await f.bundle('a')), { code: 'EEXIST' });
    assert.deepEqual(await readFile(path.join(f.resources, 'app.asar')), f.original);
});
test('manifest write failure restores original archive', async t => {
    const f = await fixture(t);
    await writeFile(path.join(f.resources, '.mycord.json.mycord-tmp'), 'existing interrupted transaction');
    await assert.rejects(install(f.resources, await f.bundle('a')), { code: 'EEXIST' });
    assert.deepEqual(await readFile(path.join(f.resources, 'app.asar')), f.original);
    await assert.rejects(readFile(path.join(f.resources, '_app.asar')), { code: 'ENOENT' });
});
test('rollback refuses corrupted previous bundle', async t => {
    const f = await fixture(t); await install(f.resources, await f.bundle('a')); await install(f.resources, await f.bundle('b', '// newer'));
    const state = JSON.parse(await readFile(path.join(f.resources, '.mycord.json')));
    const before = await readFile(path.join(f.resources, 'app.asar'));
    await writeFile(path.join(f.resources, 'mycord-versions', state.previous, 'patcher.js'), '// altered');
    await assert.rejects(rollback(f.resources), /integrity failure/);
    assert.deepEqual(await readFile(path.join(f.resources, 'app.asar')), before);
});
test('ASAR has valid offsets and escaped patcher path', () => {
    const filename = 'C:\\My Cord\\"test"\\patcher.js'; const bytes = makeAsar(filename);
    const size = bytes.readUInt32LE(12); const header = JSON.parse(bytes.subarray(16, 16 + size));
    const body = bytes.subarray(8 + bytes.readUInt32LE(4));
    assert.equal(body.subarray(0, header.files['index.js'].size).toString(), `require(${JSON.stringify(filename)})`);
    assert.equal(JSON.parse(body.subarray(Number(header.files['package.json'].offset)).toString()).main, 'index.js');
});
test('Windows discovery reads only expected app version directories', async t => {
    const f = await fixture(t); const dir = path.join(f.root, 'Discord', 'app-1.2.3', 'resources'); await mkdir(dir, { recursive: true }); await writeFile(path.join(dir, 'app.asar'), 'fixture');
    const found = await discover('win32', { LOCALAPPDATA: f.root }); assert.equal(found.length, 1); assert.equal(found[0].resources, dir);
});
test('in-app updates switch bundles without rewriting the running ASAR and can roll back', async t => {
    const f = await fixture(t); const a = await f.bundle('a'); const b = await f.bundle('b', '// update');
    await install(f.resources, a, new URL('../packages/updates/loader.cjs', import.meta.url));
    const old = await getInstallation(f.resources);
    const archive = await readFile(path.join(f.resources, 'app.asar'));
    const loader = await readFile(path.join(f.resources, 'mycord-loader.cjs'));
    await activateUpdate(f.resources, b);
    const current = await getInstallation(f.resources);
    assert.notEqual(current.current, old.current); assert.equal(current.previous, old.current);
    assert.deepEqual(await readFile(path.join(f.resources, 'app.asar')), archive);
    assert.deepEqual(await readFile(path.join(f.resources, 'mycord-loader.cjs')), loader);
    assert.deepEqual(await readFile(path.join(f.resources, '_app.asar')), f.original);
    await rollback(f.resources); assert.equal((await getInstallation(f.resources)).current, old.current);
    await uninstall(f.resources); assert.deepEqual(await readFile(path.join(f.resources, 'app.asar')), f.original);
});
test('in-app updates refuse a changed loader and installations needing a bootstrap upgrade', async t => {
    const f = await fixture(t); const a = await f.bundle('a'); const b = await f.bundle('b', '// update');
    await install(f.resources, a);
    await assert.rejects(activateUpdate(f.resources, b), /one-time installer/);
    await install(f.resources, a, new URL('../packages/updates/loader.cjs', import.meta.url));
    await writeFile(path.join(f.resources, 'mycord-loader.cjs'), 'changed loader');
    await assert.rejects(activateUpdate(f.resources, b), /loader changed/);
});
