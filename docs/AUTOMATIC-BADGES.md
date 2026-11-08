# Badges automatiques PulseCord

Le client inscrit automatiquement le compte connecté au démarrage, sans demande GitHub ni validation par un administrateur. Les comptes `1366054228480753755` et `669936721730863105` conservent Pulse Dev ; les autres inscriptions donnent Pulse User.

Le registre est un Worker Sites avec une base D1. Le client envoie uniquement l’ID Discord, une clé publique d’installation, un horodatage et une signature Ed25519. La clé privée d’installation reste dans DataStore. Aucun jeton Discord ni message n’est envoyé. Les IDs inscrits sont publics.

L’option Communauté permet d’arrêter le partage et d’envoyer une suppression signée pour cette installation. Les inscriptions expirent après 30 jours sans renouvellement. Le renouvellement est limité à une fois toutes les douze heures ; la liste des badges se rafraîchit toutes les cinq minutes avec un cache hors ligne.

Pulse User est une déclaration provenant d’un client, pas une preuve d’identité Discord ni un statut en ligne. Une signature protège la modification et la suppression de la fiche d’installation ; elle ne prouve pas que son auteur possède l’ID Discord déclaré. Aucun rôle privilégié n’est attribué par le serveur.

## Déploiement

Le service se trouve dans `services/community-registry`. Construire avec `node scripts/build.mjs`, vérifier avec `node scripts/validate-artifact.mjs` et `node --test tests/registry.test.mjs`, puis utiliser le workflow Sites. La migration D1 doit être appliquée pendant le déploiement.

Le service public est hébergé sur https://pulsecord-community-registry.streetforcelogistics.chatgpt.site. Les migrations et les routes publiques doivent être vérifiées avant toute mise à jour du client.
