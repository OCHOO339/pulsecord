// SPDX-License-Identifier: GPL-3.0-or-later
import * as DataStore from "@api/DataStore";

export interface OfficialMessage { id: string; timestamp: number; text: string; read: boolean; }
const key = "PulseCordOfficialInbox";
const listeners = new Set<() => void>();
let messages: OfficialMessage[] = [];
let opened = false;
let generation = 0;
let saving = Promise.resolve();
function publish() { for (const listener of listeners) listener(); }
function save() {
    const snapshot = messages;
    saving = saving.catch(() => {}).then(() => DataStore.set(key, snapshot)).catch(error => console.warn("[PulseCord] Inbox save failed", error));
}
export function subscribeInbox(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function getInboxMessages() { return messages; }
export function isInboxOpen() { return opened; }
export function getInboxUnread() { return messages.filter(message => !message.read).length; }
export function setInboxOpen(value: boolean) {
    opened = value;
    if (value) { messages = messages.map(message => ({ ...message, read: true })); save(); }
    publish();
}
export async function loadInbox() {
    const current = ++generation;
    let stored: unknown;
    try { stored = await DataStore.get(key); } catch (error) { console.warn("[PulseCord] Inbox load failed", error); }
    if (generation !== current) return;
    const existing = Array.isArray(stored) ? stored.filter((value): value is OfficialMessage =>
        Boolean(value && typeof value.id === "string" && typeof value.text === "string" && Number.isFinite(value.timestamp) && typeof value.read === "boolean")) : [];
    const merged = new Map(existing.map(message => [message.id, message]));
    for (const message of messages) merged.set(message.id, message);
    if (!merged.has("welcome")) merged.set("welcome", { id: "welcome", timestamp: Date.now(), text: "Bienvenue sur PulseCord. Retrouvez ici les annonces et les mises à jour officielles de votre client.", read: false });
    messages = [...merged.values()].sort((a, b) => a.timestamp - b.timestamp).slice(-50);
    if (opened) messages = messages.map(message => ({ ...message, read: true }));
    publish(); save();
}
export function addInboxUpdate(build: string, changelog?: string) {
    const id = `update:${build}`;
    if (messages.some(message => message.id === id)) return;
    messages = [...messages, { id, timestamp: Date.now(), text: `Une mise à jour PulseCord est disponible.${changelog ? `\n\n${changelog.slice(0, 12000)}` : ""}`, read: opened }].slice(-50);
    publish(); save();
}
export function stopInboxStore() { generation++; opened = false; publish(); }
