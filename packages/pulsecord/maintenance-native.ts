// SPDX-License-Identifier: GPL-3.0-or-later
import { DATA_DIR } from "@main/utils/constants";
import { createBackup, restoreBackup, parseBackup } from "@pulsecord/backup-core";
import { app, dialog, shell } from "electron";
import { promises as fs } from "original-fs";
import { join } from "path";
let busy = false;
let lastBackup: string | undefined;
function backupDirectory() {
    // Flatpak's unshared Documents directory may be temporary. Keep automatic
    // backups in the app's persistent data instead of the sandbox home tmpfs.
    if (process.platform === "linux" && process.env?.FLATPAK_ID) return join(DATA_DIR, "backups");
    return join(app.getPath("documents"), "PulseCord Backups");
}
export async function backupConfiguration(_event: Electron.IpcMainInvokeEvent) {
    if (busy) throw Error("Une sauvegarde ou restauration est déjà en cours.");
    busy = true;
    try { const result = await createBackup(DATA_DIR, backupDirectory()); lastBackup = result.path; return result; }
    finally { busy = false; }
}
export function revealLastBackup(_event: Electron.IpcMainInvokeEvent) { if (lastBackup) shell.showItemInFolder(lastBackup); }
export async function restoreConfiguration(_event: Electron.IpcMainInvokeEvent) {
    if (busy) throw Error("Une sauvegarde ou restauration est déjà en cours.");
    busy = true;
    try {
        const selected = await dialog.showOpenDialog({ title: "Restaurer une sauvegarde PulseCord", properties: ["openFile"], filters: [{ name: "Sauvegarde PulseCord", extensions: ["json"] }] });
        if (selected.canceled || !selected.filePaths[0]) return { cancelled: true };
        const file = selected.filePaths[0]; const stat = await fs.lstat(file);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16 * 1024 * 1024) throw Error("Fichier de sauvegarde invalide ou trop volumineux.");
        const bytes = await fs.readFile(file, "utf8"); parseBackup(bytes);
        const answer = await dialog.showMessageBox({ type: "question", title: "Restaurer PulseCord", message: "Remplacer les réglages et redémarrer Discord ?", detail: "Une copie de récupération sera créée avant de restaurer les réglages des plugins, les thèmes présents dans la sauvegarde et QuickCSS.", buttons: ["Annuler", "Restaurer et relancer"], defaultId: 0, cancelId: 0 });
        if (answer.response !== 1) return { cancelled: true };
        const result = await restoreBackup(DATA_DIR, backupDirectory(), bytes); lastBackup = result.path;
        try {
            const flatpakId = process.platform === "linux" ? process.env?.FLATPAK_ID : undefined;
            app.relaunch({ execPath: flatpakId && /^com\.discordapp\.Discord(?:PTB|Canary)?$/.test(flatpakId) ? join(process.env.XDG_DATA_HOME!, "pulsecord/bin/pulsecord-discord") : process.execPath, args: [] });
        }
        catch { return { ...result, restarting: false }; }
        setTimeout(() => app.exit(0), 700);
        return { ...result, restarting: true };
    } finally { busy = false; }
}
