/* =========================================================
   FlightBrief — contrôleurs en ligne VATSIM + IVAO (v1.5)
   ---------------------------------------------------------
   Sources publiques, sans compte ni clé :
     • VATSIM : https://data.vatsim.net/v3/vatsim-data.json (contrôleurs + ATIS)
       + positions/secteurs du projet officiel VATSpy (aéroports, FIR, UIR, contours
       Boundaries.geojson), téléchargés une fois puis gardés 7 jours sur le disque.
     • IVAO : https://api.ivao.aero/v2/tracker/whazzup (contrôleurs, avec leur position
       et, pour les centres, le contour de leur secteur quand l'API le fournit).
   Tout est ramené au même format « station » pour la carte et la liste du Briefing :
     { network, callsign, facility, frequency, name, logonTime, text, atisCode,
       ap: {icao, lat, lon} | null,   // stations d'aéroport (DEL/GND/TWR/APP/DEP/ATIS)
       poly: [[[lat, lon], …], …] | null,  // contours des centres (CTR/FSS)
       pos: [lat, lon] | null }
   v1.9 — Amis sur la carte : les mêmes fichiers donnent la position des pilotes. Ils sont indexés
   par CID (VATSIM) / VID (IVAO) côté processus principal, et seuls les pilotes demandés (amis,
   viewers inscrits avec !vatsim / !ivao) partent vers l'interface : jamais toute la liste.
   ========================================================= */
const fs = require('fs');
const path = require('path');

const VATSIM_URL = 'https://data.vatsim.net/v3/vatsim-data.json';
const IVAO_URL = 'https://api.ivao.aero/v2/tracker/whazzup';
const VATSPY_DAT_URL = 'https://raw.githubusercontent.com/vatsimnetwork/vatspy-data-project/master/VATSpy.dat';
const VATSPY_GEO_URL = 'https://raw.githubusercontent.com/vatsimnetwork/vatspy-data-project/master/Boundaries.geojson';
const CACHE_MS = 30000;
const VATSPY_MAX_AGE_MS = 7 * 24 * 3600 * 1000;
const FACILITIES = { 0: 'OBS', 1: 'FSS', 2: 'DEL', 3: 'GND', 4: 'TWR', 5: 'APP', 6: 'CTR' };
const AIRPORT_FAC = new Set(['ATIS', 'DEL', 'GND', 'TWR', 'APP', 'DEP']);

function facilityOf(callsign, fallback) {
  const suf = String(callsign || '').toUpperCase().split('_').pop();
  if (suf === 'DEP') return 'DEP';
  if (['ATIS', 'DEL', 'GND', 'TWR', 'APP', 'CTR', 'FSS'].includes(suf)) return suf;
  if (suf === 'RMP' || suf === 'RAMP') return 'GND';
  return fallback || suf || '?';
}
function fmtFreq(f) {
  if (f == null || f === '') return '';
  const n = typeof f === 'number' ? f : parseFloat(f);
  return isFinite(n) ? n.toFixed(3) : String(f);
}

/* ---------------- VATSpy (positions et secteurs VATSIM) ---------------- */
let vatspy = null;        // { airports: Map, iata: Map, firByPrefix: Map, firByIcao: Map, uirs: Map, boundaries: Map }
let vatspyLoading = null;
const geoCache = new Map(); // callsign -> poly (null si introuvable)

function parseVatspyDat(text) {
  const airports = new Map(), iata = new Map(), firByPrefix = new Map(), firByIcao = new Map(), uirs = new Map();
  let section = '';
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith(';')) continue;
    if (line.startsWith('[')) { section = line.toLowerCase(); continue; }
    const f = line.split('|');
    if (section === '[airports]' && f.length >= 4) {
      const lat = parseFloat(f[2]), lon = parseFloat(f[3]);
      if (!isFinite(lat) || !isFinite(lon)) continue;
      const a = { icao: f[0].toUpperCase(), name: f[1], lat, lon, fir: f[5] || '' };
      if (!airports.has(a.icao)) airports.set(a.icao, a);
      if (f[4]) iata.set(f[4].toUpperCase(), a);
    } else if (section === '[firs]' && f.length >= 4) {
      const fir = { icao: f[0].toUpperCase(), name: f[1], prefix: (f[2] || '').toUpperCase(), boundary: (f[3] || f[0]).toUpperCase() };
      if (fir.prefix && !firByPrefix.has(fir.prefix)) firByPrefix.set(fir.prefix, fir);
      if (!firByIcao.has(fir.icao)) firByIcao.set(fir.icao, fir);
    } else if (section === '[uirs]' && f.length >= 3) {
      uirs.set(f[0].toUpperCase(), { icao: f[0].toUpperCase(), name: f[1], firs: f[2].split(',').map(x => x.trim().toUpperCase()).filter(Boolean) });
    }
  }
  return { airports, iata, firByPrefix, firByIcao, uirs };
}
// Contours : on garde chaque anneau extérieur, allégé (≤ 300 points) et arrondi.
function simplifyRing(ring) {
  const step = Math.max(1, Math.ceil(ring.length / 300));
  const out = [];
  for (let i = 0; i < ring.length; i += step) out.push([+ring[i][1].toFixed(3), +ring[i][0].toFixed(3)]);
  return out;
}
function parseBoundaries(geo) {
  const map = new Map();
  for (const ft of (geo && geo.features) || []) {
    const id = String((ft.properties && ft.properties.id) || '').toUpperCase();
    const g = ft.geometry;
    if (!id || !g) continue;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    const rings = polys.map(p => simplifyRing(p[0] || [])).filter(r => r.length > 2);
    if (!rings.length) continue;
    const label = ft.properties.label_lat != null ? [parseFloat(ft.properties.label_lat), parseFloat(ft.properties.label_lon)] : null;
    const prev = map.get(id);
    if (prev) prev.rings.push(...rings); else map.set(id, { rings, label });
  }
  return map;
}

async function cachedDownload(fetchFn, url, file) {
  let stat = null;
  try { stat = fs.statSync(file); } catch (e) { stat = null; }
  if (stat && Date.now() - stat.mtimeMs < VATSPY_MAX_AGE_MS) return fs.readFileSync(file, 'utf-8');
  try {
    const res = await fetchFn(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
    return text;
  } catch (e) {
    if (stat) return fs.readFileSync(file, 'utf-8'); // ancienne copie plutôt que rien
    throw e;
  }
}

async function loadVatspy(fetchFn, cacheDir) {
  if (vatspy) return vatspy;
  if (vatspyLoading) return vatspyLoading;
  vatspyLoading = (async () => {
    try {
      const [dat, geo] = await Promise.all([
        cachedDownload(fetchFn, VATSPY_DAT_URL, path.join(cacheDir, 'VATSpy.dat')),
        cachedDownload(fetchFn, VATSPY_GEO_URL, path.join(cacheDir, 'Boundaries.geojson'))
      ]);
      vatspy = { ...parseVatspyDat(dat), boundaries: parseBoundaries(JSON.parse(geo)) };
      geoCache.clear();
    } catch (e) {
      vatspy = null; // pas de secteurs : les stations d'aéroport restent placées via l'index local
    } finally { vatspyLoading = null; }
    return vatspy;
  })();
  return vatspyLoading;
}

function vatspyCenterPoly(callsign) {
  if (geoCache.has(callsign)) return geoCache.get(callsign);
  let result = null;
  if (vatspy) {
    const parts = callsign.toUpperCase().split('_');
    parts.pop(); // CTR / FSS
    const cands = [];
    for (let n = parts.length; n >= 1; n--) { cands.push(parts.slice(0, n).join('_')); cands.push(parts.slice(0, n).join('-')); }
    for (const c of cands) {
      const fir = vatspy.firByPrefix.get(c) || vatspy.firByIcao.get(c);
      const b = fir ? vatspy.boundaries.get(fir.boundary) || vatspy.boundaries.get(fir.icao) : vatspy.boundaries.get(c);
      if (b) { result = { rings: b.rings, label: b.label, name: fir ? fir.name : '' }; break; }
      const uir = vatspy.uirs.get(c);
      if (uir) {
        const rings = [];
        uir.firs.forEach(id => { const fr = vatspy.firByIcao.get(id); const bb = vatspy.boundaries.get(fr ? fr.boundary : id); if (bb) rings.push(...bb.rings); });
        if (rings.length) { result = { rings, label: null, name: uir.name }; break; }
      }
    }
  }
  geoCache.set(callsign, result);
  return result;
}

function airportFor(prefix, lookupAirport) {
  const p = String(prefix || '').toUpperCase();
  if (vatspy) {
    const a = vatspy.airports.get(p) || vatspy.iata.get(p);
    if (a) return { icao: a.icao, lat: a.lat, lon: a.lon };
  }
  let a = lookupAirport && lookupAirport(p);
  if (!a && p.length === 3 && lookupAirport) a = lookupAirport('K' + p) || lookupAirport('C' + p) || lookupAirport('P' + p);
  return a ? { icao: a.icao || p, lat: a.lat, lon: a.lon } : null;
}

/* ---------------- VATSIM ---------------- */
let vatsimCache = null, vatsimInflight = null;
async function fetchVatsim(fetchFn, cacheDir, lookupAirport, force) {
  if (!force && vatsimCache && Date.now() - vatsimCache.at < CACHE_MS) return vatsimCache.data;
  if (vatsimInflight) return vatsimInflight;
  vatsimInflight = (async () => {
    try {
      await loadVatspy(fetchFn, cacheDir);
      const res = await fetchFn(VATSIM_URL, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const raw = await res.json();
      const stations = [];
      const push = (c, isAtis) => {
        const callsign = String(c.callsign || '').toUpperCase();
        const facility = isAtis ? 'ATIS' : facilityOf(callsign, FACILITIES[c.facility]);
        const st = {
          network: 'vatsim', callsign, facility, frequency: fmtFreq(c.frequency), name: c.name || '',
          logonTime: c.logon_time || null, atisCode: c.atis_code || null,
          text: Array.isArray(c.text_atis) ? c.text_atis.join(' ') : (c.text_atis || ''),
          ap: null, poly: null, pos: null
        };
        if (AIRPORT_FAC.has(facility)) st.ap = airportFor(callsign.split('_')[0], lookupAirport);
        else if (facility === 'CTR' || facility === 'FSS') {
          const g = vatspyCenterPoly(callsign);
          if (g) { st.poly = g.rings; st.pos = g.label; if (g.name) st.sector = g.name; }
        }
        stations.push(st);
      };
      (raw.controllers || []).filter(c => c.facility > 0 && c.frequency && c.frequency !== '199.998').forEach(c => push(c, false));
      (raw.atis || []).forEach(c => push(c, true));
      const data = { ok: true, network: 'vatsim', updatedAt: (raw.general && raw.general.update_timestamp) || new Date().toISOString(), stations, pilots: Array.isArray(raw.pilots) ? raw.pilots.length : null, sectors: !!vatspy };
      vatsimCache = { at: Date.now(), data, pilots: indexVatsimPilots(raw.pilots) };
      return data;
    } catch (e) {
      if (vatsimCache) return { ...vatsimCache.data, stale: true, error: e.message || String(e) };
      return { ok: false, network: 'vatsim', error: e.message || String(e), stations: [] };
    } finally { vatsimInflight = null; }
  })();
  return vatsimInflight;
}

/* ---------------- IVAO ---------------- */
// Lecture tolérante : l'API v2 a évolué plusieurs fois, on essaie plusieurs noms de champs.
function pick(o, ...paths) {
  for (const p of paths) {
    let v = o;
    for (const k of p.split('.')) { v = v == null ? undefined : v[k]; }
    if (v != null && v !== '') return v;
  }
  return null;
}
function ivaoRings(region) {
  if (!Array.isArray(region) || region.length < 3) return null;
  const ring = region.map(p => Array.isArray(p) ? [+p[1], +p[0]] : [+(p.lat ?? p.latitude), +(p.lng ?? p.lon ?? p.longitude)])
    .filter(p => isFinite(p[0]) && isFinite(p[1]));
  return ring.length > 2 ? [ring.map(p => [+p[0].toFixed(3), +p[1].toFixed(3)])] : null;
}
let ivaoCache = null, ivaoInflight = null;
async function fetchIvao(fetchFn, lookupAirport, force) {
  if (!force && ivaoCache && Date.now() - ivaoCache.at < CACHE_MS) return ivaoCache.data;
  if (ivaoInflight) return ivaoInflight;
  ivaoInflight = (async () => {
    try {
      const res = await fetchFn(IVAO_URL, { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const raw = await res.json();
      const atcs = (raw.clients && (raw.clients.atcs || raw.clients.atc)) || raw.atcs || [];
      const stations = atcs.map(a => {
        const callsign = String(a.callsign || '').toUpperCase();
        const facility = facilityOf(callsign, pick(a, 'atcSession.position', 'atcPosition.position'));
        const atisLines = pick(a, 'atis.lines');
        const st = {
          network: 'ivao', callsign, facility,
          frequency: fmtFreq(pick(a, 'atcSession.frequency', 'frequency')),
          name: '', logonTime: pick(a, 'createdAt', 'connectedAt'),
          atisCode: pick(a, 'atis.revision'), text: Array.isArray(atisLines) ? atisLines.slice(1).join(' ') : '',
          ap: null, poly: null, pos: null
        };
        const lat = +pick(a, 'lastTrack.latitude', 'atcPosition.airport.latitude', 'latitude');
        const lon = +pick(a, 'lastTrack.longitude', 'atcPosition.airport.longitude', 'longitude');
        if (isFinite(lat) && isFinite(lon) && (lat || lon)) st.pos = [lat, lon];
        if (AIRPORT_FAC.has(facility)) {
          const apIcao = pick(a, 'atcPosition.airportId', 'atcPosition.airport.icao') || callsign.split('_')[0];
          st.ap = airportFor(apIcao, lookupAirport) || (st.pos ? { icao: apIcao, lat: st.pos[0], lon: st.pos[1] } : null);
        } else {
          st.poly = ivaoRings(pick(a, 'atcPosition.regionMap', 'subcenter.regionMap', 'regionMap'));
          st.sector = pick(a, 'atcPosition.composePosition', 'subcenter.composePosition') || '';
        }
        return st;
      });
      const data = { ok: true, network: 'ivao', updatedAt: raw.updatedAt || new Date().toISOString(), stations, pilots: raw.clients && Array.isArray(raw.clients.pilots) ? raw.clients.pilots.length : null };
      ivaoCache = { at: Date.now(), data, pilots: indexIvaoPilots(raw.clients && raw.clients.pilots) };
      return data;
    } catch (e) {
      if (ivaoCache) return { ...ivaoCache.data, stale: true, error: e.message || String(e) };
      return { ok: false, network: 'ivao', error: e.message || String(e), stations: [] };
    } finally { ivaoInflight = null; }
  })();
  return ivaoInflight;
}

/* ---------------- Pilotes (amis sur la carte) ---------------- */
const num = v => { const n = +v; return Number.isFinite(n) ? n : null; };
const up = s => String(s || '').trim().toUpperCase();
function indexVatsimPilots(list) {
  const m = new Map();
  (Array.isArray(list) ? list : []).forEach(p => {
    const lat = num(p.latitude), lon = num(p.longitude);
    if (p.cid == null || lat == null || lon == null) return;
    const fp = p.flight_plan || {};
    m.set(String(p.cid), { network: 'vatsim', id: String(p.cid), callsign: up(p.callsign), lat, lon, altFt: num(p.altitude), gsKt: num(p.groundspeed), hdg: num(p.heading),
      dep: up(fp.departure), arr: up(fp.arrival), aircraft: up(fp.aircraft_short || fp.aircraft || '').slice(0, 12) });
  });
  return m;
}
function indexIvaoPilots(list) {
  const m = new Map();
  (Array.isArray(list) ? list : []).forEach(p => {
    const lat = num(pick(p, 'lastTrack.latitude', 'latitude')), lon = num(pick(p, 'lastTrack.longitude', 'longitude'));
    const id = pick(p, 'userId', 'vid');
    if (id == null || lat == null || lon == null) return;
    m.set(String(id), { network: 'ivao', id: String(id), callsign: up(p.callsign), lat, lon, altFt: num(pick(p, 'lastTrack.altitude', 'altitude')), gsKt: num(pick(p, 'lastTrack.groundSpeed', 'groundSpeed')), hdg: num(pick(p, 'lastTrack.heading', 'heading')),
      dep: up(pick(p, 'flightPlan.departureId')), arr: up(pick(p, 'flightPlan.arrivalId')), aircraft: up(pick(p, 'flightPlan.aircraftId', 'flightPlan.aircraft.icaoCode')).slice(0, 12) });
  });
  return m;
}
// wanted : [{ network: 'vatsim' | 'ivao', id: '1234567', label?, viewer? }] -> pilots en ligne parmi eux.
async function findPilots(fetchFn, opts, wanted) {
  wanted = (Array.isArray(wanted) ? wanted : []).filter(w => w && (w.network === 'vatsim' || w.network === 'ivao') && /^\d{3,9}$/.test(String(w.id || '')));
  const nets = { vatsim: wanted.some(w => w.network === 'vatsim'), ivao: wanted.some(w => w.network === 'ivao') };
  await Promise.all([
    nets.vatsim ? fetchVatsim(fetchFn, opts.cacheDir, opts.lookupAirport, false) : null,
    nets.ivao ? fetchIvao(fetchFn, opts.lookupAirport, false) : null
  ]);
  const idx = { vatsim: vatsimCache && vatsimCache.pilots, ivao: ivaoCache && ivaoCache.pilots };
  const out = [], seen = new Set();
  for (const w of wanted) {
    const k = w.network + ':' + w.id;
    if (seen.has(k)) continue;
    seen.add(k);
    const p = idx[w.network] && idx[w.network].get(String(w.id));
    if (p) out.push({ ...p, label: String(w.label || '').slice(0, 40), viewer: !!w.viewer });
  }
  return { ok: true, pilots: out, checked: wanted.length };
}

async function fetchAtc(fetchFn, opts) {
  const nets = opts.networks || { vatsim: true, ivao: false };
  const [vatsim, ivao] = await Promise.all([
    nets.vatsim ? fetchVatsim(fetchFn, opts.cacheDir, opts.lookupAirport, opts.force) : null,
    nets.ivao ? fetchIvao(fetchFn, opts.lookupAirport, opts.force) : null
  ]);
  return { vatsim, ivao };
}

module.exports = { fetchAtc, findPilots, indexVatsimPilots, indexIvaoPilots, parseVatspyDat, parseBoundaries, facilityOf, _test: { vatspyCenterPoly, setVatspy: v => { vatspy = v; geoCache.clear(); } } };
