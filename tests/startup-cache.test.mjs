import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../upstream/equicord/package.json', import.meta.url));
const { transform } = require('esbuild');
const compiled = await transform(await readFile('packages/pulsecord/startup-cache.ts', 'utf8'), {loader:'ts',format:'cjs'});
function fixture({size=300*1024*1024,checkedAt,fail=false}={}) {
    let ready, run, cleared=0, warnings=0, sizes=0, writes=0, timers=0;
    const promise=new Promise(resolve=>{ready=resolve;});
    const context={module:{exports:{}},Date,console:{warn(){warnings++;}},
        setTimeout(callback,delay){assert.equal(delay,30000);timers++;run=callback;return{unref(){}};},
        require(name){
            if(name==='node:path')return{join:(...parts)=>parts.join('/')};
            if(name==='node:fs/promises')return{
                async readFile(){return checkedAt===undefined?'':JSON.stringify({checkedAt});},
                async writeFile(file,body){assert.ok(file.endsWith('pulsecord-cache-maintenance.json'));assert.ok(JSON.parse(body).checkedAt);writes++;}
            };
            assert.equal(name,'electron');return{
                app:{whenReady:()=>promise,getPath:key=>{assert.equal(key,'userData');return'/fixture';}},
                session:{defaultSession:new Proxy({}, {get(_,key){
                    if(key==='getCacheSize')return async()=>{sizes++;return size;};
                    assert.equal(key,'clearCache','Never touch cookies, login, voice or storage');
                    return async()=>{cleared++;if(fail)throw Error('Disk unavailable');};
                }})}
            };
        }
    };
    vm.runInNewContext(compiled.code,context);
    return{api:context.module.exports,ready,run:()=>run?.(),counts:()=>({cleared,warnings,sizes,writes,timers})};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('cache maintenance waits 30 seconds and clears only oversized HTTP caches once',async()=>{
    const f=fixture();f.api.installStartupCacheCleanup();f.api.installStartupCacheCleanup();
    assert.equal(f.counts().timers,0);f.ready();await tick();
    assert.deepEqual(f.counts(),{cleared:0,warnings:0,sizes:0,writes:0,timers:1});
    f.run();await tick();assert.deepEqual(f.counts(),{cleared:1,warnings:0,sizes:1,writes:1,timers:1});
    f.api.installStartupCacheCleanup();assert.equal(f.counts().timers,1);
});
test('recently checked caches and small caches are preserved',async()=>{
    const recent=fixture({checkedAt:Date.now()-60000});recent.api.installStartupCacheCleanup();recent.ready();await tick();recent.run();await tick();
    assert.equal(recent.counts().sizes,0);assert.equal(recent.counts().cleared,0);
    const small=fixture({size:10*1024*1024});small.api.installStartupCacheCleanup();small.ready();await tick();small.run();await tick();
    assert.equal(small.counts().cleared,0);assert.equal(small.counts().writes,1);
});
test('disabled maintenance and failures never prevent startup or retry in a loop',async()=>{
    const disabled=fixture();disabled.api.installStartupCacheCleanup(false);disabled.ready();await tick();assert.equal(disabled.counts().timers,0);
    const failing=fixture({fail:true});failing.api.installStartupCacheCleanup();failing.ready();await tick();failing.run();await tick();
    assert.equal(failing.counts().warnings,1);assert.equal(failing.counts().writes,0);assert.equal(failing.counts().cleared,1);
});
