import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../upstream/equicord/package.json', import.meta.url));
const { transform } = require('esbuild');
const code = (await transform(await readFile('upstream/equicord/src/api/UserArea.tsx', 'utf8'), { loader: 'tsx', format: 'cjs' })).code;

test('a user-area button registered after the native bar mounted appears immediately and disappears on removal', () => {
    const common = { React: undefined };
    const context = { module: { exports: {} }, require(name) {
        if (name === '@webpack/common') return common;
        if (name === '@webpack') return { findComponentByCodeLazy: () => () => null };
        if (name === '@components/ErrorBoundary') return { __esModule: true, default: () => null };
        if (name === '@utils/Logger') return { Logger: class { error() {} debug() {} } };
        throw Error(name);
    } };
    vm.runInNewContext(code, context);
    const api = context.module.exports;
    let unsubscribe, rendered, revision, renders = 0;
    function render() {
        renders++;
        const node = api._renderButtons({})[0];
        rendered = node.type(node.props);
    }
    common.React = {
        Fragment: 'fragment',
        createElement(type, props, ...children) { return { type, props, children }; },
        useSyncExternalStore(subscribe, snapshot) {
            revision = snapshot();
            unsubscribe ??= subscribe(render);
            return revision;
        }
    };
    const visible = () => rendered.children.flat().map(node => node.props.key);
    render();
    assert.deepEqual(visible(), []);
    api.addUserAreaButton('PulseCord', () => null, 10000);
    assert.deepEqual(visible(), ['PulseCord'], 'Registering after initial mount must repaint without clicking mute');
    api.addUserAreaButton('Other', () => null, 0);
    assert.deepEqual(visible(), ['Other', 'PulseCord'], 'VoiceKeeper stays nearest to the native microphone');
    api.removeUserAreaButton('PulseCord');
    assert.deepEqual(visible(), ['Other']);
    const beforeMissingRemoval = renders;
    api.removeUserAreaButton('missing');
    assert.equal(renders, beforeMissingRemoval);
    unsubscribe();
    api.addUserAreaButton('AfterUnmount', () => null);
    assert.equal(renders, beforeMissingRemoval, 'Unmount must release the subscription');
});
