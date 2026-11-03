# VoiceKeeper

Plugin pulsecord qui te maintient dans un salon vocal.

- Rejoint à nouveau si quelqu'un te déconnecte du vocal
- Revient dans le salon d'origine si quelqu'un te déplace
- Se reconnecte si la connexion RTC tombe
- Filet de sécurité par polling (5 s) contre les connexions zombies
- Respecte le bouton « Déconnexion » : si tu quittes à la main, il ne te
  force pas à revenir

## Installation

### En userplugin (pas besoin de compiler Vencord)

1. Paramètres Vencord → **Plugins** → onglet **Userplugins** (ou dossier
   `Vencord/src/userplugins/` si tu compiles)
2. Crée le dossier `voiceKeeper` et place-y `index.tsx`
3. Redémarre Discord

> Si tu utilises l'édition navigateur, il faut la version source de Vencord et
> rebuild après ajout dans `src/userplugins/`.

### En plugin natif

```bash
cd Vencord/src/plugins
mkdir voiceKeeper && cd voiceKeeper
# copie index.tsx ici