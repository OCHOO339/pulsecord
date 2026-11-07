import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import linux from '../packages/installer/linux-flatpak.cjs';
import * as core from '../packages/installer/core.mjs';
import {updateManifestUrl} from '../packages/updates/protocol.mjs';
import operations from '../packages/installer/operations.cjs';
const id='com.discordapp.Discord',commit='a'.repeat(64);
async function fixture(t){
    const home=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'pulsecord-flatpak-')));
    t.after(()=>fs.rm(home,{recursive:true,force:true}));
    const source=path.join(home,'deployment/files/discord');await fs.mkdir(path.join(source,'resources'),{recursive:true});
    await fs.writeFile(path.join(source,'resources/app.asar'),'original');await fs.writeFile(path.join(source,'Discord'),'binary');
    return{home,source,name:'Discord Flatpak',kind:'flatpak',appId:id,commit,...linux.paths(id,commit,home)};
}
test('Flatpak discovery resolves installed deployments and uses only private user data',async t=>{
    const f=await fixture(t);
    const found=await linux.discoverFlatpaks(f.home,async(command,args)=>{
        assert.equal(command,'flatpak');if(args.at(-1)!==id)throw Error('not installed');
        return{stdout:args.includes('--show-location')?path.resolve(f.source,'../..')+'\n':commit+'\n'};
    });
    assert.equal(found.length,1);assert.equal(found[0].resources,f.resources);assert.equal(found[0].installed,false);
    await linux.prepareFlatpakTarget(found[0],'install');
    assert.equal(await fs.readFile(path.join(f.source,'resources/app.asar'),'utf8'),'original');
    assert.equal(await fs.readFile(path.join(f.resources,'app.asar'),'utf8'),'original');
    assert.match(await fs.readFile(path.join(f.dataRoot,'bin/zypak-wrapper'),'utf8'),/exec \/app\/bin\/zypak-wrapper/);
    await linux.prepareFlatpakTarget(found[0],'repair');
    assert.deepEqual(linux.flatpakRunArgs(id,true),['run','--command=sh',id,'-c',`export PATH="$XDG_DATA_HOME/pulsecord/bin:$PATH"; exec /app/bin/${id} "$@"`,'pulsecord']);
    assert.throws(()=>linux.paths('arbitrary.App',commit,f.home));
    await assert.rejects(linux.prepareFlatpakTarget({...f,resources:path.join(f.home,'outside')},'install'));
});
test('operations stop Flatpak before preparing a writable runtime and then relaunch it',async()=>{
    const calls=[];
    const result=await operations.runOperations({core:{prepareTarget:async()=>calls.push('prepare'),install:async()=>calls.push('install')},action:'install',targets:[{name:'Flatpak',resources:'/fixture'}],lifecycle:{stop:async()=>{calls.push('stop');return{wasRunning:true};},start:async()=>calls.push('start')},progress(){}});
    assert.equal(result.ok,true);assert.deepEqual(calls,['stop','prepare','install','start']);
});
test('Flatpak runtime copies preserve sandbox model symlinks without following them on the host',{skip:process.platform!=='linux'},async t=>{
    const f=await fixture(t);const link=path.join(f.source,'model.tflite');
    await fs.symlink('/var/data/mediapipe_models/model.tflite',link);
    await linux.prepareFlatpakTarget(f,'install');
    const copied=path.join(f.runtime,'model.tflite');
    assert.equal((await fs.lstat(copied)).isSymbolicLink(),true);
    assert.equal(await fs.readlink(copied),'/var/data/mediapipe_models/model.tflite');
});
test('Flatpak shutdown never kills other application IDs and desktop entries preserve arguments',async t=>{
    const f=await fixture(t),calls=[];let running=true;
    await linux.stopFlatpak(f,async(command,args)=>{calls.push(args);if(args[0]==='kill')running=false;return{stdout:args[0]==='ps'?(running?id+'\norg.example.App\n':'org.example.App\n'):''};});
    assert.deepEqual(calls,[['ps','--columns=application'],['kill',id],['ps','--columns=application']]);
    const source=path.join(f.home,'installer.AppImage');await fs.writeFile(source,'appimage');
    const result=await linux.installLinuxLauncher({source,appId:id,home:f.home,icon:Buffer.from('png')});
    const desktop=await fs.readFile(result.shortcut,'utf8');assert.match(desktop,/--launch --flatpak=com\.discordapp\.Discord/);
    assert.equal(await fs.readFile(result.target,'utf8'),'appimage');assert.throws(()=>linux.desktopQuote('bad\npath'));
    assert.match(linux.desktopQuote('/path with spaces/100%.AppImage'),/100%%/);
});
test('Linux and Windows update feeds stay distinct and require a supported platform',()=>{
    const base='https://github.com/OCHOO339/pulsecord/releases/latest/download/pulsecord-update.json';
    assert.equal(updateManifestUrl(base,'win32','x64'),base);
    assert.ok(updateManifestUrl(base,'linux','x64').endsWith('pulsecord-update-linux-x64.json'));
    assert.throws(()=>updateManifestUrl(base,'linux','arm64'));
    assert.ok(updateManifestUrl(base,'darwin','x64').endsWith('pulsecord-update-darwin-x64.json'));
    assert.ok(updateManifestUrl(base,'darwin','arm64').endsWith('pulsecord-update-darwin-arm64.json'));
});
test('Flatpak private resources support install, native updates and exact restoration',async t=>{
    const f=await fixture(t);await linux.prepareFlatpakTarget(f,'install');
    const bundle=path.join(f.home,'bundle');await fs.mkdir(bundle);await fs.writeFile(path.join(bundle,'patcher.js'),'code');
    const {createHash}=await import('node:crypto');const hash=createHash('sha256').update('code').digest('hex');
    await fs.writeFile(path.join(bundle,'bundle.json'),JSON.stringify({format:1,version:'0.4.0',files:{'patcher.js':hash}}));
    await core.install(f.resources,bundle,new URL('../packages/updates/loader.cjs',import.meta.url));
    assert.ok((await core.getInstallation(f.resources)).current);
    await core.activateUpdate(f.resources,bundle);await core.uninstall(f.resources);
    assert.equal(await fs.readFile(path.join(f.resources,'app.asar'),'utf8'),'original');
    assert.equal(await fs.readFile(path.join(f.source,'resources/app.asar'),'utf8'),'original');
});
