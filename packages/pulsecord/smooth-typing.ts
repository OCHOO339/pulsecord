// SPDX-License-Identifier: GPL-3.0-or-later
let stop: (() => void) | undefined;

/** Animate caret geometry only; leave Discord's editor, input events and text untouched. */
export function setSmoothTyping(enabled: boolean) {
    if (!enabled) { stop?.(); stop = undefined; return; }
    if (stop) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let frame: number | undefined;
    let composing = false;
    let focused = true;
    let snapNext = true;
    let resetBlink = false;
    let editor: HTMLElement | undefined;
    let caret: HTMLDivElement | undefined;
    let previous: { x: number; y: number } | undefined;

    function hide() {
        if (frame !== undefined) { cancelAnimationFrame(frame); frame = undefined; }
        editor?.removeAttribute("data-pc-smooth-caret"); editor = undefined;
        caret?.remove(); caret = undefined; previous = undefined;
    }
    function update() {
        frame = undefined;
        if (document.hidden || !focused || composing || reduced.matches) return hide();
        const selection = document.getSelection();
        if (!selection?.isCollapsed || selection.rangeCount !== 1) return hide();
        const range = selection.getRangeAt(0);
        const anchor = range.startContainer.nodeType === Node.ELEMENT_NODE
            ? range.startContainer as Element : range.startContainer.parentElement;
        const next = anchor?.closest<HTMLElement>('[data-slate-editor="true"][contenteditable="true"]');
        if (!next || !next.closest('[class*="channelTextArea_"],[class*="editTextArea_"]') ||
            !next.contains(document.activeElement) || !next.isConnected) return hide();
        // Keep the native caret when Chromium has no usable collapsed-range rect.
        const rect = range.getBoundingClientRect();
        const box = next.getBoundingClientRect();
        const clip = next.closest('[class*="scrollableContainer_"],[class*="channelTextArea_"]')?.getBoundingClientRect() ?? box;
        if (![rect.left, rect.top, rect.height].every(Number.isFinite) || rect.height < 2 || rect.height > 80 ||
            rect.left < Math.max(0, box.left, clip.left) || rect.left > Math.min(innerWidth - 2, box.right, clip.right) ||
            rect.top < Math.max(0, box.top, clip.top) || rect.bottom > Math.min(innerHeight, box.bottom, clip.bottom) + 1) return hide();
        const changedEditor = next !== editor;
        if (changedEditor) { hide(); editor = next; }
        if (!caret) {
            caret = document.createElement("div"); caret.className = "pc-smooth-caret";
            caret.setAttribute("aria-hidden", "true"); caret.append(document.createElement("span"));
            document.body.append(caret);
        }
        const x = rect.left, y = rect.top;
        const snap = snapNext || changedEditor || !previous || Math.abs(y - previous.y) > 2 || Math.abs(x - previous.x) > 100;
        // Snap line changes, clicks and scrolls; interpolate small same-line moves.
        caret.style.transitionDuration = snap ? "0ms" : "90ms";
        caret.style.height = `${rect.height}px`;
        caret.style.transform = `translate3d(${x}px,${y}px,0)`;
        if (resetBlink) for (const animation of caret.getAnimations({ subtree: true })) animation.currentTime = 0;
        if (!editor!.hasAttribute("data-pc-smooth-caret")) editor!.setAttribute("data-pc-smooth-caret", "");
        previous = { x, y }; snapNext = false; resetBlink = false;
    }
    function queue(event?: Event) {
        const active = document.activeElement;
        if (!active?.closest('[data-slate-editor="true"][contenteditable="true"]')) { hide(); return; }
        // Scrolling a sidebar must not measure the message editor's layout.
        if (event?.type === "scroll" && event.target instanceof Element && !event.target.contains(active)) return;
        if (event?.type === "scroll" || event?.type === "resize" || event?.type === "pointerdown") snapNext = true;
        if (event?.type === "input") resetBlink = true;
        if (document.hidden || !focused || composing || reduced.matches) { hide(); return; }
        if (frame === undefined) frame = requestAnimationFrame(update);
    }
    function compositionStart() { composing = true; hide(); }
    function compositionEnd() { composing = false; snapNext = true; queue(); }
    function blur() { focused = false; hide(); }
    function focus() { focused = true; snapNext = true; queue(); }
    const documentEvents = ["selectionchange", "input", "focusin", "focusout", "scroll", "pointerdown", "visibilitychange"];
    for (const event of documentEvents) document.addEventListener(event, queue, true);
    document.addEventListener("compositionstart", compositionStart, true);
    document.addEventListener("compositionend", compositionEnd, true);
    window.addEventListener("resize", queue); window.addEventListener("blur", blur); window.addEventListener("focus", focus);
    reduced.addEventListener("change", queue);
    stop = () => {
        if (frame !== undefined) cancelAnimationFrame(frame);
        for (const event of documentEvents) document.removeEventListener(event, queue, true);
        document.removeEventListener("compositionstart", compositionStart, true);
        document.removeEventListener("compositionend", compositionEnd, true);
        window.removeEventListener("resize", queue); window.removeEventListener("blur", blur); window.removeEventListener("focus", focus);
        reduced.removeEventListener("change", queue); hide();
    };
    queue();
}
