/* =========================================================
   FlightBrief — compagnon mobile (lecture seule)
   ---------------------------------------------------------
   Lit /api/data sur le PC (serveur local, voir server.js) avec le jeton présent dans
   l'URL, puis affiche logbook / carrières & tours / hangar / profil. Les calculs de
   stats viennent de fb-shared.js, partagé avec l'appli de bureau.
   ========================================================= */
'use strict';
const F = window.FBShared;
const CARTO_KEY = 'cb1_2im1_1_fa460d4190b921c1db2ac2f8';
// Jeton d'accès : dans l'URL (QR code / icône installée), mémorisé pour les ouvertures suivantes.
const TOKEN_KEY = 'fb-mobile-token';
let TOKEN = new URLSearchParams(location.search).get('t') || '';
try{ if(TOKEN) localStorage.setItem(TOKEN_KEY, TOKEN); else TOKEN = localStorage.getItem(TOKEN_KEY) || ''; }catch(e){}

let DATA = null;          // dernière copie des données (reçue du PC, puis conservée sur le téléphone)
let lastOkAt = null;      // date de la dernière synchro réussie
let online = false;       // le PC a répondu à la dernière tentative
let linkExpired = false;  // le PC a refusé le jeton (nouveau lien généré sur le PC)
let syncing = false;
let refreshTimer = null;
let _assignCache = null;  // association vols <-> hangar (recalculée à chaque nouvelle donnée)
let _maps = {};           // cartes Leaflet actives, par emplacement
let _lb = { search: '', filter: 'all' };

const PHASE_LABELS = {
  taxi_out:'Roulage (départ)', liftoff:'Décollage', initial_climb:'Montée initiale', climb:'Montée', cruise:'Croisière',
  descent:'Descente', approach:'Approche', final_approach:'Approche finale', touchdown:'Toucher des roues', taxi_in:'Roulage (arrivée)',
  idle:'—', ground:'Au sol', airborne:'En vol', landed:'Atterri'
};
const MONTHS = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];

/* ---------------- Utilitaires ---------------- */
const $ = id => document.getElementById(id);
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function lookup(icao){
  const a = DATA && DATA.airports && DATA.airports[String(icao || '').toUpperCase()];
  return a ? { lat: a[0], lon: a[1], name: a[2] } : null;
}
function fmtTime(iso){
  if(!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
}
// cat : catégorie d'avion (échelle de toucher propre à light/medium/heavy/jumbo).
function gradeHtml(fpm, cat){
  if(fpm == null) return '—';
  const g = F.landingGrade(fpm, cat);
  return `<i class="gdot" style="background:${g.color}"></i>${F.fmtFpm(fpm)}`;
}
function tile(k, v){ return `<div class="tile"><div class="k">${k}</div><div class="v">${v}</div></div>`; }
function stat(k, v, accent){ return `<div class="stat" style="--accent:${accent || 'var(--phosphor)'}"><div class="k">${k}</div><div class="v">${v}</div></div>`; }
function assign(){
  if(!_assignCache) _assignCache = F.assignFlightsToHangar(DATA.hangar || [], DATA.logbook || []);
  return _assignCache;
}
// Catégorie d'un vol = celle de l'avion du hangar associé (échelle de toucher).
F.setFlightCategoryResolver(f => { const ac = DATA && hangarOf(f); return ac ? ac.category || null : null; });
function hangarOf(f){
  const a = assign();
  for(const ac of (DATA.hangar || [])) if(a[ac.id].flights.includes(f)) return ac;
  return null;
}

/* ---------------- Copie locale sur le téléphone (IndexedDB) ----------------
   IndexedDB plutôt que localStorage : pas de plafond à 5 Mo (logbook + tracés GPS), et
   les données d'une appli installée sur l'écran d'accueil ne sont pas purgées par iOS. */
const IDB_NAME = 'flightbrief-mobile', IDB_STORE = 'kv';
let _idb = null;
function idbOpen(){
  if(_idb) return _idb;
  _idb = new Promise((resolve, reject) => {
    const r = indexedDB.open(IDB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(IDB_STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  return _idb;
}
async function idbGet(key){
  const db = await idbOpen();
  return new Promise((resolve, reject) => { const q = db.transaction(IDB_STORE).objectStore(IDB_STORE).get(key); q.onsuccess = () => resolve(q.result); q.onerror = () => reject(q.error); });
}
async function idbSet(key, value){
  const db = await idbOpen();
  return new Promise((resolve, reject) => { const tx = db.transaction(IDB_STORE, 'readwrite'); tx.objectStore(IDB_STORE).put(value, key); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
}
async function loadCache(){
  try{
    const c = await idbGet('snapshot');
    if(c && c.data){ DATA = c.data; lastOkAt = c.savedAt; return true; }
  }catch(e){}
  try{ // ancienne version (v1.3.0) : copie dans localStorage
    const c = JSON.parse(localStorage.getItem('fb-mobile-cache-v1') || 'null');
    if(c && c.data){ DATA = c.data; lastOkAt = c.savedAt; return true; }
  }catch(e){}
  return false;
}
async function saveCache(){
  try{ await idbSet('snapshot', { savedAt: lastOkAt, data: DATA }); }catch(e){}
  try{ localStorage.removeItem('fb-mobile-cache-v1'); }catch(e){}
}

/* ---------------- Synchronisation avec le PC ---------------- */
function relTime(iso){
  if(!iso) return 'jamais';
  const d = new Date(iso), min = Math.round((Date.now() - d) / 60000);
  if(min < 1) return "à l'instant";
  if(min < 60) return `il y a ${min} min`;
  if(min < 12 * 60) return `il y a ${Math.round(min / 60)} h`;
  return `le ${d.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit' })} à ${fmtTime(iso)}`;
}
function setSync(kind){
  const pill = $('syncPill'), txt = $('syncText');
  pill.className = 'sync-pill ' + kind;
  txt.textContent = kind === 'loading' ? 'Synchro…'
    : kind === 'ok' ? 'À jour · ' + fmtTime(lastOkAt)
    : '↻ Synchroniser';
}
function renderSyncNotice(){
  const box = $('syncNotice');
  if(!box) return;
  if(!DATA || (online && !linkExpired)){ box.innerHTML = ''; return; }
  box.innerHTML = linkExpired
    ? `<div class="sync-notice warn">Ce téléphone n'est plus autorisé à synchroniser (nouveau lien généré sur le PC). Rescanne le QR code dans <b>Admin → Application mobile</b>, puis réinstalle l'icône sur l'écran d'accueil. Tes données restent consultables en attendant.</div>`
    : `<div class="sync-notice"><span>Hors ligne — données du PC synchronisées <b>${esc(relTime(lastOkAt))}</b>.</span><button onclick="syncNow(true)">Synchroniser</button></div>`;
}
let _toastTimer = null;
function toast(text, kind){
  const t = $('toast');
  if(!t) return;
  t.textContent = text;
  t.className = 'toast show ' + (kind || '');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { t.className = 'toast'; }, 3800);
}
function scheduleRefresh(){
  clearTimeout(refreshTimer);
  // On ne sonde le PC en continu QUE s'il vient de répondre (même Wi-Fi) : hors de chez
  // soi, aucune requête inutile tant que l'utilisateur ne touche pas "Synchroniser".
  if(!online || linkExpired) return;
  const delay = DATA && DATA.live ? 5000 : 30000; // plus fréquent pendant un vol en cours
  refreshTimer = setTimeout(() => { if(!document.hidden) syncNow(false); else scheduleRefresh(); }, delay);
}
async function syncNow(manual){
  if(!TOKEN){ if(!DATA) showGate('notoken'); return; }
  if(syncing) return;
  syncing = true;
  setSync('loading');
  try{
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), manual ? 9000 : 4500);
    const res = await fetch('/api/data?t=' + encodeURIComponent(TOKEN), { cache: 'no-store', signal: ctrl.signal });
    clearTimeout(to);
    if(res.status === 401){
      linkExpired = true; online = false; setSync('off');
      if(!DATA) showGate('expired');
      else if(manual) toast('Lien refusé par le PC : rescanne le QR code.', 'err');
      return;
    }
    if(!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    const changed = !DATA || json.dataUpdatedAt !== DATA.dataUpdatedAt || json.appVersion !== DATA.appVersion;
    const wasGate = !DATA;
    DATA = json;
    lastOkAt = new Date().toISOString();
    online = true; linkExpired = false;
    setSync('ok');
    await saveCache(); // toujours : met à jour la date de dernière synchro
    if(changed || manual || wasGate){ _assignCache = null; renderAll(); }
    renderLive();
    if(!(changed || manual || wasGate) && $('view-profile').classList.contains('active')) renderProfile();
    if(manual) toast(`Synchronisé ✓ — ${(DATA.logbook || []).length} vols`, 'ok');
  }catch(e){
    online = false;
    setSync('off');
    if(!DATA) showGate('firstsync');
    else if(manual) toast('PC injoignable : connecte-toi au même Wi-Fi que ton PC, avec FlightBrief ouvert.', 'err');
  }finally{
    syncing = false;
    renderSyncNotice();
    scheduleRefresh();
  }
}
// Compatibilité avec l'ancien nom (bouton de la barre du haut).
function refreshData(manual){ return syncNow(manual); }
document.addEventListener('visibilitychange', () => { if(!document.hidden) syncNow(false); });

/* ---------------- Écran d'accueil sans données (lien invalide / jamais synchronisé) ---------------- */
function showGate(kind){
  const msgs = {
    notoken: ['Ouvre le lien depuis ton PC', "Dans FlightBrief sur ton PC : onglet <b>Admin → Application mobile</b>, active l'accès puis scanne le QR code avec ce téléphone."],
    expired: ['Ce lien n\'est plus valide', "Un nouveau lien a été généré sur ton PC. Rescanne le QR code affiché dans <b>Admin → Application mobile</b>, puis réinstalle l'icône sur l'écran d'accueil."],
    firstsync: ['Première synchronisation', "Pour récupérer ton logbook, ce téléphone doit être sur le <b>même Wi-Fi</b> que ton PC, avec FlightBrief ouvert et l'accès mobile activé. Ensuite, il reste consultable partout, même hors ligne."]
  };
  const [title, text] = msgs[kind] || msgs.firstsync;
  $('gate').innerHTML = `<div class="gate"><img src="/icon-192.png" alt=""><h1>${title}</h1><p>${text}</p>
    ${kind === 'firstsync' ? '<button class="btn" onclick="syncNow(true)">Réessayer</button>' : ''}</div>`;
  $('gate').classList.remove('hidden');
  $('appMain').classList.add('hidden');
  $('tabbar').classList.add('hidden');
  setSync('off');
}
function hideGate(){
  $('gate').classList.add('hidden');
  $('appMain').classList.remove('hidden');
  $('tabbar').classList.remove('hidden');
}

/* ---------------- Navigation (onglets + écrans de détail via l'ancre #) ---------------- */
// Profondeur de navigation interne : nombre d'écrans de détail ouverts par l'appli
// elle-même (et donc qu'un history.back() peut refermer sans quitter l'appli).
let _navDepth = 0;
function go(hash){
  const [kind] = String(hash).split('/');
  if(['logbook','career','live','hangar','profile'].includes(kind)) _navDepth = 0; else _navDepth++;
  location.hash = hash;
}
// Bouton « Retour » des écrans de détail.
// Il ne dépend PLUS uniquement de history.back() : en appli installée (iOS/Android),
// l'historique peut être vide ou « gelé » — typiquement quand l'appli a été rouverte
// hors ligne, PC éteint, directement sur un écran de détail restauré. history.back()
// ne fait alors rien et l'écran reste bloqué. On tente l'historique, et si la page n'a
// pas changé d'ancre dans les 300 ms, on referme nous-mêmes l'écran.
function sheetBack(){
  const before = location.hash;
  if(_navDepth > 0){
    _navDepth--;
    history.back();
    setTimeout(() => { if(location.hash === before) closeToTab(); }, 300);
  } else closeToTab();
}
function closeToTab(){
  _navDepth = 0;
  history.replaceState(null, '', location.pathname + location.search + '#' + _lastTab);
  route();
}
function switchTab(tab){
  document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('main .view').forEach(v => v.classList.toggle('active', v.id === 'view-' + tab));
  if(tab === 'profile') setTimeout(drawProfileMap, 30);
  if(tab === 'live') startLiveView(); else stopLiveView();
  // Le bandeau « vol en cours » est inutile sur l'onglet En vol lui-même.
  $('liveSlot').classList.toggle('hidden', tab === 'live');
  $('appMain').scrollTop = 0;
}
$('tabbar').addEventListener('click', e => {
  const b = e.target.closest('button[data-tab]');
  if(!b) return;
  history.replaceState(null, '', location.pathname + location.search + '#' + b.dataset.tab);
  route();
});
let _lastTab = 'logbook';
function route(){
  if(!DATA) return;
  const [kind, a, b] = decodeURIComponent(location.hash.slice(1)).split('/');
  if(!kind || ['logbook','career','live','hangar','profile'].includes(kind)){
    closeSheet();
    _lastTab = kind || _lastTab;
    switchTab(_lastTab);
    return;
  }
  if(kind === 'flight') openFlight(a);
  else if(kind === 'tour') openTour(a, b);
  else if(kind === 'aircraft') openAircraft(a);
  else if(kind === 'airport') openAirport(a);
  else { closeToTab(); } // ancre inconnue : on ne laisse jamais un écran vide/bloqué
}
window.addEventListener('hashchange', route);
function openSheet(title, html){
  $('sheetTitle').textContent = title;
  $('sheetBody').innerHTML = html;
  $('sheet').scrollTop = 0;
  $('sheet').classList.add('open');
}
function closeSheet(){
  $('sheet').classList.remove('open');
  if(_maps.sheet){ _maps.sheet.remove(); delete _maps.sheet; }
}

/* ---------------- Cartes Leaflet ---------------- */
function makeMap(slot, elId){
  if(_maps[slot]){ _maps[slot].remove(); delete _maps[slot]; }
  const node = $(elId);
  if(!node || !window.L) { if(node) node.classList.add('hidden'); return null; }
  const map = L.map(node, { zoomControl:false, attributionControl:true, worldCopyJump:true });
  L.tileLayer(`https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}`, {
    subdomains:'abcd', maxZoom:18,
    attribution:'&copy; OpenStreetMap &copy; CARTO'
  }).addTo(map);
  map.attributionControl.setPrefix(false);
  _maps[slot] = map;
  return map;
}
function fitMap(map, pts, fallbackZoom){
  if(!map) return;
  setTimeout(() => {
    map.invalidateSize();
    if(pts.length > 1) map.fitBounds(L.latLngBounds(pts), { padding:[22,22] });
    else if(pts.length === 1) map.setView(pts[0], fallbackZoom || 8);
    else map.setView([46.6, 2.4], 4);
  }, 260); // après l'animation d'ouverture de l'écran de détail
}
function airportDot(map, icao, permanent){
  const a = lookup(icao);
  if(!a) return null;
  L.circleMarker([a.lat, a.lon], { radius:4.5, color:'#0a0d11', weight:2, fillColor:'#e7edf2', fillOpacity:1 })
    .bindTooltip(icao, { permanent: !!permanent, direction:'top', offset:[0,-4], className:'lbl' }).addTo(map);
  return [a.lat, a.lon];
}

/* ---------------- Vol en cours ---------------- */
function renderLive(){
  const slot = $('liveSlot');
  const t = online && DATA && DATA.live; // la télémétrie n'a de sens qu'en direct (même Wi-Fi)
  document.body.classList.toggle('is-live', !!t);
  if(!slot) return;
  if(!t){ slot.innerHTML = ''; return; }
  const alt = t.altFt != null ? Math.round(t.altFt).toLocaleString('fr-FR') + ' ft' : '—';
  slot.innerHTML = `<div class="live-banner" onclick="go('live')">
    <div class="lb-top"><span class="pulse"></span>Vol en cours${t.callsign ? ' — ' + esc(t.callsign) : ''}</div>
    <div class="lb-route">${esc(t.dep || '----')} → ${esc(t.arr || '----')}</div>
    <div class="lb-grid">
      <div><div class="k">Phase</div><div class="v">${esc(PHASE_LABELS[t.phase] || t.phase || '—')}</div></div>
      <div><div class="k">Altitude</div><div class="v">${alt}</div></div>
      <div><div class="k">Cap</div><div class="v">${t.headingDeg != null ? Math.round(t.headingDeg) + '°' : '—'}</div></div>
      <div><div class="k">Parcouru</div><div class="v">${t.distanceNm != null ? Math.round(t.distanceNm) + ' NM' : '—'}</div></div>
      <div><div class="k">Radio</div><div class="v">${t.comFreqMhz != null ? Number(t.comFreqMhz).toFixed(3) : '—'}</div></div>
      <div><div class="k">Progression</div><div class="v">${t.progressPct != null ? t.progressPct + ' %' : '—'}</div></div>
    </div>
    ${t.progressPct != null ? `<div class="progress"><div style="width:${Math.max(0, Math.min(100, t.progressPct))}%"></div></div>` : ''}
    <div class="lb-more">Suivre sur la carte ›</div>
  </div>`;
}

/* =========================================================
   LOGBOOK
   ========================================================= */
function sortedFlights(){ return [...(DATA.logbook || [])].sort((a, b) => (b.date || '').localeCompare(a.date || '')); }
function renderLogbook(){
  const flights = DATA.logbook || [];
  const totalMin = flights.reduce((s, f) => s + (f.durationMin || 0), 0);
  const last = sortedFlights()[0];
  $('view-logbook').innerHTML = `
    <div class="stats">
      ${stat('Vols', flights.length, 'var(--ifr)')}
      ${stat('Heures', F.fmtHm(totalMin))}
      ${stat('Dernier', last ? F.fmtDateFr(last.date).slice(0, 5) : '—', 'var(--vfr)')}
    </div>
    <input class="search" id="lbSearch" type="search" placeholder="Indicatif, OACI, appareil…" value="${esc(_lb.search)}" autocomplete="off">
    <div class="chips" id="lbChips">
      ${[['all','Tous'],['IFR','IFR'],['VFR','VFR'],['tracked','Trackés']].map(([k, l]) => `<button class="chip ${_lb.filter === k ? 'on' : ''}" data-f="${k}">${l}</button>`).join('')}
    </div>
    <div id="lbList"></div>`;
  $('lbSearch').addEventListener('input', e => { _lb.search = e.target.value; renderLogbookList(); });
  $('lbChips').addEventListener('click', e => {
    const b = e.target.closest('[data-f]'); if(!b) return;
    _lb.filter = b.dataset.f;
    document.querySelectorAll('#lbChips .chip').forEach(c => c.classList.toggle('on', c === b));
    renderLogbookList();
  });
  renderLogbookList();
}
function flightCard(f){
  const lr = F.flightLandingRate(f);
  return `<button class="card flight-card" onclick="go('flight/${esc(f.id)}')">
    <div class="route">${esc(f.dep || '----')}<span class="arrow">→</span>${esc(f.arr || '----')}</div>
    <div class="right">${F.fmtHm(f.durationMin)}</div>
    <div class="meta">
      <span>${esc(F.fmtDateFr(f.date))}</span>
      ${f.callsign ? `<span class="mono">${esc(f.callsign)}</span>` : ''}
      ${f.aircraft ? `<span>${esc(f.aircraft)}</span>` : ''}
      <span class="pill ${f.rules === 'VFR' ? 'vfr' : 'ifr'}">${esc(f.rules || '—')}</span>
      ${lr != null ? `<span>${gradeHtml(lr, F.flightCategory(f))}</span>` : ''}
    </div>
  </button>`;
}
function renderLogbookList(){
  const q = _lb.search.trim().toUpperCase();
  const list = sortedFlights().filter(f => {
    if(_lb.filter === 'IFR' || _lb.filter === 'VFR'){ if(f.rules !== _lb.filter) return false; }
    if(_lb.filter === 'tracked' && !f.trackData) return false;
    if(q && !`${f.callsign || ''} ${f.dep || ''} ${f.arr || ''} ${f.aircraft || ''} ${f.network || ''}`.toUpperCase().includes(q)) return false;
    return true;
  });
  if(!list.length){ $('lbList').innerHTML = `<div class="empty">${(DATA.logbook || []).length ? 'Aucun vol ne correspond.' : 'Aucun vol dans ton logbook pour le moment.'}</div>`; return; }
  let html = '', month = '';
  list.forEach(f => {
    const m = (f.date || '').slice(0, 7);
    if(m !== month){
      month = m;
      const [y, mm] = m.split('-');
      html += `<div class="month">${mm ? MONTHS[parseInt(mm, 10) - 1] + ' ' + y : 'Sans date'}</div>`;
    }
    html += flightCard(f);
  });
  $('lbList').innerHTML = `<div class="list">${html}</div>`;
}

function openFlight(id){
  const f = (DATA.logbook || []).find(x => x.id === id);
  if(!f){ go(_lastTab); return; }
  const td = f.trackData || null;
  const dep = lookup(f.dep), arr = lookup(f.arr);
  const dist = F.flightDistance(f, lookup);
  const lr = F.flightLandingRate(f);
  const ac = hangarOf(f);
  const career = (DATA.careers || []).find(c => c.id === f.careerId);
  const z = td && td.touchdown && td.touchdown.zone;
  const pirep = { ok:'Validé', pending:'En attente', rejected:'Refusé' }[f.pirep];
  openSheet(f.callsign || 'Vol', `
    <div class="hero">
      <div class="eyebrow">${esc(F.fmtDateFr(f.date))}${f.callsign ? ' · ' + esc(f.callsign) : ''}</div>
      <div class="big">${esc(f.dep || '----')} → ${esc(f.arr || '----')}</div>
      <div class="sub">${esc(dep ? dep.name : '')}${dep && arr ? ' → ' : ''}${esc(arr ? arr.name : '')}</div>
      <div style="margin-top:8px; display:flex; gap:6px; flex-wrap:wrap;">
        <span class="pill ${f.rules === 'VFR' ? 'vfr' : 'ifr'}">${esc(f.rules || '—')}</span>
        ${f.network ? `<span class="pill ifr" style="color:var(--text-2); background:rgba(255,255,255,.06);">${esc(f.network)}</span>` : ''}
        ${pirep ? `<span class="pill ${f.pirep === 'ok' ? 'ok' : ''}" style="${f.pirep === 'ok' ? '' : 'color:var(--text-2); background:rgba(255,255,255,.06);'}">PIREP ${pirep}</span>` : ''}
      </div>
    </div>
    <div class="map" id="sheetMap"></div>
    <div class="tiles">
      ${tile('Durée', F.fmtHm(f.durationMin))}
      ${tile('Distance', dist.nm != null ? F.fmtNm(dist.nm) + (dist.estimated ? ' <small class="muted">(ortho.)</small>' : '') : '—')}
      ${tile('Appareil', esc(f.aircraft || '—'))}
      ${tile('Avion du hangar', ac ? esc(ac.name) : '—')}
      ${td ? tile('Altitude max', td.maxAltFt != null ? td.maxAltFt.toLocaleString('fr-FR') + ' ft' : '—') : ''}
      ${td ? tile('Vitesse max', td.maxIasKt != null ? td.maxIasKt + ' kt' : '—') : ''}
      ${tile('Toucher', gradeHtml(lr, ac ? ac.category : null))}
      ${td ? tile('Rebonds', td.bounceCount ? td.bounceCount : 'Aucun') : ''}
      ${td && td.fuelUsedLbs != null ? tile('Carburant', td.fuelUsedLbs.toLocaleString('fr-FR') + ' lbs') : ''}
      ${td && td.turnStats && td.turnStats.maxBankDeg ? tile('Virage max', td.turnStats.maxBankDeg + '°') : ''}
      ${career ? tile('Carrière', esc(career.name)) : ''}
    </div>
    ${z ? `<h2 class="section">Toucher des roues</h2>${z.lengthFt ? `<div class="rwy-wrap">${F.runwayDiagramSvg(z, { width: 360, height: 96, fluid: true })}</div>` : ''}<div class="tiles">
      ${tile('Piste', esc(z.runway))}
      ${tile('Depuis le seuil', z.distanceFromThresholdFt + ' ft (' + z.percentAlongRunway + ' %)')}
      ${tile('Écart latéral', z.lateralOffsetFt + ' ft à ' + esc(z.side))}
      ${tile('Taux', F.fmtFpm(td.touchdown.vsFpm != null ? td.touchdown.vsFpm : lr))}
    </div>` : ''}
    ${td && td.phases && td.phases.length ? `<h2 class="section">Phases du vol</h2>
      <table class="tbl"><thead><tr><th>Phase</th><th>Durée</th><th>Alt.</th><th>IAS moy.</th></tr></thead><tbody>
      ${td.phases.map(p => `<tr><td style="font-family:var(--font-body)">${esc(PHASE_LABELS[p.phase] || p.phase)}</td><td>${p.durationSec >= 60 ? Math.round(p.durationSec / 60) + ' min' : p.durationSec + ' s'}</td><td>${p.maxAltFt != null ? Math.round(p.maxAltFt).toLocaleString('fr-FR') : '—'}</td><td>${p.avgIasKt != null ? p.avgIasKt + ' kt' : '—'}</td></tr>`).join('')}
      </tbody></table>` : ''}
    ${f.remarks ? `<h2 class="section">Remarques</h2><div class="remarks">${esc(f.remarks)}</div>` : ''}
  `);
  const map = makeMap('sheet', 'sheetMap');
  if(!map) return;
  const pts = [];
  const path = td && Array.isArray(td.path) && td.path.length > 1 ? td.path : (dep && arr ? F.greatCirclePoints(dep, arr, 40) : null);
  if(path){
    L.polyline(path, { color: f.rules === 'VFR' ? '#ffb020' : '#54d6e8', weight: 3, opacity: .95, dashArray: td && td.path && td.path.length > 1 ? null : '6 6' }).addTo(map);
    path.forEach(p => pts.push(p));
  }
  [f.dep, f.arr].forEach(icao => { const p = icao && airportDot(map, icao, true); if(p) pts.push(p); });
  if(td && td.touchdown && td.touchdown.lat != null) L.circleMarker([td.touchdown.lat, td.touchdown.lon], { radius:5, color:'#ff5c5c', weight:2, fillColor:'#ff5c5c', fillOpacity:.9 }).addTo(map);
  fitMap(map, pts);
}

/* =========================================================
   CARRIÈRE & TOURS
   ========================================================= */
function careerRank(c){
  const totalMin = (DATA.logbook || []).filter(f => f.careerId === c.id).reduce((s, f) => s + (f.durationMin || 0), 0);
  const hours = totalMin / 60;
  const ranks = (c.ranks && c.ranks.length) ? c.ranks : [{ name:'Non défini', hours:0 }];
  let current = ranks[0], next = null;
  for(let i = 0; i < ranks.length; i++){
    if(hours >= ranks[i].hours) current = ranks[i];
    if(hours < ranks[i].hours){ next = ranks[i]; break; }
  }
  return { hours, current, next, pct: next ? Math.min(100, (hours / next.hours) * 100) : 100 };
}
function legsStrip(t){
  let html = `<div class="node ${t.legs[0].done ? 'done' : ''}"><i></i><span>${esc(t.legs[0].dep)}</span></div>`;
  t.legs.forEach(l => { html += `<div class="seg ${l.done ? 'done' : ''}"></div><div class="node ${l.done ? 'done' : ''}"><i></i><span>${esc(l.arr)}</span></div>`; });
  return `<div class="legs-strip">${html}</div>`;
}
function renderCareer(){
  const careers = DATA.careers || [];
  const all = [];
  careers.forEach(c => (c.tours || []).forEach(t => { if(t.legs && t.legs.length) all.push({ c, t }); }));
  const active = all.filter(x => !F.tourIsComplete(x.t));
  const done = all.filter(x => F.tourIsComplete(x.t))
    .map(x => ({ ...x, s: F.tourStats(x.c, x.t, DATA.logbook, lookup) }))
    .sort((a, b) => (b.s.completedAt || '').localeCompare(a.s.completedAt || ''));

  $('view-career').innerHTML = `
    <h2 class="section">Carrières</h2>
    ${careers.length ? `<div class="list">${careers.map(c => {
      const r = careerRank(c);
      return `<div class="card career">
        <div class="type">${esc(c.type)}</div>
        <div class="name">${esc(c.name)}</div>
        <div class="rank">${esc(r.current.name)}</div>
        <div class="bar"><div style="width:${r.pct}%"></div></div>
        <div class="row"><span>${r.hours.toFixed(1)} h</span><span>${r.next ? 'Prochain : ' + esc(r.next.name) + ' à ' + r.next.hours + ' h' : 'Grade maximum atteint'}</span></div>
      </div>`;
    }).join('')}</div>` : '<div class="empty">Aucune carrière définie sur ton PC.</div>'}

    ${all.length ? `<h2 class="section">Tours en cours</h2>
      ${active.length ? `<div class="list">${active.map(({ c, t }) => `
        <button class="card" onclick="go('tour/${esc(c.id)}/${esc(t.id)}')">
          <div class="tour-sub">${esc(c.name)}</div>
          <div class="tour-head"><div class="name">${esc(t.name)}</div><div class="count">${t.legs.filter(l => l.done).length}/${t.legs.length}</div></div>
          ${legsStrip(t)}
        </button>`).join('')}</div>` : '<div class="empty">Aucun tour en cours 🎉</div>'}
      ${done.length ? `<details class="fold">
        <summary><span class="chev"></span>Tours terminés <span class="badge">${done.length}</span></summary>
        <div class="list">${done.map(({ c, t, s }) => `
          <button class="card done-card" onclick="go('tour/${esc(c.id)}/${esc(t.id)}')">
            <div class="tour-sub">${esc(c.name)}</div>
            <div class="tour-head"><div class="name"><span style="color:var(--phosphor)">✓</span> ${esc(t.name)}</div></div>
            <div class="kv">
              <span>Le <b>${F.fmtDateFr(s.completedAt)}</b></span>
              <span><b>${s.legCount}</b> étapes</span>
              <span><b>${s.linkedCount ? F.fmtHm(s.totalMin) : '—'}</b></span>
              <span><b>${s.distanceNm ? Math.round(s.distanceNm).toLocaleString('fr-FR') : '—'}</b> NM</span>
            </div>
          </button>`).join('')}</div>
      </details>` : ''}` : ''}
  `;
}

function openTour(careerId, tourId){
  const c = (DATA.careers || []).find(x => x.id === careerId);
  const t = c && (c.tours || []).find(x => x.id === tourId);
  if(!t){ go(_lastTab); return; }
  const s = F.tourStats(c, t, DATA.logbook, lookup);
  const complete = F.tourIsComplete(t);
  openSheet(t.name, `
    <div class="hero">
      <div class="eyebrow">${esc(c.name)}</div>
      <div class="big" style="font-family:var(--font-display); font-size:22px;">${esc(t.name)}</div>
      <div class="sub">${complete ? `<span style="color:var(--phosphor)">✓ Terminé le ${F.fmtDateFr(s.completedAt)}</span>` : `En cours — ${s.doneCount}/${s.legCount} étapes`}</div>
    </div>
    ${legsStrip(t)}
    <div class="map" id="sheetMap"></div>
    <div class="tiles">
      ${tile('Étapes', s.doneCount + '/' + s.legCount)}
      ${tile('Temps de vol', s.linkedCount ? F.fmtHm(s.totalMin) : '—')}
      ${tile('Distance', s.distanceNm ? F.fmtNm(s.distanceNm) : '—')}
      ${tile('Bouclé en', complete && s.elapsedDays != null ? s.elapsedDays + ' jour' + (s.elapsedDays > 1 ? 's' : '') : '—')}
      ${tile('Commencé le', F.fmtDateFr(s.startDate))}
      ${tile('Toucher moyen', gradeHtml(s.avgLandingFpm))}
    </div>
    <h2 class="section">Étapes &amp; vols du logbook</h2>
    <table class="tbl"><thead><tr><th>#</th><th>Étape</th><th>Date</th><th>Durée</th><th>Toucher</th></tr></thead><tbody>
    ${s.legs.map(x => `<tr class="${x.leg.done ? '' : 'todo'}" ${x.flight ? `onclick="go('flight/${esc(x.flight.id)}')" style="cursor:pointer"` : ''}>
      <td class="muted">${x.index + 1}</td>
      <td>${esc(x.leg.dep)}→${esc(x.leg.arr)}</td>
      <td>${F.fmtDateFr(x.flight ? x.flight.date : (x.leg.doneAt || '').slice(0, 10)).slice(0, 5)}</td>
      <td>${x.flight ? F.fmtHm(x.flight.durationMin) : '—'}</td>
      <td>${x.landingFpm != null ? gradeHtml(x.landingFpm, x.flight ? F.flightCategory(x.flight) : null) : '—'}</td>
    </tr>`).join('')}
    </tbody></table>
    <div class="note">Touche une étape pour voir le vol correspondant.${s.legs.some(x => x.leg.done && !x.flight) ? ' Certaines étapes validées n\'ont pas de vol correspondant dans le logbook.' : ''}</div>
  `);
  const map = makeMap('sheet', 'sheetMap');
  if(!map) return;
  const pts = [];
  s.legs.forEach(({ leg, flight: f }) => {
    const a = lookup(leg.dep), b = lookup(leg.arr);
    const path = f && f.trackData && f.trackData.path && f.trackData.path.length > 1 ? f.trackData.path : (a && b ? F.greatCirclePoints(a, b, 32) : null);
    if(!path) return;
    L.polyline(path, { color: leg.done ? '#39e88f' : '#7c8894', weight: 2.6, opacity: .95, dashArray: leg.done ? null : '5 6' }).addTo(map);
    path.forEach(p => pts.push(p));
  });
  const seen = new Set();
  t.legs.forEach(l => [l.dep, l.arr].forEach(icao => { if(seen.has(icao)) return; seen.add(icao); airportDot(map, icao, t.legs.length <= 10); }));
  fitMap(map, pts);
}

/* =========================================================
   HANGAR
   ========================================================= */
const HANGAR_CATS = [
  { key:'light', label:'Light', desc:'Monomoteurs & légers', color:'var(--phosphor)' },
  { key:'medium', label:'Medium', desc:'Régionaux & moyen-courriers', color:'var(--ifr)' },
  { key:'heavy', label:'Heavy', desc:'Gros porteurs', color:'var(--vfr)' },
  { key:'jumbo', label:'Jumbo', desc:'Très gros porteurs', color:'#ff5c5c' },
  { key:'none', label:'Sans catégorie', desc:'', color:'var(--text-2)' }
];
const catOf = ac => HANGAR_CATS.some(c => c.key === ac.category && c.key !== 'none') ? ac.category : 'none';
function renderHangar(){
  const hangar = DATA.hangar || [];
  const a = assign();
  const rows = hangar.map(ac => ({ ac, s: F.aircraftStats(a[ac.id].flights, lookup, ac.category || null) }))
    .sort((x, y) => y.s.totalMin - x.s.totalMin);
  $('view-hangar').innerHTML = `
    <div class="stats two">
      ${stat('Avions', hangar.length, 'var(--ifr)')}
      ${stat('Heures', F.fmtHm(rows.reduce((n, r) => n + r.s.totalMin, 0)))}
    </div>
    ${rows.length ? HANGAR_CATS.filter(c => rows.some(r => catOf(r.ac) === c.key)).map(c => `
      <h2 class="section" style="color:${c.color}">${c.label}${c.key !== 'none' ? ` <span class="muted" style="font-weight:500; font-size:12px;">${c.desc}</span>` : ''}</h2>
      <div class="list">${rows.filter(r => catOf(r.ac) === c.key).map(({ ac, s }) => `
      <button class="card ac-card" onclick="go('aircraft/${esc(ac.id)}')">
        <div class="top"><span class="type">${esc(ac.icaoType || 'Avion')}</span>${ac.developer ? `<span class="reg">${esc(ac.developer)}</span>` : ''}</div>
        <div class="name">${esc(ac.name)}</div>
        <div class="kv4">
          <div><div class="k">Heures</div><div class="v">${F.fmtHm(s.totalMin)}</div></div>
          <div><div class="k">Vols</div><div class="v">${s.flights}</div></div>
          <div><div class="k">NM</div><div class="v">${s.distanceNm ? Math.round(s.distanceNm).toLocaleString('fr-FR') : '—'}</div></div>
          <div><div class="k">Toucher</div><div class="v">${s.avgLandingFpm != null ? '−' + Math.round(Math.abs(s.avgLandingFpm)) : '—'}</div></div>
        </div>
      </button>`).join('')}</div>`).join('') : '<div class="empty">Ton hangar est vide. Ajoute tes avions depuis l\'onglet Hangar de FlightBrief sur ton PC.</div>'}
    ${a._unassigned.length && rows.length ? `<div class="note">${a._unassigned.length} vol${a._unassigned.length > 1 ? 's' : ''} du logbook ne sont associés à aucun avion du hangar.</div>` : ''}
  `;
}

function openAircraft(id){
  const ac = (DATA.hangar || []).find(x => x.id === id);
  if(!ac){ go(_lastTab); return; }
  const flights = [...assign()[ac.id].flights].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const cat = ac.category || null, GR = F.landingGradesFor(cat);
  const s = F.aircraftStats(flights, lookup, cat);
  const gradeTotal = GR.reduce((n, g) => n + s.grades[g.key], 0);
  const gradeMax = Math.max(1, ...GR.map(g => s.grades[g.key]));
  const topAirports = Object.entries(s.airports).sort((a, b) => b[1] - a[1]).slice(0, 5);
  openSheet(ac.name, `
    <div class="hero">
      <div class="eyebrow">${esc([ac.icaoType, ac.developer].filter(Boolean).join(' · ') || 'Avion')}</div>
      <div class="big" style="font-family:var(--font-display); font-size:22px;">${esc(ac.name)}</div>
    </div>
    <div class="tiles">
      ${tile('Vols', s.flights)}
      ${tile('Heures de vol', F.fmtHm(s.totalMin))}
      ${tile('Distance', s.distanceNm ? F.fmtNm(s.distanceNm) : '—')}
      ${tile('Durée moyenne', s.avgMin != null ? F.fmtHm(s.avgMin) : '—')}
      ${tile('Toucher moyen', gradeHtml(s.avgLandingFpm, cat))}
      ${tile('Meilleur toucher', s.bestLanding ? gradeHtml(s.bestLanding.fpm, cat) : '—')}
      ${tile('Plus dur', s.worstLanding ? gradeHtml(s.worstLanding.fpm, cat) : '—')}
      ${tile('Rebonds', s.landingCount ? s.bounceTotal : '—')}
      ${tile('Altitude max', s.maxAltFt != null ? s.maxAltFt.toLocaleString('fr-FR') + ' ft' : '—')}
      ${tile('Conso. moyenne', s.fuelPerHourLbs != null ? Math.round(s.fuelPerHourLbs).toLocaleString('fr-FR') + ' lbs/h' : '—')}
      ${tile('Premier vol', F.fmtDateFr(s.firstDate))}
      ${tile('Dernier vol', F.fmtDateFr(s.lastDate))}
    </div>
    ${gradeTotal ? `<h2 class="section">Qualité des atterrissages</h2>${GR.map(g => `
      <div class="grade-row"><span>${g.label}</span><div class="track"><div style="width:${Math.round(s.grades[g.key] / gradeMax * 100)}%; background:${g.color}"></div></div><span class="n">${s.grades[g.key]}</span></div>`).join('')}` : ''}
    ${topAirports.length ? `<h2 class="section">Aéroports les plus fréquentés</h2><div class="card toplist">${topAirports.map(([k, n]) => `<div class="r"><span class="mono">${esc(k)} <span class="muted" style="font-family:var(--font-body)">${esc((lookup(k) || {}).name || '')}</span></span><span class="n">${n}</span></div>`).join('')}</div>` : ''}
    <h2 class="section">Vols (${flights.length})</h2>
    ${flights.length ? `<div class="list">${flights.map(flightCard).join('')}</div>` : '<div class="empty">Aucun vol associé à cet avion.</div>'}
  `);
}

/* =========================================================
   AÉROPORT — départs et arrivées effectués depuis/vers un terrain
   (ouvert en touchant un aéroport sur la carte du profil)
   ========================================================= */
function openAirport(icao){
  icao = String(icao || '').toUpperCase();
  const flights = sortedFlights();
  const deps = flights.filter(f => F.up(f.dep) === icao), arrs = flights.filter(f => F.up(f.arr) === icao);
  if(!deps.length && !arrs.length){ closeToTab(); return; }
  const info = lookup(icao) || {};
  const all = new Set([...deps, ...arrs]);
  const min = [...all].reduce((n, f) => n + (f.durationMin || 0), 0);
  openSheet(icao, `
    <div class="hero">
      <div class="eyebrow">Aéroport</div>
      <div class="big" style="font-family:var(--font-display); font-size:22px;">${esc(icao)}</div>
      ${info.name ? `<div class="note" style="margin-top:2px;">${esc(info.name)}</div>` : ''}
    </div>
    <div class="tiles">
      ${tile('Départs', deps.length)}
      ${tile('Arrivées', arrs.length)}
      ${tile('Vols', all.size)}
      ${tile('Heures', F.fmtHm(min))}
    </div>
    <h2 class="section">🛫 Départs (${deps.length})</h2>
    ${deps.length ? `<div class="list">${deps.map(flightCard).join('')}</div>` : '<div class="empty">Aucun départ depuis ce terrain.</div>'}
    <h2 class="section">🛬 Arrivées (${arrs.length})</h2>
    ${arrs.length ? `<div class="list">${arrs.map(flightCard).join('')}</div>` : '<div class="empty">Aucune arrivée sur ce terrain.</div>'}
  `);
}

/* =========================================================
   PROFIL
   ========================================================= */
function renderProfile(){
  const flights = DATA.logbook || [];
  const p = DATA.profile || {};
  const totalMin = flights.reduce((s, f) => s + (f.durationMin || 0), 0);
  let dist = 0; flights.forEach(f => { const d = F.flightDistance(f, lookup); if(d.nm != null) dist += d.nm; });
  const airports = new Set(); flights.forEach(f => { if(f.dep) airports.add(f.dep); if(f.arr) airports.add(f.arr); });
  const vfr = flights.filter(f => f.rules === 'VFR').length, ifr = flights.filter(f => f.rules === 'IFR').length;
  const lrs = flights.map(F.flightLandingRate).filter(v => v != null);
  const avgLr = lrs.length ? -(lrs.reduce((s, v) => s + Math.abs(v), 0) / lrs.length) : null;
  const count = key => { const o = {}; flights.forEach(f => { const k = key(f); if(k) o[k] = (o[k] || 0) + 1; }); return Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 5); };
  const topAc = count(f => f.aircraft);
  const apCounts = {}; flights.forEach(f => [f.dep, f.arr].forEach(k => { if(k) apCounts[k] = (apCounts[k] || 0) + 1; }));
  const topAp = Object.entries(apCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  $('view-profile').innerHTML = `
    <div class="greet">${p.firstName ? 'Salut ' + esc(p.firstName) + ' 👋' : 'Ton profil pilote'}</div>
    <div class="greet-sub">${[p.homeBase ? 'Base ' + esc(p.homeBase) : '', p.network ? esc(p.network) : '', p.twitchHandle ? 'twitch.tv/' + esc(p.twitchHandle) : ''].filter(Boolean).join(' · ') || 'Statistiques calculées à partir de ton logbook'}</div>
    <div class="stats">
      ${stat('Vols', flights.length, 'var(--ifr)')}
      ${stat('Heures', (totalMin / 60).toFixed(1) + '<small> h</small>')}
      ${stat('Distance', Math.round(dist).toLocaleString('fr-FR') + '<small> NM</small>', 'var(--vfr)')}
      ${stat('Aéroports', airports.size, 'var(--ifr)')}
      ${stat('Durée moy.', flights.length ? F.fmtHm(totalMin / flights.length) : '—')}
      ${stat('Toucher moy.', avgLr != null ? '−' + Math.round(Math.abs(avgLr)) + '<small> fpm</small>' : '—', 'var(--vfr)')}
    </div>
    <h2 class="section">Mes vols dans le monde</h2>
    <div class="map tall" id="profileMap"></div>
    <div class="note" style="margin-top:6px;">Touche un aéroport pour voir ses départs et arrivées.</div>
    ${vfr + ifr ? `<h2 class="section">VFR / IFR</h2>
      <div class="rules-bar"><div class="v" style="width:${vfr / (vfr + ifr) * 100}%"></div><div class="i" style="width:${ifr / (vfr + ifr) * 100}%"></div></div>
      <div class="note">${Math.round(vfr / (vfr + ifr) * 100)} % VFR (${vfr}) · ${Math.round(ifr / (vfr + ifr) * 100)} % IFR (${ifr})</div>` : ''}
    ${topAc.length ? `<h2 class="section">Appareils les plus utilisés</h2><div class="card toplist">${topAc.map(([k, n]) => `<div class="r"><span>${esc(k)}</span><span class="n">${n}</span></div>`).join('')}</div>` : ''}
    ${topAp.length ? `<h2 class="section">Aéroports les plus visités</h2><div class="card toplist">${topAp.map(([k, n]) => `<div class="r"><span class="mono">${esc(k)} <span class="muted" style="font-family:var(--font-body)">${esc((lookup(k) || {}).name || '')}</span></span><span class="n">${n}</span></div>`).join('')}</div>` : ''}
    <h2 class="section">Synchronisation</h2>
    <div class="card sync-card">
      <div><div class="k">Dernière synchro</div><div class="v">${esc(relTime(lastOkAt))}</div>
      <div class="note" style="margin-top:4px;">${online ? 'Connecté à ton PC ✓' : 'Hors ligne : les données restent consultables. Synchronise depuis le même Wi-Fi que ton PC, avec FlightBrief ouvert.'}</div></div>
      <button class="btn" onclick="syncNow(true)">Synchroniser</button>
    </div>
    <div class="note" style="text-align:center; margin-top:22px;">Copie de ton logbook FlightBrief ${esc(DATA.appVersion || '')} · stockée uniquement sur ce téléphone</div>
  `;
  _profileMapDirty = true;
  if($('view-profile').classList.contains('active')) setTimeout(drawProfileMap, 30);
}
let _profileMapDirty = true;
function drawProfileMap(){
  if(!_profileMapDirty || !DATA) return;
  const map = makeMap('profile', 'profileMap');
  if(!map) return;
  _profileMapDirty = false;
  const routes = {}, usage = {};
  (DATA.logbook || []).forEach(f => {
    if(!f.dep || !f.arr) return;
    const a = lookup(f.dep), b = lookup(f.arr);
    if(!a || !b) return;
    const key = [f.dep, f.arr].sort().join('|');
    routes[key] = routes[key] || { a, b, n: 0, vfr: 0 };
    routes[key].n++; if(f.rules === 'VFR') routes[key].vfr++;
    usage[f.dep] = (usage[f.dep] || 0) + 1; usage[f.arr] = (usage[f.arr] || 0) + 1;
  });
  const pts = [];
  const maxN = Math.max(1, ...Object.values(routes).map(r => r.n));
  Object.values(routes).forEach(r => {
    if(r.a === r.b) return;
    const path = F.greatCirclePoints(r.a, r.b, 28);
    L.polyline(path, { color: r.vfr > r.n / 2 ? '#ffb020' : '#54d6e8', weight: 1.6 + 2 * Math.sqrt(r.n / maxN), opacity: .35 + .5 * Math.sqrt(r.n / maxN) }).addTo(map);
  });
  const maxU = Math.max(1, ...Object.values(usage));
  Object.entries(usage).sort((a, b) => a[1] - b[1]).forEach(([icao, n]) => {
    const a = lookup(icao); if(!a) return;
    L.circleMarker([a.lat, a.lon], { radius: 3 + 4 * Math.sqrt(n / maxU), color:'#0a0d11', weight:1.5, fillColor:'#39e88f', fillOpacity:1 })
      .bindTooltip(`${icao} · ${n} vol${n > 1 ? 's' : ''}`, { direction:'top', className:'lbl' })
      .on('click', () => go('airport/' + icao)).addTo(map);
    pts.push([a.lat, a.lon]);
  });
  // Cadrage sur la zone principale d'activité : si ≥ 75 % des passages se font à moins de
  // 1 500 NM de l'aéroport le plus fréquenté, on ignore les quelques long-courriers.
  const hub = Object.entries(usage).sort((a, b) => b[1] - a[1])[0];
  const hubA = hub && lookup(hub[0]);
  if(hubA){
    let near = 0, total = 0; const core = [];
    Object.entries(usage).forEach(([icao, n]) => {
      const a = lookup(icao); if(!a) return; total += n;
      if(F.haversineNm(hubA.lat, hubA.lon, a.lat, a.lon) <= 1500){ near += n; core.push([a.lat, a.lon]); }
    });
    if(total && near / total >= 0.75 && core.length > 1){ fitMap(map, core, 6); return; }
  }
  fitMap(map, pts, 6);
}

/* =========================================================
   VOL EN DIRECT — carte + télémétrie, interrogées toutes les 2 s sur le PC
   (uniquement sur le même Wi-Fi que le PC : les données viennent du simulateur en direct)
   ========================================================= */
const PHASE_COLORS = { taxi_out:'#7c8894', liftoff:'#ffd166', initial_climb:'#ff9f43', climb:'#ffb020', cruise:'#39e88f', descent:'#54d6e8', approach:'#4d7cff', final_approach:'#a06cf5', touchdown:'#ff5c5c', taxi_in:'#7c8894' };
let _liveTimer = null, _liveData = null, _liveFollow = true, _liveMap = null, _liveLayers = null, _liveFailCount = 0, _liveLastOk = 0;
function startLiveView(){
  if(!$('liveRoot')) buildLiveShell();
  if(_liveTimer) return;
  pollLive();
  _liveTimer = setInterval(() => { if(!document.hidden) pollLive(); }, 2000);
}
function stopLiveView(){ clearInterval(_liveTimer); _liveTimer = null; }
async function pollLive(){
  if(!TOKEN) return;
  try{
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 3500);
    const res = await fetch('/api/live?t=' + encodeURIComponent(TOKEN), { cache:'no-store', signal: ctrl.signal });
    clearTimeout(to);
    if(!res.ok) throw new Error('HTTP ' + res.status);
    _liveData = await res.json();
    _liveFailCount = 0; _liveLastOk = Date.now();
  }catch(e){
    _liveFailCount++;
    if(_liveFailCount < 3 && _liveData) return; // petite coupure : on garde l'affichage
    _liveData = null;
  }
  renderLiveView();
}
function buildLiveShell(){
  $('view-live').innerHTML = `<div id="liveRoot">
    <div id="liveHead"></div>
    <div class="live-map-wrap">
      <div class="map tall live-map" id="liveMap"></div>
      <button class="live-follow on" id="liveFollowBtn" onclick="toggleLiveFollow()">◎ Suivre l'avion</button>
    </div>
    <div id="liveBody"></div>
  </div>`;
}
function toggleLiveFollow(){
  _liveFollow = !_liveFollow;
  $('liveFollowBtn').classList.toggle('on', _liveFollow);
  if(_liveFollow && _liveData && _liveData.pos && _liveMap) _liveMap.setView([_liveData.pos.lat, _liveData.pos.lon], Math.max(_liveMap.getZoom(), 7));
}
function planeIcon(heading){
  return L.divIcon({ className:'live-plane', iconSize:[34,34], iconAnchor:[17,17],
    html:`<div style="transform:rotate(${heading || 0}deg)"><svg viewBox="0 0 24 24"><path d="M12 1.5 L15 10 L22.5 14 L22.5 16.5 L15 14.5 L15 19.5 L18.5 22 L18.5 23.5 L12 22 L5.5 23.5 L5.5 22 L9 19.5 L9 14.5 L1.5 16.5 L1.5 14 L9 10 Z"/></svg></div>` });
}
function fmtElapsed(iso){
  if(!iso) return '—';
  const min = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60000));
  return F.fmtHm(min);
}
function liveEmpty(icon, title, text){
  return `<div class="live-empty"><div class="le-icon">${icon}</div><h3>${title}</h3><p>${text}</p></div>`;
}
function ensureLiveMap(){
  if(_liveMap || !window.L) return _liveMap;
  _liveMap = L.map('liveMap', { zoomControl:false, attributionControl:true });
  L.tileLayer(`https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}`, { subdomains:'abcd', maxZoom:18, attribution:'&copy; OpenStreetMap &copy; CARTO' }).addTo(_liveMap);
  _liveMap.attributionControl.setPrefix(false);
  _liveMap.on('dragstart', () => { if(_liveFollow) toggleLiveFollow(); });
  _liveLayers = {
    glow: L.polyline([], { color:'#39e88f', weight:9, opacity:.15 }).addTo(_liveMap),
    path: L.polyline([], { color:'#39e88f', weight:3, opacity:.95 }).addTo(_liveMap),
    rest: L.polyline([], { color:'#e7edf2', weight:1.5, opacity:.45, dashArray:'4 7' }).addTo(_liveMap),
    dep: null, arr: null, plane: null
  };
  _liveMap.setView([46.6, 2.4], 5);
  setTimeout(() => _liveMap.invalidateSize(), 60);
  return _liveMap;
}
function renderLiveView(){
  const head = $('liveHead'), body = $('liveBody');
  if(!head) return;
  const d = _liveData;
  if(d) document.body.classList.toggle('is-live', !!d.tracking);
  const mapWrap = document.querySelector('.live-map-wrap');
  if(!d){
    mapWrap.classList.add('hidden');
    head.innerHTML = liveEmpty('📡', 'Suivi en direct indisponible', "Le suivi en direct lit ton simulateur sur ton PC : ce téléphone doit être sur le <b>même Wi-Fi</b>, avec FlightBrief ouvert.");
    body.innerHTML = '';
    return;
  }
  if(!d.connected && !d.ended){
    mapWrap.classList.add('hidden');
    head.innerHTML = liveEmpty('🛫', 'Aucun vol en cours', "Sur ton PC, onglet <b>Briefing</b> : clique sur « Lancer le vol &amp; le tracker ». Ton vol apparaîtra ici en direct, sur la carte.");
    body.innerHTML = '';
    return;
  }
  mapWrap.classList.remove('hidden');
  const map = ensureLiveMap();
  const pos = d.pos;
  const stale = d.posAgeSec != null && d.posAgeSec > 15;
  const phaseKey = d.tracking ? d.phase : (d.ended ? 'taxi_in' : null);
  const phaseLabel = !d.tracking && d.ended ? 'Vol terminé' : (PHASE_LABELS[d.phase] || (d.tracking ? 'En vol' : 'En attente du départ'));
  const phaseColor = PHASE_COLORS[phaseKey] || '#7c8894';
  let remainingNm = null, etaMin = null;
  if(pos && d.arr && d.arr.lat != null){
    remainingNm = F.haversineNm(pos.lat, pos.lon, d.arr.lat, d.arr.lon);
    if(pos.gsKt > 40 && !pos.onGround) etaMin = remainingNm / pos.gsKt * 60;
  }
  const eta = etaMin != null ? new Date(Date.now() + etaMin * 60000).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' }) : '—';

  head.innerHTML = `<div class="live-head">
    <div class="lh-top">
      <span class="lh-status ${stale ? 'stale' : (d.tracking ? 'on' : '')}"><i></i>${stale ? 'Signal perdu' : (d.tracking ? 'En direct' : (d.ended ? 'Terminé' : 'Connecté'))}</span>
      <span class="lh-phase" style="--pc:${phaseColor}">${esc(phaseLabel)}</span>
    </div>
    <div class="lh-route">${esc((d.dep && d.dep.icao) || '----')}<span>✈</span>${esc((d.arr && d.arr.icao) || '----')}</div>
    <div class="lh-sub">${esc([d.callsign, d.aircraft].filter(Boolean).join(' · ') || (d.sim || 'Simulateur connecté'))}</div>
    ${d.progressPct != null && d.tracking ? `<div class="progress"><div style="width:${Math.max(0, Math.min(100, d.progressPct))}%"></div></div><div class="lh-prog"><span>${d.progressPct} %</span><span>${remainingNm != null ? Math.round(remainingNm) + ' NM restants' : ''}</span></div>` : ''}
  </div>`;

  if(d.ended && !d.tracking){
    const g = d.ended.landingRateFpm != null ? F.landingGrade(d.ended.landingRateFpm) : null;
    body.innerHTML = `<div class="live-ended">
      <div class="le-title">🛬 Posé ${d.ended.dep || d.ended.arr ? `— ${esc(d.ended.dep || '----')} → ${esc(d.ended.arr || '----')}` : ''}</div>
      <div class="tiles">
        ${tile('Durée', F.fmtHm(d.ended.durationMin))}
        ${tile('Distance', F.fmtNm(d.ended.distanceNm))}
        ${tile('Toucher', d.ended.landingRateFpm != null ? `<i class="gdot" style="background:${g.color}"></i>${F.fmtFpm(d.ended.landingRateFpm)}` : '—')}
        ${tile('Rebonds', d.ended.bounceCount ? d.ended.bounceCount : 'Aucun')}
      </div>
      <div class="note">Envoie le PIREP depuis FlightBrief sur ton PC : le vol rejoindra ton logbook à la prochaine synchro.</div>
    </div>`;
  } else if(pos){
    const vs = pos.vsFpm || 0;
    body.innerHTML = `<div class="live-grid">
      <div class="lg big"><div class="k">Altitude</div><div class="v">${Math.round(pos.altFt).toLocaleString('fr-FR')}<small> ft</small></div></div>
      <div class="lg big"><div class="k">Vitesse sol</div><div class="v">${pos.gsKt}<small> kt</small></div></div>
      <div class="lg"><div class="k">IAS</div><div class="v">${pos.iasKt}<small> kt</small></div></div>
      <div class="lg"><div class="k">Vario</div><div class="v ${vs > 150 ? 'up' : vs < -150 ? 'down' : ''}">${vs > 0 ? '+' : ''}${vs}<small> fpm</small></div></div>
      <div class="lg"><div class="k">Cap</div><div class="v">${String(Math.round(pos.headingDeg) % 360).padStart(3, '0')}°</div></div>
      <div class="lg"><div class="k">Radio</div><div class="v">${pos.comFreqMhz != null ? Number(pos.comFreqMhz).toFixed(3) : '—'}</div></div>
      <div class="lg"><div class="k">Écoulé</div><div class="v">${d.tracking ? fmtElapsed(d.startedAt) : '—'}</div></div>
      <div class="lg"><div class="k">Parcouru</div><div class="v">${d.tracking ? Math.round(d.distanceNm || 0) : '—'}<small> NM</small></div></div>
      <div class="lg"><div class="k">Arrivée estimée</div><div class="v">${eta}</div></div>
    </div>
    ${d.landed && d.tracking ? `<div class="live-landed">Toucher des roues : <b>${F.fmtFpm(d.landed.landingRateFpm)}</b>${d.landed.bounceCount ? ` · ${d.landed.bounceCount} rebond(s)` : ''}</div>` : ''}
    ${d.phases && d.phases.length ? `<h2 class="section">Phases</h2><div class="live-phases">${d.phases.map(p => `<span style="--pc:${PHASE_COLORS[p.phase] || '#7c8894'}"><i></i>${esc(PHASE_LABELS[p.phase] || p.phase)} <small>${p.durationSec >= 60 ? Math.round(p.durationSec / 60) + ' min' : p.durationSec + ' s'}</small></span>`).join('')}</div>` : ''}`;
  } else {
    body.innerHTML = '<div class="note" style="text-align:center">En attente de la position de l\'avion…</div>';
  }

  if(!map) return;
  const L_ = _liveLayers;
  L_.path.setLatLngs(d.path || []); L_.glow.setLatLngs(d.path || []);
  const setAp = (key, a) => {
    if(L_[key]){ map.removeLayer(L_[key]); L_[key] = null; }
    if(a && a.lat != null) L_[key] = L.circleMarker([a.lat, a.lon], { radius:5, color:'#0a0d11', weight:2, fillColor:'#e7edf2', fillOpacity:1 })
      .bindTooltip(a.icao, { permanent:true, direction:'top', offset:[0,-5], className:'lbl' }).addTo(map);
  };
  setAp('dep', d.dep); setAp('arr', d.arr);
  if(pos){
    if(!L_.plane) L_.plane = L.marker([pos.lat, pos.lon], { icon: planeIcon(pos.headingDeg), zIndexOffset: 1000 }).addTo(map);
    else { L_.plane.setLatLng([pos.lat, pos.lon]); L_.plane.setIcon(planeIcon(pos.headingDeg)); }
    L_.rest.setLatLngs(d.arr && d.arr.lat != null && d.tracking ? F.greatCirclePoints(pos, d.arr, 24) : []);
    if(_liveFollow) map.setView([pos.lat, pos.lon], map.getZoom() < 6 ? 8 : map.getZoom(), { animate: true });
  }
}

/* ---------------- Rendu global ---------------- */
function renderAll(){
  if(!DATA) return;
  hideGate();
  F.setLandingThresholds(DATA.profile && DATA.profile.landingThresholds);
  $('appTitle').textContent = DATA.profile && DATA.profile.firstName ? 'FlightBrief · ' + DATA.profile.firstName : 'FlightBrief';
  renderLive();
  renderLogbook();
  renderCareer();
  renderHangar();
  renderProfile();
  // Un écran de détail ouvert est reconstruit avec les nouvelles données.
  if($('sheet').classList.contains('open')) route();
}

(async function start(){
  if('serviceWorker' in navigator){
    // Met l'appli (pas les données) en cache pour qu'elle s'ouvre sans réseau.
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
  if(navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  const hadCache = await loadCache();
  if(hadCache){ renderAll(); route(); setSync('off'); renderSyncNotice(); }
  else if(!TOKEN){ showGate('notoken'); return; }
  await syncNow(false);
  if(!hadCache && DATA) route();
})();
