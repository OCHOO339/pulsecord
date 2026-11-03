import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../upstream/equicord/package.json', import.meta.url));
const { transform } = require('esbuild');
const compile = async file => (await transform(await readFile(file, 'utf8'), { loader: 'tsx', format: 'cjs' })).code;
const voiceCode = await compile('packages/voicekeeper/index.tsx');
const buttonCode = await compile('packages/pulsecord/voicekeeper-button.tsx');

function fixture() {
    const subscriptions = new Map(), timeouts = new Map(), intervals = new Map(), selected = [];
    const config = { returnOnMove: true, rejoinDelay: 750, maxAttempts: 0 };
    const saved = { plugins: { VoiceKeeper: { enabled: false } } };
    let timer = 0, fail = false;
    const common = {
        UserStore: { getCurrentUser: () => ({ id: 'self' }) },
        VoiceStateStore: { getVoiceStateForUser: () => ({ guildId: 'guild', channelId: 'voice' }), getVoiceState: () => ({ channelId: 'elsewhere' }) },
        ChannelStore: { getChannel: () => ({ guild_id: 'guild', name: 'Voice' }) },
        ChannelActions: { selectVoiceChannel: id => selected.push(id) },
        FluxDispatcher: { subscribe: (event, fn) => subscriptions.set(event, fn), unsubscribe: event => subscriptions.delete(event) },
        showToast: () => {}, React: undefined
    };
    const context = { module: { exports: {} }, console,
        setTimeout(fn) { timeouts.set(++timer, fn); return timer; }, clearTimeout(id) { timeouts.delete(id); },
        setInterval(fn) { intervals.set(++timer, fn); return timer; }, clearInterval(id) { intervals.delete(id); },
        require(name) {
            if (name === '@api/Settings') return { definePluginSettings: () => ({ store: config }) };
            if (name === '@utils/types') return { __esModule: true, default: p => p, OptionType: { BOOLEAN: 1, SLIDER: 2, NUMBER: 3 } };
            if (name === '@webpack/common') return common;
            throw Error(name);
        }
    };
    vm.runInNewContext(voiceCode, context);
    const plugin = context.module.exports.default;
    const UserAreaButton = () => {};
    const buttonContext = { module: { exports: {} }, require(name) {
        if (name === '@api/PluginManager') return { isPluginEnabled: () => saved.plugins.VoiceKeeper.enabled, startPlugin(p) { if (fail) return false; p.start(); return true; }, stopPlugin(p) { p.stop(); return true; } };
        if (name === '@api/Settings') return { Settings: saved, useSettings: () => saved };
        if (name === '@api/UserArea') return { UserAreaButton };
        if (name === '@plugins/bypassvoc') return { __esModule: true, default: plugin };
        if (name === '@webpack/common') return common;
        throw Error(name);
    } };
    // As with Discord startup, importing must not access React yet.
    vm.runInNewContext(buttonCode, buttonContext);
    common.React = { createElement(type, props, ...children) { return { type, props, children }; } };
    return { render: () => buttonContext.module.exports.VoiceKeeperButton({ nameplate: {}, iconForeground: 'native-icon' }), subscriptions, timeouts, intervals, selected, saved, UserAreaButton, failStart: () => { fail = true; } };
}

test('native voice button toggles the real plugin, persists state, and cancels pending reconnects', () => {
    const f = fixture();
    const off = f.render();
    assert.equal(off.type, f.UserAreaButton);
    assert.equal(off.props.role, 'switch');
    assert.equal(off.props['aria-checked'], false);
    assert.equal(off.props.plated, true);
    off.props.onClick();
    assert.equal(f.saved.plugins.VoiceKeeper.enabled, true);
    assert.equal(f.subscriptions.size, 3);
    assert.equal(f.intervals.size, 1);
    // Activation while already in voice captures the current target.
    f.subscriptions.get('VOICE_STATE_UPDATES')({ voiceStates: [{ userId: 'self', guildId: 'guild', channelId: null }] });
    assert.equal(f.timeouts.size, 1);
    const on = f.render();
    assert.equal(on.props['aria-checked'], true);
    assert.equal(on.props['aria-label'], 'Désactiver VoiceKeeper');
    assert.equal(on.props.orangeGlow, true);
    on.props.onClick();
    assert.equal(f.saved.plugins.VoiceKeeper.enabled, false);
    assert.equal(f.timeouts.size, 0);
    assert.equal(f.intervals.size, 0);
    assert.equal(f.subscriptions.size, 0);
    assert.equal(f.selected.length, 0);
    assert.equal(f.render().props['aria-checked'], false);
});

test('failed activation leaves the native button off and creates no reconnect timers', () => {
    const f = fixture(); f.failStart(); f.render().props.onClick();
    assert.equal(f.saved.plugins.VoiceKeeper.enabled, false);
    assert.equal(f.subscriptions.size, 0);
    assert.equal(f.intervals.size, 0);
});
