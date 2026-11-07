import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../upstream/equicord/package.json',import.meta.url));
const {transform}=require('esbuild');
const {code}=await transform(await readFile('packages/pulsecord/maintenance-native.ts','utf8'),{loader:'ts',format:'cjs'});
for(const [platform,flatpak,persistent] of [['linux',true,true],['linux',false,false],['win32',false,false],['darwin',false,false]]){
    test(`backup destination remains persistent: ${platform}, Flatpak=${flatpak}`,async()=>{
        let destination;
        const context={module:{exports:{}},process:{platform,env:flatpak?{FLATPAK_ID:'com.discordapp.Discord'}:{}},require(name){
            if(name==='@main/utils/constants')return{DATA_DIR:path.resolve('fixture-data')};
            if(name==='@pulsecord/backup-core')return{createBackup:async(source,folder)=>{destination=folder;return{path:path.join(folder,'backup.json')};}};
            if(name==='electron')return{app:{getPath:()=>path.resolve('fixture-documents')},dialog:{},shell:{}};
            if(name==='original-fs')return{promises:{}};
            if(name==='path')return path;
            throw Error(name);
        }};
        vm.runInNewContext(code,context);await context.module.exports.backupConfiguration();
        assert.equal(destination,persistent?path.resolve('fixture-data','backups'):path.resolve('fixture-documents','PulseCord Backups'));
    });
}
