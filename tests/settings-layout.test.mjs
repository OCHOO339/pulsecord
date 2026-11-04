import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../upstream/equicord/package.json', import.meta.url));
const { transform } = require('esbuild');
const compiled = await transform(await readFile('upstream/equicord/src/plugins/_core/settings.tsx', 'utf8'), { loader: 'tsx', format: 'cjs' });

function settingsPlugin() {
    const Component = () => null;
    const context = {
        module: { exports: {} }, IS_UPDATER_DISABLED: true, IS_STANDALONE: false,
        require(name) {
            if (name === '@pulsecord/localization') return { PluginText: Component, translateUi: text => text };
            if (name === '@api/Settings') return { definePluginSettings: () => ({ store: { settingsLocation: 'aboveNitro' } }) };
            if (name === '@utils/types') return { __esModule: true, default: plugin => plugin, OptionType: { SELECT: 1, BOOLEAN: 2 } };
            if (name === '@utils/constants') return { Devs: { Ven: {}, Megu: {} } };
            if (name === '@utils/guards') return { isTruthy: Boolean };
            if (name === '@webpack') return { waitFor: (_, callback) => callback({ SECTION: 1, SIDEBAR_ITEM: 2, PANEL: 3, CATEGORY: 5, CUSTOM: 19 }) };
            if (name === '@webpack/common') return { React: { createElement: (type, props) => ({ type, props }) } };
            if (name === '@shared/vencordUserAgent') return { gitHashShort: 'fixture' };
            if (name === '@components/Icons' || name === '@components/settings') return new Proxy({}, { get: () => Component });
            throw Error(`Unexpected import: ${name}`);
        }
    };
    vm.runInNewContext(compiled.code, context);
    const plugin = context.module.exports.default;
    for (const [key, title] of [['pulsecord_appearance', 'Appearance'], ['pulsecord_updates', 'Updates']]) {
        plugin.customEntries.push({ key, title, Component, Icon: Component });
    }
    return plugin;
}

function patchedRoot(plugin) {
    const patch = plugin.patches.find(p => p.find === 'analyticsKey:"user_settings"');
    assert.ok(patch, 'A root-specific settings patch must be present');
    const source = '(0,h.Hr)({buildLayout:()=>[user,billing,utility],analyticsKey:"user_settings"})';
    assert.ok(patch.replacement.match.test(source));
    const patched = source.replace(patch.replacement.match, patch.replacement.replace);
    const sections = ['user_section', 'billing_section', 'utility_section'].map(key => ({key, type: 1, buildLayout: () => []}));
    return new Function('$self', 'h', 'user', 'billing', 'utility', `return ${patched}`)(plugin, { Hr: props => ({ ...props, key: '$Root' }) }, ...sections);
}

function expand(builder, plugin, sharedPatch) {
    if (!builder.buildLayout) return builder;
    const children = sharedPatch ? plugin.buildLayout(builder) : builder.buildLayout();
    return { ...builder, layout: children.map(child => expand(child, plugin, sharedPatch)) };
}

for (const sharedPatch of [false, true]) test(`PulseCord settings survive root reconstruction with shared walker patch ${sharedPatch ? 'present' : 'absent'}`, () => {
    const plugin = settingsPlugin();
    const root = patchedRoot(plugin);
    for (let restart = 0; restart < 2; restart++) {
        const tree = expand(root, plugin, sharedPatch);
        assert.equal(tree.layout.filter(node => node.key === 'equicord_section').length, 1);
        const section = tree.layout.find(node => node.key === 'equicord_section');
        assert.equal(section.useTitle(), 'PulseCord Settings');
        for (const key of ['equicord_plugins', 'equicord_themes', 'pulsecord_updates', 'pulsecord_appearance']) {
            const entry = section.layout.find(node => node.key === key);
            assert.ok(entry, `Missing ${key}`);
            assert.equal(typeof entry.layout[0].layout[0].layout[0].Component, 'function');
        }
        assert.deepEqual(tree.layout.filter(node => node.key !== 'equicord_section').map(node => node.key), ['user_section', 'billing_section', 'utility_section']);
    }
});

test('settings patch matches the cached public Discord root when available', async t => {
    const source = await readFile('.cache/discord-public/dd5e9f06878d623d.js', 'utf8').catch(() => '');
    if (!source) return t.skip('Public client fixture is optional and is not redistributed');
    const patch = settingsPlugin().patches.find(p => p.find === 'analyticsKey:"user_settings"');
    assert.equal([...source.matchAll(new RegExp(patch.replacement.match.source, 'g'))].length, 1);
});
