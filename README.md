# FlightBrief

FlightBrief est une application de bureau (Windows / macOS / Linux) pour les créateurs de contenu et streamers de simulation aérienne. Elle affiche un briefing de vol clair et personnalisable, tient un logbook, suit une progression de carrière (compagnie virtuelle, IVAO, VATSIM), suit un vol en direct via SimConnect, et expose le tout comme **sources navigateur OBS** en local — sans dépendre d'un fichier ouvert manuellement dans un onglet.

## Fonctionnalités

- **Briefing de vol** : indicatif, aéroports départ/arrivée, route, appareil, altitude, durée, météo, notes — avec bascule **VFR / IFR**. Import SimBrief automatique, connexion au simulateur et suivi de vol en direct (carte, télémétrie, rapport de phases détaillé) directement sur la même page.
- **Import SimBrief** : récupère automatiquement ton dernier plan de vol via ton pseudo SimBrief.
- **Logbook** : historique des vols, statut PIREP, lien avec une carrière, et pour les vols trackés : relecture complète sur carte (trajet coloré par phase), profil altitude/vitesse, table de phases détaillée (roulage, montée initiale, croisière, descente, approche finale) et schéma de la zone de toucher des roues sur la piste (distance au seuil, écart latéral, taux de descente).
- **Carrière** : compagnies virtuelles, IVAO, VATSIM — grades, heures requises, progression automatique. Pour IVAO, création de **Tours** affichés en timeline horizontale (étapes OACI reliées, cochables directement sur la carte), modifiables à tout moment, avec une petite animation à la complétion.
- **Suivi de vol (SimConnect)** : connexion directe à MSFS pour récupérer la télémétrie en direct (position, altitude, vitesses, cap, vario, fréquence radio active), affichage sur une carte interactive, phases de vol calculées en direct au fil du vol, et détection automatique décollage/atterrissage/fin de vol pour pré-remplir le logbook.
- **Outil Live** : la carte de briefing destinée à OBS (aperçu + lien source), et un **overlay Twitch de télémétrie entièrement personnalisable** (indicatif, trajet, phase, altitude, cap, fréquence radio, distance, progression) — champs à cocher, libellés renommables, couleurs, police, disposition (barre / bloc / cartes), bordure, ombre, flou, tout est configurable, avec aperçu en direct dans l'app.
- **Deux sources OBS locales indépendantes**, sur deux ports différents : `http://localhost:4813/obs` (carte de briefing) et `http://localhost:4814/live` (overlay de télémétrie live) — chacune à coller une fois dans OBS (Source → Navigateur → URL).
- **Profil** : identité pilote (prénom, réseau, VID VATSIM/IVAO, pseudo Twitch, aéroport de base) et tableau de bord de statistiques calculées à partir du logbook (heures totales, distance, répartition VFR/IFR, appareils et aéroports les plus fréquentés, heures par carrière).
- **Accueil & visite guidée** : au premier lancement, une courte modale demande quelques infos de profil (facultatives), puis propose une visite guidée de l'application — rejouable à tout moment depuis l'onglet Profil.
- **Admin** : couleurs, polices (15+ préchargées), rayon des angles, halo lumineux, bordure/ombre/fond transparent, alignement, disposition des cases, texte de marque, visibilité des sections — avec thèmes prédéfinis, dont un calé sur une identité visuelle bleu/nuit.
- **Fenêtre sans cadre** : barre de titre intégrée à l'interface (drag, réduire/agrandir/fermer), navigation figée au défilement, cohérente avec le thème.
- **Stockage local** : toutes les données (logbook, carrières, thème, overlay live, profil) sont enregistrées dans un fichier JSON sur ta machine (dossier de données utilisateur de l'application), pas dans le cloud.

## Installation (utilisateurs)

Télécharge l'installeur correspondant à ton système depuis la page [Releases](../../releases) du dépôt (ou depuis la page de téléchargement du projet si elle est publiée — voir `docs/index.html`), puis lance-le comme n'importe quel logiciel.

## Développement

Prérequis : [Node.js](https://nodejs.org/) 18+.

```bash
npm install
npm start
```

L'application s'ouvre dans une fenêtre. Les deux sources OBS sont disponibles sur `http://localhost:4813/obs` (briefing) et `http://localhost:4814/live` (overlay live) dès que l'app est lancée.

### Suivi de vol (SimConnect)

Depuis l'onglet **Briefing**, le bouton « Connecter au simulateur » se connecte à Microsoft Flight Simulator via `node-simconnect` (aucun logiciel tiers requis). MSFS doit être lancé, avec un vol chargé, avant de cliquer dessus. La carte utilise les tuiles OpenStreetMap et la bibliothèque Leaflet chargées en ligne (connexion Internet nécessaire pour l'affichage cartographique).

## Générer les installeurs

```bash
# Régénère les icônes (ico/icns/png) à partir de build/icon.png si tu la remplaces
npm run icons

# Génère l'installeur pour ta plateforme actuelle
npm run dist

# Ou cible une plateforme précise
npm run dist:win
npm run dist:mac
npm run dist:linux
```

Les installeurs sont produits dans `dist/`. Note : la génération d'un installeur macOS (`.dmg`) signé nécessite d'être lancée sur macOS ; sans machine Apple, tu peux tout de même construire les versions Windows et Linux depuis n'importe quel OS pris en charge par `electron-builder`. Le dépôt inclut aussi un workflow GitHub Actions (`.github/workflows/build.yml`) qui construit automatiquement les trois plateformes et les attache à une Release dès qu'un tag `v*` est poussé — voir plus bas.

## Structure du projet

```
main.js                processus principal Electron (fenêtre sans cadre, stockage disque, deux serveurs OBS, wiring SimConnect)
preload.js              pont sécurisé entre le processus principal et l'interface (stockage, fenêtre, tracker)
server.js               deux petits serveurs HTTP locaux : briefing (/obs, /api/state) et overlay live (/live, /api/live-state)
tracker.js               connexion SimConnect + machine à états de suivi de vol + segmentation des phases (fin de vol et en direct) + recherche d'aéroport le plus proche
renderer/
  index.html             interface principale (titlebar, Briefing, Logbook, Carrière, Outil Live, Outils, Admin, Profil)
  app.js                 logique de l'interface principale
  styles.css             styles de l'interface principale
  obs.html                page servie à OBS pour la carte de briefing, mise à jour en direct par polling
  live-overlay.html       page servie à OBS pour l'overlay de télémétrie live, mise à jour en direct par polling
  data/airports.json      aéroports (grands + moyens, ICAO/nom/lat/lon) pour le rapprochement auto au décollage/atterrissage
  data/runways.json       pistes par aéroport, pour le calcul de la zone de toucher des roues
build/
  icon.png / icon.ico / icon.icns   icônes de l'application
docs/
  index.html             page de téléchargement statique (GitHub Pages) — voir CONTRIBUTING.md
```

## Où sont stockées mes données ?

Dans un fichier `flightbrief-data.json`, dans le dossier de données de l'application propre à ton système d'exploitation (visible dans l'onglet **Admin** de l'application). Sauvegarde ce fichier si tu changes de machine.

## Partager le projet sur GitHub

Voir le guide pas-à-pas dans [CONTRIBUTING.md](CONTRIBUTING.md) pour publier ce dépôt et distribuer des installeurs à tes amis via les Releases GitHub.

## Licence

MIT — voir [LICENSE](LICENSE).

