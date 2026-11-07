// SPDX-License-Identifier: GPL-3.0-or-later
import { Devs } from '@utils/constants';
import definePlugin from '@utils/types';
import { fontUrl } from './font';
import { emojiCss } from './style';

let style: HTMLStyleElement | undefined;
export default definePlugin({
    name: 'IOSEmojis',
    description: 'Apple emoji throughout Discord: messages, reactions, picker, statuses and text. Includes Emoji 17.0; custom server emoji are preserved.',
    authors: [Devs.PulseCord],
    start() {
        style?.remove();
        const root = getComputedStyle(document.documentElement);
        const fonts = Object.fromEntries(['--font-primary', '--font-display', '--font-headline', '--font-code'].map(name => [name, root.getPropertyValue(name).trim() || 'system-ui,sans-serif']));
        style = document.createElement('style');
        style.id = 'pc-ios-emojis';
        style.textContent = emojiCss(fontUrl, fonts);
        document.head.append(style);
    },
    stop() { style?.remove(); style = undefined; }
});
