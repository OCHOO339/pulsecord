// SPDX-License-Identifier: GPL-3.0-or-later
let active = false;
function update() { document.documentElement.toggleAttribute("data-pc-background", document.hidden); }
export function setBackgroundEconomy(enabled: boolean) {
    if (enabled === active) return; active = enabled;
    if (enabled) { document.addEventListener("visibilitychange", update); update(); }
    else { document.removeEventListener("visibilitychange", update); document.documentElement.removeAttribute("data-pc-background"); }
}
