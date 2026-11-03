import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { isTrustedSender } = require('../packages/installer/trusted-sender.cjs');
const url = 'file:///C:/Pulse%20Cord/resources/app.asar/packages/installer/index.html';
function fixture(frameUrl = url) {
    const mainFrame = { url: frameUrl };
    const contents = { mainFrame, isDestroyed: () => false };
    return { contents, event: { sender: contents, senderFrame: mainFrame } };
}
test('installer IPC accepts its main frame after navigating to either anchor', () => {
    for (const anchor of ['', '#install', '#recovery']) {
        const { event, contents } = fixture(url + anchor);
        assert.equal(isTrustedSender(event, contents, url), true);
    }
});
test('installer IPC rejects other windows, subframes, documents and query strings', () => {
    const { event, contents } = fixture();
    assert.equal(isTrustedSender({ ...event, sender: {} }, contents, url), false);
    assert.equal(isTrustedSender({ ...event, senderFrame: { url } }, contents, url), false);
    assert.equal(isTrustedSender({ ...event, senderFrame: null }, contents, url), false);
    for (const page of ['https://example.com/', url + '?other=1', url.replace('index.html', 'other.html'), 'invalid']) {
        const f = fixture(page); assert.equal(isTrustedSender(f.event, f.contents, url), false);
    }
    contents.isDestroyed = () => true;
    assert.equal(isTrustedSender(event, contents, url), false);
});
