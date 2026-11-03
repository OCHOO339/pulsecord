# Validation de PulseCord 0.4.0

## Ajout du nouvel updater

Le nouvel updater et l'assistant d'installation ont passé 33 tests Node au total. Les requêtes et le relancement sont simulés pour le flux natif. Cela inclut signature Ed25519, intégrité, traversée de chemin, bootstrap du chargeur, activation sans réécriture de l'ASAR, retour arrière, notification OFFICIAL, déduplication, sélection des installations et progression des opérations.

Le build global, la vérification TypeScript et le packaging Windows du nouvel updater et de l'assistant ont réussi le 1er novembre 2026. Le fichier de distribution conserve le nom stable `PulseCord Installer.exe`. Le canal GitHub est configuré dans les sources mais non publié.

Environnement : Windows x64, Node 24.19.0, pnpm 12.15.0, Electron 41.2.1. Socle Equicord au commit `00abcbeea2ddf4317e02843418f267db62bcb913`.

## Résultats

- Le cycle d'installation Windows ferme le chemin exact de Discord sélectionné et le relance après l'opération. Les 38 tests passent, dont un test réel sur deux exécutables temporaires portant le même nom : seul celui sélectionné est arrêté. Le vrai Discord n'est pas fermé pendant ces tests. Les tests du cycle couvrent aussi le refus d'écriture si l'arrêt échoue, la réouverture après erreur et le signalement distinct d'un échec de lancement.

- Build réel Equicord/PulseCord réussi avec `--dev --disable-updater`. Le payload injecté contient les fichiers de `dist/desktop`, les plugins PulseCord et PulseCordFocus ainsi que le logo PNG embarqué.
- Vérification TypeScript réussie avec `skipLibCheck: false`.
- Trente-trois tests Node réussis, incluant l'assistant, l'updater, l'installation/restauration, l'IPC, le splash et les fenêtres/tray Pulse.
- Régression « Untrusted sender » vérifiée dans le vrai runtime Electron : après navigation vers `#install` puis `#recovery`, `list` et `operate('install', 0)` passent le contrôle. La confirmation est annulée automatiquement en mode test, avant toute écriture sur une installation détectée.
- Installation et désinstallation exécutées dans Electron sur une archive ASAR temporaire. L'archive originale est restaurée à l'octet près. Le moteur utilise `original-fs` dans Electron pour travailler sur les fichiers physiques et éviter la virtualisation ASAR.
- Le chargeur ASAR généré est également lisible par l'implémentation native d'Electron.
- Régression du chargeur embarqué : le test empaqueté installe le vrai `loader.cjs` situé dans l'ASAR de l'installateur sur une archive Discord temporaire, vérifie ses octets et son empreinte enregistrée, puis restaure l'original. La lecture de cette ressource utilise le système de fichiers ASAR d'Electron ; les archives Discord restent manipulées avec `original-fs`.
- Le binaire Windows empaqueté passe le même smoke test, code de sortie 0. Deux installations réelles sont détectées en lecture seule. Aucune n'a été modifiée pendant ces tests.
- Le logo fourni est copié sans redessin depuis le fichier utilisateur. Les six images ICO (16, 32, 48, 64, 128 et 256 pixels) sont présentes dans l'exécutable applicatif et le portable. L'icône et les métadonnées Windows sont appliquées par rcedit. Le portable reste `NotSigned` : aucun certificat n'est configuré.
- En 0.2.1, la source exacte du logo est le fichier `pulse.png` indiqué par l'utilisateur, à la racine du projet. Les copies distribuées conservent exactement ses octets.
- Site vérifié à 1440, 768 et 390 pixels : liens locaux valides, sélection de palette et absence de débordement horizontal. Logo et accent jaune appliqués.

Les résultats détaillés et captures sont dans `dist/qa/`. Le test du plugin Focus transpile son vrai module TypeScript et substitue les API et le DOM ; il ne certifie pas le sélecteur d'une version Discord donnée.

## Accueil et coût du rendu

Le composant JSX de conversation locale et sa ligne de messages privés sont rendus dans un aperçu isolé avec les API Discord substituées. L'aperçu vérifie le nom PulseCord, le badge OFFICIAL, l'ouverture par clic, la fermeture lors de la navigation et la disparition du splash. Les tests de stockage vérifient la persistance, la déduplication, les non-lus et les chargements concurrents. Les 41 tests Node passent. Captures : `pulsecord-welcome.png` et `pulsecord-startup.png` dans dist/qa. Le raccord du patch à la liste native reste à confirmer dans une session Discord connectée.

Le renderer compilé passe de 4 164 559 à 3 295 813 octets (20,9 % de moins), principalement grâce aux variantes de logo adaptées. Le badge embarqué fait 4 707 octets et le splash 36 330 octets. L'accueil ne s'abonne plus aux changements globaux des paramètres et ne parcourt plus le registre des plugins. Les anciens téléchargements de badges sont supprimés des cartes.

Ce sont des réductions de ressources et de travail identifiables, pas un benchmark de fréquence d'images ou de temps de démarrage dans Discord. Le flou n'existe que pendant l'animation de démarrage ; il n'y a pas de boucle d'animation ni d'observateur permanent.

## Limites

Les remplacements de logos sont vérifiés dans Chromium sur les variantes SVG, les barres de titre, l'écran de connexion, le splash natif, le chargement vidéo et le favicon. Le test contrôle aussi qu'une icône sans rapport et un avatar personnel ne sont pas remplacés. Voir [BRANDING.md](BRANDING.md) pour la couverture et les limites liées aux versions Discord et aux raccourcis système.

Pas de validation dans une session Discord authentifiée : montage des paramètres, correspondance des patches, activation réelle des plugins amont, QuickCSS et thèmes restent à vérifier dans le client. Linux/macOS, Flatpak/Snap, signature, notarisation, benchmark et mise à jour distante signée ne sont pas validés.

Le test de l'installateur ne confirme jamais une opération sur un Discord détecté. Toutes les écritures de test utilisent des fixtures créées pour le test.
