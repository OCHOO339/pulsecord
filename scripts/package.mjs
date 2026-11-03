import { mkdir, readdir, copyFile, readFile, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { sourceFingerprint } from './source-fingerprint.mjs';
const stamp = JSON.parse(await readFile('upstream/equicord/dist/pulsecord-build.json', 'utf8'));
if (stamp.sourceHash !== sourceFingerprint()) throw Error('Source changed since the last successful build. Rebuild before packaging.');
const target = resolve('dist/bundle');
if (!target.startsWith(resolve('dist') + sep)) throw Error('Invalid build output directory');
await rm(target, { recursive: true, force: true });
await mkdir('dist/bundle', { recursive: true });
const files = {};
for (const name of await readdir('upstream/equicord/dist/desktop')) {
    if (!/^[\w.-]+\.(js|css|map|txt)$/.test(name)) continue;
    const data = await readFile('upstream/equicord/dist/desktop/' + name);
    files[name] = createHash('sha256').update(data).digest('hex');
    await copyFile('upstream/equicord/dist/desktop/' + name, 'dist/bundle/' + name);
}
for (const required of ['patcher.js', 'preload.js', 'renderer.js', 'renderer.css']) if (!files[required]) throw Error(`Missing build output ${required}`);
const brand = JSON.parse(await readFile('brand.json', 'utf8'));
await writeFile('dist/bundle/bundle.json', JSON.stringify({ format: 1, version: brand.version, files }, null, 2));
await copyFile('packages/updates/loader.cjs', 'packages/installer/loader.cjs');
console.log('Prepared local bundle with SHA-256 manifest (integrity, not publisher authentication).');
