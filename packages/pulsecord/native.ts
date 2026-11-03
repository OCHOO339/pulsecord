/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { DATA_DIR } from "@main/utils/constants";
import { brand } from "@pulsecord/brand";
import { activateUpdate, getInstallation } from "@pulsecord/update-core";
import { bundleId, isOlder, MAX_BUNDLE_BYTES, verifyDownload, verifyRelease } from "@pulsecord/update-protocol";
import { app } from "electron";
import { unzipSync } from "fflate";
import { promises as fs } from "original-fs";
import { join, resolve, sep } from "path";

interface Release {
    version: string; bundleId: string; bundleUrl: string; sha256: string; size: number; changelog: string;
}
export interface UpdateState {
    phase: "unconfigured" | "idle" | "checking" | "current" | "available" | "installing" | "restarting" | "error";
    configured: boolean;
    currentVersion: string;
    nextVersion?: string;
    nextBuild?: string;
    changelog?: string;
    error?: string;
}
const configured = Boolean(brand.updates.manifestUrl && brand.updates.publicKey);
let state: UpdateState = { phase: configured ? "idle" : "unconfigured", configured, currentVersion: brand.version };
let pending: Release | undefined;
let checking: Promise<UpdateState> | undefined;
let applying = false;
const resources = resolve(process.resourcesPath);

async function download(url: string, limit: number) {
    if (new URL(url).protocol !== "https:") throw Error("Update downloads require HTTPS");
    const response = await fetch(url, { signal: AbortSignal.timeout(60000), headers: { "User-Agent": "PulseCord Updater" } });
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
        state = { phase: "checking", configured, currentVersion: brand.version };
        try {
            const bytes = await download(brand.updates.manifestUrl, 128000);
            const release: Release = verifyRelease(JSON.parse(bytes.toString("utf8")), brand.updates.publicKey, process.platform, process.arch);
            const installed = await getInstallation(resources);
            if (isOlder(release.version, installed.version || brand.version)) throw Error("The release server offered an older build");
            pending = installed.current === release.bundleId ? undefined : release;
            state = { phase: pending ? "available" : "current", configured, currentVersion: brand.version, ...(pending ? { nextVersion: release.version, nextBuild: release.bundleId, changelog: release.changelog } : {}) };
        } catch (error) { pending = undefined; state = { phase: "error", configured, currentVersion: brand.version, error: String(error) }; }
        return { ...state };
    })();
    try { return await checking; } finally { checking = undefined; }
}
export async function applyUpdate(_event: Electron.IpcMainInvokeEvent): Promise<UpdateState> {
    if (applying || !pending || state.phase !== "available") throw Error("No verified update is ready");
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
        state = { ...state, phase: "restarting" };
        setTimeout(() => { app.relaunch(); app.exit(0); }, 700);
        return { ...state };
    } catch (error) {
        state = { ...state, phase: "error", error: String(error) };
        return { ...state };
    } finally {
        applying = false;
        if (stage && resolve(stage).startsWith(resolve(cache) + sep)) await fs.rm(stage, { recursive: true, force: true }).catch(error => console.warn("[PulseCord] Could not clean update staging", error));
    }
}
