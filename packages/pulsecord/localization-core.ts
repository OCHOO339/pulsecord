// SPDX-License-Identifier: GPL-3.0-or-later
// Only static plugin UI strings belong here. Never pass messages or input values.
export const discordLocales = ["id", "da", "de", "en-GB", "en-US", "es-ES", "es-419", "fr", "hr", "it", "lt", "hu", "nl", "no", "pl", "pt-BR", "ro", "fi", "sv-SE", "vi", "tr", "cs", "el", "bg", "ru", "uk", "hi", "th", "zh-CN", "ja", "zh-TW", "ko"] as const;
export function normalizeLocale(locale: string): string {
    const exact = discordLocales.find(value => value.toLowerCase() === locale.toLowerCase());
    if (exact) return exact;
    const base = locale.split(/[-_]/)[0].toLowerCase();
    return discordLocales.find(value => value.split("-")[0] === base) ?? "en-US";
}
export function translationLanguage(locale: string) {
    return ({ "en-US": "en", "en-GB": "en", "es-ES": "es", "es-419": "es", "pt-BR": "pt", "sv-SE": "sv", no: "no" } as Record<string, string>)[normalizeLocale(locale)] ?? normalizeLocale(locale);
}
export type Translator = (text: string, language: string) => Promise<string>;
export class PluginTranslations {
    private values = new Map<string, string>();
    private pending = new Set<string>();
    private failed = new Map<string, number>();
    private queue: Array<{ key: string; text: string; locale: string; }> = [];
    private active = 0;
    private listeners = new Set<() => void>();
    revision = 0;
    constructor(private catalogs: Record<string, Record<string, string>>, private provider?: Translator, private persist?: (entries: Array<[string, string]>) => void) {}
    subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
    hydrate(entries: Array<[string, string]>) {
        for (const [key, value] of entries.slice(-4000)) if (typeof key === "string" && typeof value === "string" && key.length < 5000 && value.length < 10000) this.values.set(key, value);
    }
    entries() {
        const result: Array<[string, string]> = []; let size = 0;
        for (const [key, value] of [...this.values].reverse()) {
            size += key.length + value.length;
            if (size > 1_500_000 || result.length >= 2000) break;
            result.unshift([key, value]);
        }
        return result;
    }
    translate(text: string, locale: string, request = true) {
        locale = normalizeLocale(locale);
        const local = this.catalogs[locale]?.[text];
        if (typeof local === "string") return local;
        if (!text.trim() || text.length > 4000) return text;
        const key = `${locale}\0${text}`;
        if (this.values.has(key)) return this.values.get(key)!;
        if (request && this.provider && !this.pending.has(key) && Date.now() - (this.failed.get(key) ?? 0) > 60000 && this.queue.length < 300) {
            this.pending.add(key); this.queue.push({ key, text, locale }); this.pump();
        }
        return text;
    }
    private pump() {
        while (this.provider && this.active < 2 && this.queue.length) {
            const item = this.queue.shift()!; this.active++;
            Promise.resolve().then(() => this.provider!(item.text, translationLanguage(item.locale))).then(value => {
                if (!value.trim() || value.length > 10000) throw Error("Invalid translation");
                this.values.set(item.key, value);
                while (this.values.size > 4000) this.values.delete(this.values.keys().next().value!);
                this.persist?.([...this.values]);
                this.revision++; for (const listener of this.listeners) listener();
            }).catch(() => { this.failed.set(item.key, Date.now()); if (this.failed.size > 4000) this.failed.delete(this.failed.keys().next().value!); }).finally(() => {
                this.pending.delete(item.key); this.active--; this.pump();
            });
        }
    }
}
