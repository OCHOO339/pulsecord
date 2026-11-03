/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
let played = false;
let overlay: HTMLDivElement | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;

export function stopStartup() {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    overlay?.remove();
    overlay = undefined;
}

export function showStartup(logo: string, enabled: boolean) {
    if (played || !enabled || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    played = true;
    overlay = document.createElement("div");
    overlay.className = "pc-startup";
    overlay.setAttribute("aria-hidden", "true");
    const image = document.createElement("img");
    image.src = logo;
    image.alt = "";
    image.width = 144;
    image.height = 144;
    overlay.append(image);
    document.body.append(overlay);
    timer = setTimeout(stopStartup, 1150);
}
