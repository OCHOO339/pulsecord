const model = window.PulseWizard;
const state = model.createState();
const status = document.querySelector('#status');
const next = document.querySelector('#next');
const back = document.querySelector('#back');
const close = document.querySelector('#close');
const log = document.querySelector('#operation-log');
const progress = document.querySelector('#progress');
let candidates = [];
const actionLabels = { install: 'Installation', repair: 'Réinstallation', uninstall: 'Désinstallation', rollback: 'Restauration' };
const actionButtons = { install: 'Installer', repair: 'Réinstaller', uninstall: 'Désinstaller', rollback: 'Restaurer' };
function renderStep() {
    document.querySelectorAll('[data-step]').forEach(panel => panel.hidden = Number(panel.dataset.step) !== state.step);
    document.querySelector('#step-count').textContent = `${state.step + 1} / 4`;
    back.disabled = state.step === 0 || state.busy;
    close.disabled = state.busy;
    next.textContent = state.step === 3 ? 'Fermer' : state.step === 2 ? actionButtons[state.action] : 'Suivant';
    next.disabled = state.step === 3 ? !state.finished : !model.canAdvance(state);
    document.querySelector('#operation-heading').textContent = actionLabels[state.action];
}
function renderTargets(rows, selectPath) {
    candidates = rows;
    const present = new Set(rows.map(row => row.resources));
    state.selected = new Set([...state.selected].filter(value => present.has(value)));
    if (selectPath) state.selected.add(selectPath);
    else if (!state.selected.size && rows.length) {
        const first = model.channels(rows).find(row => row.index >= 0);
        if (first) state.selected.add(first.resources);
    }
    const targets = document.querySelector('#targets'); targets.replaceChildren();
    for (const row of model.channels(rows)) {
        const item = document.createElement('div'); item.className = 'target';
        const label = document.createElement('label'); label.className = 'target-select';
        if (row.index >= 0) {
            const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.name = 'target'; checkbox.checked = state.selected.has(row.resources);
            checkbox.onchange = () => { if (checkbox.checked) state.selected.add(row.resources); else state.selected.delete(row.resources); item.classList.toggle('selected', checkbox.checked); renderStep(); };
            label.append(checkbox); item.classList.toggle('selected', checkbox.checked);
        } else item.classList.add('missing');
        const image = document.createElement('img'); image.className = 'channel-mark'; image.src = 'assets/pulsecord-logo.png'; image.alt = ''; image.width = image.height = 33;
        const info = document.createElement('div'); info.className = 'target-info';
        const name = document.createElement('strong'); name.textContent = row.label;
        const detail = document.createElement('small'); detail.textContent = row.resources || 'Non trouvé'; detail.title = row.resources || '';
        info.append(name, detail);
        if (row.installed) { const installed = document.createElement('small'); installed.className = 'installed'; installed.textContent = 'PulseCord installé'; info.append(installed); }
        label.append(image, info);
        const browse = document.createElement('button'); browse.className = 'browse'; browse.textContent = 'Parcourir'; browse.setAttribute('aria-label', `Parcourir un dossier resources pour ${row.label}`); browse.onclick = choose;
        item.append(label, browse); targets.append(item);
    }
    renderStep();
}
async function list() {
    try { renderTargets(await window.pulsecord.list()); status.textContent = 'Discord sera fermé puis relancé automatiquement.'; }
    catch (error) { renderTargets(candidates); status.textContent = error.message; }
}
async function choose() {
    try { const rows = await window.pulsecord.choose(); renderTargets(rows, rows.length > candidates.length ? rows[rows.length - 1].resources : undefined); }
    catch (error) { status.textContent = error.message; }
}
function appendProgress(event) {
    const line = document.createElement('p'); line.className = `log-line ${event.level === 'error' ? 'error' : event.level === 'success' ? 'success' : ''}`; line.textContent = event.label;
    log.append(line); log.scrollTop = log.scrollHeight;
    if (Number.isFinite(event.value)) progress.value = Math.max(0, Math.min(100, event.value));
}
async function operate() {
    log.replaceChildren(); progress.value = 0; state.busy = true; state.finished = false; renderStep();
    const summary = document.querySelector('#operation-summary'); summary.textContent = 'Confirmation de la sélection…';
    const indexes = candidates.flatMap((target, index) => state.selected.has(target.resources) ? [index] : []);
    try {
        const result = await window.pulsecord.operateMany(state.action, indexes);
        if (result.cancelled) { state.step = 2; status.textContent = 'Opération annulée. Aucun changement effectué.'; return; }
        state.finished = true; progress.value = 100;
        summary.textContent = result.ok ? 'Terminé. Vous pouvez démarrer Discord.' : 'Opération terminée avec des erreurs. Consultez le journal.';
        status.textContent = result.ok ? 'Opération terminée.' : 'Certaines installations n’ont pas pu être modifiées.';
    } catch (error) { appendProgress({ label: error.message, level: 'error' }); summary.textContent = 'L’opération a échoué. Consultez le journal.'; state.finished = true; }
    finally { state.busy = false; renderStep(); }
}
document.querySelector('#accept-license').onchange = event => { state.accepted = event.target.checked; renderStep(); };
document.querySelectorAll('input[name=action]').forEach(input => input.onchange = () => { state.action = input.value; renderStep(); });
document.querySelector('#refresh').onclick = list;
back.onclick = () => { model.back(state); renderStep(); };
next.onclick = () => { if (state.step === 3 && state.finished) { window.pulsecord.windowControl('close'); return; } model.advance(state); renderStep(); if (state.step === 3) void operate(); };
document.querySelector('#minimize').onclick = () => window.pulsecord.windowControl('minimize');
close.onclick = () => window.pulsecord.windowControl('close');
const unsubscribe = window.pulsecord.onProgress(appendProgress);
window.addEventListener('beforeunload', unsubscribe, { once: true });
window.pulsecordReady = (async () => {
    await list();
    try { document.querySelector('#license-text').textContent = await window.pulsecord.license(); document.querySelector('#accept-license').disabled = false; }
    catch (error) { document.querySelector('#license-text').textContent = `Impossible de charger la licence : ${error.message}`; }
    renderStep();
})();
