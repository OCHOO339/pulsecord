/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { DATA_DIR } from "@main/utils/constants";
import { brand } from "@pulsecord/brand";
import { activateUpdate, getInstallation } from "@pulsecord/update-core";
import { bundleId, isOlder, MAX_BUNDLE_BYTES, updateManifestUrl, verifyDownload, verifyRelease } from "@pulsecord/update-protocol";
import { app } from "electron";
import { unzipSync } from "fflate";
import { promises as fs } from "original-fs";
import { basename, join, resolve, sep } from "path";
import { saveBundle } from "@pulsecord/launcher-state";
export { backupConfiguration, restoreConfiguration, revealLastBackup } from "./maintenance-native";
export { communityRequest } from "./community-native";

interface Release {
    version: string; bundleId: string; bundleUrl: string; sha256: string; size: number; changelog: string;
}
export interface UpdateState {
    phase: "unconfigured" | "idle" | "checking" | "current" | "available" | "restartRequired" | "installing" | "restarting" | "error";
    configured: boolean;
    currentVersion: string;
    currentBuild?: string;
    nextVersion?: string;
    nextBuild?: string;
    changelog?: string;
    error?: string;
}
const configured = Boolean(brand.updates.manifestUrl && brand.updates.publicKey);
// The running main process can still use the previous immutable directory even
// when the installer has already changed the version pointer on disk.
const directoryId = basename(__dirname);
const runningBuild = /^[a-f0-9]{64}$/.test(directoryId) ? directoryId : undefined;
const current = { configured, currentVersion: brand.version, currentBuild: runningBuild };
let state: UpdateState = { ...current, phase: configured ? "idle" : "unconfigured" };
let pending: Release | undefined;
let checking: Promise<UpdateState> | undefined;
let applying = false;
let manifestChecks = 0;
const resources = resolve(process.resourcesPath);

async function download(url: string, limit: number, fresh = false) {
    if (new URL(url).protocol !== "https:") throw Error("Update downloads require HTTPS");
    const requestUrl = new URL(url);
    if (fresh) requestUrl.searchParams.set("_pulsecord_check", `${Date.now()}-${++manifestChecks}`);
    const response = await fetch(requestUrl.href, { signal: AbortSignal.timeout(60000), cache: fresh ? "no-store" : "default", headers: { "User-Agent": "PulseCord Updater", ...(fresh ? { "Cache-Control": "no-cache" } : {}) } });
    if (!response.ok) throw Error(`Update server returned ${response.status}`);
    if (new URL(response.url).protocol !== "https:" || !response.body) throw Error("Invalid update response");
    const chunks: Uint8Array[] = []; let size = 0;
    const reader = response.body.getReader();
    try {
        for (;;) {
            const { done, value } = await reader.read(); if (done) break;
            size += value.length;
            if (size > limit) throw Error("Update response exceeded its size limit");
            chunks.push(value);
        }
    } finally { await reader.cancel(); }
    return Buffer.concat(chunks);
}
export function getUpdateStatus(_event: Electron.IpcMainInvokeEvent): UpdateState { return { ...state }; }
export async function checkForUpdates(_event: Electron.IpcMainInvokeEvent): Promise<UpdateState> {
    if (!configured || applying) return { ...state };
    if (checking) return checking;
    checking = (async () => {
        state = { ...current, phase: "checking" };
        try {
            const bytes = await download(updateManifestUrl(brand.updates.manifestUrl, process.platform, process.arch), 128000, true);
            const release: Release = verifyRelease(JSON.parse(bytes.toString("utf8")), brand.updates.publicKey, process.platform, process.arch);
            const installed = await getInstallation(resources);
            if (isOlder(release.version, installed.version || brand.version)) throw Error("The release server offered an older build");
            const selected = installed.current === release.bundleId;
            const loaded = !runningBuild || runningBuild === release.bundleId;
            pending = selected && loaded ? undefined : release;
            state = { ...current, phase: pending ? selected ? "restartRequired" : "available" : "current", ...(pending ? { nextVersion: release.version, nextBuild: release.bundleId, changelog: release.changelog } : {}) };
        } catch (error) { pending = undefined; state = { ...current, phase: "error", error: String(error) }; }
        return { ...state };
    })();
    try { return await checking; } finally { checking = undefined; }
}
export async function applyUpdate(_event: Electron.IpcMainInvokeEvent): Promise<UpdateState> {
    if (applying || !pending || !["available", "restartRequired"].includes(state.phase)) throw Error("No verified update is ready");
    applying = true;
    const release = pending;
    state = { ...state, phase: "installing", error: undefined };
    const cache = join(DATA_DIR, "updates");
    let stage: string | undefined;
    try {
        const installed = await getInstallation(resources);
        if (!installed.loaderHash) throw Error("Run the PulseCord installer once to enable in-app updates");
        const bytes = await download(release.bundleUrl, Math.min(release.size, MAX_BUNDLE_BYTES));
        verifyDownload(bytes, release);
        let unpacked = 0; let count = 0;
        const files = unzipSync(bytes, { filter: file => {
            if (++count > 64 || !/^(?:bundle\.json|[\w.-]+\.(?:js|css|map|txt))$/.test(file.name)) throw Error("Invalid update archive entry");
            unpacked += file.originalSize;
            if (unpacked > 256 * 1024 * 1024) throw Error("Unpacked update is too large");
            return true;
        } });
        if (!files["bundle.json"]) throw Error("Missing update bundle manifest");
        const manifest = JSON.parse(Buffer.from(files["bundle.json"]).toString("utf8"));
        if (manifest.version !== release.version || bundleId(manifest.files) !== release.bundleId) throw Error("Update contents do not match the signed release");
        const expected = Object.keys(manifest.files);
        if (Object.keys(files).length !== expected.length + 1 || expected.some(name => !files[name])) throw Error("Update archive does not match its file manifest");
        for (const file of ["patcher.js", "preload.js", "renderer.js", "renderer.css"]) if (!files[file]) throw Error(`Missing update file ${file}`);
        await fs.mkdir(cache, { recursive: true });
        stage = await fs.mkdtemp(join(cache, "stage-"));
        for (const [name, data] of Object.entries(files)) await fs.writeFile(join(stage, name), data, { flag: "wx" });
        await activateUpdate(resources, stage);
        if (process.platform === "win32" && process.env?.LOCALAPPDATA) {
            const channel = basename(resolve(resources, "../.."));
            if (["Discord", "DiscordPTB", "DiscordCanary", "DiscordDevelopment"].includes(channel)) {
                try { await saveBundle(stage, join(process.env.LOCALAPPDATA, "PulseCord", "bundles", channel)); }
                catch (error) { console.warn("[PulseCord] Could not refresh launcher recovery bundle", error); }
            }
        }
        if (process.platform === "linux" && basename(resolve(resources, "../..")) === "runtimes" && /^[a-f0-9]{64}\.WidevineCdm$/.test(basename(resolve(resources, "..")))) {
            await saveBundle(stage, join(resolve(resources, "../../.."), "bundles")).catch(error => console.warn("[PulseCord] Could not refresh Linux recovery bundle", error));
        }
        if ((await getInstallation(resources)).current !== release.bundleId) throw Error("Le nouveau build n’a pas été activé. Discord ne sera pas redémarré.");
        // Discard inherited launch arguments, which can point at an older app
        // archive or start a Squirrel maintenance invocation instead of Discord.
        // Schedule relaunch here so a scheduling failure reaches the renderer.
        const flatpakId = process.platform === "linux" ? process.env?.FLATPAK_ID : undefined;
        app.relaunch({ execPath: flatpakId && /^com\.discordapp\.Discord(?:PTB|Canary)?$/.test(flatpakId) ? join(process.env.XDG_DATA_HOME!, "pulsecord/bin/pulsecord-discord") : process.execPath, args: [] });
        state = { ...state, phase: "restarting" };
        setTimeout(() => { app.exit(0); }, 700);
        return { ...state };
    } catch (error) {
        state = { ...state, phase: "error", error: String(error) };
        return { ...state };
    } finally {
        applying = false;
        if (stage && resolve(stage).startsWith(resolve(cache) + sep)) await fs.rm(stage, { recursive: true, force: true }).catch(error => console.warn("[PulseCord] Could not clean update staging", error));
    }
}
