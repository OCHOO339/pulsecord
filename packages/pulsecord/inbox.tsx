// SPDX-License-Identifier: GPL-3.0-or-later
import ErrorBoundary from "@components/ErrorBoundary";
import { createRoot, NavigationRouter, React } from "@webpack/common";
import { brand } from "./brand";
import { getInboxMessages, getInboxUnread, isInboxOpen, loadInbox, setInboxOpen, stopInboxStore, subscribeInbox } from "./inbox-store";
import { UpdatesTab } from "./updates";
import { AnnouncementMarkdown } from "./markdown";

let root: ReturnType<typeof createRoot> | undefined;
let container: HTMLDivElement | undefined;
let restoreHost: (() => void) | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let enabled = false;
export const OfficialConversation = ErrorBoundary.wrap(() => {
    const messages = React.useSyncExternalStore(subscribeInbox, getInboxMessages);
    const end = React.useRef<HTMLDivElement>(null);
    React.useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [messages]);
    return <section className="pc-official-chat" aria-label="Conversation PulseCord">
        <header className="pc-chat-header"><img src={brand.logo} width={32} height={32} alt="" /><strong>PulseCord</strong><span className="pc-official">✓ OFFICIAL</span><span className="pc-chat-local">Annonces locales</span><button onClick={closeOfficialInbox} aria-label="Fermer la conversation PulseCord">×</button></header>
        <div className="pc-chat-scroll" role="log" aria-label="Annonces PulseCord">
            <div className="pc-chat-intro"><img src={brand.logo} width={80} height={80} alt="" /><h1>PulseCord</h1><p>Le début de votre conversation avec PulseCord.</p></div>
            {messages.map(message => <article className="pc-chat-message" key={message.id}>
                <img src={brand.logo} width={40} height={40} alt="" />
                <div><header><strong>PulseCord</strong><span className="pc-official">✓ OFFICIAL</span><time dateTime={new Date(message.timestamp).toISOString()}>{new Date(message.timestamp).toLocaleString()}</time></header><AnnouncementMarkdown text={message.text} /></div>
            </article>)}
            <div className="pc-chat-update"><UpdatesTab /></div><div ref={end} />
        </div>
        <footer className="pc-chat-footer">Ce canal local reçoit uniquement les annonces PulseCord.</footer>
    </section>;
}, { noop: false });

export const OfficialDmRow = ErrorBoundary.wrap(() => {
    const unread = React.useSyncExternalStore(subscribeInbox, getInboxUnread);
    const selected = React.useSyncExternalStore(subscribeInbox, isInboxOpen);
    return <button className={`pc-dm-row${selected ? " pc-dm-selected" : ""}`} onClick={openOfficialInbox} aria-label={`PulseCord, annonces officielles${unread ? `, ${unread} non lues` : ""}`} aria-pressed={selected}>
        <img src={brand.logo} width={32} height={32} alt="" /><span className="pc-dm-text"><span><strong>PulseCord</strong><span className="pc-official">✓ OFFICIAL</span></span><span className="pc-dm-preview">Annonces et mises à jour</span></span>{unread > 0 && <span className="pc-dm-unread">{unread}</span>}
    </button>;
}, { noop: true });

function contentHost() {
    const sidebar = document.querySelector(".pc-dm-row")?.closest<HTMLElement>('[class*="sidebar_"]');
    const sibling = sidebar?.nextElementSibling;
    if (sibling instanceof HTMLElement && !sibling.matches('nav,aside,[class*="sidebar_"]')) return sibling;
    return document.querySelector<HTMLElement>('[class*="page_"]:not([class*="sidebar_"])')
        ?? document.querySelector<HTMLElement>('main[class*="chat_"]');
}
export function openOfficialInbox() {
    if (!enabled) return;
    if (root) return;
    if (timer !== undefined) clearTimeout(timer);
    if (!document.querySelector(".pc-dm-row")) NavigationRouter.transitionTo("/channels/@me");
    let attempts = 0;
    const mount = () => {
        timer = undefined;
        if (!enabled) return;
        const host = document.querySelector(".pc-dm-row") ? contentHost() : null;
        if (!host) {
            if (++attempts < 30) timer = setTimeout(mount, 100);
            else console.warn("[PulseCord] Conversation host not found");
            return;
        }
        const position = host.style.position;
        if (getComputedStyle(host).position === "static") host.style.position = "relative";
        restoreHost = () => { host.style.position = position; };
        container = document.createElement("div"); container.className = "pc-inbox-root"; host.append(container);
        root = createRoot(container); root.render(<OfficialConversation />); setInboxOpen(true);
    };
    timer = setTimeout(mount, 0);
}
export function closeOfficialInbox() {
    if (timer !== undefined) clearTimeout(timer); timer = undefined;
    root?.unmount(); root = undefined; container?.remove(); container = undefined;
    restoreHost?.(); restoreHost = undefined; setInboxOpen(false);
}
export function handleInboxNavigation() {
    if (root) closeOfficialInbox();
}
export function startOfficialInbox() { enabled = true; void loadInbox(); }
export function stopOfficialInbox() { enabled = false; closeOfficialInbox(); stopInboxStore(); }
