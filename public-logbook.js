/* =========================================================
   FlightBrief — carnet de vol public (v1.7)
   ---------------------------------------------------------
   Génère un petit site STATIQUE (HTML + CSS + JS + données) dans un dossier choisi,
   à publier tel quel sur GitHub Pages (ou n'importe quel hébergeur de fichiers).
   Sécurité :
   • aucun serveur, aucun formulaire, aucun compte, aucune requête vers ton PC :
     le site n'est qu'un ensemble de fichiers en lecture seule ;
   • Content-Security-Policy stricte (aucun script ni ressource externe) ;
   • données filtrées ici : pas de remarques, pas de chemins de fichiers, pas de clés,
     pas de réglages, et JAMAIS la ville des viewers (seulement leurs tampons) ;
   • les noms venus du chat sont insérés comme texte (jamais comme HTML) côté page.
   ========================================================= */
const fs = require('fs');
const path = require('path');

const SAFE_FILE = /^[A-Za-z0-9_-]{1,64}\.jpg$/;
const str = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, '').slice(0, n || 80);

// Cosmétiques du duty free : seulement un emoji, un texte court et une couleur #rrggbb (ou « rainbow »).
function safeLook(l) {
  l = l || {};
  const color = /^#[0-9a-f]{6}$/i.test(l.color || '') || l.color === 'rainbow' ? l.color : null;
  return { badge: l.badge ? str(l.badge, 12) : null, title: l.title ? str(l.title, 30) : null, color };
}
function simplifyPath(p, max) {
  if (!Array.isArray(p) || p.length < 2) return null;
  const pts = p.filter(x => x && isFinite(x.lat) && isFinite(x.lon));
  if (pts.length < 2) return null;
  const step = Math.max(1, Math.ceil(pts.length / (max || 120)));
  const out = [];
  for (let i = 0; i < pts.length; i += step) out.push([+pts[i].lat.toFixed(3), +pts[i].lon.toFixed(3)]);
  const last = pts[pts.length - 1];
  out.push([+last.lat.toFixed(3), +last.lon.toFixed(3)]);
  return out;
}

function exportPublicLogbook({ dir, rendererDir, db, cabin, postcardDir, options, version }) {
  const o = { pilot: '', showRoutes: true, showPassengers: true, title: '', ...(options || {}) };
  if (!dir || !path.isAbsolute(dir)) throw new Error('Dossier invalide.');
  fs.mkdirSync(path.join(dir, 'cartes'), { recursive: true });

  // Cartes postales : copiées sous un nom contrôlé, seulement celles référencées.
  const cards = new Set();
  const copyCard = name => {
    if (!name || !SAFE_FILE.test(name)) return null;
    const src = path.join(postcardDir, name);
    if (!fs.existsSync(src)) return null;
    if (!cards.has(name)) { fs.copyFileSync(src, path.join(dir, 'cartes', name)); cards.add(name); }
    return 'cartes/' + name;
  };

  const cabFlights = (cabin && cabin.flights) || [];
  const flights = (db.logbook || []).slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).map(f => {
    const td = f.trackData || {};
    // Passagers et carte postale : vol « À bord » le même jour vers le même terrain.
    const c = (td.cabinKey ? cabFlights.find(x => x.key === td.cabinKey) : null)
      || cabFlights.find(x => x.arr && x.arr === (f.arr || '').toUpperCase() && String(x.date || '').slice(0, 10) === String(f.date || '').slice(0, 10));
    const fpm = td.landingRateFpm != null ? td.landingRateFpm : td.landingRate;
    return {
      date: str(f.date, 10), callsign: str(f.callsign, 12), dep: str(f.dep, 4).toUpperCase(), arr: str(f.arr, 4).toUpperCase(),
      aircraft: str(f.aircraft, 40), rules: f.rules === 'IFR' ? 'IFR' : 'VFR', network: str(f.network, 12),
      durationMin: isFinite(f.durationMin) ? Math.round(f.durationMin) : (isFinite(td.durationMin) ? Math.round(td.durationMin) : null),
      distanceNm: isFinite(f.distanceNm) ? Math.round(f.distanceNm) : (isFinite(td.distanceNm) ? Math.round(td.distanceNm) : null),
      landing: fpm != null ? { fpm: Math.abs(Math.round(fpm)), letter: td.landingScore && td.landingScore.letter ? str(td.landingScore.letter, 2) : null } : null,
      path: o.showRoutes ? simplifyPath(td.path, 120) : null,
      passengers: o.showPassengers && c ? c.passengers.map(p => ({ id: str(p.id, 40), name: str(p.name, 30) })) : [],
      postcard: copyCard((td && td.postcard) || (c && c.postcard))
    };
  });

  const viewers = o.showPassengers ? ((cabin && cabin.viewers) || []).map(v => ({
    id: str(v.id, 40), name: str(v.name, 30), miles: Math.round(v.miles || 0), flights: v.flights || 0, tier: str(v.tier, 20), tierIcon: str(v.tierIcon, 4), bestTrip: v.bestTrip || 0,
    countries: (v.countries || []).map(c => ({ cc: str(c.cc, 2), name: str(c.name, 40), flag: str(c.flag, 8) })),
    stamps: (v.stamps || []).map(s => ({ icao: str(s.icao, 4), name: str(s.name, 60), city: str(s.city, 40), cc: str(s.cc, 2), count: s.count || 1, first: str(s.first, 25) })),
    postcards: (v.postcards || []).map(n => copyCard(n)).filter(Boolean),
    look: safeLook(v.look) // v1.9 — cosmétiques du duty free
  })).sort((a, b) => b.miles - a.miles) : [];

  // Aéroports utilisés (coordonnées pour la carte), depuis l'index local.
  let airports = {};
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(rendererDir, 'data', 'airports.json'), 'utf-8'));
    const need = new Set(flights.flatMap(f => [f.dep, f.arr]).concat(viewers.flatMap(v => v.stamps.map(s => s.icao))).filter(Boolean));
    raw.forEach(r => { if (need.has(r[0])) airports[r[0]] = { name: str(r[1], 60), lat: +(+r[2]).toFixed(3), lon: +(+r[3]).toFixed(3) }; });
  } catch (e) { airports = {}; }
  let coast = [];
  try { coast = JSON.parse(fs.readFileSync(path.join(rendererDir, 'data', 'coastlines.json'), 'utf-8')); } catch (e) { coast = []; }

  const data = {
    generatedAt: new Date().toISOString(), version: str(version, 12),
    pilot: str(o.pilot || (db.userProfile && (db.userProfile.twitchHandle || db.userProfile.firstName)) || 'Pilote', 40),
    title: str(o.title, 60), twitch: str(db.userProfile && db.userProfile.twitchHandle, 30).replace(/[^A-Za-z0-9_]/g, ''),
    flights, viewers, airports, tiers: (cabin && cabin.tiers || []).map(t => ({ name: t.name, min: t.min, icon: t.icon }))
  };
  // Les données sont un script (et pas un .json chargé par fetch) : le site s'ouvre aussi en local
  // par double-clic. Le JSON est rendu inerte dans le contexte <script> (pas de « </script> »).
  const json = JSON.stringify(data).replace(/</g, '\\u003c').replace(/[\u2028\u2029]/g, c => c === '\u2028' ? '\\u2028' : '\\u2029');
  fs.writeFileSync(path.join(dir, 'data.js'), `window.FB_PUBLIC=${json};\n`);
  fs.writeFileSync(path.join(dir, 'coast.js'), `window.FB_COAST=${JSON.stringify(coast)};\n`);
  fs.writeFileSync(path.join(dir, 'i18n.js'), require('./server').i18nBundle()); // textes dans la langue de l'appli
  for (const f of ['index.html', 'style.css', 'app.js']) fs.copyFileSync(path.join(rendererDir, 'public-logbook', f), path.join(dir, f));
  fs.writeFileSync(path.join(dir, '.nojekyll'), '');
  // Ménage : cartes postales qui ne sont plus référencées.
  try { fs.readdirSync(path.join(dir, 'cartes')).forEach(n => { if (/^carte-\d+\.jpg$/.test(n) && !cards.has(n)) fs.unlinkSync(path.join(dir, 'cartes', n)); }); } catch (e) { /* ignoré */ }
  return { flights: flights.length, viewers: viewers.length, postcards: cards.size, dir };
}

module.exports = { exportPublicLogbook };
