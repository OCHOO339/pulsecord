// SPDX-License-Identifier: GPL-3.0
function selectTargets(action, indexes, candidates) {
    if (!['install', 'repair', 'uninstall', 'rollback'].includes(action) || !Array.isArray(indexes) || !indexes.length || indexes.length > 16) throw Error('Invalid operation');
    const targets = [];
    for (const index of indexes) {
        if (!Number.isInteger(index) || !candidates[index]) throw Error('Invalid installation selection');
        if (!targets.some(target => target.resources === candidates[index].resources)) targets.push(candidates[index]);
    }
    return targets;
}
async function runOperations({ core, action, targets, bundle, loader, progress, lifecycle }) {
    const results = [];
    for (const [index, target] of targets.entries()) {
        const report = (label, fraction, level = 'info') => progress({ label, target: target.name, value: Math.round((index + fraction) / targets.length * 100), level });
        report(`Préparation : ${target.name}`, 0);
        const notify = event => {
            const values = { verify: .1 + .4 * (event.done || 0) / (event.total || 1), stage: .6, backup: .7, activate: .85, complete: 1 };
            report(event.label, values[event.stage] ?? .1, event.stage === 'complete' ? 'success' : 'info');
        };
        let session;
        let completed = false;
        try {
            if (lifecycle) {
                report('Fermeture de Discord…', 0);
                session = await lifecycle.stop(target);
                report('Discord fermé.', .05);
            }
            const result = action === 'install' || action === 'repair'
                ? await core.install(target.resources, bundle, loader, notify)
                : action === 'uninstall' ? await core.uninstall(target.resources, notify) : await core.rollback(target.resources);
            completed = true;
            if (session) {
                report('Réouverture de Discord…', 1);
                await lifecycle.start(session);
            }
            results.push({ name: target.name, ok: true, message: result }); report(`${target.name} : opération terminée${session ? ', Discord relancé' : ''}.`, 1, 'success');
        } catch (error) {
            if (session?.wasRunning && !completed) {
                try { await lifecycle.start(session); }
                catch (restartError) { report(`Impossible de rouvrir Discord : ${restartError.message}`, 1, 'error'); }
            }
            const message = completed ? `Opération appliquée, mais Discord n'a pas pu être relancé : ${error.message || error}` : String(error);
            results.push({ name: target.name, ok: false, message }); report(`${target.name} : ${message}`, 1, 'error');
        }
    }
    return { cancelled: false, ok: results.every(result => result.ok), results };
}
module.exports = { selectTargets, runOperations };
