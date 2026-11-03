import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const wizard = require('../packages/installer/wizard.js');
const { selectTargets, runOperations } = require('../packages/installer/operations.cjs');
test('wizard requires license acknowledgement and a target before operating', () => {
    const state = wizard.createState();
    assert.equal(wizard.canAdvance(state), false); assert.throws(() => wizard.advance(state));
    state.accepted = true; assert.equal(wizard.advance(state), 1);
    state.action = 'repair'; assert.equal(wizard.advance(state), 2);
    assert.throws(() => wizard.advance(state)); state.selected.add('resources'); assert.equal(wizard.advance(state), 3);
    state.busy = true; assert.equal(wizard.back(state), false); assert.equal(wizard.canAdvance(state), false);
    state.busy = false; assert.equal(wizard.back(state), true); assert.equal(state.step, 2);
});
test('channels distinguish absent installations and prefer the newest numeric app version', () => {
    const rows = wizard.channels([{ name: 'Discord 1.0.9', resources: 'old' }, { name: 'Discord 1.0.10', resources: 'new' }, { name: 'DiscordCanary 1.0.2', resources: 'canary' }]);
    assert.equal(rows[0].resources, 'new'); assert.equal(rows[1].index, -1); assert.equal(rows[1].label, 'Discord PTB');
    assert.equal(rows[2].resources, 'canary'); assert.equal(rows.at(-1).resources, 'old');
});
test('batch selection rejects invalid indexes/actions and deduplicates physical targets', () => {
    const targets = [{ name: 'Discord', resources: 'same' }, { name: 'Manual', resources: 'same' }];
    assert.equal(selectTargets('repair', [0, 1], targets).length, 1);
    for (const [action, indexes] of [['unknown', [0]], ['install', []], ['install', [-1]], ['install', ['0']], ['install', [100]]]) assert.throws(() => selectTargets(action, indexes, targets));
});
test('repair uses the real install operation and produces monotonic progress across targets', async () => {
    const events = []; const calls = [];
    const core = { async install(resources, bundle, loader, report) { calls.push([resources, bundle, loader]); report({ stage: 'verify', done: 1, total: 1, label: 'Verified' }); report({ stage: 'complete', label: 'Done' }); return 'installed'; } };
    const result = await runOperations({ core, action: 'repair', targets: [{ name: 'Stable', resources: 'one' }, { name: 'Canary', resources: 'two' }], bundle: 'bundle', loader: 'loader', progress: event => events.push(event) });
    assert.equal(result.ok, true); assert.equal(calls.length, 2); assert.deepEqual(calls[0], ['one', 'bundle', 'loader']);
    assert.equal(events.at(-1).value, 100); assert.equal(events.every((event, index) => index === 0 || event.value >= events[index - 1].value), true);
});
test('a failed target is reported as an error while other selected targets are handled', async () => {
    const events = [];
    const result = await runOperations({ core: { async uninstall(resources) { if (resources === 'bad') throw Error('Cannot restore'); return 'restored'; } }, action: 'uninstall', targets: [{ name: 'Stable', resources: 'bad' }, { name: 'Canary', resources: 'ok' }], progress: event => events.push(event) });
    assert.equal(result.ok, false); assert.deepEqual(result.results.map(item => item.ok), [false, true]);
    assert.equal(events.some(event => event.level === 'error' && event.label.includes('Cannot restore')), true);
});

test('installer waits for Discord to stop, applies changes, and launches even when initially closed', async () => {
    const events = [];
    const session = { executable: 'Discord.exe', wasRunning: false };
    const result = await runOperations({ core: { async install() { events.push('install'); } },
        action: 'install', targets: [{ name: 'Discord', resources: 'resources' }], progress() {},
        lifecycle: { async stop() { await Promise.resolve(); events.push('stop'); return session; }, async start(value) { assert.equal(value, session); events.push('start'); } }
    });
    assert.equal(result.ok, true); assert.deepEqual(events, ['stop', 'install', 'start']);
});

test('a failed shutdown prevents all installation writes and relaunches', async () => {
    const result = await runOperations({ core: { install() { assert.fail('must not install'); } },
        action: 'repair', targets: [{ name: 'Discord', resources: 'resources' }], progress() {},
        lifecycle: { async stop() { throw Error('Access denied'); }, start() { assert.fail('must not launch'); } }
    });
    assert.equal(result.ok, false); assert.match(result.results[0].message, /Access denied/);
});

test('a failed operation reopens a previously running Discord but preserves the failure', async () => {
    let starts = 0;
    const result = await runOperations({ core: { async install() { throw Error('Invalid bundle'); } },
        action: 'repair', targets: [{ name: 'Discord', resources: 'resources' }], progress() {},
        lifecycle: { async stop() { return { wasRunning: true }; }, async start() { starts++; } }
    });
    assert.equal(result.ok, false); assert.equal(starts, 1); assert.match(result.results[0].message, /Invalid bundle/);
});

test('a launch failure reports that installation succeeded without attempting a second launch', async () => {
    let starts = 0;
    const result = await runOperations({ core: { async install() {} },
        action: 'install', targets: [{ name: 'Discord', resources: 'resources' }], progress() {},
        lifecycle: { async stop() { return { wasRunning: true }; }, async start() { starts++; throw Error('Launch failed'); } }
    });
    assert.equal(result.ok, false); assert.equal(starts, 1); assert.match(result.results[0].message, /Opération appliquée/);
});
