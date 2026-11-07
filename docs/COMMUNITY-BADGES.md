# Badges de communauté PulseCord

- **Pulse Dev** : réservé à l'ID `1366054228480753755`, défini dans le code du client.
- **Pulse User** : attribué aux comptes inscrits et approuvés dans le registre GitHub public.
- Les badges sont propres à PulseCord : les clients Discord standards ne les affichent pas. Ils indiquent une inscription, pas une présence en temps réel ni une preuve que le client est actuellement ouvert.

## Demander un badge

Dans PulseCord, ouvrir **Communauté → Demander le badge Pulse User**. Le navigateur ouvre une nouvelle demande GitHub avec l'ID du compte Discord connecté. L'utilisateur doit ensuite la soumettre lui-même. La demande précise que cet ID devient public.

La lecture du registre n'envoie aucun ID Discord, jeton, message ou donnée de présence : tous les clients demandent la même liste de labels GitHub, sans authentification. Un cache local limite cette lecture à une fois toutes les six heures au démarrage, avec un bouton d'actualisation manuelle. Il n'y a pas de requête par utilisateur ni de minuteur de consultation récurrent.

## Valider ou retirer un membre

Le registre utilise les labels du dépôt `OCHOO339/pulsecord`, modifiables uniquement par ses responsables. Cette solution fonctionne sans serveur, sans secret supplémentaire et sans workflow privilégié.

1. Vérifier la demande et l'identité Discord annoncée. La demande seule n'est pas une preuve de propriété du compte.
2. Après validation, créer le label **`pulsecord-user:ID_DISCORD`** dans les labels du dépôt. Exemple : `pulsecord-user:669936721730863105`.
3. Le client lit le label lui-même, et jamais l'ID modifiable du texte de la demande. Une modification ultérieure de celle-ci ne peut pas changer l'identité approuvée.
4. Supprimer ce label pour retirer l'inscription. Les caches existants se mettent à jour au prochain contrôle ou par le bouton d'actualisation. Un client hors ligne conserve sa dernière liste connue.

Un label `pulsecord-dev:...` n'accorde aucun privilège : les développeurs sont définis séparément dans le code. Le label du compte ami demandé initialement est déjà créé.

Le registre est limité à dix pages de cent labels, avec une réponse bornée à 256 Ko par page et un délai global de quinze secondes. En cas d'indisponibilité, de limite GitHub ou de réponse invalide, la dernière liste reste disponible. L'obtention d'un badge ne donne aucun privilège Discord ni accès aux autres comptes.
