/* =========================================================
   FlightBrief 1.8 — confort (interface)
   ---------------------------------------------------------
   • Pop-ups de notification en bas de l'appli, avec un petit son (FBNotice).
   • Fin de vol : vol trop court proposé quand même, PIREP enregistré annulable, briefing remis à zéro.
   • Profil : records personnels, Gratte-Pays et Défis aéroport dans une modale.
   ========================================================= */
(function(){
'use strict';
const FBv18 = {};
window.FBv18 = FBv18;
const $ = id => document.getElementById(id);
const esc = s => escapeHtml(s == null ? '' : String(s));

/* ---------------- Pop-ups (FBNotice) ---------------- */
function noticeCfg(){
  if(!db.noticeCfg || typeof db.noticeCfg !== 'object') db.noticeCfg = {};
  return Object.assign(db.noticeCfg, { sound: db.noticeCfg.sound !== false, volume: Number.isFinite(+db.noticeCfg.volume) ? +db.noticeCfg.volume : 45 });
}
// Petits sons distincts : ok = deux notes montantes, info = une note, warn = note grave tenue, err = deux notes descendantes.
const TONES = { ok: [[784, 0], [1046.5, 0.13]], info: [[880, 0]], warn: [[587.3, 0], [587.3, 0.2]], err: [[659.3, 0], [440, 0.16]] };
function noticeSound(kind){
  const c = noticeCfg();
  if(!c.sound || !window.FBv15 || !FBv15.sfx) return;
  const vol = FBv15.sfx.gain(c.volume, 0.22);
  if(vol <= 0) return;
  const ac = FBv15.sfx.ctx(); if(!ac) return;
  try{
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3800; lp.connect(ac.destination);
    const t = ac.currentTime + 0.02;
    (TONES[kind] || TONES.info).forEach(([f, dt]) => FBv15.sfx.bell(ac, lp, f, t + dt, vol, 0.9));
  }catch(e){ /* pas d'audio */ }
}
const ICONS = { ok: '✓', info: 'i', warn: '!', err: '×' };
function host(){
  let h = $('noticeHost');
  if(!h){ h = document.createElement('div'); h.id = 'noticeHost'; h.className = 'notice-host'; h.setAttribute('role', 'status'); h.setAttribute('aria-live', 'polite'); document.body.appendChild(h); }
  return h;
}
// opts : { kind: ok|info|warn|err, title, text, actions: [{ label, primary, fn }], ms (0 = reste affichée), sound, key }
function show(opts){
  const o = Object.assign({ kind: 'info', title: '', text: '', actions: [], ms: 7000, sound: true }, opts || {});
  const h = host();
  if(o.key){ const old = h.querySelector(`.notice[data-key="${CSS.escape(o.key)}"]`); if(old) old.remove(); }
  while(h.children.length >= 3) h.firstElementChild.remove();
  const n = document.createElement('div');
  n.className = 'notice notice-' + o.kind;
  if(o.key) n.dataset.key = o.key;
  n.innerHTML = `<div class="notice-ic">${ICONS[o.kind] || 'i'}</div>
    <div class="notice-body">${o.title ? `<div class="notice-title">${esc(o.title)}</div>` : ''}${o.text ? `<div class="notice-text">${esc(o.text)}</div>` : ''}</div>
    <div class="notice-actions"></div>
    <button class="notice-x" title="Fermer" aria-label="Fermer">×</button>
    ${o.ms ? `<div class="notice-timer" style="animation-duration:${o.ms}ms"></div>` : ''}`;
  let timer = null, closed = false;
  const close = () => {
    if(closed) return; closed = true; clearTimeout(timer);
    n.classList.add('out'); setTimeout(() => n.remove(), 260);
  };
  const acts = n.querySelector('.notice-actions');
  (o.actions || []).forEach(a => {
    const b = document.createElement('button');
    b.className = 'btn small' + (a.primary ? ' primary' : '');
    b.textContent = a.label;
    b.onclick = async () => { b.disabled = true; try{ await a.fn(); } finally { close(); } };
    acts.appendChild(b);
  });
  if(!acts.children.length) acts.remove();
  n.querySelector('.notice-x').onclick = close;
  // Survol : on suspend la fermeture automatique (le temps de lire / de cliquer sur Annuler).
  if(o.ms){
    const arm = ms => { clearTimeout(timer); timer = setTimeout(close, ms); };
    let left = o.ms, started = Date.now();
    arm(left);
    n.addEventListener('mouseenter', () => { left -= Date.now() - started; clearTimeout(timer); n.classList.add('paused'); });
    n.addEventListener('mouseleave', () => { started = Date.now(); arm(Math.max(1500, left)); n.classList.remove('paused'); });
  }
  h.appendChild(n);
  requestAnimationFrame(() => n.classList.add('in'));
  if(o.sound) noticeSound(o.kind);
  return { close, el: n };
}
window.FBNotice = { show, sound: noticeSound };
FBv18.testNotice = () => show({ kind: 'ok', title: 'Exemple de pop-up', text: "C'est ici que FlightBrief te prévient (vol terminé, PIREP enregistré, erreur…).", ms: 5000 });

/* ---------------- Briefing remis à zéro après le PIREP ---------------- */
const BRIEF_IDS = ['callsign','depIcao','arrIcao','depName','arrName','routeText','aircraft','altitude','duration','approach','weather','notes'];
function briefingSnapshot(){
  const v = {}; BRIEF_IDS.forEach(id => { const e = $(id); if(e) v[id] = e.value; });
  return { v, rules: state.rules, sbIcao: state.simbriefAcIcao || '', sbName: state.simbriefAcName || '' };
}
function briefingRestore(s){
  if(!s) return;
  BRIEF_IDS.forEach(id => { const e = $(id); if(e && s.v[id] != null) e.value = s.v[id]; });
  state.simbriefAcIcao = s.sbIcao; state.simbriefAcName = s.sbName;
  if(s.rules && s.rules !== state.rules) setFlightRules(s.rules);
  render();
}
function briefingClear(){
  BRIEF_IDS.forEach(id => { const e = $(id); if(e) e.value = ''; });
  state.simbriefAcIcao = ''; state.simbriefAcName = '';
  render();
}
FBv18.resetBriefing = () => {
  const snap = briefingSnapshot();
  if(!Object.values(snap.v).some(x => x && x.trim())) return;
  briefingClear();
  show({ kind: 'info', title: 'Briefing remis à zéro', text: 'Prêt pour le prochain vol.', ms: 6000, sound: false, key: 'brief-reset',
    actions: [{ label: 'Rétablir', fn: () => briefingRestore(snap) }] });
};

/* ---------------- Aéroports du briefing contredits par le vol réel ---------------- */
// Les champs Départ / Arrivée du Briefing passent devant les aéroports détectés par le tracker.
// Restés d'un vol précédent, ils donnaient un PIREP faux (ex. LFPG → LFBO pour un LEMD → LEPP).
// Si l'aéroport du briefing est à plus de 10 NM de l'endroit où l'avion a réellement décollé /
// atterri, et que le tracker a reconnu un terrain sous l'avion (≤ 3 NM), on garde le terrain réel.
async function fixBriefAirports(data){
  const path = (data && data.path) || [];
  if(!path.length) return null;
  const firstPt = path[0];
  const tdPt = (data.touchdown && Number.isFinite(data.touchdown.lat)) ? data.touchdown : path[path.length - 1];
  const sides = [['depIcao', 'depName', data.depGuess, firstPt], ['arrIcao', 'arrName', data.arrGuess, tdPt]];
  const codes = sides.map(([id]) => ($(id).value || '').trim().toUpperCase()).filter(Boolean);
  if(!codes.length) return null;
  const coords = await resolveAirportCoords(codes);
  const changes = [];
  sides.forEach(([id, nameId, guess, pt]) => {
    const code = ($(id).value || '').trim().toUpperCase();
    if(!code || !guess || !guess.icao || guess.icao === code || !(guess.distanceNm <= 3)) return;
    const c = coords[code];
    if(c && Number.isFinite(c.lat) && FBShared.haversineNm(c.lat, c.lon, pt.lat, pt.lon) <= 10) return; // même terrain (autre code / héliport voisin)
    changes.push({ side: id === 'depIcao' ? 'dep' : 'arr', from: code, to: guess.icao });
    $(id).value = guess.icao;
    if($(nameId)) $(nameId).value = guess.name || '';
  });
  return changes.length ? changes : null;
}

/* ---------------- PIREP enregistré : toast + Annuler ---------------- */
// Appelée par applyTrackedFlightToLogbook (app.js) juste avant l'enregistrement.
FBv18.beforePirep = async (tracked) => {
  const ctx = { ids: new Set(db.logbook.map(f => f.id)), tracked, brief: briefingSnapshot() };
  try{ ctx.fixed = await fixBriefAirports(tracked); }catch(e){ ctx.fixed = null; }
  return ctx;
};
FBv18.afterPirep = (ctx) => {
  const entry = db.logbook.find(f => !ctx.ids.has(f.id));
  if(!entry) return;
  // Briefing vidé pour le prochain vol (ses champs passent devant les aéroports détectés).
  briefingClear();
  const route = `${entry.dep || '????'} → ${entry.arr || '????'}`;
  const fixedTxt = ctx.fixed ? ` Aéroports pris sur le vol réel (le briefing indiquait ${ctx.fixed.map(c => c.from).join(' / ')}).` : '';
  show({ kind: 'ok', title: 'PIREP enregistré dans le logbook', text: `${route} · ${minToHhmm(entry.durationMin || 0)}${entry.distanceNm ? ' · ' + entry.distanceNm + ' NM' : ''} — le briefing est remis à zéro.${fixedTxt}`,
    ms: 10000, key: 'pirep',
    actions: [
      { label: 'Annuler', fn: async () => {
        db.logbook = db.logbook.filter(f => f.id !== entry.id);
        await saveDbNow();
        renderLogbook();
        if(window.FBv15 && FBv15.afterLogbookChange) FBv15.afterLogbookChange();
        briefingRestore(ctx.brief);
        if(ctx.tracked){
          _lastTrackedFlight = ctx.tracked;
          if(entry.trackData) _pendingTrackData = entry.trackData;
          renderTrkResultPanel(ctx.tracked);
          updateBriefingSaveVisibility();
          switchView('briefing');
        }
        show({ kind: 'info', title: 'PIREP annulé', text: 'Le vol est de nouveau prêt à être envoyé.', ms: 5000, sound: false, key: 'pirep' });
      } },
      { label: 'Voir', primary: true, fn: () => { switchView('logbook'); } }
    ] });
};

/* ---------------- Événements du tracker ---------------- */
function scrollToResult(){
  switchView('briefing');
  setTimeout(() => { const p = $('trkResultPanel'); if(p) p.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 60);
}
FBv18.onRecovered = (snapshot) => show({
  kind: 'warn', ms: 0, key: 'recover',
  title: snapshot.final ? 'Vol récupéré' : 'Vol interrompu récupéré',
  text: snapshot.final ? "FlightBrief s'est fermé avant l'envoi du PIREP. Vérifie le résumé puis envoie-le."
    : 'Le vol a été coupé en plein trajet : certaines données (atterrissage, carburant) peuvent manquer.',
  actions: [{ label: 'Voir le vol', primary: true, fn: scrollToResult }]
});
function bindTracker(){
  if(!window.tracker) return;
  if(window.tracker.onFlightRejected) window.tracker.onFlightRejected(d => {
    if(!d || !d.result) return;
    const min = Math.floor((d.airSec || 0) / 60), sec = (d.airSec || 0) % 60;
    show({ kind: 'warn', ms: 0, key: 'rejected',
      title: 'Vol trop court pour être enregistré automatiquement',
      text: `${min ? min + ' min ' : ''}${sec} s en l'air (minimum 2 min). Tu peux l'enregistrer quand même ou l'ignorer.`,
      actions: [
        { label: 'Ignorer', fn: () => window.tracker.clearPendingFlight() },
        { label: 'Enregistrer quand même', primary: true, fn: () => {
          _lastTrackedFlight = d.result;
          updateBriefingSaveVisibility();
          renderTrkResultPanel(d.result);
          setTrkStopVisible(false);
          scrollToResult();
        } }
      ] });
  });
  // Fin de vol automatique (moteurs coupés au parking) : le résumé attend l'envoi du PIREP.
  window.tracker.onFlightEnd(d => {
    if(window.__fbManualStop){ window.__fbManualStop = false; return; } // arrêt manuel : PIREP déjà envoyé
    if(!d) return;
    const dep = d.depGuess ? d.depGuess.icao : '----', arr = d.arrGuess ? d.arrGuess.icao : '----';
    show({ kind: 'ok', ms: 0, key: 'flight-end', title: 'Vol terminé', text: `${dep} → ${arr} · ${minToHhmm(d.durationMin || 0)} · ${d.distanceNm || 0} NM. Vérifie le résumé puis envoie le PIREP.`,
      actions: [{ label: 'Voir le résumé', primary: true, fn: scrollToResult }] });
  });
  // Erreurs SimConnect : une seule pop-up par message (elles peuvent se répéter à chaque seconde).
  let lastErr = '';
  window.tracker.onStatus(d => {
    const e = d && d.error ? String(d.error) : '';
    if(e && e !== lastErr) show({ kind: 'err', ms: 12000, key: 'trk-err', title: 'Problème avec le simulateur', text: e });
    lastErr = e;
  });
}

/* ---------------- Profil : records personnels ---------------- */
function bestBy(list, val, better){
  let best = null, bv = null;
  list.forEach(f => { const v = val(f); if(v == null || !isFinite(v)) return; if(best === null || better(v, bv)) { best = f; bv = v; } });
  return best ? { f: best, v: bv } : null;
}
function recSub(f){
  const route = `${f.dep || '????'} → ${f.arr || '????'}`;
  return `${route}${f.date ? ' · ' + f.date.split('-').reverse().join('/') : ''}`;
}
function renderRecords(){
  const box = $('pfRecords'); if(!box) return;
  const fl = db.logbook || [];
  if(!fl.length){ box.innerHTML = '<div class="hint" style="margin:0;">Tes records apparaîtront ici après ton premier vol.</div>'; return; }
  const dist = f => { const t = FBShared.flightTrackedDistance(f); return t != null ? t : (f.distanceNm > 0 ? +f.distanceNm : null); };
  const recs = [];
  const soft = bestBy(fl, f => { const r = FBShared.flightLandingRate(f); return r == null ? null : Math.abs(r); }, (a, b) => a < b);
  if(soft){ const g = FBShared.flightLandingGrade(soft.f); recs.push({ ic: '🧈', cap: 'Atterrissage le plus doux', val: `−${Math.round(soft.v)} ft/min`, color: g && g.color, f: soft.f }); }
  const score = bestBy(fl, f => { const sc = FBShared.flightLandingScore(f); return sc ? sc.score : null; }, (a, b) => a > b);
  if(score){ const sc = FBShared.flightLandingScore(score.f); recs.push({ ic: '🎯', cap: "Meilleure note d'atterrissage", val: `${sc.letter} · ${sc.score}/100`, color: sc.color, f: score.f }); }
  const longT = bestBy(fl, f => f.durationMin > 0 ? +f.durationMin : null, (a, b) => a > b);
  if(longT) recs.push({ ic: '⏱️', cap: 'Vol le plus long', val: minToHhmm(longT.v), f: longT.f });
  const longD = bestBy(fl, dist, (a, b) => a > b);
  if(longD) recs.push({ ic: '🌍', cap: 'Plus longue distance', val: `${Math.round(longD.v).toLocaleString(FBI18N.locale())} NM`, f: longD.f });
  const high = bestBy(fl, f => f.trackData && f.trackData.maxAltFt > 0 ? +f.trackData.maxAltFt : null, (a, b) => a > b);
  if(high) recs.push({ ic: '🏔️', cap: 'Plus haute altitude', val: high.v >= 18000 ? `FL${Math.round(high.v / 100)}` : `${Math.round(high.v).toLocaleString(FBI18N.locale())} ft`, f: high.f });
  const count = {};
  fl.forEach(f => [f.dep, f.arr].filter(Boolean).forEach(a => { a = String(a).toUpperCase(); count[a] = (count[a] || 0) + 1; }));
  const fav = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
  if(fav) recs.push({ ic: '📍', cap: 'Aéroport fétiche', val: fav[0], sub: `${fav[1]} passage${fav[1] > 1 ? 's' : ''} au départ ou à l'arrivée`, icao: fav[0] });
  box.innerHTML = recs.map((r, i) => `<button class="rec" type="button" data-i="${i}">
      <span class="rec-ic">${r.ic}</span>
      <span class="rec-body"><span class="rec-cap">${esc(r.cap)}</span><span class="rec-val"${r.color ? ` style="color:${r.color}"` : ''}>${esc(r.val)}</span><span class="rec-sub">${esc(r.sub || recSub(r.f))}</span></span>
    </button>`).join('');
  box.querySelectorAll('.rec').forEach(b => b.onclick = () => {
    const r = recs[+b.dataset.i];
    if(r.icao){ if(typeof openAirportModal === 'function') openAirportModal(r.icao); return; }
    if(r.f.trackData && Array.isArray(r.f.trackData.path) && r.f.trackData.path.length) openRouteModal(r.f.id);
    else { switchView('logbook'); editLogbookEntry(r.f.id); }
  });
}
FBv18.renderRecords = renderRecords;
FBv18.initProfile = () => {
  renderRecords();
  const tab = document.querySelector('.tabs [data-view="profil"]');
  if(tab) tab.addEventListener('click', renderRecords);
  // Recalcul après chaque modification du logbook (ajout, suppression, PIREP annulé…).
  if(window.FBv15 && FBv15.afterLogbookChange){
    const prev = FBv15.afterLogbookChange;
    FBv15.afterLogbookChange = (...a) => { const r = prev(...a); try{ renderRecords(); }catch(e){} return r; };
  }
  document.addEventListener('keydown', e => {
    if(e.key !== 'Escape') return;
    ['scratchModalOverlay', 'chalModalOverlay'].forEach(id => { const o = $(id); if(o && !o.classList.contains('hidden')) o.classList.add('hidden'); });
  });
};

/* ---------------- Réglages ---------------- */
function bindSettings(){
  if(!$('noticeSound')) return;
  const c = noticeCfg();
  $('noticeSound').checked = c.sound;
  $('noticeVolume').value = c.volume; $('noticeVolumeVal').textContent = c.volume + '%';
  if(typeof updateRangeFill === 'function') updateRangeFill($('noticeVolume'));
  $('noticeSound').addEventListener('change', e => { noticeCfg().sound = e.target.checked; queueSaveDb(); });
  $('noticeVolume').addEventListener('input', e => { noticeCfg().volume = +e.target.value; $('noticeVolumeVal').textContent = e.target.value + '%'; if(typeof updateRangeFill === 'function') updateRangeFill(e.target); queueSaveDb(); });
  $('noticeVolume').addEventListener('change', () => FBv18.testNotice());
}

FBv18.init = async () => {
  bindTracker();
  bindSettings();
  if(FBv18.initProfile) FBv18.initProfile();
};
// v1.8 : une seule initialisation, et démarrage ici si app.js a déjà fini la sienne (fichier local
// lu très vite : app.js peut atteindre la fin de son démarrage avant que ce script soit chargé).
{ const run = FBv18.init; let started = false; FBv18.init = async () => { if(started) return; started = true; return run(); }; }
if(window.__fbAppReady) FBv18.init().catch(e => console.warn('[v1.8]', e));
})();
