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
