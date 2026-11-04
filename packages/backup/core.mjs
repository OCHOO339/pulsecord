// SPDX-License-Identifier: GPL-3.0-or-later
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
const MAX_BYTES = 16 * 1024 * 1024;
function validName(name) {
    if (['settings/settings.json', 'settings/quickCss.css'].includes(name)) return true;
    if (typeof name !== 'string' || name.length > 240 || !name.startsWith('themes/') || !name.endsWith('.css') || /[\\:\0]/.test(name)) return false;
    const parts = name.split('/'); return parts.length <= 6 && parts.every(part => part && part !== '.' && part !== '..');
}
async function destination(root, name) {
    if (!validName(name)) throw Error('Chemin de sauvegarde invalide.');
    root = path.resolve(root);
    const target = path.resolve(root, ...name.split('/'));
    if (!target.startsWith(root + path.sep)) throw Error('Chemin hors de la configuration PulseCord.');
    const parts = path.relative(root, target).split(path.sep);
    let current = root;
    for (const part of ['', ...parts]) {
        if (part) current = path.join(current, part);
        const stat = await fs.lstat(current).catch(error => { if (error.code !== 'ENOENT') throw error; });
        if (stat?.isSymbolicLink()) throw Error('Les chemins de configuration redirigés ne sont pas pris en charge.');
    }
    return target;
}
export function parseBackup(bytes) {
    if (Buffer.byteLength(bytes) > MAX_BYTES) throw Error('Sauvegarde trop volumineuse (16 Mo maximum).');
    const archive = JSON.parse(bytes);
    if (archive.product !== 'PulseCord' || archive.format !== 1 || !Array.isArray(archive.files) || !archive.files.length || archive.files.length > 256) throw Error('Format de sauvegarde PulseCord invalide.');
    const seen = new Set();
    for (const file of archive.files) {
        if (!validName(file.name) || seen.has(file.name) || typeof file.content !== 'string' || Buffer.byteLength(file.content) > 4 * 1024 * 1024) throw Error('Contenu de sauvegarde invalide.');
        seen.add(file.name);
        if (file.name === 'settings/settings.json') {
            const settings = JSON.parse(file.content);
            if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw Error('Réglages invalides.');
            JSON.parse(file.content, (key, value) => { if (['__proto__', 'prototype', 'constructor'].includes(key)) throw Error('Clé de réglage interdite.'); return value; });
        }
    }
    return archive;
}
export async function createBackup(dataDir, backupDir) {
    const names = ['settings/settings.json', 'settings/quickCss.css'];
    let directories = 0;
    async function themes(relative = 'themes', depth = 0) {
        if (depth > 4) return;
        if (++directories > 256) throw Error('Trop de dossiers de thèmes.');
        const directory = await destination(dataDir, relative + '/placeholder.css');
        for (const entry of await fs.readdir(path.dirname(directory), { withFileTypes: true }).catch(error => { if (error.code === 'ENOENT') return []; throw error; })) {
            if (entry.isSymbolicLink()) continue;
            const name = `${relative}/${entry.name}`;
            if (entry.isDirectory()) await themes(name, depth + 1);
            else if (entry.isFile() && name.endsWith('.css')) names.push(name);
            if (names.length > 256) throw Error('Trop de fichiers de thèmes.');
        }
    }
    await themes();
    const files = [];
    let total = 0;
    for (const name of names) {
        const target = await destination(dataDir, name);
        const stat = await fs.stat(target).catch(error => { if (error.code !== 'ENOENT') throw error; });
        if (!stat) continue;
        if (!stat.isFile() || stat.size > 4 * 1024 * 1024) throw Error('Fichier de configuration trop volumineux.');
        total += stat.size;
        if (total > MAX_BYTES) throw Error('Configuration trop volumineuse pour une sauvegarde (16 Mo).');
        files.push({ name, content: await fs.readFile(target, 'utf8') });
    }
    const archive = { product: 'PulseCord', format: 1, createdAt: new Date().toISOString(), files };
    const bytes = JSON.stringify(archive, null, 2); parseBackup(bytes);
    await fs.mkdir(backupDir, { recursive: true });
    const file = path.join(backupDir, `PulseCord-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}.json`);
    await fs.writeFile(file, bytes, { flag: 'wx', mode: 0o600 });
    return { path: file, fileCount: files.length };
}
async function atomic(file, data) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temporary = file + '.' + randomUUID() + '.tmp';
    try { await fs.writeFile(temporary, data, { flag: 'wx', mode: 0o600 }); await fs.rename(temporary, file); }
    finally { await fs.rm(temporary, { force: true }); }
}
export async function restoreBackup(dataDir, backupDir, bytes) {
    const archive = parseBackup(bytes);
    const changes = [];
    // Validate every path before saving or changing anything.
    for (const file of archive.files) {
        const target = await destination(dataDir, file.name);
        const previous = await fs.readFile(target).catch(error => { if (error.code !== 'ENOENT') throw error; });
        changes.push({ target, content: file.content, previous });
    }
    const recovery = await createBackup(dataDir, backupDir);
    const applied = [];
    try {
        for (const change of changes) { await atomic(change.target, change.content); applied.push(change); }
    } catch (error) {
        const failures = [];
        for (const change of applied.reverse()) {
            try { if (change.previous === undefined) await fs.rm(change.target, { force: true }); else await atomic(change.target, change.previous); }
            catch (rollbackError) { failures.push(String(rollbackError)); }
        }
        throw Error(`${error.message}. Copie de récupération : ${recovery.path}${failures.length ? '. Retour arrière incomplet.' : ''}`);
    }
    return { ...recovery, restoredFiles: applied.length };
}
