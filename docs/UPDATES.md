# Updates et notification PulseCord OFFICIAL

Le fichier public de mise à jour est configuré pour :

`https://github.com/OCHOO339/pulsecord/releases/latest/download/pulsecord-update.json`

L'installateur porte désormais le nom fixe **PulseCord Installer.exe**. Les numéros de version restent internes, utiles pour la compatibilité et les diagnostics. Les nouveaux bundles sont identifiés par leur contenu : un nouveau build peut être distribué sans renommer l'installateur.

## Parcours dans Discord

Au démarrage, après huit secondes, puis une fois par heure, PulseCord consulte le manifeste signé. Une nouvelle mise à jour produit une notification locale **PulseCord OFFICIAL** avec le logo Pulse. Le clic ouvre la conversation locale PulseCord dans les messages privés. L'annonce y est conservée avec les nouveautés et un indicateur de lecture. Une même mise à jour n'est annoncée qu'une fois, sauf réinitialisation du réglage de notification.

L'ancien accueil PulseCord a été retiré des paramètres. La ligne PulseCord des messages privés ouvre une vue locale avec le badge OFFICIAL, le message de bienvenue, les annonces et les commandes de mise à jour. Elle ne crée aucun compte ni salon côté Discord. L'historique conserve au maximum 50 annonces dans DataStore ; les autres rubriques des paramètres restent disponibles.

La section des paramètres est insérée à deux points : dans le constructeur partagé des menus et directement dans la racine des paramètres utilisateur. La vérification de sa clé évite les doublons lorsque les deux adaptations sont actives. Le second point conserve Plugins, Themes et les rubriques personnalisées si le premier point devient incompatible. Les tests reconstruisent ce menu avec et sans l’adaptation partagée.

La ligne PulseCord est rendue directement sous l'en-tête natif « Messages privés ». Le virtualiseur réserve 40 pixels supplémentaires dans cette section ; les liens de navigation et les identifiants des vraies conversations sont conservés. Avec PinDMs, seule la dernière section des MP reçoit cette ligne, sans duplication dans les catégories épinglées. Les adaptations d'en-tête et de hauteur s'appliquent ensemble. Updates propose également un bouton pour ouvrir la conversation. Aucun observateur permanent n'est nécessaire pour cette insertion.

Updates affiche l'état et les nouveautés, puis propose **Mettre à jour et relancer Discord**. Après ce clic, le processus natif télécharge le paquet, vérifie la signature Ed25519, la plateforme, la taille, le SHA-256 et les fichiers. Les chemins sortant de l'archive sont rejetés. Aucune URL de téléchargement fournie par le renderer n'est acceptée.

Le nouveau bundle est préparé à côté de l'ancien. Seul le pointeur de version JSON est changé ; l'archive app.asar en cours d'utilisation n'est pas réécrite. Une fois l'activation réussie, PulseCord demande à Electron de relancer Discord et ferme le processus courant. En cas d'erreur avant activation, la version actuelle reste sélectionnée.

Avant de fermer Discord, l’updater relit le pointeur et vérifie qu’il désigne le paquet signé attendu. Il programme explicitement le relancement de l’exécutable courant avec une liste d’arguments vide, afin de ne pas reprendre un ancien chemin d’archive ou une invocation de maintenance. Un échec de programmation du relancement est retourné dans Updates sans fermer Discord. Le build chargé est identifié par son répertoire immuable ; si seul le pointeur disque a changé, Updates propose de terminer la mise à jour au lieu d’afficher « à jour ». Les identifiants abrégés du build chargé et du build proposé sont visibles dans cet écran.

Dans l'installateur Windows, l'installation et la réparation ferment automatiquement les processus dont le chemin d'exécutable correspond exactement au Discord sélectionné. L'écriture attend leur arrêt ; l'exécutable est relancé une fois l'opération terminée, même s'il était initialement fermé. Si la fermeture échoue, l'opération n'écrit rien. En cas d'échec pendant l'opération, un Discord qui était ouvert est relancé après le retour du moteur transactionnel. La désinstallation et le retour arrière suivent le même cycle.

Une installation initiale du nouveau chargeur est nécessaire pour les versions qui ne disposent pas encore de cette fonction. Ensuite, les mises à jour passent par Updates. Le chargeur conserve l'archive Discord d'origine et le bundle précédent.

La notification est locale au client. Aucun compte bot Discord, message réseau envoyé au nom de l'utilisateur, identifiant ou token Discord n'est nécessaire.

## Publication officielle

Chaque push sur `main` lance automatiquement [Publish PulseCord](../.github/workflows/release.yml) sur Windows. Le workflow compile, vérifie TypeScript et les tests, prépare l'installateur et les sources, signe le paquet, téléverse les quatre fichiers dans une release en brouillon puis la publie comme Latest. Il vérifie ensuite la signature et le téléchargement depuis l'URL publique du client. Le token GitHub Actions dispose de `contents: write` ; aucune connexion GitHub CLI locale n'est nécessaire.

La clé publique est dans updates.json et embarquée dans le client. La clé privée locale est dans `.pulsecord-publisher/private-key.pem`, exclue de Git et de l'archive des sources. Conserver une sauvegarde privée de cette clé ; elle ne doit jamais devenir un fichier du dépôt ou un asset de Release.

Le workflow actif est dans `.github/workflows/release.yml`. Configuration initiale nécessaire dans GitHub :

1. Publier les sources dans le dépôt.
2. Dans les secrets Actions du dépôt, définir `PULSECORD_UPDATE_KEY_PEM` avec le contenu de la clé privée locale.
3. Garder le dépôt et les assets de Releases accessibles publiquement pour que les clients puissent télécharger les mises à jour sans token.
4. Pousser sur `main`, ou lancer **Publish PulseCord** manuellement depuis Actions.

Le workflow compile, vérifie les types, exécute les tests et produit l'installateur, le paquet signé, son manifeste et les sources correspondantes. Il publie une Release nommée PulseCord. Le manifeste utilise l'adresse latest, donc les clients retrouvent automatiquement le build publié.

Commandes locales :

```sh
corepack pnpm setup:updates
corepack pnpm build
corepack pnpm typecheck
corepack pnpm test
corepack pnpm package:installer
corepack pnpm publish:prepare
corepack pnpm package:source
```

`setup:updates` réutilise la clé existante et refuse de remplacer une clé publique par une clé différente. La publication refuse un bundle qui ne correspond plus aux sources du dernier build réussi. Le changement de clé de confiance exige une procédure distincte de migration ; il n'est pas automatique.

## État de validation

Les tests vérifient signature correcte/incorrecte, clé étrangère, intégrité, plateforme, downgrade, archive avec traversée de chemin, activation sans modification de l'ASAR, retour arrière, déduplication de la notification et programmation du redémarrage. Les requêtes et le redémarrage sont simulés pendant les tests.

Le résultat de chaque compilation et publication est visible dans l'onglet Actions du dépôt. Une exécution réussie inclut la vérification du manifeste signé et du téléchargement public du paquet correspondant au build.
