// Build, sign and publish an official PulseCord release with GitHub CLI.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, resolve } from 'node:path';
import { sourceFingerprint } from './source-fingerprint.mjs';
import { verifyRelease, verifyDownload } from '../packages/updates/protocol.mjs';

const repo = 'OCHOO339/pulsecord';
const gh = process.env.GH_PATH || (existsSync('.cache/github-cli/bin/gh.exe') ? resolve('.cache/github-cli/bin/gh.exe') : 'gh');
const github = args => execFileSync(gh, args, { encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
const api = (route, args = []) => JSON.parse(github(['api', route, ...args]));
github(['auth', 'status', '--hostname', 'github.com']);

if (!process.argv.includes('--prepared')) {
    for (const task of ['build', 'typecheck', 'test', 'package:installer', 'publish:prepare', 'package:source']) {
        console.log(`PulseCord: ${task}`);
        execFileSync(process.platform === 'win32' ? 'corepack.cmd' : 'corepack', ['pnpm', task], { stdio: 'inherit', shell: process.platform === 'win32', windowsHide: true });
    }
}

const stamp = JSON.parse(await readFile('upstream/equicord/dist/pulsecord-build.json', 'utf8'));
if (stamp.sourceHash !== sourceFingerprint()) throw Error('Rebuild before publishing: source files changed.');
const config = JSON.parse(await readFile('updates.json', 'utf8'));
const envelope = JSON.parse(await readFile('release/updates/pulsecord-update.json', 'utf8'));
const release = verifyRelease(envelope, config.publicKey, process.platform, process.arch);
if (!release.bundleUrl.startsWith(`https://github.com/${repo}/releases/latest/download/`)) throw Error('Unexpected release destination');
const archive = `release/updates/${basename(new URL(release.bundleUrl).pathname)}`;
verifyDownload(await readFile(archive), release);
const bundle = JSON.parse(await readFile('dist/bundle/bundle.json', 'utf8'));
for (const [name, expected] of Object.entries(bundle.files)) {
    if (createHash('sha256').update(await readFile(`dist/bundle/${name}`)).digest('hex') !== expected) throw Error(`Bundle changed: ${name}`);
}
const assets = ['release/PulseCord Installer.exe', 'release/PulseCord-source.zip', 'release/updates/pulsecord-update.json', archive];
const local = new Map();
for (const file of assets) {
    const bytes = await readFile(file);
    // GitHub normalizes spaces in uploaded asset names to periods.
    local.set(basename(file).replaceAll(' ', '.'), { file, size: bytes.length, digest: `sha256:${createHash('sha256').update(bytes).digest('hex')}` });
}
const repository = api(`repos/${repo}`);
if (repository.private) throw Error('The updater requires publicly downloadable release assets.');
if (!repository.permissions?.push) throw Error('This GitHub account cannot publish to the selected repository.');
const branches = api(`repos/${repo}/branches`);
if (!branches.length) {
    await mkdir('.cache/publisher', { recursive: true });
    const readme = '# PulseCord\n\nPulseCord is an independent Discord modification based on Equicord and Vencord.\n\nDownload the installer and the complete corresponding source from [Releases](https://github.com/OCHOO339/pulsecord/releases/latest).\n\nThe client verifies official update packages with the embedded Ed25519 public key.\n\nThe combined distribution is licensed under GNU GPLv3. Individual GPL-3.0-or-later notices retain their permissions. Original author credits and licenses are included in the source archive.\n';
    await writeFile('.cache/publisher/initial-readme.json', JSON.stringify({ message: 'Initialize PulseCord releases', content: Buffer.from(readme).toString('base64'), branch: repository.default_branch }));
    api(`repos/${repo}/contents/README.md`, ['--method', 'PUT', '--input', '.cache/publisher/initial-readme.json']);
}

const tag = `pulsecord-${stamp.sourceHash.slice(0, 12)}-${release.bundleId.slice(0, 8)}`;
const getRelease = () => api(`repos/${repo}/releases?per_page=100`).find(value => value.tag_name === tag);
async function waitForRelease(ready) {
    for (let attempt = 0; attempt < 15; attempt++) {
        const value = getRelease();
        if (value && ready(value)) return value;
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    throw Error('GitHub release metadata is not available yet. Rerun with --prepared to resume.');
}
let draft = getRelease();
if (!draft) {
    github(['release', 'create', tag, '--repo', repo, '--draft', '--title', 'PulseCord', '--notes-file', 'CHANGELOG.md', '--target', repository.default_branch]);
    draft = await waitForRelease(() => true);
}
for (const [name, expected] of local) {
    const existing = draft.assets.find(asset => asset.name === name);
    if (existing) {
        if (existing.size !== expected.size || existing.digest && existing.digest !== expected.digest) throw Error(`Existing release asset differs: ${name}`);
    } else {
        if (!draft.draft) throw Error('A published release is missing an expected asset.');
        console.log(`Uploading ${name}`);
        github(['release', 'upload', tag, expected.file, '--repo', repo]);
    }
}
const uploaded = await waitForRelease(value => [...local.keys()].every(name => value.assets.some(asset => asset.name === name)));
for (const [name, expected] of local) {
    const asset = uploaded.assets.find(asset => asset.name === name);
    if (!asset || asset.size !== expected.size || asset.digest && asset.digest !== expected.digest) throw Error(`Uploaded asset verification failed: ${name}`);
}
if (uploaded.draft) github(['release', 'edit', tag, '--repo', repo, '--draft=false', '--latest']);

let verified = false;
for (let attempt = 0; attempt < 15; attempt++) {
    const response = await fetch(config.manifestUrl, { headers: { 'User-Agent': 'PulseCord Publisher', 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(30000) });
    if (response.ok) {
        const publicRelease = verifyRelease(await response.json(), config.publicKey, process.platform, process.arch);
        if (publicRelease.bundleId === release.bundleId) {
            const payload = await fetch(publicRelease.bundleUrl, { signal: AbortSignal.timeout(60000) });
            if (!payload.ok) throw Error(`Published download returned ${payload.status}`);
            verifyDownload(Buffer.from(await payload.arrayBuffer()), publicRelease);
            verified = true; break;
        }
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
}
if (!verified) throw Error('Release published, but public updater URL verification is still pending.');
console.log(`Published and independently verified: https://github.com/${repo}/releases/tag/${tag}`);
