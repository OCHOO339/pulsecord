import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../upstream/equicord/package.json',import.meta.url));
const {code}=await require('esbuild').transform(await readFile('packages/pulsecord/community-registration.ts','utf8'),{loader:'ts',format:'cjs'});
test('automatic registration signs its public payload, caches renewal and never transmits its private key',async()=>{
 const values=new Map(),requests=[];
 const context={module:{exports:{}},crypto:webcrypto,TextEncoder,Uint8Array,btoa,atob,Date,fetch:async(url,options)=>{requests.push({url,options});return{ok:true};},require(name){
 if(name==='@api/DataStore')return{get:async key=>values.get(key),set:async(key,value)=>values.set(key,structuredClone(value))};
 if(name==='./community-core')return{registryUrl:'https://example.test',validUserId:id=>/^\d{18}$/.test(id)};
 if(name==='./community-network')return{communityFetch:context.fetch};
 throw Error(name);
 }};
 vm.runInNewContext(code,context);const {registerCommunityUser}=context.module.exports;
 const id='223456789012345678';await registerCommunityUser(id);assert.equal(requests.length,1);
 const {options}=requests[0],body=JSON.parse(options.body);assert.equal(options.credentials,'omit');
 assert.deepEqual(Object.keys(body).sort(),['publicKey','signature','timestamp','userId']);
 const saved=[...values.values()][0];assert.ok(saved.privateKey);assert.ok(!options.body.includes(saved.privateKey));
 const key=await webcrypto.subtle.importKey('raw',Buffer.from(body.publicKey,'base64url'),{name:'Ed25519'},false,['verify']);
 assert.ok(await webcrypto.subtle.verify('Ed25519',key,Buffer.from(body.signature,'base64url'),new TextEncoder().encode(`pulsecord-badge-v1\nPOST\n${body.publicKey}\n${id}\n${body.timestamp}`)));
 await registerCommunityUser(id);assert.equal(requests.length,1);
 await registerCommunityUser(id,true);assert.equal(requests[1].options.method,'DELETE');assert.equal([...values.values()][0].registeredAt,undefined);
});
