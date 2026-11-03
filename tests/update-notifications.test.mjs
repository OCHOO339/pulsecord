import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../upstream/equicord/package.json', import.meta.url));
const { transform } = require('esbuild');
test('an available update sends one OFFICIAL notification, records an inbox announcement, opens the conversation and cleans its timers', async () => {
    const source = await transform(await readFile('packages/pulsecord/updates.tsx', 'utf8'), { loader: 'tsx', format: 'cjs' });
    const notifications = []; const timers = new Map(); const seen = new Set(); let opened; let id = 0;
    const context = { module: { exports: {} }, IS_DISCORD_DESKTOP: true,
        setTimeout(fn, delay) { timers.set(++id, { fn, delay }); return id; }, clearTimeout(key) { timers.delete(key); },
        setInterval(fn, delay) { timers.set(++id, { fn, delay }); return id; }, clearInterval(key) { timers.delete(key); },
        VencordNative: { pluginHelpers: { PulseCord: { checkForUpdates: async () => ({ phase: 'available', configured: true, currentVersion: '1.0.0', nextBuild: 'signed-build' }) } } },
        require(name) {
            if (name === '@api/Notifications') return { showNotification: async data => notifications.push(data) };
            if (name === '@components/ErrorBoundary') return { __esModule: true, default: { wrap: component => component } };
            if (name === '@components/settings/tabs/BaseTab') return { openSettingsTabModal: component => { opened = component; } };
            if (name === '@utils/Logger') return { Logger: class { warn() {} } };
            if (name === '@webpack/common') return { React: {} };
            if (name === './markdown') return { AnnouncementMarkdown: () => null };
            if (name === './brand') return { brand: { version: '1.0.0', logo: 'pulse-logo', accent: '#f8c332', updates: { publicKey: 'public-key' } } };
            throw Error(name);
        }
    };
    vm.createContext(context); vm.runInContext(source.code, context);
    const api = context.module.exports;
    const reports = [];
    api.startUpdates(build => { if (seen.has(build)) return false; seen.add(build); return true; }, next => reports.push(next.nextBuild), () => { opened = 'inbox'; });
    assert.equal(timers.size, 2);
    [...timers.values()].find(timer => timer.delay === 8000).fn(); await new Promise(setImmediate);
    assert.equal(notifications.length, 1); assert.equal(notifications[0].title, 'PulseCord OFFICIAL'); assert.equal(notifications[0].icon, 'pulse-logo');
    assert.deepEqual(reports, ['signed-build']);
    notifications[0].onClick(); assert.equal(opened, 'inbox');
    [...timers.values()].find(timer => timer.delay === 3600000).fn(); await new Promise(setImmediate);
    assert.equal(notifications.length, 1);
    api.stopUpdates(); assert.equal(timers.size, 0);
});
