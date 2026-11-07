const {app, BrowserWindow} = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const {createRequire} = require('node:module');
const tooling = createRequire(path.resolve('upstream/equicord/package.json'));
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
    try {
        const {transform} = tooling('esbuild');
        const {code} = await transform(await fs.readFile('packages/pulsecord/smooth-typing.ts','utf8'), {loader:'ts',format:'cjs'});
        const css = await fs.readFile('packages/pulsecord/style.css','utf8');
        const window = new BrowserWindow({show:false,width:900,height:480,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
        await window.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent(`<!doctype html><html><head><meta charset="utf-8"><style>${css}
            *{box-sizing:border-box}body{margin:0;background:#16161c;color:#eee;font:16px/1.5 system-ui}
            main{max-width:800px;margin:0 auto;padding:32px}header{padding-bottom:18px;border-bottom:1px solid #303038;font-weight:600}
            article{padding:24px 0 48px}article p{color:#b5b5c5}.author{color:#f8c332;font-weight:600}
            .channelTextArea_fixture{background:#24242d;border:1px solid #3c3c48;border-radius:8px;padding:14px 16px}
            [contenteditable]{outline:none;min-height:24px;white-space:pre-wrap;overflow-wrap:anywhere;caret-color:#eee}
            .hint{font-size:12px;color:#aaaabc;margin-top:10px}input{margin-top:12px}
            </style></head><body><main><header># discussion</header><article><div class="author">PulseCord</div><p>Une saisie plus fluide, au rythme de tes messages.</p></article>
            <div class="channelTextArea_fixture"><div role="textbox" aria-label="Message" contenteditable="true" data-slate-editor="true">Salut, on se rejoint ce soir ?</div></div><div class="hint">Entrée pour envoyer · Maj + Entrée pour une nouvelle ligne</div></main></body></html>`));
        const result = await window.webContents.executeJavaScript(`(async()=>{
            const module={exports:{}};new Function('module',${JSON.stringify(code)})(module);
            const {setSmoothTyping}=module.exports;
            const frames=async()=>{await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);};
            const editor=document.querySelector('[contenteditable]');
            const original=editor.innerHTML;
            const at=offset=>{editor.focus();const range=document.createRange();range.setStart(editor.firstChild,offset);range.collapse(true);document.getSelection().removeAllRanges();document.getSelection().addRange(range);document.dispatchEvent(new Event('selectionchange'));};
            const check=(value,message)=>{if(!value)throw Error(message);};
            at(5);setSmoothTyping(true);setSmoothTyping(true);await frames();
            check(document.querySelectorAll('.pc-smooth-caret').length===1,'Must create exactly one caret');
            check(editor.hasAttribute('data-pc-smooth-caret'),'Native caret must only hide once overlay is valid');
            const caret=document.querySelector('.pc-smooth-caret');
            check(getComputedStyle(caret).pointerEvents==='none','Caret must not intercept clicks');
            const first=caret.style.transform;at(6);await frames();
            check(caret.style.transform!==first && caret.style.transitionDuration==='90ms','Typing position must transition');
            const range=document.createRange();range.setStart(editor.firstChild,0);range.setEnd(editor.firstChild,5);document.getSelection().removeAllRanges();document.getSelection().addRange(range);document.dispatchEvent(new Event('selectionchange'));await frames();
            check(!document.querySelector('.pc-smooth-caret')&&!editor.hasAttribute('data-pc-smooth-caret'),'Text selection must use native rendering');
            at(8);await frames();editor.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));
            check(!document.querySelector('.pc-smooth-caret'),'IME composition must use native caret');
            editor.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true}));await frames();
            check(!!document.querySelector('.pc-smooth-caret'),'Must resume after composition');
            window.dispatchEvent(new Event('blur'));check(!document.querySelector('.pc-smooth-caret'),'Blur must remove the overlay');
            window.dispatchEvent(new Event('focus'));await frames();
            check(editor.innerHTML===original,'Animation must never rewrite message content');
            const input=document.createElement('input');document.body.append(input);input.focus();await frames();
            check(!document.querySelector('.pc-smooth-caret'),'Ordinary inputs must remain native');
            let scheduled=0;const nativeFrame=window.requestAnimationFrame;window.requestAnimationFrame=callback=>{scheduled++;return nativeFrame(callback);};
            for(let i=0;i<100;i++){document.dispatchEvent(new Event('scroll'));input.dispatchEvent(new Event('input',{bubbles:true}));}
            window.requestAnimationFrame=nativeFrame;
            check(scheduled===0,'Unrelated input/scroll must schedule no editor geometry work');input.remove();
            at(10);await frames();setSmoothTyping(false);
            check(!document.querySelector('.pc-smooth-caret')&&!editor.hasAttribute('data-pc-smooth-caret'),'Disable must restore native caret');
            document.dispatchEvent(new Event('selectionchange'));await frames();check(!document.querySelector('.pc-smooth-caret'),'Disable must remove listeners');
            setSmoothTyping(true);at(editor.firstChild.length);await frames();
            window.previewSmoothTyping=async()=>{at(editor.firstChild.length);await frames();for(const animation of document.querySelector('.pc-smooth-caret').getAnimations({subtree:true})){animation.pause();animation.currentTime=0;}};
            return {singleCaret:true,transition:true,selection:true,composition:true,blur:true,contentPreserved:true,nativeInputs:true,noUnrelatedFrames:true,cleanup:true};
        })()`);
        await fs.mkdir('dist/qa',{recursive:true});
        await window.webContents.executeJavaScript('window.previewSmoothTyping()');
        await fs.writeFile('dist/qa/smooth-typing-desktop.png',(await window.webContents.capturePage()).toPNG());
        window.setSize(480,480);
        await window.webContents.executeJavaScript('window.previewSmoothTyping()');
        await fs.writeFile('dist/qa/smooth-typing-compact.png',(await window.webContents.capturePage()).toPNG());
        window.webContents.setZoomFactor(1.25);
        await window.webContents.executeJavaScript('window.previewSmoothTyping()');
        result.zoom=await window.webContents.executeJavaScript(`(()=>{const caret=document.querySelector('.pc-smooth-caret'),rect=document.getSelection().getRangeAt(0).getBoundingClientRect();return !!caret&&Math.abs(caret.getBoundingClientRect().left-rect.left)<1;})()`);
        if(!result.zoom)throw Error('Caret must track geometry at 125% zoom');
        await window.webContents.executeJavaScript(`window.previewSmoothTyping();`);
        // Reduced-motion switches are exercised through Chromium's actual media emulation.
        window.webContents.debugger.attach('1.3');
        await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
        await new Promise(resolve=>setTimeout(resolve,100));
        result.reducedMotion=await window.webContents.executeJavaScript(`!document.querySelector('.pc-smooth-caret')&&!document.querySelector('[data-pc-smooth-caret]')`);
        window.webContents.debugger.detach();
        if(!result.reducedMotion)throw Error('Reduced motion must preserve native caret');
        await fs.writeFile('dist/qa/smooth-typing.json',JSON.stringify(result,null,2));
        console.log(JSON.stringify(result));app.exit(0);
    }catch(error){console.error(error);app.exit(1);}
});
