// SPDX-License-Identifier: GPL-3.0-or-later
import "./style.css";
import { definePluginSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import { MainSettingsIcon } from "@components/Icons";
import SettingsPlugin from "@plugins/_core/settings";
import { Devs } from "@utils/constants";
import definePlugin, { IconProps, OptionType } from "@utils/types";
import { React, useEffect, useState } from "@webpack/common";
import { brand } from "./brand";
import { showStartup, stopStartup } from "./startup";
import { brandFavicons, brandingCss, restoreBrandFavicons } from "./branding";
import { startUpdates, stopUpdates, UpdatesTab } from "./updates";
import { handleInboxNavigation, OfficialDmRow, openOfficialInbox, startOfficialInbox, stopOfficialInbox } from "./inbox";
import { addInboxUpdate } from "./inbox-store";
import { startHomeNavigation, stopHomeNavigation } from "./home-navigation";
import { wrapDmSection, wrapDmSectionHeight } from "./dm-section";
import { VoiceKeeperButton, VoiceKeeperIcon } from "./voicekeeper-button";
import { SettingsBanner } from "./settings-banner";
import { setBackgroundEconomy } from "./performance";
import { setSmoothTyping } from "./smooth-typing";
import { CommunityTab, startCommunityBadges, stopCommunityBadges } from "./community";

export function PulseCordIcon({ width = 20, height = 20 }: IconProps) {
    return <img src={brand.logo} width={width} height={height} alt="" />;
}

const settings = definePluginSettings({
    reduceMotion: { type: OptionType.BOOLEAN, description: "Disable costly animations", default: false, onChange: apply },
    smoothTyping: { type: OptionType.BOOLEAN, description: "Curseur fluide pendant la saisie des messages", default: true, onChange: apply },
    clearCacheOnStartup: { type: OptionType.BOOLEAN, description: "Vérifier le cache web une fois par semaine et le nettoyer au-delà de 256 Mo", default: true },
    backgroundEconomy: { type: OptionType.BOOLEAN, description: "Mettre les animations en pause lorsque Discord est masqué ou sans le focus", default: true, onChange: apply },
    startupAnimation: { type: OptionType.BOOLEAN, description: "Show the PulseCord logo when Discord opens", default: true, onChange: apply },
    updateNotifications: { type: OptionType.BOOLEAN, description: "Show PulseCord OFFICIAL update notifications", default: true },
    lastNotifiedUpdate: { type: OptionType.STRING, description: "Last announced update", default: "", hidden: true }
});
let appearance: HTMLStyleElement | undefined;
function apply() {
    setBackgroundEconomy(settings.store.backgroundEconomy);
    setSmoothTyping(settings.store.smoothTyping && !settings.store.reduceMotion);
    if (settings.store.reduceMotion || !settings.store.startupAnimation) stopStartup();
    if (!appearance) return;
    document.documentElement.toggleAttribute("data-pc-reduce-motion", settings.store.reduceMotion);
    if (!appearance.textContent) appearance.textContent = brandingCss(brand.logo, brand.splashLogo, brand.fontCss);
}
const QuickCSS = ErrorBoundary.wrap(() => {
    const [css, setCss] = useState("");
    const [status, setStatus] = useState("Loading…");
    const [ready, setReady] = useState(false);
    useEffect(() => { let mounted = true; VencordNative.quickCss.get().then(value => { if (mounted) { setCss(value); setReady(true); setStatus(""); } }).catch(e => mounted && setStatus(String(e))); return () => { mounted = false; }; }, []);
    return <section className="pulsecord"><h1>QuickCSS</h1><p>Save to preview directly in Discord. Keep a copy before replacing your CSS.</p>
        <label htmlFor="mc-css">Custom CSS</label><textarea id="mc-css" spellCheck={false} value={css} disabled={!ready} onChange={e => setCss(e.target.value)} />
        <button disabled={!ready} onClick={async () => { try { await VencordNative.quickCss.set(css); setStatus("Saved. CSS applied to the client."); } catch (e) { setStatus(String(e)); } }}>Save and apply</button><p role="status">{status}</p></section>;
}, { noop: false });
const Performance = ErrorBoundary.wrap(() => {
    const state = settings.use(["reduceMotion", "smoothTyping", "clearCacheOnStartup", "backgroundEconomy", "startupAnimation"]);
    return <section className="pulsecord"><h1>Performance</h1><label><input type="checkbox" checked={state.reduceMotion} onChange={e => settings.store.reduceMotion = e.target.checked} /> Reduce animations and transitions</label>
        <label><input type="checkbox" checked={state.smoothTyping} onChange={e => settings.store.smoothTyping = e.target.checked} /> Curseur fluide pendant la saisie des messages</label>
        <label><input type="checkbox" checked={state.startupAnimation} onChange={e => settings.store.startupAnimation = e.target.checked} /> Show the PulseCord startup logo</label>
        <label><input type="checkbox" checked={state.clearCacheOnStartup} onChange={e => settings.store.clearCacheOnStartup = e.target.checked} /> Nettoyage hebdomadaire du cache web au-delà de 256 Mo</label>
        <label><input type="checkbox" checked={state.backgroundEconomy} onChange={e => settings.store.backgroundEconomy = e.target.checked} /> Mettre les animations en pause lorsque Discord est masqué ou sans le focus</label>
        <p>Voice, calls and screen sharing keep working. Animations resume when you return to Discord.</p>
        <p>Le cache utile est conservé pour accélérer les chargements. Le contrôle hebdomadaire commence 30 secondes après le lancement ; la connexion, les réglages et les traductions sont conservés.</p>
        <h2>Diagnose a problem</h2><p>Close Discord, then launch it with <code>--vanilla</code>. This bypasses the mod without deleting your settings. Re-enable plugins individually after restarting normally.</p>
        <p>Patch compatibility remains dependent on the installed Discord build. A successful compilation is not a runtime compatibility check.</p></section>;
}, { noop: false });
const About = ErrorBoundary.wrap(() => <section className="pulsecord"><h1>About {brand.name}</h1><p>Independent Discord modification. Not affiliated with Discord, Equicord or Vencord.</p><p>Based on Equicord and Vencord, © their contributors and Vendicated, GPL-3.0-or-later. Installer archive format derived from Vencord Installer, GPL-3.0. PulseCord modifications © PulseCord contributors.</p><p>Plugins run with renderer privileges and are not isolated from Discord. Install only reviewed source. PulseCord adds no token collection, cloud service or telemetry.</p></section>, { noop: false });
const entries = [
    { key: "pulsecord_community", title: "Communauté", Component: CommunityTab },
    { key: "pulsecord_quickcss", title: "QuickCSS", Component: QuickCSS },
    { key: "pulsecord_performance", title: "Performance", Component: Performance },
    { key: "pulsecord_updates", title: "Updates", Component: UpdatesTab },
    { key: "pulsecord_about", title: "About", Component: About }
].map(entry => ({ ...entry, Component: () => <><SettingsBanner /><entry.Component /></>, Icon: MainSettingsIcon }));
export default definePlugin({
    name: "PulseCord", description: "PulseCord identity and settings.",
    authors: [Devs.PulseCord], required: true, settings,
    dependencies: ["UserAreaAPI", "BadgeAPI", "MessageDecorationsAPI", "MemberListDecoratorsAPI"],
    userAreaButton: { icon: VoiceKeeperIcon, render: VoiceKeeperButton, priority: 10000 },
    patches: [{
        find: '"dm-quick-launcher"===',
        group: true,
        replacement: [
            { match: /(getSectionHeight(?:",|=))(\i)=>([^;]+)(?=;)/, replace: "$1$self.wrapDmSectionHeight(($2)=>$3)" },
            { match: /(renderSection(?:",|=))(\i)=>\{(.+?)\}(?=;getRowHeight(?:",|=))/, replace: "$1$self.wrapDmSection(($2)=>{$3})" }
        ]
    }],
    wrapDmSection,
    wrapDmSectionHeight,
    renderOfficialDm: () => <OfficialDmRow />,
    flux: { CHANNEL_SELECT: handleInboxNavigation, GUILD_SELECT: handleInboxNavigation },
    start() { SettingsPlugin.customEntries.push(...entries); appearance = document.createElement("style"); document.head.append(appearance); apply(); brandFavicons(brand.logo); showStartup(brand.splashLogo, settings.store.startupAnimation && !settings.store.reduceMotion); startOfficialInbox(); startHomeNavigation(); startCommunityBadges(); startUpdates(id => { if (!settings.store.updateNotifications || settings.store.lastNotifiedUpdate === id) return false; settings.store.lastNotifiedUpdate = id; return true; }, next => { if (next.nextBuild) addInboxUpdate(next.nextBuild, next.changelog); }, openOfficialInbox); },
    stop() { stopCommunityBadges(); document.documentElement.removeAttribute("data-pc-reduce-motion"); setSmoothTyping(false); setBackgroundEconomy(false); stopHomeNavigation(); stopOfficialInbox(); stopUpdates(); stopStartup(); restoreBrandFavicons(); for (const entry of entries) { const i = SettingsPlugin.customEntries.indexOf(entry); if (i >= 0) SettingsPlugin.customEntries.splice(i, 1); } appearance?.remove(); appearance = undefined; }
});
