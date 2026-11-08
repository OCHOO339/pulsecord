import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import worker from '../worker/registry.mjs';
const user='223456789012345678';
const encode=b=>Buffer.from(b).toString('base64url');
async function fixture(){
 const db=new DatabaseSync(':memory:');db.exec(await readFile(new URL('../drizzle/0000_registry.sql',import.meta.url),'utf8'));
 const DB={prepare(sql){let params=[];const statement=db.prepare(sql);return{bind(...p){params=p;return this;},async all(){return{results:statement.all(...params)};},async first(){return statement.get(...params);},async run(){return statement.run(...params);}};}};
 const pair=await crypto.subtle.generateKey({name:'Ed25519'},true,['sign','verify']);const publicKey=encode(await crypto.subtle.exportKey('raw',pair.publicKey));
 async function signed(method='POST',userId=user){const timestamp=Date.now();const signature=encode(await crypto.subtle.sign('Ed25519',pair.privateKey,new TextEncoder().encode(`pulsecord-badge-v1\n${method}\n${publicKey}\n${userId}\n${timestamp}`)));return{userId,publicKey,timestamp,signature};}
 const request=(path,method='GET',body)=>worker.fetch(new Request('https://example.test'+path,{method,headers:{Origin:'https://discord.com','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),{DB});
 return{db,signed,request};
}
test('signed automatic registration is public, idempotent and removable by its installation',async()=>{
 const f=await fixture();try{
 assert.equal((await f.request('/v1/installations','POST',await f.signed())).status,200);
 assert.equal((await f.request('/v1/installations','POST',await f.signed())).status,200);
 const response=await f.request('/v1/users');assert.equal(response.headers.get('Access-Control-Allow-Origin'),'https://discord.com');
 assert.deepEqual(await response.json(),{format:1,users:[user]});
 assert.equal(f.db.prepare('SELECT count(*) AS n FROM installations').get().n,1);
 assert.equal((await f.request('/v1/installations','DELETE',await f.signed('DELETE'))).status,200);
 assert.deepEqual((await (await f.request('/v1/users')).json()).users,[]);
 }finally{f.db.close();}
});
test('forged, replayed and oversized registrations are rejected without writes',async()=>{
 const f=await fixture();try{
 const body=await f.signed();body.userId='323456789012345678';assert.equal((await f.request('/v1/installations','POST',body)).status,401);
 const expired=await f.signed();expired.timestamp-=121000;assert.equal((await f.request('/v1/installations','POST',expired)).status,400);
 assert.equal((await f.request('/v1/installations','POST',{padding:'x'.repeat(2200)})).status,413);
 assert.equal(f.db.prepare('SELECT count(*) AS n FROM installations').get().n,0);
 }finally{f.db.close();}
});
