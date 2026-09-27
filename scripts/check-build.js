/* Vérification avant "npm run dist" : sans ces fichiers, electron-builder produit quand même
   un installeur… mais sans aéroports (globe vide, départ/arrivée non détectés) ou avec
   l'icône Electron par défaut. On préfère arrêter le build avec un message clair. */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const need = [
  ['renderer/data/airports.json', "index des aéroports (globe, distances, détection départ/arrivée)"],
  ['renderer/data/runways.json', 'pistes (analyse du toucher des roues)'],
  ['renderer/data/coastlines.json', 'tracé des côtes du globe'],
  ['build/icon.ico', "icône Windows de l'appli et de l'installeur"],
  ['build/icon.png', 'icône de la fenêtre et de la barre de titre']
];
let missing = 0;
for (const [rel, what] of need) {
  const p = path.join(root, rel);
  let ok = false;
  try { ok = fs.statSync(p).size > 0; } catch (e) { ok = false; }
  // Icône générée par "npm run icons" (build/icons/...) : on la recopie au bon endroit.
  if (!ok && rel === 'build/icon.ico') {
    const alt = path.join(root, 'build', 'icons', 'icon.ico');
    if (fs.existsSync(alt)) { fs.copyFileSync(alt, p); ok = true; console.log(`[check-build] ${rel} recopiée depuis build/icons/icon.ico`); }
  }
  if (!ok) { missing++; console.error(`[check-build] MANQUANT : ${rel} — ${what}`); }
}
if (missing) {
  console.error(`\n[check-build] ${missing} fichier(s) manquant(s) : build annulé. Copie-les depuis le zip FlightBrief (mêmes dossiers) puis relance.`);
  process.exit(1);
}
console.log('[check-build] OK — données et icônes présentes.');
