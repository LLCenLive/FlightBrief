/* =========================================================
   FlightBrief — villes du monde (v1.7)
   ---------------------------------------------------------
   Index local des villes (renderer/data/cities.json, d'après GeoNames, CC BY 4.0) :
   toutes les communes de plus de 1 000 habitants des pays francophones, et les villes
   de plus de 15 000 habitants ailleurs. Format compact : [nom, pays, lat, lon, pop/100].
   Sert à : !maville (géocodage hors ligne), « Vue du hublot » (ville survolée, pays),
   noms de villes des aéroports (titre du stream, carte postale).
   Aucune requête réseau.
   ========================================================= */
const fs = require('fs');
const path = require('path');

let cities = null;        // [{ name, cc, lat, lon, pop, key }]
let grid = null;          // "lat|lon" (cases de 1°) -> [index]
let byKey = null;         // nom normalisé -> [index] (du plus peuplé au moins peuplé)
let loadError = null;

const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/^(saint|sainte)[\s-]/, m => m.startsWith('sainte') ? 'ste ' : 'st ')
  .replace(/[\s-](saint|sainte)[\s-]/g, m => m.includes('sainte') ? ' ste ' : ' st ')
  .replace(/['’`.]/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();

function load(rendererDir) {
  if (cities || loadError) return cities;
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(rendererDir, 'data', 'cities.json'), 'utf-8'));
    cities = raw.map(r => ({ name: r[0], cc: r[1], lat: r[2], lon: r[3], pop: (r[4] || 0) * 100 }));
    grid = new Map(); byKey = new Map();
    cities.forEach((c, i) => {
      const g = Math.floor(c.lat) + '|' + Math.floor(c.lon);
      if (!grid.has(g)) grid.set(g, []);
      grid.get(g).push(i);
      c.key = norm(c.name);
      if (!byKey.has(c.key)) byKey.set(c.key, []);
      byKey.get(c.key).push(i); // le fichier est trié par population décroissante
    });
  } catch (e) { loadError = e.message || String(e); cities = null; }
  return cities;
}

const R_KM = 6371;
function distKm(lat1, lon1, lat2, lon2) {
  const toR = Math.PI / 180, dLat = (lat2 - lat1) * toR, dLon = (lon2 - lon1) * toR;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toR) * Math.cos(lat2 * toR) * Math.sin(dLon / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}
function bearingDeg(lat1, lon1, lat2, lon2) {
  const toR = Math.PI / 180, y = Math.sin((lon2 - lon1) * toR) * Math.cos(lat2 * toR);
  const x = Math.cos(lat1 * toR) * Math.sin(lat2 * toR) - Math.sin(lat1 * toR) * Math.cos(lat2 * toR) * Math.cos((lon2 - lon1) * toR);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// Villes dans un rayon (km), triées par distance.
function around(lat, lon, radiusKm, minPop) {
  if (!cities) return [];
  const dLat = Math.ceil(radiusKm / 111) , dLon = Math.ceil(radiusKm / (111 * Math.max(0.15, Math.cos(lat * Math.PI / 180))));
  const out = [];
  for (let a = Math.floor(lat) - dLat; a <= Math.floor(lat) + dLat; a++) {
    for (let o = Math.floor(lon) - dLon; o <= Math.floor(lon) + dLon; o++) {
      const cell = grid.get(a + '|' + (((o + 180) % 360 + 360) % 360 - 180));
      if (!cell) continue;
      for (const i of cell) {
        const c = cities[i];
        if (minPop && c.pop < minPop) continue;
        const d = distKm(lat, lon, c.lat, c.lon);
        if (d <= radiusKm) out.push({ ...c, distKm: d });
      }
    }
  }
  return out.sort((x, y) => x.distKm - y.distKm);
}
function nearest(lat, lon, maxKm, minPop) {
  for (const r of [25, 60, 120, maxKm || 250]) {
    const list = around(lat, lon, r, minPop);
    if (list.length) return list[0];
    if (r >= (maxKm || 250)) break;
  }
  return null;
}
// Ville « remarquable » vue du hublot : compromis taille / proximité.
// Avec le cap de l'avion, on privilégie ce qui est devant ou sur le côté plutôt que derrière.
function notable(lat, lon, hdg) {
  const list = around(lat, lon, 90, 20000);
  if (!list.length) return null;
  const behind = c => hdg == null ? 1 : (Math.abs(((bearingDeg(lat, lon, c.lat, c.lon) - hdg + 540) % 360) - 180) > 110 ? 0.25 : 1);
  return list.map(c => ({ c, s: c.pop / Math.pow(c.distKm + 12, 2) * behind(c) })).sort((a, b) => b.s - a.s)[0].c;
}
// Ville « de référence » d'un aéroport : la grande ville proche plutôt que la commune voisine
// (Marseille pour LFML, pas Marignane ; Paris pour LFPG, pas Roissy).
function cityOf(lat, lon) {
  const list = around(lat, lon, 40, 5000);
  if (list.length) return list.map(c => ({ c, s: c.pop / Math.pow(c.distKm + 6, 2) })).sort((a, b) => b.s - a.s)[0].c;
  return nearest(lat, lon, 60);
}
// Pays sous l'avion : celui de la ville la plus proche (null au-dessus de la mer / loin de tout).
function countryAt(lat, lon) {
  const c = nearest(lat, lon, 140);
  return c && c.distKm <= 140 ? c.cc : null;
}

// Géocodage de « !maville » : « Lyon », « Valence ES », « Saint-Malo », « Kingston, CA »…
function geocode(query) {
  if (!cities) return null;
  let q = String(query || '').trim().slice(0, 60);
  let cc = null;
  const m = q.match(/^(.*?)[\s,]+\(?([A-Za-z]{2})\)?$/);
  if (m && m[1].length >= 2) {
    const code = m[2].toUpperCase();
    if (countryName(code) !== code) { q = m[1]; cc = code; }
  }
  let key = norm(q);
  if (!key) return null;
  // Noms français des grandes villes étrangères (GeoNames donne le nom local ou anglais).
  const exo = _exoGet(key, cc);
  if (exo && (!cc || cc === exo[1])) { key = norm(exo[0]); cc = exo[1]; }
  let ids = byKey.get(key) || [];
  if (!ids.length) {
    // Tolérance : « st etienne » / « saint etienne », tirets, etc. sont déjà normalisés ;
    // sinon on cherche un nom qui commence par la saisie (« Clermont » -> Clermont-Ferrand).
    for (const [k, v] of byKey) { if (k.startsWith(key + ' ')) { ids = ids.concat(v); } }
    ids.sort((a, b) => cities[b].pop - cities[a].pop);
  }
  if (cc) ids = ids.filter(i => cities[i].cc === cc);
  if (!ids.length) return null;
  // Préférence aux pays francophones à population égale ou proche (public de la chaîne).
  const FR = new Set(['FR', 'BE', 'CH', 'LU', 'MC', 'CA']);
  const best = ids.map(i => cities[i]).sort((a, b) => (b.pop * (FR.has(b.cc) ? 3 : 1)) - (a.pop * (FR.has(a.cc) ? 3 : 1)))[0];
  return { name: best.name, cc: best.cc, lat: best.lat, lon: best.lon, pop: best.pop };
}

const EXONYMS = Object.fromEntries(Object.entries({
  'Bruxelles': ['Brussels', 'BE'], 'Anvers': ['Antwerpen', 'BE'], 'Gand': ['Gent', 'BE'], 'Bruges': ['Brugge', 'BE'], 'Malines': ['Mechelen', 'BE'], 'Louvain': ['Leuven', 'BE'], 'Ostende': ['Oostende', 'BE'],
  'Bâle': ['Basel', 'CH'], 'Zurich': ['Zürich', 'CH'], 'Berne': ['Bern', 'CH'],
  'Londres': ['London', 'GB'], 'Édimbourg': ['Edinburgh', 'GB'], 'Douvres': ['Dover', 'GB'], 'Cantorbéry': ['Canterbury', 'GB'], 'Dublin': ['Dublin', 'IE'],
  'Barcelone': ['Barcelona', 'ES'], 'Séville': ['Sevilla', 'ES'], 'Saragosse': ['Zaragoza', 'ES'], 'Valence ES': ['Valencia', 'ES'], 'Majorque': ['Palma', 'ES'], 'Saint-Sébastien': ['San Sebastián', 'ES'],
  'Lisbonne': ['Lisbon', 'PT'], 'Porto': ['Porto', 'PT'],
  'Cologne': ['Köln', 'DE'], 'Aix-la-Chapelle': ['Aachen', 'DE'], 'Mayence': ['Mainz', 'DE'], 'Francfort': ['Frankfurt am Main', 'DE'], 'Hambourg': ['Hamburg', 'DE'], 'Munich': ['Munich', 'DE'], 'Brême': ['Bremen', 'DE'], 'Fribourg-en-Brisgau': ['Freiburg', 'DE'], 'Sarrebruck': ['Saarbrücken', 'DE'], 'Trèves': ['Trier', 'DE'], 'Dresde': ['Dresden', 'DE'], 'Nuremberg': ['Nuremberg', 'DE'],
  'Venise': ['Venice', 'IT'], 'Gênes': ['Genoa', 'IT'], 'Florence': ['Florence', 'IT'], 'Naples': ['Naples', 'IT'], 'Turin': ['Turin', 'IT'], 'Milan': ['Milan', 'IT'], 'Rome': ['Rome', 'IT'], 'Vérone': ['Verona', 'IT'], 'Bologne': ['Bologna', 'IT'], 'Palerme': ['Palermo', 'IT'],
  'Vienne AT': ['Vienna', 'AT'], 'Varsovie': ['Warsaw', 'PL'], 'Cracovie': ['Kraków', 'PL'], 'Prague': ['Prague', 'CZ'], 'Moscou': ['Moscow', 'RU'], 'Saint-Pétersbourg': ['Saint Petersburg', 'RU'], 'Athènes': ['Athens', 'GR'], 'Copenhague': ['Copenhagen', 'DK'],
  'La Haye': ['The Hague', 'NL'], 'Amsterdam': ['Amsterdam', 'NL'], 'Rotterdam': ['Rotterdam', 'NL'],
  'Alger': ['Algiers', 'DZ'], 'Marrakech': ['Marrakesh', 'MA'], 'Le Caire': ['Cairo', 'EG'], 'Pékin': ['Beijing', 'CN'], 'Nouvelle-Orléans': ['New Orleans', 'US'], 'La Nouvelle-Orléans': ['New Orleans', 'US'], 'Québec': ['Québec', 'CA']
}).map(([k, v]) => {
  const m = k.match(/^(.*) ([A-Z]{2})$/);
  return m ? [norm(m[1]) + '|' + m[2], [v[0], v[1], true]] : [norm(k), [v[0], v[1], false]];
}));
// Recherche « Vienne AT » / « Valence ES » : clé composée nom|pays.
const _exoGet = (key, cc) => EXONYMS[key + '|' + cc] || EXONYMS[key];

const I18N = require('./renderer/i18n.js');
const _dn = {};
// Nom du pays dans la langue de l'appli (ou celle demandée).
function countryName(cc, lang) {
  if (!cc) return '';
  const l = lang || I18N.lang;
  try { _dn[l] = _dn[l] || new Intl.DisplayNames([l], { type: 'region' }); return _dn[l].of(cc) || cc; } catch (e) { return cc; }
}
function flag(cc) {
  if (!/^[A-Z]{2}$/.test(cc || '')) return '';
  return String.fromCodePoint(...[...cc].map(ch => 0x1F1E6 + ch.charCodeAt(0) - 65));
}

module.exports = { load, around, nearest, notable, cityOf, countryAt, geocode, countryName, flag, distKm, bearingDeg, norm, info: () => ({ count: cities ? cities.length : 0, error: loadError }) };
