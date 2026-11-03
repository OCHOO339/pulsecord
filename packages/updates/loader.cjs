// SPDX-License-Identifier: GPL-3.0-or-later
const fs = require('original-fs');
const path = require('node:path');
try {
    const state = JSON.parse(fs.readFileSync(path.join(__dirname, '.mycord.json'), 'utf8'));
    if (!/^[a-f0-9]{64}$/.test(state.current)) throw Error('Invalid PulseCord version pointer');
    require(path.join(__dirname, 'mycord-versions', state.current, 'patcher.js'));
} catch (error) {
    console.error('[PulseCord] Could not load the mod; starting the original client.', error);
    const original = path.join(__dirname, '_app.asar');
    const pkg = require(path.join(original, 'package.json'));
    require('electron').app.setAppPath(original);
    require.main.filename = path.join(original, pkg.main);
    require(require.main.filename);
}
