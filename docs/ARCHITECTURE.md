# Architecture et analyse

## PulseCord 0.2.0, migration vers Equicord

Le socle actif est désormais https://github.com/Equicord/Equicord au commit `00abcbeea2ddf4317e02843418f267db62bcb913`, GPL-3.0-or-later. Equicord conserve le moteur Vencord et ajoute son catalogue `src/equicordplugins`. Le build injecté provient exclusivement de `dist/desktop`, sans Equibop ni ancien bundle Vencord. Les clones Vencord/Nightcord présents sur la machine sont des références historiques et ne sont pas utilisés pour construire PulseCord.

Le nom, la couleur jaune et le logo utilisateur sont appliqués à l'installateur, au panneau et au site. Le PNG original est dans assets/pulsecord-logo.png ; les icônes PNG/ICO sont dérivées de cette source. Les crédits Equicord/Vencord restent visibles.

L'erreur IPC « Untrusted sender » venait de la comparaison brute de l'URL après navigation vers les ancres. Le contrôle accepte uniquement le webContents de la fenêtre et son cadre principal, puis compare l'URL en ignorant le fragment. Les autres pages, requêtes, fenêtres et sous-cadres sont rejetés. Un test Electron appelle réellement `operate` après `#install` et `#recovery`, avec confirmation annulée automatiquement en mode test.

Les noms disque internes de l'installateur `.mycord.json`, `.mycord.lock` et `mycord-versions` sont maintenus pour pouvoir mettre à jour et désinstaller les premières installations. Les mécanismes de repatch automatique Equicord sont désactivés pour préserver la vérification de propriété de l'installateur.

## Analyse initiale et provenance

Analyse du 1 novembre 2026. Sources primaires : https://github.com/Vendicated/Vencord, https://docs.vencord.dev/, https://github.com/Vencord/Installer, https://source.nightcord.st/nightcord/nightcord et https://nightcord.st/infos.

Vencord fournit un injecteur Electron, un renderer TypeScript/React, un pont IPC, un moteur de patches et des plugins compilés par esbuild. Son gestionnaire gère les dépendances et les plugins exigeant un redémarrage. Les thèmes, QuickCSS et sauvegardes existent déjà. Le code Nightcord a également été cloné en lecture seule dans upstream/nightcord-reference : son package.json annonce la version 1.31.5, un build esbuild et des scripts inject/uninject distincts ; src/Vencord.ts conserve les crédits Vencord et ajoute notamment un moteur UserPlugins. Son manifeste annonce GPL-3.0-or-later et un texte GPL v3 est présent. Il n'a pas été audité exhaustivement et aucune dépendance n'a été installée. Aucun de ses composants n'est intégré : le fork Equicord épinglé limite la surface de divergence et garde une provenance directe.

Le projet est un **fork reproductible par overlay** : `scripts/prepare.mjs` récupère les deux sources publiques à des commits exacts, contrôle ces commits, applique des remplacements ancrés qui échouent si la structure change, puis copie les plugins PulseCord. Les identifiants internes Vencord sont conservés pour la compatibilité. Le nom affiché vient de brand.json ; le namespace disque PulseCord/dev est stable pour éviter une migration implicite des préférences lors d'un changement de nom.

```
brand.json                  identité affichée
upstream.lock.json          URLs, licences et commits
upstream/equicord/           moteur, IPC, plugins, thèmes, settings amont
upstream/installer/         source de référence du format ASAR et détection
packages/pulsecord/            section, QuickCSS, apparence, performance
packages/focus/             premier plugin Ctrl+Alt+F
packages/installer/         Electron isolé + moteur transactionnel Node
themes/                    thème de démonstration
site/                      présentation locale et documentation
scripts/                   préparation, build du bundle
tests/                     invariants d'installation sur fichiers temporaires
docs/                      architecture, développement et limites
```

Le client utilise le React de Discord, sans deuxième client ou fausse conversation. Esbuild est conservé plutôt que Vite : il connaît les alias, modules virtuels, natives et patches Vencord. L'installateur est volontairement plus petit : HTML accessible et Node/Electron, aucun React supplémentaire.

L'installateur sérialise une petite archive app.asar chargeant le vrai patcher compilé, après conservation de l'original en `_app.asar`. Un manifeste de propriété associe les empreintes du chargeur et de l'original. Les bundles sont immuables par empreinte et l'ancienne version reste disponible. Les opérations sont verrouillées ; les erreurs ordinaires entraînent une restauration. Une interruption brutale du processus ou de la machine n'est pas une transaction de système de fichiers : voir README pour la récupération manuelle.

Pas de téléchargement de plugin ni de mise à jour exécutée au runtime. Les sommes SHA-256 détectent les corruptions ; elles ne prouvent pas l'identité de l'éditeur. La distribution signée, le serveur de versions et sa clé publique ne sont pas configurés. Le repatch automatique amont est désactivé pour préserver les vérifications de propriété PulseCord.

La sécurité du renderer ne permet pas d'isoler un plugin Vencord du reste de Discord. Les plugins doivent être revus comme du code de confiance ; les permissions déclaratives seules ne sont pas une sandbox. Le code PulseCord ne lit ni messages ni identifiants. Le catalogue amont reste du code tiers à auditer ; sa présence ne vaut pas certification de tous les plugins.

Compatibilité : mécanisme hérité de Vencord pour Discord Electron. Windows est la plateforme de compilation disponible. Détection macOS et Linux classique implémentée mais non testée sur ces systèmes. Flatpak/Snap, adaptations de permissions, altération des signatures macOS et contournement d'intégrité ne sont pas pris en charge. En cas de refus d'intégrité du client, l'installation doit être abandonnée.
