// SPDX-License-Identifier: GPL-3.0-or-later
import { isPluginEnabled, startPlugin, stopPlugin } from "@api/PluginManager";
import { Settings, useSettings } from "@api/Settings";
import { UserAreaButton, UserAreaRenderProps } from "@api/UserArea";
import VoiceKeeper from "@plugins/bypassvoc";
import { React, showToast } from "@webpack/common";

export function VoiceKeeperIcon({ className }: { className?: string; }) {
    return <svg className={`pc-voicekeeper-symbol ${className ?? ""}`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path className="pc-voicekeeper-slash" d="m5.65 5.65 12.7 12.7" />
    </svg>;
}

export function VoiceKeeperButton({ nameplate, iconForeground, hideTooltips }: UserAreaRenderProps) {
    useSettings(["plugins.VoiceKeeper.enabled"]);
    const enabled = isPluginEnabled(VoiceKeeper.name);
    const label = enabled ? "Désactiver VoiceKeeper" : "Activer VoiceKeeper";
    return <UserAreaButton
        className={`pc-voicekeeper-toggle${enabled ? " pc-voicekeeper-active" : ""}`}
        tooltipText={hideTooltips ? undefined : label}
        aria-label={label}
        role="switch"
        aria-checked={enabled}
        plated={nameplate != null}
        orangeGlow={enabled}
        icon={<VoiceKeeperIcon className={iconForeground} />}
        onClick={() => {
            const wasEnabled = isPluginEnabled(VoiceKeeper.name);
            const success = wasEnabled ? stopPlugin(VoiceKeeper) : startPlugin(VoiceKeeper);
            if (success) Settings.plugins.VoiceKeeper.enabled = !wasEnabled;
            else showToast({ text: "VoiceKeeper n’a pas pu changer d’état. Consultez les erreurs du plugin.", variant: "critical" });
        }}
    />;
}
