// Tests v2.1 : traductions EN / ES des textes signalés restés en français, et du script de détection : node --test
const test = require('node:test');
const assert = require('node:assert');
const I = require('../renderer/i18n.js');
require('../renderer/i18n/translations.js');
const X = require('../scripts/i18n-extract.js');

// Textes tels qu'affichés (valeurs réelles à la place des parties variables).
const SHOWN = [
  '— Choisir —', 'Tous · 12', '↻ Actualiser depuis SimBrief', 'dans 12 min · 34 NM', '3/7 étapes', 'sur 12',
  "record d'affilée", 'Supprimer toutes ses données', 'Génération…', 'connecté', 'Connecter le compte de ma chaîne',
  'Sera appliqué à la chaîne kero.', 'Titre copié ✓', 'Envoi à Twitch…', 'Titre mis à jour sur Twitch ✓',
  'POSTE AÉRIENNE', 'Bons baisers de', 'Vol AFR123', 'À BORD · 3 PASSAGERS', 'Le commandant de bord',
  'Bons baisers de Lyon · 3 passagers.', "Envoyée sur l'overlay Alertes.", '🏠 Prochain survol :',
  '3 étapes · 1 234 NM', 'Event VATSIM à LFPG', 'Chargement des events…'
];

for (const lang of ['en', 'es']) {
  test(`${lang} : les textes signalés dans l'issue sont traduits`, () => {
    I.use(lang);
    const left = SHOWN.filter(s => I.tr(s) === s);
    I.use('fr');
    assert.deepStrictEqual(left, []);
  });
}

test('extraction : une regex avec apostrophe dans ${…} ne coupe pas la lecture du fichier', () => {
  const out = new Set();
  X.fromJs("const a = `<b>${x.replace(/'/g, '&#39;')}</b>`;\nconst b = 'Génération…';", out);
  assert.ok(out.has('Génération…'));
});
