/* =========================================================
   FlightBrief 2.1 — confort
   ---------------------------------------------------------
   • Briefing : indicateur de chargement sur la carte quand on active VATSIM / IVAO / Amis.
   • Briefing : panneaux « Copilote vocal » et « ATC en ligne » repliables (état mémorisé).
   • Logbook : export CSV dans le dossier « exports » de l'appli, import des vols VATSIM / IVAO.
   • Carrière : validation automatique des étapes de tour après chaque changement du logbook.
   • Events VATSIM + IVAO : liste et fiche dans Outils, terrains en surbrillance sur la carte du Briefing.
   ========================================================= */
(function(){
'use strict';
const FBv21 = {};
window.FBv21 = FBv21;
const $ = id => document.getElementById(id);
const esc = s => escapeHtml(s == null ? '' : String(s));
const nextPaint = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
const notice = o => { if(window.FBNotice) FBNotice.show(o); };

/* ---------------- Briefing : chargement de la carte ---------------- */
let loaderEl = null, loaderCount = 0, loaderTimer = null;
function mapLoader(on, text){
  const shell = document.querySelector('#view-briefing .map-shell');
  if(!shell) return;
  if(!loaderEl){
    loaderEl = document.createElement('div');
    loaderEl.className = 'map-loading';
    loaderEl.setAttribute('role', 'status');
    loaderEl.setAttribute('aria-live', 'polite');
    loaderEl.innerHTML = '<span class="fb-spinner"></span><span class="ml-text"></span>';
    shell.appendChild(loaderEl);
  }
  if(on){
    loaderCount++;
    loaderEl.querySelector('.ml-text').textContent = text || 'Mise à jour de la carte…';
    clearTimeout(loaderTimer);
    loaderEl.classList.add('on');
    shell.classList.add('is-loading');
  } else {
    loaderCount = Math.max(0, loaderCount - 1);
    if(loaderCount) return;
    // Reste visible au moins un court instant : sinon simple clignotement illisible.
    loaderTimer = setTimeout(() => { loaderEl.classList.remove('on'); shell.classList.remove('is-loading'); }, 220);
  }
}
const NET_LABEL = { vatsim: 'VATSIM', ivao: 'IVAO' };
function wrapBriefingLoaders(){
  if(!window.FBv15 || FBv15.__v21Wrapped) return;
  FBv15.__v21Wrapped = true;
  const origRefreshAtc = FBv15.refreshAtc, origRefreshFriends = FBv15.refreshFriends;
  const origAtcToggle = FBv15.atcToggle, origFriendsToggle = FBv15.friendsToggle;
  let userAction = 0; // > 0 : action de l'utilisateur en cours (les rafraîchissements de fond restent discrets)
  let atcInflight = null;

  FBv15.refreshAtc = function(force){
    const show = userAction > 0 || force;
    if(show) mapLoader(true, 'Chargement des contrôleurs en ligne…');
    const p = Promise.resolve().then(() => origRefreshAtc.apply(this, arguments)).finally(() => { if(show) mapLoader(false); if(atcInflight === p) atcInflight = null; });
    atcInflight = p;
    return p;
  };
  let friendsInflight = null;
  FBv15.refreshFriends = function(){
    const show = userAction > 0;
    if(show) mapLoader(true, 'Recherche des amis en ligne…');
    const p = Promise.resolve().then(() => origRefreshFriends.apply(this, arguments)).finally(() => { if(show) mapLoader(false); if(friendsInflight === p) friendsInflight = null; });
    friendsInflight = p;
    return p;
  };
  // Le clic redessine la carte (des centaines de secteurs / badges) : on affiche d'abord
  // l'indicateur, on laisse le navigateur le peindre, puis on lance le travail.
  FBv15.atcToggle = async function(k){
    const cfg = db.atcMap || {};
    const turningOn = !cfg[k];
    const label = NET_LABEL[k] ? `${turningOn ? 'Chargement' : 'Retrait'} de ${NET_LABEL[k]}…` : 'Mise à jour de la carte…';
    const chip = document.querySelector(`#atcMapChips .atc-chip[onclick*="'${k}'"]`);
    if(chip) chip.classList.add('busy');
    userAction++; mapLoader(true, label);
    try{
      await nextPaint();
      atcInflight = null;
      origAtcToggle.call(this, k);
      // Le chargement réseau éventuel a démarré dans origAtcToggle : on attend qu'il se termine.
      if(atcInflight) await atcInflight.catch(() => {});
      await nextPaint();
    } finally { if(chip && chip.isConnected) chip.classList.remove('busy'); userAction--; mapLoader(false); }
  };
  FBv15.friendsToggle = async function(k, v){
    userAction++; mapLoader(true, 'Recherche des amis en ligne…');
    try{
      await nextPaint();
      friendsInflight = null;
      origFriendsToggle.call(this, k, v);
      if(friendsInflight) await friendsInflight.catch(() => {});
    } finally{ userAction--; mapLoader(false); }
  };
}

/* ---------------- Briefing : panneaux repliables ---------------- */
const CHEVRON = '<svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>';
function collapsed(){ if(!db.uiCollapsed || typeof db.uiCollapsed !== 'object') db.uiCollapsed = {}; return db.uiCollapsed; }
function setCollapsed(panel, on, btn){
  panel.classList.toggle('is-collapsed', on);
  btn.setAttribute('aria-expanded', on ? 'false' : 'true');
  btn.title = on ? 'Déployer le panneau' : 'Réduire le panneau';
}
function makeCollapsible(panelId, headSel, hostSel){
  const panel = $(panelId);
  if(!panel || panel.querySelector('.fb-collapse-btn')) return;
  const head = panel.querySelector(headSel);
  if(!head) return;
  const host = hostSel ? head.querySelector(hostSel) || head : head;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'fb-collapse-btn';
  btn.innerHTML = CHEVRON;
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const on = !panel.classList.contains('is-collapsed');
    setCollapsed(panel, on, btn);
    collapsed()[panelId] = on;
    queueSaveDb();
  });
  host.appendChild(btn);
  // Clic sur le titre = même effet (plus grande cible).
  const title = head.querySelector('h3');
  if(title){ title.style.cursor = 'pointer'; title.addEventListener('click', () => btn.click()); }
  setCollapsed(panel, !!collapsed()[panelId], btn);
}

/* ---------------- Logbook : export CSV ---------------- */
FBv21.exportLogbook = async function(){
  if(!db.logbook.length){ notice({ kind: 'warn', title: 'Logbook vide', text: 'Aucun vol à exporter pour le moment.', ms: 3500 }); return; }
  if(!window.logbookIO){ notice({ kind: 'err', title: 'Export indisponible', text: 'Redémarre FlightBrief pour activer l\'export.', ms: 5000 }); return; }
  const btn = $('lbExportBtn');
  if(btn){ btn.disabled = true; btn.classList.add('is-busy'); }
  try{
    const flights = db.logbook.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    const csv = FBImport.toCsv(flights, {
      careers: db.careers, hangar: db.hangar,
      landing: f => FBShared.flightLandingRate(f),
      distance: f => { const d = FBShared.flightDistance(f, cachedAirportLookup); return d && d.nm != null ? d.nm : null; }
    });
    const r = await window.logbookIO.exportCsv(csv);
    if(!r || !r.ok) throw new Error((r && r.error) || 'écriture impossible');
    const name = r.file.split(/[\\/]/).pop();
    notice({ kind: 'ok', title: `Logbook exporté · ${flights.length} vol${flights.length > 1 ? 's' : ''}`, text: name, ms: 9000,
      actions: [{ label: 'Afficher le fichier', primary: true, fn: () => window.logbookIO.reveal(r.file) }, { label: 'Dossier des exports', fn: () => window.logbookIO.openExports() }] });
  } catch(e){
    notice({ kind: 'err', title: 'Export impossible', text: e.message || String(e), ms: 6000 });
  } finally { if(btn){ btn.disabled = false; btn.classList.remove('is-busy'); } }
};

/* ---------------- Logbook : import VATSIM / IVAO ---------------- */
const NI = { net: 'vatsim', result: null, busy: false };
function niCfg(){ if(!db.netImport || typeof db.netImport !== 'object') db.netImport = {}; return db.netImport; }
FBv21.netImportOpen = function(net){
  if(!window.logbookIO){ notice({ kind: 'err', title: 'Import indisponible', text: 'Redémarre FlightBrief pour activer l\'import réseau.', ms: 5000 }); return; }
  NI.net = net || niCfg().lastNet || 'vatsim'; NI.result = null; NI.busy = false;
  const ov = document.createElement('div');
  ov.className = 'wr-overlay';
  ov.id = 'netImportOverlay';
  ov.innerHTML = `<div class="wr-box"><div class="wr-head"><h2>🌐 Importer mes vols en ligne</h2><button class="btn small" data-close>Fermer</button></div>
    <p class="hint">Récupère automatiquement tes vols faits sur VATSIM (avec ton CID) ou IVAO (avec ton VID) : date, indicatif, départ, arrivée, appareil, règles et temps de connexion. Les vols déjà présents dans le logbook ne sont pas importés deux fois.</p>
    <div class="ni-tabs">
      <button data-net="vatsim" style="--net:#3ee0a8">VATSIM</button>
      <button data-net="ivao" style="--net:#5b93ff">IVAO</button>
    </div>
    <div id="niForm"></div>
    <div id="niBody"></div></div>`;
  document.body.appendChild(ov);
  const close = () => { if(!NI.busy || confirm('Recherche en cours : fermer quand même ?')) ov.remove(); };
  ov.querySelector('[data-close]').onclick = close;
  ov.addEventListener('click', e => { if(e.target === ov) close(); });
  ov.querySelectorAll('.ni-tabs button').forEach(b => b.onclick = () => { if(NI.busy) return; NI.net = b.dataset.net; NI.result = null; niRender(ov); });
  niRender(ov);
};
function niRender(ov){
  const c = niCfg(), p = db.userProfile || {};
  ov.querySelectorAll('.ni-tabs button').forEach(b => b.classList.toggle('on', b.dataset.net === NI.net));
  const form = ov.querySelector('#niForm');
  if(NI.net === 'vatsim'){
    form.innerHTML = `<div class="ni-form">
      <div class="field"><label>CID VATSIM</label><input type="text" id="niId" inputmode="numeric" maxlength="9" placeholder="ex : 1234567" value="${esc(c.vatsimCid || p.vatsimId || '')}"></div>
      <button class="btn primary" id="niGo">Rechercher mes vols</button></div>
      <div class="hint" style="margin-top:6px;">Données publiques de VATSIM (comme VATSIM Stats) : tout ton historique de plans de vol, rapproché de tes connexions pilote. Durée = temps de connexion.</div>`;
  } else {
    form.innerHTML = `<div class="ni-form">
      <div class="field"><label>VID IVAO</label><input type="text" id="niId" inputmode="numeric" maxlength="9" placeholder="ex : 123456" value="${esc(c.ivaoVid || p.ivaoId || '')}"></div>
      <div class="field"><label>Clé API IVAO <i class="info-tip" tabindex="0" data-tip="IVAO ne publie pas l'historique des membres sans clé. Crée une clé personnelle (gratuite) sur developers.ivao.aero, puis colle-la ici. Elle ne quitte ton PC que pour interroger l'API IVAO."></i></label><input type="password" id="niKey" autocomplete="off" placeholder="apiKey" value="${esc(c.ivaoKey || '')}"></div>
      <button class="btn primary" id="niGo">Rechercher mes vols</button></div>
      <div class="ni-form" style="margin-top:6px; justify-content:space-between;">
        <label class="lb-check"><input type="checkbox" id="niRemember" ${c.ivaoKey ? 'checked' : ''}> Mémoriser la clé sur ce PC</label>
        <a href="#" id="niKeyLink" class="hint" style="margin:0;">Obtenir une clé sur developers.ivao.aero ›</a>
      </div>`;
    const link = form.querySelector('#niKeyLink');
    if(link) link.onclick = e => { e.preventDefault(); window.api.openExternal('https://developers.ivao.aero'); };
  }
  const go = form.querySelector('#niGo'), idIn = form.querySelector('#niId');
  go.onclick = () => niSearch(ov);
  idIn.onkeydown = e => { if(e.key === 'Enter') niSearch(ov); };
  idIn.oninput = () => { idIn.value = idIn.value.replace(/\D/g, ''); };
  niRenderBody(ov);
}
async function niSearch(ov){
  if(NI.busy) return;
  const id = (ov.querySelector('#niId').value || '').replace(/\D/g, '');
  const body = ov.querySelector('#niBody');
  if(!/^\d{3,9}$/.test(id)){ body.innerHTML = `<div class="status-msg err">${NI.net === 'vatsim' ? 'CID' : 'VID'} invalide : 3 à 9 chiffres.</div>`; return; }
  const c = niCfg();
  let key = '';
  if(NI.net === 'ivao'){
    key = (ov.querySelector('#niKey').value || '').trim();
    if(!key){ body.innerHTML = '<div class="status-msg err">Colle ta clé API IVAO (developers.ivao.aero).</div>'; return; }
    if(ov.querySelector('#niRemember').checked) c.ivaoKey = key; else delete c.ivaoKey;
    c.ivaoVid = id;
  } else c.vatsimCid = id;
  c.lastNet = NI.net;
  if(db.userProfile){
    if(NI.net === 'vatsim' && !db.userProfile.vatsimId) db.userProfile.vatsimId = id;
    if(NI.net === 'ivao' && !db.userProfile.ivaoId) db.userProfile.ivaoId = id;
  }
  queueSaveDb();
  NI.busy = true;
  const go = ov.querySelector('#niGo');
  go.disabled = true; go.classList.add('is-busy');
  body.innerHTML = `<div class="ni-loading"><span class="fb-spinner"></span>Recherche de tes vols ${NI.net === 'vatsim' ? 'VATSIM' : 'IVAO'}… (quelques secondes)</div>`;
  let r;
  try{ r = NI.net === 'vatsim' ? await window.logbookIO.vatsim(id) : await window.logbookIO.ivao(id, key); }
  catch(e){ r = { ok: false, error: e.message || String(e) }; }
  NI.busy = false;
  if(!document.body.contains(ov)) return;
  go.disabled = false; go.classList.remove('is-busy');
  NI.result = r;
  niRenderBody(ov);
}
function niRenderBody(ov){
  const body = ov.querySelector('#niBody');
  const r = NI.result;
  if(!r){ body.innerHTML = ''; return; }
  if(!r.ok){
    body.innerHTML = `<div class="status-msg err">${esc(r.error || 'Échec de la recherche.')}</div>`
      + (r.code === 'auth' && NI.net === 'ivao' ? '<div class="hint">Vérifie que la clé est active et autorisée à lire le tracker IVAO.</div>' : '');
    return;
  }
  const dd = FBImport.dedupe(r.flights, db.logbook);
  const fresh = new Set(dd.flights.map(f => f.id));
  const all = r.flights.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  if(!all.length){
    body.innerHTML = `<div class="status-msg warn">Aucun vol trouvé${r.scanned && r.scanned.flightplans === 0 ? ' : aucun plan de vol récent sur ce compte' : ''}.</div>`;
    return;
  }
  const careerOpts = '<option value="">Aucune carrière</option>' + db.careers.map(c => `<option value="${esc(c.id)}"${c.type === (NI.net === 'vatsim' ? 'VATSIM' : 'IVAO') ? ' data-pref="1"' : ''}>${esc(c.name)}</option>`).join('');
  body.innerHTML = `
    <div class="status-msg ${dd.flights.length ? 'ok' : 'warn'}">${all.length} vol${all.length > 1 ? 's' : ''} trouvé${all.length > 1 ? 's' : ''} · ${dd.flights.length} nouveau${dd.flights.length > 1 ? 'x' : ''} · ${dd.skipped.duplicate} déjà dans le logbook</div>
    <div class="ni-list"><table><thead><tr><th><input type="checkbox" id="niAll" ${dd.flights.length ? 'checked' : ''} title="Tout cocher / décocher"></th><th>Date</th><th>Indicatif</th><th>Trajet</th><th>Appareil</th><th>Règles</th><th>Durée</th></tr></thead><tbody>
    ${all.map(f => `<tr class="${fresh.has(f.id) ? '' : 'dup'}"><td><input type="checkbox" data-id="${esc(f.id)}" ${fresh.has(f.id) ? 'checked' : 'disabled title="Déjà dans le logbook"'}></td>
      <td>${esc(f.date)}</td><td>${esc(f.callsign || '—')}</td><td>${esc(f.dep)} → ${esc(f.arr)}</td><td>${esc(f.aircraft || '—')}</td><td>${f.rules ? `<span class="pill ${esc(f.rules.toLowerCase())}">${esc(f.rules)}</span>` : '—'}</td><td>${f.durationMin ? minToHhmm(f.durationMin) : '—'}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="ni-form" style="margin-top:12px;">
      <div class="field"><label>Lier les vols importés à</label><select id="niCareer">${careerOpts}</select></div>
      <button class="btn primary" id="niImport" ${dd.flights.length ? '' : 'disabled'}>Importer</button>
    </div>`;
  const sel = body.querySelector('#niCareer');
  const pref = sel.querySelector('option[data-pref]');
  if(pref) sel.value = pref.value;
  const boxes = () => [...body.querySelectorAll('input[data-id]:not(:disabled)')];
  const refreshBtn = () => { const n = boxes().filter(b => b.checked).length; const b = body.querySelector('#niImport'); b.disabled = !n; b.textContent = `Importer ${n} vol${n > 1 ? 's' : ''}`; };
  body.querySelector('#niAll').onchange = e => { boxes().forEach(b => b.checked = e.target.checked); refreshBtn(); };
  boxes().forEach(b => b.onchange = refreshBtn);
  refreshBtn();
  body.querySelector('#niImport').onclick = async () => {
    const btn = body.querySelector('#niImport');
    if(btn.disabled) return;
    btn.disabled = true; btn.classList.add('is-busy');
    const ids = new Set(boxes().filter(b => b.checked).map(b => b.dataset.id));
    const careerId = sel.value || null;
    const chosen = FBImport.dedupe(r.flights.filter(f => ids.has(f.id)), db.logbook).flights
      .map(f => ({ ...f, careerId, aircraftId: null }));
    db.logbook = [...chosen, ...db.logbook].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    renderLogbook();
    await saveDbNow();
    if(window.FBv15 && FBv15.afterLogbookChange) FBv15.afterLogbookChange();
    body.innerHTML = `<div class="status-msg ok">${chosen.length} vol${chosen.length > 1 ? 's' : ''} importé${chosen.length > 1 ? 's' : ''} ✓</div>`;
    notice({ kind: 'ok', title: 'Import terminé', text: `${chosen.length} vol${chosen.length > 1 ? 's' : ''} ${NI.net === 'vatsim' ? 'VATSIM' : 'IVAO'} ajouté${chosen.length > 1 ? 's' : ''} au logbook`, ms: 4000 });
  };
}

/* ---------------- Carrière : étapes validées après chaque changement du logbook ---------------- */
function wrapLogbookHook(){
  if(!window.FBv15 || FBv15.__v21Hook) return;
  FBv15.__v21Hook = true;
  const orig = FBv15.afterLogbookChange;
  FBv15.afterLogbookChange = function(){
    const r = orig ? orig.apply(this, arguments) : undefined;
    try{
      if(typeof autoValidateTours === 'function' && autoValidateTours(true)){
        if(document.querySelector('#view-career.active')) renderCareers();
        else { renderTours(); renderBriefingTourMatch(); }
      }
    }catch(e){ console.warn('FlightBrief: validation auto des tours', e); }
    return r;
  };
}

/* ---------------- Events VATSIM + IVAO ----------------
   Onglet Outils : liste filtrable + fiche détaillée. Carte du Briefing : terrains des events
   en surbrillance (anneau pulsé = en cours, pointillé = à venir). Briefing : alerte si le
   départ ou l'arrivée accueille un event. */
const EV_NET = { vatsim: { label: 'VATSIM', color: '#3ee0a8' }, ivao: { label: 'IVAO', color: '#5b93ff' } };
const EV = { data: null, busy: false, timer: null, layer: null, routeLayer: null, q: '' };
function evCfg(){
  db.eventsCfg = Object.assign({ map: true, vatsim: true, ivao: true, period: 'week', mapHours: 24 }, db.eventsCfg || {});
  return db.eventsCfg;
}
const evRunning = (e, now) => e.start <= (now || Date.now()) && e.end > (now || Date.now());
function evLocale(){ return (window.FBI18N && FBI18N.locale && FBI18N.locale()) || 'fr-FR'; }
function evFmtDay(t){
  const d = new Date(t), today = new Date(); today.setHours(0, 0, 0, 0);
  const day = new Date(d); day.setHours(0, 0, 0, 0);
  const diff = Math.round((day - today) / 86400000);
  if(diff === 0) return "Aujourd'hui";
  if(diff === 1) return 'Demain';
  if(diff === -1) return 'Hier';
  const s = d.toLocaleDateString(evLocale(), { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
const evHm = t => new Date(t).toLocaleTimeString(evLocale(), { hour: '2-digit', minute: '2-digit' });
const evUtc = t => new Date(t).toISOString().slice(11, 16) + 'z';
function evDur(ms){ const m = Math.max(0, Math.round(ms / 60000)); return m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ' ' + String(m % 60).padStart(2, '0') : ''}` : `${m} min`; }
function evWhen(e, now){
  now = now || Date.now();
  if(evRunning(e, now)) return { cls: 'live', text: `En cours · encore ${evDur(e.end - now)}` };
  if(e.end <= now) return { cls: 'past', text: 'Terminé' };
  const ms = e.start - now;
  return { cls: ms < 6 * 3600000 ? 'soon' : '', text: ms < 24 * 3600000 ? `Dans ${evDur(ms)}` : `${evFmtDay(e.start)} ${evHm(e.start)}` };
}
function evFiltered(forMap){
  const c = evCfg(), now = Date.now();
  const list = (EV.data && EV.data.events) || [];
  const horizon = forMap ? now + c.mapHours * 3600000
    : c.period === 'live' ? now : c.period === 'today' ? new Date(new Date().setHours(24, 0, 0, 0)).getTime()
    : c.period === '48h' ? now + 48 * 3600000 : c.period === 'week' ? now + 7 * 86400000 : Infinity;
  const q = forMap ? '' : lbNorm(EV.q || '');
  return list.filter(e => c[e.network] && e.end > now && e.start <= horizon
    && (!q || lbNorm([e.name, e.organisers.join(' '), ...e.airports.map(a => a.icao + ' ' + a.name)].join(' ')).includes(q)));
}

async function eventsRefresh(force){
  if(!window.netEvents || EV.busy) return;
  EV.busy = true;
  const btn = $('evRefreshBtn');
  if(btn){ btn.disabled = true; btn.classList.add('is-busy'); }
  if(!EV.data && $('evList')) $('evList').innerHTML = '<div class="ni-loading"><span class="fb-spinner"></span>Chargement des events VATSIM et IVAO…</div>';
  const userAsked = !!force;
  if(userAsked) mapLoader(true, 'Chargement des events…');
  try{ EV.data = await window.netEvents.get(!!force); }
  catch(e){ if(!EV.data) EV.data = { events: [], status: { vatsim: { ok: false, error: e.message }, ivao: { ok: false, error: e.message } } }; }
  finally{
    EV.busy = false;
    if(btn){ btn.disabled = false; btn.classList.remove('is-busy'); }
    if(userAsked) mapLoader(false);
  }
  renderEventsList();
  renderEventsMap();
  renderBriefingEventMatch();
}
FBv21.eventsRefresh = eventsRefresh;

function renderEventsList(){
  const box = $('evList');
  if(!box) return;
  const c = evCfg();
  document.querySelectorAll('#evCard [data-evnet]').forEach(b => b.classList.toggle('on', !!c[b.dataset.evnet]));
  if($('evPeriod')) $('evPeriod').value = c.period;
  if($('evMapHours')) $('evMapHours').value = String(c.mapHours);
  if($('evMapOn')) $('evMapOn').checked = !!c.map;
  if(!EV.data){ return; }
  const st = EV.data.status || {};
  const errs = ['vatsim', 'ivao'].filter(n => c[n] && st[n] && !st[n].ok).map(n => `${EV_NET[n].label} injoignable (${esc(st[n].error || '?')})`);
  $('evUpdated').textContent = EV.data.at ? 'Mis à jour à ' + evHm(EV.data.at) : '';
  const list = evFiltered(false), now = Date.now();
  if(!list.length){
    box.innerHTML = (errs.length ? `<div class="status-msg err">${errs.join(' · ')}</div>` : '') + '<div class="hint">Aucun event pour ces filtres.</div>';
    return;
  }
  // Regroupés par jour (les events en cours en tête).
  const groups = new Map();
  list.forEach(e => {
    const k = evRunning(e, now) ? 'En ce moment' : evFmtDay(e.start);
    if(!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  });
  let html = errs.length ? `<div class="status-msg err">${errs.join(' · ')}</div>` : '';
  html += `<div class="ev-count">${list.length} event${list.length > 1 ? 's' : ''}</div>`;
  groups.forEach((evs, day) => {
    html += `<div class="ev-day">${esc(day)}</div>`;
    html += evs.slice(0, 120).map(e => {
      const w = evWhen(e, now);
      const aps = e.airports.slice(0, 6).map(a => `<span class="ev-ap" title="${esc(a.name || a.icao)}">${esc(a.icao)}</span>`).join('') + (e.airports.length > 6 ? `<span class="ev-ap more">+${e.airports.length - 6}</span>` : '');
      return `<button class="ev-row ${w.cls}" style="--ev:${EV_NET[e.network].color}" onclick="FBv21.eventOpen('${esc(e.id)}')">
        <span class="ev-net">${EV_NET[e.network].label}</span>
        <span class="ev-main"><b>${esc(e.name)}</b><span class="ev-aps">${aps}</span></span>
        <span class="ev-time"><span class="ev-when ${w.cls}">${esc(w.text)}</span><small>${evHm(e.start)} – ${evHm(e.end)} · ${evUtc(e.start)}–${evUtc(e.end)}</small></span>
      </button>`;
    }).join('');
  });
  box.innerHTML = html;
}

FBv21.eventsSet = function(k, v){
  const c = evCfg();
  if(k === 'vatsim' || k === 'ivao' || k === 'map') c[k] = v === undefined ? !c[k] : !!v;
  else if(k === 'period') c.period = v;
  else if(k === 'mapHours') c.mapHours = Math.max(1, +v || 24);
  queueSaveDb();
  renderEventsList();
  renderEventsMap();
  if(window.FBv15 && FBv15.renderAtcChips) FBv15.renderAtcChips();
};
FBv21.eventsSearch = function(q){ EV.q = q; renderEventsList(); };
FBv21.eventsToggleMap = async function(){
  const c = evCfg();
  c.map = !c.map;
  queueSaveDb();
  if(c.map && !EV.data){ await eventsRefresh(true); }
  else { mapLoader(true, c.map ? 'Affichage des events…' : 'Retrait des events…'); await nextPaint(); renderEventsMap(); await nextPaint(); mapLoader(false); }
  if(window.FBv15 && FBv15.renderAtcChips) FBv15.renderAtcChips();
  renderEventsList();
};
FBv21.eventsMapCount = function(){ const c = evCfg(); return c.map && EV.data ? evAirportGroups().size : null; };
FBv21.eventsMapOn = () => !!evCfg().map;

/* ---- carte du Briefing ---- */
function evAirportGroups(){
  const groups = new Map();
  evFiltered(true).forEach(e => e.airports.forEach(a => {
    if(a.lat == null || a.lon == null) return;
    if(!groups.has(a.icao)) groups.set(a.icao, { ap: a, events: [] });
    groups.get(a.icao).events.push(e);
  }));
  return groups;
}
function evPopup(g){
  const now = Date.now();
  return `<div class="atc-pop"><div class="atc-pop-h">🎉 ${esc(g.ap.icao)}${g.ap.name ? ' · ' + esc(g.ap.name) : ''}</div>
    ${g.events.map(e => { const w = evWhen(e, now); return `<div class="ev-pop-row"><i style="background:${EV_NET[e.network].color}"></i><div><b>${esc(e.name)}</b><small>${EV_NET[e.network].label} · ${esc(w.text)} · ${evHm(e.start)}–${evHm(e.end)}</small></div><button class="icon-btn" onclick="FBv21.eventOpen('${esc(e.id)}')">Détails</button></div>`; }).join('')}</div>`;
}
function renderEventsMap(){
  if(typeof trackMap === 'undefined' || !trackMap || !window.L) return;
  if(!trackMap.getPane('eventAirports')){ trackMap.createPane('eventAirports').style.zIndex = 585; }
  if(!EV.layer) EV.layer = L.layerGroup().addTo(trackMap);
  EV.layer.clearLayers();
  const c = evCfg();
  if(window.FBv15 && FBv15.renderAtcChips) FBv15.renderAtcChips();
  if(!c.map || !EV.data) return;
  const now = Date.now();
  evAirportGroups().forEach(g => {
    const nets = [...new Set(g.events.map(e => e.network))];
    const live = g.events.some(e => evRunning(e, now));
    const col = nets.length > 1 ? `conic-gradient(${EV_NET.vatsim.color} 0 50%, ${EV_NET.ivao.color} 50% 100%)` : EV_NET[nets[0]].color;
    const first = g.events.slice().sort((a, b) => a.start - b.start)[0];
    L.marker([g.ap.lat, g.ap.lon], { pane: 'eventAirports', keyboard: false, icon: L.divIcon({ className: 'ev-mk-wrap', iconSize: null,
      html: `<div class="ev-mk${live ? ' live' : ''}" style="--ev:${EV_NET[nets[0]].color}; --evbg:${col}"><i></i><span>${esc(g.ap.icao)}${g.events.length > 1 ? ` <b>×${g.events.length}</b>` : ''}</span></div>` }) })
      .bindPopup(() => evPopup(g), { className: 'atc-popup', maxWidth: 380 })
      .bindTooltip(`<b>${esc(g.ap.icao)}</b> · ${esc(first.name)}${g.events.length > 1 ? ` (+${g.events.length - 1})` : ''}<br>${esc(evWhen(first, now).text)}`, { className: 'atc-tip', direction: 'top', offset: [0, -14] })
      .addTo(EV.layer);
  });
}
// Mise en avant d'un event sur la carte : terrains + routes, vue cadrée dessus.
function showEventOnMap(e){
  switchView('briefing');
  setTimeout(() => {
    if(typeof trackMap === 'undefined' || !trackMap) return;
    if(!evCfg().map){ evCfg().map = true; queueSaveDb(); renderEventsMap(); if(window.FBv15 && FBv15.renderAtcChips) FBv15.renderAtcChips(); }
    if(typeof setTrackFollow === 'function') setTrackFollow(false, true);
    if(EV.routeLayer) EV.routeLayer.clearLayers(); else EV.routeLayer = L.layerGroup().addTo(trackMap);
    const pts = [];
    const ap = ic => e.airports.find(a => a.icao === ic && a.lat != null);
    e.routes.forEach(r => {
      const a = ap(r.dep), b = ap(r.arr);
      if(a && b) L.polyline(FBShared.greatCirclePoints(a, b, 32), { pane: 'eventAirports', color: EV_NET[e.network].color, weight: 2, opacity: .8, dashArray: '6 6' }).bindTooltip(`${r.dep} → ${r.arr}`, { className: 'atc-tip', sticky: true }).addTo(EV.routeLayer);
    });
    e.airports.filter(a => a.lat != null).forEach(a => {
      pts.push([a.lat, a.lon]);
      L.circleMarker([a.lat, a.lon], { pane: 'eventAirports', radius: 16, color: EV_NET[e.network].color, weight: 2, fillOpacity: .12, interactive: false }).addTo(EV.routeLayer);
    });
    if(pts.length > 1) trackMap.fitBounds(L.latLngBounds(pts), { padding: [50, 50], maxZoom: 9 });
    else if(pts.length) trackMap.setView(pts[0], 8);
    clearTimeout(EV.routeTimer);
    EV.routeTimer = setTimeout(() => EV.routeLayer && EV.routeLayer.clearLayers(), 60000);
  }, 120);
}

/* ---- fiche détaillée ---- */
FBv21.eventOpen = function(id){
  const e = EV.data && EV.data.events.find(x => x.id === id);
  if(!e) return;
  const ov = $('evModalOverlay'), box = $('evModal');
  const now = Date.now(), w = evWhen(e, now);
  const fmtFull = t => new Date(t).toLocaleString(evLocale(), { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  const known = e.airports.filter(a => a.lat != null);
  box.innerHTML = `
    <div class="modal-head"><div><div class="ev-net-pill" style="--ev:${EV_NET[e.network].color}">${EV_NET[e.network].label}${e.type && !/^event$/i.test(e.type) ? ' · ' + esc(e.type) : ''}</div><h3 style="margin-top:6px;">${esc(e.name)}</h3></div><button class="icon-btn" onclick="FBv21.eventClose()">Fermer</button></div>
    ${e.banner ? `<img class="ev-banner" src="${esc(e.banner)}" alt="" onerror="this.remove()">` : ''}
    <div class="telemetry-grid ev-stats">
      <div class="tstat"><div class="cap">Statut</div><div class="val val-sm"><span class="ev-when ${w.cls}">${esc(w.text)}</span></div></div>
      <div class="tstat"><div class="cap">Début</div><div class="val val-sm">${esc(fmtFull(e.start))}<br><small class="muted">${evUtc(e.start)}</small></div></div>
      <div class="tstat"><div class="cap">Fin</div><div class="val val-sm">${esc(fmtFull(e.end))}<br><small class="muted">${evUtc(e.end)}</small></div></div>
      <div class="tstat"><div class="cap">Organisé par</div><div class="val val-sm">${e.organisers.length ? esc(e.organisers.join(', ')) : '—'}</div></div>
    </div>
    <h4 class="modal-subhead">Terrains (${e.airports.length})</h4>
    <div class="ev-aps-list">${e.airports.map(a => `<div class="ev-ap-card"><b>${esc(a.icao)}</b><span>${esc(a.name || (a.lat == null ? 'Secteur / terrain hors index' : ''))}</span>
      ${a.lat != null ? `<div class="ev-ap-btns"><button class="icon-btn" onclick="FBv21.eventUseAirport('${esc(a.icao)}','dep')" title="Mettre en départ du Briefing">Départ</button><button class="icon-btn" onclick="FBv21.eventUseAirport('${esc(a.icao)}','arr')" title="Mettre en arrivée du Briefing">Arrivée</button></div>` : ''}</div>`).join('')}</div>
    ${e.routes.length ? `<h4 class="modal-subhead">Routes proposées (${e.routes.length})</h4>
      <div class="ev-routes">${e.routes.slice(0, 40).map(r => `<div class="ev-route"><b>${esc(r.dep)} → ${esc(r.arr)}</b><code>${esc(r.route || '—')}</code><button class="icon-btn" onclick="FBv21.eventUseRoute('${esc(e.id)}','${esc(r.dep)}','${esc(r.arr)}')" title="Remplir le Briefing avec ce départ, cette arrivée et cette route">Briefing</button></div>`).join('')}</div>` : ''}
    ${e.description ? `<h4 class="modal-subhead">Description</h4><div class="ev-desc">${esc(e.description)}</div>` : ''}
    <div class="btn-row" style="margin-top:14px;">
      ${known.length ? `<button class="btn primary" onclick="FBv21.eventShowMap('${esc(e.id)}')">🗺️ Voir sur la carte du Briefing</button>` : ''}
      ${e.link ? `<button class="btn" onclick="window.api.openExternal('${esc(e.link)}')">Page de l'event ↗</button>` : ''}
    </div>`;
  ov.classList.remove('hidden');
  box.scrollTop = 0;
};
FBv21.eventClose = () => $('evModalOverlay').classList.add('hidden');
FBv21.eventShowMap = function(id){
  const e = EV.data && EV.data.events.find(x => x.id === id);
  if(!e) return;
  FBv21.eventClose();
  showEventOnMap(e);
};
function setBriefingField(id, v){ const i = el(id); if(!i) return; i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); }
FBv21.eventUseAirport = function(icao, which){
  const a = EV.data && EV.data.events.flatMap(e => e.airports).find(x => x.icao === icao);
  setBriefingField(which === 'dep' ? 'depIcao' : 'arrIcao', icao);
  if(a && a.name) setBriefingField(which === 'dep' ? 'depName' : 'arrName', a.name);
  render();
  notice({ kind: 'ok', title: which === 'dep' ? 'Départ du Briefing' : 'Arrivée du Briefing', text: `${icao}${a && a.name ? ' · ' + a.name : ''}`, ms: 2500, sound: false });
};
FBv21.eventUseRoute = function(id, dep, arr){
  const e = EV.data && EV.data.events.find(x => x.id === id);
  const r = e && e.routes.find(x => x.dep === dep && x.arr === arr);
  if(!r) return;
  FBv21.eventUseAirport(dep, 'dep');
  FBv21.eventUseAirport(arr, 'arr');
  setBriefingField('routeText', `${dep} ${r.route} ${arr}`.trim());
  render();
  FBv21.eventClose();
  switchView('briefing');
};

/* ---- Briefing : le départ ou l'arrivée accueille-t-il un event ? ---- */
function renderBriefingEventMatch(){
  const box = $('briefingEventMatch');
  if(!box) return;
  const dep = (el('depIcao').value || '').trim().toUpperCase(), arr = (el('arrIcao').value || '').trim().toUpperCase();
  const now = Date.now(), soon = now + 48 * 3600000;
  const hits = [];
  ((EV.data && EV.data.events) || []).forEach(e => {
    if(e.end <= now || e.start > soon) return;
    [[dep, 'départ'], [arr, 'arrivée']].forEach(([ic, role]) => { if(ic.length === 4 && e.airports.some(a => a.icao === ic)) hits.push({ e, ic, role }); });
  });
  if(!hits.length){ box.innerHTML = ''; box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  box.innerHTML = hits.slice(0, 4).map(({ e, ic, role }) => { const w = evWhen(e, now); return `<button class="tm-item ev-match" style="--ev:${EV_NET[e.network].color}" onclick="FBv21.eventOpen('${esc(e.id)}')">
    <span class="tm-icon">🎉</span><span class="tm-text"><b>Event ${EV_NET[e.network].label} à ${esc(ic)}</b> (${role})<small>${esc(e.name)}</small></span><span class="tm-state ${w.cls === 'live' ? 'next' : ''}">${esc(w.text)}</span><span class="tm-go">Voir ›</span></button>`; }).join('');
}

function initEvents(){
  if(EV.inited) return;
  EV.inited = true;
  ['depIcao', 'arrIcao'].forEach(id => { const i = el(id); if(i) i.addEventListener('input', debounce(renderBriefingEventMatch, 250)); });
  const toolsBtn = document.querySelector('.tabs button[data-view="tools"]');
  if(toolsBtn) toolsBtn.addEventListener('click', () => { if(!EV.data || Date.now() - (EV.data.at || 0) > 15 * 60000) eventsRefresh(false); else renderEventsList(); });
  renderEventsList();
  eventsRefresh(false);
  EV.timer = setInterval(() => { if(!document.hidden) eventsRefresh(false); }, 15 * 60000);
  // Statuts « en cours / dans X h » à jour sans recharger.
  setInterval(() => { if(!document.hidden){ renderEventsMap(); if(document.querySelector('#view-tools.active')) renderEventsList(); } }, 5 * 60000);
}

/* ---------------- (i) d'aide : bulle flottante ----------------
   Positionnée en fixe par-dessus tout : jamais rognée par un panneau qui défile. */
let tipEl = null, tipFor = null;
function showTip(t){
  const text = t.getAttribute('data-tip');
  if(!text) return;
  if(!tipEl){ tipEl = document.createElement('div'); tipEl.className = 'fb-tip'; tipEl.setAttribute('role', 'tooltip'); document.body.appendChild(tipEl); }
  tipFor = t;
  tipEl.textContent = text;
  tipEl.classList.add('on');
  const r = t.getBoundingClientRect(), w = tipEl.offsetWidth, h = tipEl.offsetHeight, m = 8;
  let x = Math.min(window.innerWidth - w - m, Math.max(m, r.left + r.width / 2 - w / 2));
  let y = r.top - h - 8;
  if(y < m) y = r.bottom + 8;
  tipEl.style.left = Math.round(x) + 'px'; tipEl.style.top = Math.round(y) + 'px';
}
function hideTip(t){ if(tipEl && (!t || t === tipFor)){ tipEl.classList.remove('on'); tipFor = null; } }
function bindTips(){
  if(document.__fbTips) return;
  document.__fbTips = true;
  document.addEventListener('mouseover', e => { const t = e.target.closest && e.target.closest('.info-tip'); if(t) showTip(t); });
  document.addEventListener('mouseout', e => { const t = e.target.closest && e.target.closest('.info-tip'); if(t && !t.contains(e.relatedTarget)) hideTip(t); });
  document.addEventListener('focusin', e => { if(e.target.classList && e.target.classList.contains('info-tip')) showTip(e.target); });
  document.addEventListener('focusout', e => { if(e.target.classList && e.target.classList.contains('info-tip')) hideTip(e.target); });
  window.addEventListener('scroll', () => hideTip(), true);
}
bindTips();

/* ---------------- Démarrage ---------------- */
function init(){
  wrapBriefingLoaders();
  wrapLogbookHook();
  makeCollapsible('copilotPanel', '.cp-head');
  makeCollapsible('atcPanel', '.atc-head', '.atc-head-right');
  initEvents();
}
// Données chargées (signal fb:ready d'app.js) : on démarre sans attendre les autres modules.
// app.js appelle aussi FBv21.init() en fin de démarrage ; tout est idempotent.
FBv21.init = async function(){ init(); };
if(window.__fbAppReady) init();
else window.addEventListener('fb:ready', init, { once: true });
})();
