// Standalone check that branding preserves Discord's native home button.
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
        const icon = '<svg class="discordLogo__native" width="24" height="24"><path d="M19.73 4.87h1v1z" fill="white"/></svg>';
        await window.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`<!doctype html><style>
            body{background:#121214} [data-guilds-bar-home]{width:64px;height:40px}
            [role=button],.childWrapper__native{width:40px;height:40px;display:grid;place-items:center;background:#252529;border-radius:12px}
            [role=button]{margin-left:12px}
            </style><div data-guilds-bar-home><div role="button" tabindex="0">${icon}</div></div>
            <a data-list-item-id="guildsnav___home" href="/channels/@me"><div class="childWrapper__native discordLogo__native">${icon}</div></a>`));
        const inspect = `Array.from(document.querySelectorAll('[data-guilds-bar-home],[data-list-item-id]')).map(root=>{
            const button=root.firstElementChild,svg=root.querySelector('svg');
            return {width:button.offsetWidth,height:button.offsetHeight,left:button.getBoundingClientRect().left,background:getComputedStyle(button).backgroundColor,rootBefore:getComputedStyle(root,'::before').content,rootAfter:getComputedStyle(root,'::after').content,buttonAfter:getComputedStyle(button,'::after').content,svgBackground:getComputedStyle(svg).backgroundImage,svgOpacity:getComputedStyle(svg).opacity,pathOpacity:getComputedStyle(svg.firstElementChild).opacity};
        })`;
        const before = await window.webContents.executeJavaScript(inspect);
        await window.webContents.insertCSS(brandingCss(logo));
        const after = await window.webContents.executeJavaScript(inspect);
        assert.deepEqual(after, before, 'Branding must not change native home geometry, backgrounds, SVGs or pseudo-elements');
        console.log('Home branding: native Discord buttons preserved for modern and legacy markup.');
        app.exit(0);
    } catch (error) { console.error(error); app.exit(1); }
});
