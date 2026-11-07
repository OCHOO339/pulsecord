// SPDX-License-Identifier: GPL-3.0
const path = require('node:path');
const { promisify } = require('node:util');
const { execFile, spawn } = require('node:child_process');
const fs = (process.versions.electron ? require('original-fs') : require('node:fs')).promises;
const execute = promisify(execFile);
const names = ['Discord.exe', 'DiscordPTB.exe', 'DiscordCanary.exe', 'DiscordDevelopment.exe'];

async function findExecutable(resources, platform = process.platform) {
    const directory = platform === 'darwin' ? path.join(path.dirname(path.resolve(resources)), 'MacOS') : path.dirname(path.resolve(resources));
    if (await fs.realpath(directory) !== directory) throw Error('Chemin Discord redirigé non pris en charge.');
    for (const name of platform === 'darwin' ? ['Discord', 'Discord PTB', 'Discord Canary', 'Discord Development', 'DiscordPTB', 'DiscordCanary'] : names) {
        const executable = path.join(directory, name);
        try {
            const stat = await fs.lstat(executable);
            if (stat.isFile() && !stat.isSymbolicLink()) return executable;
        } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    throw Error('Exécutable Discord introuvable à côté du dossier resources.');
}

function stopScript(executable) {
    const literal = executable.replaceAll("'", "''");
    return `$ErrorActionPreference = 'Stop'
$discordProcesses = @(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -ieq '${literal}' })
foreach ($discordEntry in $discordProcesses) {
    $discordProcess = Get-Process -Id $discordEntry.ProcessId -ErrorAction SilentlyContinue
    if ($null -ne $discordProcess -and -not $discordProcess.HasExited) {
        Stop-Process -InputObject $discordProcess -Force -ErrorAction Stop
        if (-not $discordProcess.WaitForExit(15000)) { throw 'Discord ne se ferme pas.' }
    }
}
Write-Output $discordProcesses.Count`;
}

async function stop(target) {
    if (process.platform === 'linux' && target.kind === 'flatpak') return require('./linux-flatpak.cjs').stopFlatpak(target);
    if (process.platform === 'linux') throw Error('Cette version Linux prend en charge Discord Flatpak. Sélectionnez son installation détectée automatiquement.');
    if (process.platform === 'darwin') return stopMac(target);
    if (process.platform !== 'win32') throw Error('La fermeture automatique est actuellement disponible sous Windows.');
    const executable = await findExecutable(target.resources);
    const script = Buffer.from(stopScript(executable), 'utf16le').toString('base64');
    const { stdout } = await execute('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', script], { windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024 });
    return { executable, wasRunning: Number(stdout.trim()) > 0 };
}

async function stopMac(target) {
    const executable = await findExecutable(target.resources, 'darwin');
    async function pids() {
        const { stdout } = await execute('ps', ['-axww', '-o', 'pid=', '-o', 'comm='], { timeout: 10000, maxBuffer: 4 * 1024 * 1024 });
        return stdout.split('\n').flatMap(line => {
            const match = /^\s*(\d+)\s+(.+?)\s*$/.exec(line);
            return match && match[2] === executable ? [Number(match[1])] : [];
        });
    }
    const initial = await pids();
    async function signal(kind) {
        for (const pid of await pids()) {
            try { process.kill(pid, kind); } catch (error) { if (error.code !== 'ESRCH') throw error; }
        }
    }
    if (initial.length) {
        await signal('SIGTERM');
        const deadline = Date.now() + 15000;
        while ((await pids()).length) {
            if (Date.now() >= deadline) throw Error('Discord ne se ferme pas.');
            if (Date.now() >= deadline - 10000) await signal('SIGKILL');
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    return { executable, wasRunning: initial.length > 0 };
}

async function start(session) {
    if (process.platform === 'linux' && session.flatpakId) return require('./linux-flatpak.cjs').startFlatpak(session);
    await new Promise((resolve, reject) => {
        const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
        const child = spawn(session.executable, [], { cwd: path.dirname(session.executable), detached: true, stdio: 'ignore', windowsHide: false, env });
        child.once('error', reject);
        child.once('spawn', () => { child.unref(); resolve(); });
    });
}

module.exports = { stop, start, findExecutable, stopScript };
