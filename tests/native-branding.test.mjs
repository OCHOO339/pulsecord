import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
import vm from 'node:vm';
const require = createRequire(new URL('../upstream/equicord/package.json', import.meta.url));
const { transform } = require('esbuild');
const compiled = await transform(await readFile('packages/pulsecord/nativeBrand.ts', 'utf8'), { loader: 'ts', format: 'cjs' });
function fixture() {
    let decoded = 0;
    const image = { pulse: true };
    class Window {
        constructor(options) { this.options = options; this.inserted = []; this.webContents = new EventEmitter(); this.url = 'https://discord.com/app'; this.webContents.getURL = () => this.url; this.webContents.insertCSS = async css => this.inserted.push(css); }
        setIcon(value) { this.icon = value; }
    }
    class Tray { constructor(value, guid) { this.initial = value; this.guid = guid; } setImage(value) { this.image = value; } }
    const electron = { BrowserWindow: Window, Tray, nativeImage: { createFromDataURL(value) { assert.equal(value, 'large-logo'); decoded++; return image; } } };
    const context = { module: { exports: {} }, URL, process: { platform: 'win32' }, console,
        require(name) {
            if (name === 'electron') return { __esModule: true, default: electron, app: {} };
            if (name === '@pulsecord/brand') return { brand: { logo: 'small-logo', splashLogo: 'large-logo' } };
            if (name === '@pulsecord/branding') return { brandingCss: () => 'pulse-branding-css' };
            throw Error(name);
        }
    };
    vm.createContext(context); vm.runInContext(compiled.code, context);
    return { api: context.module.exports, image, decoded: () => decoded };
}
test('window and tray always use one cached Pulse image, including later icon updates', () => {
    const f = fixture(); const window = new f.api.PulseWindow({ title: 'Discord' });
    assert.equal(window.options.icon, f.image); assert.equal(window.options.title, 'Discord');
    window.setIcon('discord.png'); assert.equal(window.icon, f.image);
    const tray = new f.api.PulseTray('discord-tray.png', 'existing-guid');
    assert.equal(tray.initial, f.image); assert.equal(tray.guid, 'existing-guid');
    tray.setImage('discord-unread.png'); assert.equal(tray.image, f.image); assert.equal(f.decoded(), 1);
});
test('window branding only injects CSS on Discord and bundled splash pages', () => {
    const f = fixture(); const window = new f.api.PulseWindow({});
    for (const url of ['https://discord.com/app', 'https://canary.discord.com/app', 'file:///C:/Discord/resources/_app.asar/splash/index.html']) {
        window.url = url; window.webContents.emit('dom-ready');
    }
    assert.equal(window.inserted.length, 3);
    for (const url of ['https://example.com/', 'https://discord.com.example.org/', 'about:blank', 'file:///C:/other.html']) { window.url = url; window.webContents.emit('dom-ready'); }
    assert.equal(window.inserted.length, 3);
});
