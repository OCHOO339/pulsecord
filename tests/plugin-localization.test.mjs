import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { localizeUi } from '../scripts/localize-plugins.mjs';
const require = createRequire(new URL('../upstream/equicord/package.json', import.meta.url));
const { transform } = require('esbuild');
async function core() {
    const source = await transform(await readFile('packages/pulsecord/localization-core.ts','utf8'), {loader:'ts',format:'cjs'});
    const context = {module:{exports:{}},Date,Map,Set,Promise};
    vm.runInNewContext(source.code,context); return context.module.exports;
}
const tick = () => new Promise(resolve => setImmediate(resolve));
test('all Discord locales normalize and map regional translation languages',async()=>{
    const api=await core(); assert.equal(api.discordLocales.length,32);
    for(const locale of api.discordLocales) assert.equal(api.normalizeLocale(locale),locale);
    assert.equal(api.normalizeLocale('fr-FR'),'fr');assert.equal(api.normalizeLocale('unknown'),'en-US');
    assert.equal(api.translationLanguage('es-419'),'es');assert.equal(api.translationLanguage('zh-TW'),'zh-TW');
});
test('translations deduplicate requests, cache by source and locale, and notify subscribers',async()=>{
    const {PluginTranslations}=await core();let calls=0,notifications=0;
    const cache=new PluginTranslations({fr:{Save:'Enregistrer'}},async(text,lang)=>{calls++;return `${lang}:${text}`;});
    const unsubscribe=cache.subscribe(()=>notifications++);
    assert.equal(cache.translate('Save','fr'),'Enregistrer');assert.equal(calls,0);
    assert.equal(cache.translate('A public description','fr'),'A public description');cache.translate('A public description','fr');
    await tick();assert.equal(calls,1);assert.equal(cache.translate('A public description','fr'),'fr:A public description');
    cache.translate('A public description','de');await tick();assert.equal(calls,2);assert.equal(notifications,2);
    const restored=new PluginTranslations({},async()=>{throw Error('offline');});restored.hydrate(cache.entries());
    assert.equal(restored.translate('A public description','de'),'de:A public description');
    unsubscribe();cache.translate('Another description','fr');await tick();assert.equal(notifications,2);
});
test('offline failures preserve originals and retry cooldown prevents request loops',async()=>{
    const {PluginTranslations}=await core();let calls=0;
    const cache=new PluginTranslations({},async()=>{calls++;throw Error('offline');});
    cache.translate('Some setting','fr');await tick();assert.equal(cache.translate('Some setting','fr'),'Some setting');await tick();assert.equal(calls,1);
});
test('static UI transformation leaves names, URLs, values and user content intact',async()=>{
    const source='const name="VoiceKeeper"; const options=[{label:"Enabled",value:"enabled"}]; function View({message}) { return <div><p>Public help text</p><input placeholder="Search plugins" value={message}/><a href="https://example.com">Website</a><code>doNotTranslate</code><span>{message}</span></div>; }';
    const output=localizeUi(source,'test.tsx');
    assert.match(output,/translateUi\("Enabled"\)/);assert.match(output,/PluginText text=\{"Public help text"\}/);
    assert.match(output,/value:"enabled"/);assert.match(output,/value=\{message\}/);assert.match(output,/<span>\{message\}<\/span>/);
    assert.match(output,/href="https:\/\/example.com"/);assert.match(output,/<code>doNotTranslate<\/code>/);
    assert.match(output,/name="VoiceKeeper"/);assert.equal(localizeUi(output,'test.tsx'),output);
});
test('renderer imports before React initialization and reacts to Discord locale changes',async()=>{
    const coreApi=await core();
    const frenchCode=await transform(await readFile('packages/pulsecord/localization-fr.ts','utf8'),{loader:'ts',format:'cjs'});
    const frenchContext={module:{exports:{}}};vm.runInNewContext(frenchCode.code,frenchContext);
    const code=await transform(await readFile('packages/pulsecord/localization.tsx','utf8'),{loader:'tsx',format:'cjs'});
    const common={React:undefined,LocaleStore:undefined};let calls=0;
    const context={module:{exports:{}},URLSearchParams,AbortSignal,setTimeout,clearTimeout,fetch:async()=>{calls++;throw Error('No test network');},localStorage:{getItem:()=>null},require(name){
        if(name==='@webpack/common')return common;
        if(name==='./localization-core')return coreApi;
        if(name==='./localization-fr')return frenchContext.module.exports;
        throw Error(name);
    }};
    assert.doesNotThrow(()=>vm.runInNewContext(code.code,context));assert.equal(calls,0);
    const listeners=new Set();let snapshot,unsubscribe,changes=0;
    common.LocaleStore={locale:'fr',addChangeListener:l=>listeners.add(l),removeChangeListener:l=>listeners.delete(l)};
    common.React={useSyncExternalStore(subscribe,getSnapshot){snapshot=getSnapshot;unsubscribe=subscribe(()=>changes++);return getSnapshot();}};
    const api=context.module.exports;api.usePluginLocale();
    assert.equal(api.translateUi('Save'),'Enregistrer');assert.equal(snapshot(),'fr:0');
    common.LocaleStore.locale='en-US';for(const l of listeners)l();
    assert.equal(snapshot(),'en-US:0');assert.equal(api.translateUi('Save'),'Save');assert.equal(changes,1);assert.equal(calls,0);
    unsubscribe();assert.equal(listeners.size,0);
});
test('translation queue is bounded to two concurrent requests',async()=>{
    const {PluginTranslations}=await core();let active=0,maximum=0;const releases=[];
    const cache=new PluginTranslations({},async text=>{active++;maximum=Math.max(maximum,active);await new Promise(resolve=>releases.push(resolve));active--;return text;});
    for(let i=0;i<8;i++)cache.translate(`Public label ${i}`,'fr');
    await tick();assert.equal(maximum,2);
    while(releases.length){releases.shift()();await tick();}
    assert.equal(active,0);assert.equal(cache.entries().length,8);assert.equal(maximum,2);
});
