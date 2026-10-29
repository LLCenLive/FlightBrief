/* Vérification avant "npm run dist:store" : identité Partner Center renseignée, tuiles présentes,
   numéro de version accepté par le Store. Les fichiers de données sont vérifiés par check-build.js. */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
let bad = 0;
const fail = m => { bad++; console.error('[check-store] ' + m); };

const id = JSON.parse(fs.readFileSync(path.join(root, 'build', 'store-identity.json'), 'utf-8'));
for (const k of ['identityName', 'publisher', 'publisherDisplayName']) {
  if (!id[k] || /A_REMPLIR/.test(id[k])) fail(`build/store-identity.json : « ${k} » à recopier depuis Partner Center (Product identity).`);
}
if (id.publisher && !/A_REMPLIR/.test(id.publisher) && !/^CN=/.test(id.publisher)) fail('build/store-identity.json : « publisher » commence par CN= (copie-le tel quel depuis Partner Center).');

for (const f of ['StoreLogo.png', 'Square44x44Logo.png', 'Square150x150Logo.png', 'Wide310x150Logo.png']) {
  if (!fs.existsSync(path.join(root, 'build', 'appx', f))) fail(`build/appx/${f} manquant (tuile du menu Démarrer / du Store).`);
}
// Le Store veut 4 nombres, le dernier à 0 (1.9.0.0) : electron-builder ajoute « .0 » à une version x.y.z.
const v = require(path.join(root, 'package.json')).version;
if (!/^\d+\.\d+\.\d+$/.test(v)) fail(`version « ${v} » : le Store n'accepte que x.y.z (sans suffixe -beta…).`);

if (bad) { console.error(`\n[check-store] ${bad} problème(s) : paquet Store non construit.`); process.exit(1); }
console.log('[check-store] OK — identité Store et tuiles présentes.');
