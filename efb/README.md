# Appli FlightBrief pour l'EFB de MSFS 2024

Ajoute « FlightBrief » à la tablette (EFB) de tous les avions de Microsoft Flight Simulator 2024.
L'appli affiche la page que FlightBrief sert sur le PC (`http://127.0.0.1:4814/efb`), avec les mêmes
rubriques que l'appli : Briefing (vol, progression, météo, route, notes, ATC en ligne, amis, OFP SimBrief),
Logbook (statistiques, vols, fiche de chaque vol), Carrière (grade, progression, tours) et Live (bot Twitch,
paris d'atterrissage, passagers « À bord », classement des miles, chat). FlightBrief doit tourner pendant le vol.
Données : `efb-data.js` (logbook, carrières, OFP) et `efbState()` dans `main.js` (briefing, vol, live).

## Installation (utilisateurs)

FlightBrief → **Profil** → **🛫 EFB de MSFS 2024** → **Installer l'appli EFB**, puis relancer le simulateur.
L'appli construit le paquet `llcenlive-efb-flightbrief` (voir `efb-package.js`) et le dépose dans le
dossier Community trouvé dans `UserCfg.opt` (Steam ou Microsoft Store / Xbox). Sans dossier trouvé,
ou depuis la version Microsoft Store de FlightBrief (qui ne peut pas écrire dans le dossier du
simulateur), le paquet est préparé dans `Téléchargements/FlightBrief`, à glisser dans Community.

## Développement (SDK MSFS 2024)

1. MSFS 2024 → Options → Général → Développeurs → **Mode développeur**.
2. Barre du mode développeur → **File → Open project…** → `efb/FlightBriefEfbProject.xml`.
3. **Build All In Project**, puis lancer un vol avec un avion équipé d'un EFB.

Ne pas garder en même temps le paquet installé dans Community : l'appli serait chargée deux fois.

Le nom interne `FlightBriefEfb` doit rester identique partout : nom du fichier `.js`, son dossier,
`INTERNAL_NAME` dans le script et le dossier `html_ui/efb_ui/efb_apps/FlightBriefEfb` du paquet.

Le navigateur de l'EFB (Coherent GT) est ancien : la page `renderer/efb-sim/` est écrite en
JavaScript ES5 et en CSS simple (pas de variables CSS, de grid, de gap ni de calc).

# Version Microsoft Store de FlightBrief (MSIX)

1. Partner Center : réserver le nom de l'appli, puis recopier **Product identity** dans
   `build/store-identity.json` (identityName, publisher, publisherDisplayName).
2. `npm run dist:store` → `dist/FlightBrief-Store-<version>.msix`, à envoyer dans la soumission.
   Le paquet n'est pas signé : le Store le signe à la publication.

Dans la version Store, l'appli ne télécharge pas ses mises à jour (c'est le Store qui le fait), et
ce qui doit être ouvert par un autre logiciel (plugin Stream Deck, paquet EFB) est écrit dans
Téléchargements : ce qu'une appli MSIX écrit dans AppData reste privé.
