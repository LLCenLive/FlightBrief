/* =========================================================
   FlightBrief — données des rubriques Logbook, Carrière et OFP de l'EFB MSFS 2024 (v2.0)
   ---------------------------------------------------------
   Fonctions pures (base de l'appli en entrée) : utilisées par main.js pour /api/efb/* et par les tests.
   Mêmes règles que l'appli : distance (FBShared.flightDistance), note d'atterrissage
   (FBShared.flightLandingScore), grade d'une carrière d'après ses heures (onglet Carrière).
   ========================================================= */
const FBShared = require('./renderer/fb-shared.js');

const hm = min => { min = Math.max(0, Math.round(min || 0)); return Math.floor(min / 60) + 'h' + String(min % 60).padStart(2, '0'); };

// Logbook : vols les plus récents d'abord, sans les tracés (trop lourds pour la tablette).
function logbook(db, lookupAirport, limit) {
  db = db || {};
  const careers = new Map((db.careers || []).map(c => [c.id, c.name]));
  const flights = (db.logbook || []).slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  let totalMin = 0, totalNm = 0, scoreSum = 0, scoreN = 0;
  const out = flights.map(f => {
    const d = FBShared.flightDistance(f, lookupAirport), sc = FBShared.flightLandingScore(f), td = f.trackData || {};
    totalMin += f.durationMin || 0; if (d.nm != null) totalNm += d.nm; if (sc) { scoreSum += sc.score; scoreN++; }
    return { id: f.id, date: f.date || '', callsign: f.callsign || '', dep: f.dep || '', arr: f.arr || '', aircraft: f.aircraft || '', network: f.network || '', rules: f.rules || '',
      duration: f.durationMin != null ? hm(f.durationMin) : null, nm: d.nm != null ? Math.round(d.nm) : null, pirep: f.pirep || 'none', career: careers.get(f.careerId) || null,
      remarks: String(f.remarks || '').slice(0, 200), fpm: FBShared.flightLandingRate(f), score: sc ? { letter: sc.letter, color: sc.color, score: sc.score } : null,
      maxAltFt: td.maxAltFt || null, bounces: td.bounceCount || 0, tracked: !!f.trackData, passengers: (td.passengers || []).slice(0, 30) };
  });
  return { ok: true, stats: { flights: out.length, hours: hm(totalMin), nm: Math.round(totalNm), avgScore: scoreN ? Math.round(scoreSum / scoreN) : null, last: out[0] ? out[0].date : null },
    flights: out.slice(0, limit || 400) };
}

// Carrières : heures, grade actuel et suivant, progression, tours (escales faites / prochaine étape).
function careers(db) {
  db = db || {};
  const all = db.logbook || [];
  return { ok: true, careers: (db.careers || []).map(c => {
    const mine = all.filter(f => f.careerId === c.id);
    const hours = mine.reduce((s, f) => s + (f.durationMin || 0), 0) / 60;
    const ranks = (c.ranks && c.ranks.length) ? c.ranks : [{ name: 'Non défini', hours: 0 }];
    let current = ranks[0], next = null;
    for (const r of ranks) { if (hours >= r.hours) current = r; if (hours < r.hours) { next = r; break; } }
    const tours = (c.tours || []).map(t => {
      const legs = t.legs || [], done = legs.filter(l => l.done).length, nx = legs.find(l => !l.done);
      return { name: t.name || '', done, total: legs.length, next: nx ? { dep: nx.dep, arr: nx.arr } : null, stops: legs.length ? [legs[0].dep].concat(legs.map(l => l.arr)) : [] };
    });
    return { name: c.name, type: c.type || '', hours: Math.round(hours * 10) / 10, flights: mine.length, rank: current.name, next: next ? { name: next.name, hours: next.hours } : null,
      pct: next ? Math.min(100, Math.round(hours / next.hours * 100)) : 100, tours };
  }) };
}

// OFP SimBrief en texte brut (le HTML de SimBrief n'est pas affiché tel quel dans le simulateur).
function ofpText(db) {
  const o = (db || {}).ofp;
  if (!o || !o.planHtml) return { ok: true, ofp: null };
  const text = String(o.planHtml).replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|h\d|tr)>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\n{3,}/g, '\n\n').trim();
  return { ok: true, ofp: { dep: o.dep, arr: o.arr, callsign: o.callsign, aircraft: o.aircraft, airac: o.airac, generatedAt: o.generatedAt, text: text.slice(0, 60000) } };
}

module.exports = { logbook, careers, ofpText, hm };
