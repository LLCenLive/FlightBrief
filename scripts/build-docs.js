/* Génère les pages du site en anglais et en espagnol (docs/en/, docs/es/) à partir des pages
   françaises (la source) : docs/index.html et docs/fonctionnalites.html — node scripts/build-docs.js
   Le texte est traduit dans le HTML lui-même (lisible par les moteurs de recherche) ; les textes
   ajoutés par le script de la page (version, taille…) sont traduits au chargement par i18n.js.
   Textes sans traduction : listés à la fin — à ajouter dans docs/translations.js. */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const I18N = require(path.join(root, 'renderer', 'i18n.js'));
require(path.join(root, 'renderer', 'i18n', 'translations.js'));
require(path.join(root, 'docs', 'translations.js'));

const ATTRS = /(\s(?:title|alt|aria-label|placeholder|content)=")([^"]*)(")/g;
const decode = s => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&rsquo;/g, '’');
const encode = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const { isText } = require('./i18n-extract.js');
const PAGES = ['index.html', 'fonctionnalites.html'];
// Liens vers une autre page du site : restent dans le dossier de la langue ; le reste remonte d'un cran.
const relUrl = u => /^(https?:|#|\/|mailto:|data:|\.\.\/)/.test(u) || PAGES.some(p => u === p || u.startsWith(p + '#')) ? u : '../' + u.replace(/^\.\//, '');

function translate(html, lang) {
  I18N.use(lang);
  const missing = new Set();
  const tr = (raw, isAttr) => {
    const txt = decode(raw), core = txt.trim().replace(/\s+/g, ' ');
    if (!/\p{L}{2}/u.test(core)) return raw;
    const out = I18N.tr(txt);
    if (out === txt) { if (isText(core)) missing.add(core); return raw; }
    return isAttr ? encode(out).replace(/"/g, '&quot;') : encode(out);
  };
  // Les blocs <script>/<style> et les zones data-no-i18n restent tels quels.
  const parts = html.split(/(<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<div class="lang-switch"[\s\S]*?<\/div>)/i);
  html = parts.map((p, i) => {
    if (i % 2) return p;
    return p
      .replace(/<[a-z][^>]*>/gi, tag => tag.replace(ATTRS, (m, a, v, b) => /^(text\/|width=|#|https?:|[\w.-]+\.(png|jpg|svg)$)/.test(v) ? m : a + tr(v, true) + b))
      .replace(/>([^<]+)</g, (m, t) => '>' + tr(t) + '<');
  }).join('');
  html = html
    .replace('<html lang="fr">', `<html lang="${lang}">`)
    .replace(/(\s(?:src|href)=")([^"]+)(")/g, (m, a, u, b) => a + relUrl(u) + b)
    .replace(/(property="og:image" content=")([^"]+)(")/, (m, a, u, b) => a + relUrl(u) + b)
    .replace(/<div class="lang-switch"[\s\S]*?<\/div>/, sw => sw.replace(/ aria-current="page"/g, '').replace(`hreflang="${lang}" lang="${lang}"`, `hreflang="${lang}" lang="${lang}" aria-current="page"`))
    // Textes ajoutés par le script de la page : traduits au chargement.
    .replace('</head>', `<script src="../i18n.js"></script>\n<script src="../translations.js"></script>\n<script>FBI18N.use(${JSON.stringify(lang)}); FBI18N.start(document);</script>\n</head>`);
  return { html, missing };
}

fs.copyFileSync(path.join(root, 'renderer', 'i18n.js'), path.join(root, 'docs', 'i18n.js'));
let allMissing = new Set();
for (const page of PAGES) {
  const src = fs.readFileSync(path.join(root, 'docs', page), 'utf-8');
  for (const lang of ['en', 'es']) {
    const { html, missing } = translate(src, lang);
    fs.mkdirSync(path.join(root, 'docs', lang), { recursive: true });
    fs.writeFileSync(path.join(root, 'docs', lang, page), html);
    missing.forEach(m => allMissing.add(`[${lang}] ${m}`));
    console.log(`docs/${lang}/${page} générée`);
  }
}
if (allMissing.size) { console.log(`\nSans traduction (${allMissing.size}) :`); allMissing.forEach(m => console.log('  ' + m)); }

// Notes de la dernière version : sur les pages EN / ES, le « Quoi de neuf » et le badge du haut les
// traduisent ligne à ligne au chargement (voir renderNews dans docs/index.html). Il faut donc que
// chaque titre et chaque texte ait sa ligne dans docs/translations.js, sinon le badge se contente
// d'annoncer la version.
const notes = fs.readdirSync(root).map(f => f.match(/^RELEASE_NOTES_v(\d+)\.(\d+)\.(\d+)\.md$/)).filter(Boolean)
  .sort((a, b) => (+b[1] - +a[1]) || (+b[2] - +a[2]) || (+b[3] - +a[3]))[0];
if (notes) {
  const page = fs.readFileSync(path.join(root, 'docs', 'index.html'), 'utf-8');
  const parseReleaseNotes = new Function(page.match(/function parseReleaseNotes[\s\S]*?\n}\n/)[0] + 'return parseReleaseNotes;')();
  const items = parseReleaseNotes(fs.readFileSync(path.join(root, notes[0]), 'utf-8'));
  const left = new Set();
  for (const lang of ['en', 'es']) {
    I18N.use(lang);
    items.forEach(it => [it.title, it.text].forEach(s => { if (I18N.tr(s) === s && (s === it.text || /[à-ÿ]/i.test(s))) left.add(`[${lang}] ${s}`); }));
  }
  console.log(left.size ? `\n${notes[0]} : lignes sans traduction dans docs/translations.js (${left.size}) :` : `\n${notes[0]} : notes traduites en anglais et en espagnol ✓`);
  left.forEach(m => console.log('  ' + m));
}
