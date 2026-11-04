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

export function PulseCordIcon({ width = 20, height = 20 }: IconProps) {
    return <img src={brand.logo} width={width} height={height} alt="" />;
}

const presets = {
    Midnight: ["#151519", "#202026"], AMOLED: ["#000000", "#0b0b0b"],
    Glass: ["#202428", "#2c343b"], Neon: ["#101513", "#17241e"], Minimal: ["#202020", "#292929"]
};
const settings = definePluginSettings({
    preset: { type: OptionType.SELECT, description: "Local colour preset", options: Object.keys(presets).map(value => ({ label: value, value, default: value === "Midnight" })), onChange: apply },
    reduceMotion: { type: OptionType.BOOLEAN, description: "Disable costly animations", default: false, onChange: apply },
    clearCacheOnStartup: { type: OptionType.BOOLEAN, description: "Clear Discord's temporary web cache at startup", default: true },
    startupAnimation: { type: OptionType.BOOLEAN, description: "Show the PulseCord logo when Discord opens", default: true, onChange: apply },
    usePreset: { type: OptionType.BOOLEAN, description: "Apply PulseCord appearance", default: true, onChange: apply },
    updateNotifications: { type: OptionType.BOOLEAN, description: "Show PulseCord OFFICIAL update notifications", default: true },
    lastNotifiedUpdate: { type: OptionType.STRING, description: "Last announced update", default: "", hidden: true }
});
let appearance: HTMLStyleElement | undefined;
function apply() {
    if (settings.store.reduceMotion || !settings.store.startupAnimation) stopStartup();
    if (!appearance) return;
    const colors = presets[settings.store.preset as keyof typeof presets] || presets.Midnight;
    appearance.textContent = brandingCss(brand.logo, brand.splashLogo, brand.fontCss) + (settings.store.usePreset ? `:root,.theme-dark { --background-primary:${colors[0]}; --background-secondary:${colors[1]}; --background-base-low:${colors[0]}; --background-base-lower:${colors[1]}; --brand-500:${brand.accent}; }` : "") +
        (settings.store.reduceMotion ? '* { animation-duration:0s !important; transition-duration:0s !important; scroll-behavior:auto !important; }' : "");
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
const Appearance = ErrorBoundary.wrap(() => {
    const state = settings.use(["preset", "usePreset", "startupAnimation"]);
    return <section className="pulsecord"><h1>Appearance</h1><p>Five local presets. Glass is an opaque palette; it does not enable window transparency.</p>
        <label><input type="checkbox" checked={state.usePreset} onChange={e => settings.store.usePreset = e.target.checked} /> Apply PulseCord palette</label>
        <label>Preset <select value={state.preset} onChange={e => settings.store.preset = e.target.value}>{Object.keys(presets).map(p => <option key={p}>{p}</option>)}</select></label>
        <label><input type="checkbox" checked={state.startupAnimation} onChange={e => settings.store.startupAnimation = e.target.checked} /> Show the PulseCord startup logo</label>
        <button onClick={() => { settings.store.usePreset = false; settings.store.preset = "Midnight"; }}>Reset appearance</button></section>;
}, { noop: false });
const Performance = ErrorBoundary.wrap(() => {
    const state = settings.use(["reduceMotion", "clearCacheOnStartup"]);
    return <section className="pulsecord"><h1>Performance</h1><label><input type="checkbox" checked={state.reduceMotion} onChange={e => settings.store.reduceMotion = e.target.checked} /> Reduce animations and transitions</label>
        <label><input type="checkbox" checked={state.clearCacheOnStartup} onChange={e => settings.store.clearCacheOnStartup = e.target.checked} /> Clear temporary web cache at every launch</label>
        <p>Applies from the next launch. This frees disk space; the first load may be slower. Your login, settings and cached translations are kept.</p>
        <h2>Diagnose a problem</h2><p>Close Discord, then launch it with <code>--vanilla</code>. This bypasses the mod without deleting your settings. Re-enable plugins individually after restarting normally.</p>
        <p>Patch compatibility remains dependent on the installed Discord build. A successful compilation is not a runtime compatibility check.</p></section>;
}, { noop: false });
const About = ErrorBoundary.wrap(() => <section className="pulsecord"><h1>About {brand.name}</h1><p>Independent Discord modification. Not affiliated with Discord, Equicord or Vencord.</p><p>Based on Equicord and Vencord, © their contributors and Vendicated, GPL-3.0-or-later. Installer archive format derived from Vencord Installer, GPL-3.0. PulseCord modifications © PulseCord contributors.</p><p>Plugins run with renderer privileges and are not isolated from Discord. Install only reviewed source. PulseCord adds no token collection, cloud service or telemetry.</p></section>, { noop: false });
const entries = [
    { key: "pulsecord_quickcss", title: "QuickCSS", Component: QuickCSS },
    { key: "pulsecord_appearance", title: "Appearance", Component: Appearance },
    { key: "pulsecord_performance", title: "Performance", Component: Performance },
    { key: "pulsecord_updates", title: "Updates", Component: UpdatesTab },
    { key: "pulsecord_about", title: "About", Component: About }
].map(entry => ({ ...entry, Icon: MainSettingsIcon }));
export default definePlugin({
    name: "PulseCord", description: "PulseCord identity, local appearance and settings.",
    authors: [Devs.PulseCord], required: true, settings,
    dependencies: ["UserAreaAPI"],
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
    start() { SettingsPlugin.customEntries.push(...entries); appearance = document.createElement("style"); document.head.append(appearance); apply(); brandFavicons(brand.logo); showStartup(brand.splashLogo, settings.store.startupAnimation && !settings.store.reduceMotion); startOfficialInbox(); startHomeNavigation(); startUpdates(id => { if (!settings.store.updateNotifications || settings.store.lastNotifiedUpdate === id) return false; settings.store.lastNotifiedUpdate = id; return true; }, next => { if (next.nextBuild) addInboxUpdate(next.nextBuild, next.changelog); }, openOfficialInbox); },
    stop() { stopHomeNavigation(); stopOfficialInbox(); stopUpdates(); stopStartup(); restoreBrandFavicons(); for (const entry of entries) { const i = SettingsPlugin.customEntries.indexOf(entry); if (i >= 0) SettingsPlugin.customEntries.splice(i, 1); } appearance?.remove(); appearance = undefined; }
});
