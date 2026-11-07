/*
 * BioRotator - rotation automatique de la bio (À propos de moi)
 * Plugin PulseCord / Equicord (API Vencord)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { definePluginSettings } from "@api/Settings";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType } from "@utils/types";
import { RestAPI, UserProfileStore, UserStore } from "@webpack/common";

const logger = new Logger("BioRotator");
const MAX_PHRASES = 5;
const MAX_BIO_LENGTH = 300;
const ENDPOINT = "/users/@me/profile";

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
    interval: {
        type: OptionType.SLIDER,
        description: "Délai entre deux changements de bio (secondes). Discord peut imposer un délai supplémentaire.",
        markers: [3, 5, 10, 15, 30, 60],
        default: 5,
        stickToMarkers: false,
        onChange: restart
    },
    restoreOnStop: {
        type: OptionType.BOOLEAN,
        description: "Remettre ta bio d'origine quand le plugin est désactivé",
        default: true
    }
}).withPrivateSettings<{ originalBio?: string; originalUserId?: string }>();

let timer: ReturnType<typeof setTimeout> | undefined;
let running = false;
let generation = 0;
let index = 0;
let failures = 0;
let retryUntil = 0;
let lastApplied: string | undefined;
let lastUserId: string | undefined;
// Serialize rotation and restoration, including when stop/start occurs during a request.
let pending: Promise<void> = Promise.resolve();

function enqueue(task: () => Promise<void>) {
    pending = pending.then(task).catch(error => logger.error("Échec de BioRotator", error));
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
        .slice(0, MAX_PHRASES).map(phrase => phrase.slice(0, MAX_BIO_LENGTH));
}

function schedule(token: number) {
    if (!current(token)) return;
    clearTimer();
    const interval = Number.isFinite(settings.store.interval) ? Math.max(3, settings.store.interval) : 5;
    timer = setTimeout(() => { void enqueue(() => tick(token)); }, Math.max(interval * 1000, retryUntil - Date.now()));
}

async function captureOriginal(userId: string) {
    if (settings.store.originalUserId === userId && typeof settings.store.originalBio === "string") return;
    let bio = UserProfileStore.getUserProfile(userId)?.bio;
    if (typeof bio !== "string") {
        const response = await RestAPI.get({ url: `/users/${userId}/profile` });
        bio = response.body?.user_profile?.bio;
    }
    // Never replace an unknown bio with an empty backup.
    if (typeof bio !== "string") throw Error("Le profil n'est pas encore disponible ; la bio reste inchangée.");
    if (UserStore.getCurrentUser()?.id !== userId) throw Error("Le compte actif a changé.");
    settings.store.originalBio = bio;
    settings.store.originalUserId = userId;
}

async function tick(token: number) {
    if (!current(token)) return;
    if (Date.now() < retryUntil) return schedule(token);
    const userId = UserStore.getCurrentUser()?.id;
    const phrases = getPhrases();
    if (!userId || !phrases.length) return schedule(token);
    try {
        await captureOriginal(userId);
        if (!current(token) || UserStore.getCurrentUser()?.id !== userId) return;
        const bio = phrases[index % phrases.length];
        const existingBio = UserProfileStore.getUserProfile(userId)?.bio;
        if (bio !== existingBio && !(lastUserId === userId && lastApplied === bio)) {
            await RestAPI.patch({ url: ENDPOINT, body: { bio } });
            lastApplied = bio;
            lastUserId = userId;
        }
        index = (index + 1) % phrases.length;
        failures = 0;
        retryUntil = 0;
    } catch (error) {
        failures++;
        const retryAfter = Number((error as { body?: { retry_after?: number } })?.body?.retry_after);
        const delay = Math.max(Math.min(900, 30 * 2 ** Math.min(failures - 1, 5)), Number.isFinite(retryAfter) ? retryAfter : 0);
        retryUntil = Date.now() + delay * 1000;
        logger.error("Échec du changement de bio ; nouvelle tentative différée", error);
    } finally {
        schedule(token);
    }
}

function restart() {
    clearTimer();
    const token = ++generation;
    if (current(token)) void enqueue(() => tick(token));
}

export default definePlugin({
    name: "BioRotator",
    description: "Fait tourner ta bio entre 5 phrases, à intervalle réglable, tant que Discord est ouvert.",
    searchTerms: ["bio", "about me", "rotation", "à propos"],
    tags: ["Customisation", "Utility"],
    authors: [{ name: "PulseCord user", id: 0n }],
    requiresRestart: false,
    settings,

    start() {
        running = true;
        index = 0;
        restart();
    },

    stop() {
        running = false;
        generation++;
        clearTimer();
        return enqueue(async () => {
            const original = settings.store.originalBio;
            const userId = settings.store.originalUserId;
            if (!settings.store.restoreOnStop || typeof original !== "string" || !userId || UserStore.getCurrentUser()?.id !== userId) return;
            try {
                await RestAPI.patch({ url: ENDPOINT, body: { bio: original } });
                delete settings.store.originalBio;
                delete settings.store.originalUserId;
                lastApplied = undefined;
                lastUserId = undefined;
            } catch (error) {
                logger.error("Échec de la restauration de la bio (sauvegarde conservée)", error);
            }
        });
    }
});
