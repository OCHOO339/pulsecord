# PulseCord

- Optimisation de l'interface pendant les jeux et le vocal : règles CSS des emojis remplacées par une règle commune, traitement des mutations ciblé et suspendu sans focus, lectures et écritures de polices regroupées.
- Animations en pause lorsque Discord perd le focus ; le curseur fluide ne mesure plus l'éditeur pendant les interactions hors de la zone de message.
- Cache web conservé entre les lancements, contrôle hebdomadaire différé et nettoyage seulement au-delà de 256 Mo ; suppression des copies complètes du cache de traduction à chaque libellé traduit.

- Saisie fluide : curseur doré animé dans les messages, désactivable dans Performance, avec saisie native conservée et respect de la réduction des animations.

- StatusRotator : plusieurs emojis séparés par des points-virgules défilent dans l'ordre à chaque changement de statut, avec prise en charge des IDs et codes Discord.

- StatusRotator : champ Emoji acceptant un emoji Unicode, un ID ou un code Discord, avec validation et restauration de l'emoji d'origine.

- StatusRotator remplace BioRotator : rotation de cinq statuts personnalisés, pause, intervalle réglable et restauration du statut et de son emoji à l'arrêt, sans modifier la bio.

- Copie atomique de l’archive du lanceur avec vérification SHA-256 : un échec de copie conserve le fichier fonctionnel au lieu de le tronquer.
- Lanceur intelligent Windows avec raccourci PulseCord, choix de la dernière version Discord et récupération du dernier build après une mise à jour du client.
- Sauvegarde en un clic des réglages, thèmes locaux et QuickCSS, restauration validée et copie de récupération automatique.
- Bannière Pulse entière dans les paramètres ; animations CSS en pause en arrière-plan et suppression du sondage VoiceKeeper hors vocal.
- Notice de licence PulseCord en français dans l’installateur, accompagnée du texte GPLv3 intégral, des attributions et des liens vers les sources officielles.
- Nettoyage automatique du cache web temporaire à chaque lancement de Discord, désactivable dans Performance, sans effacer la connexion, les réglages ou les traductions locales.
- Traduction automatique des descriptions, réglages et textes d’interface des plugins selon la langue de Discord, avec cache local et libellés français courants intégrés.
- Logo des messages privés réduit et centré dans un bouton arrondi, avec accent jaune au survol et au clavier.
- Bannière de la conversation affichée entièrement, avec ses proportions conservées et sans recadrage.
- Fond doré Pulse flouté dans la conversation officielle, avec un voile sombre pour garder les messages lisibles.
- Icône VoiceKeeper restaurée, y compris pendant le chargement des animations.
- Le bouton VoiceKeeper apparaît dès le démarrage de Discord, même quand la barre vocale s’affiche avant le chargement des plugins.
- Conversation PulseCord replacée à droite de la liste des MP, défilement contenu dans la conversation et notes de mises à jour repliées pour faciliter la lecture.
- Animation VoiceKeeper pilotée par le lecteur natif des icônes Discord : séquences de survol et de clic, trait animé, durées alignées sur le micro et réduction des animations gérée par Discord.
- Bouton VoiceKeeper avec icône « interdit » à gauche du micro : activation persistante, état jaune, animation courte et annulation des reconnexions à la désactivation.
- Correction du démarrage du renderer : les annonces attendent que Discord ait initialisé React avant de l’utiliser. L’erreur « reading memo » ne bloque plus le chargement de PulseCord.
- Mise à jour intégrée : vérification du build activé avant fermeture, relancement explicite de l’exécutable Discord sans anciens arguments et affichage du build réellement chargé. Un redémarrage incomplet n’est plus présenté comme un client à jour.
- Ajout d’un point d’insertion dédié aux paramètres utilisateur pour conserver la section PulseCord lorsque le constructeur partagé des menus Discord change, sans dupliquer ses rubriques.
- Placement de PulseCord directement sous « Messages privés », à côté des conversations, avec sa hauteur réservée dans la liste et prise en charge des catégories PinDMs.
- Accès à la conversation locale depuis Updates.
- Affichage Markdown des annonces et nouveautés : titres, listes, gras et liens mis en forme dans la conversation PulseCord et Updates.
- Réparation du routage du bouton Messages privés à la souris et au clavier.
- Adaptation au comptage numérique des lignes dans le client Discord actuel ; insertion de la conversation PulseCord comme enfant de navigation natif.
- Correction du bouton Messages privés : logo contenu dans le bouton, clics préservés et lien Amis inchangé.
- Conversation locale PulseCord intégrée sans modifier les identifiants des conversations Discord.
- Mise à jour depuis l'onglet Updates, avec vérification de signature et d'intégrité.
- Notification locale PulseCord OFFICIAL quand une mise à jour est disponible.
- Redémarrage automatique de Discord après une mise à jour demandée par l'utilisateur.
- Remplacement des logos de marque dans l'interface et les fenêtres.
