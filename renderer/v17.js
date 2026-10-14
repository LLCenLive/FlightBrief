/* =========================================================
   FlightBrief 1.7 — outils de vol pour tous les simmers (interface)
   ---------------------------------------------------------
   • Copilote vocal : annonces à voix haute (synthèse vocale du PC, rien en ligne), moteur dans copilot.js.
   ========================================================= */
(function(){
'use strict';
const FBv17 = {};
window.FBv17 = FBv17;
const $ = id => document.getElementById(id);
const esc = s => escapeHtml(s == null ? '' : String(s));

/* ---------------- Copilote vocal (moteur : copilot.js) ---------------- */
const CP_GROUPS = [
  ['takeoff', 'Décollage', '80 nœuds, vario positif, train resté sorti'],
  ['climb', 'Montée & croisière', 'Calage standard, niveau 100, 1000 ft avant le niveau, niveau atteint, début de descente'],
  ['approach', 'Descente & approche', 'QNH, niveau 100 (vitesse, phares, ceintures), 1000 ft stabilisé ou non, 500, minimums'],
  ['alerts', 'Alertes', 'Taux de descente, inclinaison, train non sorti, 250 kt sous le FL100, carburant bas'],
  ['landing', 'Atterrissage', '100, 50, 40, 30, 20 (« Retard » sur Airbus), 10, taux au toucher, 60 nœuds'],
  ['cabin', 'Annonces cabine', 'Bienvenue à bord, croisière, descente, arrivée — façon commandant de bord']
];
function cpCfg(){ const d = FBCopilot.DEFAULTS, c = db.copilot || {}; db.copilot = { ...d, ...c, groups: { ...d.groups, ...(c.groups || {}) } }; return db.copilot; }
const copilot = FBCopilot.create();
function voices(){ return window.speechSynthesis ? speechSynthesis.getVoices() : []; }
function speak(text, force){
  const c = cpCfg();
  if((!c.enabled && !force) || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance(FBI18N.tr(text));
  u.lang = FBI18N.locale();
  const vs = voices(), v = vs.find(x => x.name === c.voice) || vs.find(x => (x.lang || '').slice(0, 2) === FBI18N.lang);
  if(v) u.voice = v;
  u.volume = Math.max(0, Math.min(1, c.volume / 100));
  u.rate = Math.max(.5, Math.min(2, c.rate || 1));
  speechSynthesis.speak(u);
}
FBv17.speak = speak;
const GRADE_WORDS = { butter: 'un vrai beurre', smooth: 'atterrissage doux', firm: 'atterrissage ferme', hard: 'atterrissage dur' };
// Contexte du vol pour le moteur : type d'avion, niveau de croisière prévu, ETA, début de descente.
function cpCtx(t){
  const s = (t && t.sys) || {}, ot = typeof _overlayTelemetry !== 'undefined' ? _overlayTelemetry : {};
  const ac = `${(t && t.title) || ''} ${$('aircraft') ? $('aircraft').value : ''}`;
  const alt = String(($('altitude') && $('altitude').value) || '').toUpperCase().replace(/\s/g, ''), m = alt.match(/^FL(\d{2,3})$/) || alt.match(/^(\d{4,5})/);
  const cruise = (db.ofp && db.ofp.cruiseAltFt) || (m ? (alt.startsWith('FL') ? +m[1] * 100 : +m[1]) : null);
  return {
    cfg: cpCfg(), airliner: s.engines >= 2 && (s.engType === 1 || s.engType === 5), airbus: /airbus|fenix|\bA3[0-9]{2}|\bA2[01]N|\bA3[0-9]N/i.test(ac),
    cruiseAltFt: cruise, todMin: ot.todMin, todState: ot.todState, remainingNm: ot.remainingNm,
    eta: ot.etaIso ? new Date(ot.etaIso).toLocaleTimeString(FBI18N.locale(), { hour: '2-digit', minute: '2-digit' }) : null,
    arr: ($('arrName') && $('arrName').value.trim()) || ($('arrIcao') && $('arrIcao').value.trim().toUpperCase()) || null
  };
}
let cpLastT = null;
function copilotTick(t){ cpLastT = t; if(cpCfg().enabled && t) copilot.tick(t, cpCtx(t)).forEach(x => speak(x)); }
FBv17.copilotTest = () => speak('Copilote vocal prêt. Bon vol !', true);
FBv17.copilotBrief = () => speak(copilot.brief(cpLastT, cpCtx(cpLastT)).map(x => FBI18N.tr(x)).join(', ') + '.', true);
FBv17.copilotToggle = on => {
  const c = cpCfg();
  c.enabled = on == null ? !c.enabled : !!on;
  if($('cpEnabled')) $('cpEnabled').checked = c.enabled;
  queueSaveDb();
  if(c.enabled) speak('Copilote vocal activé.');
  return c.enabled;
};
FBv17.copilotVolume = delta => {
  const c = cpCfg();
  c.volume = Math.max(0, Math.min(100, c.volume + delta));
  if($('cpVolume')){ $('cpVolume').value = c.volume; $('cpVolumeVal').textContent = c.volume + ' %'; updateRangeFill($('cpVolume')); }
  queueSaveDb();
  return c.volume;
};
function fillVoices(){
  const c = cpCfg(), list = voices().filter(v => (v.lang || '').slice(0, 2) === FBI18N.lang);
  $('cpVoice').innerHTML = `<option value="">${esc(FBI18N.tr('Automatique'))}</option>` + list.map(v => `<option value="${esc(v.name)}">${esc(v.name)}</option>`).join('');
  $('cpVoice').value = list.some(v => v.name === c.voice) ? c.voice : '';
}
function bindCopilot(){
  const c = cpCfg();
  $('cpEnabled').checked = c.enabled;
  $('cpGroups').innerHTML = CP_GROUPS.map(([k, t, d]) => `<label class="cp-group"><input type="checkbox" data-g="${k}" ${c.groups[k] ? 'checked' : ''}><span><b>${esc(t)}</b><small>${esc(d)}</small></span></label>`).join('');
  $('cpGroups').querySelectorAll('input[data-g]').forEach(i => i.addEventListener('change', () => { cpCfg().groups[i.dataset.g] = i.checked; queueSaveDb(); }));
  const rng = (id, v, suf) => { $(id).value = v; $(id + 'Val').textContent = v + suf; updateRangeFill($(id)); };
  rng('cpVolume', c.volume, ' %'); rng('cpRate', Math.round((c.rate || 1) * 100), ' %');
  $('cpTa').value = c.ta; $('cpMins').value = c.minimums;
  fillVoices(); if(window.speechSynthesis) speechSynthesis.onvoiceschanged = fillVoices;
  $('cpEnabled').addEventListener('change', e => FBv17.copilotToggle(e.target.checked));
  $('cpVoice').addEventListener('change', e => { cpCfg().voice = e.target.value; queueSaveDb(); FBv17.copilotTest(); });
  $('cpVolume').addEventListener('input', e => { cpCfg().volume = +e.target.value; $('cpVolumeVal').textContent = e.target.value + ' %'; updateRangeFill(e.target); queueSaveDb(); });
  $('cpRate').addEventListener('input', e => { cpCfg().rate = +e.target.value / 100; $('cpRateVal').textContent = e.target.value + ' %'; updateRangeFill(e.target); queueSaveDb(); });
  $('cpTa').addEventListener('change', e => { cpCfg().ta = Math.max(1000, Math.min(18000, +e.target.value || 5000)); e.target.value = cpCfg().ta; queueSaveDb(); });
  $('cpMins').addEventListener('change', e => { cpCfg().minimums = Math.max(0, Math.min(1500, +e.target.value || 0)); e.target.value = cpCfg().minimums; queueSaveDb(); });
}

/* ---------------- Liens vers les cartes (Briefing) ---------------- */
function renderChartLinks(){
  const box = $('chartLinks');
  if(!box) return;
  const aps = [...new Set(['depIcao', 'arrIcao'].map(id => ($(id).value || '').trim().toUpperCase()).filter(x => /^[A-Z0-9]{4}$/.test(x)))];
  box.innerHTML = aps.length ? '<span>Cartes :</span>' + aps.map(ic => `<b>${esc(ic)}</b>` + FBShared.chartLinks(ic).map(c => `<a data-url="${esc(c.url)}">${esc(c.label)}</a>`).join('')).join('') : '';
}

/* ---------------- « Où voler aujourd'hui ? » ---------------- */
const CAT_LABEL = { light: 'Avion léger', medium: 'Moyen-courrier', heavy: 'Gros porteur', jumbo: 'Très gros porteur' };
function flyDefaults(){
  const last = (db.logbook || []).slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0];
  const from = ($('depIcao').value || '').trim() || (last && last.arr) || (db.userProfile && db.userProfile.homeBase) || '';
  if(!$('flyFrom').value) $('flyFrom').value = from.toUpperCase();
  const cur = $('flyAircraft').value;
  $('flyAircraft').innerHTML = (db.hangar || []).map(a => `<option value="hg:${esc(a.id)}">${esc(a.name)}${a.icaoType ? ' · ' + esc(a.icaoType) : ''}</option>`).join('')
    + Object.entries(CAT_LABEL).map(([k, v]) => `<option value="cat:${k}">${esc(v)}</option>`).join('');
  if(cur) $('flyAircraft').value = cur; else if(!(db.hangar || []).length) $('flyAircraft').value = 'cat:medium';
  const fp = db.flyPrefs || {}; $('flyMode').value = fp.mode || 'new'; $('flyAtc').checked = !!fp.preferAtc;
}
FBv17.flyOpen = () => { switchView('tools'); flyDefaults(); $('flyCard').scrollIntoView({ behavior: 'smooth' }); };
let flyLast = null;
FBv17.flySuggest = async () => {
  const out = $('flyResults');
  const sel = $('flyAircraft').value || 'cat:medium';
  const hg = sel.startsWith('hg:') ? (db.hangar || []).find(a => 'hg:' + a.id === sel) : null;
  const profile = hg ? (['light', 'medium', 'heavy', 'jumbo'].includes(hg.category) ? hg.category : 'medium') : sel.slice(4);
  const favCounts = {};
  (db.logbook || []).forEach(f => [f.dep, f.arr].filter(Boolean).forEach(x => { const k = String(x).toUpperCase(); favCounts[k] = (favCounts[k] || 0) + 1; }));
  const fp = db.flyPrefs = { mode: $('flyMode').value, preferAtc: $('flyAtc').checked }; queueSaveDb();
  out.innerHTML = '<div class="hint">Recherche des destinations, de la météo, de l\'ATC en ligne et des events…</div>';
  const r = await window.fly.suggest({ from: $('flyFrom').value.trim().toUpperCase(), minutes: +$('flyTime').value, profile, visited: Object.keys(favCounts), favCounts, mode: fp.mode, preferAtc: fp.preferAtc });
  if(!r.ok){ out.innerHTML = `<div class="status-msg err">${esc(r.error)}</div>`; return; }
  if(!r.list.length){ out.innerHTML = '<div class="hint">Aucune destination trouvée pour cette durée : essaie un autre temps de vol.</div>'; return; }
  flyLast = { ...r, type: hg && hg.icaoType ? hg.icaoType : '', aircraft: hg ? hg.name : '' };
  const wind = w => w && w.wspd != null ? `${w.wdir === 'VRB' ? 'VRB' : String(w.wdir).padStart(3, '0')}°/${w.wspd} kt${w.wgst ? ' G' + w.wgst : ''}` : '';
  out.innerHTML = r.list.map((c, i) => `<div class="fly-res">
      <div class="fr-top"><span class="fr-icao">${esc(c.icao)}</span>${c.isNew ? '<span class="fr-new">Jamais visité</span>' : c.visits ? `<span class="fr-new fr-fav">${c.visits}× visité</span>` : ''}</div>
      <div class="fr-name">${esc(c.name)}</div>
      ${c.event ? `<div class="fr-badge ev">📅 Event VATSIM : ${esc(c.event.name)} · ${new Date(c.event.start).toISOString().slice(11, 16)}–${new Date(c.event.end).toISOString().slice(11, 16)}Z</div>` : ''}
      ${c.atc ? `<div class="fr-badge atc">🎧 ATC en ligne : ${esc(c.atc.facs.join(' '))} · ${esc(c.atc.nets.map(n => n.toUpperCase()).join(' + '))}</div>` : ''}
      <div class="fr-facts"><span>📏 ${c.distanceNm} NM</span><span>⏱️ ≈ ${fmtMinShort(c.estMin)}</span><span>🛬 ${Math.round(c.runwayFt).toLocaleString(FBI18N.locale())} ft</span></div>
      <div class="fr-wx">${c.wx ? `${c.wx.cat ? `<span class="wx-cat wx-${esc(c.wx.cat)}">${esc(c.wx.cat)}</span>` : ''}${esc(wind(c.wx))}<br>${esc(c.wx.raw || '')}` : 'Pas de METAR pour ce terrain.'}</div>
      <div class="btn-row">
        <button class="btn primary small" onclick="FBv17.flyUse(${i})">Préparer ce vol</button>
        <button class="btn small" onclick="FBv17.flySimbrief(${i})">SimBrief ↗</button>
      </div>
    </div>`).join('');
};
FBv17.flyUse = i => {
  const c = flyLast && flyLast.list[i]; if(!c) return;
  const set = (id, v) => { $(id).value = v; $(id).dispatchEvent(new Event('input', { bubbles: true })); };
  set('depIcao', flyLast.from.icao); set('depName', flyLast.from.name || '');
  set('arrIcao', c.icao); set('arrName', c.name || '');
  if(flyLast.aircraft && !$('aircraft').value) set('aircraft', flyLast.aircraft);
  switchView('briefing');
};
FBv17.flySimbrief = i => {
  const c = flyLast && flyLast.list[i]; if(!c) return;
  window.api.openExternal(`https://dispatch.simbrief.com/options/custom?orig=${encodeURIComponent(flyLast.from.icao)}&dest=${encodeURIComponent(c.icao)}${flyLast.type ? '&type=' + encodeURIComponent(flyLast.type) : ''}`);
};

/* ---------------- Profil : gratte-pays ---------------- */
const flag = cc => /^[A-Z]{2}$/.test(cc || '') ? String.fromCodePoint(...[...cc].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)) : '🏳️';
let geoCache = null;
async function countriesOf(icaos){
  const missing = icaos.filter(ic => !geoCache || !(ic in geoCache.byIcao));
  if(!geoCache || missing.length){
    const r = window.fly && window.fly.countries ? await window.fly.countries(icaos) : { byIcao: {}, names: {}, totals: {} };
    geoCache = { byIcao: { ...(geoCache || {}).byIcao, ...r.byIcao }, names: { ...(geoCache || {}).names, ...r.names }, totals: r.totals || {} };
    icaos.forEach(ic => { if(!(ic in geoCache.byIcao)) geoCache.byIcao[ic] = null; });
  }
  return geoCache;
}
const flightAirports = flights => [...new Set(flights.flatMap(f => [f.dep, f.arr]).filter(Boolean).map(x => String(x).toUpperCase()))];
// v1.8 : tuile compacte dans le Profil + détail dans une modale (recherche, tri, aéroports visités).
const pctTxt = v => (Math.round(v * 10) / 10).toLocaleString(FBI18N.locale(), { maximumFractionDigits: 1 });
let scData = { list: [], aps: [] }, scSortKey = 'n';
async function renderScratch(){
  if(!$('colScratch')) return;
  const aps = flightAirports(db.logbook || []);
  const g = await countriesOf(aps);
  const by = {};
  aps.forEach(ic => { const cc = g.byIcao[ic]; if(cc) (by[cc] = by[cc] || new Set()).add(ic); });
  const list = Object.entries(by).map(([cc, set]) => {
    const total = Math.max(set.size, g.totals[cc] || 0);
    return { cc, name: g.names[cc] || cc, n: set.size, total, pct: total ? set.size / total : 0, aps: [...set].sort() };
  }).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  scData = { list, aps };
  $('colScN').textContent = list.length;
  $('colScMeter').style.width = Math.min(100, list.length / 195 * 100).toFixed(1) + '%';
  const shown = list.slice(0, 9);
  $('colScFlags').innerHTML = shown.map(x => `<span class="cf" title="${esc(x.name)}">${flag(x.cc)}</span>`).join('') + (list.length > shown.length ? `<span class="cf more">+${list.length - shown.length}</span>` : '');
  $('scSummary').textContent = list.length ? `${aps.length} aéroport${aps.length > 1 ? 's' : ''} · ${pctTxt(list.length / 195 * 100)} % du monde` : 'Pose-toi quelque part pour gratter ton premier pays !';
  if(!$('scratchModalOverlay').classList.contains('hidden')) renderScratchModal();
}
function renderScratchModal(){
  const { list, aps } = scData;
  const top = list[0];
  $('scHero').innerHTML = `<div class="cm-stat"><b>${list.length}</b><span>pays</span></div><div class="cm-stat"><b>${aps.length}</b><span>aéroports</span></div>
    <div class="cm-stat"><b>${pctTxt(list.length / 195 * 100)} %</b><span>du monde</span></div>
    ${top ? `<div class="cm-stat wide"><b>${flag(top.cc)} ${esc(top.name)}</b><span>ton pays le plus visité · ${top.n} aéroport${top.n > 1 ? 's' : ''}</span></div>` : ''}`;
  const q = ($('scSearch').value || '').trim().toLowerCase();
  let rows = list.filter(x => !q || x.name.toLowerCase().includes(q) || x.cc.toLowerCase() === q || x.aps.some(a => a.toLowerCase().includes(q)));
  if(scSortKey === 'az') rows = rows.slice().sort((a, b) => a.name.localeCompare(b.name));
  else if(scSortKey === 'pct') rows = rows.slice().sort((a, b) => b.pct - a.pct || b.n - a.n);
  $('scGrid').innerHTML = rows.length ? rows.map(x => {
    const pct = Math.round(x.pct * 1000) / 10;
    return `<div class="sc-row"><span class="sc-flag">${flag(x.cc)}</span>
      <div class="sc-mid"><div class="sc-name">${esc(x.name)}</div>
        <div class="sc-aps">${x.aps.slice(0, 10).map(a => `<span>${esc(a)}</span>`).join('')}${x.aps.length > 10 ? `<span class="more">+${x.aps.length - 10}</span>` : ''}</div></div>
      <div class="sc-prog"><div class="sc-num"><b>${x.n}</b> / ${x.total}</div><div class="sc-bar"><i style="width:${Math.max(2, Math.min(100, pct))}%"></i></div><div class="sc-pct">${pctTxt(pct)} %</div></div></div>`;
  }).join('') : `<div class="cm-empty">${list.length ? 'Aucun pays ne correspond.' : 'Pose-toi quelque part pour gratter ton premier pays !'}</div>`;
}
FBv17.scratchOpen = () => {
  $('scratchModalOverlay').classList.remove('hidden');
  if(!$('scSearch').dataset.bound){
    $('scSearch').dataset.bound = '1';
    $('scSearch').addEventListener('input', renderScratchModal);
    $('scSort').addEventListener('click', e => { const b = e.target.closest('button[data-k]'); if(!b) return; scSortKey = b.dataset.k; [...$('scSort').children].forEach(x => x.classList.toggle('on', x === b)); renderScratchModal(); });
  }
  renderScratchModal();
  setTimeout(() => $('scSearch').focus(), 50);
};
FBv17.scratchClose = () => $('scratchModalOverlay').classList.add('hidden');

/* ---------------- Profil : défis aéroports ---------------- */
const CHALLENGES = [
  ['LFLJ', 'Courchevel', "Altiport : 537 m de piste en pente à 18,5 %, pas de remise de gaz possible.", 3],
  ['VNLK', 'Lukla', "527 m en pente, un mur au bout, à 2 860 m d'altitude dans l'Himalaya.", 3],
  ['VQPR', 'Paro', "Approche à vue entre les montagnes du Bhoutan, réservée à quelques pilotes au monde.", 3],
  ['TNCS', 'Saba', "400 m de piste entre falaises et océan : la plus courte des lignes régulières.", 3],
  ['TFFJ', 'Saint-Barthélemy', "Descente plongeante au-dessus d'une colline et d'une route, piste qui finit sur la plage.", 3],
  ['EGPR', 'Barra', "La seule piste au monde sur une plage… recouverte à marée haute.", 2],
  ['TNCM', 'Princess Juliana', "Le survol de Maho Beach à quelques mètres des baigneurs.", 2],
  ['LPMA', 'Madère', "Vents tournants et piste sur pilotis au bord de la falaise.", 2],
  ['LXGB', 'Gibraltar', "Piste coupée par une route, sous le Rocher, vent de travers garanti.", 2],
  ['LOWI', 'Innsbruck', "Approche dans la vallée de l'Inn, entre des sommets à plus de 2 500 m.", 2],
  ['NZQN', 'Queenstown', "Vallée encaissée et vents forts des Alpes du Sud.", 2],
  ['KASE', 'Aspen', "Approche raide entre les Rocheuses, à 2 400 m d'altitude.", 2],
  ['LGSK', 'Skiathos', "Piste courte entre la mer et la colline, survol de la route au seuil.", 1],
  ['LFKC', 'Calvi', "Approche en virage serré au pied des montagnes corses.", 1],
  ['SBRJ', 'Santos Dumont', "Piste courte au bord de la baie de Rio, au pied du Pain de Sucre.", 1]
];
// v1.8 : tuile compacte (pastilles par défi) + modale filtrable par statut et par niveau.
const CH_LEVELS = { 3: ['Extrême', 'lv3'], 2: ['Difficile', 'lv2'], 1: ['Technique', 'lv1'] };
let chFilter = { status: 'all', level: 0 };
function challengeState(){
  const fl = db.logbook || [];
  return CHALLENGES.map(([icao, name, desc, lvl]) => {
    const here = fl.filter(f => String(f.arr || '').toUpperCase() === icao);
    const rates = here.map(f => FBShared.flightLandingRate(f)).filter(v => v != null).map(Math.abs);
    const best = rates.length ? Math.min(...rates) : null;
    const lastDate = here.map(f => f.date || '').sort().pop() || null;
    return { icao, name, desc, lvl, n: here.length, best, lastDate, done: here.length > 0 };
  });
}
function renderChallenges(){
  if(!$('colChal')) return;
  const st = challengeState();
  const done = st.filter(x => x.done).length;
  $('colChN').textContent = done; $('colChOf').textContent = ` sur ${st.length}`;
  $('colChPips').innerHTML = [3, 2, 1].map(l => `<span class="pip-group">${st.filter(x => x.lvl === l).map(x => `<i class="pip ${CH_LEVELS[l][1]} ${x.done ? 'on' : ''}" title="${esc(x.name)} (${esc(x.icao)})${x.done ? ' ✓' : ''}"></i>`).join('')}</span>`).join('');
  const next = st.filter(x => !x.done).sort((a, b) => a.lvl - b.lvl)[0];
  $('colChNext').innerHTML = next ? `Prochain défi conseillé : <b>${esc(next.name)}</b> <span class="mono">${esc(next.icao)}</span> · <span>${CH_LEVELS[next.lvl][0]}</span>` : '🏅 Tous les défis sont relevés, chapeau !';
  if(!$('chalModalOverlay').classList.contains('hidden')) renderChallengesModal();
}
function renderChallengesModal(){
  const st = challengeState();
  const done = st.filter(x => x.done).length;
  $('chHero').innerHTML = `<div class="cm-stat"><b>${done} / ${st.length}</b><span>défis relevés</span></div>`
    + [3, 2, 1].map(l => { const g = st.filter(x => x.lvl === l); return `<div class="cm-stat"><b class="${CH_LEVELS[l][1]}-t">${g.filter(x => x.done).length} / ${g.length}</b><span>${CH_LEVELS[l][0]}</span></div>`; }).join('');
  const rows = st.filter(x => (chFilter.status === 'all' || (chFilter.status === 'done') === x.done) && (!chFilter.level || x.lvl === chFilter.level))
    .sort((a, b) => b.lvl - a.lvl || Number(b.done) - Number(a.done));
  $('chGrid').innerHTML = rows.length ? rows.map(x => {
    const g = x.best != null ? FBShared.landingGrade(-x.best, null) : null;
    return `<div class="ch-card ${CH_LEVELS[x.lvl][1]} ${x.done ? 'done' : 'locked'}">
      <div class="ch-top"><span class="ch-icao">${esc(x.icao)}</span><span class="ch-lvl">${CH_LEVELS[x.lvl][0]}</span><span class="ch-state">${x.done ? '✓' : '🔒'}</span></div>
      <div class="ch-name">${esc(x.name)}</div>
      <div class="ch-desc">${esc(x.desc)}</div>
      <div class="ch-foot">
        <div class="ch-res">${x.done ? (x.best != null ? `<span>Meilleur toucher</span><b style="color:${g ? g.color : 'inherit'}">−${Math.round(x.best)} ft/min</b>` : `<span>Posé</span><b>${x.n}×</b>`) : '<span>Pas encore relevé</span>'}</div>
        <button class="btn small ${x.done ? '' : 'primary'}" onclick="FBv17.challengeGo('${x.icao}')">${x.done ? 'Y retourner' : 'Relever le défi'}</button>
      </div></div>`;
  }).join('') : '<div class="cm-empty">Aucun défi ne correspond à ces filtres.</div>';
}
FBv17.challengesOpen = () => {
  $('chalModalOverlay').classList.remove('hidden');
  const bind = (id, key, num) => {
    const box = $(id); if(box.dataset.bound) return; box.dataset.bound = '1';
    box.addEventListener('click', e => { const b = e.target.closest('button[data-k]'); if(!b) return; chFilter[key] = num ? +b.dataset.k : b.dataset.k; [...box.children].forEach(x => x.classList.toggle('on', x === b)); renderChallengesModal(); });
  };
  bind('chStatus', 'status', false); bind('chLevel', 'level', true);
  renderChallengesModal();
};
FBv17.challengesClose = () => $('chalModalOverlay').classList.add('hidden');
FBv17.challengeGo = icao => {
  const set = (id, v) => { $(id).value = v; $(id).dispatchEvent(new Event('input', { bubbles: true })); };
  set('arrIcao', icao); set('arrName', (CHALLENGES.find(c => c[0] === icao) || [])[1] || '');
  FBv17.challengesClose();
  switchView('briefing');
};

/* ---------------- Profil : Flight Wrapped (bilan de l'année) ---------------- */
function wrappedYears(){
  const ys = [...new Set((db.logbook || []).map(f => String(f.date || '').slice(0, 4)).filter(y => /^\d{4}$/.test(y)))].sort().reverse();
  const cur = String(new Date().getFullYear());
  if(!ys.includes(cur)) ys.unshift(cur);
  $('wrYear').innerHTML = ys.map(y => `<option>${y}</option>`).join('');
}
async function wrappedStats(year){
  const all = (db.logbook || []).slice().sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  const fl = all.filter(f => String(f.date || '').startsWith(year));
  const before = new Set(flightAirports(all.filter(f => String(f.date || '') < year)));
  const aps = flightAirports(fl);
  // Coordonnées des terrains (distance des vols non trackés) : chargées si besoin avant le calcul.
  try{ const miss = aps.filter(k => _airportCoordCache[k] === undefined); if(miss.length) await resolveAirportCoords(miss); }catch(e){ /* distance partielle */ }
  const min = fl.reduce((s, f) => s + (f.durationMin || 0), 0);
  const nm = fl.reduce((s, f) => s + (FBShared.flightDistance(f, cachedAirportLookup).nm || 0), 0);
  const g = await countriesOf(aps);
  const countries = [...new Set(aps.map(ic => g.byIcao[ic]).filter(Boolean))];
  const count = (arr) => { const m = {}; arr.filter(Boolean).forEach(x => { m[x] = (m[x] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1])[0] || null; };
  const favAc = count(fl.map(f => f.aircraft && String(f.aircraft).trim()));
  const favAp = count(fl.flatMap(f => [f.dep, f.arr]).map(x => x && String(x).toUpperCase()));
  const month = count(fl.map(f => String(f.date || '').slice(5, 7)));
  const longest = fl.reduce((m, f) => (!m || (f.durationMin || 0) > (m.durationMin || 0)) ? f : m, null);
  const landed = fl.map(f => ({ f, r: FBShared.flightLandingRate(f) })).filter(x => x.r != null && Math.abs(x.r) > 0);
  const best = landed.sort((a, b) => Math.abs(a.r) - Math.abs(b.r))[0] || null;
  return { year, list: fl, apList: aps, flights: fl.length, min, nm, earth: nm / 21600, aps: aps.length, newAps: aps.filter(a => !before.has(a)).length, countries, names: g.names,
    favAc, favAp, month: month ? new Date(2000, +month[0] - 1, 1).toLocaleDateString(FBI18N.locale(), { month: 'long' }) : null, monthN: month ? month[1] : 0,
    longest, best };
}
FBv17.wrappedOpen = async () => {
  const y = $('wrYear').value || String(new Date().getFullYear());
  const w = await wrappedStats(y);
  const name = (db.userProfile && db.userProfile.firstName) || '';
  const ov = document.createElement('div');
  ov.className = 'wr-overlay';
  ov.innerHTML = `<div class="wr-box wr-box-img"><div class="wr-head"><h2>Flight Wrapped ${esc(y)}</h2>
      <div class="btn-row">${w.flights ? '<button class="btn primary small" id="wrSave">💾 Enregistrer l\'image</button>' : ''}<button class="btn small" id="wrClose">Fermer</button></div></div>
    ${w.flights ? '<div class="wr-img"><div class="hint">Préparation de l\'image…</div></div>' : `<p class="hint">Aucun vol enregistré en ${esc(y)} pour l'instant.</p>`}</div>`;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  ov.addEventListener('click', e => { if(e.target === ov) close(); });
  ov.querySelector('#wrClose').onclick = close;
  if(!w.flights) return;
  const url = await wrappedImage(w, name);
  ov.querySelector('.wr-img').innerHTML = `<img src="${url}" alt="Flight Wrapped ${esc(y)}">`;
  ov.querySelector('#wrSave').onclick = () => { const a = document.createElement('a'); a.download = `flightbrief-wrapped-${y}.png`; a.href = url; a.click(); };
};

// Image à partager (1080 × 1920) : une page de carnet de vol — papier, encre, une seule couleur,
// la carte des routes de l'année et un relevé en colonnes, comme un vrai logbook.
let _coast = null;
async function wrappedImage(w, name){
  const T = FBI18N.tr, loc = FBI18N.locale(), nf = n => Math.round(n).toLocaleString(loc);
  try{ await Promise.all(['700 200px "Space Grotesk"', '500 28px "IBM Plex Mono"', '600 28px "IBM Plex Mono"'].map(f => document.fonts.load(f))); }catch(e){ /* polices système */ }
  if(!_coast){ try{ _coast = await (await fetch('data/coastlines.json')).json(); }catch(e){ _coast = []; } }
  const PAPER = '#f2eee4', INK = '#1b1d22', MUTED = '#7a766c', RULE = '#cfc8b8', ACCENT = '#d9480f';
  const MONO = '"IBM Plex Mono", Consolas, monospace', DISPLAY = '"Space Grotesk", "Segoe UI", sans-serif';
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
  const x = c.getContext('2d'), M = 80, W = 1080 - 2 * M;
  x.fillStyle = PAPER; x.fillRect(0, 0, 1080, 1920);
  const rule = (yy, col, lw) => { x.strokeStyle = col || INK; x.lineWidth = lw || 2; x.beginPath(); x.moveTo(M, yy); x.lineTo(M + W, yy); x.stroke(); };
  const text = (t, px, py, font, col, align) => { x.font = font; x.fillStyle = col; x.textAlign = align || 'left'; x.fillText(t, px, py); };

  // En-tête
  x.save(); x.font = `500 24px ${MONO}`; x.letterSpacing = '4px';
  text(T('CARNET DE VOL · BILAN ANNUEL'), M, 118, `500 24px ${MONO}`, MUTED);
  text('FLIGHTBRIEF', M + W, 118, `600 24px ${MONO}`, INK, 'right');
  x.restore();
  rule(140, INK, 3);
  text(String(w.year), M - 8, 345, `700 210px ${DISPLAY}`, INK);
  x.font = `700 210px ${DISPLAY}`; const yw = x.measureText(String(w.year)).width;
  text('Flight Wrapped', M + yw + 24, 268, `600 40px ${DISPLAY}`, ACCENT);
  if(name) text(name, M + yw + 24, 322, `500 34px ${MONO}`, INK);

  // Carte : côtes + routes de l'année (orthodromies), terrains et codes OACI
  const MY = 400, MH = 620;
  const pts = w.apList.map(ic => ({ ic, p: _airportCoordCache[ic] })).filter(a => a.p && a.p.lat != null);
  if(pts.length){
    let la0 = Math.min(...pts.map(a => a.p.lat)), la1 = Math.max(...pts.map(a => a.p.lat)), lo0 = Math.min(...pts.map(a => a.p.lon)), lo1 = Math.max(...pts.map(a => a.p.lon));
    const k = Math.cos(((la0 + la1) / 2) * Math.PI / 180);
    let sx = Math.max(6, (lo1 - lo0) * k), sy = Math.max(4, la1 - la0);
    if(sx / sy > W / MH) sy = sx * MH / W; else sx = sy * W / MH;
    sx *= 1.3; sy *= 1.3;
    const cx = (lo0 + lo1) / 2, cy = (la0 + la1) / 2;
    const P = (lat, lon) => [M + W / 2 + (lon - cx) * k / sx * W, MY + MH / 2 - (lat - cy) / sy * MH];
    x.save(); x.beginPath(); x.rect(M, MY, W, MH); x.clip();
    x.strokeStyle = RULE; x.lineWidth = 2;
    _coast.forEach(ring => { x.beginPath(); ring.forEach(([lon, lat], i) => { const [px, py] = P(lat, lon); i ? x.lineTo(px, py) : x.moveTo(px, py); }); x.stroke(); });
    x.strokeStyle = ACCENT; x.lineWidth = 3.5; x.globalAlpha = .85;
    w.list.forEach(f => {
      const a = _airportCoordCache[String(f.dep || '').toUpperCase()], b = _airportCoordCache[String(f.arr || '').toUpperCase()];
      if(!a || !b || a.lat == null || b.lat == null) return;
      x.beginPath(); FBShared.greatCirclePoints(a, b, 40).forEach(([la, lo], i) => { const [px, py] = P(la, lo); i ? x.lineTo(px, py) : x.moveTo(px, py); }); x.stroke();
    });
    x.globalAlpha = 1;
    pts.forEach(({ ic, p }, i) => {
      const [px, py] = P(p.lat, p.lon);
      x.fillStyle = INK; x.beginPath(); x.arc(px, py, 7, 0, Math.PI * 2); x.fill();
      if(pts.length <= 16) text(ic, px + 12, py - 10, `600 22px ${MONO}`, INK);
    });
    x.restore();
  }
  x.strokeStyle = INK; x.lineWidth = 2; x.strokeRect(M, MY, W, MH);

  // Relevé, en colonnes avec points de conduite
  const rows = [
    ['Vols', nf(w.flights)],
    ['Temps de vol', minToHhmm(w.min)],
    ['Distance', `${nf(w.nm)} NM`],
    ['Aéroports', `${nf(w.aps)}${w.newAps ? ` (${w.newAps} ${T('nouveaux')})` : ''}`],
    ['Pays', `${nf(w.countries.length)}`],
    ['Avion préféré', w.favAc ? `${w.favAc[0]} ×${w.favAc[1]}` : '—'],
    ['Meilleur atterrissage', w.best ? `−${Math.round(Math.abs(w.best.r))} ft/min · ${w.best.f.arr || ''}` : '—'],
    ['Vol le plus long', w.longest ? `${w.longest.dep || '----'}–${w.longest.arr || '----'} · ${minToHhmm(w.longest.durationMin || 0)}` : '—'],
    ['Mois le plus chargé', w.month ? w.month.charAt(0).toUpperCase() + w.month.slice(1) : '—']
  ];
  let ry = 1110;
  rows.forEach(([k, v]) => {
    const label = T(k).toUpperCase();
    text(label, M, ry, `500 26px ${MONO}`, MUTED);
    x.font = `600 32px ${MONO}`; const vw = x.measureText(v).width;
    x.font = `500 26px ${MONO}`; const lw = x.measureText(label).width;
    x.fillStyle = RULE; for(let dx = M + lw + 18; dx < M + W - vw - 18; dx += 14) x.fillRect(dx, ry - 8, 4, 4);
    text(v, M + W, ry, `600 32px ${MONO}`, INK, 'right');
    ry += 70;
  });
  if(w.countries.length) text(w.countries.slice(0, 16).map(flag).join(' '), M, ry + 6, `40px ${DISPLAY}`, INK);

  // Pied : code-barres façon carte d'embarquement (tiré des chiffres de l'année) + adresse
  rule(1770, INK, 3);
  let seed = w.flights * 7919 + Math.round(w.nm) * 31 + Math.round(w.min);
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  x.fillStyle = INK;
  for(let bx = M + W - 360; bx < M + W; ){ const bw = 2 + Math.floor(rnd() * 5); x.fillRect(bx, 1792, bw, 70); bx += bw + 3 + Math.floor(rnd() * 5); }
  text('llcenlive.github.io/FlightBrief', M, 1840, `500 26px ${MONO}`, MUTED);
  return c.toDataURL('image/png');
}
function renderProfileExtras(){ wrappedYears(); renderScratch(); renderChallenges(); }

/* ---------------- Import d'un historique de vols (CSV) ---------------- */
FBv17.importOpen = () => {
  const ov = document.createElement('div');
  ov.className = 'wr-overlay';
  ov.innerHTML = `<div class="wr-box"><div class="wr-head"><h2>📥 Importer un historique</h2><button class="btn small" data-close>Fermer</button></div>
    <p class="hint">Exporte tes vols en CSV depuis ton ancien outil (Little Navmap : Logbook → Exporter en CSV ; Volanta : Flights → Export ; ou un simple tableur). FlightBrief reconnaît les colonnes tout seul : vérifie-les, puis importe. Les vols déjà présents ne sont pas ajoutés deux fois.</p>
    <input type="file" accept=".csv,.txt,text/csv" id="impFile">
    <div id="impBody"></div></div>`;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  ov.querySelector('[data-close]').onclick = close;
  ov.addEventListener('click', e => { if(e.target === ov) close(); });
  let parsed = null, map = null, name = '';
  const preview = () => {
    const r = FBImport.toFlights(parsed, map, db.logbook || [], name);
    const opts = i => `<option value="">—</option>` + parsed.headers.map((h, j) => `<option value="${j}"${i === j ? ' selected' : ''}>${esc(h)}</option>`).join('');
    ov.querySelector('#impBody').innerHTML = `
      <div class="imp-map">${Object.keys(FBImport.FIELDS).map(f => `<div><label>${esc(FBImport.LABELS[f])}</label><select data-f="${f}">${opts(map[f])}</select></div>`).join('')}</div>
      <div class="status-msg ${r.flights.length ? 'ok' : 'warn'}">${r.flights.length} vols à importer · ${r.skipped.duplicate} déjà présents · ${r.skipped.invalid} lignes sans date, départ ou arrivée</div>
      <table class="imp-table"><thead><tr><th>Date</th><th>Départ</th><th>Arrivée</th><th>Appareil</th><th>Durée</th><th>Distance</th><th>Toucher</th></tr></thead><tbody>
      ${r.flights.slice(0, 6).map(f => `<tr><td>${esc(f.date)}</td><td>${esc(f.dep)}</td><td>${esc(f.arr)}</td><td>${esc(f.aircraft)}</td><td>${f.durationMin ? minToHhmm(f.durationMin) : '—'}</td><td>${f.distanceNm ? f.distanceNm + ' NM' : '—'}</td><td>${f.landingRateFpm ? f.landingRateFpm + ' ft/min' : '—'}</td></tr>`).join('')}
      </tbody></table>
      <div class="btn-row" style="margin-top:14px;"><button class="btn primary" id="impGo" ${r.flights.length ? '' : 'disabled'}>Importer ${r.flights.length} vols</button></div>`;
    ov.querySelectorAll('select[data-f]').forEach(s => s.onchange = () => { map[s.dataset.f] = s.value === '' ? undefined : +s.value; preview(); });
    const go = ov.querySelector('#impGo');
    if(go) go.onclick = async () => {
      db.logbook = [...r.flights, ...(db.logbook || [])].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
      await saveDbNow();
      renderLogbook();
      if(window.FBv15 && FBv15.afterLogbookChange) FBv15.afterLogbookChange();
      ov.querySelector('#impBody').innerHTML = `<div class="status-msg ok">${r.flights.length} vols importés ✓</div>`;
    };
  };
  ov.querySelector('#impFile').onchange = async e => {
    const file = e.target.files[0]; if(!file) return;
    name = file.name;
    parsed = FBImport.parseCsv(await file.text());
    map = FBImport.detectColumns(parsed.headers);
    if(!parsed.headers.length){ ov.querySelector('#impBody').innerHTML = '<div class="status-msg err">Fichier vide ou illisible.</div>'; return; }
    preview();
  };
};

/* ---------------- Stream Deck ---------------- */
// Etat utile aux touches (copilote, volumes) envoyé au processus principal ; les actions arrivent
// ici et passent par les mêmes fonctions que les boutons de l'appli.
function deckPushUi(){
  if(!window.deck) return;
  const c = cpCfg(), al = window.FBv15 && FBv15.alertsCfg ? FBv15.alertsCfg() : {};
  window.deck.pushUi({ copilot: c.enabled, copilotVol: c.volume, alertsVol: al.volume || 0, alertsSound: !!al.sound, stream: streamFeaturesOn() });
}
function setRange(id, v){ const e = $(id); if(!e) return; e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }
async function deckAction(a){
  const al = window.FBv15 && FBv15.alertsCfg ? FBv15.alertsCfg() : null;
  if(a === 'tracker') await toggleTrackerConnection();
  else if(a === 'shot' && window.FBv15) await FBv15.takeShot();
  else if(a === 'copilot') FBv17.copilotToggle();
  else if(a === 'copilot-vol+') FBv17.copilotVolume(5);
  else if(a === 'copilot-vol-') FBv17.copilotVolume(-5);
  else if(a === 'copilot-brief') FBv17.copilotBrief();
  else if((a === 'alerts-vol+' || a === 'alerts-vol-') && al) setRange('alsVolume', Math.max(0, Math.min(100, (al.volume || 0) + (a === 'alerts-vol+' ? 5 : -5))));
  else if(a === 'alerts-mute' && $('alsSound')){ $('alsSound').checked = !$('alsSound').checked; $('alsSound').dispatchEvent(new Event('change', { bubbles: true })); }
  else if(a === 'boarding' && streamFeaturesOn() && window.cabin){ const s = await window.cabin.getState(); window.FBCabin && FBCabin.boarding(s.flight && s.flight.boarding ? 'close' : 'open'); }
  else if(a === 'bets' && streamFeaturesOn() && window.twitch && window.FBv15){ const s = await window.twitch.getState(); FBv15.twitchBet(s.bet && s.bet.state === 'open' ? 'lock' : 'open'); }
  deckPushUi();
}
FBv17.deckInstall = async () => {
  const m = $('deckStatus');
  m.className = 'status-msg'; m.textContent = 'Préparation du plugin…';
  const r = await window.deck.install();
  m.className = 'status-msg ' + (r.ok ? 'ok' : 'err');
  m.textContent = r.ok ? "Plugin prêt ✓ — le Stream Deck propose de l'installer. Sinon, double-clique sur le fichier dans le dossier qui s'est ouvert." : (r.error || 'Installation impossible.');
};
FBv17.deckNewToken = async () => {
  if(!confirm("Créer un nouveau code ? Le plugin déjà installé ne pourra plus piloter FlightBrief : il faudra le réinstaller.")) return;
  await window.deck.newToken();
  const m = $('deckStatus'); m.className = 'status-msg ok'; m.textContent = 'Nouveau code créé ✓ — réinstalle le plugin pour l\'utiliser.';
};

/* ---------------- Démarrage (après le chargement des données par app.js) ---------------- */
FBv17.init = async () => {
  bindCopilot();
  ['depIcao', 'arrIcao'].forEach(id => $(id).addEventListener('input', renderChartLinks));
  renderChartLinks();
  $('chartLinks').addEventListener('click', e => { const a = e.target.closest('a[data-url]'); if(a) window.api.openExternal(a.dataset.url); });
  flyDefaults();
  document.querySelector('.tabs [data-view="tools"]').addEventListener('click', flyDefaults);
  document.querySelector('.tabs [data-view="profil"]').addEventListener('click', renderProfileExtras);
  renderProfileExtras();
  if(window.tracker){
    window.tracker.onTelemetry(copilotTick);
    if(window.tracker.onFastAgl) window.tracker.onFastAgl(d => { if(cpCfg().enabled) copilot.fast(d, cpCtx(cpLastT)).forEach(x => speak(x)); });
    window.tracker.onFlightLanded(d => {
      if(!d || d.landingRate == null || !cpCfg().enabled) return;
      const g = FBShared.landingGrade(d.landingRate, typeof currentFlightCategory === 'function' ? currentFlightCategory(d) : null);
      copilot.landed({ fpm: d.landingRate, grade: g ? GRADE_WORDS[g.key] : null }, cpCtx(cpLastT)).forEach(x => speak(x));
    });
    window.tracker.onFlightEnd(() => copilot.reset());
  }
  if(window.deck){
    window.deck.onAction(a => deckAction(a).catch(e => console.warn('[deck]', e)));
    deckPushUi(); setInterval(deckPushUi, 5000); // volumes réglés dans l'appli : reflétés sur le Stream Deck
  }
};
// v1.8 : une seule initialisation, et démarrage ici si app.js a déjà fini la sienne (fichier local
// lu très vite : app.js peut atteindre la fin de son démarrage avant que ce script soit chargé).
{ const run = FBv17.init; let started = false; FBv17.init = async () => { if(started) return; started = true; return run(); }; }
if(window.__fbAppReady) FBv17.init().catch(e => console.warn('[v1.7]', e));
})();
