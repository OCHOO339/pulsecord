import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import * as core from '../packages/installer/core.mjs';
const require=createRequire(import.meta.url);
const {launchDiscord,installLauncher}=require('../packages/installer/launcher.cjs');
const {saveBundle,readSavedBundle}=require('../packages/installer/launcher-state.cjs');
async function fixture(t){
    const root=await fs.realpath(await fs.mkdtemp(path.join(tmpdir(),'pulsecord-launcher-test-')));t.after(()=>fs.rm(root,{recursive:true,force:true}));
    const local=path.join(root,'local');await fs.mkdir(local);
    const loader=new URL('../packages/updates/loader.cjs',import.meta.url);
    async function bundle(name){const directory=path.join(root,name);await fs.mkdir(directory);const code=`// ${name}`;await fs.writeFile(path.join(directory,'patcher.js'),code);await fs.writeFile(path.join(directory,'bundle.json'),JSON.stringify({format:1,version:'0.4.0',files:{'patcher.js':createHash('sha256').update(code).digest('hex')}}));return directory;}
    const oldBundle=await bundle('old-installer'),newBundle=await bundle('latest-update');
    async function discord(version){const resources=path.join(local,'Discord',`app-${version}`,'resources');await fs.mkdir(resources,{recursive:true});await fs.writeFile(path.join(resources,'app.asar'),'original-'+version);return resources;}
    const old=await discord('1.0.9');await core.install(old,newBundle,loader);
    const stopped=[],started=[];
    const lifecycle={findExecutable:async resources=>path.join(path.dirname(resources),'Discord.exe'),stop:async target=>{stopped.push(target.resources);return {executable:path.join(path.dirname(target.resources),'Discord.exe'),wasRunning:false};},start:async session=>{started.push(session.executable);}};
    const api={...core,discover:()=>core.discover('win32',{LOCALAPPDATA:local})};
    return {root,local,old,oldBundle,newBundle,loader,discord,lifecycle,stopped,started,api,bundle};
}
test('launcher chooses newest numeric Discord and migrates the latest installed PulseCord',async t=>{
    const f=await fixture(t),latest=await f.discord('1.0.10');
    const result=await launchDiscord({core:f.api,lifecycle:f.lifecycle,bundle:f.oldBundle,loader:f.loader,localAppData:f.local});
    assert.equal(result.repaired,true);assert.match(result.target,/1\.0\.10/);
    assert.equal((await core.getInstallation(latest)).current,(await core.getInstallation(f.old)).current);
    assert.equal(f.started.at(-1),path.join(path.dirname(latest),'Discord.exe'));
});
test('healthy launcher does not shut down Discord and cached recovery survives old folder removal',async t=>{
    const f=await fixture(t);await launchDiscord({core:f.api,lifecycle:f.lifecycle,bundle:f.oldBundle,loader:f.loader,localAppData:f.local});
    assert.equal(f.stopped.length,0);
    const id=(await core.getInstallation(f.old)).current;
    const oldDirectory=path.dirname(f.old);assert.equal(path.dirname(path.dirname(oldDirectory)),f.local);
    await fs.rm(oldDirectory,{recursive:true});
    const latest=await f.discord('1.0.10');
    await launchDiscord({core:f.api,lifecycle:f.lifecycle,bundle:f.oldBundle,loader:f.loader,localAppData:f.local});
    assert.equal((await core.getInstallation(latest)).current,id);
});
test('launcher refuses another mod without overwriting its files',async t=>{
    const f=await fixture(t),latest=await f.discord('1.0.10');await fs.writeFile(path.join(latest,'_app.asar'),'other-mod-backup');
    const before=await fs.readFile(path.join(latest,'app.asar'));
    await assert.rejects(()=>launchDiscord({core:f.api,lifecycle:f.lifecycle,bundle:f.oldBundle,loader:f.loader,localAppData:f.local}),/Another mod/);
    assert.deepEqual(await fs.readFile(path.join(latest,'app.asar')),before);
});
test('launcher recovery retains only current and previous verified bundles',async t=>{
    const f=await fixture(t),state=path.join(f.root,'state');
    await saveBundle(f.oldBundle,state);await saveBundle(f.newBundle,state);const latest=await saveBundle(await f.bundle('third-update'),state);
    assert.equal(await readSavedBundle(state),latest);
    assert.equal((await fs.readdir(state)).filter(name=>/^[a-f0-9]{64}$/.test(name)).length,2);
    const invalid=await f.bundle('bad');await fs.writeFile(path.join(invalid,'patcher.js'),'tampered');
    await assert.rejects(()=>saveBundle(invalid,state),/Intégrité/);assert.equal(await readSavedBundle(state),latest);
});
test('launcher setup creates its own shortcut with an explicit channel, preserving Discord shortcuts',async t=>{
    const f=await fixture(t),source=path.join(f.root,'installer.exe'),desktop=path.join(f.root,'desktop');await fs.writeFile(source,'portable-fixture');await fs.mkdir(desktop);await fs.writeFile(path.join(desktop,'Discord.lnk'),'original-shortcut');
    let details;const result=await installLauncher({source,destination:path.join(f.root,'launcher'),desktop,shell:{writeShortcutLink(file,operation,options){details={file,operation,options};return true;}}});
    assert.equal(details.options.args,'--launch --channel=Discord');assert.equal(details.options.target,result.target);
    assert.equal(await fs.readFile(result.target,'utf8'),'portable-fixture');assert.equal(await fs.readFile(path.join(desktop,'Discord.lnk'),'utf8'),'original-shortcut');
});
test('installed launcher keeps its runtime beside the executable instead of re-extracting a portable',async t=>{
    const f=await fixture(t),runtime=path.join(f.root,'runtime'),desktop=path.join(f.root,'desktop');
    await fs.mkdir(path.join(runtime,'resources'),{recursive:true});await fs.mkdir(desktop);
    const source=path.join(runtime,'Installer.exe');await fs.writeFile(source,'electron');await fs.writeFile(path.join(runtime,'resources/app.asar'),'application');
    const result=await installLauncher({source,runtimeDirectory:runtime,destination:path.join(f.root,'installed'),desktop,shell:{writeShortcutLink:()=>true}});
    assert.equal(await fs.readFile(result.target,'utf8'),'electron');
    assert.equal(await fs.readFile(path.join(path.dirname(result.target),'resources/app.asar'),'utf8'),'application');
});
