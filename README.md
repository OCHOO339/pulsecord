# PulseCord

Modification du client Discord Electron basée sur une révision épinglée d’Equicord, lui-même issu de Vencord. PulseCord comprend les accents jaunes, le logo Pulse, la police Cause, une conversation locale PulseCord OFFICIAL et un installateur Windows.

## Installer et mettre à jour

Télécharger **[PulseCord.Installer.exe dans la dernière release](https://github.com/OCHOO339/pulsecord/releases/latest)**, choisir l’action et l’installation Discord, puis lancer l’opération. L’installateur arrête le Discord sélectionné et le relance à la fin. Les binaires Windows ne disposent pas de signature Authenticode.

Les mises à jour suivantes sont disponibles dans **PulseCord → Updates**. Le client vérifie la signature Ed25519 et l’intégrité du paquet avant installation, puis redémarre Discord après votre clic. La conversation locale PulseCord OFFICIAL est située sous « Messages privés » ; il ne s’agit pas d’un compte bot distant.

## Lanceur et sauvegardes

Le raccourci **PulseCord** du Bureau lance le client avec réparation après les mises à jour Discord. Dans les paramètres, **Sauvegarde et restauration** enregistre la configuration dans `Documents/PulseCord Backups`, et **Performance** propose le mode économie en arrière-plan. La bannière Pulse est affichée entière dans les paramètres. [Fonctionnement et limites](docs/launcher-backups-performance.md).

## Compiler

Prérequis : Windows pour produire l’installateur Windows, Git, Node.js 24.19 et Corepack. Depuis la racine du dépôt avec un accès réseau :

```sh
corepack pnpm install --frozen-lockfile
node scripts/prepare.mjs
corepack pnpm --dir upstream/equicord install --frozen-lockfile
corepack pnpm build
corepack pnpm typecheck
corepack pnpm test
corepack pnpm package:installer
corepack pnpm package:source
```

Les sources PulseCord se trouvent dans `packages/`. La préparation récupère les révisions de `upstream.lock.json` dans `upstream/` et applique les modifications. L’installateur est produit dans `release/PulseCord Installer.exe`. L’archive `release/PulseCord-source.zip` comprend les sources correspondantes et les sources amont épinglées.

La compilation, le contrôle TypeScript et les tests sur fixtures ne garantissent pas la compatibilité avec chaque mise à jour de Discord. Linux et macOS ne sont pas validés.

## Publication

`corepack pnpm publish:github` compile, vérifie, empaquette, signe et publie la release, puis vérifie son téléchargement public. Cette commande exige les droits de publication et la clé privée correspondant à la clé publique dans `updates.json`. La clé privée n’est jamais versionnée.

Le [modèle GitHub Actions](docs/github-actions-release.yml) doit être placé dans `.github/workflows/release.yml` avec une connexion autorisée à gérer les workflows. Il pourra ensuite être lancé manuellement après configuration du secret de dépôt `PULSECORD_UPDATE_KEY_PEM`. Voir [le guide des mises à jour](docs/UPDATES.md).

## Récupération et licences

L’installateur propose la réparation et la désinstallation de PulseCord. Il refuse de remplacer une sauvegarde ou un chargeur dont il ne peut pas vérifier l’origine. Pour démarrer sans charger le mod, lancer Discord avec `--vanilla`.

PulseCord est indépendant de Discord. Les plugins tiers s’exécutent comme du code de confiance dans le client. L’ensemble est distribué sous [GNU GPLv3](LICENSE) ; les fichiers marqués GPL-3.0-or-later conservent leur autorisation de versions ultérieures. La [notice de licence PulseCord](packages/installer/license-notice.txt) présente les droits, la redistribution et les garanties. Les crédits et licences amont sont dans [NOTICE.md](NOTICE.md). Fournir les sources correspondantes avec toute distribution du binaire.

Documentation : [architecture](docs/ARCHITECTURE.md), [développement](docs/DEVELOPMENT.md), [validation](docs/VALIDATION.md), [branding](docs/BRANDING.md), [mises à jour](docs/UPDATES.md).
