// SPDX-License-Identifier: GPL-3.0-or-later
export function emojiCss(fontUrl: string, fonts: Record<string, string>) {
    const tokens = Object.entries(fonts).map(([name, value]) => `${name}:"PulseCord iOS Emoji",${value}!important;`).join('');
    return `@font-face{font-family:"PulseCord iOS Emoji";src:url("${fontUrl}") format("woff2");font-display:swap;unicode-range:U+A9,U+AE,U+200D,U+203C-3299,U+FE0F,U+1F000-1FAFF,U+E0020-E007F;}
        :root:root{${tokens}}
        [data-pc-ios-emoji]{content:var(--pc-ios-emoji-image)!important;object-fit:contain;}`;
}
