// SPDX-License-Identifier: GPL-3.0-or-later
import { isPluginEnabled, startPlugin, stopPlugin } from "@api/PluginManager";
import { Settings, useSettings } from "@api/Settings";
import { UserAreaButton, UserAreaRenderProps } from "@api/UserArea";
import VoiceKeeper from "@plugins/bypassvoc";
import { findComponentByCodeLazy } from "@webpack";
import { React, showToast } from "@webpack/common";
import type { ComponentType, RefObject } from "react";
import { voiceKeeperAnimation, voiceKeeperMarkers } from "./voicekeeper-animation";

interface AnimationHandle { play(marker: string): void; stopIfPlaying(marker: string): void; }
const NativeAnimatedIcon = findComponentByCodeLazy("useLottieDefaultColors", "initialAnimation") as ComponentType<{
    src: () => Promise<{ default: typeof voiceKeeperAnimation; }>;
    markers: typeof voiceKeeperMarkers;
    initialAnimation: string;
    initialFrame: number;
    ref: RefObject<AnimationHandle | null>;
    size: string; width: number; height: number; className: string; color: string;
}>;
const animationSource = async () => ({ default: voiceKeeperAnimation });

export function VoiceKeeperIcon({ className }: { className?: string; }) {
    return <svg className={`pc-voicekeeper-symbol ${className ?? ""}`} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path className="pc-voicekeeper-slash" d="m5.65 5.65 12.7 12.7" />
    </svg>;
}

export function VoiceKeeperButton({ nameplate, iconForeground, hideTooltips }: UserAreaRenderProps) {
    useSettings(["plugins.VoiceKeeper.enabled"]);
    const enabled = isPluginEnabled(VoiceKeeper.name);
    const animation = React.useRef<AnimationHandle | null>(null);
    const initialFrame = React.useRef(enabled ? 70 : 170);
    const previous = React.useRef(enabled);
    React.useEffect(() => {
        if (previous.current === enabled) return;
        previous.current = enabled;
        animation.current?.play(enabled ? "enable" : "disable");
    }, [enabled]);
    const hoverMarker = enabled ? "hover_enabled" : "hover_disabled";
    const motionEvents = {
        onMouseEnter: () => animation.current?.play(hoverMarker),
        onMouseLeave: () => animation.current?.stopIfPlaying(hoverMarker),
        onFocus: () => animation.current?.play(hoverMarker),
        onBlur: () => animation.current?.stopIfPlaying(hoverMarker)
    };
    const label = enabled ? "Désactiver VoiceKeeper" : "Activer VoiceKeeper";
    return <UserAreaButton
        className={`pc-voicekeeper-toggle${enabled ? " pc-voicekeeper-active" : ""}`}
        tooltipText={hideTooltips ? undefined : label}
        aria-label={label}
        role="switch"
        aria-checked={enabled}
        plated={nameplate != null}
        orangeGlow={enabled}
        {...motionEvents}
        icon={<NativeAnimatedIcon ref={animation} src={animationSource} markers={voiceKeeperMarkers}
            initialAnimation={enabled ? "idle_enabled" : "idle_disabled"} initialFrame={initialFrame.current}
            size="custom" width={20} height={20} color={enabled ? "var(--brand-500)" : "currentColor"}
            className={`pc-voicekeeper-animation ${iconForeground ?? ""}`} />}
        onClick={() => {
            const wasEnabled = isPluginEnabled(VoiceKeeper.name);
            const success = wasEnabled ? stopPlugin(VoiceKeeper) : startPlugin(VoiceKeeper);
            if (success) Settings.plugins.VoiceKeeper.enabled = !wasEnabled;
            else showToast({ text: "VoiceKeeper n’a pas pu changer d’état. Consultez les erreurs du plugin.", variant: "critical" });
        }}
    />;
}
