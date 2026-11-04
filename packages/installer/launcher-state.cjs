// SPDX-License-Identifier: GPL-3.0
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const digest = value => createHash('sha256').update(value).digest('hex');
async function checkedRoot(root) {
    root = path.resolve(root); await fs.mkdir(root, { recursive: true });
    if (await fs.realpath(root) !== root) throw Error('Le cache du lanceur est redirigé.');
    return root;
}
async function readSavedBundle(root) {
    root = await checkedRoot(root);
    const pointer = JSON.parse(await fs.readFile(path.join(root, 'current.json'), 'utf8').catch(error => { if (error.code === 'ENOENT') return 'null'; throw error; }));
    if (!pointer) return undefined;
    if (!/^[a-f0-9]{64}$/.test(pointer.current)) throw Error('Version du lanceur invalide.');
    const directory = path.join(root, pointer.current);
    if ((await fs.lstat(directory)).isSymbolicLink()) throw Error('Bundle du lanceur redirigé.');
    return directory;
}
async function saveBundle(source, root) {
    root = await checkedRoot(root);
    const manifest = JSON.parse(await fs.readFile(path.join(source, 'bundle.json'), 'utf8'));
    const files = Object.entries(manifest.files || {}).sort(([a], [b]) => a.localeCompare(b));
    if (manifest.format !== 1 || !manifest.files?.['patcher.js'] || files.length > 64) throw Error('Bundle du lanceur invalide.');
    const id = digest(JSON.stringify(files));
    const previous = await readSavedBundle(root);
    if (previous === path.join(root, id)) return previous;
    const lock = await fs.open(path.join(root, '.lock'), 'wx');
    let stage;
    try {
        stage = await fs.mkdtemp(path.join(root, 'stage-')); let total = 0;
        for (const [name, hash] of files) {
            if (!/^[\w.-]+\.(js|css|map|txt)$/.test(name) || !/^[a-f0-9]{64}$/.test(hash)) throw Error('Fichier du lanceur invalide.');
            const file = path.join(source, name); const stat = await fs.lstat(file);
            total += stat.size;
            if (!stat.isFile() || stat.isSymbolicLink() || total > 256 * 1024 * 1024) throw Error('Bundle trop volumineux ou redirigé.');
            const bytes = await fs.readFile(file);
            if (digest(bytes) !== hash) throw Error('Intégrité du bundle incorrecte.');
            await fs.writeFile(path.join(stage, name), bytes, { flag: 'wx' });
        }
        await fs.writeFile(path.join(stage, 'bundle.json'), JSON.stringify(manifest));
        const target = path.join(root, id);
        const existing = await fs.lstat(target).catch(error => { if (error.code !== 'ENOENT') throw error; });
        if (existing) {
            if (!existing.isDirectory() || existing.isSymbolicLink()) throw Error('Cache du lanceur invalide.');
            for (const [name, hash] of files) if (digest(await fs.readFile(path.join(target, name))) !== hash) throw Error('Cache du lanceur corrompu.');
        } else { await fs.rename(stage, target); stage = undefined; }
        const temporary = path.join(root, `pointer-${randomUUID()}.tmp`);
        try { await fs.writeFile(temporary, JSON.stringify({ current: id })); await fs.rename(temporary, path.join(root, 'current.json')); }
        finally { await fs.rm(temporary, { force: true }); }
        // Keep the current and previous recovery bundles, never traverse links.
        for (const entry of await fs.readdir(root, { withFileTypes: true })) {
            const candidate = path.resolve(root, entry.name);
            if (/^[a-f0-9]{64}$/.test(entry.name) && entry.isDirectory() && !entry.isSymbolicLink() && candidate !== target && candidate !== previous && path.dirname(candidate) === root) await fs.rm(candidate, { recursive: true, force: true });
        }
        return target;
    } finally {
        try { if (stage && path.dirname(path.resolve(stage)) === root && path.basename(stage).startsWith('stage-')) await fs.rm(stage, { recursive: true, force: true }); }
        finally { await lock.close(); await fs.unlink(path.join(root, '.lock')); }
    }
}
module.exports = { saveBundle, readSavedBundle };
