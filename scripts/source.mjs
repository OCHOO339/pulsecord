// Complete corresponding source, including pinned public Git objects for offline prepare.
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const require = createRequire(new URL('../upstream/equicord/package.json', import.meta.url));
const { zipSync } = require('fflate');
const files = {};
async function add(file) { files[file.replaceAll('\\', '/')] = new Uint8Array(await readFile(file)); }
async function tree(dir) { for (const entry of await readdir(dir, { withFileTypes: true })) { const name = `${dir}/${entry.name}`; if (entry.isDirectory()) await tree(name); else if (entry.isFile()) await add(name); } }
for (const dir of ['packages', 'scripts', 'tests', 'themes', 'docs', 'site', 'assets', '.github']) await tree(dir);
for (const file of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'brand.json', 'updates.json', 'upstream.lock.json', 'pulse.png', 'LICENSE', 'NOTICE.md', 'README.md', 'CHANGELOG.md', '.gitignore']) await add(file);
const lock = JSON.parse(await readFile('upstream.lock.json', 'utf8'));
for (const [name, entry] of Object.entries(lock)) {
    const dir = `upstream/${name}`;
    const tracked = execFileSync('git', ['-c', `safe.directory=${resolve(dir).replaceAll('\\', '/')}`, '-C', dir, 'ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
    for (const file of tracked) await add(`${dir}/${file}`);
    for (const folder of ['objects', 'refs']) await tree(`${dir}/.git/${folder}`);
    for (const file of ['HEAD', 'index', 'shallow', 'packed-refs']) { try { await add(`${dir}/.git/${file}`); } catch (e) { if (e.code !== 'ENOENT') throw e; } }
    files[`${dir}/.git/config`] = new TextEncoder().encode(`[core]\nrepositoryformatversion = 0\nbare = false\n[remote "origin"]\nurl = ${entry.url}\nfetch = +refs/heads/*:refs/remotes/origin/*\n`);
}
await tree('upstream/equicord/src/userplugins');
await mkdir('release', { recursive: true });
const brand = JSON.parse(await readFile('brand.json', 'utf8'));
await writeFile(`release/${brand.name}-source.zip`, zipSync(files, { level: 6 }));
console.log(`Archived ${Object.keys(files).length} source files. No dependencies or personal settings included.`);
