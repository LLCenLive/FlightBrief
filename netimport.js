/* =========================================================
   FlightBrief — import des vols depuis VATSIM (CID) et IVAO (VID) (v2.1)
   ---------------------------------------------------------
   • VATSIM : API publique, sans compte.
       - https://api.vatsim.net/v2/members/{cid}/history   → connexions (type 1 = pilote) avec début / fin
       - https://api.vatsim.net/api/ratings/{cid}/flight_plans/ → tous les plans de vol (paginé, comme VATSIM Stats ; repli : v2 /flightplans, ≈ 50 derniers)
     Les plans de vol ne donnent pas toujours leur connexion (connection_id = 0) : on rapproche
     chaque connexion pilote terminée du dernier plan déposé avec le même indicatif avant sa fin.
     Durée = temps de connexion (bloc à bloc environ).
   • IVAO : l'API v2 exige une clé (apiKey) créée par le membre sur https://developers.ivao.aero.
       - https://api.ivao.aero/v2/tracker/sessions?userId={vid}&connectionType=PILOT
   Les vols renvoyés ont le format du logbook ; les doublons (même date, départ, arrivée) sont
   écartés côté interface, comme pour l'import CSV.
   ========================================================= */
const VATSIM_API = 'https://api.vatsim.net/v2/members/';
// API historique (celle de VATSIM Stats) : TOUS les plans de vol du membre, paginés.
const VATSIM_FP_ALL = 'https://api.vatsim.net/api/ratings/';
const IVAO_API = 'https://api.ivao.aero/v2/tracker/sessions';

const up = s => String(s || '').trim().toUpperCase();
const isIcao = s => /^[A-Z][A-Z0-9]{3}$/.test(s);
// Les anciens plans de vol VATSIM n'indiquent pas de fuseau (« 2021-08-26T04:33:23 ») : c'est de l'UTC.
const ts = s => { if (!s) return null; let v = String(s); if (/T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(v)) v += 'Z'; const t = Date.parse(v); return Number.isFinite(t) ? t : null; };
const listOf = d => Array.isArray(d) ? d : (d && (d.items || d.results || d.data)) || [];
function pick(o, ...paths) {
  for (const p of paths) {
    let v = o;
    for (const k of p.split('.')) v = v == null ? undefined : v[k];
    if (v != null && v !== '') return v;
  }
  return null;
}
// Type OACI de l'avion à partir du champ plan de vol (« B77L/H-SDE…/LB1 », « H/B744/L », « A20N »).
function aircraftType(raw) {
  const parts = up(raw).split('/').map(s => s.trim()).filter(Boolean);
  const t = parts.find(p => /^[A-Z][A-Z0-9]{1,3}$/.test(p) && !/^[HLMJ]$/.test(p)) || parts[0] || '';
  return t.replace(/-.*$/, '').slice(0, 12);
}

/* ---------------- VATSIM ---------------- */
// Associe connexions pilote et plans de vol. Pur (testable).
function vatsimFlights(connections, flightplans, cid) {
  const fps = listOf(flightplans).map(fp => ({ ...fp, _filed: ts(fp.filed), _cs: up(fp.callsign) }))
    .filter(fp => fp._filed && isIcao(up(fp.dep)) && isIcao(up(fp.arr)))
    .sort((a, b) => b._filed - a._filed);
  const out = [], usedFp = new Set();
  listOf(connections).forEach(c => {
    if (c.type != null && +c.type !== 1) return; // ATC / observateur
    const start = ts(c.start), end = ts(c.end);
    if (!start || !end || end <= start) return;   // connexion en cours ou invalide
    const cs = up(c.callsign);
    const byId = fps.find(fp => fp.connection_id && String(fp.connection_id) === String(c.id));
    const fp = byId || fps.find(f => !usedFp.has(f.id) && !+f.connection_id && f._cs === cs && f._filed <= end && f._filed >= start - 12 * 3600e3);
    if (!fp) return;
    usedFp.add(fp.id);
    const durationMin = Math.round((end - start) / 60000);
    if (durationMin < 5) return;
    const rules = up(fp.flight_type);
    out.push({
      id: `vat${c.id || start}`, date: new Date(start).toISOString().slice(0, 10),
      callsign: cs.slice(0, 20), dep: up(fp.dep), arr: up(fp.arr), aircraft: aircraftType(fp.aircraft),
      rules: rules === 'V' || rules === 'VFR' ? 'VFR' : rules === 'I' || rules === 'IFR' ? 'IFR' : '',
      durationMin, network: 'VATSIM', careerId: null, aircraftId: null, pirep: 'none',
      remarks: fp.route ? `Route : ${String(fp.route).slice(0, 300)}` : '',
      imported: { from: `VATSIM ${cid}`, at: new Date().toISOString(), connectionId: c.id || null, start: new Date(start).toISOString(), end: new Date(end).toISOString() }
    });
  });
  return out;
}

async function fetchJson(fetchFn, url, headers) {
  const res = await fetchFn(url, { headers: Object.assign({ Accept: 'application/json' }, headers || {}) });
  if (res.status === 401 || res.status === 403) { const e = new Error('Accès refusé (clé API invalide ou manquante).'); e.code = 'auth'; throw e; }
  if (res.status === 404) { const e = new Error('Membre introuvable.'); e.code = 'notfound'; throw e; }
  if (res.status === 429) { const e = new Error('Trop de requêtes : réessaie dans une minute.'); e.code = 'rate'; throw e; }
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function importVatsim(fetchFn, cid, opts) {
  cid = String(cid || '').replace(/\D/g, '');
  if (!/^\d{3,9}$/.test(cid)) return { ok: false, error: 'CID VATSIM invalide (3 à 9 chiffres).' };
  try {
    // Plans de vol : historique complet (API « ratings »), sinon repli sur les ~50 derniers (v2).
    let fps = [];
    try {
      for (let page = 1; page <= ((opts && opts.maxFpPages) || 20); page++) {
        const d = await fetchJson(fetchFn, `${VATSIM_FP_ALL}${cid}/flight_plans/?page_size=1000&page=${page}`);
        fps.push(...listOf(d));
        if (!d || !d.next) break;
      }
    } catch (e) {
      if (e.code === 'notfound' || e.code === 'rate') throw e;
      fps = [];
    }
    if (!fps.length) fps = listOf(await fetchJson(fetchFn, `${VATSIM_API}${cid}/flightplans`));
    const oldestFp = fps.reduce((m, f) => Math.min(m, ts(f.filed) || Infinity), Infinity);
    const conns = [];
    const pageSize = 1000, maxPages = (opts && opts.maxPages) || 30;
    for (let page = 0; page < maxPages; page++) {
      const d = await fetchJson(fetchFn, `${VATSIM_API}${cid}/history?limit=${pageSize}&offset=${page * pageSize}`);
      const items = listOf(d);
      conns.push(...items);
      const count = d && Number.isFinite(+d.count) ? +d.count : null;
      if (items.length < pageSize || (count != null && conns.length >= count)) break;
      // Plus ancien que le plus vieux plan de vol connu : rien à rapprocher au-delà.
      const last = ts(items[items.length - 1].start);
      if (last && Number.isFinite(oldestFp) && last < oldestFp - 24 * 3600e3) break;
    }
    const flights = vatsimFlights(conns, fps, cid);
    return { ok: true, network: 'VATSIM', flights, scanned: { connections: conns.length, flightplans: fps.length } };
  } catch (e) {
    return { ok: false, error: e.message || String(e), code: e.code || null };
  }
}

/* ---------------- IVAO ---------------- */
function ivaoFlights(sessions, vid) {
  const out = [];
  listOf(sessions).forEach(s => {
    const type = up(pick(s, 'connectionType'));
    if (type && type !== 'PILOT') return;
    const start = ts(pick(s, 'createdAt', 'connectedAt', 'startedAt'));
    const end = ts(pick(s, 'completedAt', 'updatedAt', 'disconnectedAt', 'endedAt'));
    const secs = +pick(s, 'time', 'duration');
    const fps = Array.isArray(s.flightPlans) ? s.flightPlans : (s.flightPlan ? [s.flightPlan] : []);
    const fp = fps[fps.length - 1] || {};
    const dep = up(pick(fp, 'departureId', 'departure.icao', 'departure')), arr = up(pick(fp, 'arrivalId', 'arrival.icao', 'arrival'));
    if (!start || !isIcao(dep) || !isIcao(arr)) return;
    const durationMin = Number.isFinite(secs) && secs > 0 ? Math.round(secs / 60) : (end && end > start ? Math.round((end - start) / 60000) : 0);
    if (durationMin && durationMin < 5) return;
    const rules = up(pick(fp, 'flightRules'));
    out.push({
      id: `ivs${s.id || start}`, date: new Date(start).toISOString().slice(0, 10),
      callsign: up(s.callsign).slice(0, 20), dep, arr,
      aircraft: aircraftType(pick(fp, 'aircraftId', 'aircraft.icaoCode', 'aircraft')),
      rules: rules === 'V' || rules === 'VFR' ? 'VFR' : rules === 'I' || rules === 'IFR' || rules === 'Y' || rules === 'Z' ? 'IFR' : '',
      durationMin, network: 'IVAO', careerId: null, aircraftId: null, pirep: 'none',
      remarks: pick(fp, 'route') ? `Route : ${String(pick(fp, 'route')).slice(0, 300)}` : '',
      imported: { from: `IVAO ${vid}`, at: new Date().toISOString(), sessionId: s.id || null }
    });
  });
  return out;
}

async function importIvao(fetchFn, vid, apiKey, opts) {
  vid = String(vid || '').replace(/\D/g, '');
  if (!/^\d{3,9}$/.test(vid)) return { ok: false, error: 'VID IVAO invalide (3 à 9 chiffres).' };
  if (!apiKey) return { ok: false, code: 'auth', error: "L'API IVAO demande une clé personnelle (developers.ivao.aero)." };
  try {
    const all = [];
    const perPage = 100, maxPages = (opts && opts.maxPages) || 10;
    for (let page = 1; page <= maxPages; page++) {
      const d = await fetchJson(fetchFn, `${IVAO_API}?userId=${vid}&connectionType=PILOT&perPage=${perPage}&page=${page}`, { apiKey: String(apiKey) });
      const items = listOf(d);
      all.push(...items);
      const pages = d && Number.isFinite(+d.pages) ? +d.pages : null;
      if (items.length < perPage || (pages != null && page >= pages)) break;
    }
    return { ok: true, network: 'IVAO', flights: ivaoFlights(all, vid), scanned: { sessions: all.length } };
  } catch (e) {
    return { ok: false, error: e.message || String(e), code: e.code || null };
  }
}

module.exports = { importVatsim, importIvao, vatsimFlights, ivaoFlights, aircraftType };
