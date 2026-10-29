/* =========================================================
   FlightBrief — paquet Microsoft Store (MSIX) : npm run dist:store
   ---------------------------------------------------------
   Reprend la config "build" de package.json (fichiers, icônes…) et remplace seulement la
   cible Windows : paquet MSIX pour Partner Center, à la place de l'installeur NSIS de GitHub.
   • Identité du produit : build/store-identity.json (valeurs de Partner Center).
   • Tuiles du menu Démarrer / de la fiche Store : build/appx/*.png.
   • Pas de publication GitHub ni de mise à jour intégrée : c'est le Store qui met à jour
     (l'appli le détecte avec process.windowsStore, voir main.js).
   • Le paquet n'est pas signé ici : le Store le signe à la publication.
   ========================================================= */
const path = require('path');
const pkg = require('../package.json');
const id = require('./store-identity.json');

module.exports = {
  ...pkg.build,
  publish: null,
  win: { ...pkg.build.win, target: [{ target: 'appx', arch: ['x64'] }] },
  appx: {
    identityName: id.identityName,
    publisher: id.publisher,
    publisherDisplayName: id.publisherDisplayName,
    applicationId: 'FlightBrief',
    displayName: 'FlightBrief',
    backgroundColor: '#0a0d11',
    showNameOnTiles: false,
    languages: ['fr-FR', 'en-US', 'es-ES'],
    artifactName: 'FlightBrief-Store-${version}.msix'
  },
  directories: { ...(pkg.build.directories || {}), buildResources: path.join(__dirname) }
};
