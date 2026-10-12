/* =========================================================
   FlightBrief — import d'un historique de vols (v1.7)
   ---------------------------------------------------------
   Fichier CSV exporté d'un autre outil (Little Navmap, Volanta, tableur…) : séparateur,
   colonnes et formats (dates, durées, distances) sont détectés tout seuls ; l'utilisateur
   peut corriger l'association des colonnes avant d'importer. Les vols déjà présents
   (même date, même départ, même arrivée) ne sont pas importés deux fois.
   ========================================================= */
(function (root) {
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  // Lecture CSV (guillemets, retours à la ligne dans les champs, séparateur , ; ou tabulation).
  function parseCsv(text) {
    text = String(text || '').replace(/^﻿/, '');
    const first = text.split(/\r?\n/, 1)[0];
    const sep = [',', ';', '\t'].map(c => [c, first.split(c).length]).sort((a, b) => b[1] - a[1])[0][0];
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') q = false;
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === sep) { row.push(cur); cur = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(c => c.trim())) rows.push(row); row = []; }
      else cur += ch;
    }
    row.push(cur); if (row.some(c => c.trim())) rows.push(row);
    return { sep, headers: (rows.shift() || []).map(h => h.trim()), rows };
  }

  const FIELDS = {
    date: ['date', 'flight date', 'day', 'departure time real', 'departure time', 'off block', 'offblock', 'block off', 'start time', 'start', 'datum', 'fecha', 'date du vol'],
    dep: ['dep', 'departure', 'departure icao', 'departure ident', 'departure airport', 'from', 'origin', 'origin icao', 'dep icao', 'depart', 'depart oaci', 'aeroport de depart', 'origen', 'salida'],
    arr: ['arr', 'arrival', 'arrival icao', 'arrival airport', 'destination', 'destination ident', 'destination icao', 'to', 'dest', 'arr icao', 'arrivee', 'arrivee oaci', 'aeroport d arrivee', 'llegada', 'destino'],
    aircraft: ['aircraft', 'aircraft name', 'aircraft model', 'avion', 'appareil', 'plane', 'airframe', 'aeronave', 'aircraft type', 'type', 'aircraft icao'],
    callsign: ['callsign', 'flight number', 'flight no', 'flight', 'indicatif', 'numero de vol', 'n de vol', 'flightplan number', 'vuelo', 'registration'],
    duration: ['duration', 'flight time', 'block time', 'air time', 'airborne time', 'total time', 'time', 'duree', 'temps de vol', 'duracion', 'flight duration', 'tiempo de vuelo'],
    depTime: ['departure time real', 'departure time sim', 'off block', 'block off', 'takeoff time', 'heure de depart'],
    arrTime: ['destination time real', 'arrival time real', 'destination time sim', 'on block', 'block on', 'landing time', 'heure d arrivee'],
    distance: ['distance', 'distance nm', 'distance flown', 'distance flown nm', 'flight distance', 'dist', 'distancia', 'gc distance'],
    landing: ['landing rate', 'landing rate fpm', 'touchdown rate', 'landing vs', 'vs at touchdown', 'landing', 'fpm', 'taux d atterrissage', 'taux au toucher', 'tasa de aterrizaje'],
    rules: ['rules', 'flight rules', 'regles', 'vfr ifr', 'reglas'],
    network: ['network', 'reseau', 'red'],
    remarks: ['remarks', 'notes', 'comment', 'comments', 'description', 'remarques', 'observaciones']
  };
  const LABELS = { date: 'Date', dep: 'Départ (OACI)', arr: 'Arrivée (OACI)', aircraft: 'Appareil', callsign: 'Indicatif', duration: 'Durée', depTime: 'Heure de départ', arrTime: "Heure d'arrivée", distance: 'Distance (NM)', landing: "Taux d'atterrissage", rules: 'Règles', network: 'Réseau', remarks: 'Remarques' };

  // Colonne la plus probable pour chaque champ (nom exact, puis nom qui contient le mot-clé).
  function detectColumns(headers) {
    const H = headers.map(norm), map = {}, used = new Set();
    for (const pass of ['exact', 'contains']) {
      for (const [field, syn] of Object.entries(FIELDS)) {
        if (map[field] != null) continue;
        for (const s of syn) {
          const i = H.findIndex((h, j) => !used.has(j) && (pass === 'exact' ? h === s : (h.startsWith(s + ' ') || h.endsWith(' ' + s))));
          if (i >= 0) { map[field] = i; if (!['depTime', 'date'].includes(field)) used.add(i); break; }
        }
      }
    }
    return map;
  }

  function icao(v) { const m = String(v || '').toUpperCase().match(/\b[A-Z][A-Z0-9]{3}\b/); return m ? m[0] : ''; }
  function parseDate(v, dmy) {
    const s = String(v || '').trim();
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/);
    if (m) {
      let [a, b, y] = [+m[1], +m[2], +m[3]];
      if (y < 100) y += 2000;
      const [d, mo] = dmy ? [a, b] : [b, a];
      if (mo < 1 || mo > 12 || d < 1 || d > 31) return '';
      return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    const t = Date.parse(s);
    return isFinite(t) ? new Date(t).toISOString().slice(0, 10) : '';
  }
  // jj/mm ou mm/jj : tranché sur l'ensemble du fichier (une valeur > 12 lève le doute).
  function guessDmy(values) {
    for (const v of values) {
      const m = String(v || '').match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-]\d{2,4}/);
      if (m && +m[1] > 12) return true;
      if (m && +m[2] > 12) return false;
    }
    return true;
  }
  function parseDuration(v, header) {
    const s = String(v || '').trim().toLowerCase();
    if (!s) return null;
    let m = s.match(/^(\d{1,3})\s*[:h]\s*(\d{1,2})(?::\d{1,2})?\s*(min)?$/);
    if (m) return +m[1] * 60 + +m[2];
    m = s.match(/^(\d+)\s*min/); if (m) return +m[1];
    const n = parseFloat(s.replace(',', '.'));
    if (!isFinite(n) || n <= 0) return null;
    if (/hour|heure|hora|\bh\b|hrs/.test(norm(header)) || (/[.,]/.test(s) && n < 30)) return Math.round(n * 60);
    return Math.round(n);
  }
  function parseTime(v) { const t = Date.parse(String(v || '').trim().replace(' ', 'T')); return isFinite(t) ? t : null; }
  function num(v) { const n = parseFloat(String(v || '').replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : null; }

  // Vols FlightBrief à partir des lignes du CSV. existing : vols déjà au logbook (doublons).
  function toFlights(parsed, map, existing, source) {
    const col = (r, f) => map[f] != null ? r[map[f]] : '';
    const dmy = guessDmy(parsed.rows.slice(0, 200).map(r => col(r, 'date')));
    const seen = new Set((existing || []).map(f => `${f.date}|${(f.dep || '').toUpperCase()}|${(f.arr || '').toUpperCase()}`));
    const flights = [], skipped = { duplicate: 0, invalid: 0 };
    parsed.rows.forEach((r, i) => {
      const date = parseDate(col(r, 'date'), dmy), dep = icao(col(r, 'dep')), arr = icao(col(r, 'arr'));
      if (!date || !dep || !arr) { skipped.invalid++; return; }
      const key = `${date}|${dep}|${arr}`;
      if (seen.has(key)) { skipped.duplicate++; return; }
      seen.add(key);
      let durationMin = map.duration != null ? parseDuration(col(r, 'duration'), parsed.headers[map.duration]) : null;
      if (durationMin == null && map.depTime != null && map.arrTime != null) {
        const a = parseTime(col(r, 'depTime')), b = parseTime(col(r, 'arrTime'));
        if (a && b && b > a) durationMin = Math.round((b - a) / 60000);
      }
      let dist = num(col(r, 'distance'));
      if (dist != null && map.distance != null && /\bkm\b/.test(norm(parsed.headers[map.distance]))) dist = dist / 1.852;
      const land = num(col(r, 'landing'));
      const rules = String(col(r, 'rules') || '').toUpperCase().match(/\b(VFR|IFR)\b/);
      const f = {
        id: `imp${Date.now().toString(36)}${i}`, date, dep, arr,
        callsign: String(col(r, 'callsign') || '').trim().slice(0, 20), aircraft: String(col(r, 'aircraft') || '').trim().slice(0, 60),
        rules: rules ? rules[1] : '', durationMin: durationMin || 0, network: String(col(r, 'network') || '').trim().slice(0, 20),
        careerId: null, aircraftId: null, pirep: 'none', remarks: String(col(r, 'remarks') || '').trim().slice(0, 500),
        imported: { from: String(source || '').slice(0, 80), at: new Date().toISOString() }
      };
      if (dist != null && dist > 0) f.distanceNm = Math.round(dist);
      if (land != null && land !== 0 && Math.abs(land) < 3000) f.landingRateFpm = -Math.abs(Math.round(land));
      flights.push(f);
    });
    return { flights, skipped };
  }

  const api = { parseCsv, detectColumns, toFlights, parseDate, parseDuration, FIELDS, LABELS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FBImport = api;
})(typeof window !== 'undefined' ? window : globalThis);
