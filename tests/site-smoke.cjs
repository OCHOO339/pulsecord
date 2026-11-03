const { app, BrowserWindow } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
app.disableHardwareAcceleration();
app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
    const results = [];
    try {
        await fs.mkdir('dist/qa', { recursive: true });
        for (const width of [1440, 768, 390]) {
            const window = new BrowserWindow({ width, height: 1000, show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
            await window.loadURL(pathToFileURL(path.resolve('site/index.html')).href);
            const result = await window.webContents.executeJavaScript(`(() => {
                document.querySelector('[data-theme="AMOLED"]').click();
                return { width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth, selected: document.querySelector('#palette-name').textContent, links: [...document.querySelectorAll('a')].map(a => a.getAttribute('href')) };
            })()`);
            if (result.overflow || result.selected !== 'AMOLED') throw Error(JSON.stringify(result));
            for (const link of result.links.filter(link => link.startsWith('../'))) await fs.access(path.resolve('site', link));
            await new Promise(resolve => setTimeout(resolve, 200));
            await fs.writeFile(`dist/qa/site-${width}.png`, (await window.webContents.capturePage()).toPNG());
            results.push(result); window.destroy();
        }
        await fs.writeFile('dist/qa/site-smoke.json', JSON.stringify(results, null, 2)); app.exit(0);
    } catch (error) { console.error(error); app.exit(1); }
});
