import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../upstream/equicord/package.json',import.meta.url));
const {transform}=require('esbuild');
const compile=async file=>(await transform(await readFile(file,'utf8'),{loader:file.endsWith('tsx')?'tsx':'ts',format:'cjs'})).code;
const coreCode=await compile('packages/pulsecord/community-core.ts');
const storeCode=await compile('packages/pulsecord/community-store.ts');
const uiCode=await compile('packages/pulsecord/community.tsx');
const dev='1366054228480753755',coDev='669936721730863105',friend='223456789012345678',other='123456789012345678';
function core(){const context={module:{exports:{}},URLSearchParams,TextDecoder,Uint8Array};vm.runInNewContext(coreCode,context);return context.module.exports;}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function store({cache,fetcher=async()=>new Response(JSON.stringify({format:1,users:[friend]}))}={}){
    let calls=0;const saved=[];const coreApi=core();
    const context={module:{exports:{}},Date,AbortController,setTimeout,clearTimeout,fetch:async(...args)=>{calls++;return fetcher(...args);},require(name){
        if(name==='@api/DataStore')return{get:async key=>key==='pulsecord.community-badges.v1'?cache:undefined,set:async(key,value)=>{saved.push(value);}};
        if(name==='@webpack/common')return{UserStore:{getCurrentUser:()=>({id:dev})}};
        if(name==='./community-registration')return{registerCommunityUser:async()=>{}};
        if(name==='./community-network')return{communityFetch:context.fetch};
        if(name==='./community-core')return coreApi;
        throw Error(name);
    }};
    vm.runInNewContext(storeCode,context);return{api:context.module.exports,coreApi,saved,calls:()=>calls};
}

test('configured developers keep Dev independently of the registry; registered users get User',()=>{
    const api=core(),registry=new api.CommunityRegistry();
    assert.equal(registry.role(dev),'dev');assert.equal(registry.role(friend),undefined);
    assert.equal(registry.role(coDev),'dev');
    registry.replace([friend]);
    assert.equal(registry.role(friend),'user');assert.equal(registry.role(other),undefined);
    registry.replace([dev,friend]);assert.equal(registry.role(dev),'dev');
    assert.throws(()=>registry.replace(['invalid']));assert.equal(registry.role(friend),'user');
    let notified=0;const unsubscribe=registry.subscribe(()=>notified++);registry.replace([dev,friend]);assert.equal(notified,0);
    registry.replace([]);assert.equal(notified,1);unsubscribe();
    assert.equal(registry.role(coDev),'dev');
});

test('registry fetch is fixed, anonymous, bounded and excludes unapproved claims',async()=>{
    const api=core();let requests=0;
    const users=await api.fetchApprovedUsers(async(url,options)=>{
        requests++;assert.equal(url,api.registryUrl+'/v1/users');assert.equal(options.credentials,'omit');
        return new Response(JSON.stringify({format:1,users:[friend]}));
    });
    assert.deepEqual([...users],[friend]);assert.equal(requests,1);
    await assert.rejects(api.fetchApprovedUsers(async()=>new Response('x'.repeat(256001))),/volumineux/);
    await assert.rejects(api.fetchApprovedUsers(async()=>new Response('',{status:403})),/Limite du registre/);
    assert.equal(api.validUserId(friend),true);assert.equal(api.validUserId('bad'),false);
});

test('six-hour cache avoids network; offline refresh preserves verified badges',async()=>{
    const f=store({cache:{format:1,checkedAt:Date.now(),users:[friend]},fetcher:async()=>{throw Error('Offline');}});
    await f.api.startCommunityRegistry();assert.equal(f.calls(),0);assert.equal(f.api.communityRegistry.role(friend),'user');
    await f.api.refreshCommunity();assert.equal(f.calls(),1);assert.equal(f.api.communityRegistry.role(friend),'user');
    f.api.stopCommunityRegistry();assert.equal(f.api.communityRegistry.role(friend),undefined);
});

test('stopping during registry fetch invalidates its response and never saves or restores stopped badges',async()=>{
    let finish;const f=store({fetcher:()=>new Promise(resolve=>{finish=resolve;})});
    const starting=f.api.startCommunityRegistry();await tick();assert.equal(f.calls(),1);
    f.api.stopCommunityRegistry();finish(new Response(JSON.stringify([{name:'pulsecord-user:'+friend}])));
    await starting;assert.equal(f.api.communityRegistry.role(friend),undefined);assert.equal(f.saved.length,0);
});

test('badge surfaces use the same roles, display the Pulse logo and unregister cleanly',async()=>{
    const f=store({cache:{format:1,checkedAt:Date.now(),users:[friend]}});
    const profiles=new Set(),messages=new Map(),members=new Map();
    const React={useSyncExternalStore:()=>{},createElement:(type,props,...children)=>typeof type==='function'?type(props):({type,props,children})};
    const context={module:{exports:{}},require(name){
        if(name==='@api/Badges')return{addProfileBadge:b=>profiles.add(b),removeProfileBadge:b=>profiles.delete(b)};
        if(name==='@api/MessageDecorations')return{addMessageDecoration:(id,fn)=>messages.set(id,fn),removeMessageDecoration:id=>messages.delete(id)};
        if(name==='@api/MemberListDecorators')return{addMemberListDecorator:(id,fn)=>members.set(id,fn),removeMemberListDecorator:id=>members.delete(id)};
        if(name==='@webpack/common')return{React,UserStore:{getCurrentUser:()=>({id:friend})}};
        if(name==='./brand')return{brand:{logo:'pulse-logo'}};
        if(name==='./community-core')return f.coreApi;
        if(name==='./community-store')return f.api;
        throw Error(name);
    }};
    vm.runInNewContext(uiCode,context);const ui=context.module.exports;ui.startCommunityBadges();await tick();
    const badge=[...profiles][0];assert.equal(badge.getBadges({userId:dev})[0].name,'Pulse Dev');
    assert.equal(badge.getBadges({userId:coDev})[0].name,'Pulse Dev');
    assert.equal(badge.getBadges({userId:friend})[0].name,'Pulse User');assert.equal(badge.getBadges({userId:other}).length,0);
    assert.equal(ui.PulseCommunityBadge({userId:friend}).props['aria-label'],'Pulse User');
    assert.equal(ui.PulseCommunityBadge({userId:dev}).props['aria-label'],'Pulse Dev');assert.equal(ui.PulseCommunityBadge({userId:other}),null);
    assert.ok(!JSON.stringify(ui.CommunityTab()).includes('Demander le badge'));
    assert.equal(messages.size,1);assert.equal(members.size,1);
    const renderMember=members.get('pulsecord-community');
    assert.equal(renderMember({type:'guild',user:{id:friend}}).props['aria-label'],'Pulse User');
    assert.equal(renderMember({type:'dm',channel:{type:1,recipients:[friend]}}).props['aria-label'],'Pulse User');
    assert.equal(renderMember({type:'dm',channel:{type:3,recipients:[friend,dev]}}),null);
    assert.equal(renderMember({type:'dm',channel:{type:3,recipients:[friend]}}),null);
    assert.equal(renderMember({type:'dm',channel:{type:1,recipients:[]}}),null);
    assert.equal(renderMember({type:'dm'}),null);
    assert.equal(renderMember({type:'guild'}),null);
    ui.stopCommunityBadges();
    assert.equal(profiles.size,0);assert.equal(messages.size,0);assert.equal(members.size,0);
});
