// SPDX-License-Identifier: GPL-3.0-or-later
const developerIds = new Set(["1366054228480753755", "669936721730863105"]);
export const registryPrefix = "pulsecord-user:";
export const registryUrl = "https://api.github.com/repos/OCHOO339/pulsecord/labels";
export const communityCacheMs = 6 * 60 * 60 * 1000;
export type CommunityRole = "dev" | "user";
export const validUserId = (id: unknown): id is string => typeof id === "string" && /^[1-9]\d{16,19}$/.test(id) && BigInt(id) <= 18446744073709551615n;

export function approvedIds(labels: unknown): string[] {
    if (!Array.isArray(labels) || labels.length > 100) throw Error("Registre GitHub invalide.");
    return labels.flatMap(label => {
        const name = label?.name;
        if (typeof name !== "string" || !name.startsWith(registryPrefix)) return [];
        const id = name.slice(registryPrefix.length);
        return validUserId(id) ? [id] : [];
    });
}

export async function fetchApprovedUsers(fetcher: typeof fetch = fetch, signal?: AbortSignal) {
    const users = new Set<string>();
    for (let page = 1; page <= 10; page++) {
        const response = await fetcher(`${registryUrl}?per_page=100&page=${page}`, {
            credentials: "omit", referrerPolicy: "no-referrer", signal,
            headers: { Accept: "application/vnd.github+json" }
        });
        if (!response.ok) throw Error(response.status === 403 || response.status === 429 ? "Limite GitHub atteinte ; le cache reste disponible." : `Registre indisponible (${response.status}).`);
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
        const labels: unknown = JSON.parse(new TextDecoder().decode(bytes));
        for (const id of approvedIds(labels)) users.add(id);
        if ((labels as unknown[]).length < 100) return [...users];
    }
    throw Error("Registre trop volumineux ; le cache précédent est conservé.");
}

export class CommunityRegistry {
    private users = new Set<string>();
    private listeners = new Set<() => void>();
    revision = 0;
    subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
    snapshot = () => this.revision;
    role(id: string): CommunityRole | undefined {
        return developerIds.has(id) ? "dev" : this.users.has(id) ? "user" : undefined;
    }
    replace(users: unknown) {
        if (!Array.isArray(users) || users.length > 1000 || !users.every(validUserId)) throw Error("Cache de badges invalide.");
        const next = new Set<string>(users);
        if (next.size === this.users.size && [...next].every(id => this.users.has(id))) return;
        this.users = next; this.revision++;
        for (const listener of this.listeners) listener();
    }
    clear() { this.replace([]); }
}

export function registrationUrl(id: string) {
    if (!validUserId(id)) throw Error("Compte Discord indisponible.");
    const params = new URLSearchParams({
        title: "Demande de badge Pulse User",
        body: `### ID Discord\n${id}\n\n### Demande\nJ'utilise PulseCord et je souhaite afficher le badge Pulse User.\nJe comprends que cet ID sera public sur GitHub et dans le registre après validation.\n`
    });
    return `https://github.com/OCHOO339/pulsecord/issues/new?${params}`;
}
