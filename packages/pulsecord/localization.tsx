// SPDX-License-Identifier: GPL-3.0-or-later
import { LocaleStore, React } from "@webpack/common";
import { PluginTranslations } from "./localization-core";
import { french } from "./localization-fr";

let loaded = false;
let saveTimer: ReturnType<typeof setTimeout> | undefined;
const cacheKey = "pulsecord.plugin-translations.v1";
export async function translatePluginLabel(text: string, language: string) {
    const url = "https://translate.googleapis.com/translate_a/single?" + new URLSearchParams({ client: "gtx", sl: "auto", tl: language, dt: "t", q: text });
    const response = await fetch(url, { credentials: "omit", referrerPolicy: "no-referrer", signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw Error("Plugin translation unavailable");
    const data = await response.json();
    if (!Array.isArray(data?.[0])) throw Error("Invalid plugin translation");
    return data[0].map((part: unknown[]) => typeof part?.[0] === "string" ? part[0] : "").join("");
}
const english = Object.fromEntries(Object.keys(french).map(text => [text, text]));
export const pluginTranslations = new PluginTranslations({ fr: french, "en-US": english, "en-GB": english }, translatePluginLabel, () => {
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
        saveTimer = undefined;
        try { localStorage.setItem(cacheKey, JSON.stringify(pluginTranslations.entries())); } catch { /* Storage full or unavailable: keep the in-memory cache. */ }
    }, 2000);
});
function loadCache() {
    if (loaded) return;
    loaded = true;
    try {
        const raw = localStorage.getItem(cacheKey);
        if (raw && raw.length <= 4_000_000) {
            const entries = JSON.parse(raw);
            if (Array.isArray(entries)) pluginTranslations.hydrate(entries.filter(item => Array.isArray(item) && item.length === 2));
        }
    } catch { /* A damaged cache must never prevent Discord from opening. */ }
}
export function translateUi(text: string) {
    if (!LocaleStore || /^(?:PulseCord|VoiceKeeper|Discord|QuickCSS|GitHub|API)$/.test(text)) return text;
    loadCache();
    return pluginTranslations.translate(text, LocaleStore?.locale ?? "en-US");
}
export function cachedUiTranslation(text: string) {
    loadCache();
    return pluginTranslations.translate(text, LocaleStore?.locale ?? "en-US", false);
}
export function usePluginLocale() {
    const locale = React.useSyncExternalStore(listener => {
        LocaleStore.addChangeListener(listener);
        const unsubscribe = pluginTranslations.subscribe(listener);
        return () => { LocaleStore.removeChangeListener(listener); unsubscribe(); };
    }, () => `${LocaleStore.locale}:${pluginTranslations.revision}`);
    return locale;
}
export function PluginText({ text }: { text: string; }) {
    usePluginLocale();
    return <>{translateUi(text)}</>;
}
