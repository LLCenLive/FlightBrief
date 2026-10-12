/* =========================================================
   FlightBrief — « Où voler aujourd'hui ? » (v1.7)
   ---------------------------------------------------------
   Propose quelques destinations depuis un aéroport, pour le temps dont on dispose :
   distance compatible avec la vitesse de l'avion, piste assez longue (et revêtue pour les
   avions de ligne), directions variées, et selon les préférences :
     • mode « new » : terrains jamais visités ; « fav » : tes terrains préférés (logbook) ;
     • contrôleurs en ligne (VATSIM / IVAO) au terrain d'arrivée ;
     • event VATSIM en cours à l'heure d'arrivée (fenêtre de distance élargie pour eux).
   La météo réelle (METAR) est ajoutée ensuite par le processus principal.
   ========================================================= */
const PROFILES = {
  light:  { speedKt: 110, overheadMin: 10, minRwyFt: 1500, paved: false },
  medium: { speedKt: 430, overheadMin: 25, minRwyFt: 5900, paved: true },
  heavy:  { speedKt: 480, overheadMin: 30, minRwyFt: 8000, paved: true },
  jumbo:  { speedKt: 490, overheadMin: 30, minRwyFt: 9500, paved: true }
};
const PAVED = /ASP|CON|PEM|BIT|TAR|ASF|PAV|BRI|MAC/i;
// Terrains militaires et hélistations : écartés (pas de quoi y poser un vol de ligne fictif).
const MILITARY = /\b(RAF|RNAS|Air Base|AB|Air Force|Airbase|Naval|NAS|Army|Military|Militar|Base Aérienne|Base aérienne|BA \d+|Fliegerhorst|CFB|Station Airfield|Heliport|Héliport|Hospital)\b/i;

function nm(a, b) {
  const R = 3440.065, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function bearing(a, b) {
  const r = Math.PI / 180, y = Math.sin((b.lon - a.lon) * r) * Math.cos(b.lat * r);
  const x = Math.cos(a.lat * r) * Math.sin(b.lat * r) - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos((b.lon - a.lon) * r);
  return (Math.atan2(y, x) / r + 360) % 360;
}
// Plus longue piste utilisable (revêtue si demandé), hors hélistations.
function bestRunwayFt(rwys, paved) {
  return (rwys || []).filter(w => !/^H/.test(w.le || '') && (!paved || PAVED.test(w.surface || ''))).reduce((m, w) => Math.max(m, w.lengthFt || 0), 0);
}

// airports : itérable de { icao, name, lat, lon } ; runways : { ICAO: [piste…] }.
// opts : { from, minutes, profile, speedKt, visited:Set, count, random(), mode: 'new'|'fav'|'any',
//          favCounts: { ICAO: nb de passages }, atc: Map(ICAO -> { nets:[…], facs:[…] }), preferAtc,
//          events: Map(ICAO -> { name, start, end, link }), now }
function suggest(airports, runways, opts) {
  const p = { ...(PROFILES[opts.profile] || PROFILES.medium) };
  if (opts.speedKt) p.speedKt = opts.speedKt;
  const from = opts.from;
  const flightMin = Math.max(10, (opts.minutes || 60) - p.overheadMin);
  const target = flightMin / 60 * p.speedKt, lo = target * 0.75, hi = target * 1.1;
  const rnd = opts.random || Math.random, visited = opts.visited || new Set(), mode = opts.mode || 'new';
  const fav = opts.favCounts || {}, atc = opts.atc || new Map(), events = opts.events || new Map(), now = opts.now || Date.now();
  const cands = [];
  for (const a of airports) {
    if (a.icao === from.icao || !/^[A-Z]{4}$/.test(a.icao) || MILITARY.test(a.name || '')) continue;
    const d = nm(from, a), special = events.has(a.icao) || (mode === 'fav' && fav[a.icao]);
    if (d < (special ? target * 0.55 : lo) || d > (special ? target * 1.35 : hi)) continue;
    const rwy = bestRunwayFt(runways[a.icao], p.paved);
    if (rwy < p.minRwyFt) continue;
    const estMin = Math.round(d / p.speedKt * 60 + p.overheadMin), arrival = now + estMin * 60000;
    const ev = events.get(a.icao), evOn = ev && arrival >= ev.start - 3600000 && arrival <= ev.end;
    const at = atc.get(a.icao), atcScore = at ? (at.facs.some(f => f === 'TWR' || f === 'APP') ? 1 : 0.5) : 0;
    let score = rnd() * 0.8 + Math.min(rwy, 12000) / 60000 + atcScore * (opts.preferAtc ? 1.6 : 0.4) + (evOn ? 2.5 : 0);
    if (mode === 'new' && !visited.has(a.icao)) score += 1;
    if (mode === 'fav' && fav[a.icao]) score += Math.min(2, 0.6 * Math.log2(1 + fav[a.icao]));
    cands.push({ icao: a.icao, name: a.name, lat: a.lat, lon: a.lon, distanceNm: Math.round(d), bearing: bearing(from, a), runwayFt: rwy, isNew: !visited.has(a.icao),
      visits: fav[a.icao] || 0, favPick: mode === 'fav' && !!fav[a.icao], atc: at || null, event: evOn ? ev : null, estMin, score });
  }
  cands.sort((x, y) => y.score - x.score);
  return { targetNm: Math.round(target), profile: p, list: pickDiverse(cands, opts.count || 3).map(({ score, ...c }) => c), pool: cands.length };
}
// Directions variées : au moins 60° entre deux propositions quand c'est possible (liste déjà triée).
// Les events et les terrains préférés passent toujours : on les veut, même dans la même direction.
function pickDiverse(list, n) {
  const out = [];
  for (const c of list) { if (out.length >= n) break; if (c.event || c.visits > 0 && c.favPick || out.every(o => Math.abs(((o.bearing - c.bearing + 540) % 360) - 180) >= 60)) out.push(c); }
  for (const c of list) { if (out.length >= n) break; if (!out.includes(c)) out.push(c); }
  return out;
}

module.exports = { suggest, pickDiverse, PROFILES, nm, bestRunwayFt };
