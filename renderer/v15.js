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
function alertsCfg(){
  db.alertsOverlay = Object.assign({ durationSec: 9, position: 'top-right', scale: 100, types: { landing: true, bet: true, achievement: true, chat: true } }, db.alertsOverlay || {});
  db.alertsOverlay.types = Object.assign({ landing: true, bet: true, achievement: true, chat: true }, db.alertsOverlay.types || {});
  return db.alertsOverlay;
}
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
   3. SUCCÈS
   ========================================================= */
const WORLD_NM = 21600;
function achievementStats(){
  const lb = db.logbook || [];
  const lookup = cachedAirportLookup;
  const s = { flights: lb.length, minutes: 0, nm: 0, airports: new Set(), continents: new Set(), butter: 0, perfect: 0, longest: 0, night: 0, ifr: 0, vfr: 0, crosswind15: 0, cleanStreak: 0, bestCleanStreak: 0 };
  const sorted = [...lb].sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  sorted.forEach(f => {
    s.minutes += f.durationMin || 0;
    s.longest = Math.max(s.longest, f.durationMin || 0);
    if(f.rules === 'IFR') s.ifr++; else if(f.rules === 'VFR') s.vfr++;
    const d = FBShared.flightDistance(f, lookup); if(d.nm != null) s.nm += d.nm;
    [f.dep, f.arr].forEach(icao => {
      const k = FBShared.up(icao); if(!k) return;
      s.airports.add(k);
      const ap = lookup(k);
      const c = FBShared.continentOf(k, ap ? ap.lon : null); if(c) s.continents.add(c);
    });
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
    if(td && td.crosswindKt != null && Math.abs(td.crosswindKt) >= 15) s.crosswind15++;
    if(f.trackData && lr != null){
      if(!f.trackData.bounceCount){ s.cleanStreak++; s.bestCleanStreak = Math.max(s.bestCleanStreak, s.cleanStreak); }
      else s.cleanStreak = 0;
    }
  });
  s.hours = s.minutes / 60;
  s.toursDone = (db.careers || []).reduce((n, c) => n + (c.tours || []).filter(t => FBShared.tourIsComplete(t)).length, 0);
  s.fleet = (db.hangar || []).length;
  return s;
}
const ACHIEVEMENTS = [
  { id:'first-flight', icon:'🛫', title:'Premier vol', desc:'Enregistrer un premier vol.', target:1, val:s => s.flights },
  { id:'flights-10', icon:'🧭', title:'Habitué', desc:'10 vols au logbook.', target:10, val:s => s.flights },
  { id:'flights-50', icon:'🎖️', title:'Pilote de ligne', desc:'50 vols au logbook.', target:50, val:s => s.flights },
  { id:'flights-100', icon:'💯', title:'Centurion', desc:'100 vols au logbook.', target:100, val:s => s.flights },
  { id:'flights-250', icon:'👑', title:'Commandant de bord', desc:'250 vols au logbook.', target:250, val:s => s.flights },
  { id:'hours-10', icon:'⏱️', title:'10 heures', desc:'10 h de vol cumulées.', target:10, val:s => s.hours },
  { id:'hours-100', icon:'⌛', title:'100 heures', desc:'100 h de vol cumulées.', target:100, val:s => s.hours },
  { id:'hours-500', icon:'🕰️', title:'500 heures', desc:'500 h de vol cumulées.', target:500, val:s => s.hours },
  { id:'long-haul', icon:'🌏', title:'Long-courrier', desc:'Un vol de plus de 8 heures.', target:480, val:s => s.longest, fmt:v => FBShared.fmtHm(v) },
  { id:'nm-10k', icon:'📏', title:'10 000 NM', desc:'10 000 milles nautiques parcourus.', target:10000, val:s => s.nm, fmt:v => Math.round(v).toLocaleString('fr-FR') },
  { id:'world-tour', icon:'🌍', title:'Tour du monde', desc:"L'équivalent d'un tour de la Terre (21 600 NM).", target:WORLD_NM, val:s => s.nm, fmt:v => Math.round(v).toLocaleString('fr-FR') },
  { id:'butter', icon:'🧈', title:'Beurre', desc:'Un atterrissage à moins de 100 ft/min.', target:1, val:s => s.butter },
  { id:'butter-10', icon:'🥐', title:'Boulanger', desc:'10 atterrissages à moins de 100 ft/min.', target:10, val:s => s.butter },
  { id:'perfect', icon:'💎', title:'Copie parfaite', desc:"Une note d'atterrissage A+.", target:1, val:s => s.perfect },
  { id:'clean-10', icon:'🎯', title:'Sans rebond', desc:'10 atterrissages trackés d\'affilée sans rebond.', target:10, val:s => s.bestCleanStreak },
  { id:'crosswind', icon:'🌬️', title:'Vent de travers', desc:'Se poser avec au moins 15 kt de vent traversier.', target:1, val:s => s.crosswind15 },
  { id:'night-1', icon:'🌙', title:'Première nuit', desc:'Un atterrissage de nuit.', target:1, val:s => s.night },
  { id:'night-10', icon:'🦉', title:'Oiseau de nuit', desc:'10 atterrissages de nuit.', target:10, val:s => s.night },
  { id:'continents-3', icon:'🗺️', title:'Intercontinental', desc:'Poser les roues sur 3 continents.', target:3, val:s => s.continents.size },
  { id:'continents-all', icon:'🌐', title:'Globe-trotter', desc:'Les 6 continents habités.', target:6, val:s => s.continents.size },
  { id:'airports-25', icon:'📍', title:'Collectionneur', desc:'25 aéroports différents.', target:25, val:s => s.airports.size },
  { id:'airports-100', icon:'🧳', title:'Explorateur', desc:'100 aéroports différents.', target:100, val:s => s.airports.size },
  { id:'ifr-25', icon:'📡', title:'Aux instruments', desc:'25 vols IFR.', target:25, val:s => s.ifr },
  { id:'vfr-25', icon:'👀', title:'Vue du ciel', desc:'25 vols VFR.', target:25, val:s => s.vfr },
  { id:'tour-1', icon:'🏁', title:'Tour bouclé', desc:'Terminer un tour de carrière.', target:1, val:s => s.toursDone },
  { id:'fleet-5', icon:'🛩️', title:'Hangar garni', desc:'5 avions dans le hangar.', target:5, val:s => s.fleet }
];
function achState(){
  db.achievements = Object.assign({ unlocked: {}, initialized: false }, db.achievements || {});
  db.achievements.unlocked = db.achievements.unlocked || {};
  return db.achievements;
}
async function evaluateAchievements(silent){
  // Distances estimées et continents (Russie Europe/Asie) : coordonnées chargées d'abord.
  const icaos = new Set();
  (db.logbook || []).forEach(f => { [f.dep, f.arr].forEach(i => { const k = FBShared.up(i); if(k) icaos.add(k); }); });
  if(icaos.size) { try { await resolveAirportCoords([...icaos]); } catch(e){ /* ignoré */ } }
  const st = achState(), s = achievementStats(), fresh = [];
  ACHIEVEMENTS.forEach(a => {
    if(st.unlocked[a.id]) return;
    if(a.val(s) >= a.target){ st.unlocked[a.id] = new Date().toISOString(); fresh.push(a); }
  });
  if(!st.initialized){ st.initialized = true; silent = true; }
  if(fresh.length || silent) saveDbNow();
  if(!silent) fresh.forEach((a, i) => setTimeout(() => celebrate(a), 900 + i * 2200));
  renderAchievements(s);
  return fresh;
}
function celebrate(a){
  fx(`<div class="ach-toast"><div class="ach-burst">${a.icon}</div><div><div class="lc-eyebrow">Succès débloqué</div><div class="ach-title">${esc(a.title)}</div><div class="hint" style="margin:0;">${esc(a.desc)}</div></div></div>`, 'fx-ach', 7000);
  if(window.alerts && alertsCfg().types.achievement) window.alerts.push({ type: 'achievement', title: a.title, text: a.desc, icon: a.icon });
}
function renderAchievements(s){
  const grid = $('achGrid');
  if(!grid) return;
  s = s || achievementStats();
  const st = achState();
  const done = ACHIEVEMENTS.filter(a => st.unlocked[a.id]).length;
  $('achCount').textContent = `${done} / ${ACHIEVEMENTS.length}`;
  grid.innerHTML = ACHIEVEMENTS.map(a => {
    const unlocked = st.unlocked[a.id];
    const v = Math.min(a.val(s), a.target);
    const pct = Math.round(100 * v / a.target);
    const f = a.fmt || (x => Math.floor(x).toLocaleString('fr-FR'));
    return `<div class="ach ${unlocked ? 'on' : ''}" title="${esc(a.desc)}">
      <div class="ach-icon">${a.icon}</div>
      <div class="ach-body">
        <div class="ach-name">${esc(a.title)}</div>
        <div class="ach-desc">${esc(a.desc)}</div>
        ${unlocked ? `<div class="ach-date">Débloqué le ${new Date(unlocked).toLocaleDateString('fr-FR')}</div>`
          : `<div class="ach-prog"><i style="width:${pct}%"></i></div><div class="ach-date">${f(v)} / ${f(a.target)}</div>`}
      </div>
    </div>`;
  }).join('');
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
    if(typing || e.ctrlKey || e.metaKey || e.altKey || !el('view-briefing').classList.contains('active')) return;
    if(document.querySelector('.modal-overlay:not(.hidden)')) return;
    const k = e.key.toLowerCase();
    if(k === 'f') toggleTrackFollow();
    else if(k === 'v') FBv15.mapFitRoute();
    else if(k === 'p') FBv15.mapFullscreen();
  }, true);
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
  $('twClientId').value = c.clientId || '';
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
  on('twClientId', 'change', e => { twCfg().clientId = e.target.value.trim(); pushTwitchCfg(); });
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
  $('twAccountBox').innerHTML = a.loggedIn
    ? `<div class="tw-acc-row"><span class="tw-avatar">${esc((a.login || '?')[0].toUpperCase())}</span><div><b>${esc(a.login)}</b><div class="hint" style="margin:0;">Le bot répond dans le chat avec ce compte${c.prefixMessages ? `, sous la forme « [${esc(c.botName)}] … »` : ''}.</div></div><button class="btn small" onclick="FBv15.twitchLogout()">Déconnecter</button></div>`
    : `<div class="tw-acc-row"><span class="tw-avatar off">?</span><div><b>Lecture seule</b><div class="hint" style="margin:0;">Aucun compte connecté.</div></div><button class="btn small primary" onclick="FBv15.twitchLogin()" ${a.hasClientId || c.clientId ? '' : 'disabled title="Client ID Twitch manquant (Réglages avancés)"'}>Connecter un compte</button></div>`;

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
  const push = () => { queueSaveDb(); window.alerts && window.alerts.setConfig(alertsCfg()); };
  $('alPosition').addEventListener('change', e => { alertsCfg().position = e.target.value; push(); });
  $('alDuration').addEventListener('input', e => { alertsCfg().durationSec = +e.target.value; $('alDurationVal').textContent = e.target.value + ' s'; updateRangeFill(e.target); push(); });
  $('alScale').addEventListener('input', e => { alertsCfg().scale = +e.target.value; $('alScaleVal').textContent = e.target.value + '%'; updateRangeFill(e.target); push(); });
  [['alTypeLanding','landing'],['alTypeBet','bet'],['alTypeAchievement','achievement'],['alTypeChat','chat']].forEach(([id, k]) => $(id).addEventListener('change', e => { alertsCfg().types[k] = e.target.checked; push(); }));
  push();
}
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
  if(name === 'profil') renderAchievements();
  if(name === 'admin'){ renderBackups(); renderPlanePicker(); }
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
  renderAtcMapChips();
  if(el('view-briefing').classList.contains('active')) startAtcPolling();
  checkRecovery();
  evaluateAchievements(false);
};
// Si app.js a déjà terminé son initialisation (ordre de chargement inattendu), on démarre ici.
if(window.__fbAppReady) FBv15.init();
})();
