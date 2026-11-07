// SPDX-License-Identifier: GPL-3.0-or-later
import { emojis, revision } from './data';

const family = '"PulseCord iOS Emoji"';
const emojiText = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u20e3]/u;
const sprites = '[class*="emojiSpriteImage"],[class*="emojiItemImage"]';
const images = new Map<string, string>();
for (const emoji of emojis) {
    for (const key of [...emoji.names, ...emoji.unicode, emoji.image.replace(/\.png$/, '')]) images.set(key, emoji.image);
}
const imageUrl = (name: string) => `https://raw.githubusercontent.com/iamcal/emoji-data/${revision}/img-apple-64/${name}`;

export function startSurfaces() {
    const originals = new Map<HTMLElement, Map<string, [string, string]>>();
    function set(element: HTMLElement, name: string, value: string) {
        let saved = originals.get(element);
        if (!saved) originals.set(element, saved = new Map());
        if (!saved.has(name)) saved.set(name, [element.style.getPropertyValue(name), element.style.getPropertyPriority(name)]);
        if (element.style.getPropertyValue(name) !== value) element.style.setProperty(name, value, 'important');
    }
    function restore(element: HTMLElement) {
        for (const [name, [value, priority]] of originals.get(element) || []) {
            if (value) element.style.setProperty(name, value, priority);
            else element.style.removeProperty(name);
        }
        originals.delete(element);
    }
    function font(element: HTMLElement) {
        if (element.closest('script,style,svg')) return;
        const current = getComputedStyle(element).fontFamily;
        if (!current.includes('PulseCord iOS Emoji')) set(element, 'font-family', `${family},${current}`);
    }
    function sprite(element: HTMLElement) {
        let owner: HTMLElement | null = element;
        // Discord's picker uses virtualized CSS sprites, often with data-id
        // holding a short name rather than a numeric custom-emoji ID.
        for (let depth = 0; owner && depth < 4; depth++, owner = owner.parentElement) {
            const id = owner.getAttribute('data-id');
            if (id && /^\d{15,22}$/.test(id)) return;
            if (/custom/i.test(owner.getAttribute('data-type') || '')) return;
        }
        owner = element;
        for (let depth = 0; owner && depth < 4; depth++, owner = owner.parentElement) {
            for (const attribute of ['data-name', 'data-id', 'data-surrogates', 'data-emoji-name', 'aria-label', 'title']) {
                const value = owner.getAttribute(attribute)?.trim();
                if (!value) continue;
                const image = images.get(value) || images.get(value.replace(/^:|:$/g, ''));
                if (!image) continue;
                set(element, 'background-image', `url("${imageUrl(image)}")`);
                set(element, 'background-position', 'center');
                set(element, 'background-size', 'contain');
                set(element, 'background-repeat', 'no-repeat');
                return;
            }
        }
    }
    function scan(node: Node) {
        if (node.nodeType === Node.TEXT_NODE) {
            if (emojiText.test(node.textContent || '') && node.parentElement instanceof HTMLElement) font(node.parentElement);
            return;
        }
        if (!(node instanceof HTMLElement)) return;
        if (node.matches('script,style,svg')) return;
        if (node.matches(sprites)) { restore(node); sprite(node); }
        if (node.matches('input,textarea,[contenteditable="true"]')) font(node);
        for (const child of node.childNodes) scan(child);
    }
    const observer = new MutationObserver(records => {
        for (const record of records) {
            if (record.type === 'attributes') {
                const element = record.target as HTMLElement;
                if (record.attributeName === 'style') {
                    // Ignore our own stable writes; reapply when React assigns
                    // a native font or recycles a sprite's background styles.
                    if (element.matches(sprites)) sprite(element);
                    else if (emojiText.test(element.textContent || '') || element.matches('input,textarea,[contenteditable="true"]')) font(element);
                } else if (record.attributeName === 'class') scan(element);
                else if (element.matches(sprites)) { restore(element); sprite(element); }
                else for (const child of element.querySelectorAll<HTMLElement>(sprites)) { restore(child); sprite(child); }
            } else if (record.type === 'characterData') scan(record.target);
            else for (const node of record.addedNodes) scan(node);
        }
        // Do not retain rows discarded by Discord's virtualized lists.
        for (const element of originals.keys()) if (!element.isConnected) restore(element);
    });
    scan(document.body);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['data-id', 'data-name', 'data-type', 'data-surrogates', 'aria-label', 'title', 'class', 'style'] });
    return () => { observer.disconnect(); for (const element of originals.keys()) restore(element); };
}
