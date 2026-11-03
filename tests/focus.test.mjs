import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire(new URL('../upstream/equicord/package.json', import.meta.url));
const { transform } = require('esbuild');
test('Focus plugin toggles via keyboard, persists state and removes listener/style', async () => {
    const compiled = await transform(await readFile('packages/focus/index.ts', 'utf8'), { loader: 'ts', format: 'cjs' });
    const listeners = new Map(); let style; let removed = false;
    const context = {
        module: { exports: {} },
        require(name) {
            if (name === '@utils/constants') return { Devs: { PulseCord: { name: 'PulseCord contributors', id: 0n } } };
            if (name === '@utils/types') return { __esModule: true, default: p => p, OptionType: { BOOLEAN: 1 } };
            return { definePluginSettings(def) { const store = new Proxy({ active: def.active.default }, { set(target, key, value) { target[key] = value; def[key].onChange(); return true; } }); return { store }; } };
        },
        document: {
            createElement() { return { textContent: '', remove() { removed = true; } }; },
            head: { append(value) { style = value; } },
            addEventListener(name, fn) { listeners.set(name, fn); },
            removeEventListener(name, fn) { assert.equal(listeners.get(name), fn); listeners.delete(name); }
        }
    };
    vm.createContext(context); vm.runInContext(compiled.code, context);
    const plugin = context.module.exports.default;
    plugin.start(); assert.equal(style.textContent, ''); assert.equal(listeners.size, 1);
    let prevented = false;
    listeners.get('keydown')({ ctrlKey: true, altKey: true, code: 'KeyF', repeat: false, preventDefault() { prevented = true; } });
    assert.equal(prevented, true); assert.equal(plugin.settings.store.active, true); assert.match(style.textContent, /display: none/);
    plugin.stop(); assert.equal(listeners.size, 0); assert.equal(removed, true);
    plugin.start(); assert.match(style.textContent, /display: none/); plugin.stop();
});
