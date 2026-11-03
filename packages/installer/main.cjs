// SPDX-License-Identifier: GPL-3.0
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { isTrustedSender } = require('./trusted-sender.cjs');
const { selectTargets, runOperations } = require('./operations.cjs');
const lifecycle = require('./discord-process.cjs');
let window;
let busy = false;
let candidates = [];
const smoke = process.argv.includes('--smoke-test');
if (smoke) app.disableHardwareAcceleration();
app.whenReady().then(async () => {
    const core = await import('./core.mjs');
    window = new BrowserWindow({ show: !smoke, width: 600, height: 440, minWidth: 540, minHeight: 420, frame: false, title: 'PulseCord Installer', icon: path.join(__dirname, 'assets/pulsecord-logo.png'), backgroundColor: '#0c0d10', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
    window.setMenuBarVisibility(false);
    const url = pathToFileURL(path.join(__dirname, 'index.html')).href;
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', e => e.preventDefault());
    function check(event) { if (!isTrustedSender(event, window.webContents, url)) throw Error('Untrusted sender'); }
    window.on('close', event => { if (busy) event.preventDefault(); });
    ipcMain.handle('license', async event => {
        check(event);
        return require('node:fs/promises').readFile(app.isPackaged ? path.join(app.getAppPath(), 'LICENSE') : path.resolve(__dirname, '../../LICENSE'), 'utf8');
    });
    ipcMain.handle('window-control', (event, action) => {
        check(event);
        if (action === 'minimize') window.minimize();
        else if (action === 'close' && !busy) window.close();
        else if (action !== 'close') throw Error('Invalid window action');
    });
    ipcMain.handle('list', async event => { check(event); candidates = await core.discover(); return candidates; });
    ipcMain.handle('choose', async event => {
        check(event);
        const result = await dialog.showOpenDialog(window, { title: 'Select Discord resources directory', properties: ['openDirectory'] });
        if (!result.canceled) candidates.push({ name: 'Selected installation', resources: result.filePaths[0] });
        return candidates;
    });
    ipcMain.handle('operate', async (event, action, index) => {
        check(event);
        if (busy || !['install', 'uninstall', 'rollback'].includes(action) || !Number.isInteger(index) || !candidates[index]) throw Error('Invalid operation');
        busy = true;
        try {
            const targets = [candidates[index]];
            const answer = smoke ? { response: 0 } : await dialog.showMessageBox(window, { type: 'question', buttons: ['Annuler', 'Continuer'], defaultId: 0, cancelId: 0, message: `${action}: ${targets[0].name}`, detail: `Discord sera fermé automatiquement puis relancé à la fin.\n${targets[0].resources}` });
            if (answer.response !== 1) return 'Cancelled';
            return await runOperations({ core, action, targets, lifecycle,
                bundle: app.isPackaged ? path.join(process.resourcesPath, 'bundle') : path.resolve(__dirname, '../../dist/bundle'),
                loader: path.join(__dirname, 'loader.cjs'),
                progress: value => { if (!window.isDestroyed()) window.webContents.send('operation-progress', value); }
            });
        }
        finally { busy = false; }
    });
    ipcMain.handle('operate-many', async (event, action, indexes) => {
        check(event);
        if (busy) throw Error('Une opération est déjà en cours.');
        const targets = selectTargets(action, indexes, candidates);
        busy = true;
        try {
            const answer = smoke ? { response: 0 } : await dialog.showMessageBox(window, {
                type: 'question', buttons: ['Annuler', 'Continuer'], defaultId: 0, cancelId: 0,
                message: `Confirmer : ${action === 'uninstall' ? 'désinstallation' : action === 'rollback' ? 'restauration' : 'installation de PulseCord'}`,
                detail: `Discord sera fermé automatiquement puis relancé à la fin.\n\n${targets.map(target => `${target.name}\n${target.resources}`).join('\n\n')}`
            });
            if (answer.response !== 1) return { cancelled: true };
            return await runOperations({ core, action, targets, lifecycle,
                bundle: app.isPackaged ? path.join(process.resourcesPath, 'bundle') : path.resolve(__dirname, '../../dist/bundle'),
                loader: path.join(__dirname, 'loader.cjs'),
                progress: value => { if (!window.isDestroyed()) window.webContents.send('operation-progress', value); }
            });
        } finally { busy = false; }
    });
    await window.loadURL(url);
    if (smoke) {
        try {
            const result = await window.webContents.executeJavaScript('(async () => { await window.pulsecordReady; return { title: document.querySelector("h1").textContent, bridge: typeof window.pulsecord.operate, installations: document.querySelectorAll("input[name=target]").length, status: document.querySelector("#status").textContent, nodeUnavailable: typeof require === "undefined" }; })()');
            if (result.bridge !== 'function' || !result.nodeUnavailable) throw Error('Renderer isolation check failed');
            const license = await window.webContents.executeJavaScript('window.pulsecord.license()');
            if (!license.includes('GNU GENERAL PUBLIC LICENSE')) throw Error('License could not be loaded');
            result.licenseLoaded = true;
            result.causeFontLoaded = await window.webContents.executeJavaScript('document.fonts.load("400 13px Cause").then(fonts => fonts.length > 0)');
            if (!result.causeFontLoaded) throw Error('Bundled Cause font could not be loaded');
            result.ipcAnchors = await window.webContents.executeJavaScript(`(async () => {
                const results = [];
                for (const hash of ['#install', '#recovery']) {
                    location.hash = hash;
                    const rows = await window.pulsecord.list();
                    if (rows.length) {
                        const response = await window.pulsecord.operate('install', 0);
                        if (response !== 'Cancelled') throw Error('Smoke confirmation must cancel');
                    } else {
                        try { await window.pulsecord.operate('install', -1); throw Error('Invalid index was accepted'); }
                        catch (error) { if (!error.message.includes('Invalid operation')) throw error; }
                    }
                    results.push({ hash, installations: rows.length, operationValidated: true, confirmationCancelled: rows.length > 0 });
                }
                return results;
            })()`);
            const fs = require('node:fs/promises');
            await fs.mkdir(path.resolve('dist/qa'), { recursive: true });
            const disk = require('original-fs').promises;
            const fixture = await disk.mkdtemp(path.join(require('node:os').tmpdir(), 'pulsecord-electron-test-'));
            try {
                const resources = path.join(fixture, 'resources');
                const bundle = path.join(fixture, 'bundle');
                await disk.mkdir(resources); await disk.mkdir(bundle);
                const original = core.makeAsar('C:/fixture/original.js');
                await disk.writeFile(path.join(resources, 'app.asar'), original);
                const code = '// PulseCord Electron installation fixture';
                await disk.writeFile(path.join(bundle, 'patcher.js'), code);
                await disk.writeFile(path.join(bundle, 'bundle.json'), JSON.stringify({ format: 1, files: { 'patcher.js': require('node:crypto').createHash('sha256').update(code).digest('hex') } }));
                const loaderSource = path.join(__dirname, 'loader.cjs');
                await core.install(resources, bundle, loaderSource);
                const expectedLoader = await fs.readFile(loaderSource);
                const installedLoader = await disk.readFile(path.join(resources, 'mycord-loader.cjs'));
                if (!expectedLoader.equals(installedLoader)) throw Error('Packaged loader was not installed correctly');
                const installation = await core.getInstallation(resources);
                if (!installation.loaderHash) throw Error('Stable loader was not recorded');
                result.packagedLoaderInstalled = true;
                await core.uninstall(resources);
                const restored = await disk.readFile(path.join(resources, 'app.asar'));
                if (!original.equals(restored)) throw Error('Electron installation fixture was not restored');
                result.electronInstallRestore = true;
            } finally { await disk.rm(fixture, { recursive: true, force: true }); }
            const archive = path.resolve('dist/qa/generated.asar');
            await fs.writeFile(archive, core.makeAsar('C:/test/patcher.js'));
            const actual = await fs.readFile(path.join(archive, 'index.js'), 'utf8');
            if (actual !== 'require("C:/test/patcher.js")') throw Error('Electron could not read generated ASAR');
            result.electronAsarRead = true;
            await new Promise(resolve => setTimeout(resolve, 300));
            await fs.writeFile(path.resolve('dist/qa/installer.png'), (await window.webContents.capturePage()).toPNG());
            await fs.writeFile(path.resolve('dist/qa/installer-smoke.json'), JSON.stringify(result, null, 2));
            if (app.isPackaged) await fs.writeFile(path.resolve('dist/qa/executable-icon.png'), (await app.getFileIcon(process.execPath, { size: 'large' })).toPNG());
            app.exit(0);
        } catch (e) { console.error(e); app.exit(1); }
    }
});
app.on('window-all-closed', () => app.quit());
