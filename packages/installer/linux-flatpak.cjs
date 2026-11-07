// SPDX-License-Identifier: GPL-3.0
const path = require('node:path');
const os = require('node:os');
const { promisify } = require('node:util');
const { execFile, spawn } = require('node:child_process');
const { randomUUID, createHash } = require('node:crypto');
const fs = (process.versions.electron ? require('original-fs') : require('node:fs')).promises;
const execute = promisify(execFile);
const appIds = ['com.discordapp.Discord', 'com.discordapp.DiscordPTB', 'com.discordapp.DiscordCanary'];
function paths(appId, commit, home = os.homedir()) {
    if (!appIds.includes(appId) || !/^[a-f0-9]{64}$/.test(commit)) throw Error('Installation Flatpak invalide.');
    const dataRoot = path.resolve(home, '.var', 'app', appId, 'data', 'pulsecord');
    const runtime = path.join(dataRoot, 'runtimes', commit);
    return { dataRoot, runtime, resources: path.join(runtime, 'resources') };
}
async function discoverFlatpaks(home = os.homedir(), run = execute) {
    const targets = [];
    for (const appId of appIds) {
        try {
            const options = { timeout: 10000, maxBuffer: 65536 };
            const [{ stdout: location }, { stdout: revision }] = await Promise.all([
                run('flatpak', ['info', '--show-location', appId], options),
                run('flatpak', ['info', '--show-commit', appId], options)
            ]);
            const commit = revision.trim();
            const filesRoot = await fs.realpath(path.join(location.trim(), 'files'));
            const source = await fs.realpath(path.join(filesRoot, 'discord'));
            const managed = paths(appId, commit, home);
            if (!(await fs.stat(path.join(source, 'resources', 'app.asar'))).isFile()) continue;
            const installed = await fs.lstat(path.join(managed.resources, '.mycord.json')).then(s => s.isFile(), e => { if (e.code !== 'ENOENT') throw e; return false; });
            targets.push({ name: `${appId.slice('com.discordapp.'.length)} Flatpak`, kind: 'flatpak', appId, commit, source, filesRoot, home, ...managed, installed });
        } catch (error) {
            if (error.code === 'EACCES' || error.code === 'EPERM') throw error;
            // Missing channels or a missing flatpak command are normal.
        }
    }
    return targets;
}
function validate(target) {
    const expected = paths(target.appId, target.commit, target.home);
    for (const key of ['dataRoot', 'runtime', 'resources']) if (path.resolve(target[key]) !== expected[key]) throw Error('Chemin Flatpak invalide.');
    return expected;
}
async function prepareFlatpakTarget(target, action) {
    const { dataRoot, runtime, resources } = validate(target);
    if (!['install', 'repair'].includes(action)) return;
    const runtimes = path.join(dataRoot, 'runtimes');
    await fs.mkdir(runtimes, { recursive: true });
    if (await fs.realpath(runtimes) !== runtimes) throw Error('Le dossier PulseCord est redirigé.');
    const existing = await fs.lstat(runtime).catch(e => { if (e.code !== 'ENOENT') throw e; });
    if (existing) {
        if (existing.isSymbolicLink() || !existing.isDirectory()) throw Error('Runtime Flatpak redirigé.');
        const marker = JSON.parse(await fs.readFile(path.join(runtime, '.pulsecord-runtime.json'), 'utf8'));
        if (marker.appId !== target.appId || marker.commit !== target.commit) throw Error('Ce dossier appartient à une autre installation.');
    } else {
        const source = await fs.realpath(target.source);
        const filesRoot = await fs.realpath(target.filesRoot || path.dirname(source));
        const withinFiles = file => file === filesRoot || file.startsWith(filesRoot + path.sep);
        if (!withinFiles(source)) throw Error('Source Flatpak hors de son déploiement.');
        const stage = await fs.mkdtemp(path.join(runtimes, '.stage-'));
        try {
            // The source is the installed, immutable Flatpak deployment. Preserve
            // its sandbox-internal symlinks without following them on the host.
            async function copyRuntime(from, to, ancestors = new Set()) {
                const stat = await fs.lstat(from);
                if (stat.isSymbolicLink()) {
                    const link = await fs.readlink(from);
                    const mapped = link.startsWith('/app/') ? path.join(filesRoot, link.slice(5)) : path.isAbsolute(link) ? undefined : path.resolve(path.dirname(from), link);
                    const resolved = mapped ? await fs.realpath(mapped).catch(error => { if (error.code !== 'ENOENT') throw error; }) : undefined;
                    // Flatpak may link its executable to ../extra or /app/extra.
                    // Materialize deployment-owned links; retain runtime/data links.
                    if (resolved && withinFiles(resolved)) await copyRuntime(resolved, to, ancestors);
                    else await fs.symlink(link, to);
                }
                else if (stat.isDirectory()) {
                    const physical = await fs.realpath(from);
                    if (ancestors.has(physical)) throw Error('Boucle de liens dans Discord Flatpak.');
                    const parents = new Set(ancestors); parents.add(physical);
                    await fs.mkdir(to, { recursive: true, mode: (stat.mode & 0o777) | 0o700 });
                    for (const name of await fs.readdir(from)) await copyRuntime(path.join(from, name), path.join(to, name), parents);
                } else if (stat.isFile()) {
                    await fs.copyFile(from, to); await fs.chmod(to, stat.mode & 0o777);
                } else throw Error('Fichier Discord Flatpak non pris en charge.');
            }
            await copyRuntime(source, stage);
            await fs.writeFile(path.join(stage, '.pulsecord-runtime.json'), JSON.stringify({ appId: target.appId, commit: target.commit }), { flag: 'wx' });
            if (!(await fs.lstat(path.join(stage, 'resources', 'app.asar'))).isFile()) throw Error('Archive Discord Flatpak absente.');
            await fs.rename(stage, runtime);
        } finally {
            const absolute = path.resolve(stage);
            if (path.dirname(absolute) !== runtimes || !path.basename(absolute).startsWith('.stage-')) throw Error('Zone temporaire invalide.');
            await fs.rm(absolute, { recursive: true, force: true });
        }
    }
    if (await fs.realpath(resources) !== resources) throw Error('Ressources Flatpak redirigées.');
    const bin = path.join(dataRoot, 'bin'); await fs.mkdir(bin, { recursive: true });
    if (await fs.realpath(bin) !== bin) throw Error('Dossier de lancement redirigé.');
    // Zypak's documented runtime-directory slot exposes exactly this directory
    // read-only to nested sandboxes (Launcher::Run -> ExposePathRo). Without it
    // the zygote cannot execute a binary outside /app. No user data is exposed.
    const shim = `#!/bin/sh\n# PulseCord: retain the official Flatpak wrapper and its sandbox.\nif [ "$1" = "/app/discord/Discord" ]; then\n  shift\n  export ZYPAK_EXPOSE_WIDEVINE_PATH="$XDG_DATA_HOME/pulsecord/runtimes/${target.commit}"\n  exec /app/bin/zypak-wrapper "$XDG_DATA_HOME/pulsecord/runtimes/${target.commit}/Discord" "$@"\nfi\nexec /app/bin/zypak-wrapper "$@"\n`;
    const temporary = path.join(bin, '.zypak-' + randomUUID());
    try { await fs.writeFile(temporary, shim, { mode: 0o755, flag: 'wx' }); await fs.rename(temporary, path.join(bin, 'zypak-wrapper')); }
    finally { await fs.rm(temporary, { force: true }); }
}
function flatpakRunArgs(appId, modified) {
    if (!appIds.includes(appId)) throw Error('Canal Flatpak invalide.');
    return modified
        ? ['run', '--command=sh', appId, '-c', `export PATH="$XDG_DATA_HOME/pulsecord/bin:$PATH"; exec /app/bin/${appId} "$@"`, 'pulsecord']
        : ['run', appId];
}
async function stopFlatpak(target, run = execute) {
    validate(target);
    const { stdout } = await run('flatpak', ['ps', '--columns=application'], { timeout: 10000, maxBuffer: 65536 });
    const wasRunning = stdout.split(/\r?\n/).some(line => line.trim() === target.appId);
    if (wasRunning) {
        await run('flatpak', ['kill', target.appId], { timeout: 20000, maxBuffer: 65536 });
        const deadline = Date.now() + 15000;
        for (;;) {
            const { stdout: remaining } = await run('flatpak', ['ps', '--columns=application'], { timeout: 10000, maxBuffer: 65536 });
            if (!remaining.split(/\r?\n/).some(line => line.trim() === target.appId)) break;
            if (Date.now() >= deadline) throw Error('Discord Flatpak ne se ferme pas.');
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    return { flatpakId: target.appId, resources: target.resources, wasRunning };
}
async function startFlatpak(session, options = {}) {
    const modified = await fs.lstat(path.join(session.resources, '.mycord.json')).then(s => s.isFile() && !s.isSymbolicLink(), () => false);
    await new Promise((resolve, reject) => {
        const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
        const child = spawn('flatpak', flatpakRunArgs(session.flatpakId, modified), { detached: true, stdio: options.stdio || 'ignore', env });
        child.once('error', reject); child.once('spawn', () => { child.unref(); resolve(); });
    });
}
function desktopQuote(value) {
    if (/[\0\r\n]/.test(value)) throw Error('Chemin de raccourci invalide.');
    return '"' + value.replaceAll('%', '%%').replace(/[\\"`$]/g, '\\$&') + '"';
}
async function installLinuxLauncher({ source, appImage = true, appId, home = os.homedir(), dataHome, icon }) {
    if (!appIds.includes(appId)) throw Error('Canal Flatpak invalide.');
    const root = path.resolve(dataHome || path.join(home, '.local/share'), 'pulsecord');
    await fs.mkdir(root, { recursive: true });
    if (await fs.realpath(root) !== root) throw Error('Dossier du lanceur redirigé.');
    let target = path.resolve(source);
    if (appImage) {
        target = path.join(root, 'PulseCord.AppImage');
        if (path.resolve(source) !== target) {
            const stat = await fs.lstat(source); if (!stat.isFile() || stat.isSymbolicLink()) throw Error('AppImage invalide.');
            const temporary = target + '.' + randomUUID();
            try {
                await fs.copyFile(source, temporary);
                const hash = bytes => createHash('sha256').update(bytes).digest('hex');
                if (hash(await fs.readFile(source)) !== hash(await fs.readFile(temporary))) throw Error('Copie du lanceur incomplète.');
                await fs.chmod(temporary, 0o755); await fs.rename(temporary, target);
            } finally { await fs.rm(temporary, { force: true }); }
        }
    }
    const iconPath = path.join(root, 'pulsecord.png'); await fs.writeFile(iconPath, icon);
    const applications = path.resolve(dataHome || path.join(home, '.local/share'), 'applications');
    await fs.mkdir(applications, { recursive: true });
    if (await fs.realpath(applications) !== applications) throw Error('Dossier des applications redirigé.');
    const shortcut = path.join(applications, 'org.pulsecord.Launcher.desktop');
    await fs.writeFile(shortcut, `[Desktop Entry]\nType=Application\nName=PulseCord\nComment=Discord Flatpak avec PulseCord\nExec=${desktopQuote(target)} --launch --flatpak=${appId}\nIcon=${iconPath.replaceAll('\\', '\\\\')}\nTerminal=false\nCategories=Network;InstantMessaging;\n`, { mode: 0o644 });
    return { target, shortcut };
}
async function launchFlatpak({ core, target, bundle, loader }) {
    validate(target);
    const { saveBundle, readSavedBundle } = require('./launcher-state.cjs');
    const cache = path.join(target.dataRoot, 'bundles');
    if (target.installed) {
        const state = await core.getInstallation(target.resources);
        await saveBundle(path.join(target.resources, 'mycord-versions', state.current), cache).catch(() => {});
        await startFlatpak({ flatpakId: target.appId, resources: target.resources });
        return { repaired: false, target: target.name };
    }
    const session = await stopFlatpak(target);
    try {
        const selected = await readSavedBundle(cache) || bundle;
        await prepareFlatpakTarget(target, 'install');
        await core.install(target.resources, selected, loader);
        await saveBundle(selected, cache).catch(() => {});
        await startFlatpak(session); return { repaired: true, target: target.name };
    } catch (error) { if (session.wasRunning) await startFlatpak(session).catch(() => {}); throw error; }
}
module.exports = { appIds, paths, discoverFlatpaks, prepareFlatpakTarget, flatpakRunArgs, stopFlatpak, startFlatpak, desktopQuote, installLinuxLauncher, launchFlatpak };
