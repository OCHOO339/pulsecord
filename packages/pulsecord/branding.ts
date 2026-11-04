/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
export function brandingCss(logo: string, largeLogo = logo, fontCss = "") {
    const image = `url("${logo}")`;
    const marks = [
        'svg:has(path[d^="M19.73 4.87"])',
        'svg:has(path[d^="M13.545 2.907"])',
        'svg:has(path[d^="M20.317 4.369"])',
        'svg:has(path[d^="M19.73 6.59"])',
        '[class*="loading_"] svg[class*="logo_"]',
        'svg[class*="discordLogo_"]',
        'svg[class*="logoWordmark_"]'
    ].join(',');
    const wordmarks = '[class*="wordmarkWindows_"],[class*="wordmarkMacOS_"]';
    const homeTargets = '[data-guilds-bar-home] [aria-owns="guild-list-unread-dms"],[data-list-item-id="guildsnav___home"],[data-list-id="guildsnav"] a[href="/channels/@me"],[class*="guilds_"] a[href="/channels/@me"]';
    const home = `:is(${homeTargets}):not(:is(${homeTargets}) *)`;
    const shades: Record<number, string> = { 50: '#fffaeb', 100: '#fff6d5', 130: '#fff3c7', 160: '#ffefb8', 200: '#ffeaa3', 230: '#ffe695', 260: '#ffe186', 300: '#ffdc72', 330: '#ffd96a', 345: '#ffd766', 360: '#ffd560', 400: '#ffd04f', 430: '#fdcc46', 460: '#fbc83d', 500: '#f8c332', 530: '#edb72a', 560: '#dfaa21', 600: '#cc991b', 630: '#b98717', 660: '#a57613', 700: '#8b6110', 730: '#7e580e', 760: '#714e0d', 800: '#61420b', 830: '#553909', 860: '#483108', 900: '#382606' };
    const palette = Object.entries(shades).map(([level, color]) => `--brand-${level}:${color}!important;--brand-experiment-${level}:${color}!important;`).join('');
    return `
        ${fontCss}
        :root, .theme-dark, .theme-light, [class*="theme-dark"], [class*="theme-light"] {
            --font-primary:"Cause",system-ui,sans-serif!important;
            --font-display:"Cause",system-ui,sans-serif!important;
            --font-headline:"Cause",system-ui,sans-serif!important;
            ${palette}
            --brand-500-hsl:44 93% 58%!important;
            --brand-experiment: #f8c332!important;
            --blurple-50:#f8c332!important;
            --text-brand:#f8c332!important;--text-link:#f8c332!important;
            --text-link-low-saturation:#ffdc72!important;
            --focus-primary:#f8c332!important;
            --background-brand:#f8c332!important;
            --background-accent:#f8c332!important;
            --background-mentioned:rgb(248 195 50 / 9%)!important;
            --background-mentioned-hover:rgb(248 195 50 / 14%)!important;
            --mention-foreground:#ffdc72!important;
            --mention-background:rgb(248 195 50 / 18%)!important;
            --info-help-foreground:#f8c332!important;
            --info-help-background:rgb(248 195 50 / 12%)!important;
            --control-brand-foreground:#f8c332!important;
            --control-primary-background-default:#f8c332!important;
            --control-primary-background-hover:#ffd04f!important;
            --control-primary-background-active:#dfaa21!important;
            --control-primary-border-default:transparent!important;
            --control-primary-border-hover:transparent!important;
            --control-primary-border-active:transparent!important;
            --control-primary-text-default:#211a08!important;
            --control-primary-text-hover:#211a08!important;
            --control-primary-text-active:#211a08!important;
            --button-filled-brand-background:#f8c332!important;
            --button-filled-brand-background-hover:#ffd04f!important;
            --button-filled-brand-background-active:#dfaa21!important;
            --button-filled-brand-text:#211a08!important;
            --checkbox-background-checked:#f8c332!important;
            --checkbox-border-checked:#f8c332!important;
            --checkbox-icon-checked:#211a08!important;
            --background-modifier-selected:rgb(248 195 50 / 14%)!important;
            accent-color:#f8c332;
        }
        body { font-family:var(--font-primary); }
        button,input,select,textarea { font-family:inherit; }
        ${home} {
            position:relative!important;
        }
        ${home} :is(svg,img) { opacity:0!important; }
        ${home}::before {
            content:"";position:absolute;inset:0;margin:auto;
            width:100%;height:100%;max-width:40px;max-height:40px;
            background:var(--background-surface-higher,var(--background-secondary,#232428));
            border-radius:14px;pointer-events:none;
        }
        ${home}::after {
            content:"";position:absolute;inset:0;margin:auto;width:60%;height:60%;
            max-width:26px;max-height:26px;background:#f8c332;
            mask:${image} center/contain no-repeat;
            -webkit-mask:${image} center/contain no-repeat;
            pointer-events:none;
        }
        ${home}:is(:hover,:focus-visible)::before { background:#f8c332; }
        ${home}:is(:hover,:focus-visible)::after { background:#211a08; }
        :is(${marks}) {
            background-image:${image}!important;
            background-repeat:no-repeat!important;
            background-position:center!important;
            background-size:contain!important;
        }
        :is(${marks}) > * { opacity:0!important; }
        :is(${wordmarks}) {
            display:flex!important;align-items:center;gap:6px;font-size:13px!important;
            color:var(--text-muted,#b4b4b4);
        }
        :is(${wordmarks}) > * { display:none!important; }
        :is(${wordmarks})::before { content:"";width:18px;height:18px;background:${image} center/contain no-repeat; }
        :is(${wordmarks})::after { content:"PulseCord";font-weight:600;line-height:18px; }
        :is(div[class*="discordLogo_"],a[class*="discordLogo_"]):not(:is(${homeTargets},:is(${homeTargets}) *)) {
            background:${image} left center/36px 36px no-repeat!important;width:160px!important;
        }
        :is(div[class*="discordLogo_"],a[class*="discordLogo_"]):not(:is(${homeTargets},:is(${homeTargets}) *))::after {
            content:"PulseCord";display:block;padding-inline-start:44px;line-height:36px;
            font-size:22px;font-weight:600;color:var(--text-normal,#f2f2f2);
        }
        img[alt="Discord"][src^="/assets/"],
        img[alt="Discord"][src^="https://discord.com/assets/"],
        img[src$="/bbbc3d376d38e7bc.svg"],img[src$="/34120ace1e4e4d29.svg"] {
            content:${image}!important;object-fit:contain!important;
        }
        #splash .splash-inner img { content:url("${largeLogo}")!important;object-fit:contain!important; }
        .container_a2f514:has(video) { background:url("${largeLogo}") center/144px 144px no-repeat!important; }
        .container_a2f514 video { visibility:hidden!important; }
    `;
}

let restoreFavicons: (() => void) | undefined;
export function brandFavicons(logo: string) {
    restoreFavicons?.();
    const existing = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'));
    if (existing.length) {
        const originals = existing.map(link => ({ link, href: link.getAttribute("href") }));
        for (const link of existing) link.href = logo;
        restoreFavicons = () => { for (const { link, href } of originals) { if (href === null) link.removeAttribute("href"); else link.setAttribute("href", href); } };
    } else {
        const link = document.createElement("link");
        link.rel = "icon";
        link.type = "image/png";
        link.href = logo;
        document.head.append(link);
        restoreFavicons = () => link.remove();
    }
}

export function restoreBrandFavicons() {
    restoreFavicons?.();
    restoreFavicons = undefined;
}
