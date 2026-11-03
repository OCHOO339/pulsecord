// SPDX-License-Identifier: GPL-3.0-or-later
import { NavigationRouter } from "@webpack/common";
import { closeOfficialInbox, handleInboxNavigation } from "./inbox";

const home = '[data-guilds-bar-home],[data-list-item-id="guildsnav___home"]';
function navigate() {
    closeOfficialInbox();
    try { NavigationRouter.transitionTo("/channels/@me"); handleInboxNavigation(); }
    catch (error) {
        console.warn("[PulseCord] Home router unavailable; reloading the DM route", error);
        window.location.assign("/channels/@me");
    }
}
function isHome(event: Event) { return event.target instanceof Element && Boolean(event.target.closest(home)); }
function click(event: MouseEvent) {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || !isHome(event)) return;
    event.preventDefault(); event.stopPropagation(); navigate();
}
function keyboard(event: KeyboardEvent) {
    if (!["Enter", " "].includes(event.key) || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || !isHome(event)) return;
    event.preventDefault(); event.stopPropagation(); navigate();
}
export function startHomeNavigation() {
    document.addEventListener("click", click, true);
    document.addEventListener("keydown", keyboard, true);
}
export function stopHomeNavigation() {
    document.removeEventListener("click", click, true);
    document.removeEventListener("keydown", keyboard, true);
}
