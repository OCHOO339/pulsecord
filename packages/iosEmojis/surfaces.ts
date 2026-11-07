// SPDX-License-Identifier: GPL-3.0-or-later
import { emojis, revision } from './data';

const family = '"PulseCord iOS Emoji"';
const emojiText = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u20e3]/u;
const sprites = '[class*="emojiSpriteImage"],[class*="emojiItemImage"]';
const nativeImages = 'img:is([src^="/assets/"],[src^="https://discord.com/assets/"],[src^="https://canary.discord.com/assets/"],[src^="https://ptb.discord.com/assets/"],[src^="https://cdn.discordapp.com/assets/"])';
const images = new Map<string, string>();
for (const emoji of emojis) {
    for (const key of [...emoji.names, ...emoji.unicode, emoji.image.replace(/\.png$/, '')]) images.set(key, emoji.image);
}
const imageUrl = (name: string) => `https://raw.githubusercontent.com/iamcal/emoji-data/${revision}/img-apple-64/${name}`;

export function startSurfaces() {
    const originals = new Map<HTMLElement, Map<string, [string, string]>>();
    const fontTargets = new WeakSet<HTMLElement>();
    const pendingFonts = new Set<HTMLElement>();
    const marked = new Set<HTMLElement>();
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
        if (marked.delete(element)) element.removeAttribute('data-pc-ios-emoji');
    }
    function font(element: HTMLElement) {
        if (element.closest('script,style,svg')) return;
        fontTargets.add(element);
        if (element.style.fontFamily.includes('PulseCord iOS Emoji')) return;
        pendingFonts.add(element);
    }
    function flushFonts() {
        const writes: Array<[HTMLElement, string]> = [];
        // Read all computed styles before changing any font; avoid read/write
        // alternation invalidating styles for each row of a large message list.
        for (const element of pendingFonts) if (element.isConnected) {
            const current = getComputedStyle(element).fontFamily;
            if (!current.includes('PulseCord iOS Emoji')) writes.push([element, `${family},${current}`]);
        }
        pendingFonts.clear();
        for (const [element, value] of writes) set(element, 'font-family', value);
    }
    function image(element: HTMLElement, name: string) {
        set(element, '--pc-ios-emoji-image', `url("${imageUrl(name)}")`);
        if (!marked.has(element)) { marked.add(element); element.setAttribute('data-pc-ios-emoji', ''); }
    }
    function standardImage(element: HTMLElement) {
        const alt = element.getAttribute('alt')?.trim() || '';
        const name = images.get(alt) || images.get(alt.replace(/^:|:$/g, ''));
        if (name && element.matches(nativeImages)) image(element, name);
        else if (marked.has(element)) restore(element);
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
                // One generic CSS rule replaces thousands of emoji-specific rules.
                set(element, '--pc-ios-emoji-image', `url("${imageUrl(image)}")`);
                if (!marked.has(element)) { marked.add(element); element.setAttribute('data-pc-ios-emoji', ''); }
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
        else if (node.matches('img')) standardImage(node);
        if (node.matches('input,textarea,[contenteditable="true"]')) font(node);
        for (const child of node.childNodes) scan(child);
    }
    const observer = new MutationObserver(records => {
        const roots = new Set<Node>();
        const changed = new Map<HTMLElement, Set<string>>();
        let removed = false;
        for (const record of records) {
            if (record.type === 'attributes') {
                const element = record.target as HTMLElement;
                let names = changed.get(element);
                if (!names) changed.set(element, names = new Set());
                names.add(record.attributeName!);
            } else if (record.type === 'characterData') roots.add(record.target);
            else {
                for (const node of record.addedNodes) roots.add(node);
                removed ||= record.removedNodes.length > 0;
            }
        }
        // Only newly added subtrees are walked. Parent class changes never
        // trigger another scan of the message list or server sidebar.
        for (const root of roots) {
            if (!root.isConnected) continue;
            let parent = root.parentNode;
            while (parent && !roots.has(parent)) parent = parent.parentNode;
            if (!parent) scan(root);
        }
        for (const [element, names] of changed) {
            if (!element.isConnected) continue;
            if (element.matches('img')) standardImage(element);
            const identityChanged = [...names].some(name => name !== 'style' && name !== 'class');
            if (element.matches(sprites)) {
                if (identityChanged) restore(element);
                sprite(element);
            } else if (identityChanged) {
                for (const child of element.querySelectorAll<HTMLElement>(sprites)) { restore(child); sprite(child); }
            }
            if ((names.has('style') || names.has('class')) && fontTargets.has(element)) font(element);
        }
        // Do not retain rows discarded by Discord's virtualized lists.
        if (removed) for (const element of originals.keys()) if (!element.isConnected) restore(element);
        flushFonts();
    });
    const options: MutationObserverInit = { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['src', 'alt', 'data-id', 'data-name', 'data-type', 'data-surrogates', 'aria-label', 'title', 'class', 'style'] };
    let blurred = false;
    function visibility() {
        observer.disconnect();
        if (document.hidden || blurred) return;
        for (const element of originals.keys()) if (!element.isConnected) restore(element);
        scan(document.body);
        flushFonts();
        observer.observe(document.body, options);
    }
    document.addEventListener('visibilitychange', visibility);
    function blur() { blurred = true; observer.disconnect(); }
    function focus() { blurred = false; visibility(); }
    window.addEventListener('blur', blur); window.addEventListener('focus', focus);
    visibility();
    return () => {
        observer.disconnect(); document.removeEventListener('visibilitychange', visibility);
        window.removeEventListener('blur', blur); window.removeEventListener('focus', focus);
        for (const element of originals.keys()) restore(element);
    };
}
