// SPDX-License-Identifier: GPL-3.0-or-later
import * as DataStore from "@api/DataStore";
import { registryUrl, validUserId } from "./community-core";
import { communityFetch } from "./community-network";
const key = "pulsecord.community-installation.v1";
interface Installation { format: 1; publicKey: string; privateKey: string; userId?: string; registeredAt?: number }
const encode = (bytes: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
const decode = (value: string) => Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), c => c.charCodeAt(0));
let pending: Promise<unknown> = Promise.resolve();
export function registerCommunityUser(userId: string, remove = false, signal?: AbortSignal) {
    const result = pending.then(() => updateRegistration(userId, remove, signal));
    pending = result.catch(() => {});
    return result;
}
async function updateRegistration(userId: string, remove = false, signal?: AbortSignal) {
    if (!validUserId(userId)) throw Error("Compte Discord indisponible.");
    let installation = await DataStore.get<Installation>(key);
    if (!installation && remove) return;
    if (!installation) {
        const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
        installation = { format: 1, publicKey: encode(await crypto.subtle.exportKey("raw", pair.publicKey)), privateKey: encode(await crypto.subtle.exportKey("pkcs8", pair.privateKey)) };
        await DataStore.set(key, installation);
    }
    if (!remove && installation.userId === userId && installation.registeredAt && Date.now() - installation.registeredAt >= 0 && Date.now() - installation.registeredAt < 12 * 3600000) return;
    const method = remove ? "DELETE" : "POST";
    const timestamp = Date.now();
    const signingKey = await crypto.subtle.importKey("pkcs8", decode(installation.privateKey), { name: "Ed25519" }, false, ["sign"]);
    const message = `pulsecord-badge-v1\n${method}\n${installation.publicKey}\n${userId}\n${timestamp}`;
    const signature = encode(await crypto.subtle.sign("Ed25519", signingKey, new TextEncoder().encode(message)));
    const response = await communityFetch(`${registryUrl}/v1/installations`, { method, credentials: "omit", referrerPolicy: "no-referrer", signal,
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, publicKey: installation.publicKey, timestamp, signature }) });
    if (!response.ok) throw Error(`Inscription automatique indisponible (${response.status}).`);
    if (remove) { delete installation.userId; delete installation.registeredAt; }
    else { installation.userId = userId; installation.registeredAt = timestamp; }
    await DataStore.set(key, installation);
}
