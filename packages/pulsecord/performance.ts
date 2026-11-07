// SPDX-License-Identifier: GPL-3.0-or-later
let active = false;
function update() { document.documentElement.toggleAttribute("data-pc-background", document.hidden || !document.hasFocus()); }
export function setBackgroundEconomy(enabled: boolean) {
    if (enabled === active) return; active = enabled;
    if (enabled) {
        document.addEventListener("visibilitychange", update);
        window.addEventListener("focus", update); window.addEventListener("blur", update); update();
    } else {
        document.removeEventListener("visibilitychange", update);
        window.removeEventListener("focus", update); window.removeEventListener("blur", update);
        document.documentElement.removeAttribute("data-pc-background");
    }
}
