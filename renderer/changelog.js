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
