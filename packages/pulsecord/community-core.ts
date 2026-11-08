// SPDX-License-Identifier: GPL-3.0-or-later
const developerIds = new Set(["1366054228480753755", "669936721730863105"]);
export const registryUrl = "https://pulsecord-community-registry.streetforcelogistics.chatgpt.site";
export const communityCacheMs = 6 * 60 * 60 * 1000;
export type CommunityRole = "dev" | "user";
export const validUserId = (id: unknown): id is string => typeof id === "string" && /^[1-9]\d{16,19}$/.test(id) && BigInt(id) <= 18446744073709551615n;

export async function fetchApprovedUsers(fetcher: typeof fetch = fetch, signal?: AbortSignal) {
    {
        const response = await fetcher(`${registryUrl}/v1/users`, {
            credentials: "omit", referrerPolicy: "no-referrer", signal,
            headers: { Accept: "application/vnd.github+json" }
        });
        if (!response.ok) throw Error(response.status === 403 || response.status === 429 ? "Limite du registre atteinte ; le cache reste disponible." : `Registre indisponible (${response.status}).`);
        const reader = response.body?.getReader();
        if (!reader) throw Error("Réponse du registre vide.");
        let length = 0; const chunks: Uint8Array[] = [];
        try {
            while (true) {
                const { value, done } = await reader.read(); if (done) break;
                length += value.byteLength;
                if (length > 256_000) throw Error("Registre trop volumineux.");
                chunks.push(value);
            }
        } finally { await reader.cancel().catch(() => {}); }
        const bytes = new Uint8Array(length); let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
        const result = JSON.parse(new TextDecoder().decode(bytes));
        if (result?.format !== 1 || !Array.isArray(result.users) || result.users.length > 10000 || !result.users.every(validUserId)) throw Error("Registre invalide.");
        return [...new Set<string>(result.users)];
    }
    throw Error("Registre trop volumineux ; le cache précédent est conservé.");
}

export class CommunityRegistry {
    private users = new Set<string>();
    private listeners = new Set<() => void>();
    private localUserId: string | undefined;
    revision = 0;
    subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
    snapshot = () => this.revision;
    role(id: string): CommunityRole | undefined {
        return developerIds.has(id) ? "dev" : this.users.has(id) || id === this.localUserId ? "user" : undefined;
    }
    setLocalUser(id?: string) {
        if (id !== undefined && !validUserId(id)) return;
        if (this.localUserId === id) return;
        this.localUserId = id; this.revision++;
        for (const listener of this.listeners) listener();
    }
    replace(users: unknown) {
        if (!Array.isArray(users) || users.length > 10000 || !users.every(validUserId)) throw Error("Cache de badges invalide.");
        const next = new Set<string>(users);
        if (next.size === this.users.size && [...next].every(id => this.users.has(id))) return;
        this.users = next; this.revision++;
        for (const listener of this.listeners) listener();
    }
    clear() { this.replace([]); }
}

