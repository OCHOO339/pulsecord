import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

test('IOSEmojis renders standard emoji, shapes Unicode sequences and restores defaults', { timeout: 60000 }, async () => {
    const require = createRequire(import.meta.url);
    const env = { ...process.env };
    env.PULSECORD_TEST_ESBUILD = createRequire(new URL('../upstream/equicord/package.json', import.meta.url)).resolve('esbuild');
    delete env.ELECTRON_RUN_AS_NODE;
    const { stdout } = await promisify(execFile)(require('electron'), ['tests/ios-emojis.cjs', '--disable-gpu'], { env, windowsHide: true, timeout: 55000, maxBuffer: 1024 * 1024 });
    assert.match(stdout, /font shaping and clean disable verified/);
});
