// SPDX-License-Identifier: GPL-3.0
// ASAR layout derived from Vencord/Installer app_asar.go (Vendicated and contributors).
import { promises as nodeFs } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
const fs = process.versions.electron ? createRequire(process.execPath)('original-fs').promises : nodeFs;

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const exists = async file => fs.lstat(file).then(() => true, e => { if (e.code === 'ENOENT') return false; throw e; });
const hash = async file => digest(await fs.readFile(file));
const loaderPath = dir => path.join(dir, 'mycord-loader.cjs');
export function makeAsar(patcher) {
    const index = Buffer.from(`require(${JSON.stringify(patcher)})`);
    const pkg = Buffer.from('{"name":"discord","main":"index.js"}');
    const header = Buffer.from(JSON.stringify({ files: {
        'index.js': { size: index.length, offset: '0' },
        'package.json': { size: pkg.length, offset: String(index.length) }
    } }));
    const aligned = (header.length + 3) & ~3;
    const prefix = Buffer.alloc(16);
    [4, aligned + 8, aligned + 4, header.length].forEach((n, i) => prefix.writeUInt32LE(n, i * 4));
    return Buffer.concat([prefix, header, Buffer.alloc(aligned - header.length), index, pkg]);
}
async function regular(file) {
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw Error(`Not a regular file: ${file}`);
}
async function checkedResources(dir) {
    const absolute = path.resolve(dir);
    if (await fs.realpath(absolute) !== absolute) throw Error('Symlinked installation paths are not supported');
    await regular(path.join(absolute, 'app.asar'));
    return absolute;
}
async function owned(dir) {
    const manifest = JSON.parse(await fs.readFile(path.join(dir, '.mycord.json'), 'utf8'));
    if (manifest.format !== 1 || !/^[a-f0-9]{64}$/.test(manifest.current) || (manifest.previous && !/^[a-f0-9]{64}$/.test(manifest.previous))) throw Error('Invalid ownership manifest');
    await regular(path.join(dir, '_app.asar'));
    if (await hash(path.join(dir, '_app.asar')) !== manifest.originalHash) throw Error('Original backup changed; manual recovery required');
    if (await hash(path.join(dir, 'app.asar')) !== manifest.wrapperHash) throw Error('Discord archive changed; refusing to overwrite it');
    if (manifest.loaderHash) {
        await regular(loaderPath(dir));
        if (await hash(loaderPath(dir)) !== manifest.loaderHash) throw Error('PulseCord loader changed; repair with the installer');
    }
    return manifest;
}
async function locked(dir, action) {
    const file = path.join(dir, '.mycord.lock');
    const lock = await fs.open(file, 'wx');
    try { return await action(); } finally { await lock.close(); await fs.unlink(file); }
}
async function atomic(file, data) {
    const tmp = file + '.mycord-tmp';
    await fs.writeFile(tmp, data, { flag: 'wx' });
    try { await fs.rename(tmp, file); } catch (e) { await fs.unlink(tmp); throw e; }
}
async function stage(dir, bundle, onProgress = () => {}) {
    const manifest = JSON.parse(await fs.readFile(path.join(bundle, 'bundle.json'), 'utf8'));
    if (manifest.format !== 1 || !manifest.files || !Object.hasOwn(manifest.files, 'patcher.js')) throw Error('Invalid bundle');
    const files = Object.entries(manifest.files).sort(([a], [b]) => a.localeCompare(b));
    let verified = 0;
    for (const [name, expected] of files) {
        if (!/^[\w.-]+\.(js|css|map|txt)$/.test(name) || !/^[a-f0-9]{64}$/.test(expected)) throw Error('Invalid bundle entry');
        await regular(path.join(bundle, name));
        if (await hash(path.join(bundle, name)) !== expected) throw Error(`Bundle integrity failure: ${name}`);
        onProgress({ stage: 'verify', done: ++verified, total: files.length, label: `Fichier vérifié : ${name}` });
    }
    const id = digest(JSON.stringify(files));
    const parent = path.join(dir, 'mycord-versions');
    if (await exists(parent) && (await fs.lstat(parent)).isSymbolicLink()) throw Error('Symlinked bundle directory');
    await fs.mkdir(parent, { recursive: true });
    const target = path.join(parent, id);
    if (await exists(target)) {
        if ((await fs.lstat(target)).isSymbolicLink()) throw Error('Symlinked bundle');
        for (const [name, expected] of files) { await regular(path.join(target, name)); if (await hash(path.join(target, name)) !== expected) throw Error('Installed bundle changed'); }
    } else {
        await fs.mkdir(target);
        for (const [name] of files) await fs.copyFile(path.join(bundle, name), path.join(target, name), 1);
        await fs.writeFile(path.join(target, 'bundle.json'), JSON.stringify(manifest));
    }
    onProgress({ stage: 'stage', label: 'Bundle PulseCord préparé.' });
    return id;
}
export async function install(resources, bundle, loaderSource, onProgress = () => {}) {
    const dir = await checkedResources(resources);
    return locked(dir, async () => {
        const hasManifest = await exists(path.join(dir, '.mycord.json'));
        const old = hasManifest ? await owned(dir) : null;
        if (!old && await exists(path.join(dir, '_app.asar'))) throw Error('Another mod or backup is present. Uninstall it first.');
        if (!old && await exists(path.join(dir, 'app'))) throw Error('An app directory is present. Refusing ambiguous installation.');
        const current = await stage(dir, bundle, onProgress);
        // The installer loader can be inside Electron's app.asar; disk operations
        // on Discord still use original-fs to preserve its physical archives.
        const loader = loaderSource ? await nodeFs.readFile(loaderSource) : null;
        let previousLoader = null;
        if (loader && await exists(loaderPath(dir))) { await regular(loaderPath(dir)); previousLoader = await fs.readFile(loaderPath(dir)); }
        const wrapper = makeAsar(loader ? loaderPath(dir) : path.join(dir, 'mycord-versions', current, 'patcher.js'));
        const originalHash = old?.originalHash ?? await hash(path.join(dir, 'app.asar'));
        const oldWrapper = old ? await fs.readFile(path.join(dir, 'app.asar')) : null;
        if (!old) await fs.rename(path.join(dir, 'app.asar'), path.join(dir, '_app.asar'));
        try {
            onProgress({ stage: 'backup', label: old ? 'Sauvegarde originale conservée et vérifiée.' : 'Archive Discord originale sauvegardée.' });
            onProgress({ stage: 'activate', label: 'Activation du chargeur PulseCord…' });
            if (loader) await atomic(loaderPath(dir), loader);
            await atomic(path.join(dir, 'app.asar'), wrapper);
            const bundleInfo = JSON.parse(await fs.readFile(path.join(bundle, 'bundle.json'), 'utf8'));
            await atomic(path.join(dir, '.mycord.json'), JSON.stringify({ format: 1, current, previous: old?.current === current ? old.previous : old?.current, originalHash, wrapperHash: digest(wrapper), ...(loader ? { loaderHash: digest(loader) } : {}), version: bundleInfo.version }, null, 2));
        } catch (e) {
            if (loader) { if (previousLoader) await atomic(loaderPath(dir), previousLoader); else await fs.rm(loaderPath(dir), { force: true }); }
            if (oldWrapper) await atomic(path.join(dir, 'app.asar'), oldWrapper);
            else { await fs.rm(path.join(dir, 'app.asar'), { force: true }); await fs.rename(path.join(dir, '_app.asar'), path.join(dir, 'app.asar')); }
            throw e;
        }
        onProgress({ stage: 'complete', label: 'PulseCord installé. Les fichiers d’origine sont conservés.' });
        return 'Installed. Start Discord to verify runtime compatibility.';
    });
}
export async function uninstall(resources, onProgress = () => {}) {
    const dir = await checkedResources(resources);
    return locked(dir, async () => {
        await owned(dir);
        onProgress({ stage: 'verify', done: 1, total: 1, label: 'Installation PulseCord et sauvegarde vérifiées.' });
        const wrapper = await fs.readFile(path.join(dir, 'app.asar'));
        await atomic(path.join(dir, 'app.asar'), await fs.readFile(path.join(dir, '_app.asar')));
        try { await fs.unlink(path.join(dir, '.mycord.json')); }
        catch (e) { await atomic(path.join(dir, 'app.asar'), wrapper); throw e; }
        await fs.unlink(path.join(dir, '_app.asar'));
        onProgress({ stage: 'complete', label: 'Client Discord original restauré. Préférences conservées.' });
        return 'Original Discord restored. Settings and version bundles retained.';
    });
}
export async function rollback(resources) {
    const dir = await checkedResources(resources);
    // install revalidates ownership under its own exclusive lock.
    const state = await owned(dir);
    if (!state.previous) throw Error('No previous version available');
    if (state.loaderHash) return activateUpdate(dir, path.join(dir, 'mycord-versions', state.previous));
    return install(dir, path.join(dir, 'mycord-versions', state.previous));
}
export async function getInstallation(resources) {
    const dir = await checkedResources(resources);
    return owned(dir);
}
export async function activateUpdate(resources, bundle) {
    const dir = await checkedResources(resources);
    return locked(dir, async () => {
        const old = await owned(dir);
        if (!old.loaderHash) throw Error('A one-time installer upgrade is required to enable in-app updates');
        const current = await stage(dir, bundle);
        const info = JSON.parse(await fs.readFile(path.join(bundle, 'bundle.json'), 'utf8'));
        await atomic(path.join(dir, '.mycord.json'), JSON.stringify({ ...old, current, previous: old.current === current ? old.previous : old.current, version: info.version }, null, 2));
        return current;
    });
}
export async function discover(platform = process.platform, env = process.env) {
    const candidates = [];
    if (platform === 'win32') {
        for (const name of ['Discord', 'DiscordPTB', 'DiscordCanary', 'DiscordDevelopment']) {
            const root = path.join(env.LOCALAPPDATA || '', name);
            for (const item of await fs.readdir(root).catch(() => [])) if (/^app-\d/.test(item)) candidates.push({ name: `${name} ${item.slice(4)}`, resources: path.join(root, item, 'resources') });
        }
    } else if (platform === 'darwin') {
        for (const base of ['/Applications', path.join(os.homedir(), 'Applications')]) for (const name of ['Discord', 'Discord PTB', 'Discord Canary']) candidates.push({ name, resources: path.join(base, `${name}.app`, 'Contents', 'Resources') });
    } else {
        for (const name of ['discord', 'discord-ptb', 'discord-canary']) for (const base of ['/opt', '/usr/share', '/usr/lib']) candidates.push({ name, resources: path.join(base, name, 'resources') });
    }
    const result = [];
    for (const candidate of candidates) if (await exists(path.join(candidate.resources, 'app.asar'))) result.push({ ...candidate, installed: await exists(path.join(candidate.resources, '.mycord.json')) });
    return result;
}
