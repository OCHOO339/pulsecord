import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import lifecycle from '../packages/installer/discord-process.cjs';

test('Windows shutdown terminates only the selected executable path', { skip: process.platform !== 'win32', timeout: 45000 }, async () => {
    const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'pulsecord-process-test-')));
    const children = [];
    try {
        for (const name of ['selected', 'unrelated']) {
            const directory = path.join(root, name);
            await fs.mkdir(directory);
            const executable = path.join(directory, 'Discord.exe');
            await fs.copyFile(process.execPath, executable);
            const child = spawn(executable, ['-e', 'process.stdout.write("ready");setInterval(()=>{},1000)'], { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
            children.push(child);
            await once(child.stdout, 'data');
        }
        const exited = once(children[0], 'exit');
        const session = await lifecycle.stop({ resources: path.join(root, 'selected', 'resources') });
        await exited;
        assert.equal(session.wasRunning, true);
        assert.equal(session.executable, path.join(root, 'selected', 'Discord.exe'));
        assert.equal(children[1].exitCode, null);
        assert.doesNotThrow(() => process.kill(children[1].pid, 0));
    } finally {
        for (const child of children) if (child.exitCode === null && child.signalCode === null) {
            const exited = once(child, 'exit'); child.kill(); await exited;
        }
        await fs.rm(root, { recursive: true, force: true });
    }
});
