// SPDX-License-Identifier: GPL-3.0-or-later
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

const settings = definePluginSettings({
    active: { type: OptionType.BOOLEAN, description: "Hide the member list while focusing", default: false, onChange: apply }
});
let style: HTMLStyleElement | undefined;
function apply() {
    if (style) style.textContent = settings.store.active ? '[class*="membersWrap_"] { display: none !important; }' : "";
}
function keydown(event: KeyboardEvent) {
    if (event.ctrlKey && event.altKey && event.code === "KeyF" && !event.repeat) {
        settings.store.active = !settings.store.active;
        event.preventDefault();
    }
}
export default definePlugin({
    name: "PulseCordFocus",
    description: "Toggle the member list with Ctrl+Alt+F. Local UI only; no message access.",
    authors: [Devs.PulseCord],
    settings,
    start() {
        style = document.createElement("style");
        document.head.append(style);
        apply();
        document.addEventListener("keydown", keydown);
    },
    stop() {
        document.removeEventListener("keydown", keydown);
        style?.remove();
        style = undefined;
    }
});
