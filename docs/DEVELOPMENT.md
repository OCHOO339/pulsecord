# Développer un plugin

L'API PulseCord repose sur l'API Equicord/Vencord, pas sur un second moteur incompatible. Exemple opérationnel compilé : `packages/focus/index.ts`. Il expose un réglage persistant, ajoute un style et un raccourci dans `start`, puis retire exactement ses ressources dans `stop`.

1. Ajouter un dossier TypeScript sous `packages/`.
2. Exporter `definePlugin({ name, description, authors, start, stop, settings })` depuis index.ts ou index.tsx.
3. Ajouter sa copie vers `src/userplugins` dans scripts/prepare.mjs.
4. Utiliser `definePluginSettings` et les composants `@webpack/common`. Envelopper les composants dans `ErrorBoundary.wrap`.
5. Déclarer les dépendances via l'API Equicord/Vencord et conserver les messages de redémarrage du gestionnaire.
6. Compiler, vérifier les types et tester dans une session Discord de développement. Le sélecteur de liste des membres du plugin Focus reste dépendant du DOM Discord.

Référence : https://docs.vencord.dev/plugins/ ; instructions amont : upstream/equicord/.skills/authoring-plugins.md.

Revue communautaire requise avant intégration : provenance et licence, accès natifs/IPC, destinations réseau, nettoyage des listeners, données traitées et dépendances. Aucun chargeur distant ni marché de plugins n'est inclus. Le consentement au code tiers doit être explicite ; aucun token ne doit être demandé. Un plugin compilé dispose de privilèges étendus dans le renderer.

## Mettre à jour le socle

Examiner le diff amont et ses licences, modifier volontairement upstream.lock.json et checkout le commit exact. Exécuter prepare, installation frozen-lockfile, build --dev, typecheck et tests. Examiner les erreurs d'ancrage au lieu d'élargir aveuglément les remplacements. Tester réellement les paramètres et patches dans les canaux Discord souhaités avant de publier.

## Design

Direction : surfaces anthracite plates, texte clair, navigation discrète, logo P fourni par l’utilisateur, vert d'eau limité au logo et au focus clavier. Le premier tirage clair a été remplacé car le brief impose un thème sombre. Typographie système pour l'installateur et police Discord pour le panneau, sans requête Google Fonts. La question principale de l'installateur est « quelle installation vais-je modifier ? » : le chemin exact reste visible. Les états vides et erreurs ne sont jamais remplacés par de fausses installations.
