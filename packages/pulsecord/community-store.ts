// SPDX-License-Identifier: GPL-3.0-or-later
import * as DataStore from "@api/DataStore";
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
const listeners = new Set<() => void>();
export const subscribeCommunityStatus = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getCommunityStatus = () => statusRevision;
export const communityStatus = () => ({ checkedAt, error, busy: !!busy });
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
}

export function stopCommunityRegistry() {
    active = false; generation++; controller?.abort(); controller = undefined;
    busy = undefined; checkedAt = 0; error = ""; communityRegistry.clear(); notify();
}
