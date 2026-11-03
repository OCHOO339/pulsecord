// SPDX-License-Identifier: GPL-3.0
function isTrustedSender(event, contents, pageUrl) {
    if (contents.isDestroyed() || event.sender !== contents) return false;
    const frame = event.senderFrame;
    if (!frame || frame !== contents.mainFrame) return false;
    try {
        const actual = new URL(frame.url);
        actual.hash = '';
        return actual.href === pageUrl;
    } catch { return false; }
}
module.exports = { isTrustedSender };
