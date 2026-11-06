# Logos Discord remplacés par Pulse

PulseCord 0.4.0 applique le logo utilisateur aux marques de l'interface : variantes SVG Discord, barre de titre Windows/macOS, marque de connexion, chargement du client, splash natif et favicon. Le bouton d'accueil en haut à gauche conserve le logo Discord d'origine. Les avatars personnels et icônes de serveurs ne sont pas ciblés.

Les règles CSS identifient les chemins SVG de marque, dont le chemin `M19.73 4.87…` présent dans le bundle public Discord Stable build 657850 consulté lors de l'implémentation. Elles s'appliquent également aux éléments rendus plus tard par React. Il n'y a ni MutationObserver, ni recherche périodique dans le DOM, ni remplacement global de toutes les images. Les signatures de chemins et les classes de chargement pourront nécessiter une adaptation après une mise à jour Discord.

Le bouton Messages privés dans la navigation des serveurs est exclu des remplacements de marque : son logo SVG, son fond et ses dimensions natifs sont préservés. Aucun pseudo-élément PulseCord n'y est ajouté. Le lien Amis, qui utilise aussi `/channels/@me`, est préservé.

Le splash natif a été identifié en lecture seule dans l'archive de l'application officielle : `splash/index.html` et `splash/index.css`. Les fichiers originaux ne sont pas modifiés ; le style est injecté dans la fenêtre au chargement.

Le processus principal utilise `PulseWindow` et `PulseTray`, dérivés des classes Electron, avant de charger le client original. Une seule image native Pulse est décodée et partagée par les fenêtres et le tray. Les mises à jour ultérieures d'icône conservent Pulse. Le dock macOS est aussi ciblé, mais n'a pas été validé sur macOS. Les variantes graphiques d'état Discord du tray sont remplacées par le logo Pulse.

Les pages Discord et les pages embarquées du client reçoivent uniquement du CSS de marque. Les fenêtres externes ne reçoivent pas cette injection. Le mode `--vanilla` contourne ces remplacements comme le reste du mod.

Le favicon est changé une seule fois au démarrage et restauré à l'arrêt du plugin. Les règles natives et renderer utilisent les variantes d'image embarquées, sans téléchargement supplémentaire.

L'exécutable officiel et sa signature, ainsi que les anciens raccourcis et épingles Windows, restent ceux du programme Discord installé. Leur icône est distincte de celle de la fenêtre en cours d'exécution. L'installateur PulseCord possède déjà sa propre icône. Aucun contournement des vérifications d'intégrité du client n'est ajouté.

Vérification : compilation et TypeScript, tests des classes natives avec Electron substitué, tests Chromium des sélecteurs et du favicon. La validation dans une session Discord authentifiée et sur les plateformes autres que Windows reste nécessaire.
