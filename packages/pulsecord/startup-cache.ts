// SPDX-License-Identifier: GPL-3.0-or-later
import { app, session } from "electron";

let scheduled = false;

// HTTP cache only. Cookies, localStorage, IndexedDB, settings and translation
// caches must survive. Never remove profile directories while Discord is open.
export function installStartupCacheCleanup(enabled = true) {
    if (!enabled || scheduled) return;
    scheduled = true;
    // Do not delay Discord's entry point, window creation or sign-in.
    void app.whenReady().then(async () => {
        await session.defaultSession.clearCache();
        console.info("[PulseCord] Startup HTTP cache cleanup completed.");
    }).catch(error => {
        console.warn("[PulseCord] Startup HTTP cache cleanup failed; Discord continues normally.", error);
    });
}
