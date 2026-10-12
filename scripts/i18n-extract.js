/* Liste les textes français de l'appli et signale ceux qui n'ont pas encore de traduction.
   node scripts/i18n-extract.js            -> résumé des textes manquants par langue
   node scripts/i18n-extract.js --json     -> toutes les clés (JSON) sur la sortie standard
   Les clés sont les textes FR tels qu'affichés ; « {0} », « {1} »… remplacent les parties
   variables (${…} des gabarits). Voir renderer/i18n.js pour la traduction à l'exécution. */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const FILES = [
  'renderer/index.html', 'renderer/app.js', 'renderer/v15.js', 'renderer/cabin-ui.js', 'renderer/v17.js', 'renderer/copilot.js', 'renderer/fb-shared.js',
  'renderer/alerts-overlay.html', 'renderer/cabin-overlay.html', 'renderer/live-overlay.html', 'renderer/obs.html',
  'renderer/mobile/index.html', 'renderer/mobile/mobile.js', 'renderer/mobile/setup.html',
  'renderer/public-logbook/index.html', 'renderer/public-logbook/app.js',
  'main.js', 'twitch.js', 'cabin.js', 'tracker.js', 'atc.js', 'shots.js', 'backups.js', 'public-logbook.js', 'predictions.js', 'checklists.js', 'suggest.js', 'mobile-tls.js'
];
const ATTRS = ['title', 'placeholder', 'aria-label', 'alt', 'data-label', 'data-tip', 'label', 'content'];
const STOP = new Set(('le la les de du des un une et ou pour sur à au aux en pas ne est sont dans par avec ton ta tes ce cette ces '
  + 'il elle on nous vous qui que quoi plus moins tout tous aucun aucune encore déjà ici si mais son sa ses leur vol vols').split(' '));

// Noms propres, polices, unités, classes CSS : rien à traduire.
const IGNORE = /^(\d[\d ]*\s?(ft|px|min|km|12px)|[A-Z][\w ]+ (Mono|Sans|Grotesk|Condensed|Petch)|Barlow.*|Rajdhani|Oswald|Poppins|Manrope|Roboto|Sora|Polygon|Stripe|Centurion|Lulu|Kéro|Pézenas|Val|Vario|Alt|Ctrl|Meta|End|Enter|Escape|Scrolllock|Android|Safari|Auto|Twitch( :)?|Bearer|Paris( CDG)?|Navigraph|Controller Examination|Aspen|Barra|Calvi|Courchevel|Gibraltar|Innsbruck|Lukla|Paro|Princess Juliana|Queenstown|Saba|Santos Dumont|Skiathos|Flight Wrapped|Toulouse Blagnac|Top of Descent|Microsoft Flight Simulator 2024|FlightBrief( local| Watch)?|\[FlightBrief\].*|feet per (minute|second)|invalid client|client secret|chat:read chat:edit|use strict|s ont|.*\b(hidden|show|small|hide-m|danger|err|ok|warn)$|[a-z-]+ [a-z0-9]+-|n dist|SIM ON GROUND.*|disabled title=.*|plane-marker v15|[a-z]+-vol[+-]|\d00 \d+px .*)$/;
// Un texte vaut traduction s'il ressemble à du français lisible (pas à du code, une classe CSS…).
function isText(s) {
  const bare = s.replace(/\{\d+\}/g, ' ').trim();
  if (!/\p{L}{2}/u.test(bare) || IGNORE.test(s)) return false;
  if (/^[\w.#:\-[\]=>*~+()"' ]+$/.test(bare) && /[#\[=]|\.[a-z]|^-|--/.test(bare) && !/\s\p{L}+\s/u.test(bare)) return false; // sélecteurs CSS
  if (/^(https?:|\/|\.\/|\.\.\/|data:|#[0-9a-f]{3,8}$)/i.test(bare)) return false;
  if (/^[a-z0-9_:\-.]+$/.test(bare)) return false;              // identifiants, clés
  if (/^[A-Z0-9 :_]+$/.test(bare)) return false;                 // variables SimConnect
  if (/(sans-serif|monospace|serif|Emoji)\b/.test(bare) || /\bctx\.|\$\(|=>|\bconst\b/.test(bare)) return false; // polices, code
  if (/^[A-Z0-9_]+$/.test(bare) && bare.length < 6) return false;  // ICAO, constantes
  if (/^(rgba?|hsla?|var|translate|rotate|scale|calc|url|linear-gradient)\(/.test(bare)) return false;
  if (/[;{}]/.test(bare) && /:\s*[\w#-]/.test(bare)) return false; // CSS en ligne
  if (/[àâäçéèêëîïôöùûüœæ«»]/i.test(bare)) return true;
  const words = bare.toLowerCase().split(/[^\p{L}']+/u).filter(Boolean);
  if (words.some(w => STOP.has(w)) && words.length > 1) return true;
  return /^[A-ZÀ-Ý][a-zà-ÿ]{2,}(\s[\p{L}'’-]+)*[\s.!?…:]*$/u.test(bare) || /\s/.test(bare) && /^[\p{L}\d'’ ,.!?…:()-]+$/u.test(bare);
}

// Découpe un morceau de HTML (avec {n} à la place des ${…}) en textes affichés + attributs.
function fromHtml(html, out) {
  html = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, ' ');
  const attrRe = new RegExp(`\\s(?:${ATTRS.join('|')})\\s*=\\s*("([^"]*)"|'([^']*)')`, 'gi');
  for (const m of html.matchAll(/<[a-z][^>]*>/gi)) {
    if (/^<meta/i.test(m[0]) && !/name="description"|property="og:/i.test(m[0])) continue;
    for (const a of m[0].matchAll(attrRe)) add(a[2] != null ? a[2] : a[3], out);
  }
  html.replace(/<[^>]*>/g, '\u0000').split('\u0000').forEach(t => add(decode(t), out));
}
function decode(s) { return s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&rsquo;/g, '’'); }
function add(s, out) {
  if (s == null) return;
  let t = String(s).replace(/\s+/g, ' ').trim();
  // Renumérote les variables dans l'ordre : « {3} vols sur {5} » -> « {0} vols sur {1} »
  let i = 0; t = t.replace(/\{\d+\}/g, () => `{${i++}}`);
  t = t.replace(/^(\{\d+\}\s*)+$/, '');
  if (t && t.length < 600 && isText(t)) out.add(t);
}

// Lexer JS minimal : chaînes '…', "…" et gabarits `…${…}…` (imbriqués), commentaires, regex.
function fromJs(src, out) {
  let i = 0, n = src.length, lastSig = '';
  const strings = [];
  function readTemplate() { // i sur le ` d'ouverture ; renvoie le texte avec {k}
    let s = '', k = 0; i++;
    while (i < n && src[i] !== '`') {
      if (src[i] === '\\') { s += src[i + 1] === 'n' ? '\n' : src[i + 1]; i += 2; continue; }
      if (src[i] === '$' && src[i + 1] === '{') {
        i += 2; let depth = 1;
        while (i < n && depth) {
          const c = src[i];
          if (c === '`') { const inner = readTemplate(); strings.push(inner); continue; }
          if (c === '"' || c === "'") { strings.push(readQuoted(c)); continue; }
          if (c === '{') depth++; else if (c === '}') depth--;
          i++;
        }
        s += `{${k++}}`; continue;
      }
      s += src[i++];
    }
    i++; return s;
  }
  function readQuoted(q) {
    let s = ''; i++;
    while (i < n && src[i] !== q) { if (src[i] === '\\') { s += src[i + 1] === 'n' ? '\n' : src[i + 1]; i += 2; continue; } if (src[i] === '\n') break; s += src[i++]; }
    i++; return s;
  }
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2); i = i < 0 ? n : i + 2; continue; }
    if (c === '/' && (/[(,=:[!&|?{};+\-*%<>~^]/.test(lastSig) || lastSig === '' || /\b(return|typeof|case)$/.test(src.slice(Math.max(0, i - 8), i).trim()))) {
      i++; let cls = false;
      while (i < n && src[i] !== '\n') { if (src[i] === '\\') { i += 2; continue; } if (src[i] === '[') cls = true; else if (src[i] === ']') cls = false; else if (src[i] === '/' && !cls) break; i++; }
      i++; lastSig = 'x'; continue;
    }
    if (c === '"' || c === "'") { strings.push(readQuoted(c)); lastSig = 'x'; continue; }
    if (c === '`') { strings.push(readTemplate()); lastSig = 'x'; continue; }
    if (!/\s/.test(c)) lastSig = /[\w$)\]]/.test(c) ? 'x' : c;
    i++;
  }
  for (const s of strings) { if (/<[a-z/][^>]*>/i.test(s)) fromHtml(s, out); else add(decode(s), out); }
}

function extract() {
  const out = new Set();
  for (const rel of FILES) {
    let src; try { src = fs.readFileSync(path.join(root, rel), 'utf-8'); } catch (e) { continue; }
    if (rel.endsWith('.html')) {
      fromHtml(src, out);
      for (const m of src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) fromJs(m[1], out);
    } else fromJs(src, out);
  }
  return [...out].sort();
}

if (require.main === module) {
  const keys = extract();
  if (process.argv.includes('--json')) { process.stdout.write(JSON.stringify(keys, null, 1)); process.exit(0); }
  const I = require(path.join(root, 'renderer', 'i18n.js'));
  require(path.join(root, 'renderer', 'i18n', 'translations.js'));
  for (const [lang, col] of [['en', 1], ['es', 2]]) {
    const have = new Set(I.rows().filter(r => (r[col] || '').trim()).map(r => r[0].trim()));
    const missing = keys.filter(k => !have.has(k));
    console.log(`${lang} : ${keys.length - missing.length}/${keys.length} textes traduits`);
    missing.slice(0, 40).forEach(k => console.log('   - ' + k));
    if (missing.length > 40) console.log(`   … et ${missing.length - 40} autres (--json pour tout lister)`);
  }
}
module.exports = { extract, isText, fromHtml, fromJs };
