# Optimisations de l'interface PulseCord

Le correctif cible le travail d'interface qui peut concurrencer un jeu, un vocal ou un partage d'écran. Il ne change pas la qualité audio, les codecs, la résolution des streams, l'accélération matérielle ou les options de sécurité de Chromium.

## Mesure reproductible

Le test `tests/performance-profile.cjs` utilise Chromium/Electron, 500 lignes contenant un emoji et 100 changements de classe sur leur parent. La référence est le code de `4a22620`, avant ces optimisations.

| Travail mesuré dans cette fixture | Avant | Après |
| --- | ---: | ---: |
| Lectures de styles dues aux 100 changements de classe | 50 000 | 0 |
| Règles CSS de remplacement des emojis, hors police | 4 027 351 octets | 353 octets |
| Lectures de styles pour 100 lignes ajoutées sans focus | traitement actif | 0 |

Au retour du focus, les 100 nouvelles lignes sont traitées une seule fois. Les tests vérifient aussi le rendu des emojis, les séquences Unicode, le recyclage des lignes du sélecteur, l'exclusion des emojis personnalisés et la restauration des styles à la désactivation.

La durée globale de la fixture comprend des attentes et varie avec la machine : elle ne constitue pas un benchmark de FPS ou de consommation mémoire de Discord. Les résultats ne mesurent pas l'encodage des streams ni une session de jeu réelle.

## Changements

- Une règle CSS commune remplace des milliers de sélecteurs d'emojis. Les éléments ajoutés sont identifiés par leur source et leur identité.
- Les changements de classes des parents ne déclenchent plus de parcours des descendants. Les mutations sont regroupées par élément et les lectures de polices précèdent les écritures.
- Le traitement des emojis est suspendu quand Discord est masqué ou perd le focus, puis repris une fois au retour.
- L'économie d'animations couvre également la perte du focus, sans suspendre la lecture audio ou vidéo.
- Le curseur fluide n'effectue plus de mesures lors des interactions hors de l'éditeur de messages.
- Le changement d'un réglage ne reconstruit plus toute la feuille de style de marque et ses polices embarquées.
- Les traductions ne recopient plus tout leur cache à chaque réponse.
- La maintenance HTTP est différée de 30 secondes après le lancement, effectuée au plus une fois par semaine, et ne vide le cache que s'il dépasse 256 Mio. Les données de connexion, réglages, traductions et IndexedDB restent en place. Le réglage existant permet de désactiver cette maintenance.

## Vérification

`node --test tests/performance-profile.test.mjs` exécute le contrôle de charge ciblé. `pnpm test` inclut ce test et les régressions fonctionnelles. Le test visuel `tests/smooth-typing.cjs` contrôle le curseur, les sélections, la composition, le zoom et l'absence de calculs hors de l'éditeur.
