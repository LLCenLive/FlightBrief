/* =========================================================
   FlightBrief — events VATSIM + IVAO (v2.1)
   ---------------------------------------------------------
   Sources publiques, sans compte ni clé :
     • VATSIM : https://my.vatsim.net/api/v2/events/latest
     • IVAO   : https://api.ivao.aero/v1/events
   Les deux sont ramenés au même format, avec les terrains géolocalisés (index local) :
     { id, network, name, start, end, link, banner, description, airports: [{icao,name,lat,lon}],
       routes: [{dep, arr, route}], organisers, type }
   Gardés 15 min en mémoire ; un réseau injoignable n'empêche pas l'autre de s'afficher.
   ========================================================= */
const VATSIM_EVENTS_URL = 'https://my.vatsim.net/api/v2/events/latest';
const IVAO_EVENTS_URL = 'https://api.ivao.aero/v1/events';
const CACHE_MS = 15 * 60000;

const up = s => String(s || '').trim().toUpperCase();
const isIcao = s => /^[A-Z][A-Z0-9]{3}$/.test(s);
const https = u => /^https:\/\//i.test(String(u || '')) ? String(u) : null;
const time = s => { const t = Date.parse(s || ''); return Number.isFinite(t) ? t : null; };

// Description lisible : sans HTML ni markdown lourd, espaces normalisés, longueur bornée.
function plainText(s, max) {
  let t = String(s || '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h\d)>/gi, '\n').replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .replace(/\*\*([^*]+)\*\*/g, '$1').replace(/__([^_]+)__/g, '$1').replace(/^#{1,6}\s*/gm, '')
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '$1')
    .replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (max && t.length > max) t = t.slice(0, max).replace(/\s+\S*$/, '') + '…';
  return t;
}

function locate(icaos, lookupAirport) {
  const seen = new Set(), out = [];
  icaos.map(up).filter(isIcao).forEach(ic => {
    if (seen.has(ic)) return;
    seen.add(ic);
    const a = lookupAirport ? lookupAirport(ic) : null;
    out.push({ icao: ic, name: a && a.name ? a.name : '', lat: a ? a.lat : null, lon: a ? a.lon : null });
  });
  return out;
}

function normVatsim(raw, lookupAirport) {
  return (raw && Array.isArray(raw.data) ? raw.data : [])
    .filter(e => e && e.type !== 'Controller Examination')
    .map(e => {
      const routes = (Array.isArray(e.routes) ? e.routes : []).map(r => ({ dep: up(r.departure), arr: up(r.arrival), route: String(r.route || '').slice(0, 400) }))
        .filter(r => isIcao(r.dep) && isIcao(r.arr));
      const icaos = (e.airports || []).map(a => a && a.icao).concat(routes.flatMap(r => [r.dep, r.arr]));
      return {
        id: 'vatsim-' + e.id, network: 'vatsim', type: String(e.type || 'Event'),
        name: String(e.name || 'Event').slice(0, 120), start: time(e.start_time), end: time(e.end_time),
        link: https(e.link), banner: https(e.banner),
        description: plainText(e.description || e.short_description, 3000),
        organisers: (e.organisers || []).map(o => [o.division, o.subdivision].filter(Boolean).join(' / ') || o.region).filter(Boolean).slice(0, 4),
        airports: locate(icaos, lookupAirport), routes
      };
    }).filter(e => e.start && e.end);
}

function normIvao(raw, lookupAirport) {
  return (Array.isArray(raw) ? raw : (raw && (raw.items || raw.data)) || [])
    .map(e => {
      const routes = (Array.isArray(e.routes) ? e.routes : []).map(r => ({ dep: up(r.departure || r.departureId || r.dep), arr: up(r.arrival || r.arrivalId || r.arr), route: String(r.route || '').slice(0, 400) }))
        .filter(r => isIcao(r.dep) && isIcao(r.arr));
      const icaos = (Array.isArray(e.airports) ? e.airports : []).map(a => typeof a === 'string' ? a : a && (a.icao || a.id)).concat(routes.flatMap(r => [r.dep, r.arr]));
      return {
        id: 'ivao-' + e.id, network: 'ivao', type: String(e.eventType || 'event').replace(/_/g, ' '),
        name: String(e.title || e.name || 'Event').slice(0, 120), start: time(e.startDate), end: time(e.endDate),
        link: https(e.infoUrl), banner: https(e.imageUrl),
        description: plainText(e.description, 3000),
        organisers: (Array.isArray(e.divisions) ? e.divisions : []).slice(0, 4).map(String),
        airports: locate(icaos, lookupAirport), routes
      };
    }).filter(e => e.start && e.end);
}

let cache = null, inflight = null;
async function fetchEvents(fetchFn, opts) {
  opts = opts || {};
  if (!opts.force && cache && Date.now() - cache.at < CACHE_MS) return cache.data;
  if (inflight) return inflight;
  inflight = (async () => {
    const get = async (url, norm) => {
      try {
        const res = await fetchFn(url, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return { ok: true, events: norm(await res.json(), opts.lookupAirport) };
      } catch (e) { return { ok: false, error: e.message || String(e), events: [] }; }
    };
    const [v, i] = await Promise.all([get(VATSIM_EVENTS_URL, normVatsim), get(IVAO_EVENTS_URL, normIvao)]);
    const prev = cache && cache.data;
    // Réseau en panne : on garde ses derniers events connus plutôt que rien.
    const pick = (r, net) => r.ok ? r.events : (prev ? prev.events.filter(e => e.network === net) : []);
    const now = Date.now();
    const events = pick(v, 'vatsim').concat(pick(i, 'ivao'))
      .filter(e => e.end >= now - 3600000)
      .sort((a, b) => a.start - b.start || a.name.localeCompare(b.name));
    const data = { ok: true, at: now, events, status: { vatsim: v.ok ? { ok: true, count: v.events.length } : { ok: false, error: v.error }, ivao: i.ok ? { ok: true, count: i.events.length } : { ok: false, error: i.error } } };
    cache = { at: now, data };
    return data;
  })();
  try { return await inflight; } finally { inflight = null; }
}

module.exports = { fetchEvents, normVatsim, normIvao, plainText, _reset: () => { cache = null; } };
