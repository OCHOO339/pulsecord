# PulseCord

Modification du client Discord Electron basée sur une révision épinglée d’Equicord, lui-même issu de Vencord. PulseCord comprend les accents jaunes, le logo Pulse, la police Cause, une conversation locale PulseCord OFFICIAL et des installateurs Windows et Linux x64 pour Discord Flatpak.

## Installer et mettre à jour

Télécharger **[PulseCord.Installer.exe dans la dernière release](https://github.com/OCHOO339/pulsecord/releases/latest)**, choisir l’action et l’installation Discord, puis lancer l’opération. L’installateur arrête le Discord sélectionné et le relance à la fin. Les binaires Windows ne disposent pas de signature Authenticode.

Les mises à jour suivantes sont disponibles dans **PulseCord → Updates**. Le client vérifie la signature Ed25519 et l’intégrité du paquet avant installation, puis redémarre Discord après votre clic. La conversation locale PulseCord OFFICIAL est située sous « Messages privés » ; il ne s’agit pas d’un compte bot distant.

Pour **Discord Flatpak sous Linux x64**, utiliser `PulseCord.Installer-linux-x64.AppImage` ou l'archive portable `.tar.gz` de la même release. Le lanceur PulseCord apparaît dans le menu des applications. [Installation Linux et fonctionnement Flatpak](docs/LINUX.md).

## Lanceur et sauvegardes

Le raccourci **PulseCord** du Bureau lance le client avec réparation après les mises à jour Discord. Dans les paramètres, **Sauvegarde et restauration** enregistre la configuration dans `Documents/PulseCord Backups`, et **Performance** propose le mode économie en arrière-plan. La bannière Pulse est affichée entière dans les paramètres. [Fonctionnement et limites](docs/launcher-backups-performance.md).

## Compiler

Prérequis : Windows pour produire l’installateur Windows, Linux pour l’AppImage, Git, Node.js 24.19 et Corepack. Depuis la racine du dépôt avec un accès réseau :

```sh
corepack pnpm install --frozen-lockfile
node scripts/prepare.mjs --fetch-only
corepack pnpm --dir upstream/equicord install --frozen-lockfile
corepack pnpm build
corepack pnpm typecheck
corepack pnpm test
corepack pnpm package:installer
corepack pnpm package:source
```

Les sources PulseCord se trouvent dans `packages`. La préparation récupère les révisions de `upstream.lock.json` dans `upstream/` et applique les modifications. L’installateur est produit dans `release/PulseCord Installer.exe`. L’archive `release/PulseCord-source.zip` comprend les sources correspondantes et les sources amont épinglées.

La compilation, le contrôle TypeScript et les tests sur fixtures ne garantissent pas la compatibilité avec chaque mise à jour de Discord. La validation Linux comprend une installation Flatpak isolée dans GitHub Actions ; les autres formats Discord Linux et macOS ne sont pas couverts.

## Publication

Chaque push sur `main` lance le workflow [Publish PulseCord](.github/workflows/release.yml) : compilation, vérification TypeScript, tests, création de l’installateur et des sources, signature puis publication de la release. Le workflow vérifie ensuite la signature et le téléchargement public de la mise à jour. Il peut aussi être lancé manuellement depuis Actions.

Configurer une fois le secret Actions `PULSECORD_UPDATE_KEY_PEM` avec la clé privée correspondant à la clé publique dans `updates.json`. La clé privée n’est jamais versionnée. GitHub fournit automatiquement le token de publication. Voir [le guide des mises à jour](docs/UPDATES.md).

Les notes de release reprennent les commits du push dans l’ordre : une puce pour le résumé, puis une pour la description lorsqu’elle existe. Ces mêmes notes apparaissent dans les mises à jour PulseCord (limitées à 8 000 caractères dans le manifeste signé). Un lancement manuel utilise le message du commit sélectionné.

## Récupération et licences

L’installateur propose la réparation et la désinstallation de PulseCord. Il refuse de remplacer une sauvegarde ou un chargeur dont il ne peut pas vérifier l’origine. Pour démarrer sans charger le mod, lancer Discord avec `--vanilla`.

PulseCord est indépendant de Discord. Les plugins tiers s’exécutent comme du code de confiance dans le client. L’ensemble est distribué sous [GNU GPLv3](LICENSE) ; les fichiers marqués GPL-3.0-or-later conservent leur autorisation de versions ultérieures. La [notice de licence PulseCord](packages/installer/license-notice.txt) présente les droits, la redistribution et les garanties. Les crédits et licences amont sont dans [NOTICE.md](NOTICE.md). Fournir les sources correspondantes avec toute distribution du binaire.

Documentation : [architecture](docs/ARCHITECTURE.md), [développement](docs/DEVELOPMENT.md), [validation](docs/VALIDATION.md), [branding](docs/BRANDING.md), [mises à jour](docs/UPDATES.md).
