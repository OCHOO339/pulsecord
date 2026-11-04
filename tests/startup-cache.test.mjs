import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../upstream/equicord/package.json', import.meta.url));
const { transform } = require('esbuild');
const compiled = await transform(await readFile('packages/pulsecord/startup-cache.ts', 'utf8'), {loader:'ts',format:'cjs'});
function fixture(fail = false) {
    let ready, cleared = 0, warnings = 0, readyCalls = 0;
    const promise = new Promise(resolve => { ready = resolve; });
    const session = new Proxy({}, { get(_, key) {
        assert.equal(key,'clearCache','Cleanup must never touch cookies or storage');
        return async () => { cleared++; if(fail) throw Error('Disk unavailable'); };
    }});
    const context={module:{exports:{}},console:{info(){},warn(){warnings++;}},require(name){
        assert.equal(name,'electron');return {app:{whenReady(){readyCalls++;return promise;}},session:{defaultSession:session}};
    }};
    vm.runInNewContext(compiled.code,context);
    return { api:context.module.exports, ready, counts:()=>({cleared,warnings,readyCalls}) };
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('startup clears only the HTTP cache once, after Electron is ready',async()=>{
    const f=fixture();assert.equal(f.api.installStartupCacheCleanup(),undefined);
    f.api.installStartupCacheCleanup();assert.deepEqual(f.counts(),{cleared:0,warnings:0,readyCalls:1});
    f.ready();await tick();assert.deepEqual(f.counts(),{cleared:1,warnings:0,readyCalls:1});
    f.api.installStartupCacheCleanup();await tick();assert.equal(f.counts().cleared,1);
});
test('disabled startup cleanup does not access Electron session or storage',async()=>{
    const f=fixture();f.api.installStartupCacheCleanup(false);f.ready();await tick();
    assert.deepEqual(f.counts(),{cleared:0,warnings:0,readyCalls:0});
});
test('cache cleanup failure is caught and never prevents startup or loops',async()=>{
    const f=fixture(true);f.api.installStartupCacheCleanup();f.ready();await tick();
    assert.deepEqual(f.counts(),{cleared:1,warnings:1,readyCalls:1});
    f.api.installStartupCacheCleanup();await tick();assert.equal(f.counts().cleared,1);
});
