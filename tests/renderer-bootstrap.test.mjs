import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../upstream/equicord/package.json', import.meta.url));
const { transform } = require('esbuild');

test('announcement module imports before Discord initializes React and renders when it becomes ready', async () => {
    const source = await transform(await readFile('packages/pulsecord/markdown.tsx', 'utf8'), { loader: 'tsx', format: 'cjs' });
    const common = { React: undefined, Parser: undefined };
    const context = { module: { exports: {} }, require(name) { assert.equal(name, '@webpack/common'); return common; } };
    assert.doesNotThrow(() => vm.runInNewContext(source.code, context));
    const { AnnouncementMarkdown } = context.module.exports;
    assert.equal(typeof AnnouncementMarkdown, 'function');
    let parsed;
    common.Parser = { parse(text, inline, options) { parsed = { text, inline, options }; return 'formatted announcement'; } };
    common.React = { createElement(type, props, ...children) { return { type, props, children }; } };
    const result = AnnouncementMarkdown({ text: '# PulseCord\n\n- Update' });
    assert.equal(result.props.className, 'pc-markdown');
    assert.equal(result.children[0], 'formatted announcement');
    assert.equal(parsed.options.allowHeading, true);
    assert.equal(parsed.options.allowList, true);
});
