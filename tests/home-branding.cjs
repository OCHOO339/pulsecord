// Standalone rendering check: no prepared Equicord checkout is needed.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs/promises');
const { stripTypeScriptTypes } = require('node:module');
const assert = require('node:assert/strict');

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
    try {
        const source = stripTypeScriptTypes(await fs.readFile('packages/pulsecord/branding.ts', 'utf8'));
        const { brandingCss } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
        const logo = 'data:image/png;base64,' + (await fs.readFile('assets/pulsecord-avatar.png')).toString('base64');
        const window = new BrowserWindow({ show: false, width: 360, height: 420, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
        const html = `<!doctype html><style>
            body{margin:0;background:#121214;color:#eee;font-family:system-ui}main{display:flex;gap:24px;padding:24px}
            .rail{width:64px;display:flex;flex-direction:column;align-items:center;gap:12px}
            [data-guilds-bar-home]{width:64px}
            [role=button],.server{width:40px;height:40px;border-radius:14px;background:#252529;display:grid;place-items:center}
            [role=button]{margin-left:12px}
            .wide [role=button]{width:48px;height:40px;margin-left:8px}
            ${brandingCss(logo)}
            </style><main>${[40,48].map(size => `<section class="rail ${size === 48 ? 'wide' : ''}">
            <div data-guilds-bar-home><div role="button" tabindex="0"><svg width="24" height="24"><path d="M0 0h24v24z"/></svg></div></div>
            <div class="server">Y</div><div class="server">S</div><span>${size} px</span></section>`).join('')}</main>`;
        await window.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
        const measurements = await window.webContents.executeJavaScript(`Array.from(document.querySelectorAll('[data-guilds-bar-home]')).map(wrapper => {
            const button=wrapper.firstElementChild, bg=getComputedStyle(button,'::before'), mark=getComputedStyle(button,'::after');
            return {width:button.offsetWidth,height:button.offsetHeight,backgroundWidth:parseFloat(bg.width),backgroundHeight:parseFloat(bg.height),markWidth:parseFloat(mark.width),paintLeft:button.getBoundingClientRect().left+parseFloat(bg.left)+parseFloat(bg.marginLeft),serverLeft:wrapper.nextElementSibling.getBoundingClientRect().left,wrapperPaint:getComputedStyle(wrapper,'::before').content,hidden:getComputedStyle(button.firstElementChild).opacity};
        })`);
        for (const [index, value] of measurements.entries()) {
            assert.equal(value.width, index === 0 ? 40 : 48);
            assert.equal(value.height, 40);
            assert.equal(value.backgroundWidth, 40);
            assert.equal(value.backgroundHeight, 40);
            assert.equal(value.markWidth, 32);
            assert.equal(value.paintLeft, value.serverLeft, 'The painted logo must align with the server icons');
            assert.equal(value.wrapperPaint, 'none');
            assert.equal(value.hidden, '0');
        }
        await fs.mkdir('dist/qa', { recursive: true });
        await fs.writeFile('dist/qa/pulsecord-home.png', (await window.webContents.capturePage()).toPNG());
        window.webContents.sendInputEvent({ type: 'mouseMove', x: 40, y: 40 });
        await new Promise(resolve => setTimeout(resolve, 100));
        const hover = await window.webContents.executeJavaScript(`getComputedStyle(document.querySelector('[role=button]'),'::before').backgroundColor`);
        assert.equal(hover, 'rgb(248, 195, 50)');
        await fs.writeFile('dist/qa/pulsecord-home-hover.png', (await window.webContents.capturePage()).toPNG());
        console.log('Home branding: 40 x 40 px backgrounds align with adjacent servers, native button spacing preserved, hover verified.');
        app.exit(0);
    } catch (error) { console.error(error); app.exit(1); }
});
