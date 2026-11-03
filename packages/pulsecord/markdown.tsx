// SPDX-License-Identifier: GPL-3.0-or-later
import { Parser, React } from "@webpack/common";

// Discord provides React only after its webpack modules have initialized.
// Plugin imports run earlier, so React must only be accessed during rendering.
export function AnnouncementMarkdown({ text }: { text: string; }) {
    return <div className="pc-markdown">{Parser.parse(text, true, {
        allowHeading: true,
        allowList: true,
        allowLinks: true,
        allowEmojiLinks: false
    })}</div>;
}

export function AnnouncementMessage({ text }: { text: string; }) {
    const split = text.indexOf("\n\n");
    if (!text.startsWith("Une mise à jour PulseCord") || split === -1) return <AnnouncementMarkdown text={text} />;
    return <div className="pc-message-body">
        <AnnouncementMarkdown text={text.slice(0, split)} />
        <details className="pc-announcement-details"><summary>Voir les nouveautés</summary><AnnouncementMarkdown text={text.slice(split + 2)} /></details>
    </div>;
}
