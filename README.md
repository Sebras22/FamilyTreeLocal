# Arbora, la version locale

Arbora est une application de généalogie moderne pour créer, visualiser et transmettre un arbre familial. La version locale est une application de bureau Windows **100 % hors ligne** : aucun compte, aucune télémétrie, aucune connexion à Internet. Vos arbres vivent sur votre ordinateur, dans un seul fichier `library.arbora` (avec une copie de la version précédente), écrit de façon sûre pour qu'une coupure de courant n'abîme rien.

Un arbre d'exemple peut être chargé au premier lancement, et la bibliothèque entière s'exporte et s'importe d'un clic pour la sauvegarder ou la déplacer.

## Fonctionnalités

- **Un arbre qui se lit d'un coup d'œil** : les générations descendent depuis les ancêtres, une échelle des années accompagne l'arbre, et les cartes dévoilent plus d'informations à mesure qu'on zoome.
- **Un arbre qui s'explore** : déplacement, zoom, vue centrée sur une personne, mini-carte, raccourcis clavier, vue en éventail des ascendants.
- **Des familles réelles** : plusieurs unions, enfants adoptés, beaux-parents, familles recomposées, jumeaux, mort-nés, parrains, marraines et témoins.
- **Des dates telles qu'on les connaît** : jour, mois ou seulement l'année, avec la mention « vers ».
- **Un coup de main pour rester juste** : les incohérences (parent plus jeune que son enfant, naissance après un décès…) sont encadrées en rouge, sans jamais bloquer la saisie.
- **Rien n'est perdu** : corbeille, historique des modifications, détection des doublons et fusion de deux fiches.
- **Des fiches complètes** : profession, biographie, sources avec niveau de fiabilité, commentaires, lien de parenté entre deux personnes.
- **Un tableau de bord** par arbre, un assistant de démarrage, la recherche de personnes.
- **Import et export GEDCOM**, le format d'échange de la généalogie.
- **Confortable partout** : thème clair ou sombre selon le navigateur, français et anglais, interface adaptée aux écrans de téléphone.

## Technologies

React, TypeScript, Vite, Mantine, React Flow, Motion, emballées dans une application de bureau Tauri 2 (Rust).

## Licence

Tous droits réservés. Le code est public pour être consulté ; toute copie, modification, redistribution ou réutilisation exige l'accord écrit du titulaire. Voir [`LICENSE`](LICENSE).
