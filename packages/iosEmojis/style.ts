// SPDX-License-Identifier: GPL-3.0-or-later
import { emojis, revision } from './data';

const asset = `https://raw.githubusercontent.com/iamcal/emoji-data/${revision}/img-apple-64/`;
const standardImage = 'img:is([src^="/assets/"],[src^="https://discord.com/assets/"],[src^="https://canary.discord.com/assets/"],[src^="https://ptb.discord.com/assets/"],[src^="https://cdn.discordapp.com/assets/"])';
const quote = (text: string) => JSON.stringify(text);

export function emojiCss(fontUrl: string, fonts: Record<string, string>) {
    const tokens = Object.entries(fonts).map(([name, value]) => `${name}:"PulseCord iOS Emoji",${value}!important;`).join('');
    return `@font-face{font-family:"PulseCord iOS Emoji";src:url("${fontUrl}") format("woff2");font-display:swap;unicode-range:U+A9,U+AE,U+200D,U+203C-3299,U+FE0F,U+1F000-1FAFF,U+E0020-E007F;}
        :root:root{${tokens}}
        ${emojis.map(emoji => {
            const selectors = emoji.unicode.map(value => `${standardImage}[alt=${quote(value)}]`);
            for (const name of emoji.names) {
                selectors.push(`${standardImage}[alt=${quote(`:${name}:`)}]`);
                selectors.push(`${standardImage}[alt=${quote(name)}]`);
                selectors.push(`:is([data-type="emoji"],[data-type="unicode"])[data-name=${quote(name)}]:not([data-id]) :is(img,[class*="emojiItemImage_"])`);
            }
            return `${selectors.join(',')}{content:url("${asset}${emoji.image}")!important;object-fit:contain;}`;
        }).join('\n')}`;
}
