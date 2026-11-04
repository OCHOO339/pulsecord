// SPDX-License-Identifier: GPL-3.0-or-later
import { PluginNative } from "@utils/types";
import { openSettingsTabModal } from "@components/settings/tabs/BaseTab";
import AdvancedBackupTab from "@components/settings/tabs/sync/BackupAndRestoreTab";
import { React, useState } from "@webpack/common";
import { SettingsBanner } from "./settings-banner";
function native() { return VencordNative.pluginHelpers.PulseCord as PluginNative<typeof import("./native")>; }
export function BackupsTab() {
    const [busy, setBusy] = useState(false); const [status, setStatus] = useState(""); const [hasBackup, setHasBackup] = useState(false);
    async function save() {
        setBusy(true); setStatus("Sauvegarde en cours…");
        try { const result = await native().backupConfiguration(); setHasBackup(true); setStatus(`Sauvegarde créée : ${result.path}`); }
        catch (error) { setStatus(String(error)); } finally { setBusy(false); }
    }
    async function restore() {
        setBusy(true); setStatus("");
        try {
            const result = await native().restoreConfiguration();
            if ("cancelled" in result && result.cancelled) setStatus("Restauration annulée.");
            else { setHasBackup(true); setStatus("restarting" in result && result.restarting ? "Configuration restaurée. Discord va redémarrer." : "Configuration restaurée. Fermez puis relancez Discord pour l’appliquer."); }
        }
        catch (error) { setStatus(String(error)); } finally { setBusy(false); }
    }
    return <><SettingsBanner /><section className="pulsecord"><h1>Sauvegarde et restauration</h1>
        <p>Enregistrez les plugins activés et leurs réglages, vos thèmes locaux et QuickCSS dans Documents → PulseCord Backups.</p>
        <div className="pc-update-actions"><button disabled={busy} onClick={save}>Sauvegarder en un clic</button><button disabled={busy} onClick={restore}>Restaurer une sauvegarde</button>{hasBackup && <button disabled={busy} onClick={() => native().revealLastBackup()}>Ouvrir le dossier</button>}</div>
        <p role="status" className="pc-backup-status">{status}</p>
        <p>Ce fichier est personnel : les réglages peuvent contenir les clés de vos plugins. Les fichiers des plugins et la connexion Discord ne sont pas inclus.</p>
        <button disabled={busy} onClick={() => openSettingsTabModal(AdvancedBackupTab)}>Données avancées des plugins</button>
        <h2>Lanceur intelligent</h2><p>Utilisez le raccourci PulseCord du Bureau. Il choisit la version actuelle de Discord et restaure PulseCord après une mise à jour du client. Vos dernières mises à jour PulseCord sont conservées.</p>
    </section></>;
}
