// SPDX-License-Identifier: GPL-3.0-or-later
// Find the content branch beside the DM list. A page ancestor can contain both
// the conversation and its navigation, so it must never become the overlay host.
export function findInboxHost(row: HTMLElement): HTMLElement | null {
    const rowRect = row.getBoundingClientRect();
    if (rowRect.width === 0 || rowRect.height === 0) return null;
    for (let branch: HTMLElement | null = row; branch?.parentElement; branch = branch.parentElement) {
        const candidates = Array.from(branch.parentElement.children)
            .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== branch && !element.matches('nav,aside,[role="navigation"],.pc-inbox-root'))
            .map(element => ({ element, rect: element.getBoundingClientRect() }))
            .filter(({ rect }) => rect.left >= rowRect.right - 2 && rect.width >= 160 && rect.height >= 120)
            .sort((a, b) => b.rect.width * b.rect.height - a.rect.width * a.rect.height);
        if (candidates.length) return candidates[0].element;
    }
    return null;
}
