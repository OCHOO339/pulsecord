import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire(new URL('../upstream/equicord/package.json', import.meta.url));
const { transform } = require('esbuild');
const { code } = await transform(await readFile('packages/biorotator/index.ts', 'utf8'), { loader: 'ts', format: 'cjs' });
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

function fixture({ bio = 'Ma bio originale', patch = async () => {}, get = async () => ({ body: { user_profile: { bio: 'Bio chargée' } } }) } = {}) {
    let definitions, userId = 'self', sequence = 0;
    const timers = new Map(), writes = [], errors = [];
    const context = { module: { exports: {} }, Date,
        setTimeout(callback, delay) { const id = ++sequence; timers.set(id, { callback, delay }); return id; },
        clearTimeout(id) { timers.delete(id); },
        require(name) {
            if (name === '@api/Settings') return { definePluginSettings(def) {
                definitions = def;
                return { withPrivateSettings: () => ({ store: Object.fromEntries(Object.entries(def).map(([key, option]) => [key, option.default])) }) };
            } };
            if (name === '@utils/Logger') return { Logger: class { error(...args) { errors.push(args); } } };
            if (name === '@utils/types') return { __esModule: true, default: value => value, OptionType: { BOOLEAN: 1, STRING: 2, SLIDER: 3 } };
            if (name === '@webpack/common') return {
                UserStore: { getCurrentUser: () => ({ id: userId }) },
                UserProfileStore: { getUserProfile: () => ({ bio }) },
                RestAPI: { get, async patch(request) { writes.push(request.body.bio); await patch(request); } }
            };
            throw Error(name);
        }
    };
    vm.runInNewContext(code, context);
    const plugin = context.module.exports.default;
    return { plugin, writes, timers, errors,
        change(key, value) { plugin.settings.store[key] = value; definitions[key]?.onChange?.(); },
        user(id) { userId = id; },
        async next() { assert.equal(timers.size, 1); const [id, timer] = timers.entries().next().value; timers.delete(id); timer.callback(); await flush(); }
    };
}

test('BioRotator rotates five phrases, restores the original bio and removes its timer', async () => {
    const f = fixture();
    f.change('phrases', 'une\n\ndeux\ntrois\nquatre\ncinq\nsix');
    f.plugin.start(); await flush();
    for (let i = 0; i < 5; i++) await f.next();
    assert.deepEqual(f.writes, ['une', 'deux', 'trois', 'quatre', 'cinq', 'une']);
    await f.plugin.stop();
    assert.equal(f.writes.at(-1), 'Ma bio originale');
    assert.equal(f.timers.size, 0);
});

test('stopping during a request serializes restoration and never reschedules rotation', async () => {
    let complete;
    const f = fixture({ patch: () => new Promise(resolve => { complete = resolve; }) });
    f.plugin.start(); await flush();
    const stopped = f.plugin.stop();
    complete(); await flush();
    assert.deepEqual(f.writes, ['phrase 1', 'Ma bio originale']);
    complete(); await stopped;
    assert.equal(f.timers.size, 0);
});

test('unknown original bio is fetched before changing it; unreadable profiles are preserved', async () => {
    const g = fixture({ bio: null });
    g.plugin.start(); await flush();
    await g.plugin.stop();
    assert.deepEqual(g.writes, ['phrase 1', 'Bio chargée']);
    const h = fixture({ bio: null, get: async () => ({ body: {} }) });
    h.plugin.start(); await flush();
    assert.equal(h.writes.length, 0);
    assert.equal(h.errors.length, 1);
    await h.plugin.stop();
});

test('pause removes timers, API failures back off and never restore a different account', async () => {
    const f = fixture({ patch: async () => { throw { body: { retry_after: 120 } }; } });
    f.plugin.start(); await flush();
    assert.ok([...f.timers.values()][0].delay > 119000);
    f.change('active', false); await flush();
    assert.equal(f.timers.size, 0);
    f.user('other');
    await f.plugin.stop();
    assert.equal(f.writes.length, 1);
});
