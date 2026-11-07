// SPDX-License-Identifier: GPL-3.0
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const fs = (process.versions.electron ? require('original-fs') : require('node:fs')).promises;
const { saveBundle, readSavedBundle } = require('./launcher-state.cjs');
function compareVersions(a, b) {
    const av = path.basename(path.dirname(a.resources)).slice(4).split('.').map(Number);
    const bv = path.basename(path.dirname(b.resources)).slice(4).split('.').map(Number);
    for (let i = 0; i < Math.max(av.length, bv.length); i++) { const delta = (bv[i] || 0) - (av[i] || 0); if (delta) return delta; }
    return 0;
}
async function launchDiscord({ core, lifecycle, bundle, loader, localAppData, channel = 'Discord' }) {
    if (!['Discord', 'DiscordPTB', 'DiscordCanary', 'DiscordDevelopment'].includes(channel)) throw Error('Canal Discord invalide.');
    const root = path.resolve(localAppData, channel);
    const candidates = (await core.discover()).filter(target => path.dirname(path.dirname(path.resolve(target.resources))) === root && /^app-\d+(?:\.\d+)*$/.test(path.basename(path.dirname(target.resources)))).sort(compareVersions);
    const target = candidates[0];
    const stateDirectory = path.resolve(localAppData, 'PulseCord', 'bundles', channel);
    if (!target) throw Error('Discord est introuvable. Installe Discord avant de lancer PulseCord.');
    if (target.installed) {
        const state = await core.getInstallation(target.resources);
        if (!/^[a-f0-9]{64}$/.test(state.current)) throw Error('Version PulseCord invalide.');
        await saveBundle(path.join(target.resources, 'mycord-versions', state.current), stateDirectory).catch(error => console.warn('[PulseCord] Recovery cache unavailable', error));
        await lifecycle.start({ executable: await lifecycle.findExecutable(target.resources) });
        return { repaired: false, target: target.name };
    }
    // Prefer the user's most recently installed bundle over an older installer.
    // The ownership checks and core.install validate all files before activation.
    const savedBundle = await readSavedBundle(stateDirectory);
    let selectedBundle = savedBundle || bundle;
    for (const old of savedBundle ? [] : candidates.slice(1)) {
        if (!old.installed) continue;
        const state = await core.getInstallation(old.resources);
        if (!/^[a-f0-9]{64}$/.test(state.current)) throw Error('Version PulseCord précédente invalide.');
        selectedBundle = await saveBundle(path.join(old.resources, 'mycord-versions', state.current), stateDirectory);
        break;
    }
    const sessions = [];
    try {
        for (const item of candidates) sessions.push(await lifecycle.stop(item));
        await core.install(target.resources, selectedBundle, loader);
        await saveBundle(selectedBundle, stateDirectory).catch(error => console.warn('[PulseCord] Recovery cache unavailable', error));
        await lifecycle.start({ executable: await lifecycle.findExecutable(target.resources) });
        return { repaired: true, target: target.name };
    } catch (error) {
        for (const session of sessions) if (session.wasRunning) await lifecycle.start(session).catch(() => {});
        throw error;
    }
}
async function installLauncher({ source, destination, desktop, shell, channel = 'Discord', runtimeDirectory }) {
    if (!['Discord', 'DiscordPTB', 'DiscordCanary', 'DiscordDevelopment'].includes(channel)) throw Error('Canal Discord invalide.');
    const target = path.join(path.resolve(destination), 'PulseCord Launcher.exe');
    await fs.mkdir(path.dirname(target), { recursive: true });
    if (await fs.realpath(path.dirname(target)) !== path.dirname(target)) throw Error('Le dossier du lanceur est redirigé.');
    if (path.resolve(source).toLowerCase() !== target.toLowerCase()) {
        const stat = await fs.lstat(source);
        if (!stat.isFile() || stat.isSymbolicLink()) throw Error('Exécutable du lanceur invalide.');
        // Avoid following an existing redirected destination.
        const existing = await fs.lstat(target).catch(error => { if (error.code !== 'ENOENT') throw error; });
        if (existing?.isSymbolicLink()) throw Error('Le chemin du lanceur est redirigé.');
        if (runtimeDirectory) {
            const runtime = path.resolve(runtimeDirectory);
            if (path.dirname(path.resolve(source)) !== runtime || runtime === path.dirname(target)) throw Error('Runtime du lanceur invalide.');
            for (const entry of await fs.readdir(runtime, { withFileTypes: true })) {
                const from = path.join(runtime, entry.name);
                const to = entry.name === path.basename(source) ? target : path.join(path.dirname(target), entry.name);
                if (path.dirname(to) !== path.dirname(target)) throw Error('Destination du lanceur invalide.');
                async function copyRuntime(src, dest) {
                    const sourceStat = await fs.lstat(src);
                    if (sourceStat.isSymbolicLink()) throw Error('Runtime redirigé.');
                    const existingTarget = await fs.lstat(dest).catch(error => { if (error.code !== 'ENOENT') throw error; });
                    if (existingTarget?.isSymbolicLink()) throw Error('Destination du runtime redirigée.');
                    if (sourceStat.isDirectory()) {
                        await fs.mkdir(dest, { recursive: true });
                        for (const item of await fs.readdir(src)) await copyRuntime(path.join(src, item), path.join(dest, item));
                    } else if (sourceStat.isFile()) {
                        // Never truncate an archive that a launcher may be opening.
                        // A failed copy keeps the previously working file intact.
                        const temporary = dest + '.' + randomUUID() + '.pulsecord-tmp';
                        try {
                            await fs.copyFile(src, temporary);
                            if (path.basename(src) === 'app.asar') {
                                const hash = bytes => createHash('sha256').update(bytes).digest('hex');
                                if (hash(await fs.readFile(src)) !== hash(await fs.readFile(temporary))) throw Error('La copie de l’archive du lanceur est incomplète.');
                            }
                            await fs.rename(temporary, dest);
                        } finally { await fs.rm(temporary, { force: true }); }
                    }
                    else throw Error('Fichier du runtime invalide.');
                }
                await copyRuntime(from, to);
            }
        } else await fs.copyFile(source, target);
    }
    const shortcut = path.join(desktop, 'PulseCord.lnk');
    if (!shell.writeShortcutLink(shortcut, 'create', { target, args: `--launch --channel=${channel}`, cwd: path.dirname(target), description: 'Lancer Discord avec réparation automatique de PulseCord', icon: target, iconIndex: 0 })) throw Error('Impossible de créer le raccourci PulseCord.');
    return { target, shortcut };
}
module.exports = { launchDiscord, installLauncher, compareVersions };
