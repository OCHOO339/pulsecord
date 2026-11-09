/*
 * StatusRotator - rotation automatique du statut personnalisé
 * Plugin PulseCord / Equicord (API Vencord)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { definePluginSettings } from "@api/Settings";
import { getUserSettingLazy } from "@api/UserSettings";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { EmojiStore, FluxDispatcher, UserStore } from "@webpack/common";

const logger = new Logger("StatusRotator");
const MAX_PHRASES = 5;
const MAX_STATUS_LENGTH = 128;
interface CustomStatus {
    text: string;
    emojiId: string;
    emojiName: string;
    expiresAtMs: string;
    createdAtMs?: string;
}
const CustomStatusSettings = getUserSettingLazy<CustomStatus | null | undefined>("status", "customStatus")!;

function parseEmoji(input: string): { emojiId: string; emojiName: string } | undefined {
    const value = input.trim();
    if (!value) return;
    const markup = /^<a?:([A-Za-z0-9_]{1,32}):([1-9]\d{16,19})>$/.exec(value);
    const id = markup?.[2] ?? (/^[1-9]\d{16,19}$/.test(value) ? value : undefined);
    if (id && BigInt(id) <= 18446744073709551615n) {
        return { emojiId: id, emojiName: markup?.[1] ?? EmojiStore.getCustomEmojiById(id)?.name ?? "emoji" };
    }
    const graphemes = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(value)];
    if (value.length <= 64 && graphemes.length === 1 && /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u.test(value)) {
        return { emojiId: "0", emojiName: value };
    }
    throw Error("Colle un emoji (🔥), un ID Discord ou un code <:nom:ID> / <a:nom:ID>.");
}

function parseEmojis(input: string) {
    return input.split(";").map(value => value.trim()).filter(Boolean).map(value => parseEmoji(value)!);
}

function snapshot(status: CustomStatus | null | undefined): CustomStatus {
    return {
        text: status?.text ?? "",
        emojiId: status?.emojiId ?? "0",
        emojiName: status?.emojiName ?? "",
        expiresAtMs: status?.expiresAtMs ?? "0",
        ...(status?.createdAtMs ? { createdAtMs: status.createdAtMs } : {})
    };
}

const settings = definePluginSettings({
    active: {
        type: OptionType.BOOLEAN,
        description: "Rotation active (décoche pour mettre en pause sans désactiver le plugin)",
        default: true,
        onChange: restart
    },
    phrases: {
        type: OptionType.STRING,
        description: "Une phrase par ligne, 5 maximum. La rotation suit tes modifications.",
        placeholder: "première phrase\nseconde phrase\n...",
        multiline: true,
        default: "phrase 1\nphrase 2\nphrase 3\nphrase 4\nphrase 5",
        onChange: restart
    },
    emoji: {
        type: OptionType.STRING,
        description: "Sépare les emojis par ; pour les faire défiler dans l'ordre à chaque changement de statut. Emojis, IDs et codes <:nom:ID> acceptés. Vide : conserve l'emoji actuel. Discord doit autoriser leur utilisation sur ton compte.",
        placeholder: "🔥;💜;123456789012345678;<:nom:123456789012345678>",
        default: "",
        isValid(value) {
            if (typeof value !== "string") return "Saisis un emoji ou un ID Discord.";
            try { parseEmojis(value); return true; }
            catch (error) { return (error as Error).message; }
        },
        onChange: () => { emojiIndex = 0; restart(); }
    },
    interval: {
        type: OptionType.SLIDER,
        description: "Intervalle souhaité entre deux envois (secondes). La rotation attend Discord et espace automatiquement les envois si le serveur les limite.",
        markers: [3, 5, 10, 15, 30, 60],
        default: 5,
        stickToMarkers: false,
        onChange: restart
    },
    restoreOnStop: {
        type: OptionType.BOOLEAN,
        description: "Remettre ton statut d'origine quand le plugin est désactivé",
        default: true
    }
}).withPrivateSettings<{ originalStatus?: CustomStatus; originalUserId?: string }>();

let timer: ReturnType<typeof setTimeout> | undefined;
let running = false;
let generation = 0;
let index = 0;
let emojiIndex = 0;
let failures = 0;
let retryUntil = 0;
let unconfirmed = false;
let confirmationLogged = false;
let serverCooldownMs = 0;
let nextSendAt = 0;

interface SettingsUpdate {
    local?: boolean;
    wasSaved?: boolean;
    settings?: { type?: number; proto?: { status?: { customStatus?: CustomStatus } } };
}

// updateSetting resolves after the optimistic local edit, not the HTTP save.
// Discord retries rate-limited saves itself. Keep this phrase until the server
// acknowledges it instead of overwriting its pending save with the next phrase.
async function persistStatus(status: CustomStatus, userId: string) {
    const startedAt = Date.now();
    let rateLimited = false;
    const receiveEditInfo = (event: { settings?: { type?: number; changes?: { rateLimited?: boolean } } }) => {
        if (event.settings?.type === 1 && event.settings.changes?.rateLimited) rateLimited = true;
    };
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let receive: (event: SettingsUpdate) => void;
    let rejectSave: (error: Error) => void;
    const saved = new Promise<void>((resolve, reject) => {
        rejectSave = reject;
        receive = event => {
            if (UserStore.getCurrentUser()?.id !== userId) return reject(Error("Le compte actif a changé."));
            if (event.local !== false || !event.wasSaved || event.settings?.type !== 1) return;
            const remoteStatus = event.settings.proto?.status;
            if (!remoteStatus) return;
            const confirmed = snapshot(remoteStatus.customStatus);
            if (confirmed.text === status.text && confirmed.emojiId === status.emojiId && (status.emojiId !== "0" || confirmed.emojiName === status.emojiName))
                resolve();
        };
        FluxDispatcher.subscribe("USER_SETTINGS_PROTO_UPDATE", receive);
        FluxDispatcher.subscribe("USER_SETTINGS_PROTO_UPDATE_EDIT_INFO", receiveEditInfo);
        timeout = setTimeout(() => reject(Error("Discord n’a pas confirmé l’enregistrement du statut.")), 120000);
    });
    try {
        void CustomStatusSettings.updateSetting(status).catch(error => rejectSave(error));
        await saved;
        // A delayed acknowledgement is a successful save, not permission to
        // send another edit immediately into the same rate-limit bucket.
        if (rateLimited) {
            serverCooldownMs = Math.max(serverCooldownMs, Math.min(120000, Math.max(15000, Date.now() - startedAt + 1000)));
            logger.info("Discord limite les changements de statut ; espacement automatique des envois.");
        }
        nextSendAt = Date.now() + serverCooldownMs;
    } finally {
        if (timeout !== undefined) clearTimeout(timeout);
        FluxDispatcher.unsubscribe("USER_SETTINGS_PROTO_UPDATE", receive!);
        FluxDispatcher.unsubscribe("USER_SETTINGS_PROTO_UPDATE_EDIT_INFO", receiveEditInfo);
    }
}
// Serialize rotation and restoration, including when stop/start occurs during a request.
let pending: Promise<void> = Promise.resolve();

function enqueue(task: () => Promise<void>) {
    pending = pending.then(task).catch(error => logger.error("Échec de StatusRotator", error));
    return pending;
}

function clearTimer() {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
}

function current(token: number) {
    return running && settings.store.active && generation === token;
}

function getPhrases() {
    return settings.store.phrases.split("\n").map(line => line.trim()).filter(Boolean)
        .slice(0, MAX_PHRASES).map(phrase => Array.from(phrase).slice(0, MAX_STATUS_LENGTH).join(""));
}

function schedule(token: number, startedAt = Date.now()) {
    if (!current(token)) return;
    clearTimer();
    const interval = Number.isFinite(settings.store.interval) ? Math.max(3, settings.store.interval) : 5;
    const now = Date.now();
    const remaining = interval * 1000 - Math.max(0, now - startedAt);
    timer = setTimeout(() => { void enqueue(() => tick(token)); }, Math.max(0, remaining, retryUntil - now, nextSendAt - now));
}

function captureOriginal(userId: string) {
    if (settings.store.originalUserId === userId && settings.store.originalStatus) return;
    const status = snapshot(CustomStatusSettings.getSetting());
    if (UserStore.getCurrentUser()?.id !== userId) throw Error("Le compte actif a changé.");
    settings.store.originalStatus = status;
    settings.store.originalUserId = userId;
}

async function tick(token: number) {
    if (!current(token)) return;
    if (Date.now() < Math.max(retryUntil, nextSendAt)) return schedule(token);
    const userId = UserStore.getCurrentUser()?.id;
    const phrases = getPhrases();
    if (!userId || !phrases.length) return schedule(token);
    const startedAt = Date.now();
    try {
        captureOriginal(userId);
        if (!current(token) || UserStore.getCurrentUser()?.id !== userId) return;
        const text = phrases[index % phrases.length];
        const existing = snapshot(CustomStatusSettings.getSetting());
        const emojis = parseEmojis(settings.store.emoji);
        const emoji = emojis[emojiIndex % emojis.length] ?? existing;
        if (unconfirmed || text !== existing.text || emoji.emojiId !== existing.emojiId || emoji.emojiName !== existing.emojiName) {
            unconfirmed = true;
            await persistStatus({
                ...existing, text, emojiId: emoji.emojiId, emojiName: emoji.emojiName,
                expiresAtMs: "0", createdAtMs: String(Date.now())
            }, userId);
            unconfirmed = false;
            if (!confirmationLogged) {
                logger.info("Enregistrement du statut confirmé par Discord.");
                confirmationLogged = true;
            }
        }
        // An edit/stop during the request must not advance the new rotation.
        if (!current(token)) return;
        index = (index + 1) % phrases.length;
        emojiIndex = emojis.length ? (emojiIndex + 1) % emojis.length : 0;
        failures = 0;
        retryUntil = 0;
    } catch (error) {
        failures++;
        const retryAfter = Number((error as { body?: { retry_after?: number } })?.body?.retry_after);
        const delay = Math.max(Math.min(900, 30 * 2 ** Math.min(failures - 1, 5)), Number.isFinite(retryAfter) ? retryAfter : 0);
        retryUntil = Date.now() + delay * 1000;
        logger.error("Échec du changement de statut ; nouvelle tentative différée", error);
    } finally {
        schedule(token, startedAt);
    }
}

function restart() {
    clearTimer();
    const token = ++generation;
    if (current(token)) void enqueue(() => tick(token));
}

export default definePlugin({
    name: "StatusRotator",
    description: "Fait tourner ton statut personnalisé entre 5 phrases, à intervalle réglable, tant que Discord est ouvert.",
    searchTerms: ["status", "statut", "rotation"],
    dependencies: ["UserSettingsAPI"],
    tags: ["Customisation", "Utility"],
    authors: [{ name: "PulseCord user", id: 0n }],
    requiresRestart: false,
    settings,

    start() {
        running = true;
        index = 0;
        emojiIndex = 0;
        confirmationLogged = false;
        restart();
    },

    stop() {
        running = false;
        generation++;
        clearTimer();
        return enqueue(async () => {
            const original = settings.store.originalStatus;
            const userId = settings.store.originalUserId;
            if (!settings.store.restoreOnStop || !original || !userId || UserStore.getCurrentUser()?.id !== userId) return;
            try {
                const expired = Number(original.expiresAtMs) > 0 && Number(original.expiresAtMs) <= Date.now();
                await persistStatus(expired ? snapshot(null) : snapshot(original), userId);
                unconfirmed = false;
                delete settings.store.originalStatus;
                delete settings.store.originalUserId;
            } catch (error) {
                logger.error("Échec de la restauration du statut (sauvegarde conservée)", error);
            }
        });
    }
});
