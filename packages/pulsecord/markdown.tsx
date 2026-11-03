// SPDX-License-Identifier: GPL-3.0-or-later
import { Parser, React } from "@webpack/common";

export const AnnouncementMarkdown = React.memo(({ text }: { text: string; }) =>
    <div className="pc-markdown">{Parser.parse(text, true, {
        allowHeading: true,
        allowList: true,
        allowLinks: true,
        allowEmojiLinks: false
    })}</div>
);
