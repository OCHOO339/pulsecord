// SPDX-License-Identifier: GPL-3.0-or-later
import * as DataStore from "@api/DataStore";
import { UserStore } from "@webpack/common";
import { registerCommunityUser } from "./community-registration";
import { communityCacheMs, CommunityRegistry, fetchApprovedUsers } from "./community-core";

export const communityRegistry = new CommunityRegistry();
const key = "pulsecord.community-badges.v1";
let generation = 0;
let active = false;
let busy: Promise<void> | undefined;
let controller: AbortController | undefined;
let checkedAt = 0;
let error = "";
let statusRevision = 0;
let automatic = true;
let poll: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
export const subscribeCommunityStatus = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getCommunityStatus = () => statusRevision;
export const communityStatus = () => ({ checkedAt, error, busy: !!busy, automatic });
function notify() { statusRevision++; for (const listener of listeners) listener(); }

export function refreshCommunity() {
    if (!active) return Promise.resolve();
    if (busy) return busy;
    const token = generation;
    const request = new AbortController(); controller = request;
    const timeout = setTimeout(() => request.abort(), 15_000);
    const signal = request.signal;
    error = "";
    busy = (async () => {
        try {
            const id = UserStore.getCurrentUser()?.id;
            if (automatic && id) {
                await registerCommunityUser(id, false, signal);
                if (!active || token !== generation) return;
                if (automatic && UserStore.getCurrentUser()?.id === id) communityRegistry.setLocalUser(id);
            }
            const users = await fetchApprovedUsers(fetch, signal);
            if (!active || token !== generation) return;
            communityRegistry.replace(users); checkedAt = Date.now();
            await DataStore.set(key, { format: 1, checkedAt, users }).catch(() => {});
        } catch (failure) {
            if (active && token === generation) error = failure instanceof Error ? failure.message : "Registre indisponible ; cache conservé.";
        } finally {
            clearTimeout(timeout);
            if (token === generation) { busy = undefined; controller = undefined; notify(); }
        }
    })();
    notify(); return busy;
}

export async function startCommunityRegistry() {
    stopCommunityRegistry(); active = true;
    const token = generation;
    automatic = (await DataStore.get("pulsecord.community-automatic").catch(() => undefined)) !== false;
    try {
        const cache = await DataStore.get(key);
        if (!active || token !== generation) return;
        if (cache?.format === 1 && typeof cache.checkedAt === "number" && cache.checkedAt <= Date.now()) {
            communityRegistry.replace(cache.users); checkedAt = cache.checkedAt;
        }
    } catch { /* Offline or damaged cache must not block Discord. */ }
    if (!active || token !== generation) return;
    notify();
    if (Date.now() - checkedAt >= communityCacheMs) await refreshCommunity();
    else if (automatic) {
        const id = UserStore.getCurrentUser()?.id;
        if (id) await registerCommunityUser(id).then(() => { if (automatic && active && token === generation && UserStore.getCurrentUser()?.id === id) communityRegistry.setLocalUser(id); }).catch(failure => { if (active && token === generation) { error = String(failure); notify(); } });
    }
    const update = async () => { if (!active || token !== generation) return; await refreshCommunity(); if (active && token === generation) poll = setTimeout(update, 300000); };
    if (active && token === generation) poll = setTimeout(update, 300000);
}

export async function setAutomaticCommunity(enabled: boolean) {
    automatic = enabled; await DataStore.set("pulsecord.community-automatic", enabled);
    if (!enabled) {
        communityRegistry.setLocalUser();
        const id = UserStore.getCurrentUser()?.id;
        if (id) try { await registerCommunityUser(id, true); } catch (failure) { error = String(failure); }
    }
    await busy;
    notify(); await refreshCommunity();
}

export function stopCommunityRegistry() {
    if (poll !== undefined) clearTimeout(poll); poll = undefined;
    communityRegistry.setLocalUser();
    active = false; generation++; controller?.abort(); controller = undefined;
    busy = undefined; checkedAt = 0; error = ""; communityRegistry.clear(); notify();
}
