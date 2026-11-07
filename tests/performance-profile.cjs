const {app,BrowserWindow}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const {createRequire}=require('node:module');
const tooling=createRequire(path.resolve('upstream/equicord/package.json'));
app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
    try{
        const {build}=tooling('esbuild');
        const baseline=process.argv.includes('--baseline');
        const file=baseline?'.cache/ios-baseline-surfaces.ts':'packages/iosEmojis/surfaces.ts';
        const built=await build({entryPoints:[file],bundle:true,write:false,format:'cjs',plugins:[{name:'data',setup(builder){builder.onResolve({filter:/^\.\/data$/},()=>({path:path.resolve('packages/iosEmojis/data.ts')}));}}]});
        const styleFile=baseline?'.cache/ios-baseline-style.ts':'packages/iosEmojis/style.ts';
        const style=await build({entryPoints:[styleFile],bundle:true,write:false,format:'cjs',plugins:[{name:'data',setup(builder){builder.onResolve({filter:/^\.\/data$/},()=>({path:path.resolve('packages/iosEmojis/data.ts')}));}}]});
        const window=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,backgroundThrottling:false}});
        await window.loadURL('data:text/html,<body><main id="rows"></main></body>');
        const result=await window.webContents.executeJavaScript(`(async()=>{
            const load=code=>{const module={exports:{}};new Function('module',code)(module);return module.exports;};
            const rows=document.querySelector('#rows');
            for(let i=0;i<500;i++){const row=document.createElement('div');row.style.fontFamily='Arial';row.textContent='🎮 Salon '+i;rows.append(row);}
            let reads=0;const native=getComputedStyle;window.getComputedStyle=(...args)=>{reads++;return native(...args);};
            const api=load(${JSON.stringify(built.outputFiles[0].text)});
            const start=performance.now();const stop=api.startSurfaces();await new Promise(resolve=>setTimeout(resolve,0));
            const startupStyleReads=reads;reads=0;
            for(let i=0;i<100;i++)document.body.className='discord-state-'+i;
            await new Promise(resolve=>setTimeout(resolve,50));
            const classChangeStyleReads=reads;
            window.dispatchEvent(new Event('blur'));reads=0;
            for(let i=0;i<100;i++){const row=document.createElement('div');row.style.fontFamily='Arial';row.textContent='🎮 Nouveau salon '+i;rows.append(row);}
            await new Promise(resolve=>setTimeout(resolve,20));const backgroundStyleReads=reads;
            reads=0;window.dispatchEvent(new Event('focus'));
            await new Promise(resolve=>setTimeout(resolve,20));const resumeStyleReads=reads;
            const styleApi=load(${JSON.stringify(style.outputFiles[0].text)});
            const css=styleApi.emojiCss('font-placeholder',{'--font-primary':'Arial'});
            const cssBytes=new TextEncoder().encode(css).length;
            stop();window.getComputedStyle=native;
            return {rows:500,classChanges:100,startupStyleReads,classChangeStyleReads,backgroundStyleReads,resumeStyleReads,cssBytes,fixtureMs:Math.round(performance.now()-start)};
        })()`);
        await fs.mkdir('dist/qa',{recursive:true});
        await fs.writeFile('dist/qa/performance-'+(baseline?'before':'after')+'.json',JSON.stringify(result,null,2));
        console.log(JSON.stringify(result));app.exit(0);
    }catch(error){console.error(error);app.exit(1);}
});
