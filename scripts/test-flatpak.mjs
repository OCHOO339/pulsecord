// Integration test: a real, empty CI Flatpak installation; never a user's account.
import {createRequire} from 'node:module';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import * as core from '../packages/installer/core.mjs';
const require=createRequire(import.meta.url);
const linux=require('../packages/installer/linux-flatpak.cjs');
if(process.platform!=='linux'||process.env.PULSECORD_REAL_FLATPAK_TEST!=='1'||process.env.GITHUB_ACTIONS!=='true')throw Error('Explicit isolated GitHub Linux CI fixture required');
const target=(await linux.discoverFlatpaks()).find(item=>item.appId==='com.discordapp.Discord');
if(!target)throw Error('Install Discord Flatpak in the isolated CI account first');
if(target.installed)throw Error('The integration fixture requires an unmodified CI account');
const original=await fs.readFile(path.join(target.source,'resources/app.asar'));
const marker=path.join(target.dataRoot,'ci-smoke.txt');
const bundle=path.resolve('.cache/flatpak-test-bundle');await fs.mkdir(bundle,{recursive:true});
const code=`const fs=require('node:fs');const {app}=require('electron');app.whenReady().then(()=>{const marker=${JSON.stringify(marker)};const previous=fs.existsSync(marker)?Number(fs.readFileSync(marker,'utf8')):0;fs.writeFileSync(marker,String(previous+1));if(previous===0)app.relaunch({execPath:'/app/bin/com.discordapp.Discord',args:[]});app.exit(0);});`;
await fs.writeFile(path.join(bundle,'patcher.js'),code);
await fs.writeFile(path.join(bundle,'bundle.json'),JSON.stringify({format:1,version:'0.4.0',files:{'patcher.js':createHash('sha256').update(code).digest('hex')}}));
const session=await linux.stopFlatpak(target);
try{
    await linux.prepareFlatpakTarget(target,'install');
    const binary=path.join(target.runtime,'Discord');
    const sourceStat=await fs.lstat(path.join(target.source,'Discord'));
    const binaryStat=await fs.lstat(binary);
    console.log(JSON.stringify({sourceBinaryIsLink:sourceStat.isSymbolicLink(),privateBinaryIsLink:binaryStat.isSymbolicLink(),privateBinaryBytes:binaryStat.size}));
    const executable=await fs.open(binary,'r');const magic=Buffer.alloc(4);
    try{await executable.read(magic,0,4,0);}finally{await executable.close();}
    if(!magic.equals(Buffer.from([0x7f,0x45,0x4c,0x46])))throw Error('The private Flatpak executable is not an ELF binary');
    await fs.rm(marker,{force:true});
    await core.install(target.resources,bundle,path.resolve('packages/updates/loader.cjs'));
    await linux.startFlatpak(session, { stdio: 'inherit' });
    let ready=false;
    for(let attempt=0;attempt<150;attempt++){
        if(await fs.readFile(marker,'utf8').catch(()=> '')==='2'){ready=true;break;}
        await new Promise(resolve=>setTimeout(resolve,200));
    }
    if(!ready)throw Error('Real Discord Flatpak did not load and relaunch the installed fixture');
    console.log('Real Discord Flatpak: private ASAR injection and sandboxed relaunch verified.');
}finally{
    await linux.stopFlatpak(target);
    if(await core.getInstallation(target.resources).catch(()=>false))await core.uninstall(target.resources);
    if(!original.equals(await fs.readFile(path.join(target.source,'resources/app.asar'))))throw Error('Original Flatpak deployment changed');
    if(!original.equals(await fs.readFile(path.join(target.resources,'app.asar'))))throw Error('Private archive was not restored');
}
