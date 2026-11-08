// SPDX-License-Identifier: GPL-3.0-or-later
import { addProfileBadge, removeProfileBadge, ProfileBadge } from "@api/Badges";
import { addMessageDecoration, removeMessageDecoration } from "@api/MessageDecorations";
import { addMemberListDecorator, removeMemberListDecorator } from "@api/MemberListDecorators";
import { React, UserStore } from "@webpack/common";
import { brand } from "./brand";
import { communityRegistry, communityStatus, getCommunityStatus, refreshCommunity, setAutomaticCommunity, startCommunityRegistry, stopCommunityRegistry, subscribeCommunityStatus } from "./community-store";

export function PulseCommunityBadge({ userId, compact = false }: { userId: string; compact?: boolean }) {
    React.useSyncExternalStore(communityRegistry.subscribe, communityRegistry.snapshot);
    const role = communityRegistry.role(userId);
    if (!role) return null;
    const label = role === "dev" ? "Pulse Dev" : "Pulse User";
    return <span className={`pc-community-badge${role === "dev" ? " pc-community-dev" : ""}${compact ? " pc-community-compact" : ""}`} title={label} aria-label={label}>
        <img src={brand.logo} width={14} height={14} alt="" />{!compact && <span>{label}</span>}
    </span>;
}
const profileBadge: ProfileBadge = {
    id: "pulsecord-community",
    getBadges: ({ userId }) => {
        const role = communityRegistry.role(userId);
        if (!role) return [];
        return [{ id: `pulsecord-${role}`, key: "PulseCord", component: ({ userId }) => <PulseCommunityBadge userId={userId} />, iconSrc: brand.logo, description: role === "dev" ? "Pulse Dev · Développeur PulseCord" : "Pulse User · Membre PulseCord inscrit", name: role === "dev" ? "Pulse Dev" : "Pulse User", link: "https://github.com/OCHOO339/pulsecord" }];
    }
};

export function startCommunityBadges() {
    addProfileBadge(profileBadge);
    addMessageDecoration("pulsecord-community", props => <PulseCommunityBadge userId={props.message.author.id} />);
    addMemberListDecorator("pulsecord-community", props => {
        // Group and system DM rows do not always contain a user. For one-to-one
        // DMs only, recover the recipient without treating a channel ID as a user.
        const userId = props.user?.id ?? (
            props.type === "dm" && props.channel?.type === 1 && props.channel.recipients?.length === 1
                ? props.channel.recipients[0] : undefined
        );
        return userId ? <PulseCommunityBadge userId={userId} compact /> : null;
    });
    void startCommunityRegistry();
}
export function stopCommunityBadges() {
    removeProfileBadge(profileBadge); removeMessageDecoration("pulsecord-community"); removeMemberListDecorator("pulsecord-community");
    stopCommunityRegistry();
}
export function CommunityTab() {
    React.useSyncExternalStore(subscribeCommunityStatus, getCommunityStatus);
    const { checkedAt, error, busy, automatic } = communityStatus();
    const id = UserStore.getCurrentUser()?.id;
    return <section className="pulsecord"><h1>Communauté PulseCord</h1>
        <p>Les badges Pulse Dev et Pulse User sont visibles dans PulseCord, sur les profils, les messages et la liste des membres.</p>
        {id && <p>Ton badge : <PulseCommunityBadge userId={id} /></p>}
        <p>Pulse User est attribué automatiquement au démarrage, sans demande ni validation. Les comptes développeurs gardent Pulse Dev.</p>
        <label><input type="checkbox" checked={automatic} onChange={event => { void setAutomaticCommunity(event.target.checked); }} /> Partager automatiquement mon badge depuis cet appareil</label>
        <p>Le registre public reçoit ton ID Discord et une clé publique d’installation. La clé privée reste sur ton appareil. Aucun message ni jeton Discord n’est envoyé.</p>
        <div className="pc-update-actions">
            <button disabled={busy} onClick={() => { void refreshCommunity(); }}>{busy ? "Actualisation…" : "Actualiser les badges"}</button></div>
        <p>Les badges sont actualisés toutes les cinq minutes, avec un cache hors ligne. Une inscription expire après 30 jours sans renouvellement. Pulse User indique une inscription déclarée par un client ; ce n’est pas une identité Discord vérifiée.</p>
        {checkedAt > 0 && <p>Dernière synchronisation : {new Date(checkedAt).toLocaleString()}</p>}
        {error && <p role="status">{error}</p>}
    </section>;
}
