// SPDX-License-Identifier: GPL-3.0
const path = require('node:path');
const { promisify } = require('node:util');
const { execFile, spawn } = require('node:child_process');
const fs = (process.versions.electron ? require('original-fs') : require('node:fs')).promises;
const execute = promisify(execFile);
const names = ['Discord.exe', 'DiscordPTB.exe', 'DiscordCanary.exe', 'DiscordDevelopment.exe'];

async function findExecutable(resources) {
    const directory = path.dirname(path.resolve(resources));
    if (await fs.realpath(directory) !== directory) throw Error('Chemin Discord redirigé non pris en charge.');
    for (const name of names) {
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
    if (process.platform !== 'win32') throw Error('La fermeture automatique est actuellement disponible sous Windows.');
    const executable = await findExecutable(target.resources);
    const script = Buffer.from(stopScript(executable), 'utf16le').toString('base64');
    const { stdout } = await execute('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', script], { windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024 });
    return { executable, wasRunning: Number(stdout.trim()) > 0 };
}

async function start(session) {
    await new Promise((resolve, reject) => {
        const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
        const child = spawn(session.executable, [], { cwd: path.dirname(session.executable), detached: true, stdio: 'ignore', windowsHide: false, env });
        child.once('error', reject);
        child.once('spawn', () => { child.unref(); resolve(); });
    });
}

module.exports = { stop, start, findExecutable, stopScript };
