import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
const require = createRequire(new URL('../upstream/equicord/package.json', import.meta.url));
const { transform } = require('esbuild');
const { code } = await transform(await readFile('packages/statusrotator/index.ts', 'utf8'), { loader: 'ts', format: 'cjs' });
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const original = { text: 'Mon statut', emojiId: '0', emojiName: '🎮', expiresAtMs: '0' };

function fixture({ initial = original, update = async () => {} } = {}) {
    let definitions, userId = 'self', sequence = 0, status = initial;
    const timers = new Map(), writes = [], errors = [];
    const context = { module: { exports: {} }, Date, Intl,
        setTimeout(callback, delay) { const id = ++sequence; timers.set(id, { callback, delay }); return id; },
        clearTimeout(id) { timers.delete(id); },
        require(name) {
            if (name === '@api/Settings') return { definePluginSettings(def) {
                definitions = def;
                return { withPrivateSettings: () => ({ store: Object.fromEntries(Object.entries(def).map(([key, option]) => [key, option.default])) }) };
            } };
            if (name === '@api/UserSettings') return { getUserSettingLazy(group, key) {
                assert.equal(group, 'status'); assert.equal(key, 'customStatus');
                return { getSetting: () => status, async updateSetting(value) {
                    writes.push(JSON.parse(JSON.stringify(value)));
                    await update(value); status = value;
                } };
            } };
            if (name === '@utils/Logger') return { Logger: class { error(...args) { errors.push(args); } } };
            if (name === '@utils/types') return { __esModule: true, default: value => value, OptionType: { BOOLEAN: 1, STRING: 2, SLIDER: 3 } };
            // No profile stores or HTTP methods: this plugin cannot change the bio.
            if (name === '@webpack/common') return {
                UserStore: { getCurrentUser: () => ({ id: userId }) },
                EmojiStore: { getCustomEmojiById: id => id === '123456789012345678' ? { name: 'pulse' } : undefined }
            };
            throw Error(name);
        }
    };
    vm.runInNewContext(code, context);
    const plugin = context.module.exports.default;
    return { plugin, writes, timers, errors,
        change(key, value) { plugin.settings.store[key] = value; definitions[key]?.onChange?.(); },
        validateEmoji(value) { return definitions.emoji.isValid(value); },
        user(id) { userId = id; },
        async next() { assert.equal(timers.size, 1); const [id, timer] = timers.entries().next().value; timers.delete(id); timer.callback(); await flush(); }
    };
}

test('StatusRotator rotates only custom status, preserves emoji and restores the original', async () => {
    const f = fixture();
    assert.equal(f.plugin.name, 'StatusRotator');
    assert.ok(f.plugin.dependencies.includes('UserSettingsAPI'));
    f.change('phrases', 'une\n\ndeux\ntrois\nquatre\ncinq\nsix');
    f.plugin.start(); await flush();
    for (let i = 0; i < 5; i++) await f.next();
    assert.deepEqual(f.writes.map(status => status.text), ['une', 'deux', 'trois', 'quatre', 'cinq', 'une']);
    assert.ok(f.writes.every(status => status.emojiName === '🎮' && status.expiresAtMs === '0'));
    await f.plugin.stop();
    assert.deepEqual(f.writes.at(-1), original);
    assert.equal(f.timers.size, 0);
});

test('stop during an update serializes restoration and never reschedules rotation', async () => {
    let complete;
    const f = fixture({ update: () => new Promise(resolve => { complete = resolve; }) });
    f.plugin.start(); await flush();
    const stopped = f.plugin.stop();
    complete(); await flush();
    assert.deepEqual(f.writes.map(status => status.text), ['phrase 1', 'Mon statut']);
    complete(); await stopped;
    assert.equal(f.timers.size, 0);
});

test('empty and expired original statuses restore to an empty custom status', async () => {
    for (const initial of [null, { ...original, expiresAtMs: '1' }]) {
        const f = fixture({ initial });
        f.plugin.start(); await flush();
        await f.plugin.stop();
        assert.equal(f.writes.at(-1).text, '');
        assert.equal(f.writes.at(-1).emojiName, '');
    }
});

test('pause removes timers, errors back off and restoration cannot affect a different account', async () => {
    const f = fixture({ update: async () => { throw { body: { retry_after: 120 } }; } });
    f.plugin.start(); await flush();
    assert.ok([...f.timers.values()][0].delay > 119000);
    f.change('active', false); await flush();
    assert.equal(f.timers.size, 0);
    f.user('other');
    await f.plugin.stop();
    assert.equal(f.writes.length, 1);
});

test('long status text is bounded without splitting a Unicode character', async () => {
    const f = fixture();
    f.change('phrases', '🎮'.repeat(150));
    f.plugin.start(); await flush();
    assert.equal(Array.from(f.writes[0].text).length, 128);
    await f.plugin.stop();
});

test('emoji setting accepts Unicode, custom IDs and Discord markup, then restores the original emoji', async () => {
    for (const [input, id, name] of [
        ['🔥', '0', '🔥'], ['👨‍👩‍👧‍👦', '0', '👨‍👩‍👧‍👦'], ['🇫🇷', '0', '🇫🇷'],
        ['123456789012345678', '123456789012345678', 'pulse'],
        ['<:wave:234567890123456789>', '234567890123456789', 'wave'],
        ['<a:dance:234567890123456789>', '234567890123456789', 'dance']
    ]) {
        const f = fixture();
        assert.equal(f.validateEmoji(input), true);
        f.change('emoji', input); f.plugin.start(); await flush();
        assert.equal(f.writes[0].emojiId, id); assert.equal(f.writes[0].emojiName, name);
        await f.plugin.stop(); assert.deepEqual(f.writes.at(-1), original);
    }
});

test('changing only the emoji updates a matching status text; invalid inputs are rejected', async () => {
    const f = fixture();
    f.change('phrases', original.text); f.plugin.start(); await flush();
    assert.equal(f.writes.length, 0);
    f.change('emoji', '🔥'); await flush();
    assert.equal(f.writes.at(-1).emojiName, '🔥');
    for (const value of ['hello', '123', '<:x:123>', '🔥🔥', '99999999999999999999']) {
        assert.notEqual(f.validateEmoji(value), true);
    }
    await f.plugin.stop();
});
