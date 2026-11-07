// SPDX-License-Identifier: GPL-3.0-or-later
import { app, session } from "electron";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

let scheduled = false;
const WEEK = 7 * 24 * 60 * 60 * 1000;
const MAX_CACHE = 256 * 1024 * 1024;

async function maintainCache() {
    const marker = join(app.getPath("userData"), "pulsecord-cache-maintenance.json");
    const now = Date.now();
    const raw = await readFile(marker, "utf8").catch(error => {
        if (error.code === "ENOENT") return "";
        throw error;
    });
    if (raw) {
        let checkedAt: unknown;
        try { checkedAt = JSON.parse(raw).checkedAt; } catch { /* Recheck a damaged marker. */ }
        if (typeof checkedAt === "number" && now >= checkedAt && now - checkedAt < WEEK) return;
    }
    const size = await session.defaultSession.getCacheSize();
    if (!Number.isFinite(size) || size < 0) return;
    if (size > MAX_CACHE) await session.defaultSession.clearCache();
    await writeFile(marker, JSON.stringify({ checkedAt: now }), { mode: 0o600 });
}

// HTTP cache only. Cookies, localStorage, IndexedDB, settings and translation
// caches must survive. Never remove profile directories while Discord is open.
export function installStartupCacheCleanup(enabled = true) {
    if (!enabled || scheduled) return;
    scheduled = true;
    // Keep useful cached assets and avoid competing with Discord's initial load.
    void app.whenReady().then(() => {
        const timer = setTimeout(() => {
            void maintainCache().catch(error => console.warn("[PulseCord] Cache maintenance skipped; Discord continues normally.", error));
        }, 30_000);
        timer.unref();
    }).catch(error => console.warn("[PulseCord] Cache maintenance could not be scheduled.", error));
}
