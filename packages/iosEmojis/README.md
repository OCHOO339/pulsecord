# IOSEmojis

Activer **IOSEmojis** dans Paramètres → PulseCord → Plugins. Désactiver le
plugin restaure les images et polices précédentes sans redémarrage.

Les images standards des messages, réactions, statuts et du sélecteur utilisent
les dessins Apple du pack Emoji 17.0. Les polices du client reçoivent aussi une
police emoji pour les noms de salons, les textes et la saisie. Les émojis
personnalisés des serveurs gardent leurs images. Un émoji inconnu du pack garde
son rendu d'origine ; le plugin n'ajoute pas de nouvelles entrées au sélecteur
de Discord. Les textes envoyés restent des caractères Unicode ordinaires.

Les PNG sont chargés à la demande depuis la révision épinglée
`e77759c296ed37beb0dbd63908b43d8619509c6d` de
[iamcal/emoji-data](https://github.com/iamcal/emoji-data). La police WOFF2 est
embarquée, avec un seul jeu de bitmaps 32px et des ligatures OpenType pour
Chromium (drapeaux, familles et variantes de peau).

Source de la police :
[apple-emoji-ttf, macos-26-20260722-484daf4e](https://github.com/samuelngs/apple-emoji-ttf/releases/tag/macos-26-20260722-484daf4e),
asset `AppleColorEmoji-Linux.ttf`, SHA-256
`e37c7af6265ac4a0af6d57bc65e86109a776d9966e8343334557f63da482516f`.

Pour régénérer les ressources :

```sh
node scripts/update-ios-emojis.mjs
python scripts/build-ios-emoji-font.py chemin/AppleColorEmoji-Linux.ttf packages/iosEmojis/apple-emoji.woff2
```

La conversion demande `fonttools[woff]`, `brotli` et `uharfbuzz`. Les builds
normaux utilisent directement les fichiers versionnés et ne demandent pas Python.

Les métadonnées emoji-data et les outils apple-emoji-ttf sont sous MIT.
Les dessins et la police Apple Color Emoji appartiennent à Apple Inc. et ne
sont pas couverts par la licence GPL du code PulseCord ni par la licence MIT
des outils. emoji-data indique que les images Apple ne sont pas licenciées pour
un usage commercial.
