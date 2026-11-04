/*
 * Vencord, a Discord client mod
 * Plugin: VoiceKeeper
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import {
    ChannelActions,
    ChannelStore,
    FluxDispatcher,
    UserStore,
    VoiceStateStore,
} from "@webpack/common";

const settings = definePluginSettings({
    returnOnMove: {
        type: OptionType.BOOLEAN,
        description: "Revenir dans le salon d'origine si quelqu'un te déplace",
        default: true,
    },
    rejoinDelay: {
        type: OptionType.SLIDER,
        description: "Délai avant de rejoindre à nouveau (ms)",
        markers: [250, 500, 1000, 2000, 4000],
        default: 750,
        stickToMarkers: true,
    },
    maxAttempts: {
        type: OptionType.NUMBER,
        description: "Tentatives max par incident (0 = illimité)",
        default: 0,
    },
});

let desiredChannelId: string | null = null;
let desiredGuildId: string | null = null;

let attempts = 0;
let rejoinTimer: ReturnType<typeof setTimeout> | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

function myId(): string {
    return UserStore.getCurrentUser()?.id;
}

function currentChannelId(): string | null {
    const id = myId();
    if (!id || !desiredGuildId) return null;
    return VoiceStateStore.getVoiceState(desiredGuildId, id)?.channelId ?? null;
}

function clearTimer() {
    if (rejoinTimer) clearTimeout(rejoinTimer);
    rejoinTimer = null;
}
function syncSafetyPoll() {
    if (!desiredChannelId) {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = null;
    } else if (!pollTimer) {
        pollTimer = setInterval(() => {
            if (desiredChannelId && !rejoinTimer && currentChannelId() !== desiredChannelId) scheduleRejoin("poll", 1500);
        }, 5000);
    }
}

function scheduleRejoin(reason: string, delay = settings.store.rejoinDelay) {
    if (!desiredChannelId || rejoinTimer) return;

    const max = settings.store.maxAttempts;
    if (max > 0 && attempts >= max) return;

    attempts++;
    rejoinTimer = setTimeout(() => {
        rejoinTimer = null;
        rejoin(reason);
    }, delay);
}

function rejoin(reason: string) {
    if (!desiredChannelId) return;

    const channel = ChannelStore.getChannel(desiredChannelId);
    if (!channel) {
        // Le salon a disparu : on abandonne la cible.
        desiredChannelId = null;
        syncSafetyPoll();
        return;
    }

    if (currentChannelId() === desiredChannelId) return;

    console.log(`[VoiceKeeper] Rejoin (${reason}) → ${channel.name ?? desiredChannelId}`);
    ChannelActions.selectVoiceChannel(desiredChannelId);
}

function onVoiceStateUpdates({ voiceStates }: { voiceStates: any[]; }) {
    const id = myId();
    if (!id) return;

    for (const state of voiceStates) {
        if (state.userId !== id) continue;

        // Déconnexion vocale.
        if (!state.channelId) {
            scheduleRejoin("disconnected");
            return;
        }

        // Nouvelle cible (première connexion ou changement de guilde).
        if (!desiredChannelId || state.guildId !== desiredGuildId) {
            desiredChannelId = state.channelId;
            desiredGuildId = state.guildId;
            syncSafetyPoll();
            attempts = 0;
            return;
        }

        // Déplacement dans la même guilde.
        if (state.channelId !== desiredChannelId) {
            if (settings.store.returnOnMove) {
                scheduleRejoin("moved");
            } else {
                desiredChannelId = state.channelId;
                attempts = 0;
            }
            return;
        }

        // On est au bon endroit.
        attempts = 0;
    }
}

function onChannelSelect({ channelId, guildId }: { channelId?: string | null; guildId?: string | null; }) {
    // Bouton "Déconnexion" cliqué à la main → on ne force plus le retour.
    if (!channelId) {
        desiredChannelId = null;
        desiredGuildId = guildId ?? null;
        attempts = 0;
        clearTimer();
        syncSafetyPoll();
    }
}

function onRtcState({ state }: { state: string; }) {
    if (state === "RTC_DISCONNECTED" && desiredChannelId) {
        scheduleRejoin("rtc-disconnected");
    }
}

export default definePlugin({
    name: "VoiceKeeper",
    description: "Te maintient dans le salon vocal : revient si on te déplace, se reconnecte si on te déconnecte.",
    authors: [{ name: "toi", id: 0n }],
    settings,

    start() {
        // Enabling from the user panel must also work when already in voice.
        const id = myId();
        const current = id ? VoiceStateStore.getVoiceStateForUser(id) : undefined;
        desiredChannelId = current?.channelId ?? null;
        desiredGuildId = current?.guildId ?? (desiredChannelId ? ChannelStore.getChannel(desiredChannelId)?.guild_id : null) ?? null;
        attempts = 0;
        FluxDispatcher.subscribe("VOICE_STATE_UPDATES", onVoiceStateUpdates);
        FluxDispatcher.subscribe("VOICE_CHANNEL_SELECT", onChannelSelect);
        FluxDispatcher.subscribe("RTC_CONNECTION_STATE", onRtcState);

        // Filet de sécurité : Discord laisse parfois une connexion zombie
        // sans émettre de VOICE_STATE_UPDATE.
        syncSafetyPoll();
    },

    stop() {
        FluxDispatcher.unsubscribe("VOICE_STATE_UPDATES", onVoiceStateUpdates);
        FluxDispatcher.unsubscribe("VOICE_CHANNEL_SELECT", onChannelSelect);
        FluxDispatcher.unsubscribe("RTC_CONNECTION_STATE", onRtcState);

        clearTimer();
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = null;

        desiredChannelId = null;
        desiredGuildId = null;
        attempts = 0;
    },
});
