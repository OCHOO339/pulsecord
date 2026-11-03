import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../upstream/equicord/package.json', import.meta.url));
const { transform } = require('esbuild');
const compiled = await transform(await readFile('packages/pulsecord/startup.ts', 'utf8'), { loader: 'ts', format: 'cjs' });
function fixture(reduced = false) {
    const elements = []; const timers = new Map(); let allocations = 0;
    const context = { module: { exports: {} },
        window: { matchMedia: () => ({ matches: reduced }) },
        document: { createElement() { allocations++; return { append() {}, setAttribute() {}, remove() { const i = elements.indexOf(this); if (i !== -1) elements.splice(i, 1); } }; }, body: { append(el) { elements.push(el); } } },
        setTimeout(callback, delay) { timers.set(1, { callback, delay }); return 1; }, clearTimeout(id) { timers.delete(id); }
    };
    vm.createContext(context); vm.runInContext(compiled.code, context);
    return { api: context.module.exports, elements, timers, allocations: () => allocations };
}
test('startup plays once, expires after 1150 ms and releases all resources', () => {
    const f = fixture(); f.api.showStartup('data:image/png;base64,test', true);
    assert.equal(f.elements.length, 1); assert.equal(f.timers.size, 1); assert.equal(f.timers.get(1).delay, 1150);
    f.api.showStartup('same', true); assert.equal(f.allocations(), 2);
    f.timers.get(1).callback(); assert.equal(f.elements.length, 0); assert.equal(f.timers.size, 0);
    f.api.showStartup('same', true); assert.equal(f.elements.length, 0);
});
test('startup allocates nothing when disabled or reduced motion is enabled', () => {
    for (const [reduced, enabled] of [[true, true], [false, false]]) {
        const f = fixture(reduced); f.api.showStartup('logo', enabled);
        assert.equal(f.allocations(), 0); assert.equal(f.timers.size, 0);
    }
});
test('stopping the plugin removes an active splash and cancels its timer', () => {
    const f = fixture(); f.api.showStartup('logo', true); f.api.stopStartup(); f.api.stopStartup();
    assert.equal(f.elements.length, 0); assert.equal(f.timers.size, 0);
});
