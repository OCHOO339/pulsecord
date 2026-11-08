// SPDX-License-Identifier: GPL-3.0-or-later
import { registryUrl } from "./community-core";

// This IPC exposes only the badge registry, never a general network proxy.
export async function communityRequest(_event: Electron.IpcMainInvokeEvent, operation: "users" | "register" | "remove", body?: string) {
    if (!["users", "register", "remove"].includes(operation)) throw Error("Invalid registry operation");
    if (operation === "users" ? body !== undefined : typeof body !== "string" || Buffer.byteLength(body) > 2048) throw Error("Invalid registry payload");
    const response = await fetch(`${registryUrl}/v1/${operation === "users" ? "users" : "installations"}`, {
        method: operation === "users" ? "GET" : operation === "register" ? "POST" : "DELETE",
        body, credentials: "omit", redirect: "error", signal: AbortSignal.timeout(15000),
        headers: { "Content-Type": "application/json", Accept: "application/json" }
    });
    const reader = response.body?.getReader();
    if (!reader) throw Error("Empty registry response");
    const chunks: Uint8Array[] = []; let size = 0;
    try {
        for (;;) {
            const { done, value } = await reader.read(); if (done) break;
            size += value.byteLength;
            if (size > 256000) throw Error("Registry response too large");
            chunks.push(value);
        }
    } finally { await reader.cancel().catch(() => {}); }
    return { status: response.status, body: Buffer.concat(chunks).toString("utf8") };
}
