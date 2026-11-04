/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { showNotification } from "@api/Notifications";
import ErrorBoundary from "@components/ErrorBoundary";
import { openSettingsTabModal } from "@components/settings/tabs/BaseTab";
import { Logger } from "@utils/Logger";
import { PluginNative } from "@utils/types";
import { React, useEffect, useState } from "@webpack/common";
import { brand } from "./brand";
import type { UpdateState } from "./native";
import { AnnouncementMarkdown } from "./markdown";

const logger = new Logger("PulseCord Updates");
let state: UpdateState = { phase: brand.updates.publicKey ? "idle" : "unconfigured", configured: Boolean(brand.updates.publicKey), currentVersion: brand.version };
const listeners = new Set<() => void>();
let startupTimer: ReturnType<typeof setTimeout> | undefined;
let interval: ReturnType<typeof setInterval> | undefined;
let generation = 0;
let shouldNotify: (id: string) => boolean = () => false;
let reportAvailable: (next: UpdateState) => void = () => {};
let openOfficial = () => openSettingsTabModal(UpdatesTab);
function native() { return VencordNative.pluginHelpers.PulseCord as PluginNative<typeof import("./native")>; }
function publish(next: UpdateState) { state = next; for (const listener of listeners) listener(); }

async function check(notify: boolean) {
    if (!IS_DISCORD_DESKTOP || !state.configured || state.phase === "installing" || state.phase === "restarting") return;
    const currentGeneration = generation;
    publish({ ...state, phase: "checking", error: undefined });
    try {
        const next = await native().checkForUpdates();
        if (generation !== currentGeneration) return;
        publish(next);
        if (next.phase === "available") reportAvailable(next);
        if (notify && next.phase === "available" && next.nextBuild && shouldNotify(next.nextBuild)) await showNotification({
            title: "PulseCord OFFICIAL",
            body: "Une mise à jour PulseCord est disponible. Cliquez pour ouvrir la conversation PulseCord.",
            icon: brand.logo,
            color: brand.accent,
            onClick: () => openOfficial()
        });
    } catch (error) { publish({ ...state, phase: "error", error: String(error) }); logger.warn("Update check failed", error); }
}
export function startUpdates(notify: (id: string) => boolean, available: (next: UpdateState) => void = () => {}, open = () => openSettingsTabModal(UpdatesTab)) {
    stopUpdates();
    shouldNotify = notify;
    reportAvailable = available; openOfficial = open;
    if (!IS_DISCORD_DESKTOP || !state.configured) return;
    startupTimer = setTimeout(() => { void check(true); }, 8000);
    interval = setInterval(() => { void check(true); }, 60 * 60 * 1000);
}
export function stopUpdates() {
    generation++;
    if (startupTimer !== undefined) clearTimeout(startupTimer);
    if (interval !== undefined) clearInterval(interval);
    startupTimer = undefined; interval = undefined; shouldNotify = () => false;
    reportAvailable = () => {}; openOfficial = () => openSettingsTabModal(UpdatesTab);
}
const labels: Record<UpdateState["phase"], string> = {
    unconfigured: "Le canal officiel doit être configuré avant de recevoir les mises à jour.",
    idle: "Vérifiez si une mise à jour PulseCord est disponible.",
    checking: "Vérification du canal officiel…",
    current: "PulseCord est à jour.",
    available: "Une mise à jour PulseCord est disponible.",
    restartRequired: "Le nouveau build est installé, mais Discord utilise encore l’ancien. Relancez-le pour terminer la mise à jour.",
    installing: "Téléchargement, vérification et installation…",
    restarting: "Mise à jour installée. Discord va redémarrer…",
    error: "La mise à jour n'a pas pu être effectuée."
};
export const UpdatesTab = ErrorBoundary.wrap(({ inConversation = false }: { inConversation?: boolean; }) => {
    const [current, setCurrent] = useState(state);
    useEffect(() => { const listener = () => setCurrent(state); listeners.add(listener); setCurrent(state); return () => { listeners.delete(listener); }; }, []);
    const busy = ["checking", "installing", "restarting"].includes(current.phase);
    return <section className="pulsecord"><h1>{inConversation ? "Mises à jour" : "Updates"}</h1>
        <p role="status">{labels[current.phase]}</p>
        {!inConversation && <details className="pc-update-diagnostics"><summary>Informations de version</summary><p>Version {current.currentVersion}{current.currentBuild && <> · Build chargé <code>{current.currentBuild.slice(0, 12)}</code></>}{current.nextBuild && <> · Build proposé <code>{current.nextBuild.slice(0, 12)}</code></>}</p></details>}
        {current.changelog && <details className="pc-announcement-details"><summary>Voir les nouveautés</summary><AnnouncementMarkdown text={current.changelog} /></details>}
        {current.error && <p role="alert">{current.error}</p>}
        <div className="pc-update-actions"><button disabled={!current.configured || busy} onClick={() => { void check(false); }}>Vérifier les mises à jour</button>
            {!inConversation && <button onClick={() => openOfficial()}>Ouvrir la conversation PulseCord</button>}
            {["available", "restartRequired"].includes(current.phase) && <button onClick={async () => {
                publish({ ...state, phase: "installing" });
                try { publish(await native().applyUpdate()); } catch (error) { publish({ ...state, phase: "error", error: String(error) }); }
            }}>{current.phase === "restartRequired" ? "Terminer la mise à jour et relancer Discord" : "Mettre à jour et relancer Discord"}</button>}
        </div>{!inConversation && <p>La mise à jour est vérifiée avant installation. Le redémarrage est automatique après votre clic.</p>}
    </section>;
}, { noop: false });
