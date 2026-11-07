// Publish one release only after both platform builds have passed.
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {basename,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {verifyRelease,verifyDownload} from '../packages/updates/protocol.mjs';
const repo=process.env.GH_REPO||'OCHOO339/pulsecord';
if(repo!=='OCHOO339/pulsecord')throw Error('Unexpected publication repository');
const gh=args=>execFileSync('gh',args,{encoding:'utf8',stdio:['ignore','pipe','inherit'],maxBuffer:4*1024*1024,windowsHide:true});
const config=JSON.parse(await readFile('updates.json','utf8'));
const assets=['release-artifacts/windows/PulseCord Installer.exe','release-artifacts/windows/PulseCord-source.zip','release-artifacts/linux/PulseCord Installer-linux-x64.AppImage','release-artifacts/linux/PulseCord Installer-linux-x64.tar.gz'];
for(const [platform,folder,name] of [['win32','windows','pulsecord-update.json'],['linux','linux','pulsecord-update-linux-x64.json']]){
    const manifest=`release-artifacts/${folder}/updates/${name}`;
    const release=verifyRelease(JSON.parse(await readFile(manifest,'utf8')),config.publicKey,platform,'x64');
    const archive=`release-artifacts/${folder}/updates/${basename(new URL(release.bundleUrl).pathname)}`;
    verifyDownload(await readFile(archive),release);assets.push(manifest,archive);
}
const expected=new Map();
for(const file of assets){const bytes=await readFile(file);expected.set(basename(file).replaceAll(' ','.'),{size:bytes.length,digest:'sha256:'+createHash('sha256').update(bytes).digest('hex')});}
if(!/^\d+$/.test(process.env.GITHUB_RUN_NUMBER||'')||!/^\d+$/.test(process.env.GITHUB_RUN_ATTEMPT||'')||!/^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA||''))throw Error('Invalid CI release identity');
const tag=`pulsecord-build-${process.env.GITHUB_RUN_NUMBER}-${process.env.GITHUB_RUN_ATTEMPT}`;
const url=gh(['release','create',tag,...assets.map(file=>resolve(file)),'--repo',repo,'--draft','--title','PulseCord','--notes-file','release-artifacts/windows/RELEASE-NOTES.md','--target',process.env.GITHUB_SHA]).trim();
const metadata=JSON.parse(gh(['api',`repos/${repo}/releases/tags/${tag}`]));
for(const [name,entry] of expected){const asset=metadata.assets.find(asset=>asset.name===name);if(!asset||asset.size!==entry.size||asset.digest!==entry.digest)throw Error('Uploaded release asset verification failed: '+name);}
gh(['release','edit',tag,'--repo',repo,'--draft=false','--latest']);
console.log('Published Windows and Linux release: '+url);
