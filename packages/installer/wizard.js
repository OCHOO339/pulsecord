(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.PulseWizard = api;
})(globalThis, () => {
    const actions = ['install', 'repair', 'uninstall', 'rollback'];
    function createState() { return { step: 0, accepted: false, action: 'install', selected: new Set(), busy: false, finished: false }; }
    function canAdvance(state) {
        if (state.busy) return false;
        if (state.step === 0) return state.accepted;
        if (state.step === 1) return actions.includes(state.action);
        if (state.step === 2) return state.selected.size > 0;
        return false;
    }
    function advance(state) { if (!canAdvance(state)) throw Error('Cette étape doit être complétée.'); state.step++; return state.step; }
    function back(state) { if (state.busy || state.step === 0) return false; state.step--; state.finished = false; return true; }
    function channels(candidates) {
        const definitions = [['Discord', 'Discord'], ['DiscordPTB', 'Discord PTB'], ['DiscordCanary', 'Discord Canary']];
        if (candidates.some(item => /^DiscordDevelopment\b/.test(item.name))) definitions.push(['DiscordDevelopment', 'Discord Development']);
        const used = new Set();
        const rows = definitions.map(([key, label]) => {
            const found = candidates.map((target, index) => ({ target, index })).filter(({ target }) => target.name.split(' ')[0] === key)
                .sort((a, b) => b.target.name.localeCompare(a.target.name, undefined, { numeric: true }));
            if (!found.length) return { label, index: -1, resources: null };
            const { target, index } = found[0]; used.add(index);
            return { ...target, label, index };
        });
        for (const [index, target] of candidates.entries()) if (!used.has(index)) rows.push({ ...target, label: target.name, index });
        return rows;
    }
    return { actions, createState, canAdvance, advance, back, channels };
});
