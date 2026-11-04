import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require=createRequire(new URL('../upstream/equicord/package.json',import.meta.url));
const {transform}=require('esbuild');
test('background economy follows visibility and leaves no timer or listener after disabling',async()=>{
    const listeners=new Set(),attributes=new Set();
    const document={hidden:false,addEventListener:(name,fn)=>{assert.equal(name,'visibilitychange');listeners.add(fn);},removeEventListener:(_,fn)=>listeners.delete(fn),documentElement:{toggleAttribute(name,on){if(on)attributes.add(name);else attributes.delete(name);},removeAttribute:name=>attributes.delete(name)}};
    const context={module:{exports:{}},document};
    vm.runInNewContext((await transform(await readFile('packages/pulsecord/performance.ts','utf8'),{loader:'ts',format:'cjs'})).code,context);
    const api=context.module.exports;api.setBackgroundEconomy(true);api.setBackgroundEconomy(true);assert.equal(listeners.size,1);assert.equal(attributes.size,0);
    document.hidden=true;for(const fn of listeners)fn();assert.ok(attributes.has('data-pc-background'));
    document.hidden=false;for(const fn of listeners)fn();assert.equal(attributes.size,0);
    api.setBackgroundEconomy(false);assert.equal(listeners.size,0);assert.equal(attributes.size,0);
});
