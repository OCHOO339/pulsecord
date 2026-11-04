import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createBackup, restoreBackup, parseBackup } from '../packages/backup/core.mjs';
async function fixture(t) {
    const root=await fs.mkdtemp(path.join(tmpdir(),'pulsecord-backup-test-'));
    t.after(()=>fs.rm(root,{recursive:true,force:true}));
    const data=path.join(root,'data'),backups=path.join(root,'backups');
    await fs.mkdir(path.join(data,'settings'),{recursive:true});await fs.mkdir(path.join(data,'themes'),{recursive:true});
    await fs.writeFile(path.join(data,'settings/settings.json'),JSON.stringify({plugins:{VoiceKeeper:{enabled:true}},enabledThemes:['gold.css']}));
    await fs.writeFile(path.join(data,'settings/quickCss.css'),'body { color: gold; }');
    await fs.writeFile(path.join(data,'themes/gold.css'),':root { --brand-500:gold; }');
    await fs.writeFile(path.join(data,'session-token'),'private-not-included');
    return {root,data,backups};
}
test('one-click backup includes configuration and local themes, not unrelated profile data',async t=>{
    const f=await fixture(t),saved=await createBackup(f.data,f.backups);const bytes=await fs.readFile(saved.path,'utf8');
    const parsed=parseBackup(bytes);assert.equal(parsed.files.length,3);assert.ok(!bytes.includes('private-not-included'));
    assert.ok(parsed.files.some(file=>file.name==='themes/gold.css'));assert.equal(saved.fileCount,3);
});
test('restore creates recovery copy and restores settings, CSS and local themes',async t=>{
    const f=await fixture(t),saved=await createBackup(f.data,f.backups),bytes=await fs.readFile(saved.path,'utf8');
    await fs.writeFile(path.join(f.data,'settings/settings.json'),'{"plugins":{"VoiceKeeper":{"enabled":false}}}');
    await fs.writeFile(path.join(f.data,'settings/quickCss.css'),'changed');
    const result=await restoreBackup(f.data,f.backups,bytes);
    assert.equal(JSON.parse(await fs.readFile(path.join(f.data,'settings/settings.json'),'utf8')).plugins.VoiceKeeper.enabled,true);
    assert.equal(await fs.readFile(path.join(f.data,'settings/quickCss.css'),'utf8'),'body { color: gold; }');
    const recovery=parseBackup(await fs.readFile(result.path,'utf8'));
    assert.equal(JSON.parse(recovery.files.find(file=>file.name==='settings/settings.json').content).plugins.VoiceKeeper.enabled,false);
    assert.equal(result.restoredFiles,3);
});
test('invalid paths, duplicate files and prototype keys are rejected before any write',async t=>{
    const f=await fixture(t),before=await fs.readFile(path.join(f.data,'settings/settings.json'),'utf8');
    for(const files of [
        [{name:'../outside.css',content:'bad'}], [{name:'themes/../../outside.css',content:'bad'}],
        [{name:'settings/settings.json',content:'{"__proto__":{"polluted":true}}'}],
        [{name:'themes/a.css',content:'a'},{name:'themes/a.css',content:'b'}],
        [{name:'themes/a.js',content:'execute()'}]
    ])await assert.rejects(()=>restoreBackup(f.data,f.backups,JSON.stringify({product:'PulseCord',format:1,files})));
    assert.equal(await fs.readFile(path.join(f.data,'settings/settings.json'),'utf8'),before);
    await assert.rejects(()=>fs.stat(f.backups));
});
