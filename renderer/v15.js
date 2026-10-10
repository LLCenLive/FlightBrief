/* =========================================================
   FlightBrief 1.5 — nouveautés de l'interface
   ---------------------------------------------------------
   Chargé après app.js (dont il réutilise les fonctions globales : db, el, escapeHtml,
   saveDbNow, _overlayTelemetry…). Regroupe :
     1. Début de descente (TOD) + heure d'arrivée (ETA) en direct
     2. Carte d'atterrissage (appli + overlay OBS) et note
     3. Succès
     4. Approche finale rejouée en 3D
     5. ATC VATSIM en ligne
     6. Sauvegardes automatiques
     7. Mise à jour en un clic
     8. Bot Twitch + paris + overlay Alertes
   ========================================================= */
(function(){
'use strict';
const FBv15 = {};
window.FBv15 = FBv15;

const $ = id => document.getElementById(id);
const esc = s => escapeHtml(s == null ? '' : String(s));
const nm = (a, b) => FBShared.haversineNm(a.lat, a.lon, b.lat, b.lon);

/* =========================================================
   1. TOD + ETA EN DIRECT
   ---------------------------------------------------------
   Avec un OFP SimBrief qui correspond au vol (même départ/arrivée) : distance restante
   le long de la route (points du navlog) et position du point TOD calculé par SimBrief.
   Sinon : distance directe jusqu'à l'arrivée du Briefing et TOD estimé sur une pente de
   3° (≈ 318 ft par NM) depuis l'altitude actuelle jusqu'à l'altitude du terrain.
   ========================================================= */
const etaState = { arrIcao: null, arr: null, lastVs: [] };

function routeOfp(arrIcao, depIcao){
  const o = db.ofp;
  if(!o || !Array.isArray(o.navlog) || o.navlog.length < 2) return null;
  if(arrIcao && o.arr && o.arr !== arrIcao) return null;
  if(depIcao && o.dep && o.dep !== depIcao) return null;
  return o;
}
function legsSum(fixes, from, to){
  let d = 0;
  for(let i = from; i < to; i++) d += nm(fixes[i], fixes[i + 1]);
  return d;
}
async function ensureArrAirport(icao){
  if(etaState.arrIcao === icao) return etaState.arr;
  etaState.arrIcao = icao; etaState.arr = null;
  if(!icao) return null;
  try{ etaState.arr = await window.api.lookupAirport(icao); }catch(e){ etaState.arr = null; }
  return etaState.arr;
}
function computeEta(t){
  const arrIcao = (el('arrIcao').value || '').trim().toUpperCase();
  const depIcao = (el('depIcao').value || '').trim().toUpperCase();
  ensureArrAirport(arrIcao);
  const out = { etaIso: null, etaMin: null, todMin: null, todNm: null, todState: null, remainingNm: null, source: null };
  if(t.lat == null || t.lon == null) return out;
  const pos = { lat: t.lat, lon: t.lon };
  const gs = t.gsKt || 0;
  etaState.lastVs.push(t.vsFpm || 0); if(etaState.lastVs.length > 20) etaState.lastVs.shift();
  const vsAvg = etaState.lastVs.reduce((a, b) => a + b, 0) / etaState.lastVs.length;

  const o = routeOfp(arrIcao, depIcao);
  if(o){
    const fx = o.navlog;
    let k = 0, best = Infinity;
    fx.forEach((f, i) => { const d = nm(pos, f); if(d < best){ best = d; k = i; } });
    // Point « suivant » : le plus proche s'il est encore devant nous, sinon celui d'après.
    let next = k;
    if(k < fx.length - 1){
      const leg = nm(fx[k], fx[k + 1]);
      if(nm(pos, fx[k + 1]) <= leg + 0.5) next = k + 1;
    }
    out.remainingNm = nm(pos, fx[next]) + legsSum(fx, next, fx.length - 1);
    const tod = fx.findIndex(f => f.id === 'TOD');
    if(tod >= 0){
      if(tod >= next) out.todNm = nm(pos, fx[next]) + legsSum(fx, next, tod);
      else out.todState = 'passed';
    }
    out.source = 'ofp';
  } else if(etaState.arr){
    out.remainingNm = nm(pos, etaState.arr);
    const elev = etaState.arr.elevFt || 0;
    const descentNm = Math.max(0, ((t.altFt || 0) - elev - 1500) / 318) + 5; // 3° + ~5 NM de palier/approche
    out.todNm = out.remainingNm - descentNm;
    out.source = 'direct';
  }
  if(out.todNm != null && out.todNm <= 0){ out.todState = vsAvg < -300 ? 'passed' : 'now'; out.todNm = 0; }
  if(out.todState !== 'passed' && vsAvg < -700 && (t.altFt || 0) < ((db.ofp && db.ofp.cruiseAltFt) || 99999) - 2000 && out.todNm != null && out.todNm < 40) out.todState = 'passed';
  if(gs >= 50 && out.remainingNm != null){
    out.etaMin = out.remainingNm / gs * 60;
    out.etaIso = new Date(Date.now() + out.etaMin * 60000).toISOString();
    if(out.todNm != null && out.todState !== 'passed') out.todMin = out.todNm / gs * 60;
  }
  return out;
}
function renderEtaTiles(r){
  const tod = $('trkTod'), eta = $('trkEta'), src = $('trkEtaSource');
  if(!tod) return;
  if(!r){ tod.textContent = '—'; eta.textContent = '—'; src.textContent = ''; return; }
  tod.textContent = r.todState === 'passed' ? 'En descente' : r.todMin != null ? (r.todMin < 1 ? 'Maintenant' : `dans ${fmtMinShort(r.todMin)}${r.todNm != null ? ' · ' + Math.round(r.todNm) + ' NM' : ''}`) : '—';
  eta.textContent = r.etaIso ? `${new Date(r.etaIso).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })} · ${Math.round(r.remainingNm)} NM` : '—';
  src.textContent = r.source === 'ofp' ? 'TOD et distance restante calculés le long de la route de l\'OFP SimBrief.'
    : r.source === 'direct' ? 'Sans OFP SimBrief pour ce vol : distance directe jusqu\'à l\'arrivée, début de descente estimé sur une pente de 3°.' : '';
}
function clearEta(){
  ['etaIso','etaMin','todMin','todNm','todState','remainingNm'].forEach(k => { _overlayTelemetry[k] = null; });
  etaState.lastVs = [];
  renderEtaTiles(null);
}
function initEta(){
  if(!window.tracker) return;
  window.tracker.onTelemetry(d => {
    if(d.phase !== 'airborne'){ if(d.phase === 'landed' || d.phase === 'ground') clearEta(); return; }
    const r = computeEta(d);
    Object.assign(_overlayTelemetry, { etaIso: r.etaIso, etaMin: r.etaMin, todMin: r.todMin, todNm: r.todNm, todState: r.todState, remainingNm: r.remainingNm });
    renderEtaTiles(r);
    renderLiveOverlayPreview();
    pushLiveOverlayTelemetry();
  });
  window.tracker.onStatus(d => { if(!d.connected) clearEta(); });
}

/* =========================================================
   2. CARTE D'ATTERRISSAGE
   ========================================================= */
const ALERT_THEMES = {
  flightbrief: { label: 'FlightBrief', bg: '#181e25', bg2: '#0c1014', text: '#e7edf2', sub: '#8a96a2', opacity: 94, blur: false, accent: '#54d6e8' },
  glass:       { label: 'Verre', bg: '#1b2430', bg2: '#0f141b', text: '#ffffff', sub: '#b7c3cf', opacity: 62, blur: true, accent: '#7cc4ff' },
  neon:        { label: 'Néon', bg: '#07080d', bg2: '#07080d', text: '#f2f5ff', sub: '#8d93b8', opacity: 88, blur: false, accent: '#bf5af2' },
  minimal:     { label: 'Minimal', bg: '#0b0e12', bg2: '#0b0e12', text: '#f0f3f6', sub: '#8a96a2', opacity: 80, blur: false, accent: '#39e88f' },
  light:       { label: 'Clair', bg: '#ffffff', bg2: '#eef2f6', text: '#0f1720', sub: '#5b6875', opacity: 96, blur: false, accent: '#2563eb' }
};
// Cartes d'événement : couleur propre à chaque type ('' = couleur par défaut) et titre modifiable.
const ALERT_CARD_TYPES = [
  { k: 'landing', icon: '🛬', label: 'Atterrissage', def: '#54d6e8', title: 'Atterrissage', grade: true },
  { k: 'bet', icon: '🎯', label: 'Paris', def: '#ffd166' },
  { k: 'achievement', icon: '🏆', label: 'Succès', def: '#ffd166', title: 'Succès débloqué' },
  { k: 'chat', icon: '💬', label: 'Réponse du bot', def: '#9146ff' }
];
function defaultAlertCards(){ return { landing: { color: '', byGrade: true, label: '' }, bet: { color: '', label: '' }, achievement: { color: '', label: '' }, chat: { color: '', label: '' } }; }
function defaultAlertStyle(theme){
  const t = ALERT_THEMES[theme] || ALERT_THEMES.flightbrief;
  return { theme: theme || 'flightbrief', bg: t.bg, bg2: t.bg2, gradient: t.bg2 !== t.bg, text: t.text, sub: t.sub, opacity: t.opacity, accent: t.accent, accentMode: 'type',
    font: "'Space Grotesk',sans-serif", width: 420, textScale: 100, radius: 18, animation: 'drop', border: true, borderColor: theme === 'light' ? '#0f1720' : '#e7edf2', borderWidth: 1,
    stripe: true, shadow: true, blur: t.blur, timer: true, sound: false, volume: 60, matchLive: false, cards: defaultAlertCards() };
}
function alertsCfg(){
  db.alertsOverlay = Object.assign({ durationSec: 9, position: 'top-right', scale: 100, types: { landing: true, bet: true, achievement: true, chat: true } }, db.alertsOverlay || {});
  db.alertsOverlay.types = Object.assign({ landing: true, bet: true, achievement: true, chat: true }, db.alertsOverlay.types || {});
  const st = db.alertsOverlay.style || {};
  db.alertsOverlay.style = Object.assign(defaultAlertStyle(st.theme), st);
  // Fusion EN PLACE (les objets doivent rester les mêmes : le formulaire garde des références).
  const def = defaultAlertCards(), cards = db.alertsOverlay.style.cards = (st.cards && typeof st.cards === 'object') ? st.cards : {};
  Object.keys(def).forEach(k => { const cur = cards[k] || (cards[k] = {}); Object.keys(def[k]).forEach(x => { if(!(x in cur)) cur[x] = def[k][x]; }); });
  return db.alertsOverlay;
}
function hexToRgbaStr(hex, pct){
  const h = String(hex || '#e7edf2').replace('#', ''), n = h.length === 3 ? h.split('').map(c => c + c).join('') : h.padEnd(6, '0');
  return `rgba(${parseInt(n.slice(0, 2), 16) || 0},${parseInt(n.slice(2, 4), 16) || 0},${parseInt(n.slice(4, 6), 16) || 0},${(pct / 100).toFixed(2)})`;
}
// Style réellement envoyé à OBS : en mode « Assortir », les réglages visuels viennent de
// l'overlay live (Outil Live) et suivent ses changements.
function effectiveAlertStyle(){
  const st = alertsCfg().style;
  if(!st.matchLive) return { ...st };
  const lo = (db.liveOverlay && db.liveOverlay.style) || {};
  return { ...st, theme: 'custom', bg: lo.bg || '#0a0d11', bg2: lo.bg || '#0a0d11', gradient: false, text: lo.text || '#e7edf2', sub: hexToRgbaStr(lo.text || '#e7edf2', 62),
    opacity: lo.bgOpacity != null ? lo.bgOpacity : 78, accent: lo.accent || '#39e88f', font: lo.font || st.font, radius: lo.radius != null ? lo.radius : 12,
    border: lo.border !== false, borderColor: lo.borderColor || '#ffffff', borderAlpha: 22, borderWidth: 1, shadow: lo.shadow !== false, blur: lo.blur !== false };
}
function alertsPayload(){ const c = alertsCfg(); return { ...c, style: effectiveAlertStyle() }; }
function landingAlertData(d){
  const cat = currentFlightCategory(d);
  const zone = d.zone || (d.touchdown && d.touchdown.zone) || null;
  const sc = FBShared.landingScore({ fpm: d.landingRate, gForce: d.gForce, bounces: d.bounceCount || 0, zone }, cat);
  const grade = FBShared.landingGrade(d.landingRate, cat);
  return {
    fpm: d.landingRate, gForce: d.gForce, bounces: d.bounceCount || 0,
    score: sc ? sc.score : null, letter: sc ? sc.letter : null, color: sc ? sc.color : '#7c8894',
    gradeLabel: grade ? grade.label.replace(/\s*\(.*\)$/, '') : null, gradeColor: grade ? grade.color : null,
    windDir: d.windDir, windKt: d.windKt, crosswindKt: d.crosswindKt, headwindKt: d.headwindKt,
    icao: d.arr ? d.arr.icao : null, airport: d.arr ? d.arr.name : null,
    zone: zone ? { runway: zone.runway, lengthFt: zone.lengthFt, distanceFromThresholdFt: zone.distanceFromThresholdFt, percentAlongRunway: zone.percentAlongRunway, lateralOffsetFt: zone.lateralOffsetFt, side: zone.side } : null,
    callsign: (el('callsign').value || '').trim() || null
  };
}
FBv15.onLanded = function(d){
  if(!d || d.landingRate == null) return;
  const a = landingAlertData(d);
  showLandingToast(a);
  if(window.alerts && alertsCfg().types.landing) window.alerts.push({ type: 'landing', title: 'Atterrissage', data: a });
  if(window.twitch) window.twitch.landingInfo({ fpm: a.fpm, icao: a.icao, gForce: a.gForce, grade: a.letter, bounces: a.bounces });
};

function fx(html, cls, ms){
  const stack = $('fxStack');
  if(!stack) return null;
  const n = document.createElement('div');
  n.className = 'fx-card ' + (cls || '');
  n.innerHTML = html + '<button class="fx-close" title="Fermer">×</button>';
  stack.appendChild(n);
  requestAnimationFrame(() => n.classList.add('in'));
  const close = () => { n.classList.remove('in'); n.classList.add('out'); setTimeout(() => n.remove(), 350); };
  n.querySelector('.fx-close').onclick = close;
  if(ms) setTimeout(close, ms);
  return n;
}
function landingCardHtml(a){
  const wind = a.windKt != null ? `${String(a.windDir ?? 0).padStart(3,'0')}/${a.windKt}` : '—';
  const xw = a.crosswindKt != null ? `${Math.abs(a.crosswindKt)} kt` : '—';
  return `<div class="lc-top">
      <div class="lc-letter" style="--sc:${a.color}">${esc(a.letter || '—')}</div>
      <div class="lc-main">
        <div class="lc-eyebrow">Atterrissage${a.icao ? ' · ' + esc(a.icao) : ''}${a.zone ? ' · piste ' + esc(a.zone.runway.split('/')[0]) : ''}</div>
        <div class="lc-fpm">${esc(FBShared.fmtFpm(a.fpm))}</div>
        <div class="lc-grade" style="color:${a.gradeColor || 'inherit'}">${esc(a.gradeLabel || '')}${a.score != null ? ` · ${a.score}/100` : ''}</div>
      </div>
    </div>
    <div class="lc-stats">
      <div><span>Facteur G</span><b>${a.gForce != null ? a.gForce.toFixed(2) : '—'}</b></div>
      <div><span>Rebonds</span><b>${a.bounces || 0}</b></div>
      <div><span>Vent</span><b>${wind}</b></div>
      <div><span>Travers</span><b>${xw}</b></div>
    </div>
    ${a.zone ? `<div class="lc-rwy">${FBShared.runwayDiagramSvg(a.zone, { width: 300, height: 70, fluid: true })}</div>` : ''}`;
}
function showLandingToast(a){ fx(landingCardHtml(a), 'fx-landing', 14000); }

/* =========================================================
   3. SUCCÈS, XP ET RANGS (v1.5, étendus en v1.6)
   ---------------------------------------------------------
   Chaque succès a un palier (bronze, argent, or, platine) qui rapporte de l'XP FlightBrief.
   L'XP = succès débloqués + 10 XP par vol enregistré. Elle donne un rang (9 rangs).
   ========================================================= */
const WORLD_NM = 21600;
const TIERS = { bronze: { label: 'Bronze', xp: 50, color: '#d08b52' }, silver: { label: 'Argent', xp: 120, color: '#c3ccd6' }, gold: { label: 'Or', xp: 300, color: '#ffd166' }, platinum: { label: 'Platine', xp: 750, color: '#9fe3ff' } };
const XP_PER_FLIGHT = 10;
const RANKS = [
  { xp: 0,     name: 'Élève pilote',        icon: '🪶' },
  { xp: 300,   name: 'Pilote privé',        icon: '🛩️' },
  { xp: 800,   name: 'Pilote professionnel', icon: '🧭' },
  { xp: 1600,  name: 'Copilote',            icon: '👨‍✈️' },
  { xp: 3000,  name: 'Commandant de bord',  icon: '⭐' },
  { xp: 5000,  name: 'Instructeur',         icon: '🎓' },
  { xp: 8000,  name: 'Chef pilote',         icon: '🎖️' },
  { xp: 12000, name: "Pilote d'essai",      icon: '🚀' },
  { xp: 18000, name: "Légende de l'air",    icon: '👑' }
];
const ACH_CATS = { carnet: 'Carnet de vol', landing: 'Atterrissages', explore: 'Exploration', online: 'Réseaux & ATC', stream: 'Stream', fleet: 'Hangar & carrière' };
// Pays approximatif depuis le préfixe OACI (assez juste pour compter des pays visités).
function countryOf(icao){
  const c = FBShared.up(icao);
  if(!/^[A-Z]{2}/.test(c)) return null;
  const a = c[0], two = c.slice(0, 2);
  if(a === 'K' || ['PA','PH','PF','PO','PP','PG','PW'].includes(two)) return 'US';
  if(a === 'C') return 'CA';
  if(a === 'Y') return 'AU';
  if(a === 'Z' && !['ZK','ZM'].includes(two)) return 'CN';
  if(a === 'U' && !['UA','UB','UC','UD','UG','UK','UM','UT'].includes(two)) return 'RU';
  return two;
}
let _extraStats = { shots: 0, betsResolved: 0 };
function achievementStats(){
  const lb = db.logbook || [];
  const lookup = cachedAirportLookup;
  const s = { flights: lb.length, minutes: 0, nm: 0, airports: new Set(), continents: new Set(), countries: new Set(), frAirports: new Set(),
    butter: 0, perfect: 0, longest: 0, shortest: Infinity, night: 0, ifr: 0, vfr: 0, crosswind15: 0, crosswind25: 0, cleanStreak: 0, bestCleanStreak: 0,
    vatsim: 0, ivao: 0, vatsimMin: 0, ivaoMin: 0, online: 0, atcArr: 0, featherG: 0, tdz: 0, centerline: 0, fl400: 0, highAp: 0,
    heavy: 0, light: 0, bestStreakDays: 0, maxPerDay: 0 };
  const sorted = [...lb].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  const days = new Map();
  const cats = {};
  (db.hangar || []).forEach(h => { cats[h.id] = h.category; });
  sorted.forEach(f => {
    const min = f.durationMin || 0;
    s.minutes += min;
    s.longest = Math.max(s.longest, min);
    if(min > 0) s.shortest = Math.min(s.shortest, min);
    if(f.rules === 'IFR') s.ifr++; else if(f.rules === 'VFR') s.vfr++;
    const d = FBShared.flightDistance(f, lookup); if(d.nm != null) s.nm += d.nm;
    [f.dep, f.arr].forEach(icao => {
      const k = FBShared.up(icao); if(!k) return;
      s.airports.add(k);
      if(k.startsWith('LF')) s.frAirports.add(k);
      const ap = lookup(k);
      const c = FBShared.continentOf(k, ap ? ap.lon : null); if(c) s.continents.add(c);
      const co = countryOf(k); if(co) s.countries.add(co);
    });
    const arrAp = lookup(FBShared.up(f.arr));
    if(arrAp && arrAp.elevFt >= 5000) s.highAp++;
    const net = String(f.network || '').toUpperCase();
    if(net.includes('VATSIM')){ s.vatsim++; s.vatsimMin += min; s.online++; }
    else if(net.includes('IVAO')){ s.ivao++; s.ivaoMin += min; s.online++; }
    const lr = FBShared.flightLandingRate(f);
    if(lr != null && Math.abs(lr) > 0 && Math.abs(lr) < 100) s.butter++;
    const sc = FBShared.flightLandingScore(f);
    if(sc && sc.letter === 'A+') s.perfect++;
    const td = f.trackData && f.trackData.touchdown;
    let night = f.trackData ? f.trackData.night : null;
    if(night == null && td && td.lat != null){
      const ts = td.ts || (f.trackData.path && f.trackData.path.length ? f.trackData.path[f.trackData.path.length - 1].ts : null);
      if(ts) night = FBShared.isNightAt(td.lat, td.lon, ts);
    }
    if(night) s.night++;
    if(td && td.crosswindKt != null){ if(Math.abs(td.crosswindKt) >= 15) s.crosswind15++; if(Math.abs(td.crosswindKt) >= 25) s.crosswind25++; }
    if(td && td.gForce != null && td.gForce <= 1.10) s.featherG++;
    if(td && td.zone){
      if(td.zone.distanceFromThresholdFt >= 500 && td.zone.distanceFromThresholdFt <= 2000) s.tdz++;
      if(td.zone.lateralOffsetFt != null && td.zone.lateralOffsetFt <= 5) s.centerline++;
    }
    if(f.trackData && f.trackData.maxAltFt >= 39500) s.fl400++;
    if(f.trackData && f.trackData.atc && f.trackData.atc.arr > 0) s.atcArr++;
    if(f.trackData && lr != null){
      if(!f.trackData.bounceCount){ s.cleanStreak++; s.bestCleanStreak = Math.max(s.bestCleanStreak, s.cleanStreak); }
      else s.cleanStreak = 0;
    }
    const cat = (f.aircraftId && cats[f.aircraftId]) || FBShared.flightCategory(f);
    if(cat === 'heavy' || cat === 'jumbo') s.heavy++;
    if(cat === 'light') s.light++;
    if(f.date) days.set(f.date, (days.get(f.date) || 0) + 1);
  });
  // Jours de vol consécutifs + record de vols en une journée.
  const dl = [...days.keys()].sort();
  let run = 0, prev = null;
  dl.forEach(dd => { const t = new Date(dd + 'T12:00:00').getTime(); run = prev != null && Math.round((t - prev) / 86400000) === 1 ? run + 1 : 1; prev = t; s.bestStreakDays = Math.max(s.bestStreakDays, run); });
  days.forEach(n => { s.maxPerDay = Math.max(s.maxPerDay, n); });
  if(s.shortest === Infinity) s.shortest = 0;
  s.hours = s.minutes / 60;
  s.vatsimHours = s.vatsimMin / 60; s.ivaoHours = s.ivaoMin / 60;
  s.toursDone = (db.careers || []).reduce((n, c) => n + (c.tours || []).filter(t => FBShared.tourIsComplete(t)).length, 0);
  s.fleet = (db.hangar || []).length;
  s.shots = _extraStats.shots; s.betsResolved = _extraStats.betsResolved;
  s.botReady = !!(db.twitch && db.twitch.clientId && db.twitch.enabled);
  return s;
}
const fmtInt = v => Math.floor(v).toLocaleString('fr-FR');
const ACHIEVEMENTS = [
  // Carnet de vol
  { id:'first-flight', cat:'carnet', tier:'bronze', icon:'🛫', title:'Premier vol', desc:'Enregistrer un premier vol.', target:1, val:s => s.flights },
  { id:'flights-10', cat:'carnet', tier:'bronze', icon:'🧭', title:'Habitué', desc:'10 vols au logbook.', target:10, val:s => s.flights },
  { id:'flights-50', cat:'carnet', tier:'silver', icon:'🎖️', title:'Pilote de ligne', desc:'50 vols au logbook.', target:50, val:s => s.flights },
  { id:'flights-100', cat:'carnet', tier:'gold', icon:'💯', title:'Centurion', desc:'100 vols au logbook.', target:100, val:s => s.flights },
  { id:'flights-250', cat:'carnet', tier:'gold', icon:'👑', title:'Commandant de bord', desc:'250 vols au logbook.', target:250, val:s => s.flights },
  { id:'flights-500', cat:'carnet', tier:'platinum', icon:'🏛️', title:'Institution', desc:'500 vols au logbook.', target:500, val:s => s.flights },
  { id:'hours-10', cat:'carnet', tier:'bronze', icon:'⏱️', title:'10 heures', desc:'10 h de vol cumulées.', target:10, val:s => s.hours },
  { id:'hours-100', cat:'carnet', tier:'silver', icon:'⌛', title:'100 heures', desc:'100 h de vol cumulées.', target:100, val:s => s.hours },
  { id:'hours-500', cat:'carnet', tier:'gold', icon:'🕰️', title:'500 heures', desc:'500 h de vol cumulées.', target:500, val:s => s.hours },
  { id:'hours-1000', cat:'carnet', tier:'platinum', icon:'🏆', title:'1 000 heures', desc:'1 000 h de vol cumulées.', target:1000, val:s => s.hours },
  { id:'short', cat:'carnet', tier:'bronze', icon:'🐇', title:'Saut de puce', desc:'Un vol de moins de 20 minutes.', target:1, val:s => s.shortest > 0 && s.shortest < 20 ? 1 : 0 },
  { id:'long-haul', cat:'carnet', tier:'silver', icon:'🌏', title:'Long-courrier', desc:'Un vol de plus de 8 heures.', target:480, val:s => s.longest, fmt:v => FBShared.fmtHm(v) },
  { id:'ultra-long', cat:'carnet', tier:'platinum', icon:'🛰️', title:'Ultra long-courrier', desc:'Un vol de plus de 14 heures.', target:840, val:s => s.longest, fmt:v => FBShared.fmtHm(v) },
  { id:'fl400', cat:'carnet', tier:'silver', icon:'🌌', title:'Stratosphère', desc:'Monter au FL400 ou plus (vol suivi).', target:1, val:s => s.fl400 },
  { id:'busy-day', cat:'carnet', tier:'bronze', icon:'📅', title:'Journée chargée', desc:'3 vols le même jour.', target:3, val:s => s.maxPerDay },
  { id:'streak-7', cat:'carnet', tier:'gold', icon:'🔥', title:'Assidu', desc:'Voler 7 jours d\'affilée.', target:7, val:s => s.bestStreakDays },
  { id:'ifr-25', cat:'carnet', tier:'silver', icon:'📡', title:'Aux instruments', desc:'25 vols IFR.', target:25, val:s => s.ifr },
  { id:'vfr-25', cat:'carnet', tier:'silver', icon:'👀', title:'Vue du ciel', desc:'25 vols VFR.', target:25, val:s => s.vfr },
  { id:'night-1', cat:'carnet', tier:'bronze', icon:'🌙', title:'Première nuit', desc:'Un atterrissage de nuit.', target:1, val:s => s.night },
  { id:'night-10', cat:'carnet', tier:'silver', icon:'🦉', title:'Oiseau de nuit', desc:'10 atterrissages de nuit.', target:10, val:s => s.night },
  { id:'night-50', cat:'carnet', tier:'gold', icon:'🌃', title:'Noctambule', desc:'50 atterrissages de nuit.', target:50, val:s => s.night },
  // Atterrissages
  { id:'butter', cat:'landing', tier:'bronze', icon:'🧈', title:'Beurre', desc:'Un atterrissage à moins de 100 ft/min.', target:1, val:s => s.butter },
  { id:'butter-10', cat:'landing', tier:'silver', icon:'🥐', title:'Boulanger', desc:'10 atterrissages à moins de 100 ft/min.', target:10, val:s => s.butter },
  { id:'butter-25', cat:'landing', tier:'gold', icon:'🧁', title:'Pâtissier étoilé', desc:'25 atterrissages à moins de 100 ft/min.', target:25, val:s => s.butter },
  { id:'perfect', cat:'landing', tier:'silver', icon:'💎', title:'Copie parfaite', desc:"Une note d'atterrissage A+.", target:1, val:s => s.perfect },
  { id:'perfect-5', cat:'landing', tier:'gold', icon:'💠', title:'Perfectionniste', desc:"5 notes d'atterrissage A+.", target:5, val:s => s.perfect },
  { id:'feather', cat:'landing', tier:'silver', icon:'🪶', title:'Plume', desc:'Toucher avec un facteur de charge ≤ 1,10 G.', target:1, val:s => s.featherG },
  { id:'tdz-10', cat:'landing', tier:'silver', icon:'🎯', title:'Dans la zone', desc:'10 touchers entre 500 et 2 000 ft après le seuil.', target:10, val:s => s.tdz },
  { id:'centerline', cat:'landing', tier:'silver', icon:'📏', title:"Sur l'axe", desc:"Toucher à moins de 5 ft de l'axe de piste.", target:1, val:s => s.centerline },
  { id:'clean-10', cat:'landing', tier:'silver', icon:'✅', title:'Sans rebond', desc:"10 atterrissages trackés d'affilée sans rebond.", target:10, val:s => s.bestCleanStreak },
  { id:'crosswind', cat:'landing', tier:'silver', icon:'🌬️', title:'Vent de travers', desc:'Se poser avec au moins 15 kt de vent traversier.', target:1, val:s => s.crosswind15 },
  { id:'crosswind-25', cat:'landing', tier:'gold', icon:'🌪️', title:'Tempête', desc:'Se poser avec au moins 25 kt de vent traversier.', target:1, val:s => s.crosswind25 },
  // Exploration
  { id:'nm-10k', cat:'explore', tier:'silver', icon:'📐', title:'10 000 NM', desc:'10 000 milles nautiques parcourus.', target:10000, val:s => s.nm, fmt:fmtInt },
  { id:'world-tour', cat:'explore', tier:'gold', icon:'🌍', title:'Tour du monde', desc:"L'équivalent d'un tour de la Terre (21 600 NM).", target:WORLD_NM, val:s => s.nm, fmt:fmtInt },
  { id:'nm-50k', cat:'explore', tier:'platinum', icon:'🪐', title:'Grand voyageur', desc:'50 000 milles nautiques parcourus.', target:50000, val:s => s.nm, fmt:fmtInt },
  { id:'airports-25', cat:'explore', tier:'silver', icon:'📍', title:'Collectionneur', desc:'25 aéroports différents.', target:25, val:s => s.airports.size },
  { id:'airports-100', cat:'explore', tier:'gold', icon:'🧳', title:'Explorateur', desc:'100 aéroports différents.', target:100, val:s => s.airports.size },
  { id:'france-10', cat:'explore', tier:'bronze', icon:'🥖', title:'Tour de France', desc:'10 aéroports français différents.', target:10, val:s => s.frAirports.size },
  { id:'france-50', cat:'explore', tier:'gold', icon:'🗼', title:"L'Hexagone par cœur", desc:'50 aéroports français différents.', target:50, val:s => s.frAirports.size },
  { id:'countries-10', cat:'explore', tier:'silver', icon:'🛂', title:'Passeport tamponné', desc:'Se poser dans 10 pays.', target:10, val:s => s.countries.size },
  { id:'countries-30', cat:'explore', tier:'gold', icon:'🗺️', title:'Diplomate', desc:'Se poser dans 30 pays.', target:30, val:s => s.countries.size },
  { id:'continents-3', cat:'explore', tier:'silver', icon:'🧭', title:'Intercontinental', desc:'Poser les roues sur 3 continents.', target:3, val:s => s.continents.size },
  { id:'continents-all', cat:'explore', tier:'gold', icon:'🌐', title:'Globe-trotter', desc:'Les 6 continents habités.', target:6, val:s => s.continents.size },
  { id:'mountain', cat:'explore', tier:'silver', icon:'🏔️', title:'Montagnard', desc:"Se poser sur un terrain à plus de 5 000 ft d'altitude.", target:1, val:s => s.highAp },
  // Réseaux & ATC
  { id:'vatsim-1', cat:'online', tier:'bronze', icon:'🟢', title:'Bienvenue sur VATSIM', desc:'Un premier vol sur VATSIM (réseau du logbook).', target:1, val:s => s.vatsim },
  { id:'vatsim-10', cat:'online', tier:'silver', icon:'📻', title:'Habitué de VATSIM', desc:'10 vols sur VATSIM.', target:10, val:s => s.vatsim },
  { id:'vatsim-50', cat:'online', tier:'gold', icon:'🛰️', title:'Pilier de VATSIM', desc:'50 vols sur VATSIM.', target:50, val:s => s.vatsim },
  { id:'vatsim-100h', cat:'online', tier:'gold', icon:'⏳', title:'100 h sur VATSIM', desc:'100 heures de vol sur VATSIM.', target:100, val:s => s.vatsimHours },
  { id:'ivao-1', cat:'online', tier:'bronze', icon:'🔵', title:'Bienvenue sur IVAO', desc:'Un premier vol sur IVAO (réseau du logbook).', target:1, val:s => s.ivao },
  { id:'ivao-10', cat:'online', tier:'silver', icon:'🎙️', title:"Habitué d'IVAO", desc:'10 vols sur IVAO.', target:10, val:s => s.ivao },
  { id:'ivao-50', cat:'online', tier:'gold', icon:'📡', title:"Pilier d'IVAO", desc:'50 vols sur IVAO.', target:50, val:s => s.ivao },
  { id:'ivao-100h', cat:'online', tier:'gold', icon:'⏳', title:'100 h sur IVAO', desc:'100 heures de vol sur IVAO.', target:100, val:s => s.ivaoHours },
  { id:'both-nets', cat:'online', tier:'silver', icon:'🤝', title:'Bi-réseau', desc:'Au moins un vol sur VATSIM et un sur IVAO.', target:2, val:s => (s.vatsim ? 1 : 0) + (s.ivao ? 1 : 0) },
  { id:'online-25', cat:'online', tier:'silver', icon:'🌐', title:'Toujours connecté', desc:'25 vols en ligne (VATSIM ou IVAO).', target:25, val:s => s.online },
  { id:'atc-1', cat:'online', tier:'bronze', icon:'🗼', title:'Sous contrôle', desc:"Se poser avec un contrôleur en ligne à l'arrivée (ATC activé sur la carte).", target:1, val:s => s.atcArr },
  { id:'atc-10', cat:'online', tier:'silver', icon:'🎧', title:'Bon élève de la phraséo', desc:"10 arrivées avec un contrôleur en ligne.", target:10, val:s => s.atcArr },
  // Stream
  { id:'bot-ready', cat:'stream', tier:'bronze', icon:'🤖', title:'Copilote numérique', desc:'Configurer et activer le bot Twitch.', target:1, val:s => s.botReady ? 1 : 0 },
  { id:'bets-1', cat:'stream', tier:'bronze', icon:'🎲', title:'Faites vos jeux', desc:"Un premier pari d'atterrissage terminé.", target:1, val:s => s.betsResolved },
  { id:'bets-25', cat:'stream', tier:'gold', icon:'🎰', title:'Croupier', desc:"25 paris d'atterrissage terminés.", target:25, val:s => s.betsResolved },
  { id:'shots-1', cat:'stream', tier:'bronze', icon:'📷', title:'Souvenir de vol', desc:"Une première capture d'écran.", target:1, val:s => s.shots },
  { id:'shots-50', cat:'stream', tier:'silver', icon:'🎞️', title:'Photographe', desc:"50 captures d'écran.", target:50, val:s => s.shots },
  // Hangar & carrière
  { id:'fleet-5', cat:'fleet', tier:'bronze', icon:'🛩️', title:'Hangar garni', desc:'5 avions dans le hangar.', target:5, val:s => s.fleet },
  { id:'fleet-10', cat:'fleet', tier:'silver', icon:'🏗️', title:'Compagnie aérienne', desc:'10 avions dans le hangar.', target:10, val:s => s.fleet },
  { id:'heavy', cat:'fleet', tier:'bronze', icon:'🐘', title:'Gros porteur', desc:'Un vol en avion « heavy » ou « jumbo » du hangar.', target:1, val:s => s.heavy },
  { id:'light', cat:'fleet', tier:'bronze', icon:'🪁', title:'Petit coucou', desc:'Un vol en avion léger du hangar.', target:1, val:s => s.light },
  { id:'tour-1', cat:'fleet', tier:'silver', icon:'🏁', title:'Tour bouclé', desc:'Terminer un tour de carrière.', target:1, val:s => s.toursDone },
  { id:'tour-5', cat:'fleet', tier:'gold', icon:'🗺️', title:'Globe-tourer', desc:'Terminer 5 tours de carrière.', target:5, val:s => s.toursDone }
];
function achState(){
  db.achievements = Object.assign({ unlocked: {}, initialized: false, rank: 0 }, db.achievements || {});
  db.achievements.unlocked = db.achievements.unlocked || {};
  return db.achievements;
}
function xpInfo(){
  const st = achState();
  const achXp = ACHIEVEMENTS.reduce((n, a) => n + (st.unlocked[a.id] ? TIERS[a.tier].xp : 0), 0);
  const xp = achXp + (db.logbook || []).length * XP_PER_FLIGHT;
  let idx = 0; RANKS.forEach((r, i) => { if(xp >= r.xp) idx = i; });
  const cur = RANKS[idx], next = RANKS[idx + 1] || null;
  const pct = next ? Math.round(100 * (xp - cur.xp) / (next.xp - cur.xp)) : 100;
  return { xp, achXp, idx, level: idx + 1, rank: cur, next, pct, unlocked: ACHIEVEMENTS.filter(a => st.unlocked[a.id]).length, total: ACHIEVEMENTS.length };
}
async function refreshExtraStats(){
  try{ if(window.shots){ const st = await window.shots.stats(); _extraStats.shots = st.count; } }catch(e){ /* ignoré */ }
  try{ if(twState && twState.betsResolved != null) _extraStats.betsResolved = twState.betsResolved; }catch(e){ /* ignoré */ }
}
async function evaluateAchievements(silent){
  // Distances estimées, continents, pays, altitude des terrains : coordonnées chargées d'abord.
  const icaos = new Set();
  (db.logbook || []).forEach(f => { [f.dep, f.arr].forEach(i => { const k = FBShared.up(i); if(k) icaos.add(k); }); });
  if(icaos.size) { try { await resolveAirportCoords([...icaos]); } catch(e){ /* ignoré */ } }
  await refreshExtraStats();
  const st = achState(), s = achievementStats(), fresh = [];
  const before = xpInfo().idx;
  ACHIEVEMENTS.forEach(a => {
    if(st.unlocked[a.id]) return;
    if(a.val(s) >= a.target){ st.unlocked[a.id] = new Date().toISOString(); fresh.push(a); }
  });
  const info = xpInfo();
  if(!st.initialized){ st.initialized = true; silent = true; }
  const rankUp = info.idx > (st.rank || 0) && info.idx > before;
  st.rank = info.idx;
  if(fresh.length || silent || rankUp) saveDbNow();
  if(!silent){
    fresh.forEach((a, i) => setTimeout(() => celebrate(a), 900 + i * 2200));
    if(rankUp) setTimeout(() => celebrateRank(info), 900 + fresh.length * 2200 + 400);
  }
  renderAchievements(s);
  return fresh;
}
function celebrate(a){
  const t = TIERS[a.tier];
  fx(`<div class="ach-toast"><div class="ach-burst" style="--tier:${t.color}">${a.icon}</div><div><div class="lc-eyebrow">Succès débloqué · <span style="color:${t.color}">${t.label} +${t.xp} XP</span></div><div class="ach-title">${esc(a.title)}</div><div class="hint" style="margin:0;">${esc(a.desc)}</div></div></div>`, 'fx-ach', 7000);
  if(window.alerts && alertsCfg().types.achievement) window.alerts.push({ type: 'achievement', title: a.title, text: `${a.desc} · ${t.label} +${t.xp} XP`, icon: a.icon });
}
function celebrateRank(info){
  fx(`<div class="rank-toast"><div class="rank-badge big lvl-${info.level}">${info.rank.icon}<b>${info.level}</b></div><div><div class="lc-eyebrow">Nouveau rang FlightBrief</div><div class="ach-title">${esc(info.rank.name)}</div><div class="hint" style="margin:0;">${fmtInt(info.xp)} XP${info.next ? ` · prochain rang : ${esc(info.next.name)} à ${fmtInt(info.next.xp)} XP` : ' · rang maximal !'}</div></div></div>`, 'fx-rank', 9000);
  if(window.alerts && alertsCfg().types.achievement) window.alerts.push({ type: 'achievement', title: 'Nouveau rang : ' + info.rank.name, text: `Niveau ${info.level} · ${fmtInt(info.xp)} XP FlightBrief`, icon: info.rank.icon });
}
// Onglet Profil : prénom (ou pseudo Twitch) + icône du rang — plus de pastille chiffrée qui
// ressemblait à un compteur de notifications.
function refreshNavProfile(info){
  info = info || xpInfo();
  const btn = document.querySelector('.tabs button[data-view="profil"]');
  const lbl = btn && btn.querySelector('.tab-label');
  if(!lbl) return;
  const p = db.userProfile || {};
  const name = (p.firstName || '').trim() || (p.twitchHandle || '').trim() || 'Profil';
  lbl.innerHTML = `<span class="nav-name">${esc(name)}</span><span class="nav-rank lvl-${info.level}">${info.rank.icon}</span>`;
  btn.title = `${name} · ${info.rank.name} (niveau ${info.level}, ${fmtInt(info.xp)} XP) — Ctrl+8`;
}
FBv15.refreshNavProfile = () => refreshNavProfile();
function rankBadge(info, cls){ return `<div class="rank-badge ${cls || ''} lvl-${info.level}" title="Niveau ${info.level}">${info.rank.icon}<b>${info.level}</b></div>`; }
// Carte « rang » du Profil + aperçu des derniers succès ; la liste complète est dans la modale.
function renderAchievements(s){
  const info = xpInfo();
  refreshNavProfile(info);
  const grid = $('achGrid');
  if(!grid) return;
  const st = achState();
  $('achCount').textContent = `${info.unlocked} / ${info.total} succès`;
  const recent = ACHIEVEMENTS.filter(a => st.unlocked[a.id]).sort((a, b) => String(st.unlocked[b.id]).localeCompare(String(st.unlocked[a.id]))).slice(0, 4);
  grid.innerHTML = `<div class="rank-card">
      ${rankBadge(info, 'big')}
      <div class="rank-main">
        <div class="lc-eyebrow">Rang FlightBrief · niveau ${info.level}</div>
        <div class="rank-name">${esc(info.rank.name)}</div>
        <div class="xp-bar"><i style="width:${info.pct}%"></i></div>
        <div class="xp-meta"><span>${fmtInt(info.xp)} XP</span><span>${info.next ? `${fmtInt(info.next.xp - info.xp)} XP avant « ${esc(info.next.name)} »` : 'Rang maximal atteint'}</span></div>
      </div>
      <button class="btn primary small" onclick="FBv15.openAchievements()">Voir tous les succès</button>
    </div>
    <div class="ach-recent">${recent.length ? recent.map(a => achTile(a, s, true)).join('') : '<div class="hint">Aucun succès pour l\'instant : enregistre un premier vol !</div>'}</div>`;
}
function achTile(a, s, compact){
  const st = achState();
  s = s || achievementStats();
  const unlocked = st.unlocked[a.id], t = TIERS[a.tier];
  const v = Math.min(a.val(s), a.target), pct = Math.round(100 * v / a.target);
  const f = a.fmt || fmtInt;
  return `<div class="ach ${unlocked ? 'on' : ''}${compact ? ' compact' : ''}" style="--tier:${t.color}" title="${esc(a.desc)}">
    <div class="ach-icon">${a.icon}</div>
    <div class="ach-body">
      <div class="ach-name">${esc(a.title)}</div>
      ${compact ? '' : `<div class="ach-desc">${esc(a.desc)}</div>`}
      <div class="ach-tier"><span>${t.label}</span><b>+${t.xp} XP</b></div>
      ${unlocked ? `<div class="ach-date">Débloqué le ${new Date(unlocked).toLocaleDateString('fr-FR')}</div>`
        : compact ? '' : `<div class="ach-prog"><i style="width:${pct}%"></i></div><div class="ach-date">${f(v)} / ${f(a.target)}</div>`}
    </div>
  </div>`;
}
let achFilter = { cat: 'all', state: 'all' };
FBv15.openAchievements = function(){
  $('achModalOverlay').classList.remove('hidden');
  renderAchModal();
};
FBv15.closeAchievements = () => $('achModalOverlay').classList.add('hidden');
FBv15.achSetFilter = (k, v) => { achFilter[k] = v; renderAchModal(); };
function renderAchModal(){
  const info = xpInfo(), st = achState(), s = achievementStats();
  $('achModalHead').innerHTML = `${rankBadge(info, 'big')}
    <div class="rank-main"><div class="lc-eyebrow">Niveau ${info.level} · ${info.unlocked} / ${info.total} succès</div><div class="rank-name">${esc(info.rank.name)}</div>
      <div class="xp-bar"><i style="width:${info.pct}%"></i></div>
      <div class="xp-meta"><span>${fmtInt(info.xp)} XP <small>(${fmtInt(info.achXp)} des succès + ${XP_PER_FLIGHT} XP par vol)</small></span><span>${info.next ? `Prochain : ${esc(info.next.name)} · ${fmtInt(info.next.xp)} XP` : 'Rang maximal'}</span></div></div>
    <div class="rank-ladder">${RANKS.map((r, i) => `<span class="${i <= info.idx ? 'on' : ''}${i === info.idx ? ' cur' : ''}" title="${esc(r.name)} · ${fmtInt(r.xp)} XP">${r.icon}</span>`).join('')}</div>`;
  const catCount = c => ACHIEVEMENTS.filter(a => a.cat === c).length, catDone = c => ACHIEVEMENTS.filter(a => a.cat === c && st.unlocked[a.id]).length;
  $('achModalFilters').innerHTML = `<div class="ach-chips">${[['all', 'Tous', ACHIEVEMENTS.length, info.unlocked], ...Object.entries(ACH_CATS).map(([k, l]) => [k, l, catCount(k), catDone(k)])].map(([k, l, n, d]) => `<button class="${achFilter.cat === k ? 'on' : ''}" onclick="FBv15.achSetFilter('cat','${k}')">${esc(l)} <small>${d}/${n}</small></button>`).join('')}</div>
    <div class="ach-chips">${[['all', 'Tous'], ['done', 'Débloqués'], ['todo', 'À faire']].map(([k, l]) => `<button class="${achFilter.state === k ? 'on' : ''}" onclick="FBv15.achSetFilter('state','${k}')">${l}</button>`).join('')}</div>`;
  const list = ACHIEVEMENTS.filter(a => (achFilter.cat === 'all' || a.cat === achFilter.cat) && (achFilter.state === 'all' || (achFilter.state === 'done') === !!st.unlocked[a.id]));
  // À faire : les plus avancés d'abord.
  const prog = a => Math.min(1, a.val(s) / a.target);
  list.sort((a, b) => (!!st.unlocked[b.id] - !!st.unlocked[a.id]) || (prog(b) - prog(a)));
  $('achModalGrid').innerHTML = list.length ? list.map(a => achTile(a, s, false)).join('') : '<div class="hint">Rien ici pour l\'instant.</div>';
}
FBv15.afterLogbookChange = () => evaluateAchievements(false);

/* =========================================================
   4. APPROCHE FINALE EN 3D
   ========================================================= */
const ap3d = { renderer: null, raf: null, scene: null, camera: null, controls: null, curve: null, plane: null, pts: [], playing: false, u: 1, exag: 1, view: 'chase', build: null, ro: null };
const FT = 0.3048;
function enu(origin, lat, lon){
  const cos = Math.cos(origin.lat * Math.PI / 180);
  return { x: (lon - origin.lon) * 111320 * cos, n: (lat - origin.lat) * 111320 };
}
FBv15.disposeApproach3D = function(){
  if(ap3d.raf) cancelAnimationFrame(ap3d.raf);
  ap3d.raf = null; ap3d.playing = false;
  if(ap3d.ro){ ap3d.ro.disconnect(); ap3d.ro = null; }
  if(ap3d.controls){ ap3d.controls.dispose(); ap3d.controls = null; }
  if(ap3d.scene){ ap3d.scene.traverse(o => { if(o.geometry) o.geometry.dispose(); if(o.material){ (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose()); } }); }
  if(ap3d.renderer){ ap3d.renderer.dispose(); if(ap3d.renderer.domElement.parentNode) ap3d.renderer.domElement.remove(); }
  ap3d.renderer = null; ap3d.scene = null; ap3d.camera = null; ap3d.curve = null; ap3d.plane = null;
};
FBv15.renderApproach3D = async function(f){
  FBv15.disposeApproach3D();
  renderRouteShots(f).catch(() => {});
  const sec = $('approach3dSection');
  if(!sec) return;
  const td = f && f.trackData;
  const t = td && td.touchdown;
  const z = t && t.zone;
  if(!window.THREE || !t || !z || z.thresholdLat == null || !Array.isArray(td.path)){
    sec.classList.toggle('hidden', !t);
    if(t) $('approach3dHint').textContent = !window.THREE ? 'Moteur 3D indisponible (connexion Internet nécessaire au premier chargement).' : 'Piste non identifiée pour ce vol : approche 3D indisponible.';
    if(t) $('approach3d').innerHTML = '';
    return;
  }
  const tdTs = t.ts || Infinity;
  const pts = td.path.filter(p => (p.phase === 'air' || p.phase === 'touchdown') && p.ts <= tdTs + 500 && FBShared.haversineNm(p.lat, p.lon, t.lat, t.lon) <= 6);
  if(!pts.some(p => p.phase === 'touchdown')) pts.push({ ...t, phase: 'touchdown' });
  if(pts.length < 4){
    sec.classList.remove('hidden');
    $('approach3d').innerHTML = '';
    $('approach3dHint').textContent = "Pas assez de points enregistrés sur les 6 derniers NM pour reconstituer l'approche.";
    return;
  }
  sec.classList.remove('hidden');
  const arrIcao = FBShared.up(f.arr || (td.arrGuess && td.arrGuess.icao));
  const ap = arrIcao ? (await resolveAirportCoords([arrIcao]))[arrIcao] : null;
  const elevFt = ap && ap.elevFt != null ? ap.elevFt : (t.altFt != null ? t.altFt : 0);
  const fine = pts.filter(p => p.aglFt != null).length > pts.length / 2;
  $('approach3dHint').innerHTML = `Trajectoire réelle (couleur = écart au plan de descente de 3° : <span style="color:#39e88f">vert</span> ±50 ft, <span style="color:#ffb020">orange</span> ±150 ft, <span style="color:#ff5c5c">rouge</span> au-delà). ${fine ? 'Un point par seconde sous 2 500 ft.' : 'Vol enregistré avant la v1.5 : un point toutes les 5 s, trajectoire lissée.'} Glisser pour tourner, molette pour zoomer.`;
  ap3d.build = { pts, z, t, elevFt };
  ap3d.exag = $('ap3dExag').checked ? 3 : 1;
  buildApproachScene();
};
function buildApproachScene(){
  const B = ap3d.build; if(!B) return;
  const THREE = window.THREE;
  const host = $('approach3d');
  const keepView = ap3d.view;
  FBv15.disposeApproach3D();
  ap3d.view = keepView;
  host.innerHTML = '';
  const W = host.clientWidth || 860, H = host.clientHeight || 380;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(W, H);
  renderer.setClearColor(0x0a0d11);
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, W / H, 5, 60000);
  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const dl = new THREE.DirectionalLight(0xffffff, 0.6); dl.position.set(-2000, 4000, 1500); scene.add(dl);

  const { z, pts, elevFt } = B;
  const origin = { lat: z.thresholdLat, lon: z.thresholdLon };
  const toV = (lat, lon, hFt) => { const e = enu(origin, lat, lon); return new THREE.Vector3(e.x, Math.max(0, hFt) * FT * ap3d.exag, -e.n); };
  const opp = enu(origin, z.oppositeLat, z.oppositeLon);
  const rwyLen = Math.hypot(opp.x, opp.n) || (z.lengthFt * FT);
  const ux = opp.x / rwyLen, un = opp.n / rwyLen; // axe de piste (vers l'extrémité opposée)
  const rwyW = (z.widthFt || 148) * FT;

  // Sol + grille
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000), new THREE.MeshLambertMaterial({ color: 0x0f1419 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.5; scene.add(ground);
  const grid = new THREE.GridHelper(30000, 60, 0x1e2a33, 0x151d24); grid.position.y = -0.3; scene.add(grid);

  // Piste (orientée selon l'axe réel)
  const rwyGroup = new THREE.Group();
  const yaw = Math.atan2(ux, un); // cap de l'axe
  rwyGroup.rotation.y = -yaw;
  scene.add(rwyGroup);
  const rwy = new THREE.Mesh(new THREE.PlaneGeometry(rwyW, rwyLen), new THREE.MeshLambertMaterial({ color: 0x2a3138 }));
  rwy.rotation.x = -Math.PI / 2; rwy.position.set(0, 0.2, -rwyLen / 2); rwyGroup.add(rwy);
  const white = new THREE.MeshBasicMaterial({ color: 0xdfe6ec });
  const addMark = (wM, lM, xM, alongM) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(wM, lM), white); m.rotation.x = -Math.PI / 2; m.position.set(xM, 0.4, -alongM); rwyGroup.add(m); };
  for(let a = 120; a < rwyLen - 120; a += 60) addMark(0.9, 36, 0, a);                       // axe
  for(let i = -3; i <= 3; i++) if(i) addMark(1.8, 45, i * (rwyW / 9), 30);                   // seuil
  for(let i = -3; i <= 3; i++) if(i) addMark(1.8, 45, i * (rwyW / 9), rwyLen - 30);
  [-1, 1].forEach(sd => addMark(9, 45, sd * rwyW * 0.25, 305));                            // aiming point
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x54d6e8, transparent: true, opacity: 0.5 });
  const edgeGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-rwyW/2, 0.5, 0), new THREE.Vector3(-rwyW/2, 0.5, -rwyLen), new THREE.Vector3(rwyW/2, 0.5, -rwyLen), new THREE.Vector3(rwyW/2, 0.5, 0), new THREE.Vector3(-rwyW/2, 0.5, 0)]);
  rwyGroup.add(new THREE.Line(edgeGeo, edgeMat));

  // Plan de descente théorique de 3° depuis le point d'aboutissement (1 000 ft après le seuil)
  const aimM = 305, tan3 = Math.tan(3 * Math.PI / 180);
  const gsPts = [];
  for(let d = 0; d <= 6 * 1852; d += 200){
    const along = aimM - d;
    gsPts.push(new THREE.Vector3(ux * along, d * tan3 * ap3d.exag, -un * along));
  }
  const gsLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(gsPts), new THREE.LineDashedMaterial({ color: 0xa06cf5, dashSize: 60, gapSize: 40, transparent: true, opacity: 0.85 }));
  gsLine.computeLineDistances(); scene.add(gsLine);

  // Trajectoire réelle
  const hOf = p => p.phase === 'touchdown' ? 0 : (p.altFt != null ? p.altFt - elevFt : (p.aglFt || 0));
  const v3 = pts.map(p => toV(p.lat, p.lon, hOf(p)));
  const curve = new THREE.CatmullRomCurve3(v3, false, 'centripetal');
  const span = Math.max(1500, v3[0].distanceTo(v3[v3.length - 1]));
  scene.fog = new THREE.Fog(0x0a0d11, span * 1.6, span * 4.5);
  const tubular = Math.min(600, Math.max(80, pts.length * 6));
  const tube = new THREE.TubeGeometry(curve, tubular, Math.max(6, span / 650), 8, false);
  // Couleur par anneau : écart au plan de 3° à cette distance du point d'aboutissement.
  const colors = [];
  const cGood = new THREE.Color(0x39e88f), cMid = new THREE.Color(0xffb020), cBad = new THREE.Color(0xff5c5c);
  for(let i = 0; i <= tubular; i++){
    const p = curve.getPointAt(i / tubular);
    const along = p.x * ux + (-p.z) * un;
    const dist = Math.max(0, aimM - along);
    const devFt = (p.y / ap3d.exag - dist * tan3) / FT;
    const c = Math.abs(devFt) <= 50 ? cGood : Math.abs(devFt) <= 150 ? cGood.clone().lerp(cMid, (Math.abs(devFt) - 50) / 100) : cMid.clone().lerp(cBad, Math.min(1, (Math.abs(devFt) - 150) / 200));
    for(let j = 0; j <= 8; j++) colors.push(c.r, c.g, c.b);
  }
  tube.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  scene.add(new THREE.Mesh(tube, new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x111111 })));
  // Rideau vertical léger sous la trajectoire (lecture de la hauteur)
  const curtain = [];
  for(let i = 0; i <= 60; i++){ const p = curve.getPointAt(i / 60); curtain.push(p.x, p.y, p.z, p.x, 0, p.z); }
  const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(curtain, 3));
  scene.add(new THREE.LineSegments(cg, new THREE.LineBasicMaterial({ color: 0x54d6e8, transparent: true, opacity: 0.16 })));
  // Point de toucher
  const tdV = toV(B.t.lat, B.t.lon, 0);
  const tdm = new THREE.Mesh(new THREE.CylinderGeometry(Math.max(9, span / 500), Math.max(9, span / 500), 1.5, 24), new THREE.MeshBasicMaterial({ color: 0xff5c5c }));
  tdm.position.copy(tdV).setY(0.8); scene.add(tdm);

  // Avion
  const plane = makePlaneMesh(THREE);
  plane.scale.setScalar(Math.max(1.5, span / 2000)); // grossi pour rester visible à l'échelle de l'approche
  scene.add(plane);

  // Caméra + contrôles
  let controls = null;
  if(THREE.OrbitControls){ controls = new THREE.OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = 0.08; controls.maxPolarAngle = Math.PI / 2 - 0.02; }
  Object.assign(ap3d, { renderer, scene, camera, controls, curve, plane, pts, aimM, tan3, ux, un, elevFt, span });
  ap3d.u = 0; $('ap3dScrub').value = 0;
  $('ap3dScrub').oninput = e => { ap3d.playing = false; $('ap3dPlay').textContent = '▶ Rejouer'; ap3d.u = e.target.value / 1000; placePlane(); };
  $('ap3dView').value = ap3d.view;
  setCamera(ap3d.view);
  placePlane();
  ap3d.ro = new ResizeObserver(() => {
    const w = host.clientWidth, h = host.clientHeight;
    if(!w || !h || !ap3d.renderer) return;
    ap3d.renderer.setSize(w, h); ap3d.camera.aspect = w / h; ap3d.camera.updateProjectionMatrix();
  });
  ap3d.ro.observe(host);
  let last = performance.now();
  const loop = now => {
    ap3d.raf = requestAnimationFrame(loop);
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if(ap3d.playing){
      ap3d.u = Math.min(1, ap3d.u + dt / 14); // ~14 s pour toute l'approche
      $('ap3dScrub').value = Math.round(ap3d.u * 1000);
      placePlane();
      if(ap3d.u >= 1){ ap3d.playing = false; $('ap3dPlay').textContent = '▶ Rejouer'; }
    }
    if(ap3d.view === 'pilot') pilotCam();
    else if(ap3d.controls) ap3d.controls.update();
    renderer.render(scene, camera);
  };
  ap3d.raf = requestAnimationFrame(loop);
}
function makePlaneMesh(THREE){
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0xe7edf2, emissive: 0x1a2028 });
  const acc = new THREE.MeshLambertMaterial({ color: 0x54d6e8, emissive: 0x0b2a30 });
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 38, 12), mat); fus.rotation.x = Math.PI / 2; g.add(fus);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(2.1, 12, 8), mat); nose.position.z = -19; g.add(nose);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(36, 0.6, 6), acc); wing.position.z = -1; g.add(wing);
  const stab = new THREE.Mesh(new THREE.BoxGeometry(13, 0.5, 3.5), acc); stab.position.z = 16.5; g.add(stab);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7, 4.5), acc); fin.position.set(0, 3.8, 16.5); g.add(fin);
  [-8, 8].forEach(x => { const e = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 5, 10), mat); e.rotation.x = Math.PI / 2; e.position.set(x, -1.2, -3); g.add(e); });
  return g;
}
function placePlane(){
  if(!ap3d.curve) return;
  const u = Math.max(0.0001, Math.min(1, ap3d.u));
  const p = ap3d.curve.getPointAt(u);
  const tan = ap3d.curve.getTangentAt(Math.min(0.999, u)).normalize();
  ap3d.plane.position.copy(p).setY(p.y + 4);
  ap3d.plane.lookAt(p.clone().sub(tan)); // le nez (-z local) pointe dans le sens de déplacement
  // HUD
  const along = p.x * ap3d.ux + (-p.z) * ap3d.un;
  const distM = Math.max(0, -along); // avant le seuil
  const hFt = p.y / ap3d.exag / FT;
  const gsFt = Math.max(0, (ap3d.aimM - along)) * ap3d.tan3 / FT;
  const dev = Math.round(hFt - gsFt);
  const idx = Math.min(ap3d.pts.length - 1, Math.round(u * (ap3d.pts.length - 1)));
  const sp = ap3d.pts[idx] || {};
  $('approach3dHud').innerHTML = `
    <div><span>Distance seuil</span><b>${(distM / 1852).toFixed(2)} NM</b></div>
    <div><span>Hauteur</span><b>${Math.round(hFt)} ft</b></div>
    <div><span>Plan 3°</span><b style="color:${Math.abs(dev) <= 50 ? '#39e88f' : Math.abs(dev) <= 150 ? '#ffb020' : '#ff5c5c'}">${dev > 0 ? '+' : ''}${dev} ft</b></div>
    <div><span>Vario</span><b>${sp.vsFpm != null ? sp.vsFpm + ' ft/min' : '—'}</b></div>
    <div><span>IAS</span><b>${sp.iasKt != null ? sp.iasKt + ' kt' : '—'}</b></div>`;
  if(ap3d.view === 'chase' && ap3d.playing) followChase(p, tan);
}
function followChase(p, tan){
  const s = ap3d.span || 8000;
  const back = new THREE.Vector3(tan.x, 0, tan.z).normalize().multiplyScalar(-s * 0.16);
  const side = new THREE.Vector3(-tan.z, 0, tan.x).normalize().multiplyScalar(s * 0.08);
  ap3d.camera.position.lerp(new THREE.Vector3(p.x + back.x + side.x, p.y + s * 0.035, p.z + back.z + side.z), 0.05);
  if(ap3d.controls){ ap3d.controls.target.lerp(p, 0.12); }
}
function pilotCam(){
  const u = Math.max(0.0001, Math.min(0.995, ap3d.u));
  const p = ap3d.curve.getPointAt(u), tan = ap3d.curve.getTangentAt(u).normalize();
  ap3d.camera.position.set(p.x, p.y + 6, p.z);
  const target = p.clone().add(tan.clone().multiplyScalar(900)); target.y = Math.max(0, p.y + tan.y * 900 - 25);
  ap3d.camera.lookAt(target);
}
function setCamera(view){
  ap3d.view = view;
  if(!ap3d.camera || !ap3d.curve) return;
  const start = ap3d.curve.getPointAt(0), end = ap3d.curve.getPointAt(1);
  const len = ap3d.span || start.distanceTo(end);
  const back = new THREE.Vector3(start.x - end.x, 0, start.z - end.z).normalize(); // vers l'arrière de l'approche
  const perp = new THREE.Vector3(-back.z, 0, back.x);                               // perpendiculaire (côté)
  const target = start.clone().lerp(end, 0.7).setY(start.y * 0.25);
  if(ap3d.plane) ap3d.plane.visible = view !== 'pilot';
  if(ap3d.controls) ap3d.controls.enabled = view !== 'pilot';
  if(view === 'side') ap3d.camera.position.copy(target.clone().add(perp.clone().multiplyScalar(len * 0.95))).setY(start.y * 0.45 + len * 0.04);
  else if(view === 'top') ap3d.camera.position.copy(target.clone().add(new THREE.Vector3(0.01, len * 1.15, 0.01)));
  else if(view === 'chase') ap3d.camera.position.copy(end.clone().add(back.clone().multiplyScalar(len * 0.95)).add(perp.clone().multiplyScalar(len * 0.6))).setY(start.y + len * 0.12);
  if(view !== 'pilot'){
    if(ap3d.controls){ ap3d.controls.target.copy(target); ap3d.controls.update(); }
    ap3d.camera.lookAt(target);
  }
  if($('ap3dView').value !== view) $('ap3dView').value = view;
}
FBv15.approachSetView = v => { setCamera(v); };
FBv15.approachSetExag = on => { ap3d.exag = on ? 3 : 1; buildApproachScene(); };
FBv15.approachPlayToggle = () => {
  if(!ap3d.curve) return;
  if(ap3d.playing){ ap3d.playing = false; $('ap3dPlay').textContent = '▶ Rejouer'; return; }
  if(ap3d.u >= 0.999) ap3d.u = 0;
  ap3d.playing = true; $('ap3dPlay').textContent = '❚❚ Pause';
};

/* =========================================================
   5. ATC EN LIGNE (VATSIM + IVAO) — carte du Briefing + liste
   ========================================================= */
let atcTimer = null, atcData = null, atcLayer = null, atcBusy = false;
const NET = { vatsim: { label: 'VATSIM', color: '#3ee0a8' }, ivao: { label: 'IVAO', color: '#5b93ff' } };
const FAC_ORDER = { ATIS: 0, DEL: 1, GND: 2, TWR: 3, DEP: 4, APP: 5, CTR: 6, FSS: 7 };
const FAC_LETTER = { ATIS: 'i', DEL: 'D', GND: 'G', TWR: 'T', APP: 'A', DEP: 'A' };
const APP_RADIUS_NM = 35;
function atcCfg(){
  db.atcMap = Object.assign({ vatsim: true, ivao: true, map: true }, db.atcMap || {});
  return db.atcMap;
}
function atcStations(){
  const c = atcCfg(), out = [];
  ['vatsim', 'ivao'].forEach(n => { const d = atcData && atcData[n]; if(c[n] && d && d.ok) out.push(...d.stations); });
  return out;
}
function atcSince(iso){
  if(!iso) return '';
  const m = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000));
  return m >= 60 ? `${Math.floor(m/60)} h ${String(m%60).padStart(2,'0')}` : `${m} min`;
}
function atcRow(c){
  const txt = (c.text || '').trim();
  return `<div class="atc-row">
    <span class="atc-fac f-${esc(c.facility)}">${esc(c.facility)}${c.atisCode ? ' ' + esc(c.atisCode) : ''}</span>
    <span class="atc-cs"><i class="net-dot" style="background:${NET[c.network].color}" title="${NET[c.network].label}"></i>${esc(c.callsign)}</span>
    <span class="atc-freq">${esc(c.frequency)}</span>
    <span class="atc-name">${esc(c.name || c.sector || NET[c.network].label)}</span>
    <span class="atc-since">${esc(atcSince(c.logonTime))}</span>
    ${txt ? `<div class="atc-txt">${esc(txt)}</div>` : ''}
  </div>`;
}
const sortStations = (a, b) => (FAC_ORDER[a.facility] ?? 9) - (FAC_ORDER[b.facility] ?? 9) || a.callsign.localeCompare(b.callsign);

/* ---- carte ---- */
function ensureAtcLayer(){
  if(atcLayer || typeof trackMap === 'undefined' || !trackMap) return atcLayer;
  // Panneaux dédiés : secteurs sous le tracé du vol, badges d'aéroport sous l'avion.
  trackMap.createPane('atcSectors').style.zIndex = 350;
  trackMap.createPane('atcLabels').style.zIndex = 450;
  trackMap.createPane('atcAirports').style.zIndex = 590;
  trackMap.getPane('atcLabels').style.pointerEvents = 'none';
  atcLayer = L.layerGroup().addTo(trackMap);
  return atcLayer;
}
function popupHtml(list, title){
  return `<div class="atc-pop"><div class="atc-pop-h">${title}</div>${list.slice().sort(sortStations).map(atcRow).join('')}</div>`;
}
function renderAtcMap(){
  if(!ensureAtcLayer()) return;
  atcLayer.clearLayers();
  const c = atcCfg();
  renderAtcMapChips();
  if(!c.map) return;
  const st = atcStations();
  // Centres / FSS : contours de secteur (ou point si le réseau ne donne pas de contour).
  st.filter(s => s.facility === 'CTR' || s.facility === 'FSS').forEach(s => {
    const col = NET[s.network].color;
    const tip = `<b>${esc(s.callsign)}</b> · ${esc(s.frequency)}${s.sector || s.name ? '<br>' + esc(s.sector || s.name) : ''}`;
    if(s.poly){
      L.polygon(s.poly, { pane: 'atcSectors', color: col, weight: 1.3, opacity: .75, fillColor: col, fillOpacity: .07, smoothFactor: 1.5 })
        .bindTooltip(tip, { sticky: true, className: 'atc-tip' }).bindPopup(popupHtml([s], NET[s.network].label), { className: 'atc-popup', maxWidth: 420 }).addTo(atcLayer);
    }
    const at = s.pos || (s.poly ? centroid(s.poly[0]) : null);
    if(at){
      L.marker(at, { pane: 'atcLabels', interactive: false, icon: L.divIcon({ className: 'atc-ctr-label', iconSize: null,
        html: `<span style="--net:${col}">${esc(s.callsign.replace(/_(CTR|FSS)$/, ''))}<b>${esc(s.frequency)}</b></span>` }) }).addTo(atcLayer);
      if(!s.poly) L.circleMarker(at, { pane: 'atcSectors', radius: 5, color: col, weight: 2, fillOpacity: .3 }).bindTooltip(tip, { className: 'atc-tip' }).bindPopup(popupHtml([s], NET[s.network].label), { className: 'atc-popup', maxWidth: 420 }).addTo(atcLayer);
    }
  });
  // Approches : cercle de ~35 NM autour du terrain.
  const appDone = new Set();
  st.filter(s => (s.facility === 'APP' || s.facility === 'DEP') && s.ap).forEach(s => {
    const k = s.network + s.ap.icao;
    if(appDone.has(k)) return; appDone.add(k);
    L.circle([s.ap.lat, s.ap.lon], { pane: 'atcSectors', radius: APP_RADIUS_NM * 1852, color: NET[s.network].color, weight: 1.2, opacity: .7, dashArray: '5 6', fillColor: '#54d6e8', fillOpacity: .05, interactive: false }).addTo(atcLayer);
  });
  // Aéroports : un badge par réseau avec les positions ouvertes (i D G T A).
  const groups = new Map();
  st.filter(s => s.ap && FAC_LETTER[s.facility]).forEach(s => {
    const k = s.network + '|' + s.ap.icao;
    if(!groups.has(k)) groups.set(k, { net: s.network, ap: s.ap, list: [] });
    groups.get(k).list.push(s);
  });
  const both = new Set();
  groups.forEach(g => { if(groups.has('vatsim|' + g.ap.icao) && groups.has('ivao|' + g.ap.icao)) both.add(g.ap.icao); });
  groups.forEach(g => {
    const facs = [...new Set(g.list.map(s => s.facility === 'DEP' ? 'APP' : s.facility))].sort((a, b) => FAC_ORDER[a] - FAC_ORDER[b]);
    const offset = both.has(g.ap.icao) && g.net === 'ivao' ? 24 : 0; // 2 réseaux : badges empilés au-dessus du terrain
    L.marker([g.ap.lat, g.ap.lon], { pane: 'atcAirports', zIndexOffset: -100, icon: L.divIcon({ className: 'atc-ap-badge-wrap', iconSize: null, iconAnchor: [0, offset],
      html: `<div class="atc-ap-badge" style="--net:${NET[g.net].color}"><b>${esc(g.ap.icao)}</b>${facs.map(f => `<span class="f-${f}">${FAC_LETTER[f]}</span>`).join('')}</div>` }) })
      .bindPopup(popupHtml(g.list, `${esc(g.ap.icao)} · ${NET[g.net].label}`), { className: 'atc-popup', maxWidth: 440 })
      .bindTooltip(g.list.sort(sortStations).map(s => `${esc(s.callsign)} ${esc(s.frequency)}`).join('<br>'), { className: 'atc-tip', direction: 'top', offset: [0, -14] })
      .addTo(atcLayer);
  });
}
function centroid(ring){
  let la = 0, lo = 0; ring.forEach(p => { la += p[0]; lo += p[1]; });
  return [la / ring.length, lo / ring.length];
}
function renderAtcMapChips(){
  const box = $('atcMapChips');
  if(!box) return;
  const c = atcCfg();
  const count = n => { const d = atcData && atcData[n]; return d && d.ok ? d.stations.filter(s => s.facility !== 'ATIS').length : null; };
  box.innerHTML = `<button class="atc-chip ${c.map ? 'on' : ''}" onclick="FBv15.atcToggle('map')" title="Afficher les contrôleurs sur la carte">📡 ATC</button>`
    + ['vatsim', 'ivao'].map(n => { const k = count(n); const err = atcData && atcData[n] && !atcData[n].ok;
      return `<button class="atc-chip net ${c[n] ? 'on' : ''}" style="--net:${NET[n].color}" onclick="FBv15.atcToggle('${n}')" title="${err ? esc(NET[n].label + ' injoignable : ' + atcData[n].error) : 'Afficher / masquer ' + NET[n].label}"><i></i>${NET[n].label}${c[n] && k != null ? ` <small>${k}</small>` : ''}${err && c[n] ? ' ⚠' : ''}</button>`; }).join('')
    + `<button class="atc-chip atc-help" onclick="FBv15.toggleAtcLegend()" title="Légende">?</button>`;
}
FBv15.atcToggle = function(k){
  const c = atcCfg();
  c[k] = !c[k];
  queueSaveDb();
  renderAtcMapChips();
  if((k === 'vatsim' || k === 'ivao') && c[k]) FBv15.refreshAtc(false);
  else { renderAtcMap(); renderAtc(); }
};

/* ---- liste (panneau sous la carte) ---- */
function renderAtc(){
  const box = $('atcAirports');
  if(!box) return;
  const c = atcCfg();
  if(!c.vatsim && !c.ivao){ box.innerHTML = '<div class="hint">Active VATSIM et/ou IVAO sur la carte pour voir les contrôleurs en ligne.</div>'; $('atcUpdated').textContent = ''; return; }
  if(!atcData){ box.innerHTML = '<div class="hint">Chargement…</div>'; return; }
  const errs = ['vatsim','ivao'].filter(n => c[n] && atcData[n] && !atcData[n].ok).map(n => `${NET[n].label} injoignable (${esc(atcData[n].error || 'hors ligne ?')})`);
  const all = atcStations();
  const dep = (el('depIcao').value || '').trim().toUpperCase(), arr = (el('arrIcao').value || '').trim().toUpperCase();
  const section = (icao, label) => {
    if(!icao) return '';
    const list = all.filter(s => s.ap && s.ap.icao === icao).sort((a, b) => a.network.localeCompare(b.network) * 10 + sortStations(a, b));
    return `<div class="atc-ap"><div class="atc-ap-head"><b>${esc(icao)}</b><span>${label}</span><span class="atc-n ${list.length ? 'on' : ''}">${list.length ? list.length + ' en ligne' : 'aucun contrôleur'}</span></div>
      ${list.map(atcRow).join('')}</div>`;
  };
  box.innerHTML = (errs.length ? `<div class="status-msg err" style="margin:0 0 8px;">${errs.join(' · ')}</div>` : '')
    + ((dep || arr) ? section(dep, 'Départ') + (arr && arr !== dep ? section(arr, 'Arrivée') : '')
      : '<div class="hint">Renseigne le départ et l\'arrivée du vol pour voir les contrôleurs de tes aéroports.</div>');
  const parts = ['vatsim','ivao'].filter(n => c[n] && atcData[n] && atcData[n].ok).map(n => `${NET[n].label} ${atcData[n].stations.filter(s => s.facility !== 'ATIS').length}${atcData[n].stale ? ' ⚠' : ''}`);
  $('atcUpdated').textContent = parts.join(' · ') + ' · ' + new Date().toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
  $('atcAllCount').textContent = `(${all.filter(s => s.facility !== 'ATIS').length})`;
  renderAtcAll();
}
function renderAtcAll(){
  if(!atcData || !$('atcAllDetails').open) return;
  const q = ($('atcSearch').value || '').trim().toUpperCase();
  const list = atcStations().filter(c => c.facility !== 'ATIS' && (!q || c.callsign.includes(q) || (c.name || '').toUpperCase().includes(q) || c.frequency.includes(q) || NET[c.network].label.includes(q)))
    .sort((a, b) => a.callsign.localeCompare(b.callsign));
  $('atcAllList').innerHTML = list.slice(0, 300).map(atcRow).join('') + (list.length > 300 ? `<div class="hint">… ${list.length - 300} autres, affine le filtre.</div>` : '') || '<div class="hint">Aucun résultat.</div>';
}
FBv15.refreshAtc = async function(force){
  if(!window.atc || atcBusy) return;
  const c = atcCfg();
  if(!c.vatsim && !c.ivao){ atcData = null; renderAtc(); renderAtcMap(); return; }
  atcBusy = true;
  if(!atcData) renderAtc();
  try{ atcData = await window.atc.get({ networks: { vatsim: c.vatsim, ivao: c.ivao }, force: !!force }); }
  catch(e){ atcData = { vatsim: { ok: false, error: e.message, stations: [] }, ivao: { ok: false, error: e.message, stations: [] } }; }
  atcBusy = false;
  renderAtc();
  renderAtcMap();
};
function startAtcPolling(){
  stopAtcPolling();
  FBv15.refreshAtc(false);
  atcTimer = setInterval(() => { if(!document.hidden) FBv15.refreshAtc(false); }, 45000);
}
function stopAtcPolling(){ if(atcTimer){ clearInterval(atcTimer); atcTimer = null; } }

/* =========================================================
   5 bis. CARTE DU BRIEFING — lecture et navigation
   ---------------------------------------------------------
   Route prévue (OFP SimBrief ou ligne directe) avec départ/arrivée et TOC/TOD,
   bandeau de vol sur la carte, bouton « Vol entier », plein écran, raccourcis clavier,
   légende ATC et allègement des étiquettes quand on dézoome.
   ========================================================= */
let routeLayer = null, routeSig = '', routeBounds = null, hudVisible = false;
function ensureRoutePanes(){
  if(typeof trackMap === 'undefined' || !trackMap) return false;
  if(!trackMap.getPane('routePlan')){
    trackMap.createPane('routePlan').style.zIndex = 380;
    trackMap.createPane('routeAirports').style.zIndex = 595;
    routeLayer = L.layerGroup().addTo(trackMap);
    trackMap.on('zoomend', applyZoomClasses);
    applyZoomClasses();
  }
  return true;
}
function applyZoomClasses(){
  const z = trackMap.getZoom(), c = trackMap.getContainer();
  c.classList.toggle('atc-zoomed-out', z < 5);
  c.classList.toggle('atc-far', z < 4);
  c.classList.toggle('route-far', z < 6);
}
async function updateRouteLayer(){
  if(!ensureRoutePanes()) return;
  const dep = (el('depIcao').value || '').trim().toUpperCase(), arr = (el('arrIcao').value || '').trim().toUpperCase();
  const o = routeOfp(arr, dep);
  const sig = [dep, arr, o ? (o.fetchedAt || o.navlog.length) : ''].join('|');
  if(sig === routeSig) return;
  routeSig = sig;
  routeLayer.clearLayers(); routeBounds = null;
  if(!dep && !arr) return;
  const [a, b] = await Promise.all([dep ? window.api.lookupAirport(dep) : null, arr ? window.api.lookupAirport(arr) : null]);
  if(routeSig !== sig) return; // les champs ont changé entre-temps
  let pts = [];
  if(o) pts = o.navlog.map(f => [f.lat, f.lon]);
  else if(a && b) pts = FBShared.greatCirclePoints(a, b, 48);
  if(pts.length > 1){
    L.polyline(pts, { pane: 'routePlan', color: '#b6c2cf', weight: 2, opacity: .55, dashArray: '2 8', lineCap: 'round', interactive: false }).addTo(routeLayer);
    routeBounds = L.latLngBounds(pts);
  }
  if(o){
    o.navlog.forEach(f => {
      if(f.id === 'TOC' || f.id === 'TOD'){
        L.marker([f.lat, f.lon], { pane: 'routeAirports', interactive: false, icon: L.divIcon({ className: 'route-pt', iconSize: null, html: `<span class="rp-${f.id.toLowerCase()}">${f.id}</span>` }) }).addTo(routeLayer);
      } else if(f.id !== dep && f.id !== arr){
        L.circleMarker([f.lat, f.lon], { pane: 'routePlan', radius: 2.2, color: '#b6c2cf', weight: 1, opacity: .7, fillOpacity: .6 }).bindTooltip(esc(f.id), { className: 'atc-tip', direction: 'top' }).addTo(routeLayer);
      }
    });
  }
  [[a, 'dep', 'Départ'], [b, 'arr', 'Arrivée']].forEach(([ap, k, label]) => {
    if(!ap) return;
    L.marker([ap.lat, ap.lon], { pane: 'routeAirports', icon: L.divIcon({ className: 'route-ap', iconSize: null, html: `<div class="ra ra-${k}"><i></i><b>${esc(ap.icao)}</b></div>` }) })
      .bindTooltip(`${label} · ${esc(ap.name || ap.icao)}`, { className: 'atc-tip', direction: 'top', offset: [0, -10] }).addTo(routeLayer);
    routeBounds = routeBounds ? routeBounds.extend([ap.lat, ap.lon]) : L.latLngBounds([[ap.lat, ap.lon]]);
  });
}
FBv15.mapFitRoute = function(){
  if(!trackMap) return;
  let bounds = routeBounds ? L.latLngBounds(routeBounds.getSouthWest(), routeBounds.getNorthEast()) : null;
  if(trackPlaneMarker && trackMap.hasLayer(trackPlaneMarker)){
    const p = trackPlaneMarker.getLatLng();
    bounds = bounds ? bounds.extend(p) : L.latLngBounds([p, p]);
  }
  if(!bounds) return;
  if(db.trackFollow) setTrackFollow(false);
  if(bounds.getNorthEast().equals(bounds.getSouthWest())) trackMap.setView(bounds.getCenter(), 9);
  else trackMap.fitBounds(bounds, { padding: [60, 60], maxZoom: 10 });
};
FBv15.mapFullscreen = function(force){
  const shell = el('trackMap').closest('.map-shell');
  const on = force != null ? force : !shell.classList.contains('map-full');
  shell.classList.toggle('map-full', on);
  document.body.classList.toggle('map-full-open', on);
  $('mapFullBtn').classList.toggle('on', on);
  $('mapFullBtn').title = on ? 'Quitter le plein écran (Échap)' : 'Plein écran (touche P, Échap pour sortir)';
  setTimeout(() => { trackMap.invalidateSize(); }, 30);
};
const PH_FR = { taxi_out:'Roulage', liftoff:'Décollage', initial_climb:'Montée initiale', climb:'Montée', cruise:'Croisière', descent:'Descente', approach:'Approche', final_approach:'Finale', touchdown:'Toucher', taxi_in:'Roulage', ground:'Au sol', airborne:'En vol', landed:'Atterri' };
function renderMapHud(t){
  const hud = $('mapHud');
  if(!hud) return;
  if(!t){ hud.classList.add('hidden'); hudVisible = false; return; }
  hud.classList.remove('hidden'); hudVisible = true;
  const ot = _overlayTelemetry || {};
  const ph = PH_FR[ot.phase] || PH_FR[t.phase] || '—';
  const vs = Math.round(t.vsFpm || 0);
  const vsArrow = vs > 150 ? '↗' : vs < -150 ? '↘' : '→';
  const cell = (k, v, cls) => `<div class="mh${cls ? ' ' + cls : ''}"><span>${k}</span><b>${v}</b></div>`;
  hud.innerHTML = cell('Phase', esc(ph), 'mh-phase')
    + cell('Altitude', (t.altFt >= 18000 ? 'FL' + String(Math.round(t.altFt / 100)).padStart(3, '0') : Math.round(t.altFt || 0).toLocaleString('fr-FR') + ' ft'))
    + cell('Vit. sol', Math.round(t.gsKt || 0) + ' kt')
    + cell('Vario', `${vsArrow} ${vs > 0 ? '+' : ''}${vs}`)
    + cell('Cap', String(Math.round(t.headingDeg || 0)).padStart(3, '0') + '°')
    + (ot.todState === 'passed' ? cell('TOD', 'passé') : ot.todMin != null ? cell('TOD', fmtMinShort(ot.todMin)) : '')
    + (ot.etaIso ? cell('ETA', new Date(ot.etaIso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + (ot.remainingNm != null ? ` <small>${Math.round(ot.remainingNm)} NM</small>` : '')) : '');
}
FBv15.toggleAtcLegend = function(){ const l = $('atcLegend'); if(l) l.classList.toggle('hidden'); };
function initMapUx(){
  if(!ensureRoutePanes()) return;
  updateRouteLayer();
  ['depIcao', 'arrIcao'].forEach(id => el(id).addEventListener('input', debounce(updateRouteLayer, 500)));
  // render() est appelée après un import SimBrief : on en profite pour redessiner la route prévue.
  const origRender = window.render;
  if(typeof origRender === 'function') window.render = function(){ const r = origRender.apply(this, arguments); setTimeout(updateRouteLayer, 50); return r; };
  setInterval(() => { if(el('view-briefing').classList.contains('active')) updateRouteLayer(); }, 15000); // OFP récupéré plus tard
  if(window.tracker){
    window.tracker.onTelemetry(d => { if(d.lat != null) renderMapHud(d); });
    window.tracker.onStatus(d => { if(!d.connected) renderMapHud(null); });
  }
  // Légende ATC (dans la carte)
  const shell = el('trackMap').closest('.map-shell');
  const leg = document.createElement('div');
  leg.className = 'atc-legend hidden'; leg.id = 'atcLegend';
  leg.innerHTML = `<div class="al-h">Légende ATC <button onclick="FBv15.toggleAtcLegend()">×</button></div>
    <div class="al-row"><span class="atc-ap-badge" style="--net:#3ee0a8;transform:none"><b>LFPG</b><span class="f-ATIS">i</span><span class="f-DEL">D</span><span class="f-GND">G</span><span class="f-TWR">T</span><span class="f-APP">A</span></span></div>
    <div class="al-row"><b class="lt f-ATIS">i</b>ATIS <b class="lt f-DEL">D</b>Prévol <b class="lt f-GND">G</b>Sol <b class="lt f-TWR">T</b>Tour <b class="lt f-APP">A</b>Approche</div>
    <div class="al-row"><i class="sw" style="--c:#3ee0a8"></i>Secteur VATSIM <i class="sw" style="--c:#5b93ff"></i>Secteur IVAO</div>
    <div class="al-row"><i class="sw dash"></i>Zone d'approche (~35 NM) <i class="sw route"></i>Route prévue</div>`;
  shell.appendChild(leg);
  // Raccourcis : Ctrl+1…9 pour les onglets ; F / V / P / Échap sur la carte du Briefing.
  const order = ['briefing', 'tools', 'logbook', 'career', 'hangar', 'livetool', 'twitch', 'profil', 'admin'];
  document.addEventListener('keydown', e => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '') || (e.target && e.target.isContentEditable);
    if((e.ctrlKey || e.metaKey) && !e.altKey && /^[1-9]$/.test(e.key)){ e.preventDefault(); switchView(order[+e.key - 1]); return; }
    if(e.key === 'Escape' && document.body.classList.contains('map-full-open')){ FBv15.mapFullscreen(false); e.stopImmediatePropagation(); return; }
    if(e.key === 'Escape'){
      if(!$('lightbox').classList.contains('hidden')){ FBv15.lightboxClose(); e.stopImmediatePropagation(); return; }
      if(!$('galleryOverlay').classList.contains('hidden')){ FBv15.closeGallery(); e.stopImmediatePropagation(); return; }
      if(!$('achModalOverlay').classList.contains('hidden')){ FBv15.closeAchievements(); e.stopImmediatePropagation(); return; }
      if($('shotsModalOverlay') && !$('shotsModalOverlay').classList.contains('hidden')){ FBv15.closeShotsSettings(); e.stopImmediatePropagation(); return; }
    }
    if(!$('lightbox').classList.contains('hidden') && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')){ FBv15.lightboxStep(e.key === 'ArrowLeft' ? -1 : 1); e.preventDefault(); return; }
    if(typing || e.ctrlKey || e.metaKey || e.altKey || !el('view-briefing').classList.contains('active')) return;
    if(document.querySelector('.modal-overlay:not(.hidden)')) return;
    const k = e.key.toLowerCase();
    if(k === 'f') toggleTrackFollow();
    else if(k === 'v') FBv15.mapFitRoute();
    else if(k === 'p') FBv15.mapFullscreen();
  }, true);
}

/* =========================================================
   5 ter. OUTIL LIVE — ordre des blocs, position à l'écran, mode « Libre » (v1.6)
   ========================================================= */
const LO_CUSTOM_LABEL = { custom1: 'Texte libre 1', custom2: 'Texte libre 2' };
function loSaveAndPush(){ pushLiveOverlayConfig(); queueSaveDb(); }
function initLiveOverlayLayout(){
  const list = $('loFieldList');
  if(!list) return;
  // Lignes triées selon l'ordre enregistré.
  const order = normLiveOverlayOrder(db.liveOverlay.order);
  order.forEach(k => { const row = list.querySelector(`[data-key="${k}"]`); if(row) list.appendChild(row); });
  refreshCustomLabels();
  ['loCustom1', 'loCustom2'].forEach(id => el(id) && el(id).addEventListener('input', refreshCustomLabels));
  // Glisser-déposer (poignée ou ligne entière).
  let dragRow = null;
  list.addEventListener('dragstart', e => {
    const row = e.target.closest('.lo-sort');
    if(!row){ e.preventDefault(); return; }
    dragRow = row; row.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    try{ e.dataTransfer.setData('text/plain', row.dataset.key); }catch(err){ /* ignoré */ }
  });
  list.addEventListener('dragover', e => {
    if(!dragRow) return;
    e.preventDefault();
    const rows = [...list.querySelectorAll('.lo-sort:not(.dragging)')];
    const after = rows.find(r => { const b = r.getBoundingClientRect(); return e.clientY < b.top + b.height / 2; });
    if(after) list.insertBefore(dragRow, after); else list.appendChild(dragRow);
  });
  const end = () => {
    if(!dragRow) return;
    dragRow.classList.remove('dragging'); dragRow = null;
    db.liveOverlay.order = [...list.querySelectorAll('.lo-sort')].map(r => r.dataset.key);
    renderLiveOverlayPreview(true); loSaveAndPush();
  };
  list.addEventListener('drop', e => { e.preventDefault(); end(); });
  list.addEventListener('dragend', end);
  // Position à l'écran (modes barre / bloc / cartes).
  const st = db.liveOverlay.style;
  const paintAnchor = () => $('loAnchor').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.a === (st.anchor || 'top-left')));
  $('loAnchor').querySelectorAll('button').forEach(b => b.onclick = () => { st.anchor = b.dataset.a; paintAnchor(); loSaveAndPush(); });
  paintAnchor();
  $('loMargin').value = st.margin != null ? st.margin : 18;
  $('loMarginVal').textContent = $('loMargin').value + ' px'; updateRangeFill($('loMargin'));
  $('loMargin').addEventListener('input', e => { st.margin = +e.target.value; $('loMarginVal').textContent = e.target.value + ' px'; updateRangeFill(e.target); loSaveAndPush(); });
  window.addEventListener('resize', debounce(() => { if(db.liveOverlay.style.layout === 'free') FBv15.renderFreeCanvas(); }, 150));
}
function refreshCustomLabels(){
  [1, 2].forEach(n => { const t = (el('loCustom' + n).value || '').trim(); const lab = $('loSortCustom' + n); if(lab) lab.textContent = t ? '« ' + (t.length > 22 ? t.slice(0, 22) + '…' : t) + ' »' : '(vide, non affiché)'; });
}
// Positions par défaut des blocs sans position : une colonne en haut à gauche.
FBv15.ensureFreePositions = function(){
  const cfg = db.liveOverlay;
  cfg.positions = cfg.positions || {};
  const blocks = liveOverlayBlocks(cfg);
  let y = 2;
  blocks.forEach(b => {
    if(!cfg.positions[b.key]) cfg.positions[b.key] = { x: 1.5, y };
    y = Math.max(y, cfg.positions[b.key].y) + 7.5;
  });
};
FBv15.freeAutoArrange = function(mode){
  const cfg = db.liveOverlay;
  const blocks = liveOverlayBlocks(cfg);
  cfg.positions = cfg.positions || {};
  if(mode === 'row'){
    // Mesure réelle des blocs dans l'éditeur pour les aligner bord à bord en bas de l'écran.
    const stage = $('loFreeCanvas').querySelector('.lo-free-stage');
    let x = 1.5;
    blocks.forEach(b => {
      const node = stage && stage.querySelector(`[data-key="${b.key}"]`);
      const w = node ? node.offsetWidth / 1920 * 100 : 8;
      cfg.positions[b.key] = { x: +x.toFixed(2), y: 91 };
      x += w + 0.6;
    });
  } else {
    blocks.forEach((b, i) => { cfg.positions[b.key] = { x: 1.5, y: 2 + i * 7.5 }; });
  }
  FBv15.renderFreeCanvas(); loSaveAndPush();
};
FBv15.renderFreeCanvas = function(){
  const wrap = $('loFreeCanvas');
  if(!wrap) return;
  const cfg = db.liveOverlay, t = _overlayTelemetry;
  FBv15.ensureFreePositions();
  const W = wrap.clientWidth || 860, k = W / 1920;
  wrap.style.height = Math.round(1080 * k) + 'px';
  const st = cfg.style;
  const cls = ['lo-bar', 'lo-cards', st.shadow !== false ? 'lo-shadow' : '', st.blur !== false ? 'lo-blur' : '', st.uppercase ? 'lo-uppercase' : ''].join(' ');
  wrap.innerHTML = `<div class="lo-free-stage" style="transform:scale(${k})"><i class="lo-guide v"></i><i class="lo-guide h"></i>${liveOverlayBlocks(cfg).map(b => {
    const p = cfg.positions[b.key];
    return `<div class="lo-free-block ${cls}" data-key="${b.key}" style="left:${p.x}%; top:${p.y}%">${b.html(t)}</div>`;
  }).join('')}</div>`;
  const stage = wrap.querySelector('.lo-free-stage');
  applyLiveOverlayStyleVars(stage, cfg);
  stage.classList.remove('lo-stack', 'lo-cards', 'lo-shadow', 'lo-blur', 'lo-uppercase', 'lo-divider');
  // Déplacement à la souris, avec aimantation sur une grille de 0,5 % et sur les centres.
  stage.querySelectorAll('.lo-free-block').forEach(node => {
    node.addEventListener('pointerdown', e => {
      e.preventDefault();
      node.setPointerCapture(e.pointerId);
      node.classList.add('moving');
      const key = node.dataset.key, start = { ...cfg.positions[key] }, sx = e.clientX, sy = e.clientY;
      const bw = node.offsetWidth / 1920 * 100, bh = node.offsetHeight / 1080 * 100;
      const gv = stage.querySelector('.lo-guide.v'), gh = stage.querySelector('.lo-guide.h');
      const move = ev => {
        let x = start.x + (ev.clientX - sx) / k / 1920 * 100, y = start.y + (ev.clientY - sy) / k / 1080 * 100;
        x = Math.max(0, Math.min(100 - bw, x)); y = Math.max(0, Math.min(100 - bh, y));
        let snapV = false, snapH = false;
        if($('loFreeSnap').checked){
          x = Math.round(x * 2) / 2; y = Math.round(y * 2) / 2;
          if(Math.abs(x + bw / 2 - 50) < 1){ x = 50 - bw / 2; snapV = true; }
          if(Math.abs(y + bh / 2 - 50) < 1.5){ y = 50 - bh / 2; snapH = true; }
        }
        gv.classList.toggle('on', snapV); gh.classList.toggle('on', snapH);
        cfg.positions[key] = { x: +x.toFixed(2), y: +y.toFixed(2) };
        node.style.left = x + '%'; node.style.top = y + '%';
      };
      const up = () => {
        node.removeEventListener('pointermove', move); node.removeEventListener('pointerup', up);
        node.classList.remove('moving'); gv.classList.remove('on'); gh.classList.remove('on');
        loSaveAndPush();
      };
      node.addEventListener('pointermove', move); node.addEventListener('pointerup', up);
    });
  });
};

/* =========================================================
   5 quater. CAPTURES D'ÉCRAN DES VOLS (v1.6)
   ========================================================= */
function shotsCfg(){
  db.shotsCfg = Object.assign({ hotkey: 'Ctrl+Alt+F12', source: 'auto', autoEnabled: true, auto: { takeoff: true, cruise: true, landing: true }, sound: true, volume: 50 }, db.shotsCfg || {});
  db.shotsCfg.auto = Object.assign({ takeoff: true, cruise: true, landing: true }, db.shotsCfg.auto || {});
  return db.shotsCfg;
}
// Volume perçu : l'oreille est logarithmique, un curseur linéaire ne s'entend presque pas
// entre 40 et 100 %. On applique donc une courbe (≈ −12 dB à 50 %, silence à 0).
function volGain(pct, max){ const v = Math.max(0, Math.min(100, +pct || 0)) / 100; return (max || 1) * v * v; }
const hotkeyLabel = acc => String(acc || '').split('+').filter(Boolean).map(k => k === 'Shift' ? 'Maj' : k === 'Control' ? 'Ctrl' : k);
function renderHotkeyCaps(acc, recording){
  const box = $('hotkeyCaps'); if(!box) return;
  box.innerHTML = recording ? '<span class="rec-dot"></span><span class="rec-txt">Appuie sur ta combinaison… <small>(Échap pour annuler)</small></span>'
    : acc ? hotkeyLabel(acc).map(k => `<kbd>${esc(k)}</kbd>`).join('<span class="plus">+</span>') : '<span class="hint" style="margin:0;">Aucun raccourci</span>';
  $('hotkeyBox').classList.toggle('rec', !!recording);
}
function renderShotsSummary(){
  const c = shotsCfg();
  if($('shotKeyHint')) $('shotKeyHint').textContent = c.hotkey ? hotkeyLabel(c.hotkey).join('+') : '';
  const chip = $('shotAutoChip');
  if(chip){ chip.classList.toggle('on', c.autoEnabled !== false); chip.title = c.autoEnabled !== false ? 'Captures automatiques activées (clic pour les couper)' : 'Captures automatiques désactivées (clic pour les activer)'; }
  const sum = $('shotsSummary');
  if(sum){
    const steps = [['takeoff','décollage'],['cruise','croisière'],['landing','atterrissage']].filter(([k]) => c.auto[k]).map(([, l]) => l);
    sum.innerHTML = `<div><span>Raccourci</span><b>${c.hotkey ? hotkeyLabel(c.hotkey).map(k => `<kbd>${esc(k)}</kbd>`).join('+') : 'aucun'}</b></div>
      <div><span>Captures auto</span><b>${c.autoEnabled !== false && steps.length ? esc(steps.join(', ')) : 'désactivées'}</b></div>
      <div><span>Son</span><b>${c.sound ? c.volume + ' %' : 'coupé'}</b></div>`;
  }
}
async function pushShotsCfg(){
  renderShotsSummary();
  if(!window.shots) return;
  const r = await window.shots.setConfig(shotsCfg());
  const m = $('shotHotkeyMsg');
  if(m && !hotkeyRec){ m.className = 'status-msg ' + (r.ok ? 'ok' : 'err'); m.textContent = r.ok ? (r.hotkey ? `Raccourci actif : ${hotkeyLabel(r.hotkey).join(' + ')}` : 'Aucun raccourci : utilise le bouton du Briefing.') : r.error; }
  return r;
}
// Son de capture : petit « tic » doux à deux notes (l'ancien bruit blanc faisait sursauter).
function shutterSound(force){
  const c = shotsCfg();
  if(!c.sound && !force) return;
  const vol = volGain(c.volume, 0.22);
  if(vol <= 0) return;
  try{
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200; lp.connect(ac.destination);
    [[1318, 0], [1760, 0.075]].forEach(([f, t0]) => {
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + t0;
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g); g.connect(lp); o.start(t); o.stop(t + 0.18);
    });
    setTimeout(() => ac.close(), 600);
  }catch(e){ /* pas d'audio */ }
}
FBv15.shutterTest = () => shutterSound(true);
FBv15.toggleAutoShots = () => {
  const c = shotsCfg();
  c.autoEnabled = c.autoEnabled === false;
  if(c.autoEnabled && !c.auto.takeoff && !c.auto.cruise && !c.auto.landing) c.auto = { takeoff: true, cruise: true, landing: true };
  loadShotsForm(); queueSaveDb(); pushShotsCfg();
  fx(`<div class="lc-eyebrow">Captures automatiques ${c.autoEnabled ? 'activées' : 'désactivées'}</div><div class="hint" style="margin:4px 0 0;">${c.autoEnabled ? 'Décollage, croisière et atterrissage, selon tes réglages.' : 'Seuls le bouton et le raccourci prennent des captures.'}</div>`, 'fx-shot', 2600);
};
FBv15.openShotsSettings = () => { loadShotsForm(); $('shotsModalOverlay').classList.remove('hidden'); pushShotsCfg(); };
FBv15.closeShotsSettings = () => { if(hotkeyRec) hotkeyStop(true); $('shotsModalOverlay').classList.add('hidden'); };
FBv15.takeShot = async () => {
  const btn = $('shotBtn'); if(btn) btn.disabled = true;
  const r = await window.shots.capture('manuel');
  if(btn) btn.disabled = false;
  if(!r.ok) fx(`<div class="lc-eyebrow">Capture impossible</div><div class="hint" style="margin:4px 0 0;">${esc(r.error)}</div>`, 'fx-warn', 6000);
};
function onShotTaken(shot){
  shutterSound();
  const labels = { 'manuel': 'Capture', 'raccourci': 'Capture (raccourci)', 'décollage': 'Capture auto · décollage', 'croisière': 'Capture auto · croisière', 'atterrissage': 'Capture auto · atterrissage' };
  fx(`<div class="shot-toast"><img src="${esc(shot.url)}" alt=""><div><div class="lc-eyebrow">${esc(labels[shot.reason] || 'Capture')}</div><div class="hint" style="margin:2px 0 0;">${shot.from === 'window' ? 'Fenêtre du simulateur' : 'Écran principal'} · ${new Date(shot.ts).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit', second:'2-digit' })}<br>Rattachée au PIREP de ce vol.</div></div></div>`, 'fx-shot', 3500);
}
// Au PIREP : on rattache au vol les captures prises entre son début et sa fin (+ 3 min).
FBv15.attachFlightShots = async (data) => {
  if(typeof _pendingTrackData === 'undefined' || !_pendingTrackData) return;
  // Contrôleurs VATSIM/IVAO présents au départ et à l'arrivée (pour les succès « réseau »).
  try{
    const dep = ($('lbDep').value || '').trim().toUpperCase(), arr = ($('lbArr').value || '').trim().toUpperCase();
    const st = atcStations().filter(x => x.facility !== 'ATIS' && x.ap);
    const n = icao => icao ? st.filter(x => x.ap.icao === icao).length : 0;
    if(st.length) _pendingTrackData.atc = { dep: n(dep), arr: n(arr) };
  }catch(e){ /* sans info ATC */ }
  if(!window.shots) return;
  const from = data.startedAt ? new Date(data.startedAt).getTime() - 60000 : null;
  const to = (data.endedAt ? new Date(data.endedAt).getTime() : Date.now()) + 180000;
  try{
    const list = await window.shots.list({ from, to });
    if(list.length) _pendingTrackData.screenshots = list.map(x => x.name);
  }catch(e){ /* sans captures */ }
};
let galleryFlight = null, galleryItems = [], lbIndex = 0;
function flightShotNames(f){ return [ ...((f.trackData && f.trackData.screenshots) || []), ...(f.screenshots || []) ]; }
FBv15.openGallery = async (flightId) => {
  const f = db.logbook.find(x => x.id === flightId);
  if(!f) return;
  galleryFlight = f;
  $('galleryTitle').textContent = `Captures — ${f.callsign || 'Vol'} (${f.dep || '----'} → ${f.arr || '----'}) · ${FBShared.fmtDateFr(f.date)}`;
  $('galleryOverlay').classList.remove('hidden');
  await renderGallery();
};
async function renderGallery(){
  const f = galleryFlight;
  galleryItems = await window.shots.resolve(flightShotNames(f));
  // Les fichiers supprimés du disque disparaissent aussi du vol.
  const valid = new Set(galleryItems.map(x => x.name));
  if(f.trackData && f.trackData.screenshots) f.trackData.screenshots = f.trackData.screenshots.filter(n => valid.has(n));
  if(f.screenshots) f.screenshots = f.screenshots.filter(n => valid.has(n));
  $('galleryGrid').innerHTML = galleryItems.length
    ? galleryItems.map((g, i) => `<button class="g-item" onclick="FBv15.lightboxOpen(${i})"><img src="${esc(g.url)}" loading="lazy" alt=""><span>${new Date(g.ts).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })}</span></button>`).join('')
    : `<div class="g-empty"><div style="font-size:30px;">📷</div><b>Aucune capture pour ce vol</b><div class="hint">Pendant un vol suivi, utilise le bouton « Capture d'écran » du Briefing ou ton raccourci. Tu peux aussi ajouter des images existantes.</div></div>`;
}
FBv15.closeGallery = () => { $('galleryOverlay').classList.add('hidden'); FBv15.lightboxClose(); renderLogbook(); };
FBv15.galleryImport = async () => {
  const added = await window.shots.importFiles();
  if(!added.length) return;
  galleryFlight.screenshots = [ ...(galleryFlight.screenshots || []), ...added.map(a => a.name) ];
  saveDbNow();
  renderGallery();
};
FBv15.lightboxOpen = (i) => { lbIndex = i; $('lightbox').classList.remove('hidden'); showLb(); };
FBv15.lightboxClose = () => { $('lightbox').classList.add('hidden'); };
FBv15.lightboxStep = (d) => { if(!galleryItems.length) return; lbIndex = (lbIndex + d + galleryItems.length) % galleryItems.length; showLb(); };
function showLb(){
  const g = galleryItems[lbIndex]; if(!g) return FBv15.lightboxClose();
  $('lightboxImg').src = g.url;
  $('lightboxCap').textContent = `${lbIndex + 1} / ${galleryItems.length} · ${new Date(g.ts).toLocaleString('fr-FR', { dateStyle:'short', timeStyle:'medium' })}`;
}
FBv15.lightboxOpenFile = () => { const g = galleryItems[lbIndex]; if(g) window.shots.openFile(g.name); };
FBv15.lightboxDelete = async () => {
  const g = galleryItems[lbIndex]; if(!g) return;
  if(!confirm('Supprimer définitivement cette capture ?')) return;
  await window.shots.remove(g.name);
  ['screenshots'].forEach(k => { if(galleryFlight[k]) galleryFlight[k] = galleryFlight[k].filter(n => n !== g.name); });
  if(galleryFlight.trackData && galleryFlight.trackData.screenshots) galleryFlight.trackData.screenshots = galleryFlight.trackData.screenshots.filter(n => n !== g.name);
  saveDbNow();
  await renderGallery();
  if(galleryItems.length){ lbIndex = Math.min(lbIndex, galleryItems.length - 1); showLb(); } else FBv15.lightboxClose();
};
async function renderRouteShots(f){
  const box = $('routeShots');
  if(!box || !window.shots) return;
  const names = flightShotNames(f);
  if(!names.length){ box.classList.add('hidden'); return; }
  const items = await window.shots.resolve(names);
  box.classList.toggle('hidden', !items.length);
  $('routeShotsStrip').innerHTML = items.map(g => `<img src="${esc(g.url)}" loading="lazy" alt="" onclick="FBv15.openGallery('${f.id}')">`).join('');
}
function loadShotsForm(){
  const c = shotsCfg();
  if(!$('shotsModalOverlay')) return;
  renderHotkeyCaps(c.hotkey, hotkeyRec);
  $('shotSource').value = c.source;
  $('shotAutoAll').checked = c.autoEnabled !== false;
  $('shotAutoTakeoff').checked = c.auto.takeoff; $('shotAutoCruise').checked = c.auto.cruise; $('shotAutoLanding').checked = c.auto.landing;
  $('shotAutoSub').classList.toggle('disabled', c.autoEnabled === false);
  $('shotSound').checked = c.sound;
  $('shotVolume').value = c.volume; $('shotVolumeVal').textContent = c.volume + '%'; updateRangeFill($('shotVolume'));
  renderShotsSummary();
}
// Enregistrement du raccourci : le raccourci actuel est libéré pendant l'écoute (sinon il
// serait intercepté par Windows avant d'arriver ici), puis réenregistré ou remplacé.
let hotkeyRec = false, hotkeyPrev = '';
function hotkeyKeyName(e){
  if(/^F([1-9]|1[0-9]|2[0-4])$/.test(e.key)) return e.key;
  if(/^[a-z]$/i.test(e.key)) return e.key.toUpperCase();             // lettres : selon la disposition (AZERTY…)
  if(e.code && /^Key[A-Z]$/.test(e.code)) return e.code.slice(3);
  if(e.code && /^Digit\d$/.test(e.code)) return e.code.slice(5);     // chiffres : touche physique (sans Maj en AZERTY)
  if(e.code && /^Numpad\d$/.test(e.code)) return 'num' + e.code.slice(6);
  const map = { Space: 'Space', PrintScreen: 'PrintScreen', Insert: 'Insert', Delete: 'Delete', Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
    ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', NumpadAdd: 'numadd', NumpadSubtract: 'numsub', NumpadMultiply: 'nummult', NumpadDivide: 'numdiv', NumpadDecimal: 'numdec', Pause: 'Pause', ScrollLock: 'Scrolllock' };
  return map[e.code] || map[e.key] || null;
}
FBv15.hotkeyRecord = async () => {
  if(hotkeyRec){ hotkeyStop(true); return; }
  hotkeyRec = true; hotkeyPrev = shotsCfg().hotkey || '';
  if(window.shots) await window.shots.setConfig({ ...shotsCfg(), hotkey: '' });
  renderHotkeyCaps('', true);
  $('hotkeyRecordBtn').textContent = 'Annuler';
  const m = $('shotHotkeyMsg'); m.className = 'status-msg'; m.textContent = 'Exemples : Ctrl+Alt+S, Maj+F10, F9, Impr. écran.';
};
async function hotkeyStop(cancel, acc){
  hotkeyRec = false;
  if($('hotkeyRecordBtn')) $('hotkeyRecordBtn').textContent = 'Modifier';
  const c = shotsCfg();
  if(cancel){ c.hotkey = hotkeyPrev; renderHotkeyCaps(c.hotkey); await pushShotsCfg(); return; }
  c.hotkey = acc;
  renderHotkeyCaps(acc);
  const r = await pushShotsCfg();
  if(r && !r.ok){
    // Raccourci refusé (déjà pris par une autre appli) : on garde l'ancien.
    c.hotkey = hotkeyPrev; renderHotkeyCaps(c.hotkey);
    const m = $('shotHotkeyMsg'); const err = r.error;
    await pushShotsCfg();
    m.className = 'status-msg err'; m.textContent = `${hotkeyLabel(acc).join(' + ')} : ${err} L'ancien raccourci est conservé.`;
    return;
  }
  queueSaveDb();
}
function onHotkeyKeydown(e){
  if(!hotkeyRec) return;
  e.preventDefault(); e.stopImmediatePropagation();
  if(e.key === 'Escape'){ hotkeyStop(true); return; }
  const mods = [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift'].filter(Boolean);
  if(['Control','Alt','Shift','Meta','AltGraph'].includes(e.key)){
    $('hotkeyCaps').innerHTML = mods.map(k => `<kbd>${k === 'Shift' ? 'Maj' : k}</kbd>`).join('<span class="plus">+</span>') + '<span class="plus">+</span><span class="rec-txt">…</span>';
    return;
  }
  const k = hotkeyKeyName(e);
  const m = $('shotHotkeyMsg');
  if(!k){ m.className = 'status-msg err'; m.textContent = `Touche « ${e.key} » non prise en charge : essaie une lettre, un chiffre ou une touche F.`; return; }
  if(!mods.length && !/^F\d{1,2}$|^PrintScreen$|^Pause$|^Scrolllock$|^num/.test(k)){ m.className = 'status-msg err'; m.textContent = 'Ajoute Ctrl, Alt ou Maj (sauf pour les touches F1–F24, Impr. écran et le pavé numérique).'; return; }
  hotkeyStop(false, [...mods, k].join('+'));
}
function bindShotsSettings(){
  if(!$('shotsModalOverlay')) return;
  const c = shotsCfg();
  loadShotsForm();
  const save = () => { queueSaveDb(); pushShotsCfg(); };
  $('shotSource').addEventListener('change', e => { c.source = e.target.value; save(); });
  $('shotAutoAll').addEventListener('change', e => {
    c.autoEnabled = e.target.checked;
    if(c.autoEnabled && !c.auto.takeoff && !c.auto.cruise && !c.auto.landing) c.auto = { takeoff: true, cruise: true, landing: true };
    loadShotsForm(); save();
  });
  [['shotAutoTakeoff','takeoff'],['shotAutoCruise','cruise'],['shotAutoLanding','landing']].forEach(([id, k]) => $(id).addEventListener('change', e => { c.auto[k] = e.target.checked; save(); }));
  $('shotSound').addEventListener('change', e => { c.sound = e.target.checked; save(); if(c.sound) shutterSound(true); });
  $('shotVolume').addEventListener('input', e => { c.volume = +e.target.value; $('shotVolumeVal').textContent = e.target.value + '%'; updateRangeFill(e.target); });
  $('shotVolume').addEventListener('change', () => { save(); shutterSound(true); });
  // Écoute du clavier AVANT tous les autres raccourcis de l'appli (Ctrl+1…9, F, V, P…).
  window.addEventListener('keydown', onHotkeyKeydown, true);
}
FBv15.shotHotkeyClear = () => { if(hotkeyRec) hotkeyRec = false; $('hotkeyRecordBtn').textContent = 'Modifier'; shotsCfg().hotkey = ''; renderHotkeyCaps(''); queueSaveDb(); pushShotsCfg(); };
FBv15.shotHotkeyReset = () => { if(hotkeyRec) hotkeyRec = false; $('hotkeyRecordBtn').textContent = 'Modifier'; shotsCfg().hotkey = 'Ctrl+Alt+F12'; renderHotkeyCaps('Ctrl+Alt+F12'); queueSaveDb(); pushShotsCfg(); };

/* =========================================================
   5 quinquies. RAPPEL « TRACKER NON LANCÉ » (v1.6)
   ========================================================= */
function watchCfgR(){
  db.watchCfg = Object.assign({ enabled: true, autoStart: false, volume: 70 }, db.watchCfg || {});
  return db.watchCfg;
}
let watchMuteUntil = 0, watchBanner = null;
function watchSound(){
  try{
    const vol = volGain(watchCfgR().volume, 0.3);
    if(vol <= 0) return;
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    // Trois bips montants façon « master caution ».
    [[880, 0], [880, 0.22], [1175, 0.44]].forEach(([f, t0]) => {
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + t0;
      o.type = 'square'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.setValueAtTime(vol, t + 0.14); g.gain.linearRampToValueAtTime(0, t + 0.17);
      o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.2);
    });
    setTimeout(() => ac.close(), 1200);
  }catch(e){ /* pas d'audio */ }
}
FBv15.watchTestSound = () => watchSound();
function onWatchMoving(d){
  if(Date.now() < watchMuteUntil) return;
  watchSound();
  if(watchBanner && document.body.contains(watchBanner)) return;
  watchBanner = fx(`<div class="watch-alert"><div class="wa-ic">⚠</div><div><div class="lc-eyebrow">Tracker non lancé</div><div class="ach-title">${d.airborne ? 'Tu voles' : 'Ton avion roule'} sans suivi</div>
    <div class="hint" style="margin:2px 0 8px;">Ce vol ne sera ni enregistré dans le logbook ni affiché sur ton overlay.</div>
    <div class="btn-row" style="margin:0;"><button class="btn small primary" onclick="FBv15.watchStartTracker(this)">Lancer le tracker</button><button class="btn small" onclick="FBv15.watchMute(this)">Ignorer 30 min</button></div></div></div>`, 'fx-watch', 0);
}
FBv15.watchStartTracker = async (btn) => {
  const card = btn.closest('.fx-card'); if(card) card.remove();
  switchView('briefing');
  if(!(await window.tracker.isConnected())) toggleTrackerConnection();
};
FBv15.watchMute = (btn) => { watchMuteUntil = Date.now() + 30 * 60000; const card = btn.closest('.fx-card'); if(card) card.remove(); };
function bindWatchSettings(){
  const c = watchCfgR();
  if(window.watch) window.watch.setConfig({ enabled: c.enabled, autoStart: c.autoStart });
  if(!$('watchPanel')) return;
  $('watchEnabled').checked = c.enabled; $('watchAutoStart').checked = c.autoStart;
  $('watchVolume').value = c.volume; $('watchVolumeVal').textContent = c.volume + '%'; updateRangeFill($('watchVolume'));
  const push = () => { queueSaveDb(); window.watch && window.watch.setConfig({ enabled: c.enabled, autoStart: c.autoStart }); };
  $('watchEnabled').addEventListener('change', e => { c.enabled = e.target.checked; push(); });
  $('watchAutoStart').addEventListener('change', e => { c.autoStart = e.target.checked; push(); });
  $('watchVolume').addEventListener('input', e => { c.volume = +e.target.value; $('watchVolumeVal').textContent = e.target.value + '%'; updateRangeFill(e.target); queueSaveDb(); });
  $('watchVolume').addEventListener('change', () => watchSound());
  window.watch.onMoving(onWatchMoving);
  window.watch.onAutoStarted(() => fx(`<div class="lc-eyebrow">Tracker lancé automatiquement</div><div class="hint" style="margin:4px 0 0;">Ton avion bougeait : le suivi du vol a démarré tout seul.</div>`, 'fx-shot', 6000));
  window.watch.onFocusTracker(() => switchView('briefing'));
  if(window.tracker) window.tracker.onStatus(d => { if(d.connected && watchBanner){ watchBanner.remove(); watchBanner = null; } });
}

/* =========================================================
   6. SAUVEGARDES
   ========================================================= */
async function renderBackups(){
  const box = $('backupList');
  if(!box || !window.backups) return;
  const list = await window.backups.list();
  box.innerHTML = list.length ? list.map(b => `<div class="backup-row">
      <span class="bk-date">${esc(new Date(b.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday:'short', day:'numeric', month:'short', year:'numeric' }))}</span>
      <span class="bk-meta">${b.valid ? (b.flights != null ? b.flights + ' vol' + (b.flights > 1 ? 's' : '') : '') : '⚠ illisible'} · ${(b.size / 1024).toFixed(0)} Ko</span>
      <button class="btn small" ${b.valid ? '' : 'disabled'} onclick="FBv15.restoreBackup('${esc(b.name)}')">Restaurer</button>
    </div>`).join('') : '<div class="hint">Aucune sauvegarde pour l\'instant — la première sera faite à ta prochaine modification.</div>';
}
FBv15.backupNow = async () => {
  const r = await window.backups.now();
  const m = $('backupStatus'); m.className = 'status-msg ' + (r.ok ? 'ok' : 'err');
  m.textContent = r.ok ? 'Sauvegarde du jour mise à jour ✓' : 'Sauvegarde impossible.';
  renderBackups();
};
FBv15.openBackupFolder = () => window.backups.openFolder();
FBv15.restoreBackup = async (name) => {
  if(!confirm('Restaurer cette sauvegarde ? Tes données actuelles seront remplacées (une copie de sécurité de l\'état actuel est gardée dans le dossier de données), puis l\'appli se rechargera.')) return;
  const r = await window.backups.restore(name);
  if(!r.ok){ const m = $('backupStatus'); m.className = 'status-msg err'; m.textContent = r.error || 'Restauration impossible.'; return; }
  window.api.reload();
};
async function checkRecovery(){
  if(!window.backups) return;
  const info = await window.backups.recoveryInfo();
  if(!info) return;
  if(info.from){
    fx(`<div class="lc-eyebrow">Sauvegarde restaurée</div><div class="ach-title">Ton fichier de données était illisible</div><div class="hint" style="margin:4px 0 0;">FlightBrief a repris automatiquement la sauvegarde du ${esc(new Date(info.date + 'T12:00:00').toLocaleDateString('fr-FR'))}. Le fichier abîmé a été mis de côté dans le dossier de données.</div>`, 'fx-warn', 0);
  } else {
    fx(`<div class="lc-eyebrow">Attention</div><div class="ach-title">Fichier de données illisible</div><div class="hint" style="margin:4px 0 0;">Aucune sauvegarde valide n'a été trouvée. Le fichier abîmé a été copié dans le dossier de données (Admin → Données) : ne le supprime pas.</div>`, 'fx-warn', 0);
  }
}

/* =========================================================
   7. MISE À JOUR EN UN CLIC
   ========================================================= */
let updBusy = false;
FBv15.startOneClickUpdate = async function(){
  if(!window.updater){ openUpdatePage(); return; }
  const btn = $('updateNowBtn');
  if(btn.dataset.ready === '1'){ btn.disabled = true; btn.textContent = 'Redémarrage…'; await window.updater.install(); return; }
  if(updBusy) return;
  updBusy = true;
  btn.disabled = true; btn.textContent = 'Préparation…';
  $('updateProgress').classList.remove('hidden');
  $('updateProgressFill').style.width = '0%';
  $('updateProgressText').textContent = 'Recherche du fichier de mise à jour…';
  const r = await window.updater.download();
  if(!r.ok){
    updBusy = false;
    btn.disabled = false; btn.textContent = 'Mettre à jour maintenant';
    $('updateProgressText').innerHTML = `Mise à jour automatique impossible (${esc(r.error)}). Utilise le bouton « Télécharger depuis la page officielle » ci-dessous.`;
    return;
  }
  btn.textContent = 'Téléchargement…';
  $('updateProgressText').textContent = `Téléchargement de la v${r.version}…`;
};
function initUpdater(){
  if(!window.updater) return;
  window.updater.onProgress(p => {
    $('updateProgress').classList.remove('hidden');
    $('updateProgressFill').style.width = p.percent + '%';
    const mb = x => (x / 1048576).toFixed(1);
    $('updateProgressText').textContent = `Téléchargement… ${p.percent} %${p.total ? ` (${mb(p.transferred)} / ${mb(p.total)} Mo)` : ''}`;
  });
  window.updater.onDownloaded(info => {
    updBusy = false;
    const btn = $('updateNowBtn');
    btn.disabled = false; btn.dataset.ready = '1';
    btn.textContent = 'Redémarrer et installer';
    $('updateProgressFill').style.width = '100%';
    $('updateProgressText').textContent = `v${info.version || ''} prête. FlightBrief va se fermer, s'installer puis se relancer tout seul (tes données sont conservées).`;
  });
  window.updater.onError(e => {
    updBusy = false;
    const btn = $('updateNowBtn');
    btn.disabled = false; btn.textContent = 'Mettre à jour maintenant'; btn.dataset.ready = '';
    $('updateProgressText').textContent = `Échec du téléchargement (${e.error}). Réessaie, ou passe par la page officielle.`;
  });
}

/* =========================================================
   8. BOT TWITCH + OVERLAY ALERTES
   ========================================================= */
const TW_COMMANDS = [
  ['eta', '!eta', "heure d'arrivée, distance restante, début de descente"],
  ['route', '!route', 'départ, arrivée et route du plan de vol'],
  ['metar', '!metar', 'météo de l\'arrivée (ou !metar LFPG)'],
  ['avion', '!avion', 'appareil du vol'],
  ['alt', '!alt', 'altitude, vitesse sol et phase de vol'],
  ['landing', '!landing', 'dernier atterrissage : taux, G, note'],
  ['pari', '!pari 180', 'pronostic sur le taux de toucher'],
  ['top', '!top', 'classement des meilleurs parieurs'],
  ['fb', '!fb', 'liste des commandes actives']
];
let twState = null;
function twCfg(){
  const d = { enabled: false, channel: '', botName: 'FlightBot', prefixMessages: true, clientId: '', cooldownSec: 15, replyOnOverlay: false,
    commands: { eta: true, route: true, metar: true, avion: true, alt: true, landing: true, pari: true, top: true, fb: true },
    bets: { autoOpen: true, autoLock: true, lockAglFt: 1000, announceInChat: true } };
  const c = db.twitch || {};
  db.twitch = { ...d, ...c, commands: { ...d.commands, ...(c.commands || {}) }, bets: { ...d.bets, ...(c.bets || {}) } };
  if(!db.twitch.channel && db.userProfile && db.userProfile.twitchHandle) db.twitch.channel = db.userProfile.twitchHandle.replace(/^@/, '').toLowerCase();
  return db.twitch;
}
let _pushTwTimer = null;
function pushTwitchCfg(){
  clearTimeout(_pushTwTimer);
  _pushTwTimer = setTimeout(async () => {
    queueSaveDb();
    if(window.twitch){ twState = await window.twitch.setConfig(twCfg()); renderTwitch(); }
  }, 300);
}
function bindTwitch(){
  const c = twCfg();
  $('twEnabled').checked = c.enabled;
  $('twChannel').value = c.channel;
  $('twBotName').value = c.botName;
  $('twPrefix').checked = c.prefixMessages;
  $('twCooldown').value = c.cooldownSec; $('twCooldownVal').textContent = c.cooldownSec + ' s'; updateRangeFill($('twCooldown'));
  $('twReplyOverlay').checked = !!c.replyOnOverlay;
  $('twBetAutoOpen').checked = c.bets.autoOpen;
  $('twBetAutoLock').checked = c.bets.autoLock;
  $('twBetLockAgl').value = c.bets.lockAglFt; $('twBetLockAglVal').textContent = c.bets.lockAglFt + ' ft'; updateRangeFill($('twBetLockAgl'));
  $('twBetAnnounce').checked = c.bets.announceInChat;
  $('twCommands').innerHTML = TW_COMMANDS.map(([k, cmd, d]) => `<div class="switch-row tw-cmd"><span><code>${esc(cmd)}</code><small>${esc(d)}</small></span><label class="switch"><input type="checkbox" data-cmd="${k}" ${c.commands[k] ? 'checked' : ''}><span class="slider"></span></label></div>`).join('');
  $('twCommands').querySelectorAll('input[data-cmd]').forEach(i => i.addEventListener('change', () => { twCfg().commands[i.dataset.cmd] = i.checked; pushTwitchCfg(); }));
  const on = (id, ev, fn) => $(id).addEventListener(ev, fn);
  on('twEnabled', 'change', e => { twCfg().enabled = e.target.checked; pushTwitchCfg(); });
  on('twChannel', 'change', e => { twCfg().channel = e.target.value.trim().replace(/^.*twitch\.tv\//i, '').replace(/^[#@]/, '').toLowerCase(); e.target.value = twCfg().channel; pushTwitchCfg(); });
  on('twBotName', 'input', e => { twCfg().botName = e.target.value.trim() || 'FlightBot'; pushTwitchCfg(); });
  on('twPrefix', 'change', e => { twCfg().prefixMessages = e.target.checked; pushTwitchCfg(); });
  on('twCooldown', 'input', e => { twCfg().cooldownSec = +e.target.value; $('twCooldownVal').textContent = e.target.value + ' s'; updateRangeFill(e.target); pushTwitchCfg(); });
  on('twReplyOverlay', 'change', e => { twCfg().replyOnOverlay = e.target.checked; pushTwitchCfg(); });
  on('twBetAutoOpen', 'change', e => { twCfg().bets.autoOpen = e.target.checked; pushTwitchCfg(); });
  on('twBetAutoLock', 'change', e => { twCfg().bets.autoLock = e.target.checked; pushTwitchCfg(); });
  on('twBetLockAgl', 'input', e => { twCfg().bets.lockAglFt = +e.target.value; $('twBetLockAglVal').textContent = e.target.value + ' ft'; updateRangeFill(e.target); pushTwitchCfg(); });
  on('twBetAnnounce', 'change', e => { twCfg().bets.announceInChat = e.target.checked; pushTwitchCfg(); });
}
function renderTwitch(){
  const s = twState;
  if(!s || !$('twStatusText')) return;
  const st = s.status || {}, c = twCfg();
  const dot = $('twStatusDot');
  const label = !c.enabled ? 'Désactivé'
    : st.state === 'connected' ? (st.anonymous ? `Connecté au chat de #${st.channel} en lecture — réponses sur l'overlay Alertes` : `Connecté au chat de #${st.channel} en tant que ${st.login}`)
    : st.state === 'connecting' ? 'Connexion au chat…'
    : st.state === 'reconnecting' ? `Connexion perdue — nouvel essai dans ${st.retryInSec || '…'} s`
    : st.state === 'error' ? (st.error || 'Erreur de connexion')
    : (st.error || (c.channel ? 'Déconnecté' : 'Indique ta chaîne Twitch pour démarrer'));
  $('twStatusText').textContent = label;
  $('twStatusText').className = 'tw-status ' + (st.state === 'connected' && c.enabled ? 'ok' : st.state === 'error' ? 'err' : '');
  dot.style.background = c.enabled && st.state === 'connected' ? 'var(--phosphor)' : c.enabled ? 'var(--accent-vfr)' : 'var(--text-secondary)';
  dot.style.boxShadow = c.enabled && st.state === 'connected' ? '0 0 8px var(--phosphor)' : 'none';

  const a = s.auth || {};
  renderTwitchApp();
  $('twAccountBox').innerHTML = !c.clientId
    ? `<div class="tw-acc-row tw-locked"><span class="tw-avatar off">?</span><div><b>Lecture seule</b><div class="hint" style="margin:0;">Déclare d'abord ton application Twitch ci-dessus pour pouvoir connecter un compte.</div></div></div>`
    : a.loggedIn
    ? `<div class="tw-acc-row"><span class="tw-avatar">${esc((a.login || '?')[0].toUpperCase())}</span><div><b>${esc(a.login)}</b><div class="hint" style="margin:0;">Le bot répond dans le chat avec ce compte${c.prefixMessages ? `, sous la forme « [${esc(c.botName)}] … »` : ''}.</div></div><button class="btn small" onclick="FBv15.twitchLogout()">Déconnecter</button></div>`
    : `<div class="tw-acc-row"><span class="tw-avatar off">?</span><div><b>Lecture seule</b><div class="hint" style="margin:0;">Aucun compte connecté.</div></div><button class="btn small primary" onclick="FBv15.twitchLogin()">Connecter un compte</button></div>`;

  const b = s.bet || {};
  const stateLabel = { closed: 'Fermé', open: 'Ouvert', locked: 'Verrouillé — en attente du toucher', resolved: 'Terminé' }[b.state] || b.state;
  $('betState').textContent = stateLabel + (b.count ? ` · ${b.count} pronostic${b.count > 1 ? 's' : ''}` : '');
  $('betState').className = 'bet-state s-' + b.state;
  const r = b.result;
  $('betResult').classList.toggle('hidden', !r);
  if(r){
    $('betResult').innerHTML = `<div class="bet-actual">−${r.actual} <small>ft/min</small></div>
      <div class="bet-podium">${(r.podium || []).map((p, i) => `<div class="pod p${i+1}"><span class="pos">${['🥇','🥈','🥉'][i]}</span><b>${esc(p.name)}</b><span>${p.fpm} (±${p.diff})</span></div>`).join('') || '<div class="hint">Aucun pronostic.</div>'}</div>`;
  }
  const g = (b.guesses || []).slice().sort((x, y) => x.fpm - y.fpm);
  $('betGuesses').innerHTML = g.length ? `<div class="guess-strip">${g.map(x => `<span class="guess" title="${esc(x.name)}">${esc(x.name)} <b>${x.fpm}</b></span>`).join('')}</div>`
    : `<div class="hint">${b.state === 'open' ? 'Paris ouverts : en attente des pronostics du chat (!pari 180).' : "Les pronostics du chat (<code>!pari 180</code>) s'affichent ici pendant que les paris sont ouverts."}</div>`;

  const lb = s.leaderboard || [];
  const maxW = lb.length ? lb[0].wins : 1;
  $('betLeaderboard').innerHTML = lb.length ? lb.map((p, i) => `<div class="row${i === 0 ? ' top-rank' : ''}" style="--row-accent:#ffd166;">
      <span class="rank">${i + 1}</span><span class="name">${esc(p.name)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.round(100 * p.wins / maxW)}%"></div></div>
      <span class="count">${p.wins}<span class="pct">/${p.bets}</span></span></div>`).join('') : '<div class="empty">Personne n\'a encore gagné de pari.</div>';
  const kindIcon = { cmd: '💬', reply: '🤖', bet: '🎲', error: '⚠', info: 'ℹ' };
  $('twLog').innerHTML = (s.log || []).length ? s.log.map(l => `<div class="tw-log-row k-${esc(l.kind)}"><span class="t">${new Date(l.at).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })}</span><span>${kindIcon[l.kind] || ''}</span><span>${l.user ? '<b>' + esc(l.user) + '</b> ' : ''}${esc(l.text)}${l.kind === 'reply' && !l.inChat ? ' <i>(overlay)</i>' : ''}</span></div>`).join('') : '<div class="hint">Rien pour l\'instant. Tape <code>!fb</code> dans ton chat pour tester.</div>';
}
/* ---- Application Twitch propre à chaque utilisateur (Client ID) ---- */
let twAppEditing = false;
function renderTwitchApp(){
  const box = $('twAppBox');
  if(!box) return;
  const c = twCfg();
  if(c.clientId && !twAppEditing){
    box.innerHTML = `<div class="tw-app-ok"><span class="tw-app-ic">✓</span><div><b>Application déclarée</b><div class="hint" style="margin:0;">ID client <code>${esc(c.clientId.slice(0, 4) + '…' + c.clientId.slice(-4))}</code></div></div>
      <button class="btn small" onclick="FBv15.twitchAppEdit(true)">Modifier</button></div>`;
    return;
  }
  const handle = (c.channel || (db.userProfile && db.userProfile.twitchHandle) || 'tonpseudo').replace(/[^a-z0-9_]/gi, '');
  box.innerHTML = `<div class="tw-app-setup">
    <p class="hint" style="margin:0 0 10px;">Pour que le bot puisse parler dans ton chat, Twitch demande que chaque streamer déclare <b>sa propre application</b> (gratuit, 2 minutes, une seule fois). Elle reste à toi : FlightBrief n'utilise aucun identifiant commun.</p>
    <ol class="tw-steps">
      <li><span>Ouvre la console développeur de Twitch et connecte-toi avec ton compte.</span>
        <button class="btn small" onclick="window.api.openExternal('https://dev.twitch.tv/console/apps/create')">Ouvrir la console Twitch ↗</button>
        <div class="hint">Si Twitch le demande, active d'abord la double authentification sur ton compte.</div></li>
      <li><span>Remplis le formulaire « Enregistrer votre application » :</span>
        <div class="tw-form">
          <div><small>Nom</small><code>FlightBrief-${esc(handle)}</code><button class="tw-copy" onclick="FBv15.copyText('FlightBrief-${esc(handle)}', this)">Copier</button></div>
          <div><small>URL de redirection OAuth</small><code>http://localhost</code><button class="tw-copy" onclick="FBv15.copyText('http://localhost', this)">Copier</button></div>
          <div><small>Catégorie</small><b>Chat Bot</b></div>
          <div><small>Type de client</small><b class="tw-must">Public</b></div>
        </div>
        <div class="hint">Le nom doit être unique sur tout Twitch : garde ton pseudo dedans. « Public » est indispensable, c'est ce qui permet la connexion par code sans mot de passe.</div></li>
      <li><span>Clique sur « Créer », puis sur « Gérer » à côté de ton application, et copie l'<b>ID client</b> ici :</span>
        <div class="simbrief-row" style="margin-top:6px;">
          <input type="text" id="twClientIdInput" placeholder="ex : abcd1234efgh5678ijkl9012mnop34" value="${esc(c.clientId || '')}" spellcheck="false" autocomplete="off">
          <button class="btn small primary" id="twClientIdSave" onclick="FBv15.twitchSaveClientId()">Valider</button>
        </div>
        <div class="status-msg" id="twClientIdMsg"></div></li>
    </ol>
    ${c.clientId ? '<div class="btn-row"><button class="btn small" onclick="FBv15.twitchAppEdit(false)">Annuler</button><button class="btn small danger" onclick="FBv15.twitchClearClientId()">Retirer l\'application</button></div>' : ''}
  </div>`;
}
FBv15.copyText = async (txt, btn) => {
  await window.api.copyToClipboard(txt);
  if(btn){ const t = btn.textContent; btn.textContent = 'Copié ✓'; setTimeout(() => { btn.textContent = t; }, 1400); }
};
FBv15.twitchAppEdit = (on) => { twAppEditing = !!on; renderTwitchApp(); };
FBv15.twitchSaveClientId = async () => {
  const input = $('twClientIdInput'), msg = $('twClientIdMsg'), btn = $('twClientIdSave');
  const id = (input.value || '').trim().toLowerCase().replace(/\s+/g, '');
  input.value = id;
  msg.className = 'status-msg'; msg.textContent = 'Vérification auprès de Twitch…';
  btn.disabled = true;
  const r = window.twitch.checkClientId ? await window.twitch.checkClientId(id) : { ok: /^[a-z0-9]{30}$/.test(id) };
  btn.disabled = false;
  if(!r.ok){ msg.className = 'status-msg err'; msg.textContent = r.error || 'ID client refusé.'; return; }
  const changed = twCfg().clientId !== id;
  twCfg().clientId = id;
  twAppEditing = false;
  queueSaveDb();
  twState = await window.twitch.setConfig(twCfg());
  renderTwitch();
  const m = $('twLoginMsg');
  m.className = 'status-msg ok';
  m.textContent = changed ? 'Application Twitch enregistrée ✓ — tu peux maintenant connecter le compte qui parlera dans le chat.' : 'Application Twitch inchangée ✓';
};
FBv15.twitchClearClientId = async () => {
  if(!confirm('Retirer ton application Twitch ? Le compte connecté sera déconnecté et le bot repassera en lecture seule.')) return;
  twCfg().clientId = '';
  twAppEditing = false;
  queueSaveDb();
  twState = await window.twitch.setConfig(twCfg());
  renderTwitch();
};
FBv15.twitchLogin = async () => {
  const m = $('twLoginMsg'); m.className = 'status-msg'; m.textContent = 'Ouverture de Twitch…';
  const r = await window.twitch.startLogin();
  if(!r.ok){ m.className = 'status-msg err'; m.textContent = r.error; return; }
  m.textContent = '';
  $('twDeviceCode').textContent = r.userCode;
  $('twDeviceBox').classList.remove('hidden');
};
FBv15.twitchCopyCode = () => window.api.copyToClipboard($('twDeviceCode').textContent);
FBv15.twitchCancelLogin = async () => { await window.twitch.cancelLogin(); $('twDeviceBox').classList.add('hidden'); };
FBv15.twitchLogout = async () => { twState = await window.twitch.logout(); renderTwitch(); };
FBv15.twitchBet = async (action) => {
  if(action === 'reset-leaderboard' && !confirm('Remettre le classement des parieurs à zéro ?')) return;
  await window.twitch.bet(action);
  twState = await window.twitch.getState(); renderTwitch();
};

let alertsUrl = '';
function bindAlertsOverlay(){
  const c = alertsCfg();
  $('alPosition').value = c.position;
  $('alDuration').value = c.durationSec; $('alDurationVal').textContent = c.durationSec + ' s'; updateRangeFill($('alDuration'));
  $('alScale').value = c.scale; $('alScaleVal').textContent = c.scale + '%'; updateRangeFill($('alScale'));
  $('alTypeLanding').checked = c.types.landing; $('alTypeBet').checked = c.types.bet; $('alTypeAchievement').checked = c.types.achievement; $('alTypeChat').checked = c.types.chat;
  const push = () => { queueSaveDb(); window.alerts && window.alerts.setConfig(alertsPayload()); };
  $('alPosition').addEventListener('change', e => { alertsCfg().position = e.target.value; push(); });
  $('alDuration').addEventListener('input', e => { alertsCfg().durationSec = +e.target.value; $('alDurationVal').textContent = e.target.value + ' s'; updateRangeFill(e.target); push(); });
  $('alScale').addEventListener('input', e => { alertsCfg().scale = +e.target.value; $('alScaleVal').textContent = e.target.value + '%'; updateRangeFill(e.target); push(); });
  [['alTypeLanding','landing'],['alTypeBet','bet'],['alTypeAchievement','achievement'],['alTypeChat','chat']].forEach(([id, k]) => $(id).addEventListener('change', e => { alertsCfg().types[k] = e.target.checked; push(); }));
  bindAlertsDesign(push);
  push();
}
/* ---- Design des alertes (v1.6, enrichi en v1.6.1) ---- */
function loadAlertsDesignForm(){
  const st = alertsCfg().style, eff = effectiveAlertStyle();
  $('alThemes').innerHTML = Object.entries(ALERT_THEMES).map(([k, t]) => `<button class="al-theme ${st.theme === k ? 'on' : ''}" data-theme="${k}" style="--tb:${t.bg};--tt:${t.text};--ta:${t.accent}"><i></i>${t.label}</button>`).join('');
  $('alThemes').querySelectorAll('button').forEach(b => b.onclick = () => {
    const cur = alertsCfg().style;
    const keep = { sound: cur.sound, volume: cur.volume, width: cur.width, textScale: cur.textScale, font: cur.font, animation: cur.animation, cards: cur.cards, accentMode: cur.accentMode, stripe: cur.stripe, timer: cur.timer };
    alertsCfg().style = Object.assign(defaultAlertStyle(b.dataset.theme), keep); loadAlertsDesignForm(); _pushAlerts();
  });
  // En mode « Assortir », le formulaire montre les valeurs reprises de l'overlay live.
  const hex = v => /^#[0-9a-f]{6}$/i.test(v || '') ? v : '#e7edf2';
  $('alsMatch').checked = !!st.matchLive;
  $('alsLockable').classList.toggle('locked', !!st.matchLive);
  $('alsBg').value = hex(eff.bg); $('alsBg2').value = hex(eff.bg2 || eff.bg); $('alsText').value = hex(eff.text); $('alsSub').value = st.matchLive ? hex(eff.text) : hex(eff.sub);
  $('alsAccent').value = hex(eff.accent); $('alsBorderColor').value = hex(eff.borderColor);
  $('alsGradient').checked = !!eff.gradient; $('alsBg2').disabled = !eff.gradient;
  $('alsAccentByType').checked = st.accentMode !== 'custom';
  const rng = (id, v, suf) => { $(id).value = v; $(id + 'Val').textContent = v + suf; updateRangeFill($(id)); };
  rng('alsOpacity', eff.opacity, '%'); rng('alsWidth', st.width, ' px'); rng('alsRadius', eff.radius, ' px'); rng('alsVolume', st.volume, '%');
  rng('alsTextScale', st.textScale || 100, '%'); rng('alsBorderWidth', eff.borderWidth || 1, ' px');
  $('alsFont').value = eff.font; if(!$('alsFont').value) $('alsFont').selectedIndex = 0;
  $('alsAnim').value = st.animation;
  ['Border','Stripe','Shadow','Blur','Timer','Sound'].forEach(k => { $('als' + k).checked = !!eff[k.toLowerCase()]; });
  renderAlertCards();
}
function renderAlertCards(){
  const st = alertsCfg().style, byType = st.accentMode !== 'custom';
  $('alsCards').classList.toggle('single', !byType);
  $('alsCards').innerHTML = ALERT_CARD_TYPES.map(t => {
    const c = st.cards[t.k] || {};
    const gradeLock = t.grade && c.byGrade !== false;
    return `<div class="al-card-row" data-k="${t.k}">
      <span class="al-card-name">${t.icon} ${t.label}</span>
      <input type="color" class="al-card-color" value="${esc(c.color || t.def)}" ${!byType || gradeLock ? 'disabled' : ''} title="Couleur de cette carte">
      ${t.grade ? `<label class="al-card-opt"><input type="checkbox" class="al-card-grade" ${gradeLock ? 'checked' : ''} ${!byType ? 'disabled' : ''}> selon la note</label>` : '<span></span>'}
      ${t.title ? `<input type="text" class="al-card-label" maxlength="32" placeholder="${esc(t.title)}" value="${esc(c.label || '')}" title="Titre affiché sur la carte">` : '<span class="hint" style="margin:0;">—</span>'}
    </div>`;
  }).join('') + `<div class="hint" style="margin:6px 0 0;">${byType ? 'Chaque type de carte garde sa couleur. Laisse un titre vide pour garder celui par défaut.' : 'Toutes les cartes utilisent la couleur d\'accent ci-dessus.'}</div>`;
  $('alsCards').querySelectorAll('.al-card-row').forEach(row => {
    const c = st.cards[row.dataset.k];
    const color = row.querySelector('.al-card-color'), grade = row.querySelector('.al-card-grade'), label = row.querySelector('.al-card-label');
    color.addEventListener('input', () => { c.color = color.value; _pushAlerts(); });
    if(grade) grade.addEventListener('change', () => { c.byGrade = grade.checked; if(!grade.checked && !c.color) c.color = '#54d6e8'; renderAlertCards(); _pushAlerts(); });
    if(label) label.addEventListener('input', () => { c.label = label.value.trim(); _pushAlerts(); });
  });
}
// Carillon des alertes, joué dans l'appli pour régler le volume (même courbe que dans OBS).
function alertsChime(type){
  const st = alertsCfg().style;
  const vol = volGain(st.volume != null ? st.volume : 60, 0.3);
  if(vol <= 0) return;
  try{
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const notes = type === 'achievement' ? [660, 880, 1320] : type === 'landing' ? [523, 784] : [784];
    notes.forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + i * 0.13;
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + 0.65);
    });
    setTimeout(() => ac.close(), 1300);
  }catch(e){ /* pas d'audio */ }
}
FBv15.alertsChimeTest = () => alertsChime('achievement');
let _pushAlerts = () => {};
function bindAlertsDesign(push){
  if(!$('alDesign')) return;
  _pushAlerts = push;
  loadAlertsDesignForm();
  const st = () => alertsCfg().style;
  const unlockedOnly = fn => e => { if(st().matchLive) return; fn(e); };
  $('alsMatch').addEventListener('change', e => {
    st().matchLive = e.target.checked;
    if(e.target.checked) st().accentMode = 'custom';   // une seule couleur : celle de l'overlay live
    loadAlertsDesignForm(); push();
  });
  [['alsBg','bg'],['alsBg2','bg2'],['alsText','text'],['alsSub','sub'],['alsBorderColor','borderColor']].forEach(([id, k]) => $(id).addEventListener('input', unlockedOnly(e => { st()[k] = e.target.value; if(k === 'bg' && !st().gradient) st().bg2 = e.target.value; push(); })));
  $('alsAccent').addEventListener('input', unlockedOnly(e => { st().accent = e.target.value; st().accentMode = 'custom'; $('alsAccentByType').checked = false; renderAlertCards(); push(); }));
  $('alsGradient').addEventListener('change', unlockedOnly(e => { st().gradient = e.target.checked; if(!e.target.checked) st().bg2 = st().bg; else if(st().bg2 === st().bg) st().bg2 = '#06080b'; loadAlertsDesignForm(); push(); }));
  $('alsAccentByType').addEventListener('change', e => { st().accentMode = e.target.checked ? 'type' : 'custom'; renderAlertCards(); push(); });
  const ranges = [['alsOpacity','opacity','%', true],['alsRadius','radius',' px', true],['alsBorderWidth','borderWidth',' px', true],['alsWidth','width',' px'],['alsTextScale','textScale','%'],['alsVolume','volume','%']];
  ranges.forEach(([id, k, suf, lockable]) => $(id).addEventListener('input', e => {
    if(lockable && st().matchLive){ loadAlertsDesignForm(); return; }
    st()[k] = +e.target.value; $(id + 'Val').textContent = e.target.value + suf; updateRangeFill(e.target); push();
  }));
  $('alsVolume').addEventListener('change', () => alertsChime('achievement'));
  $('alsFont').addEventListener('change', unlockedOnly(e => { st().font = e.target.value; push(); }));
  $('alsAnim').addEventListener('change', e => { st().animation = e.target.value; push(); });
  ['Border','Shadow','Blur'].forEach(k => $('als' + k).addEventListener('change', e => { if(st().matchLive){ loadAlertsDesignForm(); return; } st()[k.toLowerCase()] = e.target.checked; push(); }));
  ['Stripe','Timer','Sound'].forEach(k => $('als' + k).addEventListener('change', e => { st()[k.toLowerCase()] = e.target.checked; push(); if(k === 'Sound' && e.target.checked) alertsChime('achievement'); }));
  $('alDesign').addEventListener('toggle', () => {
    const f = $('alPreviewFrame');
    if($('alDesign').open && alertsUrl && !f.src) f.src = alertsUrl + '?preview=1';
  });
}
// Appelé par app.js quand le style de l'overlay live change.
FBv15.onLiveStyleChanged = () => {
  if(!alertsCfg().style.matchLive) return;
  if(window.alerts) window.alerts.setConfig(alertsPayload());
  if($('alDesign')) loadAlertsDesignForm();
};
FBv15.alertsDesignReset = () => {
  if(!confirm('Revenir au design FlightBrief par défaut pour les alertes ?')) return;
  alertsCfg().style = defaultAlertStyle('flightbrief');
  loadAlertsDesignForm(); _pushAlerts();
};
FBv15.copyAlertsLink = async () => {
  await window.api.copyToClipboard(alertsUrl);
  const m = $('alertsLinkStatus'); m.className = 'status-msg ok'; m.textContent = 'Lien copié ✓ — OBS → Source → Navigateur → URL, 1920 × 1080.';
};
FBv15.openAlertsPreview = () => window.api.openExternal(alertsUrl);
FBv15.testAlert = (kind) => {
  if(kind === 'landing'){
    const a = { fpm: -142, gForce: 1.18, bounces: 0, score: 94, letter: 'A', color: '#39e88f', gradeLabel: 'Doux', gradeColor: '#54d6e8', windDir: 250, windKt: 12, crosswindKt: 6, headwindKt: 10, icao: 'LFBO', airport: 'Toulouse-Blagnac',
      zone: { runway: '32L/14R', lengthFt: 11483, distanceFromThresholdFt: 1240, percentAlongRunway: 11, lateralOffsetFt: 6, side: 'droite' }, callsign: 'AFR23F' };
    window.alerts.push({ type: 'landing', title: 'Atterrissage (test)', data: a });
    showLandingToast(a);
  } else if(kind === 'achievement'){
    const a = ACHIEVEMENTS.find(x => x.id === 'butter');
    window.alerts.push({ type: 'achievement', title: a.title, text: a.desc, icon: a.icon });
    fx(`<div class="ach-toast"><div class="ach-burst">${a.icon}</div><div><div class="lc-eyebrow">Succès débloqué (test)</div><div class="ach-title">${esc(a.title)}</div><div class="hint" style="margin:0;">${esc(a.desc)}</div></div></div>`, 'fx-ach', 6000);
  } else if(window.twitch) window.twitch.test(kind);
};

/* =========================================================
   ICÔNE AVION (v1.5) — silhouette d'avion de ligne vue de dessus
   ========================================================= */
function planeStyle(){ return (db.planeIcon && FBShared.PLANE_ICONS[db.planeIcon]) ? db.planeIcon : 'airliner'; }
function installPlaneIcon(){
  // Remplace l'icône Leaflet de la carte de suivi (la fonction globale d'app.js est redéfinie).
  window.planeDivIcon = function(color){
    return L.divIcon({ className: 'plane-marker v15', iconSize: [44, 44], iconAnchor: [22, 22],
      html: `<div class="plane-marker-rotor" style="--plane-color:${color}"><span class="plane-halo"></span>${FBShared.planeSvg(planeStyle())}</div>` });
  };
  if(typeof trackPlaneMarker !== 'undefined' && trackPlaneMarker){
    const ll = trackPlaneMarker.getLatLng();
    const rot = trackPlaneMarker.getElement() && trackPlaneMarker.getElement().querySelector('.plane-marker-rotor');
    const tf = rot ? rot.style.transform : '';
    trackPlaneMarker.setIcon(window.planeDivIcon('var(--accent-vfr)'));
    trackPlaneMarker.setLatLng(ll);
    const r2 = trackPlaneMarker.getElement() && trackPlaneMarker.getElement().querySelector('.plane-marker-rotor');
    if(r2 && tf) r2.style.transform = tf;
  }
}
function renderPlanePicker(){
  const box = $('planePicker');
  if(!box) return;
  const cur = planeStyle();
  box.innerHTML = Object.entries(FBShared.PLANE_ICONS).map(([k, v]) => `<button class="${k === cur ? 'on' : ''}" onclick="FBv15.setPlaneIcon('${k}')">${FBShared.planeSvg(k)}<span>${esc(v.label)}</span></button>`).join('');
}
FBv15.setPlaneIcon = function(k){
  db.planeIcon = k;
  saveDbNow();
  installPlaneIcon();
  renderPlanePicker();
};

/* =========================================================
   INIT + navigation
   ========================================================= */
FBv15.onViewChange = function(name){
  if(name === 'briefing') startAtcPolling(); else stopAtcPolling();
  if(name === 'profil') evaluateAchievements(false);
  if(name === 'admin'){ renderBackups(); renderPlanePicker(); if(window.shots) window.shots.stats().then(st => { if($('shotStats')) $('shotStats').textContent = `${st.count} capture${st.count > 1 ? 's' : ''} · ${st.sizeMb} Mo`; }); }
  if(name === 'twitch' && window.twitch) window.twitch.getState().then(s => { twState = s; renderTwitch(); });
};
FBv15.init = async function(){
  if(FBv15._started) return;
  FBv15._started = true;
  installPlaneIcon();
  initEta();
  initUpdater();
  try{ bindAlertsOverlay(); }catch(e){ console.warn('[v1.5] overlay alertes', e); }
  try{
    const port = window.alerts ? await window.alerts.getPort() : 4814;
    alertsUrl = `http://localhost:${port}/alerts`;
    if($('alertsLink')) $('alertsLink').value = alertsUrl;
  }catch(e){ /* ignoré */ }
  if(window.twitch){
    bindTwitch();
    window.twitch.onState(s => { twState = s; renderTwitch(); });
    window.twitch.onLoginResult(r => {
      $('twDeviceBox').classList.add('hidden');
      const m = $('twLoginMsg');
      m.className = 'status-msg ' + (r.ok ? 'ok' : 'err');
      m.textContent = r.ok ? `Compte ${r.login} connecté ✓` : `Connexion annulée ou refusée (${r.error}).`;
    });
    twState = await window.twitch.setConfig(twCfg());
    renderTwitch();
  }
  const atcSearch = $('atcSearch');
  if(atcSearch){
    atcSearch.addEventListener('input', debounce(renderAtcAll, 150));
    $('atcAllDetails').addEventListener('toggle', renderAtcAll);
    ['depIcao','arrIcao'].forEach(id => el(id).addEventListener('change', renderAtc));
  }
  try{ initMapUx(); }catch(e){ console.warn('[v1.5] carte', e); }
  try{ initLiveOverlayLayout(); }catch(e){ console.warn('[v1.6] outil live', e); }
  try{ if(window.shots){ bindShotsSettings(); pushShotsCfg(); window.shots.onTaken(onShotTaken); } }catch(e){ console.warn('[v1.6] captures', e); }
  try{ if(window.watch) bindWatchSettings(); }catch(e){ console.warn('[v1.6] rappel tracker', e); }
  renderAtcMapChips();
  if(el('view-briefing').classList.contains('active')) startAtcPolling();
  checkRecovery();
  evaluateAchievements(false);
};
// Si app.js a déjà terminé son initialisation (ordre de chargement inattendu), on démarre ici.
if(window.__fbAppReady) FBv15.init();
})();
