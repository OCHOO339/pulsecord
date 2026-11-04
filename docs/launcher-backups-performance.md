# Lanceur, sauvegardes et performances

## Lanceur intelligent Windows

L’installation ou la réparation avec l’exécutable portable crée un raccourci **PulseCord** sur le Bureau. Le programme et son runtime sont conservés dans `%LOCALAPPDATA%\PulseCord\Launcher\PulseCord Launcher.exe`, pour éviter une nouvelle extraction du portable à chaque ouverture.

Utiliser ce raccourci pour démarrer Discord. Il choisit la version numérique la plus récente du canal sélectionné. Si PulseCord est encore installé et que ses fichiers de démarrage sont valides, il ouvre Discord sans le fermer. Si une nouvelle version de Discord a retiré PulseCord, il réinstalle le dernier bundle disponible puis démarre la nouvelle version.

Le lanceur conserve deux bundles de récupération par canal, avec vérification des empreintes. Les mises à jour intégrées rafraîchissent cette copie. Une ancienne installation encore présente peut aussi fournir le bundle de récupération ; en dernier recours, le bundle de l’installateur est utilisé. Les canaux Stable, PTB et Canary restent séparés. Un autre mod ou une installation dont les fichiers d’origine ont changé n’est pas écrasé.

Le raccourci Discord d’origine reste inchangé. Le lancement direct par ce raccourci ne passe pas par la réparation PulseCord. Le lanceur n’est pas un service permanent et n’effectue aucun sondage en arrière-plan.

## Sauvegarde en un clic

Dans **Sauvegarde et restauration**, le bouton **Sauvegarder en un clic** crée un fichier daté dans `Documents\PulseCord Backups`.

Il contient les réglages PulseCord et des plugins, leur état activé/désactivé, QuickCSS et les thèmes CSS locaux. Il ne contient ni les exécutables des plugins, ni le profil Discord, ni les sessions de connexion. Les clés configurées dans les plugins peuvent figurer dans leurs réglages : garder ce fichier privé.

Le bouton **Données avancées des plugins** conserve l’accès à l’ancien import/export, notamment aux données DataStore des plugins.

La restauration demande de sélectionner un fichier puis de confirmer son application et le redémarrage. Tout le fichier est validé avant les écritures. Une sauvegarde de récupération est créée automatiquement. Les chemins sortant des dossiers de configuration, les liens symboliques, les doublons et les clés de pollution de prototype sont refusés. Les sauvegardes sont limitées à 16 Mo et 256 fichiers. Les fichiers couverts sont remplacés ; les thèmes supplémentaires déjà présents ne sont pas supprimés.

## Économie de ressources

Le mode activé par défaut dans **Performance** met les animations CSS de l’interface en pause lorsque Discord est masqué, puis les réactive au retour. Il ne modifie pas les connexions vocales, les flux audio/vidéo ou les paramètres de partage d’écran.

VoiceKeeper ne lance plus son sondage de sécurité de cinq secondes lorsqu’il ne suit aucun salon vocal. Il le démarre à la connexion et le retire lorsque l’utilisateur quitte manuellement le vocal. Les vérifications de mise à jour ne créent plus de timers supplémentaires lors d’un second démarrage du plugin.

Les caches de traduction restent plafonnés. Ces changements visent des traitements identifiés de PulseCord ; ils ne constituent pas une mesure d’un gain global de RAM ou de FPS sur Discord et ses plugins tiers.

## Bannière

La bannière Pulse est affichée dans les paramètres PulseCord, sans recadrage et avec une hauteur maximale de 180 px. Le fond de la conversation locale conserve son flou indépendant.
