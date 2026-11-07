# PulseCord pour Discord Flatpak

Cette version Linux cible **Discord Flatpak sur x86_64 (Intel/AMD 64 bits)**. L'installation Windows existante et son flux de mise à jour sont conservés. Discord Snap, les installations natives `.deb`/`.rpm` et Linux ARM ne sont pas pris en charge par ce parcours.

## Installation

1. Installer et ouvrir une fois Discord depuis Flathub (`com.discordapp.Discord`). Fermer ensuite Discord.
2. Télécharger **PulseCord.Installer-linux-x64.AppImage** depuis la dernière release GitHub.
3. Dans les propriétés du fichier, autoriser son exécution, puis l'ouvrir. On peut aussi utiliser `chmod +x PulseCord.Installer-linux-x64.AppImage` puis `./PulseCord.Installer-linux-x64.AppImage`.
4. Accepter la licence et sélectionner **Discord Flatpak** dans l'installateur.
5. Après installation, lancer **PulseCord** depuis le menu des applications.

Si la distribution ne peut pas ouvrir les AppImage, utiliser l'archive **PulseCord.Installer-linux-x64.tar.gz** : l'extraire dans un dossier permanent du compte utilisateur, puis exécuter `pulsecord-installer`. Le raccourci du menu doit pouvoir retrouver ce dossier.

Ne pas lancer l'installateur avec `sudo`. Aucune permission globale `--filesystem=host`, désactivation du sandbox ou modification des fichiers système de Discord n'est nécessaire.

Les sauvegardes automatiques restent dans les données persistantes de PulseCord à l'intérieur du Flatpak ; elles ne dépendent pas d'un dossier Documents non partagé avec le sandbox.

## Fonctionnement

L'installateur interroge `flatpak info` pour trouver le déploiement local. Il conserve une copie privée, spécifique à son commit, dans `~/.var/app/com.discordapp.Discord/data/pulsecord/runtimes/`. L'archive Discord originale du déploiement Flatpak reste intacte.

Le lancement utilise toujours `flatpak run` et le script officiel du paquet. Une substitution de `zypak-wrapper`, limitée à cette commande de lancement, redirige le binaire Discord vers la copie privée. Le wrapper officiel conserve ses réglages, l'intégration IPC et les préparations des modèles audio/vidéo. Aucun override permanent Flatpak n'est ajouté.

Le menu PulseCord pointe vers une copie permanente de l'AppImage dans les données du compte. Le menu Discord d'origine continue de lancer le paquet original. Pour utiliser le mod, choisir PulseCord.

Les mises à jour de PulseCord utilisent `pulsecord-update-linux-x64.json`, avec les mêmes vérifications Ed25519 et SHA-256 que Windows. Le redémarrage réutilise le wrapper officiel à l'intérieur du sandbox. Après une mise à jour du paquet Discord, lancer PulseCord pour préparer une copie du nouveau déploiement et réappliquer le dernier bundle vérifié du cache.

## Vérifications

- Tests de découverte, copie privée, protection des chemins, fermeture du bon ID Flatpak, raccourci `.desktop`, restauration de l'archive et séparation des flux de mises à jour.
- Construction native Windows et Ubuntu dans GitHub Actions, tests de l'installateur empaqueté et publication uniquement après réussite des deux plateformes.
- Intégration Linux sur une installation Flatpak vide du compte CI : un bundle de test écrit un marqueur puis redémarre via le wrapper. Il doit démarrer deux fois, après quoi l'archive privée est restaurée. Aucun compte utilisateur Discord n'est connecté pendant ce test.

Les anciennes copies privées de déploiements Discord restent disponibles pour le retour arrière et peuvent occuper de l'espace disque. Ne supprimer une ancienne copie que lorsque Discord est fermé et que le lanceur utilise déjà un autre déploiement.
