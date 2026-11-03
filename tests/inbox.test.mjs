import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../upstream/equicord/package.json', import.meta.url));
const { transform } = require('esbuild');
const code = (await transform(await readFile('packages/pulsecord/inbox-store.ts', 'utf8'), { loader: 'ts', format: 'cjs' })).code;
function load(store) {
    const context = { module: { exports: {} }, console, require(name) { assert.equal(name, '@api/DataStore'); return store; } };
    vm.createContext(context); vm.runInContext(code, context); return context.module.exports;
}

test('official inbox persists announcements, deduplicates builds and marks messages read only when opened', async () => {
    let stored;
    const store = { get: async () => stored, set: async (_, value) => { stored = structuredClone(value); } };
    const api = load(store);
    await api.loadInbox(); assert.equal(api.getInboxUnread(), 1);
    api.addInboxUpdate('one', 'Nouveaux plugins'); api.addInboxUpdate('one', 'duplicate');
    assert.equal(api.getInboxMessages().length, 2); assert.equal(api.getInboxUnread(), 2);
    api.setInboxOpen(true); assert.equal(api.getInboxUnread(), 0);
    api.addInboxUpdate('two'); assert.equal(api.getInboxUnread(), 0);
    api.setInboxOpen(false); api.addInboxUpdate('three'); assert.equal(api.getInboxUnread(), 1);
    await new Promise(setImmediate);
    const restored = load(store); await restored.loadInbox();
    assert.equal(restored.getInboxMessages().length, 4); assert.equal(restored.getInboxUnread(), 1);
});

test('an announcement arriving while history loads is merged with stored messages', async () => {
    let resolve;
    const api = load({ get: () => new Promise(done => { resolve = done; }), set: async () => {} });
    const loading = api.loadInbox(); api.addInboxUpdate('new');
    resolve([{ id: 'update:old', timestamp: 1, text: 'Previous announcement', read: true }, { id: 17, text: null }]);
    await loading;
    assert.equal(api.getInboxMessages().some(message => message.id === 'update:old'), true);
    assert.equal(api.getInboxMessages().some(message => message.id === 'update:new'), true);
    assert.equal(api.getInboxMessages().length, 3);
});

test('stopping the inbox invalidates an outstanding history load', async () => {
    let resolve;
    const api = load({ get: () => new Promise(done => { resolve = done; }), set: async () => {} });
    const loading = api.loadInbox(); api.stopInboxStore(); resolve([]); await loading;
    assert.equal(api.getInboxMessages().length, 0); assert.equal(api.isInboxOpen(), false);
});
