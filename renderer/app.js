/* =========================================================
   UTILITAIRES PERF — cache DOM + debounce/throttle
   ========================================================= */
// Filet de sécurité : une erreur JS non interceptée dans la fenêtre (ex. pendant le
// chargement ou la fermeture) ne doit plus rester invisible dans les DevTools — elle
// est aussi journalisée côté disque via le process principal (voir main.js), ce qui
// permet de diagnostiquer une prochaine erreur au lieu de deviner.
window.addEventListener('error', (e) => {
  console.error('[FlightBrief] Erreur non interceptée :', e.error || e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[FlightBrief] Promesse rejetée non interceptée :', e.reason);
});

const _elCache = new Map();
function el(id){
  let node = _elCache.get(id);
  if(node && document.body.contains(node)) return node;
  node = document.getElementById(id);
  _elCache.set(id, node);
  return node;
}
function debounce(fn, wait){
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}
function throttle(fn, wait){
  let last = 0, pending = null;
  return (...args) => {
    const now = Date.now();
    if(now - last >= wait){
      last = now;
      fn(...args);
    } else {
      clearTimeout(pending);
      pending = setTimeout(() => { last = Date.now(); fn(...args); }, wait - (now - last));
    }
  };
}
// Met à jour le dégradé de remplissage (--range-fill) d'un <input type=range> custom.
function updateRangeFill(input){
  const min = parseFloat(input.min) || 0, max = parseFloat(input.max) || 100;
  const pct = ((parseFloat(input.value) - min) / (max - min || 1)) * 100;
  input.style.setProperty('--range-fill', pct + '%');
}

/* =========================================================
   STORAGE (fichier local sur le disque, via le processus principal)
   ========================================================= */
const defaultTheme = {
  bg:'#0a0d11', panel:'#12171c', text:'#e7edf2', textSec:'#7c8894',
  vfr:'#ffb020', ifr:'#54d6e8',
  fontDisplay:"'Space Grotesk',sans-serif", fontMono:"'IBM Plex Mono',monospace", fontBody:"'Inter',sans-serif",
  radius:10, glow:true,
  cardWidth:820, cardHeight:0, fontScale:100,
  showAircraft:true, showAltitude:true, showDuration:true,
  showWeather:true, showApproach:true, showNotes:true,
  cardBorder:true, cardShadow:true, cardTransparentBg:false,
  tileColumns:3, headerAlign:'left', brandText:''
};

// Configuration par défaut de l'overlay Twitch personnalisable (onglet Outil Live) :
// tous les champs visibles, style calé sur le thème sombre par défaut de l'appli.
const LIVE_OVERLAY_FIELD_ORDER = ['callsign','route','phase','altitude','heading','radio','distance','progress'];
const LIVE_OVERLAY_DEFAULT_LABELS = { callsign:'Indicatif', route:'Trajet', phase:'Phase', altitude:'Altitude', heading:'Cap', radio:'Fréquence radio', distance:'Distance', progress:'Progression' };
const LIVE_OVERLAY_ICONS = { callsign:'✈', route:'→', phase:'◎', altitude:'▲', heading:'◈', radio:'▮', distance:'↦', progress:'%' };
const defaultLiveOverlay = {
  fields: { callsign:true, route:true, progress:true, distance:true, radio:true, heading:true, altitude:true, phase:true },
  labels: {...LIVE_OVERLAY_DEFAULT_LABELS},
  // Jusqu'à 2 textes libres, entièrement facultatifs : si le champ est vide, rien ne
  // s'affiche dans l'overlay (contrairement aux champs de télémétrie qui affichent "—").
  custom: { text1:'', text2:'' },
  style: {
    bg:'#0a0d11', text:'#e7edf2', accent:'#39e88f', bgOpacity:78, font:"'Space Grotesk',sans-serif", scale:100, radius:12, layout:'bar',
    border:true, borderColor:'#ffffff', shadow:true, blur:true, gap:1, icons:false, uppercase:false, divider:true
  }
};

// Profil utilisateur, récupéré au premier lancement (onboarding) et modifiable
// ensuite depuis l'onglet Profil. `onboarded`/`tourDone` pilotent respectivement
// l'affichage automatique de la modale d'accueil et de la visite guidée.
const defaultUserProfile = {
  firstName:'', network:'', vatsimId:'', ivaoId:'', twitchHandle:'', homeBase:'',
  onboarded:false, tourDone:false
};

let db = { logbook: [], careers: [], theme: {...defaultTheme}, simbriefUsername: '', liveOverlay: {...defaultLiveOverlay, fields:{...defaultLiveOverlay.fields}, labels:{...defaultLiveOverlay.labels}, custom:{...defaultLiveOverlay.custom}, style:{...defaultLiveOverlay.style}}, userProfile: {...defaultUserProfile} };

async function loadDb(){
  try{
    const stored = await window.api.loadDb();
    if(stored){
      db.logbook = stored.logbook || [];
      db.careers = stored.careers || [];
      db.theme = {...defaultTheme, ...(stored.theme || {})};
      db.simbriefUsername = stored.simbriefUsername || '';
      const storedLo = stored.liveOverlay || {};
      db.liveOverlay = {
        fields: {...defaultLiveOverlay.fields, ...(storedLo.fields || {})},
        labels: {...defaultLiveOverlay.labels, ...(storedLo.labels || {})},
        custom: {...defaultLiveOverlay.custom, ...(storedLo.custom || {})},
        style: {...defaultLiveOverlay.style, ...(storedLo.style || {})}
      };
      db.userProfile = {...defaultUserProfile, ...(stored.userProfile || {})};
    }
  }catch(e){
    console.warn('FlightBrief: lecture du fichier local impossible, valeurs par défaut utilisées.', e);
  }
}
// Écriture disque décalée (debounce) : évite une écriture synchrone à chaque
// pixel de glissement d'un slider ou d'un color-picker, principale source de
// ralentissement perçu dans l'onglet Admin.
const queueSaveDb = debounce(async () => {
  try{ await window.api.saveDb(db); }
  catch(e){ console.warn('FlightBrief: sauvegarde locale impossible.', e); }
}, 350);
async function saveDbNow(){
  try{ await window.api.saveDb(db); }
  catch(e){ console.warn('FlightBrief: sauvegarde locale impossible.', e); }
}

/* =========================================================
   TITLEBAR CUSTOM
   ========================================================= */
async function initTitlebar(){
  if(!window.winCtl) return;
  const platform = await window.winCtl.platform();
  if(platform === 'darwin') document.body.classList.add('platform-darwin');

  el('tbMin').addEventListener('click', () => window.winCtl.minimize());
  el('tbClose').addEventListener('click', () => window.winCtl.close());
  el('tbMax').addEventListener('click', async () => {
    const maximized = await window.winCtl.maximizeToggle();
    setMaxIcon(maximized);
  });
  window.winCtl.onMaximizedChange(v => setMaxIcon(v));
  const initiallyMax = await window.winCtl.isMaximized();
  setMaxIcon(initiallyMax);
}
function setMaxIcon(isMax){
  el('tbMaxIconRestore').classList.toggle('hidden', !isMax);
  el('tbMaxIconExpand').classList.toggle('hidden', isMax);
}

/* =========================================================
   TABS
   ========================================================= */
document.getElementById('tabs').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-view]');
  if(!btn) return;
  switchView(btn.dataset.view);
});
function switchView(name){
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  if(name === 'career') renderCareers();
  if(name === 'logbook') { populateCareerSelect(); renderLogbook(); }
  if(name === 'profil') {
    fillUserProfileForm('pf', db.userProfile);
    renderProfileStats();
    initFlightsGlobe();
    populateFlightsGlobeNetworkFilter();
    setTimeout(resizeFlightsGlobe, 60);
    renderFlightsGlobeArcs();
    resumeFlightsGlobe();
  } else {
    // Le globe 3D ne sert que sur cet onglet : on coupe sa boucle de rendu dès qu'on le
    // quitte plutôt que de la laisser tourner en arrière-plan pour rien (voir animateFlightsGlobe).
    pauseFlightsGlobe();
  }
  // La carte de suivi vit désormais dans la page Briefing (plus de page Tracking dédiée) :
  // on force juste un recalcul de sa taille à chaque fois qu'on revient sur cet onglet,
  // Leaflet ayant besoin de ça quand son conteneur était caché (display:none).
  if(name === 'briefing') setTimeout(() => trackMap && trackMap.invalidateSize(), 60);
}

/* =========================================================
   BRIEFING
   ========================================================= */
const state = { rules:'VFR' };
const ids = ['callsign','depIcao','arrIcao','depName','arrName','routeText','aircraft','altitude','duration','approach','weather','notes'];

function attachLiveInputs(){ ids.forEach(id => el(id).addEventListener('input', render)); }

function setFlightRules(rules){
  state.rules = rules;
  const btns = document.querySelectorAll('#vfrIfrToggle button');
  btns.forEach(b => b.classList.remove('active-vfr','active-ifr'));
  if(rules === 'VFR'){
    btns[0].classList.add('active-vfr');
    document.documentElement.style.setProperty('--mode-color','var(--accent-vfr)');
    document.documentElement.style.setProperty('--mode-dim','var(--accent-vfr-dim)');
    el('approachLabel').textContent = 'Repères visuels';
    el('approach').placeholder = 'ex : suivre la N7, seuil piste 27';
    el('outApproachCap').textContent = 'Repères';
  } else {
    btns[1].classList.add('active-ifr');
    document.documentElement.style.setProperty('--mode-color','var(--accent-ifr)');
    document.documentElement.style.setProperty('--mode-dim','var(--accent-ifr-dim)');
    el('approachLabel').textContent = "Type d'approche";
    el('approach').placeholder = 'ex : ILS RWY 32L';
    el('outApproachCap').textContent = 'Approche';
  }
  render();
}

function render(){
  const rules = state.rules;
  el('outCallsign').textContent = el('callsign').value || '—';
  const outRules = el('outRules');
  outRules.textContent = rules;
  outRules.className = 'badge ' + rules.toLowerCase();
  el('outDep').textContent = (el('depIcao').value || '----').toUpperCase();
  el('outArr').textContent = (el('arrIcao').value || '----').toUpperCase();
  el('outDepName').textContent = el('depName').value || 'Aéroport de départ';
  el('outArrName').textContent = el('arrName').value || "Aéroport d'arrivée";
  el('outAircraft').textContent = el('aircraft').value || '—';
  el('outAltitude').textContent = el('altitude').value || '—';
  el('outDuration').textContent = el('duration').value || '—';
  el('outApproach').textContent = el('approach').value || '—';
  el('outWeather').textContent = el('weather').value || '—';
  el('outNotes').textContent = el('notes').value || 'Aucune note particulière.';
  renderRoute();
  pushLiveStateThrottled();
}

let _planeIconEl = null;
function renderRoute(){
  const routeRaw = el('routeText').value.trim();
  const svg = el('routeSvg');
  if(!_planeIconEl){
    _planeIconEl = document.createElementNS('http://www.w3.org/2000/svg','path');
    _planeIconEl.setAttribute('class','plane-icon');
    _planeIconEl.setAttribute('d','M48,11 L52,15 L48,19 L49,16 L44,16 L44,14 L49,14 Z');
    svg.appendChild(_planeIconEl);
  }
  el('outRouteCaption').textContent = routeRaw || 'Route à définir';
}

/* ---------------- Live state pushed to the local OBS server ---------------- */
function pushLiveState(){
  if(!window.api || !window.api.pushLiveUpdate) return;
  window.api.pushLiveUpdate({
    rules: state.rules,
    callsign: el('callsign').value,
    dep: el('depIcao').value, arr: el('arrIcao').value,
    depName: el('depName').value, arrName: el('arrName').value,
    route: el('routeText').value,
    aircraft: el('aircraft').value, altitude: el('altitude').value, duration: el('duration').value,
    approach: el('approach').value, weather: el('weather').value, notes: el('notes').value,
    theme: db.theme
  });
}
// Throttlé : la source OBS se met à jour ~10x/seconde max, largement suffisant
// visuellement, et évite de saturer l'IPC pendant une frappe rapide.
const pushLiveStateThrottled = throttle(pushLiveState, 100);

/* ---------------- SimBrief import ---------------- */
async function importFromSimbrief(){
  const username = el('sbUsername').value.trim();
  const statusEl = el('sbStatus');
  statusEl.className = 'status-msg';
  if(!username){ statusEl.textContent = 'Indique ton pseudo SimBrief.'; statusEl.classList.add('err'); return; }
  db.simbriefUsername = username;
  await saveDbNow();
  statusEl.textContent = 'Récupération du plan de vol…';
  try{
    const url = `https://www.simbrief.com/api/xml.fetcher.php?username=${encodeURIComponent(username)}&json=1`;
    const res = await fetch(url);
    if(!res.ok) throw new Error('Aucun plan de vol trouvé pour ce pseudo (ou compte SimBrief invalide).');
    const data = await res.json();
    applySimbriefData(data);
    statusEl.textContent = 'Plan de vol importé ✓ — vérifie et ajuste les champs si besoin.';
    statusEl.classList.add('ok');
    switchView('briefing');
  }catch(err){
    statusEl.textContent = "Échec de l'import (" + err.message + "). Renseigne les champs manuellement, ou réessaie.";
    statusEl.classList.add('err');
  }
}
function pick(...vals){ for(const v of vals){ if(v !== undefined && v !== null && String(v).trim() !== '') return v; } return ''; }
function applySimbriefData(data){
  const origin = data.origin || {}, destination = data.destination || {}, aircraft = data.aircraft || {};
  const general = data.general || {}, times = data.times || {}, atc = data.atc || {}, weather = data.weather || {};
  el('depIcao').value = pick(origin.icao_code, origin.icao);
  el('arrIcao').value = pick(destination.icao_code, destination.icao);
  el('depName').value = pick(origin.name);
  el('arrName').value = pick(destination.name);
  el('routeText').value = pick(general.route);
  el('aircraft').value = pick(aircraft.name, aircraft.icaocode, aircraft.icao_code);
  const alt = pick(general.initial_altitude);
  el('altitude').value = alt ? (isNaN(alt) ? alt : 'FL' + Math.round(alt/100)) : '';
  const ete = pick(times.est_time_enroute);
  if(ete && !isNaN(ete)){
    const secs = parseInt(ete, 10);
    el('duration').value = `${Math.floor(secs/3600)}h${String(Math.round((secs%3600)/60)).padStart(2,'0')}`;
  }
  const callsign = pick(atc.callsign, (general.icao_airline || '') + (general.flight_number || ''));
  if(callsign) el('callsign').value = callsign;
  const origMetar = pick(weather.orig_metar, origin.metar);
  const destMetar = pick(weather.dest_metar, destination.metar);
  const metarCombined = [origMetar && `Départ: ${origMetar}`, destMetar && `Arrivée: ${destMetar}`].filter(Boolean).join('\n');
  if(metarCombined) el('weather').value = metarCombined;
  render();
}

/* =========================================================
   OBS LINK
   ========================================================= */
let obsUrl = '';
async function initObsLink(){
  const port = await window.api.getObsPort();
  obsUrl = `http://localhost:${port}/obs`;
  el('obsLink').value = obsUrl;
}
// Si le serveur local de la source OBS n'a pas pu démarrer (ex. port déjà utilisé
// par une autre instance de l'appli), on le signale ici plutôt que de laisser
// planter l'appli au démarrage sans explication.
function initObsServerErrorListener(){
  if(!window.api || !window.api.onObsServerError) return;
  window.api.onObsServerError(msg => {
    const statusEl = el('obsLinkStatus');
    statusEl.textContent = msg;
    statusEl.className = 'status-msg err';
  });
}
async function copyObsLink(){
  const statusEl = el('obsLinkStatus');
  statusEl.className = 'status-msg';
  try{
    await window.api.copyToClipboard(obsUrl);
    statusEl.textContent = 'Lien copié ✓';
    statusEl.classList.add('ok');
  }catch(e){
    statusEl.textContent = "Copie impossible — sélectionne le champ et copie-le avec Ctrl+C / Cmd+C.";
    statusEl.classList.add('err');
  }
}
function openObsPreview(){ window.api.openExternal(obsUrl); }

/* =========================================================
   OVERLAY LIVE PERSONNALISABLE (onglet Outil Live)
   ========================================================= */
let liveOverlayUrl = '';
async function initLiveOverlayLink(){
  const port = window.api.getLiveOverlayPort ? await window.api.getLiveOverlayPort() : await window.api.getObsPort();
  liveOverlayUrl = `http://localhost:${port}/live`;
  el('liveOverlayLink').value = liveOverlayUrl;
}
function initLiveOverlayServerErrorListener(){
  if(!window.api || !window.api.onLiveOverlayServerError) return;
  window.api.onLiveOverlayServerError(msg => {
    const statusEl = el('liveOverlayLinkStatus');
    statusEl.textContent = msg;
    statusEl.className = 'status-msg err';
  });
}
async function copyLiveOverlayLink(){
  const statusEl = el('liveOverlayLinkStatus');
  statusEl.className = 'status-msg';
  try{
    await window.api.copyToClipboard(liveOverlayUrl);
    statusEl.textContent = 'Lien copié ✓';
    statusEl.classList.add('ok');
  }catch(e){
    statusEl.textContent = "Copie impossible — sélectionne le champ et copie-le avec Ctrl+C / Cmd+C.";
    statusEl.classList.add('err');
  }
}
function openLiveOverlayPreview(){ window.api.openExternal(liveOverlayUrl); }

// Petit dictionnaire de libellés pour le champ "Phase de vol" — partagé visuellement
// avec PHASE_META (mêmes libellés que le reste de l'appli), avec les intitulés
// génériques idle/ground/airborne/landed en secours tant qu'aucun trajet n'a encore
// été segmenté (voir computeLivePhases côté tracker.js).
const LIVE_OVERLAY_PHASE_FALLBACK = { idle:'—', ground:'Au sol', airborne:'En vol', landed:'Atterri' };

function haversineNmRenderer(lat1, lon1, lat2, lon2){
  const R = 3440.065;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Distance totale départ -> arrivée (grand cercle), calculée à partir des champs OACI
// du Briefing, pour donner un pourcentage de progression sur l'overlay. Recalculée
// (debounce) à chaque changement des champs départ/arrivée, mise en cache ensuite.
// On garde aussi les coordonnées d'arrivée : la progression est calculée à partir de la
// distance RESTANTE jusqu'à l'arrivée (position courante -> arrivée) plutôt que de la
// distance déjà parcourue -> total en ligne droite, qui dépasse presque toujours 100 %
// avant le toucher des roues (montée/descente/route non directe = trajet plus long que
// le grand cercle dép -> arr).
let _overlayTotalRouteNm = null;
let _overlayArrCoord = null;
const updateOverlayRouteDistance = debounce(async () => {
  _overlayTotalRouteNm = null;
  _overlayArrCoord = null;
  if(!window.api || !window.api.lookupAirport) return;
  const depIcao = el('depIcao').value.trim();
  const arrIcao = el('arrIcao').value.trim();
  if(!depIcao || !arrIcao) return;
  try{
    const [dep, arr] = await Promise.all([window.api.lookupAirport(depIcao), window.api.lookupAirport(arrIcao)]);
    if(dep && arr){
      _overlayTotalRouteNm = haversineNmRenderer(dep.lat, dep.lon, arr.lat, arr.lon);
      _overlayArrCoord = { lat: arr.lat, lon: arr.lon };
    }
  }catch(e){ /* ICAO inconnu ou lookup indisponible -> progression affichée en '—' */ }
}, 400);

// Dernière télémétrie connue pour l'overlay (fusion progressive des events telemetry
// [1/s, données instantanées] et progress [~5s, distance/phase issues du trajet]).
let _overlayTelemetry = { callsign:null, dep:null, arr:null, altFt:null, headingDeg:null, comFreqMhz:null, phase:null, distanceNm:null, progressPct:null };

function currentLiveOverlayConfig(){
  return { fields: {...db.liveOverlay.fields}, custom: {...db.liveOverlay.custom}, style: {...db.liveOverlay.style} };
}

// Rendu d'un texte libre personnalisé (aucun libellé/cap au-dessus, juste le texte du
// user) — n'est jamais rendu si le champ est vide, à la différence des champs de
// télémétrie qui affichent toujours un "—" par défaut.
function liveOverlayCustomHtml(text){
  return `<div class="lo-item lo-custom"><div class="lo-val">${escapeHtml(text)}</div></div>`;
}

// Rendu partagé aperçu-en-app / logique reproduite à l'identique dans live-overlay.html
// (fichier statique servi à OBS, qui ne peut pas importer ce script directement).
function liveOverlayFieldValue(key, t){
  if(key === 'callsign') return escapeHtml(t.callsign || '—');
  if(key === 'route') return `<span>${escapeHtml((t.dep||'----').toUpperCase())}</span><span class="lo-arrow">→</span><span>${escapeHtml((t.arr||'----').toUpperCase())}</span>`;
  if(key === 'phase'){
    let label = '—';
    if(t.phase){
      if(PHASE_META[t.phase]) label = PHASE_META[t.phase].label;
      else if(LIVE_OVERLAY_PHASE_FALLBACK[t.phase]) label = LIVE_OVERLAY_PHASE_FALLBACK[t.phase];
      else label = t.phase;
    }
    return escapeHtml(label);
  }
  if(key === 'altitude') return t.altFt != null ? Math.round(t.altFt).toLocaleString('fr-FR') + ' ft' : '—';
  if(key === 'heading') return t.headingDeg != null ? String(Math.round(t.headingDeg)).padStart(3,'0') + '°' : '—';
  if(key === 'radio') return t.comFreqMhz != null ? t.comFreqMhz.toFixed(3) : '—';
  if(key === 'distance') return t.distanceNm != null ? Math.round(t.distanceNm) + ' NM' : '—';
  if(key === 'progress') return t.progressPct != null ? Math.max(0, Math.min(100, t.progressPct)) + ' %' : '—';
  return '—';
}

// Rendu d'un champ de l'overlay live — partagé par l'aperçu in-app et repris à
// l'identique (mêmes classes) dans live-overlay.html.
function liveOverlayFieldHtml(key, t, cfg){
  const labels = cfg.labels || LIVE_OVERLAY_DEFAULT_LABELS;
  const label = (labels[key] || LIVE_OVERLAY_DEFAULT_LABELS[key] || key);
  const icon = cfg.style.icons ? `<span class="lo-icon">${LIVE_OVERLAY_ICONS[key] || ''}</span>` : '';
  const accentClass = key === 'phase' ? ' lo-accent' : '';
  const extraClass = key === 'route' ? ' lo-route' : (key === 'progress' ? ' lo-progress' : '');
  let valueBlock = `<div class="lo-val${accentClass}">${liveOverlayFieldValue(key, t)}</div>`;
  if(key === 'progress'){
    const pct = t.progressPct != null ? Math.max(0, Math.min(100, t.progressPct)) : 0;
    valueBlock += `<div class="lo-progress-track"><div class="lo-progress-fill" style="width:${pct}%"></div></div>`;
  }
  return `<div class="lo-item${extraClass}"><div class="lo-cap">${icon}${escapeHtml(label)}</div>${valueBlock}</div>`;
}

function applyLiveOverlayStyleVars(targetEl, cfg){
  const s = cfg.style;
  const bgHex = (s.bg || '#0a0d11').replace('#','');
  const r = parseInt(bgHex.length===3? bgHex[0]+bgHex[0] : bgHex.substring(0,2), 16) || 0;
  const g = parseInt(bgHex.length===3? bgHex[1]+bgHex[1] : bgHex.substring(2,4), 16) || 0;
  const b = parseInt(bgHex.length===3? bgHex[2]+bgHex[2] : bgHex.substring(4,6), 16) || 0;
  const a = Math.max(0, Math.min(100, s.bgOpacity != null ? s.bgOpacity : 78)) / 100;

  targetEl.style.setProperty('--lo-bg', `rgba(${r},${g},${b},${a.toFixed(2)})`);
  targetEl.style.setProperty('--lo-text', s.text || '#e7edf2');
  targetEl.style.setProperty('--lo-accent', s.accent || '#39e88f');
  targetEl.style.setProperty('--lo-font', s.font || defaultLiveOverlay.style.font);
  targetEl.style.setProperty('--lo-radius', (s.radius != null ? s.radius : 12) + 'px');
  targetEl.style.setProperty('--lo-scale', (s.scale || 100) / 100);
  targetEl.style.setProperty('--lo-gap', (s.gap != null ? s.gap : 1) + 'px');
  targetEl.style.setProperty('--lo-border-w', s.border === false ? '0px' : '1px');
  targetEl.style.setProperty('--lo-border-color', s.borderColor ? hexToRgbaJs(s.borderColor, 22) : 'rgba(255,255,255,.08)');
  targetEl.classList.toggle('lo-stack', s.layout === 'stack');
  targetEl.classList.toggle('lo-cards', s.layout === 'cards');
  targetEl.classList.toggle('lo-shadow', s.shadow !== false);
  targetEl.classList.toggle('lo-blur', s.blur !== false);
  targetEl.classList.toggle('lo-uppercase', !!s.uppercase);
  targetEl.classList.toggle('lo-divider', s.divider !== false);
}

function hexToRgbaJs(hex, opacityPct){
  const h = (hex || '#ffffff').replace('#','');
  const r = parseInt(h.length===3? h[0]+h[0] : h.substring(0,2), 16) || 0;
  const g = parseInt(h.length===3? h[1]+h[1] : h.substring(2,4), 16) || 0;
  const b = parseInt(h.length===3? h[2]+h[2] : h.substring(4,6), 16) || 0;
  const a = Math.max(0, Math.min(100, opacityPct != null ? opacityPct : 100)) / 100;
  return `rgba(${r},${g},${b},${a.toFixed(2)})`;
}

function renderLiveOverlayPreview(){
  const cfg = db.liveOverlay;
  const t = _overlayTelemetry;
  const bar = el('loPreviewBar');
  applyLiveOverlayStyleVars(bar, cfg);

  const visible = LIVE_OVERLAY_FIELD_ORDER.filter(k => cfg.fields[k]);
  const customTexts = [(cfg.custom && cfg.custom.text1), (cfg.custom && cfg.custom.text2)].filter(t2 => t2 && t2.trim());
  bar.innerHTML = visible.map(k => liveOverlayFieldHtml(k, t, cfg)).join('') + customTexts.map(t2 => liveOverlayCustomHtml(t2.trim())).join('');
  el('loPreviewBar').classList.toggle('lo-empty', visible.length === 0 && customTexts.length === 0);
}

function pushLiveOverlayConfig(){
  if(!window.api || !window.api.pushLiveOverlayUpdate) return;
  window.api.pushLiveOverlayUpdate({ config: currentLiveOverlayConfig() });
}
function pushLiveOverlayTelemetry(){
  if(!window.api || !window.api.pushLiveOverlayUpdate) return;
  window.api.pushLiveOverlayUpdate({ telemetry: {..._overlayTelemetry} });
}

function setLiveOverlayLayout(layout){
  db.liveOverlay.style.layout = layout;
  el('loLayoutToggle').dataset.layout = layout;
  const order = ['bar','stack','cards'];
  document.querySelectorAll('#loLayoutToggle button').forEach((b,i) => {
    b.classList.remove('active-vfr','active-ifr');
    if(order[i] === layout) b.classList.add('active-vfr');
  });
  renderLiveOverlayPreview();
  pushLiveOverlayConfig();
  queueSaveDb();
}

function loadLiveOverlayIntoForm(cfg){
  el('loFieldCallsign').checked = !!cfg.fields.callsign;
  el('loFieldRoute').checked = !!cfg.fields.route;
  el('loFieldProgress').checked = !!cfg.fields.progress;
  el('loFieldDistance').checked = !!cfg.fields.distance;
  el('loFieldRadio').checked = !!cfg.fields.radio;
  el('loFieldHeading').checked = !!cfg.fields.heading;
  el('loFieldAltitude').checked = !!cfg.fields.altitude;
  el('loFieldPhase').checked = !!cfg.fields.phase;

  LIVE_OVERLAY_FIELD_ORDER.forEach(key => {
    const input = document.getElementById('loLabel_' + key);
    if(input) input.value = (cfg.labels && cfg.labels[key]) || LIVE_OVERLAY_DEFAULT_LABELS[key];
  });

  el('loCustom1').value = (cfg.custom && cfg.custom.text1) || '';
  el('loCustom2').value = (cfg.custom && cfg.custom.text2) || '';

  el('loBg').value = cfg.style.bg;
  el('loText').value = cfg.style.text;
  el('loAccent').value = cfg.style.accent;
  el('loBorderColor').value = cfg.style.borderColor || '#ffffff';
  el('loBgOpacity').value = cfg.style.bgOpacity;
  el('loBgOpacityVal').textContent = cfg.style.bgOpacity + '%';
  updateRangeFill(el('loBgOpacity'));
  el('loFont').value = cfg.style.font;
  el('loScale').value = cfg.style.scale;
  el('loScaleVal').textContent = cfg.style.scale + '%';
  updateRangeFill(el('loScale'));
  el('loRadius').value = cfg.style.radius;
  el('loRadiusVal').textContent = cfg.style.radius + 'px';
  updateRangeFill(el('loRadius'));
  el('loGap').value = cfg.style.gap != null ? cfg.style.gap : 1;
  el('loGapVal').textContent = (cfg.style.gap != null ? cfg.style.gap : 1) + 'px';
  updateRangeFill(el('loGap'));
  el('loBorder').checked = cfg.style.border !== false;
  el('loShadow').checked = cfg.style.shadow !== false;
  el('loBlur').checked = cfg.style.blur !== false;
  el('loIcons').checked = !!cfg.style.icons;
  el('loUppercase').checked = !!cfg.style.uppercase;
  el('loDivider').checked = cfg.style.divider !== false;

  el('loLayoutToggle').dataset.layout = cfg.style.layout;
  const order = ['bar','stack','cards'];
  document.querySelectorAll('#loLayoutToggle button').forEach((b,i) => {
    b.classList.remove('active-vfr','active-ifr');
    if(order[i] === cfg.style.layout) b.classList.add('active-vfr');
  });
}

function bindLiveOverlayControls(){
  const fieldMap = {
    loFieldCallsign:'callsign', loFieldRoute:'route', loFieldProgress:'progress', loFieldDistance:'distance',
    loFieldRadio:'radio', loFieldHeading:'heading', loFieldAltitude:'altitude', loFieldPhase:'phase'
  };
  Object.entries(fieldMap).forEach(([elemId, key]) => {
    el(elemId).addEventListener('change', () => {
      db.liveOverlay.fields[key] = el(elemId).checked;
      renderLiveOverlayPreview();
      pushLiveOverlayConfig();
      queueSaveDb();
    });
  });

  // Libellés personnalisés par champ (le user renomme comme il veut, ex. "Cap" -> "HDG")
  LIVE_OVERLAY_FIELD_ORDER.forEach(key => {
    const input = document.getElementById('loLabel_' + key);
    if(!input) return;
    input.addEventListener('input', () => {
      db.liveOverlay.labels[key] = input.value.trim() || LIVE_OVERLAY_DEFAULT_LABELS[key];
      renderLiveOverlayPreview();
      pushLiveOverlayConfig();
      queueSaveDb();
    });
  });

  // Textes libres personnalisés (jusqu'à 2) : rien n'est affiché tant que le champ est vide.
  ['text1','text2'].forEach((key, i) => {
    const input = el('loCustom' + (i + 1));
    if(!input) return;
    input.addEventListener('input', () => {
      db.liveOverlay.custom[key] = input.value;
      renderLiveOverlayPreview();
      pushLiveOverlayConfig();
      queueSaveDb();
    });
  });

  const colorMap = { loBg:'bg', loText:'text', loAccent:'accent', loBorderColor:'borderColor' };
  Object.entries(colorMap).forEach(([elemId, key]) => {
    el(elemId).addEventListener('input', () => {
      db.liveOverlay.style[key] = el(elemId).value;
      renderLiveOverlayPreview();
      pushLiveOverlayConfig();
      queueSaveDb();
    });
  });

  const switchMap = { loBorder:'border', loShadow:'shadow', loBlur:'blur', loIcons:'icons', loUppercase:'uppercase', loDivider:'divider' };
  Object.entries(switchMap).forEach(([elemId, key]) => {
    el(elemId).addEventListener('change', () => {
      db.liveOverlay.style[key] = el(elemId).checked;
      renderLiveOverlayPreview();
      pushLiveOverlayConfig();
      queueSaveDb();
    });
  });

  el('loBgOpacity').addEventListener('input', () => {
    db.liveOverlay.style.bgOpacity = parseInt(el('loBgOpacity').value, 10);
    el('loBgOpacityVal').textContent = db.liveOverlay.style.bgOpacity + '%';
    updateRangeFill(el('loBgOpacity'));
    renderLiveOverlayPreview();
    pushLiveOverlayConfig();
    queueSaveDb();
  });
  el('loFont').addEventListener('change', () => {
    db.liveOverlay.style.font = el('loFont').value;
    renderLiveOverlayPreview();
    pushLiveOverlayConfig();
    queueSaveDb();
  });
  el('loScale').addEventListener('input', () => {
    db.liveOverlay.style.scale = parseInt(el('loScale').value, 10);
    el('loScaleVal').textContent = db.liveOverlay.style.scale + '%';
    updateRangeFill(el('loScale'));
    renderLiveOverlayPreview();
    pushLiveOverlayConfig();
    queueSaveDb();
  });
  el('loRadius').addEventListener('input', () => {
    db.liveOverlay.style.radius = parseInt(el('loRadius').value, 10);
    el('loRadiusVal').textContent = db.liveOverlay.style.radius + 'px';
    updateRangeFill(el('loRadius'));
    renderLiveOverlayPreview();
    pushLiveOverlayConfig();
    queueSaveDb();
  });
  el('loGap').addEventListener('input', () => {
    db.liveOverlay.style.gap = parseInt(el('loGap').value, 10);
    el('loGapVal').textContent = db.liveOverlay.style.gap + 'px';
    updateRangeFill(el('loGap'));
    renderLiveOverlayPreview();
    pushLiveOverlayConfig();
    queueSaveDb();
  });

  // La progression/distance de l'overlay dépendent des champs OACI départ/arrivée du Briefing.
  ['depIcao','arrIcao'].forEach(id => el(id).addEventListener('input', updateOverlayRouteDistance));
}

/* =========================================================
   LOGBOOK
   ========================================================= */
let editingLogbookId = null;
let _pendingTrackData = null; // trajet suivi en attente d'association au prochain vol enregistré

function parseDurationToMin(str){
  if(!str) return 0;
  let m = str.match(/^(\d{1,3}):(\d{2})$/);
  if(m) return parseInt(m[1])*60 + parseInt(m[2]);
  m = str.match(/(\d{1,3})\s*h\s*(\d{0,2})/i);
  if(m) return parseInt(m[1])*60 + (m[2] ? parseInt(m[2]) : 0);
  return 0;
}
function minToHhmm(min){
  const h = Math.floor(min/60), m = Math.round(min%60);
  return `${h}h${String(m).padStart(2,'0')}`;
}

function setLbRules(rules){
  el('lbRulesToggle').dataset.rules = rules;
  document.querySelectorAll('#lbRulesToggle button').forEach((b,i) => {
    b.classList.remove('active-vfr','active-ifr');
    if((i===0 && rules==='VFR') || (i===1 && rules==='IFR')) b.classList.add(rules==='VFR' ? 'active-vfr':'active-ifr');
  });
}

function populateCareerSelect(){
  const sel = el('lbCareer');
  const current = sel.value;
  sel.innerHTML = '<option value="">Aucune</option>' + db.careers.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  sel.value = current;
}

function resetLogbookForm(){
  editingLogbookId = null;
  el('logbookFormTitle').textContent = 'Ajouter un vol';
  ['lbCallsign','lbDep','lbArr','lbDuration','lbAircraft','lbNetwork','lbRemarks'].forEach(id => el(id).value = '');
  el('lbDate').value = new Date().toISOString().slice(0,10);
  el('lbCareer').value = '';
  el('lbPirep').value = 'none';
  setLbRules('VFR');
}

async function saveLogbookEntry(){
  const entry = {
    id: editingLogbookId || 'f' + Date.now(),
    date: el('lbDate').value || new Date().toISOString().slice(0,10),
    callsign: el('lbCallsign').value.trim(),
    dep: el('lbDep').value.trim().toUpperCase(),
    arr: el('lbArr').value.trim().toUpperCase(),
    aircraft: el('lbAircraft').value.trim(),
    rules: el('lbRulesToggle').dataset.rules || 'VFR',
    durationMin: parseDurationToMin(el('lbDuration').value.trim()),
    network: el('lbNetwork').value.trim(),
    careerId: el('lbCareer').value || null,
    pirep: el('lbPirep').value,
    remarks: el('lbRemarks').value.trim()
  };
  if(_pendingTrackData && !editingLogbookId){
    entry.trackData = _pendingTrackData;
    _pendingTrackData = null;
  } else if(editingLogbookId){
    const prev = db.logbook.find(f => f.id === editingLogbookId);
    if(prev && prev.trackData) entry.trackData = prev.trackData;
  }
  if(editingLogbookId){
    const idx = db.logbook.findIndex(f => f.id === editingLogbookId);
    if(idx > -1) db.logbook[idx] = entry;
  } else {
    db.logbook.unshift(entry);
  }
  await saveDbNow();
  resetLogbookForm();
  renderLogbook();
}

function editLogbookEntry(id){
  const f = db.logbook.find(x => x.id === id);
  if(!f) return;
  editingLogbookId = id;
  el('logbookFormTitle').textContent = 'Modifier le vol';
  el('lbDate').value = f.date;
  el('lbCallsign').value = f.callsign;
  el('lbDep').value = f.dep;
  el('lbArr').value = f.arr;
  el('lbAircraft').value = f.aircraft;
  el('lbDuration').value = minToHhmm(f.durationMin);
  el('lbNetwork').value = f.network;
  populateCareerSelect();
  el('lbCareer').value = f.careerId || '';
  el('lbPirep').value = f.pirep;
  el('lbRemarks').value = f.remarks;
  setLbRules(f.rules);
  window.scrollTo({top:0, behavior:'smooth'});
}

async function deleteLogbookEntry(id){
  if(!confirm('Supprimer ce vol du logbook ?')) return;
  db.logbook = db.logbook.filter(f => f.id !== id);
  await saveDbNow();
  renderLogbook();
}

const pirepLabels = { none:['Aucun','pending'], pending:['En attente','pending'], ok:['Validé','ok'], rejected:['Refusé','rejected'] };

function renderLogbook(){
  const rows = el('logbookRows');
  const sorted = [...db.logbook].sort((a,b) => (b.date||'').localeCompare(a.date||''));
  rows.innerHTML = sorted.map(f => {
    const career = db.careers.find(c => c.id === f.careerId);
    const [pLabel, pClass] = pirepLabels[f.pirep] || pirepLabels.none;
    return `<tr>
      <td>${escapeHtml(f.date||'—')}</td>
      <td>${escapeHtml(f.callsign||'—')}</td>
      <td>${escapeHtml(f.dep||'----')} → ${escapeHtml(f.arr||'----')}</td>
      <td>${escapeHtml(f.aircraft||'—')}</td>
      <td><span class="pill ${f.rules.toLowerCase()}">${f.rules}</span></td>
      <td>${minToHhmm(f.durationMin)}</td>
      <td>${escapeHtml(f.network||'—')}</td>
      <td>${career ? escapeHtml(career.name) : '—'}</td>
      <td><span class="pill ${pClass}">${pLabel}</span></td>
      <td><div class="row-actions">
        ${f.trackData ? `<button class="icon-btn" onclick="openRouteModal('${f.id}')">Carte</button>` : ''}
        <button class="icon-btn" onclick="editLogbookEntry('${f.id}')">Modifier</button>
        <button class="icon-btn" onclick="deleteLogbookEntry('${f.id}')">Suppr.</button>
      </div></td>
    </tr>`;
  }).join('');
  el('logbookEmpty').style.display = sorted.length ? 'none' : 'block';

  const totalMin = db.logbook.reduce((s,f) => s + f.durationMin, 0);
  el('statFlights').textContent = db.logbook.length;
  el('statHours').textContent = minToHhmm(totalMin);
  el('statLast').textContent = sorted.length ? sorted[0].date : '—';
}

function sendBriefingToLogbook(){
  editingLogbookId = null;
  el('logbookFormTitle').textContent = 'Ajouter un vol';
  el('lbDate').value = new Date().toISOString().slice(0,10);
  el('lbCallsign').value = el('callsign').value;
  el('lbDep').value = el('depIcao').value.toUpperCase();
  el('lbArr').value = el('arrIcao').value.toUpperCase();
  el('lbAircraft').value = el('aircraft').value;
  el('lbDuration').value = el('duration').value.match(/\d/) ? minToHhmm(parseDurationToMin(el('duration').value)) : '';
  el('lbNetwork').value = '';
  el('lbRemarks').value = el('notes').value;
  populateCareerSelect();
  el('lbCareer').value = '';
  el('lbPirep').value = 'none';
  setLbRules(state.rules);
  switchView('logbook');
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* =========================================================
   CAREER
   ========================================================= */
let editingCareerId = null;

function resetCareerForm(){
  editingCareerId = null;
  el('careerFormTitle').textContent = 'Nouvelle carrière';
  el('carName').value = '';
  el('carType').value = 'VA';
  el('carRanks').value = '';
}

async function saveCareer(){
  const name = el('carName').value.trim();
  if(!name){ alert('Indique un nom pour cette carrière.'); return; }
  const ranks = el('carRanks').value.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    const [n, h] = line.split(';');
    return { name: (n||'').trim(), hours: parseFloat(h) || 0 };
  }).sort((a,b) => a.hours - b.hours);

  const career = { id: editingCareerId || 'c' + Date.now(), name, type: el('carType').value, ranks };
  if(editingCareerId){
    const idx = db.careers.findIndex(c => c.id === editingCareerId);
    const prevTours = idx > -1 ? db.careers[idx].tours : undefined;
    if(idx > -1) db.careers[idx] = { ...career, tours: prevTours };
  } else {
    db.careers.push(career);
  }
  await saveDbNow();
  resetCareerForm();
  renderCareers();
  populateCareerSelect();
}

function editCareer(id){
  const c = db.careers.find(x => x.id === id);
  if(!c) return;
  editingCareerId = id;
  el('careerFormTitle').textContent = 'Modifier la carrière';
  el('carName').value = c.name;
  el('carType').value = c.type;
  el('carRanks').value = c.ranks.map(r => `${r.name};${r.hours}`).join('\n');
  window.scrollTo({top:0, behavior:'smooth'});
}

async function deleteCareer(id){
  if(!confirm('Supprimer cette carrière ? Les vols liés resteront dans le logbook mais perdront ce lien.')) return;
  db.careers = db.careers.filter(c => c.id !== id);
  db.logbook.forEach(f => { if(f.careerId === id) f.careerId = null; });
  await saveDbNow();
  renderCareers();
  populateCareerSelect();
  renderLogbook();
}

function renderCareers(){
  const grid = el('careerGrid');
  if(!db.careers.length){
    grid.innerHTML = '<div class="empty-state">Aucune carrière définie. Crée-en une ci-dessous pour suivre ta progression.</div>';
  } else {
    grid.innerHTML = db.careers.map(c => {
      const totalMin = db.logbook.filter(f => f.careerId === c.id).reduce((s,f) => s + f.durationMin, 0);
      const totalHours = totalMin / 60;
      const ranks = c.ranks.length ? c.ranks : [{name:'Non défini', hours:0}];
      let current = ranks[0], next = null;
      for(let i=0;i<ranks.length;i++){
        if(totalHours >= ranks[i].hours) current = ranks[i];
        if(totalHours < ranks[i].hours){ next = ranks[i]; break; }
      }
      const progressPct = next ? Math.min(100, (totalHours / next.hours) * 100) : 100;

      return `<div class="career-card">
        <div class="type-tag">${escapeHtml(c.type)}</div>
        <div class="name">${escapeHtml(c.name)}</div>
        <div class="rank-now">${escapeHtml(current.name)}</div>
        <div class="progress-track"><div class="progress-fill" style="width:${progressPct}%"></div></div>
        <div class="meta">
          <span>${totalHours.toFixed(1)} h</span>
          <span>${next ? 'Prochain : ' + escapeHtml(next.name) + ' à ' + next.hours + 'h' : 'Grade maximum atteint'}</span>
        </div>
        <div class="btn-row">
          <button class="icon-btn" onclick="editCareer('${c.id}')">Modifier</button>
          <button class="icon-btn" onclick="deleteCareer('${c.id}')">Supprimer</button>
        </div>
      </div>`;
    }).join('');
  }
  renderTours();
  populateTourCareerSelect();
}

/* =========================================================
   TOURS IVAO — timeline horizontale ("paysage"), édition, animation
   ========================================================= */
let editingTourId = null; // { careerId, tourId } ou null
let _justCompletedTourId = null;

function renderTours(){
  const container = el('toursList');

  // Le innerHTML est reconstruit à chaque rendu (nouvelles données) : sans ça, le
  // scroll horizontal de chaque piste de tour revient à 0 à chaque clic. On le
  // sauvegarde donc avant reconstruction, puis on le restaure juste après.
  const scrollPositions = {};
  container.querySelectorAll('.tour-card[data-tour-id]').forEach(card => {
    const track = card.querySelector('.tour-track');
    if(track) scrollPositions[card.dataset.tourId] = track.scrollLeft;
  });

  const ivaoCareers = db.careers.filter(c => c.type === 'IVAO' && c.tours && c.tours.length);
  if(!ivaoCareers.length){
    container.innerHTML = '<div class="tours-empty">Aucun tour IVAO pour le moment. Crée une carrière de type IVAO puis ajoute un tour ci-dessous.</div>';
    return;
  }
  container.innerHTML = ivaoCareers.map(c => c.tours.map(t => {
    const done = t.legs.filter(l => l.done).length;

    // Construction de la timeline : premier noeud = départ de la 1ère étape,
    // puis un noeud par arrivée d'étape. Chaque segment reflète l'état "done".
    const nodes = [{ icao: t.legs[0].dep, done: t.legs[0].done || done > 0 }];
    t.legs.forEach(l => nodes.push({ icao: l.arr, done: l.done }));

    let trackHtml = `<div class="tour-node ${nodes[0].done ? 'done':''}"><div class="dot"></div><div class="icao">${escapeHtml(nodes[0].icao || '----')}</div></div>`;
    t.legs.forEach((l, i) => {
      trackHtml += `<div class="tour-leg ${l.done ? 'done':''}"></div>`;
      trackHtml += `<div class="tour-node ${l.done ? 'done':''}" onclick="toggleTourLeg('${c.id}','${t.id}',${i})" title="Étape ${escapeHtml(l.dep)} → ${escapeHtml(l.arr)} — valide aussi les étapes précédentes">
        <div class="dot"></div><div class="icao">${escapeHtml(l.arr || '----')}</div>
      </div>`;
    });

    const justCompleted = _justCompletedTourId === t.id;
    return `<div class="tour-card ${justCompleted ? 'just-completed':''}" data-tour-id="${t.id}">
      <div class="tour-card-head">
        <div class="titles">
          <div class="career-name">${escapeHtml(c.name)}</div>
          <div class="tour-name">${escapeHtml(t.name)}</div>
        </div>
        <div class="tour-progress">${done}/${t.legs.length} étapes</div>
        <div class="tour-card-actions">
          <button class="icon-btn" onclick="startEditTour('${c.id}','${t.id}')">Modifier</button>
          <button class="icon-btn" onclick="deleteTour('${c.id}','${t.id}')">Supprimer</button>
        </div>
      </div>
      ${justCompleted ? '<div class="tour-complete-badge">✓ Tour terminé</div>' : ''}
      <div class="tour-track">${trackHtml}</div>
    </div>`;
  }).join('')).join('');

  container.querySelectorAll('.tour-card[data-tour-id]').forEach(card => {
    const saved = scrollPositions[card.dataset.tourId];
    const track = card.querySelector('.tour-track');
    if(track && saved) track.scrollLeft = saved;
  });

  if(_justCompletedTourId){
    const id = _justCompletedTourId;
    _justCompletedTourId = null;
    setTimeout(() => {
      const card = container.querySelector(`.tour-card[data-tour-id="${id}"]`);
      if(card){ card.classList.remove('just-completed'); card.querySelector('.tour-complete-badge')?.remove(); }
    }, 2600);
  }
}

function populateTourCareerSelect(){
  const sel = el('tourCareerSelect');
  const current = sel.value;
  const ivaoCareers = db.careers.filter(c => c.type === 'IVAO');
  sel.innerHTML = ivaoCareers.length
    ? ivaoCareers.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')
    : '<option value="">Aucune carrière IVAO</option>';
  if(current) sel.value = current;
}

function resetTourForm(){
  editingTourId = null;
  el('tourFormTitle').textContent = 'Nouveau tour';
  el('tourSaveBtn').textContent = 'Ajouter ce tour';
  el('tourName').value = '';
  el('tourLegs').value = '';
}

function startEditTour(careerId, tourId){
  const career = db.careers.find(c => c.id === careerId);
  const tour = career && (career.tours||[]).find(t => t.id === tourId);
  if(!tour) return;
  editingTourId = { careerId, tourId };
  el('tourFormTitle').textContent = 'Modifier le tour';
  el('tourSaveBtn').textContent = 'Enregistrer les modifications';
  populateTourCareerSelect();
  el('tourCareerSelect').value = careerId;
  el('tourName').value = tour.name;
  el('tourLegs').value = tour.legs.map(l => `${l.dep};${l.arr}`).join('\n');
  el('tourPanel').scrollIntoView({behavior:'smooth', block:'center'});
}

async function saveTour(){
  const careerId = el('tourCareerSelect').value;
  const career = db.careers.find(c => c.id === careerId);
  if(!career){ alert("Crée d'abord une carrière de type IVAO."); return; }
  const name = el('tourName').value.trim() || 'Tour sans nom';
  const legs = el('tourLegs').value.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    const [d, a] = line.split(';');
    return { dep: (d||'').trim().toUpperCase(), arr: (a||'').trim().toUpperCase(), done:false };
  });
  if(!legs.length){ alert('Ajoute au moins une étape (une ligne OACI départ;OACI arrivée).'); return; }

  if(editingTourId){
    // Si le tour est déplacé vers une autre carrière, on le retire de l'ancienne.
    const oldCareer = db.careers.find(c => c.id === editingTourId.careerId);
    const oldTour = oldCareer && (oldCareer.tours||[]).find(t => t.id === editingTourId.tourId);
    const previousLegs = oldTour ? oldTour.legs : [];
    // Conserve l'état "done" des étapes identiques (même dep;arr, même position).
    const mergedLegs = legs.map((l, i) => {
      const prev = previousLegs[i];
      return (prev && prev.dep === l.dep && prev.arr === l.arr) ? { ...l, done: prev.done } : l;
    });
    if(oldCareer && oldCareer.id !== careerId){
      oldCareer.tours = (oldCareer.tours||[]).filter(t => t.id !== editingTourId.tourId);
    }
    const targetCareer = career;
    targetCareer.tours = targetCareer.tours || [];
    const existingIdx = targetCareer.tours.findIndex(t => t.id === editingTourId.tourId);
    const tourObj = { id: editingTourId.tourId, name, legs: mergedLegs };
    if(existingIdx > -1) targetCareer.tours[existingIdx] = tourObj;
    else targetCareer.tours.push(tourObj);
  } else {
    career.tours = career.tours || [];
    career.tours.push({ id:'t'+Date.now(), name, legs });
  }

  await saveDbNow();
  resetTourForm();
  renderCareers();
}

async function toggleTourLeg(careerId, tourId, legIndex){
  const career = db.careers.find(c => c.id === careerId);
  const tour = career && (career.tours||[]).find(t => t.id === tourId);
  if(!tour) return;
  const wasDone = tour.legs[legIndex].done;
  if(!wasDone){
    // Cliquer sur une étape valide aussi automatiquement toutes celles qui précèdent
    for(let i=0;i<=legIndex;i++) tour.legs[i].done = true;
  } else {
    // Recliquer dessus revient en arrière : dévalide cette étape et toutes celles qui suivent
    for(let i=legIndex;i<tour.legs.length;i++) tour.legs[i].done = false;
  }
  const nowAllDone = tour.legs.every(l => l.done) && tour.legs.length > 0;
  if(nowAllDone) _justCompletedTourId = tourId;
  await saveDbNow();
  renderCareers();
}

async function deleteTour(careerId, tourId){
  if(!confirm('Supprimer ce tour ?')) return;
  const career = db.careers.find(c => c.id === careerId);
  if(!career) return;
  career.tours = (career.tours||[]).filter(t => t.id !== tourId);
  if(editingTourId && editingTourId.tourId === tourId) resetTourForm();
  await saveDbNow();
  renderCareers();
}

/* =========================================================
   TRACKING DE VOL (SimConnect) + CARTE
   ========================================================= */
let trackMap = null, trackPathLine = null, trackPlaneMarker = null;
let modalMap = null, modalPhaseLayers = [];
let _liveTrackPoints = [];
let _lastTrackedFlight = null; // en attente d'ajout au logbook
let _trackerConnectedState = false; // connecté ou en tracking auprès du simulateur
let _pendingManualStop = false; // true entre le clic sur "Arrêter le vol & envoyer le PIREP" et l'événement flight-end correspondant

// Un seul chemin d'envoi vers le logbook pour un vol suivi par le simulateur : tant que
// le tracking est actif (connecté/en vol) ou qu'un vol tracké attend son envoi de PIREP,
// le bouton d'enregistrement manuel du Briefing est masqué pour éviter le doublon
// "Enregistrer ce vol dans le logbook" + "Envoyer le PIREP" pour un seul et même vol.
function updateBriefingSaveVisibility(){
  const row = el('briefingSaveRow');
  const hint = el('briefingSaveHint');
  if(!row) return;
  const hideManualSave = _trackerConnectedState || !!_lastTrackedFlight;
  row.style.display = hideManualSave ? 'none' : '';
  if(hint) hint.style.display = hideManualSave ? '' : 'none';
}

const PHASE_META = {
  taxi_out:       { label:'Roulage (départ)',   color:'#7c8894' },
  liftoff:        { label:'Décollage',          color:'#ffd166' },
  initial_climb:  { label:'Montée initiale',    color:'#ff9f43' },
  climb:          { label:'Montée',             color:'#ffb020' },
  cruise:         { label:'Croisière',          color:'#39e88f' },
  descent:        { label:'Descente',           color:'#54d6e8' },
  approach:       { label:'Approche',           color:'#4d7cff' },
  final_approach: { label:'Approche finale',    color:'#a06cf5' },
  touchdown:      { label:'Toucher des roues',  color:'#ff5c5c' },
  taxi_in:        { label:'Roulage (arrivée)',  color:'#7c8894' }
};
function phaseMeta(p){ return PHASE_META[p] || { label:p, color:'#7c8894' }; }
function fmtDuration(sec){
  if(sec < 60) return sec + ' s';
  const m = Math.floor(sec/60), s = Math.round(sec%60);
  return m + ' min' + (s ? ' ' + s + 's' : '');
}

let trackPathGlow = null;

// Icône avion en SVG, tournée dynamiquement selon le cap (voir updatePlaneMarker).
function planeDivIcon(color){
  return L.divIcon({
    className: 'plane-marker',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    html: `<div class="plane-marker-rotor" style="--plane-color:${color}">
      <svg viewBox="0 0 24 24"><path d="M12 1.5 L15 10 L22.5 14 L22.5 16.5 L15 14.5 L15 19.5 L18.5 22 L18.5 23.5 L12 22 L5.5 23.5 L5.5 22 L9 19.5 L9 14.5 L1.5 16.5 L1.5 14 L9 10 Z"/></svg>
    </div>`
  });
}
function updatePlaneMarker(marker, latlng, headingDeg){
  marker.setLatLng(latlng);
  const el = marker.getElement();
  if(el){
    const rotor = el.querySelector('.plane-marker-rotor');
    if(rotor) rotor.style.transform = `rotate(${headingDeg || 0}deg)`;
  }
}

// Ajoute un fond de carte sombre (CARTO Dark Matter) + contrôles Leaflet restylés,
// nettement plus modernes que les tuiles OSM claires et les boutons par défaut.
function styleMapShell(map){
  map.zoomControl.setPosition('bottomright');
  map.attributionControl.setPrefix(false);
}
function darkTileLayer(){
  return L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd', maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
  });
}

function initTrackMap(){
  if(trackMap || !window.L) return;
  trackMap = L.map('trackMap', { attributionControl:true, zoomControl:true }).setView([46.6, 2.4], 5);
  darkTileLayer().addTo(trackMap);
  styleMapShell(trackMap);
  trackPathGlow = L.polyline([], { color:'#54d6e8', weight:8, opacity:.18, className:'route-glow' }).addTo(trackMap);
  trackPathLine = L.polyline([], { color:'#54d6e8', weight:2.5, opacity:.95 }).addTo(trackMap);
  trackPlaneMarker = L.marker([46.6,2.4], { icon: planeDivIcon('var(--accent-vfr)') });
}

async function toggleTrackerConnection(){
  const btn = el('trkConnectBtn');
  const connected = await window.tracker.isConnected();
  if(connected){
    await window.tracker.disconnect();
    return;
  }
  btn.disabled = true;
  btn.textContent = 'Connexion en cours…';
  const res = await window.tracker.connect();
  btn.disabled = false;
  if(!res.ok){
    el('trkStatusMsg').textContent = res.error || 'Connexion impossible.';
    el('trkStatusMsg').className = 'status-msg err';
    btn.textContent = 'Lancer le vol & le tracker';
  }
}

// Affiche/masque le bouton "Arrêter le vol & envoyer le PIREP", visible uniquement pendant
// qu'un vol est réellement en cours de suivi (du roulage au décollage jusqu'à l'atterrissage).
function setTrkStopVisible(visible){
  const row = el('trkStopRow'), hint = el('trkStopHint');
  if(row) row.classList.toggle('hidden', !visible);
  if(hint) hint.classList.toggle('hidden', !visible);
  if(!visible){
    const btn = el('trkStopBtn');
    if(btn){ btn.disabled = false; btn.textContent = 'Arrêter le vol & envoyer le PIREP'; }
  }
}

// Clôture le vol en cours immédiatement (sans attendre le délai de parking détecté
// automatiquement) et enchaîne directement sur l'envoi du PIREP complet dans le logbook —
// un seul clic pour arrêter le tracking ET envoyer le PIREP. La suite (remplissage des
// champs + enregistrement) est prise en charge par le handler onFlightEnd ci-dessous, une
// fois l'événement de fin de vol effectivement reçu du tracker.
async function stopTrackingAndSendPirep(){
  const btn = el('trkStopBtn');
  if(!btn || btn.disabled) return;
  btn.disabled = true;
  btn.textContent = 'Arrêt du vol…';
  _pendingManualStop = true;
  const res = await window.tracker.stopTracking();
  if(!res || !res.ok){
    _pendingManualStop = false;
    btn.disabled = false;
    btn.textContent = 'Arrêter le vol & envoyer le PIREP';
    el('trkStatusMsg').textContent = res && res.reason === 'too_short'
      ? "Vol trop court pour être enregistré (moins de 2 minutes en l'air)."
      : 'Aucun vol en cours à arrêter.';
    el('trkStatusMsg').className = 'status-msg err';
  }
}

function setTrackerUiConnected(connected, tracking){
  const dot = el('trkStatusDot');
  dot.classList.toggle('connected', connected && !tracking);
  dot.classList.toggle('tracking', !!tracking);
  el('trkStatusText').textContent = tracking ? 'Vol en cours de tracking…' : (connected ? 'Connecté — en attente du décollage' : 'Non connecté');
  el('trkConnectBtn').textContent = connected ? 'Déconnecter' : 'Lancer le vol & le tracker';
  _trackerConnectedState = !!connected;
  updateBriefingSaveVisibility();
}

function initTrackerListeners(){
  if(!window.tracker) return;
  window.tracker.onStatus(data => {
    setTrackerUiConnected(!!data.connected, false);
    if(data.error){
      el('trkStatusMsg').textContent = 'Erreur : ' + data.error;
      el('trkStatusMsg').className = 'status-msg err';
    } else {
      el('trkStatusMsg').textContent = data.connected ? `Connecté (${data.sim || 'simulateur'}).` : '';
      el('trkStatusMsg').className = 'status-msg';
    }
    if(!data.connected){
      _liveTrackPoints = [];
      if(trackPathLine){ trackPathLine.setLatLngs([]); trackPathGlow.setLatLngs([]); }
      if(trackPlaneMarker && trackMap) trackMap.removeLayer(trackPlaneMarker);
      el('liveReportPanel').classList.add('hidden');
      el('liveTrackHint').textContent = 'Connecte-toi au simulateur ci-contre pour afficher la carte, la télémétrie et le rapport de vol en direct.';
      _overlayTelemetry = { callsign:null, dep:null, arr:null, altFt:null, headingDeg:null, comFreqMhz:null, phase:null, distanceNm:null, progressPct:null };
      renderLiveOverlayPreview();
      pushLiveOverlayTelemetry();
      setTrkStopVisible(false);
      _pendingManualStop = false;
    }
  });

  window.tracker.onFlightStart(data => {
    setTrackerUiConnected(true, true);
    setTrkStopVisible(true);
    _liveTrackPoints = [];
    if(trackPathLine){ trackPathLine.setLatLngs([]); trackPathGlow.setLatLngs([]); }
    if(data.aircraft) el('trkAircraftName').textContent = 'Appareil détecté : ' + data.aircraft;
    el('liveReportPanel').classList.add('hidden');
    el('liveTrackHint').textContent = 'Vol en cours de suivi — les phases et le rapport détaillé se complètent ci-dessous au fil du vol.';
    // Nouveau vol : on repart d'une télémétrie propre pour l'overlay live et on
    // (re)calcule la distance totale départ -> arrivée pour la progression en %.
    _overlayTelemetry = { callsign: el('callsign').value, dep: el('depIcao').value, arr: el('arrIcao').value, altFt:null, headingDeg:null, comFreqMhz:null, phase:null, distanceNm:null, progressPct:null };
    _overlayArrCoord = null;
    updateOverlayRouteDistance();
  });

  window.tracker.onTelemetry(data => {
    el('trkPhase').textContent = ({ idle:'—', ground:'Au sol / roulage', airborne:'En vol', landed:'Atterri / roulage' })[data.phase] || data.phase;
    el('trkAlt').textContent = Math.round(data.altFt).toLocaleString('fr-FR') + ' ft';
    el('trkIas').textContent = Math.round(data.iasKt) + ' kt';
    el('trkGs').textContent = Math.round(data.gsKt) + ' kt';
    el('trkVs').textContent = Math.round(data.vsFpm) + ' ft/min';
    el('trkHdg').textContent = Math.round(data.headingDeg) + '°';
    el('trkRadio').textContent = data.comFreqMhz != null ? data.comFreqMhz.toFixed(3) : '—';

    if(data.lat && data.lon && trackMap){
      const latlng = [data.lat, data.lon];
      if(!trackMap.hasLayer(trackPlaneMarker)) trackPlaneMarker.addTo(trackMap);
      updatePlaneMarker(trackPlaneMarker, latlng, data.headingDeg);
      if(data.phase === 'airborne'){
        _liveTrackPoints.push(latlng);
        trackPathLine.setLatLngs(_liveTrackPoints);
        trackPathGlow.setLatLngs(_liveTrackPoints);
        trackMap.panTo(latlng, { animate:true, duration:0.5 });
      }
    }

    // Overlay live personnalisable : champs instantanés (indicatif/route pris sur le
    // Briefing, le reste sur la télémétrie SimConnect).
    _overlayTelemetry.callsign = el('callsign').value;
    _overlayTelemetry.dep = el('depIcao').value;
    _overlayTelemetry.arr = el('arrIcao').value;
    _overlayTelemetry.altFt = data.altFt;
    _overlayTelemetry.headingDeg = data.headingDeg;
    _overlayTelemetry.comFreqMhz = data.comFreqMhz;
    if(!_overlayTelemetry.phase) _overlayTelemetry.phase = data.phase;
    renderLiveOverlayPreview();
    pushLiveOverlayTelemetry();
  });

  window.tracker.onFlightLanded(data => {
    setTrackerUiConnected(true, false);
    // Toucher des roues : progression forcée à 100 % pile à cet instant, plutôt que de
    // dépendre du calcul distance restante (qui peut ne pas retomber exactement à 0 NM).
    _overlayTelemetry.progressPct = 100;
    renderLiveOverlayPreview();
    pushLiveOverlayTelemetry();
  });

  // Phases de vol + rapport détaillé qui se complètent directement dans l'app au fil
  // du vol (et pas seulement dans la vue synthétique de l'onglet Carte du Logbook une
  // fois le vol terminé) : réutilise les mêmes fonctions de rendu que la modale du
  // logbook (renderPhaseLegend / renderPhaseTable / renderProfileChart).
  if(window.tracker.onProgress){
    window.tracker.onProgress(data => {
      if(!data || !Array.isArray(data.phases) || !data.phases.length) return;
      el('liveTrackHint').textContent = `Vol en cours — ${minToHhmm(data.durationMin || 0)} écoulées, ${data.distanceNm || 0} NM parcourues.`;
      el('liveReportPanel').classList.remove('hidden');
      renderPhaseLegend(data.path, 'liveReportLegend');
      renderPhaseTable(data.phases, 'liveReportPhaseRows');
      renderProfileChart(data.path, 'liveReportProfile');

      // Overlay live : distance parcourue + progression (% de la distance totale
      // départ -> arrivée saisie dans le Briefing) + phase courante plus précise
      // (ex. "Croisière", "Descente"...) que le statut brut idle/ground/airborne/landed.
      _overlayTelemetry.distanceNm = data.distanceNm;
      // Progression = distance RESTANTE jusqu'à l'arrivée (voir onTelemetry, mis à jour à
      // chaque tick avec la position courante) plutôt que distance parcourue / ligne droite,
      // qui dépassait 100 % avant le toucher des roues sur un trajet non direct.
      const lastPt = Array.isArray(data.path) && data.path.length ? data.path[data.path.length - 1] : null;
      if(lastPt && lastPt.lat != null && lastPt.lon != null && _overlayArrCoord && _overlayTotalRouteNm){
        const remainingNm = haversineNmRenderer(lastPt.lat, lastPt.lon, _overlayArrCoord.lat, _overlayArrCoord.lon);
        _overlayTelemetry.progressPct = Math.max(0, Math.min(99, Math.round(100 * (1 - remainingNm / _overlayTotalRouteNm))));
      } else if(!_overlayTotalRouteNm){
        _overlayTelemetry.progressPct = null;
      }
      const lastPhase = data.phases[data.phases.length - 1];
      if(lastPhase) _overlayTelemetry.phase = lastPhase.phase;
      renderLiveOverlayPreview();
      pushLiveOverlayTelemetry();
    });
  }

  window.tracker.onFlightEnd(async data => {
    setTrackerUiConnected(true, false);
    setTrkStopVisible(false);
    _lastTrackedFlight = data;
    updateBriefingSaveVisibility();

    // Arrêt manuel via "Arrêter le vol & envoyer le PIREP" : un seul clic, donc pas d'étape
    // de relecture intermédiaire — on complète tous les champs et on enregistre directement.
    if(_pendingManualStop){
      _pendingManualStop = false;
      await applyTrackedFlightToLogbook(false);
      el('trkStatusMsg').textContent = 'Vol arrêté et PIREP envoyé dans le logbook (tous les champs complétés) ✓';
      el('trkStatusMsg').className = 'status-msg ok';
      return;
    }

    // Fin de vol détectée automatiquement (parking + délai écoulé) : on affiche le résumé
    // et on laisse la main pour envoyer le PIREP ou ignorer ce vol (ex. faux positif).
    const dep = data.depGuess ? data.depGuess.icao : '----';
    const arr = data.arrGuess ? data.arrGuess.icao : '----';
    el('trkResRoute').textContent = `${dep} → ${arr}`;
    el('trkResDuration').textContent = minToHhmm(data.durationMin);
    el('trkResDistance').textContent = data.distanceNm + ' NM';
    el('trkResMaxAlt').textContent = data.maxAltFt.toLocaleString('fr-FR') + ' ft';
    el('trkResMaxIas').textContent = data.maxIasKt + ' kt';
    el('trkResLanding').textContent = data.landingRateFpm != null ? data.landingRateFpm + ' ft/min' : '—';
    el('trkResBounce').textContent = data.bounceCount ? `${data.bounceCount} rebond${data.bounceCount > 1 ? 's' : ''}` : 'Aucun';
    el('trkResMaxBank').textContent = (data.turnStats && data.turnStats.maxBankDeg)
      ? `${data.turnStats.maxBankDeg}°${data.turnStats.aggressiveTurnCount ? ' ⚠️' : (data.turnStats.steepTurnCount ? ' (serré)' : '')}`
      : '—';
    el('trkResultPanel').classList.remove('hidden');
    // Rapport final complet (avec la vraie phase d'atterrissage) à la place du live partiel.
    if(Array.isArray(data.phases) && data.phases.length){
      el('liveTrackHint').textContent = `Vol terminé — ${minToHhmm(data.durationMin || 0)}, ${data.distanceNm || 0} NM parcourues.`;
      el('liveReportPanel').classList.remove('hidden');
      renderPhaseLegend(data.path, 'liveReportLegend');
      renderPhaseTable(data.phases, 'liveReportPhaseRows');
      renderProfileChart(data.path, 'liveReportProfile');
    }
  });
}

// Remplit TOUS les champs du formulaire logbook à partir du vol tracké : les champs saisis
// dans le Briefing (indicatif, appareil, règles VFR/IFR) autant que les données mesurées par
// le tracker (dép/arr devinés, durée, trajet, stats). Avant : seuls dép/arr/durée/remarques
// étaient repris, laissant indicatif/appareil/règles vides dans le PIREP envoyé.
function populateLogbookFieldsFromTrackedFlight(data){
  resetLogbookForm();
  el('lbDate').value = data.startedAt.slice(0,10);
  el('lbCallsign').value = el('callsign').value.trim();
  const dep = el('depIcao').value.trim().toUpperCase() || (data.depGuess ? data.depGuess.icao : '');
  const arr = el('arrIcao').value.trim().toUpperCase() || (data.arrGuess ? data.arrGuess.icao : '');
  el('lbDep').value = dep;
  el('lbArr').value = arr;
  el('lbAircraft').value = el('aircraft').value.trim();
  setLbRules(state.rules === 'IFR' ? 'IFR' : 'VFR');
  el('lbDuration').value = minToHhmm(data.durationMin);
  el('lbNetwork').value = '';
  populateCareerSelect();
  el('lbCareer').value = '';
  el('lbPirep').value = 'none';
  const remarksBits = [
    `Distance : ${data.distanceNm} NM`,
    `Altitude max : ${data.maxAltFt} ft`,
    `Vitesse max : ${data.maxIasKt} kt`,
    data.landingRateFpm != null ? `Atterrissage : ${data.landingRateFpm} ft/min` : null,
    data.bounceCount ? `${data.bounceCount} rebond${data.bounceCount > 1 ? 's' : ''} au toucher` : null,
    data.touchdown && data.touchdown.zone ? `Toucher : piste ${data.touchdown.zone.runway}, ${data.touchdown.zone.distanceFromThresholdFt} ft après le seuil, ${data.touchdown.zone.lateralOffsetFt} ft à ${data.touchdown.zone.side}` : null,
    data.turnStats && data.turnStats.maxBankDeg ? `Virage max : ${data.turnStats.maxBankDeg}°${data.turnStats.aggressiveTurnCount ? ' (' + data.turnStats.aggressiveTurnCount + ' virage(s) engagé(s) >' + 45 + '°)' : (data.turnStats.steepTurnCount ? ' (' + data.turnStats.steepTurnCount + ' virage(s) serré(s))' : '')}` : null,
    data.fuelUsedLbs != null ? `Carburant utilisé : ${data.fuelUsedLbs} lbs` : null
  ].filter(Boolean);
  const briefingNotes = el('notes').value.trim();
  el('lbRemarks').value = 'Vol tracké automatiquement — ' + remarksBits.join(' · ') + (briefingNotes ? ' · Notes de briefing : ' + briefingNotes : '');
  // Trajet complet + segmentation de phases + zone de toucher, associés au vol du logbook.
  _pendingTrackData = {
    path: data.path, phases: data.phases, touchdown: data.touchdown,
    distanceNm: data.distanceNm, maxAltFt: data.maxAltFt, maxIasKt: data.maxIasKt,
    landingRateFpm: data.landingRateFpm, fuelUsedLbs: data.fuelUsedLbs,
    bounceCount: data.bounceCount, turnStats: data.turnStats,
    depGuess: data.depGuess, arrGuess: data.arrGuess
  };
}

// Envoie le PIREP du vol tracké dans le logbook en un seul clic : remplit tous les champs
// (voir populateLogbookFieldsFromTrackedFlight) ET enregistre directement — plus besoin d'un
// second clic sur "Enregistrer le vol" une fois basculé sur l'onglet Logbook. Par défaut on
// bascule sur l'onglet Logbook pour montrer le résultat ; passer `false` pour rester sur le
// Briefing (utilisé par l'arrêt manuel, qui affiche déjà une confirmation sur place).
async function applyTrackedFlightToLogbook(switchToLogbook){
  if(!_lastTrackedFlight) return;
  const data = _lastTrackedFlight;
  populateLogbookFieldsFromTrackedFlight(data);
  await saveLogbookEntry();
  dismissTrackedFlight();
  if(switchToLogbook !== false) switchView('logbook');
}

function dismissTrackedFlight(){
  _lastTrackedFlight = null;
  el('trkResultPanel').classList.add('hidden');
  updateBriefingSaveVisibility();
}

/* ---------------- Modale carte de trajet + relecture détaillée (depuis le logbook) ---------------- */
function openRouteModal(flightId){
  const f = db.logbook.find(x => x.id === flightId);
  if(!f || !f.trackData) return;
  const td = f.trackData;
  el('routeModalTitle').textContent = `Trajet — ${f.callsign || 'Vol'} (${f.dep || '----'} → ${f.arr || '----'})`;
  el('routeModalStats').innerHTML = `
    <div class="tstat"><div class="cap">Distance</div><div class="val">${td.distanceNm ?? '—'} NM</div></div>
    <div class="tstat"><div class="cap">Altitude max</div><div class="val">${td.maxAltFt ?? '—'} ft</div></div>
    <div class="tstat"><div class="cap">Vitesse max</div><div class="val">${td.maxIasKt ?? '—'} kt</div></div>
    <div class="tstat"><div class="cap">Atterrissage</div><div class="val">${(td.landingRateFpm ?? td.landingRate) != null ? (td.landingRateFpm ?? td.landingRate) + ' ft/min' : '—'}</div></div>
    <div class="tstat"><div class="cap">Rebonds</div><div class="val">${td.bounceCount ? td.bounceCount : 'Aucun'}</div></div>
    <div class="tstat"><div class="cap">Virage max</div><div class="val">${(td.turnStats && td.turnStats.maxBankDeg) ? td.turnStats.maxBankDeg + '°' : '—'}</div></div>
  `;

  const hasDetailed = Array.isArray(td.phases) && td.phases.length > 0;
  el('routeModalDetailed').classList.toggle('hidden', !hasDetailed);
  el('routeModalLegend').innerHTML = '';

  if(hasDetailed){
    // Légende des phases réellement présentes dans ce vol
    renderPhaseLegend(td.path, 'routeModalLegend');

    renderPhaseTable(td.phases);
    renderProfileChart(td.path);
    renderTouchdownPanel(td.touchdown, td.turnStats);
  }

  el('routeModalOverlay').classList.remove('hidden');
  setTimeout(() => {
    if(!modalMap && window.L){
      modalMap = L.map('routeModalMap', { attributionControl:true, zoomControl:true });
      darkTileLayer().addTo(modalMap);
      styleMapShell(modalMap);
    }
    modalPhaseLayers.forEach(l => modalMap.removeLayer(l));
    modalPhaseLayers = [];

    const addGlowLine = (pts, color, weight) => {
      modalPhaseLayers.push(L.polyline(pts, { color, weight: weight + 5, opacity:.16, className:'route-glow' }).addTo(modalMap));
      modalPhaseLayers.push(L.polyline(pts, { color, weight, opacity:.95 }).addTo(modalMap));
    };

    const path = td.path || [];
    if(hasDetailed){
      // Un segment de polyligne par sous-phase contiguë, coloré selon PHASE_META
      let current = null;
      path.forEach(p => {
        const ph = p.subPhase || p.phase;
        if(!current || current.phase !== ph){
          if(current && current.pts.length > 1) addGlowLine(current.pts, phaseMeta(current.phase).color, 3.5);
          current = { phase: ph, pts: [] };
        }
        current.pts.push([p.lat, p.lon]);
      });
      if(current && current.pts.length > 1) addGlowLine(current.pts, phaseMeta(current.phase).color, 3.5);
    } else {
      addGlowLine(path.map(p => [p.lat, p.lon]), '#54d6e8', 2.5);
    }

    if(td.touchdown){
      modalPhaseLayers.push(L.circleMarker([td.touchdown.lat, td.touchdown.lon], { radius:6, color:'#ff5c5c', weight:2, fillColor:'#ff5c5c', fillOpacity:.9 }).addTo(modalMap));
    }

    const allPts = path.map(p => [p.lat, p.lon]);
    if(allPts.length > 1){
      modalMap.fitBounds(L.latLngBounds(allPts), { padding:[24,24] });
    } else if(allPts.length === 1){
      modalMap.setView(allPts[0], 12);
    } else {
      modalMap.setView([46.6,2.4], 4);
    }
    modalMap.invalidateSize();
  }, 30);
}

function renderPhaseTable(phases, targetId){
  el(targetId || 'routeModalPhaseRows').innerHTML = phases.map(p => {
    const m = phaseMeta(p.phase);
    return `<tr>
      <td><span class="dot" style="background:${m.color}"></span></td>
      <td>${m.label}</td>
      <td>${fmtDuration(p.durationSec)}</td>
      <td>${p.distanceNm ? p.distanceNm + ' NM' : '—'}</td>
      <td>${p.minAltFt === p.maxAltFt ? p.maxAltFt + ' ft' : p.minAltFt + '–' + p.maxAltFt + ' ft'}</td>
      <td>${p.avgIasKt} kt / ${p.maxIasKt} kt</td>
    </tr>`;
  }).join('');
}

// Petit graphe altitude + vitesse en SVG pur (pas de dépendance de charting).
function renderProfileChart(path, targetId){
  const target = el(targetId || 'routeModalProfile');
  if(!path || path.length < 2){ target.innerHTML = ''; return; }
  const w = 860, h = 150, padL = 42, padR = 10, padT = 10, padB = 18;
  const plotW = w - padL - padR, plotH = h - padT - padB;
  const maxAlt = Math.max(1, ...path.map(p => p.altFt || 0));
  const maxIas = Math.max(1, ...path.map(p => p.iasKt || 0));
  const t0 = path[0].ts, t1 = path[path.length-1].ts || t0 + 1;
  const xAt = ts => padL + ((ts - t0) / (t1 - t0 || 1)) * plotW;
  const yAlt = a => padT + plotH - (a / maxAlt) * plotH;
  const yIas = s => padT + plotH - (s / maxIas) * plotH;

  const altPts = path.map(p => `${xAt(p.ts).toFixed(1)},${yAlt(p.altFt||0).toFixed(1)}`).join(' ');
  const iasPts = path.map(p => `${xAt(p.ts).toFixed(1)},${yIas(p.iasKt||0).toFixed(1)}`).join(' ');

  // Bandes de fond colorées par phase, pour situer visuellement le profil
  let bands = '';
  let segStart = 0;
  for(let i=1;i<=path.length;i++){
    const changed = i===path.length || (path[i].subPhase||path[i].phase) !== (path[segStart].subPhase||path[segStart].phase);
    if(changed){
      const x1 = xAt(path[segStart].ts), x2 = xAt(path[i-1].ts);
      const color = phaseMeta(path[segStart].subPhase||path[segStart].phase).color;
      bands += `<rect x="${x1.toFixed(1)}" y="${padT}" width="${Math.max(1,(x2-x1)).toFixed(1)}" height="${plotH}" fill="${color}" opacity="0.12"></rect>`;
      segStart = i;
    }
  }

  const svg = `<svg class="profile-chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    ${bands}
    <text class="axis-label" x="${padL}" y="${padT+8}">${Math.round(maxAlt).toLocaleString('fr-FR')} ft</text>
    <text class="axis-label" x="${padL}" y="${h-4}">0 ft</text>
    <polyline class="alt-line" points="${altPts}"></polyline>
    <polyline class="ias-line" points="${iasPts}"></polyline>
  </svg>
  <div class="profile-legend">
    <span><span class="swatch alt"></span>Altitude (max ${Math.round(maxAlt).toLocaleString('fr-FR')} ft)</span>
    <span><span class="swatch ias"></span>Vitesse IAS (max ${Math.round(maxIas)} kt)</span>
  </div>`;
  target.innerHTML = svg;
}

// Légende des phases réellement présentes dans un trajet donné — partagée par la
// modale du logbook et le rapport en direct de la page Briefing.
function renderPhaseLegend(path, targetId){
  const presentPhases = [...new Set((path || []).map(p => p.subPhase || p.phase).filter(Boolean))];
  el(targetId).innerHTML = presentPhases.map(p => {
    const m = phaseMeta(p);
    return `<span class="item"><span class="dot" style="background:${m.color}"></span>${m.label}</span>`;
  }).join('');
}

// Petit schéma de piste vue du dessus, avec le point de toucher des roues positionné
// à l'échelle (distance depuis le seuil + écart latéral) et le taux de descente (fpm).
function renderTouchdownPanel(touchdown, turnStats){
  const container = el('routeModalTouchdown');
  const turnsHtml = (turnStats && turnStats.totalTurns)
    ? `<div class="touchdown-stats" style="margin-top:10px;">
        <div class="tstat"><div class="cap">Virages effectués</div><div class="val">${turnStats.totalTurns}</div></div>
        <div class="tstat"><div class="cap">Inclinaison max</div><div class="val">${turnStats.maxBankDeg}°</div></div>
        <div class="tstat"><div class="cap">Virages serrés (&gt;30°)</div><div class="val">${turnStats.steepTurnCount}</div></div>
        <div class="tstat"><div class="cap">Virages engagés (&gt;45°)</div><div class="val">${turnStats.aggressiveTurnCount}</div></div>
      </div>`
    : '';
  if(!touchdown){
    container.innerHTML = '<div class="hint">Pas de donnée de toucher des roues pour ce vol.</div>' + turnsHtml;
    return;
  }
  const zone = touchdown.zone;
  const fpm = touchdown.vsFpm;
  let diagram = '';
  if(zone){
    const w = 320, h = 90, margin = 14;
    const usableW = w - margin*2;
    const xPos = margin + Math.min(1, zone.percentAlongRunway/100) * usableW;
    const lateralPx = Math.max(-22, Math.min(22, zone.lateralOffsetFt / 8));
    const yPos = h/2 + (zone.side === 'droite' ? lateralPx : -lateralPx);
    diagram = `<svg class="touchdown-diagram" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
      <rect x="${margin}" y="${h/2-16}" width="${usableW}" height="32" fill="rgba(255,255,255,.04)" stroke="var(--hairline)"></rect>
      <line x1="${margin}" y1="${h/2}" x2="${w-margin}" y2="${h/2}" stroke="var(--hairline)" stroke-dasharray="6 5"></line>
      <line x1="${margin}" y1="${h/2-16}" x2="${margin}" y2="${h/2+16}" stroke="var(--phosphor)" stroke-width="2"></line>
      <circle cx="${xPos.toFixed(1)}" cy="${yPos.toFixed(1)}" r="6" fill="#ff5c5c" stroke="#fff" stroke-width="1.5"></circle>
      <text x="${margin}" y="${h/2+30}" class="axis-label">${escapeHtml(zone.runway)}</text>
      <text x="${w-margin}" y="${h/2+30}" class="axis-label" text-anchor="end">${zone.lengthFt} ft</text>
    </svg>`;
  }
  container.innerHTML = `<div class="touchdown-panel">
    ${diagram}
    <div class="touchdown-stats">
      <div class="tstat"><div class="cap">Taux de descente (fpm)</div><div class="val">${fpm != null ? fpm + ' ft/min' : '—'}</div></div>
      <div class="tstat"><div class="cap">Piste identifiée</div><div class="val">${zone ? escapeHtml(zone.runway) : 'Non identifiée'}</div></div>
      <div class="tstat"><div class="cap">Distance depuis le seuil</div><div class="val">${zone ? zone.distanceFromThresholdFt + ' ft (' + zone.percentAlongRunway + '%)' : '—'}</div></div>
      <div class="tstat"><div class="cap">Écart latéral</div><div class="val">${zone ? zone.lateralOffsetFt + ' ft à ' + zone.side : '—'}</div></div>
    </div>
    ${turnsHtml}
  </div>`;
}

function closeRouteModal(){
  el('routeModalOverlay').classList.add('hidden');
}

/* =========================================================
   OUTILS (CALCULATEURS)
   ========================================================= */
function renderTds(){
  const solveFor = el('tdsSolveFor').value;
  const distEl = el('tdsDistance'), spdEl = el('tdsSpeed'), timeEl = el('tdsTime');
  distEl.readOnly = solveFor === 'distance';
  spdEl.readOnly = solveFor === 'speed';
  timeEl.readOnly = solveFor === 'time';
  [distEl, spdEl, timeEl].forEach(i => i.classList.toggle('tool-output', i.readOnly));

  const dist = parseFloat(distEl.value);
  const spd = parseFloat(spdEl.value);
  const timeMin = parseDurationToMin(timeEl.value.trim());
  const out = el('tdsResult');

  if(solveFor === 'time'){
    if(!(dist>0) || !(spd>0)){ out.innerHTML = 'Renseigne la distance et la vitesse sol.'; timeEl.value=''; return; }
    const min = (dist/spd)*60;
    timeEl.value = minToHhmm(min);
    out.innerHTML = `Durée estimée : <span class="hl">${minToHhmm(min)}</span> <span class="muted">(à ${spd} kt sur ${dist} NM)</span>`;
  } else if(solveFor === 'speed'){
    if(!(dist>0) || !(timeMin>0)){ out.innerHTML = 'Renseigne la distance et la durée.'; spdEl.value=''; return; }
    const speed = dist/(timeMin/60);
    spdEl.value = Math.round(speed*10)/10;
    out.innerHTML = `Vitesse sol nécessaire : <span class="hl">${Math.round(speed)} kt</span>`;
  } else {
    if(!(spd>0) || !(timeMin>0)){ out.innerHTML = 'Renseigne la vitesse et la durée.'; distEl.value=''; return; }
    const distance = spd*(timeMin/60);
    distEl.value = Math.round(distance*10)/10;
    out.innerHTML = `Distance parcourue : <span class="hl">${Math.round(distance*10)/10} NM</span>`;
  }
}

let fuelMode = 'endurance';
function setFuelMode(mode){
  fuelMode = mode;
  const btns = document.querySelectorAll('#fuelModeToggle button');
  btns.forEach(b => b.classList.remove('active-vfr','active-ifr'));
  if(mode === 'endurance') btns[0].classList.add('active-vfr'); else btns[1].classList.add('active-ifr');
  el('fuelOnboardField').classList.toggle('hidden', mode !== 'endurance');
  el('fuelDurationField').classList.toggle('hidden', mode !== 'required');
  renderFuel();
}
function renderFuel(){
  const flow = parseFloat(el('fuelFlow').value);
  const reserveMin = parseFloat(el('fuelReserve').value) || 0;
  const out = el('fuelResult');
  if(!(flow>0)){ out.innerHTML = 'Renseigne la consommation horaire.'; return; }

  if(fuelMode === 'endurance'){
    const onboard = parseFloat(el('fuelOnboard').value);
    if(!(onboard>0)){ out.innerHTML = 'Renseigne le carburant à bord.'; return; }
    const totalMin = (onboard/flow)*60;
    const usableMin = Math.max(0, totalMin - reserveMin);
    out.innerHTML = `Autonomie totale : <span class="hl">${minToHhmm(totalMin)}</span><br>
      Autonomie utilisable (réserve ${reserveMin} min déduite) : <span class="hl">${minToHhmm(usableMin)}</span>`;
  } else {
    const durationMin = parseDurationToMin(el('fuelDuration').value.trim());
    if(!(durationMin>0)){ out.innerHTML = 'Renseigne la durée de vol prévue.'; return; }
    const fuelFlight = flow * (durationMin/60);
    const fuelReserveQty = flow * (reserveMin/60);
    const fuelNeeded = fuelFlight + fuelReserveQty;
    out.innerHTML = `Carburant nécessaire (vol + réserve) : <span class="hl">${fuelNeeded.toFixed(1)}</span><br>
      <span class="muted">dont vol : ${fuelFlight.toFixed(1)} · réserve (${reserveMin} min) : ${fuelReserveQty.toFixed(1)}</span>`;
  }
}

function renderTod(){
  const cruise = parseFloat(el('todCruiseAlt').value);
  const target = parseFloat(el('todTargetAlt').value);
  const gs = parseFloat(el('todGs').value);
  const vs = parseFloat(el('todVs').value);
  const out = el('todResult');
  if(!(cruise>0) || isNaN(target) || cruise <= target){ out.innerHTML = "Renseigne une altitude de croisière supérieure à l'altitude cible."; return; }

  const altToLose = cruise - target;
  const dist3to1 = altToLose/1000*3;
  let html = `Distance avant descente (règle des 3) : <span class="hl">${dist3to1.toFixed(1)} NM</span> <span class="muted">avant l'altitude cible</span>`;
  if(gs>0 && dist3to1>0){
    const vsFor3to1 = altToLose/((dist3to1/gs)*60);
    html += `<br>Taux de descente pour tenir cette pente à ${gs} kt : <span class="hl">${Math.round(vsFor3to1)} ft/min</span>`;
  }
  if(vs>0){
    const timeMin = altToLose/vs;
    html += `<br>Avec un taux de ${vs} ft/min : durée de descente <span class="hl">${minToHhmm(timeMin)}</span>`;
    if(gs>0){
      const distFromVs = gs*(timeMin/60);
      html += `, soit <span class="hl">${distFromVs.toFixed(1)} NM</span> avant l'altitude cible.`;
    }
  }
  out.innerHTML = html;
}

function renderTas(){
  const ias = parseFloat(el('tasIas').value);
  const alt = parseFloat(el('tasAlt').value);
  const out = el('tasResult');
  if(!(ias>0)){ out.innerHTML = "Renseigne l'IAS."; return; }
  const tas = ias * (1 + 0.02 * ((alt||0)/1000));
  out.innerHTML = `TAS estimée : <span class="hl">${Math.round(tas)} kt</span> <span class="muted">(+${Math.round(tas-ias)} kt vs IAS)</span>`;
}

function attachToolsListeners(){
  ['tdsDistance','tdsSpeed','tdsTime'].forEach(id => el(id).addEventListener('input', renderTds));
  el('tdsSolveFor').addEventListener('change', renderTds);
  ['fuelFlow','fuelOnboard','fuelDuration','fuelReserve'].forEach(id => el(id).addEventListener('input', renderFuel));
  ['todCruiseAlt','todTargetAlt','todGs','todVs'].forEach(id => el(id).addEventListener('input', renderTod));
  ['tasIas','tasAlt'].forEach(id => el(id).addEventListener('input', renderTas));
  ['holdIc','holdHdg'].forEach(id => el(id).addEventListener('input', renderHold));
  el('patRwyHdg').addEventListener('input', renderPattern);
  el('convCategory').addEventListener('change', () => { populateConverterUnits(); el('convValueA').value = 1; runConverter('A'); });
  el('convValueA').addEventListener('input', () => runConverter('A'));
  el('convValueB').addEventListener('input', () => runConverter('B'));
  el('convUnitA').addEventListener('change', () => runConverter('A'));
  el('convUnitB').addEventListener('change', () => runConverter('A'));
  el('wxIcao').addEventListener('keydown', e => { if(e.key === 'Enter') fetchWx(); });
  setFuelMode('endurance');
  setHoldTurn('R');
  setPatTurn('L');
  populateConverterUnits();
  el('convValueA').value = 1;
  renderTds();
  renderTod();
  renderTas();
  runConverter('A');
}

/* ---------------- Entrée en hold (attente) ---------------- */
// Règle standard 70°/110°/180° (direct/teardrop/parallèle), cf. FAA AIM 5-3-8 / ENR 1.5.
function normAngle360(a){ return ((a % 360) + 360) % 360; }
function normAngle180(a){ let n = normAngle360(a); if(n > 180) n -= 360; return n; }

function setHoldTurn(dir){
  el('holdTurnToggle').dataset.dir = dir;
  document.querySelectorAll('#holdTurnToggle button').forEach((b,i) => {
    b.classList.remove('active-vfr','active-ifr');
    if((i===0 && dir==='R') || (i===1 && dir==='L')) b.classList.add(dir==='R' ? 'active-ifr':'active-vfr');
  });
  renderHold();
}

function renderHold(){
  const out = el('holdResult');
  const icRaw = parseFloat(el('holdIc').value), hRaw = parseFloat(el('holdHdg').value);
  if(isNaN(icRaw) || isNaN(hRaw)){
    out.innerHTML = "Renseigne le cap d'insertion et le cap actuel de l'avion.";
    el('holdDiagram').innerHTML = '';
    return;
  }
  const ic = normAngle360(icRaw), h = normAngle360(hRaw);
  const right = el('holdTurnToggle').dataset.dir !== 'L';
  const oc = normAngle360(ic + 180);
  const delta = normAngle180(h - oc);

  let sector, entryHeading = null;
  if(right){
    if(delta <= 0 && delta >= -70){ sector = 'teardrop'; entryHeading = normAngle360(oc - 30); }
    else if(delta > 0){ sector = 'direct'; }
    else { sector = 'parallel'; entryHeading = normAngle360(ic - 30); }
  } else {
    if(delta >= 0 && delta <= 70){ sector = 'teardrop'; entryHeading = normAngle360(oc + 30); }
    else if(delta < 0){ sector = 'direct'; }
    else { sector = 'parallel'; entryHeading = normAngle360(ic + 30); }
  }

  const turnWord = right ? 'à droite' : 'à gauche';
  const r0 = Math.round(ic), r1 = Math.round(oc);
  const labels = {
    direct: `<span class="hl">Entrée directe</span> — survole le fix et vire ${turnWord} directement pour rejoindre l'éloignement (${r1}°).`,
    teardrop: `<span class="hl">Entrée en teardrop</span> — au fix, prends le cap <span class="hl">${Math.round(entryHeading)}°</span> (30° depuis l'éloignement, côté protégé) pendant 1 min, puis vire ${turnWord} pour intercepter le cap d'insertion (${r0}°).`,
    parallel: `<span class="hl">Entrée parallèle</span> — au fix, prends le cap <span class="hl">${Math.round(entryHeading)}°</span> (parallèle à l'insertion, côté non protégé) pendant 1 min, puis vire ${turnWord} (plus de 180°) pour intercepter le cap d'insertion (${r0}°).`
  };
  out.innerHTML = labels[sector] + `<br><span class="muted">Éloignement (cap réciproque) : ${r1}°</span>`;
  renderHoldDiagram(ic, oc, h, right, sector);
}

function polarPt(cx, cy, r, angleDeg){
  const rad = angleDeg * Math.PI / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}
function arcPath(cx, cy, r, startDeg, endDeg){
  let span = normAngle360(endDeg - startDeg);
  if(span === 0) span = 360;
  const large = span > 180 ? 1 : 0;
  const p1 = polarPt(cx, cy, r, startDeg), p2 = polarPt(cx, cy, r, endDeg);
  return `M ${p1.x.toFixed(1)},${p1.y.toFixed(1)} A ${r},${r} 0 ${large} 1 ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
}

function renderHoldDiagram(ic, oc, h, right, sector){
  const cx = 100, cy = 100, rRing = 78;
  let td, dr, pa;
  if(right){ td = [oc - 70, oc]; dr = [oc, ic]; pa = [ic, oc - 70]; }
  else { td = [oc, oc + 70]; dr = [ic, oc]; pa = [oc + 70, ic]; }

  const seg = (range, color, key) => {
    const active = sector === key;
    return `<path d="${arcPath(cx, cy, rRing, normAngle360(range[0]), normAngle360(range[1]))}" stroke="${color}" stroke-width="${active ? 18 : 11}" fill="none" opacity="${active ? 1 : 0.32}"/>`;
  };

  const icPt = polarPt(cx, cy, 64, ic), ocPt = polarPt(cx, cy, 64, oc), hPt = polarPt(cx, cy, 58, h);
  const svg = `<svg viewBox="0 0 200 200" class="hold-diagram">
    <circle cx="${cx}" cy="${cy}" r="${rRing}" fill="none" stroke="var(--hairline)" stroke-width="1"/>
    ${seg(td, '#a06cf5', 'teardrop')}
    ${seg(dr, '#39e88f', 'direct')}
    ${seg(pa, '#54d6e8', 'parallel')}
    <line x1="${cx}" y1="${cy}" x2="${icPt.x.toFixed(1)}" y2="${icPt.y.toFixed(1)}" stroke="var(--text-primary)" stroke-width="1.5"/>
    <line x1="${cx}" y1="${cy}" x2="${ocPt.x.toFixed(1)}" y2="${ocPt.y.toFixed(1)}" stroke="var(--text-secondary)" stroke-width="1.5" stroke-dasharray="4 3"/>
    <text x="${icPt.x.toFixed(1)}" y="${(icPt.y + (icPt.y < cy ? -6 : 14)).toFixed(1)}" class="axis-label" text-anchor="middle">IN</text>
    <text x="${ocPt.x.toFixed(1)}" y="${(ocPt.y + (ocPt.y < cy ? -6 : 14)).toFixed(1)}" class="axis-label" text-anchor="middle">OUT</text>
    <line x1="${cx}" y1="${cy}" x2="${hPt.x.toFixed(1)}" y2="${hPt.y.toFixed(1)}" stroke="var(--mode-color)" stroke-width="2.5"/>
    <circle cx="${hPt.x.toFixed(1)}" cy="${hPt.y.toFixed(1)}" r="4" fill="var(--mode-color)"/>
    <text x="100" y="13" class="axis-label" text-anchor="middle">N</text>
  </svg>`;
  el('holdDiagram').innerHTML = svg;
}

/* ---------------- Tour de piste ---------------- */
function setPatTurn(dir){
  el('patTurnToggle').dataset.dir = dir;
  document.querySelectorAll('#patTurnToggle button').forEach((b,i) => {
    b.classList.remove('active-vfr','active-ifr');
    if((i===0 && dir==='L') || (i===1 && dir==='R')) b.classList.add(dir==='L' ? 'active-vfr':'active-ifr');
  });
  renderPattern();
}
function renderPattern(){
  const rh = parseFloat(el('patRwyHdg').value);
  const dir = el('patTurnToggle').dataset.dir || 'L';
  const s = dir === 'R' ? 1 : -1;
  if(isNaN(rh)){
    ['patCrosswind','patDownwind','patBase','patFinal'].forEach(id => el(id).textContent = '—');
    return;
  }
  el('patCrosswind').textContent = Math.round(normAngle360(rh + 90 * s)) + '°';
  el('patDownwind').textContent = Math.round(normAngle360(rh + 180)) + '°';
  el('patBase').textContent = Math.round(normAngle360(rh - 90 * s)) + '°';
  el('patFinal').textContent = Math.round(normAngle360(rh)) + '°';
}

/* ---------------- Convertisseur d'unités ---------------- */
// Chaque unité stocke son facteur vers l'unité de base de sa catégorie (valeur=1).
const converterUnits = {
  poids:    { units: { kg:1, lbs:0.45359237, t:1000 } },
  distance: { units: { m:1, km:1000, NM:1852, mi:1609.344, ft:0.3048 } },
  vitesse:  { units: { 'm/s':1, 'km/h':1/3.6, kt:0.514444, mph:0.44704 } },
  pression: { units: { hPa:1, inHg:33.8639, mmHg:1.333224, psi:68.94757 } }
};
function populateConverterUnits(){
  const units = Object.keys(converterUnits[el('convCategory').value].units);
  el('convUnitA').innerHTML = units.map(u => `<option value="${u}">${u}</option>`).join('');
  el('convUnitB').innerHTML = units.map(u => `<option value="${u}">${u}</option>`).join('');
  el('convUnitB').selectedIndex = units.length > 1 ? 1 : 0;
}
function convertValue(cat, value, fromUnit, toUnit){
  const units = converterUnits[cat].units;
  if(!(fromUnit in units) || !(toUnit in units) || isNaN(value)) return null;
  return (value * units[fromUnit]) / units[toUnit];
}
function runConverter(source){
  const cat = el('convCategory').value;
  const unitA = el('convUnitA').value, unitB = el('convUnitB').value;
  if(source === 'B'){
    const valB = parseFloat(el('convValueB').value);
    const result = convertValue(cat, valB, unitB, unitA);
    el('convValueA').value = (result == null || isNaN(result)) ? '' : Math.round(result * 100000) / 100000;
  } else {
    const valA = parseFloat(el('convValueA').value);
    const result = convertValue(cat, valA, unitA, unitB);
    el('convValueB').value = (result == null || isNaN(result)) ? '' : Math.round(result * 100000) / 100000;
  }
}

/* ---------------- METAR / TAF (aviationweather.gov, NOAA — public, sans clé) ---------------- */
const fltCatClass = { VFR:'ok', MVFR:'pending', IFR:'rejected', LIFR:'rejected' };
function fmtWxTime(epochSec){
  if(!epochSec) return null;
  return new Date(epochSec * 1000).toUTCString().replace(' GMT', '') + ' UTC';
}
async function fetchWx(){
  const icao = el('wxIcao').value.trim().toUpperCase();
  const statusEl = el('wxStatus');
  statusEl.className = 'status-msg';
  if(!/^[A-Z0-9]{4}$/.test(icao)){
    statusEl.textContent = 'Indique un code OACI à 4 caractères (ex : LFPG).';
    statusEl.classList.add('err');
    return;
  }
  statusEl.textContent = 'Récupération en cours…';
  el('wxResult').innerHTML = '';
  try{
    const [metarRes, tafRes] = await Promise.all([
      fetch(`https://aviationweather.gov/api/data/metar?ids=${icao}&format=json`),
      fetch(`https://aviationweather.gov/api/data/taf?ids=${icao}&format=json`)
    ]);
    const metars = metarRes.ok ? await metarRes.json() : [];
    const tafs = tafRes.ok ? await tafRes.json() : [];
    renderWx(icao, metars[0] || null, tafs[0] || null);
    if(!metars.length && !tafs.length){
      statusEl.textContent = "Aucune donnée pour ce code — vérifie qu'il s'agit bien d'un aéroport avec station météo publiée.";
      statusEl.classList.add('err');
    } else {
      statusEl.textContent = 'Données à jour (aviationweather.gov / NOAA).';
      statusEl.classList.add('ok');
    }
  }catch(err){
    statusEl.textContent = 'Échec de la récupération (connexion indisponible ou service injoignable).';
    statusEl.classList.add('err');
    el('wxResult').innerHTML = '';
  }
}
function renderWx(icao, metar, taf){
  let html = '';
  if(metar){
    const cat = metar.fltCat || '';
    const clouds = (metar.clouds || [])
      .map(c => c && c.base ? `${c.cover}${String(c.base).padStart(3,'0')}` : (c ? c.cover : null))
      .filter(Boolean).join(' ');
    const obsTime = fmtWxTime(metar.obsTime);
    html += `<div class="wx-block">
      <div class="wx-block-head">
        <span class="wx-icao">METAR ${escapeHtml(icao)}</span>
        ${cat ? `<span class="pill ${fltCatClass[cat] || 'pending'}">${escapeHtml(cat)}</span>` : ''}
        ${metar.name ? `<span class="muted">${escapeHtml(metar.name)}</span>` : ''}
      </div>
      <div class="wx-raw">${escapeHtml(metar.rawOb || '—')}</div>
      <div class="telemetry-grid" style="margin-top:8px;">
        <div class="tstat"><div class="cap">Vent</div><div class="val">${metar.wdir != null ? metar.wdir + '°' : '—'} / ${metar.wspd != null ? metar.wspd + ' kt' : '—'}</div></div>
        <div class="tstat"><div class="cap">Visibilité</div><div class="val">${metar.visib != null ? metar.visib + ' SM' : '—'}</div></div>
        <div class="tstat"><div class="cap">Temp. / Point de rosée</div><div class="val">${metar.temp != null ? metar.temp + '°C' : '—'} / ${metar.dewp != null ? metar.dewp + '°C' : '—'}</div></div>
        <div class="tstat"><div class="cap">QNH</div><div class="val">${metar.altim != null ? metar.altim + ' hPa' : '—'}</div></div>
        <div class="tstat"><div class="cap">Nuages</div><div class="val" style="font-size:13px;">${clouds || 'CLR / SKC'}</div></div>
        <div class="tstat"><div class="cap">Observé</div><div class="val" style="font-size:11px;">${obsTime || '—'}</div></div>
      </div>
    </div>`;
  } else {
    html += `<div class="wx-block"><div class="hint">Pas de METAR disponible pour ${escapeHtml(icao)}.</div></div>`;
  }
  if(taf){
    const raw = taf.rawTAF || taf.rawTaf || taf.raw_text || null;
    const from = fmtWxTime(taf.validTimeFrom), to = fmtWxTime(taf.validTimeTo);
    html += `<div class="wx-block" style="margin-top:14px;">
      <div class="wx-block-head"><span class="wx-icao">TAF ${escapeHtml(icao)}</span></div>
      <div class="wx-raw">${escapeHtml(raw || '—')}</div>
      ${from && to ? `<div class="hint" style="margin-top:6px;">Valide du ${from} au ${to}</div>` : ''}
    </div>`;
  } else {
    html += `<div class="wx-block" style="margin-top:14px;"><div class="hint">Pas de TAF disponible pour ${escapeHtml(icao)} (tous les aéroports n'en publient pas).</div></div>`;
  }
  el('wxResult').innerHTML = html;
}

/* =========================================================
   THEME / ADMIN
   ========================================================= */
const presetThemes = {
  cockpit: {
    label:'Cockpit Nuit', sub:'Thème par défaut, esthétique avionique',
    swatches:['#0a0d11','#12171c','#ffb020','#54d6e8'],
    theme: {...defaultTheme}
  },
  blueglass: {
    label:'Blue Glass — DA Stream', sub:'Calé sur ton overlay "Le stream va commencer"',
    swatches:['#080f1a','#111d30','#f5a623','#3b7fe8'],
    theme: {
      bg:'#080f1a', panel:'#111d30', text:'#ffffff', textSec:'#70747a',
      vfr:'#f5a623', ifr:'#3b7fe8',
      fontDisplay:"'Evogria','Space Grotesk',sans-serif", fontMono:"'JetBrains Mono',monospace", fontBody:"'Roboto',sans-serif",
      radius:18, glow:true,
      cardWidth:820, cardHeight:0, fontScale:100,
      showAircraft:true, showAltitude:true, showDuration:true,
      showWeather:true, showApproach:true, showNotes:true
    }
  }
};

function renderThemePresets(){
  el('themePresets').innerHTML = Object.entries(presetThemes).map(([key, p]) => `
    <div class="theme-preset-card" onclick="applyPreset('${key}')">
      <div class="swatch-row">${p.swatches.map(s => `<span class="swatch-dot" style="background:${s}"></span>`).join('')}</div>
      <div class="label">${p.label}</div>
      <div class="sub">${p.sub}</div>
    </div>`).join('');
}

async function applyPreset(key){
  const preset = presetThemes[key];
  if(!preset) return;
  db.theme = {...preset.theme};
  loadThemeIntoAdmin(db.theme);
  applyTheme(db.theme);
  await saveDbNow();
}

function applyTheme(t){
  const r = document.documentElement.style;
  r.setProperty('--cockpit-night', t.bg);
  r.setProperty('--panel-bezel', t.panel);
  r.setProperty('--panel-bezel-2', t.panel);
  r.setProperty('--text-primary', t.text);
  r.setProperty('--text-secondary', t.textSec);
  r.setProperty('--accent-vfr', t.vfr);
  r.setProperty('--accent-ifr', t.ifr);
  r.setProperty('--font-display', t.fontDisplay);
  r.setProperty('--font-mono', t.fontMono);
  r.setProperty('--font-body', t.fontBody);
  r.setProperty('--radius', t.radius + 'px');
  r.setProperty('--font-scale', (t.fontScale || 100) / 100);

  const card = el('card');
  card.style.width = (t.cardWidth || 820) + 'px';
  if(t.cardHeight && t.cardHeight > 0){
    card.style.height = t.cardHeight + 'px';
    card.style.overflow = 'hidden';
  } else {
    card.style.height = 'auto';
    card.style.overflow = 'visible';
  }

  card.classList.toggle('no-glow', !t.glow);
  card.classList.toggle('no-border', !t.cardBorder);
  card.classList.toggle('no-shadow', !t.cardShadow);
  card.classList.toggle('transparent-bg', !!t.cardTransparentBg);
  el('cardHeader').classList.toggle('align-center', t.headerAlign === 'center');
  el('tilesGrid').classList.toggle('cols-2', t.tileColumns === 2);
  const brand = el('brandTag');
  if(t.brandText && t.brandText.trim()){
    brand.textContent = t.brandText.trim();
    brand.classList.remove('hidden');
  } else {
    brand.classList.add('hidden');
  }

  el('tileAircraft').style.display = t.showAircraft ? '' : 'none';
  el('tileAltitude').style.display = t.showAltitude ? '' : 'none';
  el('tileDuration').style.display = t.showDuration ? '' : 'none';
  el('tileWeather').style.display = t.showWeather ? '' : 'none';
  el('tileApproach').style.display = t.showApproach ? '' : 'none';
  el('notesBar').style.display = t.showNotes ? '' : 'none';

  setFlightRules(state.rules);
}

function bindAdminControls(){
  const map = {
    thBg:'bg', thPanel:'panel', thText:'text', thTextSec:'textSec',
    thVfr:'vfr', thIfr:'ifr', thFontDisplay:'fontDisplay', thFontMono:'fontMono', thFontBody:'fontBody'
  };
  Object.entries(map).forEach(([elemId, key]) => {
    el(elemId).addEventListener('input', () => {
      db.theme[key] = el(elemId).value;
      applyTheme(db.theme);
      queueSaveDb();
    });
  });
  el('thWidth').addEventListener('input', () => {
    db.theme.cardWidth = parseInt(el('thWidth').value, 10) || defaultTheme.cardWidth;
    applyTheme(db.theme);
    queueSaveDb();
  });
  el('thHeight').addEventListener('input', () => {
    db.theme.cardHeight = parseInt(el('thHeight').value, 10) || 0;
    applyTheme(db.theme);
    queueSaveDb();
  });
  el('thFontScale').addEventListener('input', () => {
    db.theme.fontScale = parseInt(el('thFontScale').value, 10);
    el('thFontScaleVal').textContent = db.theme.fontScale + '%';
    updateRangeFill(el('thFontScale'));
    applyTheme(db.theme);
    queueSaveDb();
  });
  el('thRadius').addEventListener('input', () => {
    db.theme.radius = parseInt(el('thRadius').value, 10);
    el('thRadiusVal').textContent = db.theme.radius + 'px';
    updateRangeFill(el('thRadius'));
    applyTheme(db.theme);
    queueSaveDb();
  });
  const switches = { thGlow:'glow', thCardBorder:'cardBorder', thCardShadow:'cardShadow', thCardTransparentBg:'cardTransparentBg', thShowAircraft:'showAircraft', thShowAltitude:'showAltitude', thShowDuration:'showDuration', thShowApproach:'showApproach', thShowWeather:'showWeather', thShowNotes:'showNotes' };
  Object.entries(switches).forEach(([elemId, key]) => {
    el(elemId).addEventListener('change', () => {
      db.theme[key] = el(elemId).checked;
      applyTheme(db.theme);
      queueSaveDb();
    });
  });
  el('thBrandText').addEventListener('input', () => {
    db.theme.brandText = el('thBrandText').value;
    applyTheme(db.theme);
    queueSaveDb();
  });
}

function setHeaderAlign(align){
  db.theme.headerAlign = align;
  el('thHeaderAlignToggle').dataset.align = align;
  document.querySelectorAll('#thHeaderAlignToggle button').forEach((b,i) => {
    b.classList.remove('active-vfr','active-ifr');
    if((i===0 && align==='left') || (i===1 && align==='center')) b.classList.add('active-vfr');
  });
  applyTheme(db.theme);
  queueSaveDb();
}

function setTileColumns(cols){
  db.theme.tileColumns = cols;
  el('thTileColumnsToggle').dataset.cols = cols;
  document.querySelectorAll('#thTileColumnsToggle button').forEach((b,i) => {
    b.classList.remove('active-vfr','active-ifr');
    if((i===0 && cols===2) || (i===1 && cols===3)) b.classList.add('active-vfr');
  });
  applyTheme(db.theme);
  queueSaveDb();
}

function loadThemeIntoAdmin(t){
  el('thBg').value = t.bg; el('thPanel').value = t.panel; el('thText').value = t.text; el('thTextSec').value = t.textSec;
  el('thVfr').value = t.vfr; el('thIfr').value = t.ifr;
  el('thFontDisplay').value = t.fontDisplay; el('thFontMono').value = t.fontMono; el('thFontBody').value = t.fontBody;
  el('thWidth').value = t.cardWidth || 820;
  el('thHeight').value = t.cardHeight || 0;
  el('thFontScale').value = t.fontScale || 100; el('thFontScaleVal').textContent = (t.fontScale || 100) + '%';
  el('thRadius').value = t.radius; el('thRadiusVal').textContent = t.radius + 'px';
  updateRangeFill(el('thFontScale'));
  updateRangeFill(el('thRadius'));
  el('thGlow').checked = t.glow;
  el('thCardBorder').checked = t.cardBorder !== false;
  el('thCardShadow').checked = t.cardShadow !== false;
  el('thCardTransparentBg').checked = !!t.cardTransparentBg;
  el('thBrandText').value = t.brandText || '';
  el('thHeaderAlignToggle').dataset.align = t.headerAlign || 'left';
  document.querySelectorAll('#thHeaderAlignToggle button').forEach((b,i) => {
    b.classList.remove('active-vfr','active-ifr');
    if((i===0 && (t.headerAlign||'left')==='left') || (i===1 && t.headerAlign==='center')) b.classList.add('active-vfr');
  });
  el('thTileColumnsToggle').dataset.cols = t.tileColumns || 3;
  document.querySelectorAll('#thTileColumnsToggle button').forEach((b,i) => {
    b.classList.remove('active-vfr','active-ifr');
    if((i===0 && t.tileColumns===2) || (i===1 && (t.tileColumns||3)===3)) b.classList.add('active-vfr');
  });
  el('thShowAircraft').checked = t.showAircraft; el('thShowAltitude').checked = t.showAltitude; el('thShowDuration').checked = t.showDuration;
  el('thShowWeather').checked = t.showWeather; el('thShowApproach').checked = t.showApproach; el('thShowNotes').checked = t.showNotes;
}

async function resetTheme(){
  if(!confirm('Réinitialiser toutes les couleurs, polices et options de disposition ?')) return;
  db.theme = {...defaultTheme};
  loadThemeIntoAdmin(db.theme);
  applyTheme(db.theme);
  await saveDbNow();
}

/* =========================================================
   PROFIL UTILISATEUR & ONBOARDING PREMIER LANCEMENT
   ========================================================= */
function readUserProfileForm(prefix){
  return {
    firstName: el(prefix + 'FirstName').value.trim(),
    network: el(prefix + 'Network').value,
    vatsimId: el(prefix + 'VatsimId').value.trim(),
    ivaoId: el(prefix + 'IvaoId').value.trim(),
    twitchHandle: el(prefix + 'TwitchHandle').value.trim(),
    homeBase: el(prefix + 'HomeBase').value.trim().toUpperCase()
  };
}
function fillUserProfileForm(prefix, p){
  el(prefix + 'FirstName').value = p.firstName || '';
  el(prefix + 'Network').value = p.network || '';
  el(prefix + 'VatsimId').value = p.vatsimId || '';
  el(prefix + 'IvaoId').value = p.ivaoId || '';
  el(prefix + 'TwitchHandle').value = p.twitchHandle || '';
  el(prefix + 'HomeBase').value = p.homeBase || '';
}

// Affichée automatiquement au tout premier lancement (voir init()) : demande un
// minimum d'infos pour personnaliser l'appli, tout est facultatif et modifiable
// ensuite depuis l'onglet Profil.
function maybeShowOnboarding(){
  if(db.userProfile && db.userProfile.onboarded) return;
  el('onboardingModalOverlay').classList.remove('hidden');
}
async function completeOnboarding(startTourAfter){
  db.userProfile = {...db.userProfile, ...readUserProfileForm('ob'), onboarded:true};
  await saveDbNow();
  el('onboardingModalOverlay').classList.add('hidden');
  fillUserProfileForm('pf', db.userProfile);
  if(startTourAfter) startTour();
}

async function saveUserProfile(){
  db.userProfile = {...db.userProfile, ...readUserProfileForm('pf'), onboarded:true};
  await saveDbNow();
  const statusEl = el('pfStatus');
  statusEl.textContent = 'Profil enregistré ✓';
  statusEl.className = 'status-msg ok';
}

/* ---------------- Statistiques (calculées à partir du logbook) ---------------- */
function renderTopListFromCounts(targetId, counts, limit, accent){
  const entries = Object.entries(counts).filter(([k]) => k && k !== 'undefined').sort((a,b) => b[1]-a[1]).slice(0, limit);
  if(!entries.length){ el(targetId).innerHTML = '<div class="empty">Pas encore de données.</div>'; return; }
  const max = entries[0][1];
  const total = entries.reduce((s,[,c]) => s + c, 0);
  el(targetId).innerHTML = entries.map(([name,count], i) => `
    <div class="row${i === 0 ? ' top-rank' : ''}" style="--row-accent:${accent || 'var(--phosphor)'};">
      <span class="rank">${i+1}</span>
      <span class="name">${escapeHtml(name)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.round((count/max)*100)}%"></div></div>
      <span class="count">${count}<span class="pct">${Math.round((count/total)*100)}%</span></span>
    </div>`).join('');
}
function renderTopList(targetId, items, keyFn, limit, accent){
  const counts = {};
  items.forEach(it => {
    const k = keyFn(it);
    if(!k) return;
    counts[k] = (counts[k] || 0) + 1;
  });
  renderTopListFromCounts(targetId, counts, limit, accent);
}

function renderProfileStats(){
  const flights = db.logbook;
  el('pfStatFlights').textContent = flights.length;

  const totalMin = flights.reduce((s,f) => s + (f.durationMin || 0), 0);
  el('pfStatHours').textContent = (totalMin / 60).toFixed(1) + 'h';

  // Distance totale : cumule la distance réellement mesurée des vols trackés (les
  // vols saisis manuellement n'ont pas de trajet GPS, donc pas de distance connue).
  const totalDistance = flights.reduce((s,f) => s + ((f.trackData && f.trackData.distanceNm) || 0), 0);
  el('pfStatDistance').textContent = totalDistance ? Math.round(totalDistance).toLocaleString('fr-FR') + ' NM' : '0 NM';

  let longest = null;
  flights.forEach(f => { if(!longest || (f.durationMin || 0) > (longest.durationMin || 0)) longest = f; });
  el('pfStatLongest').textContent = longest ? `${longest.callsign || (longest.dep + '→' + longest.arr)} · ${minToHhmm(longest.durationMin || 0)}` : '—';

  el('pfStatAvgDuration').textContent = flights.length ? minToHhmm(Math.round(totalMin / flights.length)) : '—';

  const uniqueAirports = new Set();
  flights.forEach(f => { if(f.dep) uniqueAirports.add(f.dep); if(f.arr) uniqueAirports.add(f.arr); });
  el('pfStatAirportCount').textContent = uniqueAirports.size;

  const vfrCount = flights.filter(f => f.rules === 'VFR').length;
  const ifrCount = flights.filter(f => f.rules === 'IFR').length;
  const totalRules = vfrCount + ifrCount;
  const vfrPct = totalRules ? Math.round((vfrCount / totalRules) * 100) : 0;
  el('pfRulesFill').style.width = vfrPct + '%';
  el('pfRulesLabel').textContent = totalRules
    ? `${vfrPct}% VFR (${vfrCount}) · ${100 - vfrPct}% IFR (${ifrCount})`
    : 'Aucun vol enregistré pour l’instant.';

  renderTopList('pfTopAircraft', flights, f => f.aircraft, 5, 'var(--accent-ifr)');
  const airportCounts = {};
  flights.forEach(f => {
    if(f.dep) airportCounts[f.dep] = (airportCounts[f.dep] || 0) + 1;
    if(f.arr) airportCounts[f.arr] = (airportCounts[f.arr] || 0) + 1;
  });
  renderTopListFromCounts('pfTopAirports', airportCounts, 5, 'var(--accent-vfr)');
  renderTopList('pfTopNetworks', flights, f => f.network, 6, 'var(--phosphor)');

  const careerData = db.careers.map(c => ({
    name: c.name,
    hours: db.logbook.filter(f => f.careerId === c.id).reduce((s,f) => s + (f.durationMin || 0), 0) / 60
  })).sort((a,b) => b.hours - a.hours);
  if(!careerData.length){
    el('pfCareersSummary').innerHTML = '<div class="empty">Aucune carrière définie.</div>';
  } else {
    const maxH = Math.max(1, ...careerData.map(c => c.hours));
    const totalH = careerData.reduce((s,c) => s + c.hours, 0) || 1;
    el('pfCareersSummary').innerHTML = careerData.map((c, i) => `
      <div class="row${i === 0 ? ' top-rank' : ''}" style="--row-accent:var(--accent-ifr);">
        <span class="rank">${i+1}</span>
        <span class="name">${escapeHtml(c.name)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.round((c.hours/maxH)*100)}%"></div></div>
        <span class="count">${c.hours.toFixed(1)}h<span class="pct">${Math.round((c.hours/totalH)*100)}%</span></span>
      </div>`).join('');
  }
}

/* =========================================================
   PROFIL — globe 3D des vols déjà effectués (logbook)
   ========================================================= */
let flightsGlobeScene = null, flightsGlobeCamera = null, flightsGlobeRenderer = null, flightsGlobeControls = null;
let flightsGlobeGroup = null, flightsGlobeContentGroup = null, flightsGlobeRaycaster = null;
let _flightsGlobeMeshes = []; // arcs + points aéroports, pour le hover/click
let _flightsGlobeFilters = { rules: 'all', search: '', network: 'all' };
let _airportCoordCache = {}; // ICAO -> {icao,name,lat,lon,elevFt} | null, mémorisé entre 2 rendus
const GLOBE_RADIUS = 100;

// Conversion latitude/longitude -> position 3D sur la sphère (convention Three.js standard),
// réutilisée pour les points aéroports et les arcs de trajet.
function latLonToVector3(lat, lon, radius){
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -(radius * Math.sin(phi) * Math.cos(theta)),
    (radius * Math.cos(phi)),
    (radius * Math.sin(phi) * Math.sin(theta))
  );
}
function globePointerToNDC(evt, container){
  const rect = container.getBoundingClientRect();
  return {
    x: ((evt.clientX - rect.left) / rect.width) * 2 - 1,
    y: -((evt.clientY - rect.top) / rect.height) * 2 + 1
  };
}

let _flightsGlobeAutoRotate = true; // coupée dès que l'utilisateur clique/interagit avec le globe

function initFlightsGlobe(){
  if(flightsGlobeScene || !window.THREE) return;
  const container = el('flightsGlobe');
  if(!container) return;
  const w = container.clientWidth || 600, h = container.clientHeight || 480;

  flightsGlobeScene = new THREE.Scene();
  flightsGlobeCamera = new THREE.PerspectiveCamera(45, w / h, 0.1, 2000);
  flightsGlobeCamera.position.set(0, 0, 260);

  flightsGlobeRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  flightsGlobeRenderer.setSize(w, h);
  flightsGlobeRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  container.appendChild(flightsGlobeRenderer.domElement);

  // Éclairage léger pour donner un vrai relief 3D à la sphère (avant : matériau Basic
  // plat, sans ombrage, donc peu lisible en silhouette). Une lumière directionnelle fixe
  // (indépendante de la rotation, comme un "soleil" de studio) + un peu d'ambiante pour
  // ne jamais avoir de face totalement noire.
  flightsGlobeScene.add(new THREE.AmbientLight(0x8fb8c9, 0.55));
  const globeSun = new THREE.DirectionalLight(0xffffff, 1.1);
  globeSun.position.set(120, 90, 160);
  flightsGlobeScene.add(globeSun);

  flightsGlobeControls = new THREE.OrbitControls(flightsGlobeCamera, flightsGlobeRenderer.domElement);
  flightsGlobeControls.enableDamping = true;
  flightsGlobeControls.dampingFactor = 0.08;
  flightsGlobeControls.minDistance = 130;
  flightsGlobeControls.maxDistance = 520;
  flightsGlobeControls.rotateSpeed = 0.5;
  flightsGlobeControls.enablePan = false;
  // Dès que l'utilisateur commence à interagir (clic + glisser, molette, tactile), on coupe
  // la rotation automatique pour de bon — sinon elle continue de tourner sous les doigts de
  // l'utilisateur et se bat visuellement avec le drag manuel.
  flightsGlobeControls.addEventListener('start', () => { _flightsGlobeAutoRotate = false; });

  // Sphère sombre + maillage filaire façon HUD, cohérent avec l'esthétique sombre/cockpit
  // du reste de l'appli, complétée par le tracé des côtes (voir loadFlightsGlobeCoastlines)
  // pour que les continents restent reconnaissables sans recourir à une texture réaliste.
  flightsGlobeGroup = new THREE.Group();
  flightsGlobeGroup.add(new THREE.Mesh(
    new THREE.SphereGeometry(GLOBE_RADIUS - 0.6, 64, 48),
    // MeshPhong (et non plus Basic) pour que la sphère réagisse à l'éclairage ci-dessus —
    // donne un vrai dégradé jour/nuit qui aide à percevoir le relief/la rotation, plutôt
    // qu'une silhouette plate uniformément sombre.
    new THREE.MeshPhongMaterial({ color: 0x0d1620, emissive: 0x050a10, shininess: 4, transparent: true, opacity: .95 })
  ));
  flightsGlobeGroup.add(new THREE.Mesh(
    new THREE.SphereGeometry(GLOBE_RADIUS + 6, 32, 24),
    new THREE.MeshBasicMaterial({ color: 0x39e88f, transparent: true, opacity: .035, side: THREE.BackSide })
  ));
  flightsGlobeScene.add(flightsGlobeGroup);

  // Arcs de trajet + points aéroports, enfants du globe pour tourner avec lui.
  flightsGlobeContentGroup = new THREE.Group();
  flightsGlobeGroup.add(flightsGlobeContentGroup);

  loadFlightsGlobeCoastlines();
  addFlightsGlobeGraticule();

  flightsGlobeRaycaster = new THREE.Raycaster();
  flightsGlobeRaycaster.params.Line = { threshold: 2.2 }; // tolérance de survol des arcs (fins)

  container.addEventListener('mousemove', onFlightsGlobePointerMove);
  container.addEventListener('mouseleave', hideFlightsGlobeTooltip);
  // Clic (souris ou tactile) = arrêt définitif de la rotation automatique, même sans
  // glisser (ex. simple clic pour examiner le globe immobile).
  container.addEventListener('pointerdown', () => { _flightsGlobeAutoRotate = false; });
  window.addEventListener('resize', resizeFlightsGlobe);
  // Coupe aussi le rendu quand la fenêtre est réduite/masquée (ex. en arrière-plan pendant
  // qu'on vole/stream) : le globe n'est de toute façon visible que sur l'onglet Profil, pas
  // la peine de continuer à faire tourner le GPU pour rien.
  document.addEventListener('visibilitychange', () => {
    if(document.hidden) pauseFlightsGlobe();
    else if(el('view-profil') && el('view-profil').classList.contains('active')) resumeFlightsGlobe();
  });

  resumeFlightsGlobe();
}

// Charge une fois le tracé simplifié des côtes (renderer/data/coastlines.json, ~130 lignes
// dérivées de Natural Earth 110m, entièrement local/hors-ligne) et le dessine comme des
// lignes posées sur la sphère, dans le même esprit HUD filaire que le reste du globe —
// pour rendre les continents reconnaissables sans texture terrestre réaliste.
let _flightsGlobeCoastlinesLoaded = false;
async function loadFlightsGlobeCoastlines(){
  if(_flightsGlobeCoastlinesLoaded || !flightsGlobeGroup) return;
  _flightsGlobeCoastlinesLoaded = true;
  try{
    const res = await fetch('data/coastlines.json');
    const lines = await res.json();
    const coastR = GLOBE_RADIUS - 0.15;
    // Plus lumineux et plus opaque qu'avant (0x8fb8c9/.55) pour que les continents restent
    // lisibles même en rotation ou avec plusieurs arcs de trajet superposés par-dessus.
    const material = new THREE.LineBasicMaterial({ color: 0xcfe9f2, transparent: true, opacity: .8 });
    // Halo légèrement plus large et plus terne en dessous, pour un effet de "glow" qui
    // rattrape la finesse d'1 px des lignes WebGL (lineWidth n'est pas honoré sur la plupart
    // des GPU/ANGLE) sans avoir à recourir à un shader dédié.
    const glowMaterial = new THREE.LineBasicMaterial({ color: 0x54d6e8, transparent: true, opacity: .22 });
    const coastGroup = new THREE.Group();
    lines.forEach(line => {
      if(!Array.isArray(line) || line.length < 2) return;
      const points = line.map(([lon, lat]) => latLonToVector3(lat, lon, coastR));
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      coastGroup.add(new THREE.Line(geo, material));
      const glowPoints = line.map(([lon, lat]) => latLonToVector3(lat, lon, coastR - 0.35));
      coastGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(glowPoints), glowMaterial));
    });
    flightsGlobeGroup.add(coastGroup);
  }catch(e){ /* fichier de côtes indisponible -> globe filaire seul, sans bloquer le reste */ }
}

// Quadrillage latitude/longitude (tous les 30°, + équateur et méridien de Greenwich un peu
// plus marqués) : repère visuel pour situer un trajet/aéroport sur le globe, absent avant
// (seul le wireframe de la sphère donnait une notion très vague d'orientation).
function addFlightsGlobeGraticule(){
  if(!flightsGlobeGroup) return;
  const r = GLOBE_RADIUS + 0.05;
  const graticule = new THREE.Group();
  // Volontairement très discret : sert de repère d'orientation, pas de décor — trop marqué,
  // il rentre en concurrence visuelle avec les côtes et les arcs de trajet (retour terrain :
  // combiné à l'ancien maillage filaire de la sphère, l'effet "ballon de foot" rendait le
  // globe illisible). Un seul jeu de lignes, pas de doublon avec un wireframe de sphère.
  const normalMat = new THREE.LineBasicMaterial({ color: 0x3d6b7a, transparent: true, opacity: .1 });
  const majorMat = new THREE.LineBasicMaterial({ color: 0x54d6e8, transparent: true, opacity: .2 });

  // Parallèles (latitude constante)
  for(let lat = -60; lat <= 60; lat += 30){
    const pts = [];
    for(let lon = -180; lon <= 180; lon += 5) pts.push(latLonToVector3(lat, lon, r));
    graticule.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lat === 0 ? majorMat : normalMat));
  }
  // Méridiens (longitude constante)
  for(let lon = -180; lon < 180; lon += 30){
    const pts = [];
    for(let lat = -90; lat <= 90; lat += 5) pts.push(latLonToVector3(lat, lon, r));
    graticule.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lon === 0 ? majorMat : normalMat));
  }
  flightsGlobeGroup.add(graticule);
}

function resizeFlightsGlobe(){
  const container = el('flightsGlobe');
  if(!container || !flightsGlobeRenderer || !flightsGlobeCamera) return;
  const w = container.clientWidth || 600, h = container.clientHeight || 480;
  flightsGlobeCamera.aspect = w / h;
  flightsGlobeCamera.updateProjectionMatrix();
  flightsGlobeRenderer.setSize(w, h);
}

// Boucle de rendu du globe : ne tourne QUE pendant que l'onglet Profil est réellement affiché
// (et la fenêtre visible) — avant, elle continuait indéfiniment en arrière-plan dès la 1ère
// visite de l'onglet, consommant du GPU en continu (perte de FPS potentielle côté simu/stream,
// notamment sur un setup avec un seul GPU partagé entre MSFS et l'encodage OBS).
let _flightsGlobeAnimHandle = null;
function resumeFlightsGlobe(){
  if(_flightsGlobeAnimHandle || !flightsGlobeRenderer) return; // déjà en cours, ou pas encore initialisé
  animateFlightsGlobe();
}
function pauseFlightsGlobe(){
  if(_flightsGlobeAnimHandle){ cancelAnimationFrame(_flightsGlobeAnimHandle); _flightsGlobeAnimHandle = null; }
}

function animateFlightsGlobe(){
  _flightsGlobeAnimHandle = requestAnimationFrame(animateFlightsGlobe);
  if(flightsGlobeControls) flightsGlobeControls.update();
  if(flightsGlobeGroup && _flightsGlobeAutoRotate) flightsGlobeGroup.rotation.y += 0.0006; // légère rotation continue, coupée au 1er clic
  if(flightsGlobeRenderer && flightsGlobeScene && flightsGlobeCamera) flightsGlobeRenderer.render(flightsGlobeScene, flightsGlobeCamera);
}

function flightsGlobeColor(rules){
  return rules === 'VFR' ? 0xffb020 : 0x54d6e8; // mêmes teintes que --accent-vfr / --accent-ifr
}

// Filtre "tous les vols", "certains appareils/indicatifs" (recherche libre), "certain
// réseau" ou "certain type de vol" (IFR/VFR) — appliqué aux vols déjà enregistrés dans le logbook.
function filteredFlightsGlobeData(){
  const q = (_flightsGlobeFilters.search || '').trim().toUpperCase();
  return db.logbook.filter(f => {
    if(!f.dep || !f.arr) return false;
    if(_flightsGlobeFilters.rules !== 'all' && f.rules !== _flightsGlobeFilters.rules) return false;
    if(_flightsGlobeFilters.network !== 'all' && (f.network || '').trim() !== _flightsGlobeFilters.network) return false;
    if(q){
      const hay = `${f.callsign || ''} ${f.aircraft || ''}`.toUpperCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  });
}

// Résout les coordonnées de chaque OACI via l'index local (main process), avec cache
// mémoire pour éviter de refaire l'aller-retour IPC à chaque changement de filtre.
async function resolveAirportCoords(icaoList){
  const results = {};
  await Promise.all(icaoList.map(async icao => {
    if(_airportCoordCache[icao] !== undefined){ results[icao] = _airportCoordCache[icao]; return; }
    let info = null;
    try{ info = (window.api && window.api.lookupAirport) ? await window.api.lookupAirport(icao) : null; }
    catch(e){ info = null; }
    _airportCoordCache[icao] = info;
    results[icao] = info;
  }));
  return results;
}

// Arc de grand cercle stylisé : point milieu élevé au-dessus de la sphère (d'autant plus
// haut que la distance parcourue est grande), pour bien distinguer les trajets superposés.
function buildArcPoints(startLatLon, endLatLon, radius){
  const startVec = latLonToVector3(startLatLon.lat, startLatLon.lon, radius);
  const endVec = latLonToVector3(endLatLon.lat, endLatLon.lon, radius);
  const distance = startVec.distanceTo(endVec);
  const mid = startVec.clone().add(endVec).multiplyScalar(0.5);
  const bulge = radius * 0.15 + distance * 0.18;
  mid.normalize().multiplyScalar(radius + bulge);
  return new THREE.QuadraticBezierCurve3(startVec, mid, endVec).getPoints(48);
}

async function renderFlightsGlobeArcs(){
  if(!flightsGlobeContentGroup) return;
  const statusEl = el('fgStatusMsg');

  const flights = filteredFlightsGlobeData();
  if(!flights.length){
    while(flightsGlobeContentGroup.children.length){
      const m = flightsGlobeContentGroup.children.pop();
      if(m.geometry) m.geometry.dispose();
      if(m.material) m.material.dispose();
    }
    _flightsGlobeMeshes = [];
    if(statusEl){ statusEl.textContent = 'Aucun vol avec départ/arrivée renseignés ne correspond aux filtres actuels.'; statusEl.className = 'status-msg'; }
    return;
  }

  if(statusEl){ statusEl.textContent = 'Chargement des coordonnées aéroports…'; statusEl.className = 'status-msg'; }
  const icaos = Array.from(new Set(flights.flatMap(f => [f.dep, f.arr]).filter(Boolean).map(x => x.toUpperCase())));
  const coords = await resolveAirportCoords(icaos);

  // Nettoyage des arcs/points précédents (fait après la résolution des coordonnées pour
  // éviter un globe vide pendant le chargement lors d'un changement de filtre rapide).
  while(flightsGlobeContentGroup.children.length){
    const m = flightsGlobeContentGroup.children.pop();
    if(m.geometry) m.geometry.dispose();
    if(m.material) m.material.dispose();
  }
  _flightsGlobeMeshes = [];

  const airportUsage = {}; // ICAO -> { info, count }
  let arcsDrawn = 0;

  flights.forEach(f => {
    const dep = coords[(f.dep || '').toUpperCase()];
    const arr = coords[(f.arr || '').toUpperCase()];
    if(!dep || !arr) return;
    const points = buildArcPoints(dep, arr, GLOBE_RADIUS);
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: flightsGlobeColor(f.rules), transparent: true, opacity: .5 })
    );
    line.userData.flight = f;
    flightsGlobeContentGroup.add(line);
    _flightsGlobeMeshes.push(line);
    arcsDrawn++;

    [[f.dep, dep], [f.arr, arr]].forEach(([icao, info]) => {
      const key = icao.toUpperCase();
      if(!airportUsage[key]) airportUsage[key] = { info, count: 0, icao: key };
      airportUsage[key].count++;
    });
  });

  // Taille du point proportionnelle au nombre de vols (racine carrée pour un rapport de
  // taille raisonnable même entre l'aéroport de base et une escale visitée une fois) —
  // avant, tous les points faisaient la même taille, rendant les hubs peu visibles.
  const maxUsage = Math.max(1, ...Object.values(airportUsage).map(a => a.count));
  const dotMat = new THREE.MeshBasicMaterial({ color: 0x39e88f });
  Object.values(airportUsage).forEach(a => {
    const radius = 0.8 + Math.sqrt(a.count / maxUsage) * 1.6;
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 12), dotMat);
    mesh.position.copy(latLonToVector3(a.info.lat, a.info.lon, GLOBE_RADIUS + 1));
    mesh.userData.airport = a;
    flightsGlobeContentGroup.add(mesh);
    _flightsGlobeMeshes.push(mesh);
    // Halo discret pour les aéroports les plus fréquentés (hubs), qui ressortent
    // maintenant nettement au premier coup d'œil plutôt que de se fondre dans la masse.
    if(a.count / maxUsage > 0.5){
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(radius + 1.4, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0x39e88f, transparent: true, opacity: .18 })
      );
      halo.position.copy(mesh.position);
      // Pas ajouté à _flightsGlobeMeshes : purement décoratif, ne doit pas interférer avec
      // le raycast de survol (qui doit toujours cibler le point plein en priorité).
      flightsGlobeContentGroup.add(halo);
    }
  });

  if(statusEl){
    const airportCount = Object.keys(airportUsage).length;
    statusEl.textContent = arcsDrawn
      ? `${arcsDrawn} vol${arcsDrawn > 1 ? 's' : ''} affiché${arcsDrawn > 1 ? 's' : ''} sur ${airportCount} aéroport${airportCount > 1 ? 's' : ''}.`
      : "Aucun des vols filtrés n'a pu être placé sur le globe (aéroport introuvable dans l'index local).";
    statusEl.className = 'status-msg';
  }
}

function setFlightsGlobeRulesFilter(rules){
  _flightsGlobeFilters.rules = rules;
  el('fgRulesToggle').dataset.rules = rules;
  const order = ['all', 'IFR', 'VFR'];
  document.querySelectorAll('#fgRulesToggle button').forEach((b, i) => {
    b.classList.remove('active-vfr', 'active-ifr');
    if(order[i] === rules) b.classList.add(rules === 'VFR' ? 'active-vfr' : 'active-ifr');
  });
  renderFlightsGlobeArcs();
}

// Liste des réseaux réellement présents dans le logbook (VATSIM, IVAO, Solo, etc.),
// reconstruite à chaque affichage de l'onglet pour rester à jour.
function populateFlightsGlobeNetworkFilter(){
  const sel = el('fgNetwork');
  if(!sel) return;
  const current = sel.value || 'all';
  const networks = Array.from(new Set(db.logbook.map(f => (f.network || '').trim()).filter(Boolean))).sort();
  sel.innerHTML = '<option value="all">Tous les réseaux</option>' + networks.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
  sel.value = networks.includes(current) ? current : 'all';
  _flightsGlobeFilters.network = sel.value;
}

function onFlightsGlobePointerMove(evt){
  if(!flightsGlobeRaycaster || !flightsGlobeCamera || !_flightsGlobeMeshes.length){ hideFlightsGlobeTooltip(); return; }
  const container = el('flightsGlobe');
  const ndc = globePointerToNDC(evt, container);
  flightsGlobeRaycaster.setFromCamera(ndc, flightsGlobeCamera);
  const hits = flightsGlobeRaycaster.intersectObjects(_flightsGlobeMeshes);
  if(hits.length){
    const obj = hits[0].object;
    if(obj.userData.flight) showFlightsGlobeFlightTooltip(obj.userData.flight, evt, container);
    else if(obj.userData.airport) showFlightsGlobeAirportTooltip(obj.userData.airport, evt, container);
    container.style.cursor = 'pointer';
  } else {
    hideFlightsGlobeTooltip();
    container.style.cursor = 'grab';
  }
}

function showFlightsGlobeFlightTooltip(f, evt, container){
  const tip = el('fgTooltip');
  if(!tip) return;
  const rect = container.getBoundingClientRect();
  tip.style.left = (evt.clientX - rect.left) + 'px';
  tip.style.top = (evt.clientY - rect.top) + 'px';
  tip.innerHTML = `
    <div class="tt-title ${f.rules === 'VFR' ? 'vfr' : 'ifr'}">${escapeHtml(f.callsign || '—')}</div>
    <div class="tt-line">${escapeHtml(f.dep)} → ${escapeHtml(f.arr)}</div>
    <div class="tt-line">${escapeHtml(f.aircraft || '—')} · ${f.rules || '—'}</div>
    <div class="tt-line">${escapeHtml(f.date || '—')} · ${minToHhmm(f.durationMin || 0)}${f.network ? ' · ' + escapeHtml(f.network) : ''}</div>
  `;
  tip.classList.remove('hidden');
}
function showFlightsGlobeAirportTooltip(a, evt, container){
  const tip = el('fgTooltip');
  if(!tip) return;
  const rect = container.getBoundingClientRect();
  tip.style.left = (evt.clientX - rect.left) + 'px';
  tip.style.top = (evt.clientY - rect.top) + 'px';
  tip.innerHTML = `
    <div class="tt-title">${escapeHtml(a.icao)}</div>
    <div class="tt-line">${escapeHtml((a.info && a.info.name) || '')}</div>
    <div class="tt-line">${a.count} vol${a.count > 1 ? 's' : ''} départ/arrivée</div>
  `;
  tip.classList.remove('hidden');
}
function hideFlightsGlobeTooltip(){
  const tip = el('fgTooltip');
  if(tip) tip.classList.add('hidden');
}

function bindFlightsGlobeControls(){
  const search = el('fgSearch');
  if(search){
    search.addEventListener('input', debounce(() => {
      _flightsGlobeFilters.search = search.value;
      renderFlightsGlobeArcs();
    }, 200));
  }
  const network = el('fgNetwork');
  if(network){
    network.addEventListener('change', () => {
      _flightsGlobeFilters.network = network.value;
      renderFlightsGlobeArcs();
    });
  }
}

/* =========================================================
   VISITE GUIDÉE
   ========================================================= */
const TOUR_STEPS = [
  { target: null, title: 'Bienvenue dans FlightBrief 👋', text: "Un tour rapide de l'application pour te repérer. Tu peux passer à tout moment, et la relancer plus tard depuis l'onglet Profil." },
  { target: '[data-view="briefing"]', title: 'Briefing', text: 'Prépare ton vol ici : import SimBrief, réglages du plan de vol, connexion à ton simulateur, carte et télémétrie en direct.' },
  { target: '[data-view="logbook"]', title: 'Logbook', text: "L'historique de tous tes vols, avec les statistiques et le détail de chaque trajet tracké." },
  { target: '[data-view="career"]', title: 'Carrière', text: 'Suis ta progression de grade au sein de tes compagnies virtuelles, et gère tes tours.' },
  { target: '[data-view="livetool"]', title: 'Outil Live', text: "La carte OBS de ton briefing, et un overlay Twitch entièrement personnalisable pour afficher ta télémétrie en direct." },
  { target: '[data-view="tools"]', title: 'Outils', text: 'Des calculateurs de vol rapides : temps/distance/vitesse, carburant, top of descent, entrée en hold, METAR/TAF...' },
  { target: '[data-view="admin"]', title: 'Admin', text: "Personnalise entièrement l'apparence de la carte de briefing OBS : couleurs, polices, disposition." },
  { target: '[data-view="profil"]', title: 'Profil', text: "Ton identité pilote, toutes tes statistiques de vol, et un globe 3D de tous tes trajets déjà effectués. Tu peux relancer cette visite ici à tout moment." }
];
let _tourIndex = 0;

function startTour(){
  _tourIndex = 0;
  el('onboardingModalOverlay').classList.add('hidden');
  el('tourSpotlight').classList.remove('hidden');
  el('tourTooltip').classList.remove('hidden');
  renderTourStep();
  window.addEventListener('resize', _tourResizeHandler);
}
function _tourResizeHandler(){
  if(!el('tourTooltip').classList.contains('hidden')) renderTourStep();
}

function renderTourStep(){
  const step = TOUR_STEPS[_tourIndex];
  el('tourStepLabel').textContent = `Étape ${_tourIndex + 1}/${TOUR_STEPS.length}`;
  el('tourTitle').textContent = step.title;
  el('tourText').textContent = step.text;
  el('tourPrevBtn').style.visibility = _tourIndex === 0 ? 'hidden' : 'visible';
  el('tourNextBtn').textContent = _tourIndex === TOUR_STEPS.length - 1 ? 'Terminer' : 'Suivant';

  const spotlight = el('tourSpotlight');
  const tooltip = el('tourTooltip');
  const targetEl = step.target ? document.querySelector(step.target) : null;

  if(targetEl){
    const r = targetEl.getBoundingClientRect();
    const pad = 8;
    spotlight.style.top = (r.top - pad) + 'px';
    spotlight.style.left = (r.left - pad) + 'px';
    spotlight.style.width = (r.width + pad * 2) + 'px';
    spotlight.style.height = (r.height + pad * 2) + 'px';
    spotlight.classList.remove('hidden');

    const tooltipW = 300;
    let top = r.bottom + 14;
    let left = Math.min(Math.max(12, r.left), window.innerWidth - tooltipW - 12);
    if(top + 220 > window.innerHeight) top = Math.max(12, r.top - 210);
    tooltip.style.top = top + 'px';
    tooltip.style.left = left + 'px';
    tooltip.style.transform = 'none';
  } else {
    spotlight.classList.add('hidden');
    tooltip.style.top = '42%';
    tooltip.style.left = '50%';
    tooltip.style.transform = 'translate(-50%, -50%)';
  }
}

function tourNext(){
  if(_tourIndex >= TOUR_STEPS.length - 1){ endTour(); return; }
  _tourIndex++;
  renderTourStep();
}
function tourPrev(){
  if(_tourIndex === 0) return;
  _tourIndex--;
  renderTourStep();
}
function tourSkip(){ endTour(); }

async function endTour(){
  el('tourSpotlight').classList.add('hidden');
  el('tourTooltip').classList.add('hidden');
  window.removeEventListener('resize', _tourResizeHandler);
  db.userProfile.tourDone = true;
  db.userProfile.onboarded = true;
  await saveDbNow();
}

/* =========================================================
   INIT
   ========================================================= */
(async function init(){
  await loadDb();
  await initTitlebar();
  attachLiveInputs();
  setFlightRules('VFR');
  render();
  setLbRules('VFR');
  el('lbDate').value = new Date().toISOString().slice(0,10);
  populateCareerSelect();
  renderLogbook();
  renderCareers();
  loadThemeIntoAdmin(db.theme);
  applyTheme(db.theme);
  bindAdminControls();
  renderThemePresets();
  initTrackerListeners();
  initTrackMap();
  updateBriefingSaveVisibility();
  bindFlightsGlobeControls();
  attachToolsListeners();
  el('sbUsername').value = db.simbriefUsername || '';
  el('sbUsername').addEventListener('change', async () => {
    db.simbriefUsername = el('sbUsername').value.trim();
    await saveDbNow();
  });
  await initObsLink();
  initObsServerErrorListener();
  loadLiveOverlayIntoForm(db.liveOverlay);
  bindLiveOverlayControls();
  renderLiveOverlayPreview();
  pushLiveOverlayConfig();
  await initLiveOverlayLink();
  initLiveOverlayServerErrorListener();
  if(window.api && window.api.getDataPath){
    el('dataPathDisplay').value = await window.api.getDataPath();
  }
  maybeShowOnboarding();
})();
