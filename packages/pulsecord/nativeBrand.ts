/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { brand } from "@pulsecord/brand";
import { brandingCss } from "@pulsecord/branding";
import electron, { app, BrowserWindowConstructorOptions, NativeImage } from "electron";

let icon: NativeImage | undefined;
function pulseIcon() {
    return icon ??= electron.nativeImage.createFromDataURL(brand.splashLogo);
}
const css = brandingCss(brand.logo, brand.splashLogo, brand.fontCss);

export class PulseWindow extends electron.BrowserWindow {
    constructor(options: BrowserWindowConstructorOptions) {
        super({ ...options, icon: pulseIcon() });
        this.webContents.on("dom-ready", () => {
            const url = new URL(this.webContents.getURL());
            const discordPage = url.protocol === "https:" && (url.hostname === "discord.com" || url.hostname.endsWith(".discord.com"));
            const bundledPage = url.protocol === "file:" && /(?:_?app|core)\.asar/i.test(url.pathname);
            if (discordPage || bundledPage) this.webContents.insertCSS(css, { cssOrigin: "user" })
                .catch(error => console.warn("[PulseCord] Could not apply window branding", error));
        });
    }
    setIcon(_image: NativeImage | string) {
        super.setIcon(pulseIcon());
    }
}

export class PulseTray extends electron.Tray {
    constructor(_image: NativeImage | string, guid?: string) {
        super(pulseIcon(), guid);
    }
    setImage(_image: NativeImage | string) {
        super.setImage(pulseIcon());
    }
}

export function brandDock() {
    if (process.platform === "darwin") app.whenReady().then(() => app.dock?.setIcon(pulseIcon()));
}
