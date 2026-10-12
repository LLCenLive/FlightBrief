/* =========================================================
   FlightBrief — journal des nouveautés (affiché dans l'appli)
   ---------------------------------------------------------
   Une entrée par version, la plus récente EN PREMIER. À chaque release :
   ajoute une entrée ici avant de lancer `npm run dist:win`. Au premier lancement
   après une mise à jour, l'appli affiche toutes les entrées comprises entre la
   version précédemment utilisée (exclue) et la version installée (incluse).
   Types de lignes : 'new' (nouveauté), 'improved' (amélioration), 'fix' (correctif).
   ========================================================= */
window.FB_CHANGELOG = [
  {
    version: '1.7.0',
    date: '2026-10-12',
    title: 'À bord : le chat voyage avec toi',
    items: [
      ['new', "Nouvel onglet « À bord » : les viewers montent à bord de tes vols avec !embarquer et gagnent des miles tant qu'ils sont actifs dans le chat. Statuts Membre, Argent, Or, Platine et Légende, et classement des fidèles."],
      ['new', "Passeport : chaque atterrissage tamponne le passeport des passagers (aéroport, ville, pays). !passeport pour le consulter, !miles pour son statut."],
      ['new', "Correspondances : enchaîne les vols sans en rater un pour cumuler un bonus de miles. !voyage montre le trajet en cours (Paris → Toulouse → Madrid…)."],
      ['new', "Survol de chez les viewers : chacun donne sa ville (!maville Lyon). L'appli annonce au décollage les survols prévus, prévient quelques minutes avant, puis « On survole chez Kéro ! » sur l'overlay et dans le chat."],
      ['new', "Animations de croisière : vue du hublot (ville et pays survolés), annonce de chaque nouveau pays, quiz du hublot (!rep) et pronostic de l'heure d'arrivée (!arrivee 21:47)."],
      ['new', "Carte postale à chaque arrivée : ta capture d'atterrissage, la carte du trajet, la ville d'arrivée et la liste des passagers. Elle s'affiche sur l'overlay Alertes et dans le détail du vol."],
      ['new', "Titre du stream proposé au lancement du vol, à partir de ton briefing. Tu le modifies, et rien n'est envoyé à Twitch sans ta validation."],
      ['new', "Carnet de vol public : un mini-site statique (vols, carte, passagers, passeports, cartes postales) à publier sur GitHub Pages. Aucune connexion vers ton PC, pas de ville de viewer publiée, et !passeport cacher pour se retirer."],
      ['new', "4e source OBS « À bord » : le manifeste des passagers en direct, avec le prochain survol et le quiz en cours."],
      ['new', "FlightBrief parle anglais et espagnol : interface, overlays OBS, appli mobile, carnet public et messages du bot. Choix de la langue dans l'onglet Profil."],
      ['new', "Prédictions Twitch : en plus de !pari, ton chat mise ses points de chaîne sur une tranche de taux de toucher, ouverte et fermée avec les paris (chaîne Affiliée ou Partenaire)."],
      ['improved', "Commandes du chat aussi en anglais et en espagnol (!board, !bet, !mycity, !embarcar, !apuesta…)."],
      ['new', "Pas de live ? Profil → « Je fais des lives » : désactivé, les onglets Outil Live, Twitch et À bord disparaissent et le bot est coupé. Demandé au premier lancement."],
      ['new', "Copilote vocal (Briefing) : décollage, montée, croisière, approche stabilisée, minimums, radiosonde 50-40-30-20-10 (« Retard » sur Airbus), alertes façon GPWS, annonces cabine et point de situation. Catégories, voix et débit au choix."],
      ['new', "EFB sur téléphone ou tablette : carte avec l'ATC VATSIM / IVAO, plan de vol SimBrief et cartes d'aéroport, mise en page tablette."],
      ['new', "« Où voler aujourd'hui ? » (Outils) : 3 destinations selon ton temps, ton avion, la météo réelle, l'ATC en ligne et les events VATSIM — terrains jamais visités ou tes préférés —, avec ouverture dans SimBrief."],
      ['new', "Cartes d'aéroport en un clic (ChartFox, Navigraph, SkyVector…) sous le départ et l'arrivée du Briefing."],
      ['new', "Profil : Flight Wrapped (ton année + image à partager), gratte-pays et défis des aéroports les plus redoutés."],
      ['new', "Import d'historique (Logbook) : Little Navmap, Volanta ou tableur, colonnes détectées toutes seules, sans doublons."],
      ['new', "Plugin Stream Deck (Profil → Stream Deck) : tracker, capture, copilote, infos de vol sur les touches, molettes du Stream Deck +. Installé d'un clic."],
      ['fix', "Miles et paris : sauvegarde sûre (copie de secours), plus aucune perte si l'ordinateur s'éteint pendant l'écriture."],
      ['fix', "Le message d'arrivée annonçait 100 miles de trop pour le meilleur passager."],
      ['fix', "L'export du carnet public ne supprime plus que ses propres cartes postales."]
    ]
  },
  {
    version: '1.6.2',
    date: '2026-10-11',
    title: 'Patch : volumes, fluidité & allègement',
    items: [
      ['fix', "Les curseurs de volume fonctionnent enfin à chaque réglage (alerte du tracker, son de capture, alertes OBS) : avant, seul le premier changement était pris en compte."],
      ['improved', "Nouveau son pour le rappel « tracker non lancé » : un carillon doux façon appel cabine, à la place des bips stridents."],
      ['improved', "Zoom fluide sur le globe du Profil et sur l'approche 3D : la molette glisse en douceur au lieu d'avancer par à-coups."],
      ['improved', "Carte du Briefing bien plus fluide au zoom : secteurs ATC, cercles d'approche et route dessinés en accéléré, badges ATC affichés seulement autour de la vue (de simples points quand on dézoome), plus d'à-coups quand le suivi recentre la carte."],
      ['improved', "Moins de charge pour ton PC pendant que tu voles : le globe et l'approche 3D ne se redessinent plus quand rien ne bouge."],
      ['improved', "Lancement plus rapide et 100 % hors ligne : les moteurs carte et 3D sont désormais inclus dans l'appli (plus de téléchargement au démarrage)."],
      ['improved', "Ménage dans le code : styles et fonctions inutilisés retirés."]
    ]
  },
  {
    version: '1.6.1',
    date: '2026-10-10',
    title: 'Patch : alertes sur mesure, captures & profil',
    items: [
      ['new', "Cartes d'événement personnalisables comme l'overlay live : couleur et titre propres à chaque type de carte (atterrissage, paris, succès, réponse du bot), couleur et épaisseur de bordure, fond en dégradé, taille du texte."],
      ['new', "Option « Assortir à mon overlay live » : les alertes reprennent les couleurs, la police, les arrondis, la bordure, l'ombre et le flou de ton overlay, et suivent ses changements."],
      ['new', "Réglages des captures dans une fenêtre dédiée (⚙ à côté du bouton de capture, ou Admin) : nouveau raccourci en une touche avec un vrai enregistreur, retour au raccourci par défaut, captures automatiques activables d'un clic (bouton « Auto » dans le Briefing)."],
      ['improved', "Volumes réglables pour de vrai : le curseur suit l'oreille (50 % s'entend nettement moins fort) et le son est joué quand tu relâches le curseur, pour l'alerte du tracker, le son des alertes OBS et le son de capture."],
      ['improved', "Nouveau son de capture : un petit « tic » doux à la place du bruit qui faisait sursauter, avec son propre volume."],
      ['improved', "Onglet Profil : ton prénom (ou ton pseudo Twitch) et l'icône de ton rang, au lieu du chiffre qui ressemblait à une notification."],
      ['fix', "Enregistrer un raccourci comme Ctrl+1 ne change plus d'onglet, et l'ancien raccourci ne bloque plus l'enregistrement du nouveau."]
    ]
  },
  {
    version: '1.6.0',
    date: '2026-10-10',
    title: 'Captures, rangs & overlays à ta façon',
    items: [
      ['new', "Captures d'écran de tes vols : bouton dans le Briefing, raccourci clavier global (Ctrl+Alt+F12 par défaut, utilisable pendant que le simulateur a le focus) et captures automatiques au décollage, en croisière et à l'atterrissage. Elles sont rattachées au vol enregistré : galerie depuis le logbook (📷) et dans le détail du trajet."],
      ['new', "Rappel « tracker non lancé » : si l'avion roule ou vole alors que le suivi est arrêté, une alerte sonore et un bandeau te préviennent, avec un bouton pour le lancer. Le tracker peut aussi démarrer tout seul (Admin)."],
      ['new', "Design des alertes du bot (succès, paris, atterrissage…) entièrement personnalisable : 5 thèmes, couleurs, police, largeur, arrondis, animation, ombre, flou, son, avec un aperçu en direct."],
      ['new', "Outil Live : réordonne les blocs de l'overlay par glisser-déposer, choisis le coin de l'écran où il s'affiche, ou passe en mode « Libre » pour placer chaque bloc où tu veux sur une scène 1920×1080, avec magnétisme et guides."],
      ['new', "Rangs FlightBrief : chaque succès et chaque vol rapporte de l'XP, avec 9 rangs de « Élève pilote » à « Légende de l'air ». Ton niveau s'affiche à côté de l'onglet Profil."],
      ['new', "67 succès (au lieu de 26), classés en bronze, argent, or et platine : réseaux VATSIM et IVAO, vols contrôlés par l'ATC, stream et bot Twitch, captures, flotte… Ils se consultent dans une fenêtre dédiée, avec des filtres et la progression de chacun."],
      ['improved', "Appli plus réactive : les sauvegardes du logbook se font en arrière-plan au lieu de bloquer l'interface à chaque clic, et l'aperçu de l'overlay n'est plus recalculé quand l'onglet Outil Live est fermé."],
      ['improved', "Touche Échap pour fermer la galerie, la visionneuse et la fenêtre des succès ; flèches ← → pour passer d'une capture à l'autre."]
    ]
  },
  {
    version: '1.5.0',
    date: '2026-10-10',
    title: 'Twitch, atterrissages notés & approche en 3D',
    items: [
      ['new', "Nouvel onglet Twitch : un bot répond dans ton chat à !eta, !route, !metar, !avion, !alt, !landing et !fb, avec le nom que tu lui donnes. Chaque streamer utilise sa propre application Twitch, déclarée en 2 minutes grâce à un assistant intégré. Sans compte connecté, le bot lit le chat et répond sur l'overlay."],
      ['new', "Paris d'atterrissage : le chat devine ton taux au toucher avec !pari 180. Ouverture au début de la descente, fermeture en courte finale, podium à l'écran et classement (!top)."],
      ['new', "3e source OBS « Alertes » (localhost:4814/alerts) : carte d'atterrissage, paris, succès débloqués et réponses du bot, avec position, durée et taille réglables."],
      ['new', "Atterrissage mesuré précisément : vitesse verticale exacte à l'impact (lue dans le simulateur), facteur G, vent et vent traversier sur la piste, et une note de A+ à F."],
      ['new', "Début de descente (TOD) et heure d'arrivée (ETA) en direct, calculés le long de la route de l'OFP SimBrief. Ils s'affichent dans le Briefing et peuvent être ajoutés à l'overlay live."],
      ['new', "Approche finale rejouée en 3D dans le détail de chaque vol, comparée au plan de descente de 3°, avec plusieurs vues et un relief accentué."],
      ['new', "26 succès à débloquer dans le Profil (beurre, vol de nuit, globe-trotter, tour du monde…), avec une animation dans l'appli et sur le stream."],
      ['new', "ATC en ligne VATSIM et IVAO sur la carte du Briefing : secteurs des centres, cercles d'approche et badges d'aéroport (ATIS, sol, tour, approche). Un clic donne le détail, et la liste en dessous montre tes aéroports de départ et d'arrivée."],
      ['new', "Sauvegardes automatiques : une copie par jour, les 7 dernières gardées, restauration automatique si le fichier de données devient illisible (Admin → Sauvegardes)."],
      ['new', "Mise à jour en un clic : la nouvelle version se télécharge et s'installe depuis l'appli."],
      ['improved', "Nouvelles icônes d'avion sur les cartes (PC et téléphone), au choix dans Admin : avion de ligne, silhouette, aviation légère ou flèche."],
      ['improved', "Logbook : colonne « Atterro » avec la note de chaque vol, et la colonne Durée est de nouveau alignée."],
      ['improved', "Barre de navigation rangée par usage (Vol · Carnet · Stream), avec des icônes, Profil et Admin à droite, et les raccourcis Ctrl+1 à Ctrl+9."],
      ['improved', "Carte du Briefing : route prévue avec départ, arrivée, TOC et TOD, bouton « Vol entier », plein écran, bandeau de vol sur la carte (phase, altitude, vitesse, TOD, ETA), zoom plus fin, légende ATC et raccourcis F / V / P."],
      ['fix', "Compagnon mobile : la barre d'onglets touche de nouveau le bas de l'écran sur iPhone (appli installée)."],
      ['fix', "Overlay live : les libellés personnalisés et les textes libres s'affichent maintenant aussi dans OBS, pas seulement dans l'aperçu."]
    ]
  },
  {
    version: '1.3.4',
    date: '2026-09-30',
    title: 'OFP SimBrief, suivi de la carte & mises à jour',
    items: [
      ['new', "Récupération de l'OFP du plan de vol actif SimBrief, lisible directement dans l'appli (copie locale consultable hors ligne, PDF, copie du texte)."],
      ['new', "Pop-up quand une nouvelle version de FlightBrief est disponible, avec lien vers la page de téléchargement."],
      ['new', "Fenêtre « Quoi de neuf » au premier lancement après une mise à jour (et consultable à tout moment depuis Admin → À propos)."],
      ['new', "Carte du vol en direct : bouton pour suivre ou non l'avion. Déplacer la carte à la main coupe le suivi."],
      ['improved', "Schéma de piste du rapport de vol : marquages de seuil, zone de toucher (TDZ) et point de visée à l'échelle, aussi affiché sur le compagnon mobile."],
      ['fix', "Compagnon mobile : la barre d'onglets reste désormais figée en bas de l'écran pendant le défilement (iPhone / appli installée)."]
    ]
  }
];
