import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';

export async function prepareWindowsTools() {
    const cache = resolve('.cache/electron-builder');
    const archive = join(cache, 'winCodeSign-2.6.0.7z');
    const target = join(cache, 'winCodeSign', 'winCodeSign-2.6.0');
    await mkdir(target, { recursive: true });
    let data;
    try { data = await readFile(archive); } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        const response = await fetch('https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-2.6.0/winCodeSign-2.6.0.7z');
        if (!response.ok) throw Error(`Windows tools download failed: ${response.status}`);
        data = Buffer.from(await response.arrayBuffer());
    }
    if (createHash('sha256').update(data).digest('hex') !== 'cdaec7154dda7cc31f88d886e2489379a0625a737d610b5ae7f62a12f16743a4') throw Error('Windows resource tools checksum mismatch');
    await writeFile(archive, data);
    const requireBuilder = createRequire(createRequire(import.meta.url).resolve('electron-builder'));
    const requireAppBuilder = createRequire(requireBuilder.resolve('app-builder-lib/package.json'));
    const result = spawnSync(requireAppBuilder('7zip-bin').path7za, ['x', '-y', archive, `-o${target}`, '-x!darwin', '-x!linux'], { encoding: 'utf8', windowsHide: true });
    if (result.status !== 0) throw Error(result.stderr || 'Windows resource tools extraction failed');
    return cache;
}
