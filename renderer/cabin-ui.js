/* =========================================================
   FlightBrief 1.7 — « À bord » (interface)
   ---------------------------------------------------------
   Onglet « À bord » (réglages, vol en cours, fidèles, cartes postales, carnet public),
   fenêtre « Titre du stream » proposée au lancement du vol, et dessin de la carte postale
   à l'atterrissage (canvas -> JPEG enregistré par le processus principal).
   Le moteur (miles, survols, quiz…) tourne dans cabin.js, côté processus principal.
   ========================================================= */
(function(){
'use strict';
const FBCabin = {};
window.FBCabin = FBCabin;
const $ = id => document.getElementById(id);
const esc = s => escapeHtml(s == null ? '' : String(s));
const nf = n => Math.round(n || 0).toLocaleString(FBI18N.locale());

let st = null, ranking = [], obsUrl = '';

/* ---------- réglages (stockés dans db.cabinCfg, poussés au moteur) ---------- */
const DEF = {
  enabled: true, window: { enabled: true, everyMin: 12 }, flyover: { enabled: true, radiusKm: 20, warnMin: 5 }, routeAnnounce: true, countries: true,
  quiz: { enabled: true, everyMin: 15, answerSec: 75 }, arrivalGuess: true,
  title: { autoPropose: true, template: '✈️ {indicatif} · {depart} → {arrivee} · {avion} | !embarquer pour monter à bord', category: 'Microsoft Flight Simulator 2024' },
  publicUrl: '', publicDir: '', publicPilot: '', publicRoutes: true, publicPax: true
};
function cfg(){
  // Complète en place (les champs du formulaire gardent une référence vers ces objets).
  const fill = (o, d) => { for(const k in d){ if(!(k in o)) o[k] = (d[k] && typeof d[k] === 'object') ? { ...d[k] } : d[k]; else if(d[k] && typeof d[k] === 'object' && o[k] && typeof o[k] === 'object') fill(o[k], d[k]); } return o; };
  if(!db.cabinCfg || typeof db.cabinCfg !== 'object') db.cabinCfg = {};
  return fill(db.cabinCfg, DEF);
}
const push = debounce(() => { queueSaveDb(); if(window.cabin) window.cabin.setConfig(cfg()); }, 200);

function bindSettings(){
  const c = cfg();
  const sw = (id, get, set) => { const n = $(id); n.checked = !!get(); n.addEventListener('change', () => { set(n.checked); push(); }); };
  const rng = (id, suf, get, set) => { const n = $(id), v = $(id + 'Val'); n.value = get(); v.textContent = get() + suf; updateRangeFill(n);
    n.addEventListener('input', () => { set(+n.value); v.textContent = n.value + suf; updateRangeFill(n); push(); }); };
  const txt = (id, get, set) => { const n = $(id); n.value = get() || ''; n.addEventListener('input', () => { set(n.value); push(); }); };
  sw('cbEnabled', () => c.enabled, v => { c.enabled = v; renderState(); });
  sw('cbWindow', () => c.window.enabled, v => c.window.enabled = v);
  rng('cbWindowEvery', ' min', () => c.window.everyMin, v => c.window.everyMin = v);
  sw('cbFlyover', () => c.flyover.enabled, v => c.flyover.enabled = v);
  rng('cbFlyRadius', ' km', () => c.flyover.radiusKm, v => c.flyover.radiusKm = v);
  sw('cbRouteAnnounce', () => c.routeAnnounce, v => c.routeAnnounce = v);
  sw('cbCountries', () => c.countries, v => c.countries = v);
  sw('cbQuiz', () => c.quiz.enabled, v => c.quiz.enabled = v);
  rng('cbQuizEvery', ' min', () => c.quiz.everyMin, v => c.quiz.everyMin = v);
  sw('cbArrival', () => c.arrivalGuess, v => c.arrivalGuess = v);
  sw('cbTitleAuto', () => c.title.autoPropose, v => c.title.autoPropose = v);
  txt('cbTitleTpl', () => c.title.template, v => c.title.template = v);
  txt('cbTitleCat', () => c.title.category, v => c.title.category = v);
  txt('cbPubPilot', () => c.publicPilot || (db.userProfile && db.userProfile.twitchHandle) || '', v => c.publicPilot = v.trim());
  txt('cbPubUrl', () => c.publicUrl, v => c.publicUrl = v.trim());
  sw('cbPubRoutes', () => c.publicRoutes, v => c.publicRoutes = v);
  sw('cbPubPax', () => c.publicPax, v => c.publicPax = v);
  $('cbPubDir').value = c.publicDir || '';
  $('cbSearch').addEventListener('input', debounce(renderRanking, 120));
}

/* ---------- état en direct ---------- */
function renderState(){
  if(!$('cbFlight')) return;
  const s = st || {}, f = s.flight, c = cfg();
  const twOn = !!(db.twitch && db.twitch.enabled);
  $('cbDot').className = 'dot' + (c.enabled && twOn ? ' on' : '');
  $('cbStatus').textContent = !c.enabled ? 'Désactivé' : !twOn ? 'En attente : active le bot dans l\'onglet Twitch' : f ? (f.landed ? 'Arrivés : tampons distribués' : f.boarding ? 'Embarquement ouvert' : 'En vol') : 'Prêt : l\'embarquement s\'ouvre au lancement du tracker';
  $('cbFlightState').textContent = !f ? 'Pas de vol' : f.landed ? 'Arrivé' : f.boarding ? 'Embarquement' : 'Portes fermées';
  $('cbFlightState').className = 'bet-state' + (f && f.boarding ? ' open' : f ? ' locked' : '');
  $('cbFlight').innerHTML = f ? `<div class="cb-route"><b>${esc(f.dep || '????')} → ${esc(f.arr || '????')}</b>${f.callsign ? ' · ' + esc(f.callsign) : ''}${f.country ? ` · ${esc(f.country.flag)} ${esc(f.country.name)}` : ''}${f.distanceNm ? ` · ${nf(f.distanceNm)} NM` : ''}</div>`
    + (s.quiz ? `<div class="cb-live">🧭 Quiz en cours : ${esc(s.quiz.text)} <small>(${s.quiz.count} réponse${s.quiz.count > 1 ? 's' : ''})</small></div>` : '')
    + (f.arrival && f.arrival.state !== 'closed' ? `<div class="cb-live">⏱️ Heure d'arrivée : ${f.arrival.count} pronostic${f.arrival.count > 1 ? 's' : ''}${f.arrival.state === 'locked' ? ' (fermé)' : ''}</div>` : '')
    : '<div class="hint">Lance le tracker (ou « Ouvrir l\'embarquement ») pour démarrer un vol avec le chat.</div>';
  const pax = (s.passengers || []).slice().sort((a, b) => b.miles - a.miles);
  $('cbPax').innerHTML = pax.length ? `<div class="cb-pax-head"><span>${pax.length} passager${pax.length > 1 ? 's' : ''} à bord</span><span>miles ce vol</span></div>` + pax.map(p => `
    <div class="cb-pax-row${p.present ? '' : ' away'}" title="${p.present ? 'Actif dans le chat' : 'Inactif depuis plus de 20 min : ne gagne plus de miles'}">
      <span class="tier-ic">${esc(p.tierIcon)}</span><b>${esc(p.name)}</b>${p.first ? '<span class="cb-tag">1er vol</span>' : ''}${p.leg > 1 ? `<span class="cb-tag leg">correspondance ×${p.leg}</span>` : ''}<span class="cb-mi">${nf(p.miles)}</span>
    </div>`).join('') : (f ? '<div class="hint">Personne à bord pour l\'instant.</div>' : '');
  const pl = s.planned || [];
  $('cbPlanned').innerHTML = pl.length ? `<div class="cb-sub">🏠 Survols prévus sur la route</div><div class="cb-chips">${pl.map(x => `<span>${esc(x.flag)} <b>${esc(x.name)}</b> ${esc(x.city)}</span>`).join('')}</div>`
    : (s.citiesCount ? `<div class="hint" style="margin-top:10px;">${s.citiesCount} viewer${s.citiesCount > 1 ? 's ont' : ' a'} donné sa ville ; aucun sous la route prévue de ce vol.</div>` : '');
}
async function renderRanking(){
  const box = $('cbRanking'); if(!box) return;
  const q = ($('cbSearch').value || '').trim().toLowerCase();
  const list = ranking.filter(r => !q || r.name.toLowerCase().includes(q)).slice(0, 60);
  box.innerHTML = list.length ? list.map((r, i) => `<button class="cb-rank-row" onclick="FBCabin.openViewer('${esc(r.user).replace(/'/g, '&#39;')}')">
      <span class="rk">${ranking.indexOf(r) + 1}</span><span class="nm">${esc(r.tier.icon)} ${esc(r.name)}${r.hidden ? ' <small title="Masqué du site public">🙈</small>' : ''}${r.hasCity ? ' <small title="A donné sa ville">📍</small>' : ''}</span>
      <span class="mi">${nf(r.miles)}</span><span class="fl">${r.flights} vol${r.flights > 1 ? 's' : ''} · ${r.stamps} 🛂</span></button>`).join('')
    : `<div class="hint">${ranking.length ? 'Aucun résultat.' : 'Les passagers apparaîtront ici après leur premier !embarquer.'}</div>`;
}
FBCabin.refresh = async () => {
  if(!window.cabin) return;
  st = await window.cabin.getState();
  ranking = await window.cabin.ranking();
  renderState(); renderRanking(); renderCards();
};

/* ---------- fiche d'un viewer ---------- */
FBCabin.openViewer = async user => {
  const v = await window.cabin.viewer(user);
  if(!v) return;
  const stamps = Object.entries(v.stamps || {}).sort((a, b) => String(a[1].first).localeCompare(String(b[1].first)));
  $('cbViewerBody').innerHTML = `
    <div class="modal-head"><h3>${esc(v.tier.icon)} ${esc(v.name)}</h3><button class="btn small" onclick="FBCabin.closeViewer()">Fermer</button></div>
    <div class="cb-v-kpis"><div><b>${esc(v.tier.name)}</b><span>statut</span></div><div><b>${nf(v.miles)}</b><span>miles</span></div><div><b>${v.flights || 0}</b><span>vols</span></div><div><b>${v.bestTrip || 0}</b><span>record d'affilée</span></div></div>
    ${v.next ? `<div class="hint">Encore ${nf(v.next.min - v.miles)} miles pour ${esc(v.next.icon)} ${esc(v.next.name)}.</div>` : ''}
    <div class="cb-sub">Tampons (${stamps.length}) ${v.countriesNamed.map(c => esc(c.flag)).join(' ')}</div>
    <div class="cb-stamps">${stamps.map(([icao, s]) => `<span title="${esc(s.name || '')}"><b>${esc(icao)}</b>${esc(s.city || '')}${s.count > 1 ? ` ×${s.count}` : ''}</span>`).join('') || '<span class="hint">Aucun pour l\'instant.</span>'}</div>
    <div class="cb-sub">Ville</div>
    <div class="hint" style="margin:0 0 10px;">${v.city ? `📍 ${esc(v.city.name)} (${esc(v.city.cc)}) — visible seulement dans l'appli, jamais publiée.` : 'Pas de ville renseignée.'}${v.hidden ? '<br>🙈 Masqué du carnet public (à sa demande).' : ''}</div>
    <div class="btn-row">${v.city ? `<button class="btn small" onclick="FBCabin.forgetCity('${esc(user)}')">Effacer sa ville</button>` : ''}<button class="btn small danger" onclick="FBCabin.removeViewer('${esc(user)}')">Supprimer toutes ses données</button></div>`;
  $('cbViewerOverlay').classList.remove('hidden');
};
FBCabin.closeViewer = () => $('cbViewerOverlay').classList.add('hidden');
FBCabin.forgetCity = async user => { await window.cabin.forgetCity(user); FBCabin.openViewer(user); FBCabin.refresh(); };
FBCabin.removeViewer = async user => {
  if(!confirm('Supprimer définitivement ce viewer (miles, passeport, ville) ?')) return;
  await window.cabin.removeViewer(user); FBCabin.closeViewer(); FBCabin.refresh();
};
FBCabin.boarding = async action => {
  if(action === 'end' && !confirm('Annuler le vol en cours pour « À bord » ? Les miles déjà gagnés sont conservés, pas de tampon.')) return;
  st = await window.cabin.boarding(action); renderState();
};

/* ---------- source OBS ---------- */
FBCabin.copyObs = async () => { await window.api.copyToClipboard(obsUrl); const m = $('cbObsMsg'); m.className = 'status-msg ok'; m.textContent = 'Lien copié ✓ — OBS → Source → Navigateur, 420 × 600 (transparente).'; };

/* ---------- cartes postales ---------- */
async function renderCards(){
  const box = $('cbCards'); if(!box || !window.cabin) return;
  const flights = (await window.cabin.flights()).filter(f => f.postcard).slice(0, 12);
  if(!flights.length){ box.innerHTML = '<div class="hint">Pas encore de carte postale : elles arrivent après ton prochain atterrissage avec des passagers.</div>'; return; }
  const urls = await Promise.all(flights.map(f => window.cabin.postcardUrl(f.postcard)));
  box.innerHTML = flights.map((f, i) => urls[i] ? `<figure><img src="${esc(urls[i])}" loading="lazy" alt=""><figcaption>${esc(f.dep || '')} → ${esc(f.arr || '')} · ${f.passengers.length} passager${f.passengers.length > 1 ? 's' : ''}</figcaption></figure>` : '').join('');
  box.querySelectorAll('img').forEach(img => img.addEventListener('click', () => window.api.openExternal(img.src)));
}

/* ---------- carnet de vol public ---------- */
FBCabin.chooseDir = async () => { const d = await window.cabin.chooseExportDir(); if(!d) return; cfg().publicDir = d; $('cbPubDir').value = d; push(); };
FBCabin.openPubDir = () => { if(cfg().publicDir) window.cabin.openDir(cfg().publicDir); };
FBCabin.exportPublic = async () => {
  const c = cfg(), m = $('cbPubMsg');
  if(!c.publicDir){ await FBCabin.chooseDir(); if(!cfg().publicDir) return; }
  m.className = 'status-msg'; m.textContent = 'Génération…';
  await saveDbNow();
  const r = await window.cabin.exportPublic({ dir: c.publicDir, options: { pilot: c.publicPilot, showRoutes: c.publicRoutes, showPassengers: c.publicPax } });
  m.className = 'status-msg ' + (r.ok ? 'ok' : 'err');
  m.textContent = r.ok ? `Site généré ✓ ${r.flights} vols, ${r.viewers} passagers, ${r.postcards} cartes postales. Ouvre index.html pour le vérifier, puis envoie le contenu du dossier sur GitHub.` : r.error;
};

/* ---------- compte de la chaîne + titre du stream ---------- */
async function renderChan(){
  const box = $('cbChanBox'); if(!box) return;
  const a = await window.cabin.channelAuthInfo();
  box.innerHTML = a.loggedIn ? `<div class="tw-acc-on"><b>${esc(a.login)}</b> connecté <button class="btn small" onclick="FBCabin.chanLogout()">Déconnecter</button></div>`
    : `<button class="btn small" onclick="FBCabin.chanLogin()" ${a.hasClientId ? '' : 'disabled title="Déclare d\'abord ton application Twitch (onglet Twitch)"'}>Connecter le compte de ma chaîne</button>`;
}
FBCabin.chanLogin = async () => {
  const r = await window.cabin.channelLogin(), m = $('cbChanMsg');
  if(!r.ok){ m.className = 'status-msg err'; m.textContent = r.error; return; }
  $('cbChanCode').textContent = r.userCode; $('cbChanDevice').classList.remove('hidden'); m.textContent = '';
};
FBCabin.chanCancel = async () => { await window.cabin.channelCancel(); $('cbChanDevice').classList.add('hidden'); };
FBCabin.chanLogout = async () => { await window.cabin.channelLogout(); renderChan(); };

FBCabin.openTitle = async (sugg) => {
  sugg = sugg || await window.cabin.titleSuggest();
  $('cbTitleText').value = sugg.title || '';
  $('cbTitleCatNow').value = sugg.category || '';
  $('cbTitleCount').textContent = `(${(sugg.title || '').length}/140)`;
  const m = $('cbTitleMsg');
  if(!sugg.auth || !sugg.auth.loggedIn){ m.className = 'status-msg'; m.innerHTML = 'Pour l\'envoyer directement, connecte le compte de ta chaîne dans l\'onglet À bord. En attendant, « Copier » le met dans ton presse-papiers.'; }
  else { m.className = 'status-msg'; m.textContent = `Sera appliqué à la chaîne ${sugg.auth.login}.`; }
  $('cbTitleSend').disabled = !(sugg.auth && sugg.auth.loggedIn);
  $('cbTitleOverlay').classList.remove('hidden');
  setTimeout(() => $('cbTitleText').focus(), 50);
};
FBCabin.closeTitle = () => $('cbTitleOverlay').classList.add('hidden');
FBCabin.copyTitle = async () => { await window.api.copyToClipboard($('cbTitleText').value.trim()); const m = $('cbTitleMsg'); m.className = 'status-msg ok'; m.textContent = 'Titre copié ✓'; };
FBCabin.sendTitle = async () => {
  const btn = $('cbTitleSend'), m = $('cbTitleMsg');
  btn.disabled = true; m.className = 'status-msg'; m.textContent = 'Envoi à Twitch…';
  const r = await window.cabin.setTitle({ title: $('cbTitleText').value, category: $('cbTitleCatNow').value });
  btn.disabled = false;
  m.className = 'status-msg ' + (r.ok ? 'ok' : 'err');
  m.textContent = r.ok ? `Titre mis à jour sur Twitch ✓${r.category ? ' · catégorie ' + r.category : ''}` : r.error;
  if(r.ok) setTimeout(FBCabin.closeTitle, 1400);
};

/* ---------- rattachement au PIREP + détail du vol dans le logbook ---------- */
FBCabin.attachToTrack = async data => {
  if(typeof _pendingTrackData === 'undefined' || !_pendingTrackData || !window.cabin) return;
  try{
    const from = data.startedAt ? new Date(data.startedAt).getTime() : Date.now() - 12 * 3600000;
    const rec = await window.cabin.flightInfo({ from, to: (data.endedAt ? new Date(data.endedAt).getTime() : Date.now()) + 3600000 });
    if(rec){ _pendingTrackData.cabinKey = rec.key; _pendingTrackData.passengers = rec.passengers.map(p => p.name); if(rec.postcard) _pendingTrackData.postcard = rec.postcard; }
  }catch(e){ /* sans info « À bord » */ }
};
FBCabin.renderRouteCabin = async f => {
  const box = $('routeCabin'); if(!box) return;
  const td = (f && f.trackData) || {};
  let rec = null;
  if(td.cabinKey && window.cabin){ rec = (await window.cabin.flights()).find(x => x.key === td.cabinKey) || null; }
  const names = rec ? rec.passengers.map(p => p.name) : (td.passengers || []);
  const card = (rec && rec.postcard) || td.postcard;
  const url = card ? await window.cabin.postcardUrl(card) : null;
  box.classList.toggle('hidden', !names.length && !url);
  $('routeCabinBody').innerHTML = (url ? `<img src="${esc(url)}" alt="Carte postale" class="route-postcard">` : '')
    + (names.length ? `<div class="cb-chips">${names.map(n => `<span>${esc(n)}</span>`).join('')}</div>` : '');
  const img = $('routeCabinBody').querySelector('img'); if(img) img.onclick = () => window.api.openExternal(url);
};

/* =========================================================
   CARTE POSTALE (1600 × 1000) — dessinée à l'atterrissage
   ========================================================= */
let coastCache = null;
async function coast(){ if(coastCache) return coastCache; try{ coastCache = await (await fetch('data/coastlines.json')).json(); }catch(e){ coastCache = []; } return coastCache; }
const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
function fitText(ctx, text, maxW, size, font){ let s = size; do { ctx.font = font.replace('{s}', s); if(ctx.measureText(text).width <= maxW) break; s -= 2; } while(s > 18); return s; }
function wrap(ctx, text, maxW){ const words = String(text).split(' '), lines = []; let cur = ''; words.forEach(w => { const t = cur ? cur + ' ' + w : w; if(ctx.measureText(t).width > maxW && cur){ lines.push(cur); cur = w; } else cur = t; }); if(cur) lines.push(cur); return lines; }
function flagEmoji(cc){ return /^[A-Z]{2}$/.test(cc || '') ? String.fromCodePoint(...[...cc].map(c => 0x1F1E6 + c.charCodeAt(0) - 65)) : ''; }

async function drawRouteArt(ctx, x, y, w, h, path, labels){
  const g = ctx.createLinearGradient(x, y, x, y + h); g.addColorStop(0, '#14324a'); g.addColorStop(1, '#0b1a28');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  if(!path || path.length < 2) return;
  const la = path.map(p => p[0]), lo = path.map(p => p[1]);
  let s = Math.min(...la), n = Math.max(...la), wv = Math.min(...lo), e = Math.max(...lo);
  const pad = Math.max(1.2, (n - s) * .35, (e - wv) * .2); s -= pad; n += pad; wv -= pad; e += pad;
  const k = Math.cos((s + n) / 2 * Math.PI / 180), sx = (e - wv) * k, sy = n - s;
  if(sx / sy > w / h){ const ny = sx * h / w, m = (s + n) / 2; s = m - ny / 2; n = m + ny / 2; } else { const nx = sy * w / h / k, m = (wv + e) / 2; wv = m - nx / 2; e = m + nx / 2; }
  const X = lon => x + (lon - wv) / (e - wv) * w, Y = lat => y + (n - lat) / (n - s) * h;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.strokeStyle = 'rgba(207,233,242,.35)'; ctx.lineWidth = 1.5;
  (await coast()).forEach(line => { ctx.beginPath(); line.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))); ctx.stroke(); });
  ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 5; ctx.setLineDash([2, 12]); ctx.lineCap = 'round';
  ctx.beginPath(); path.forEach((p, i) => i ? ctx.lineTo(X(p[1]), Y(p[0])) : ctx.moveTo(X(p[1]), Y(p[0]))); ctx.stroke(); ctx.setLineDash([]);
  [path[0], path[path.length - 1]].forEach((p, i) => {
    ctx.fillStyle = i ? '#ff6b6b' : '#39e88f'; ctx.beginPath(); ctx.arc(X(p[1]), Y(p[0]), 10, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
    const t = labels && labels[i]; if(!t) return;
    ctx.font = '700 22px ui-monospace, Consolas, monospace'; const tw = ctx.measureText(t).width;
    ctx.fillStyle = 'rgba(10,13,17,.8)'; ctx.fillRect(X(p[1]) + 16, Y(p[0]) - 16, tw + 14, 30);
    ctx.fillStyle = '#fff'; ctx.fillText(t, X(p[1]) + 23, Y(p[0]) + 7);
  });
  ctx.restore();
}

async function buildPostcard(d){
  const W = 1600, H = 1000, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const serif = 'Georgia, "Times New Roman", serif', script = '"Segoe Script", "Brush Script MT", "Comic Sans MS", cursive', sans = '"Segoe UI", system-ui, sans-serif';
  // Papier
  ctx.fillStyle = '#f3ecdf'; ctx.fillRect(0, 0, W, H);
  for(let i = 0; i < 2600; i++){ ctx.fillStyle = `rgba(120,100,70,${Math.random() * .05})`; ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, H * .95); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(90,70,40,.18)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

  // Photo (capture d'atterrissage) ou carte du trajet, posée légèrement de travers.
  const px = 70, py = 80, pw = 860, ph = 840;
  ctx.save(); ctx.translate(px + pw / 2, py + ph / 2); ctx.rotate(-0.018); ctx.translate(-(px + pw / 2), -(py + ph / 2));
  ctx.shadowColor = 'rgba(0,0,0,.28)'; ctx.shadowBlur = 26; ctx.shadowOffsetY = 10;
  ctx.fillStyle = '#fff'; ctx.fillRect(px - 16, py - 16, pw + 32, ph + 32);
  ctx.shadowColor = 'transparent';
  // Avec une capture : photo en haut (format paysage, comme l'écran) et carte du trajet dessous.
  // Sans capture : la carte du trajet occupe tout le cadre.
  let img = null;
  if(d.photo){ try{ img = await loadImg(d.photo); }catch(e){ img = null; } }
  const labels = [d.dep, d.arr];
  const photoH = img ? 570 : 0, gap = img ? 14 : 0;
  if(img){ const r = Math.max(pw / img.width, photoH / img.height), iw = img.width * r, ih = img.height * r; ctx.save(); ctx.beginPath(); ctx.rect(px, py, pw, photoH); ctx.clip(); ctx.drawImage(img, px + (pw - iw) / 2, py + (photoH - ih) / 2, iw, ih); ctx.restore(); }
  await drawRouteArt(ctx, px, py + photoH + gap, pw, ph - photoH - gap, d.path, labels);
  // Bandeau ville (sur la photo, ou en bas de la carte)
  const bandY = img ? py + photoH - 92 : py + ph - 92;
  ctx.fillStyle = 'rgba(10,13,17,.55)'; ctx.fillRect(px, bandY, pw, 92);
  ctx.fillStyle = '#fff'; ctx.font = `700 ${fitText(ctx, (d.arrCity || d.arr || '').toUpperCase(), pw - 60, 54, '700 {s}px ' + sans)}px ${sans}`;
  ctx.fillText((d.arrCity || d.arr || '').toUpperCase(), px + 28, bandY + 62);
  ctx.restore();

  // Séparateur vertical de carte postale
  ctx.strokeStyle = 'rgba(80,65,45,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(990, 120); ctx.lineTo(990, 900); ctx.stroke();

  // Timbre (bords dentelés)
  const sx = 1330, sy = 70, sw = 200, sh = 240;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.18)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
  ctx.fillStyle = '#fffaf0'; ctx.fillRect(sx, sy, sw, sh); ctx.restore();
  ctx.fillStyle = '#f3ecdf';
  for(let t = 0; t <= sw; t += 16){ ctx.beginPath(); ctx.arc(sx + t, sy, 6, 0, Math.PI * 2); ctx.arc(sx + t, sy + sh, 6, 0, Math.PI * 2); ctx.fill(); }
  for(let t = 0; t <= sh; t += 16){ ctx.beginPath(); ctx.arc(sx, sy + t, 6, 0, Math.PI * 2); ctx.arc(sx + sw, sy + t, 6, 0, Math.PI * 2); ctx.fill(); }
  const ink = '#1f5f8b';
  ctx.fillStyle = '#e8f1f6'; ctx.fillRect(sx + 16, sy + 16, sw - 32, sh - 32);
  ctx.strokeStyle = ink; ctx.lineWidth = 2; ctx.strokeRect(sx + 16, sy + 16, sw - 32, sh - 32);
  ctx.textAlign = 'center'; ctx.fillStyle = ink;
  ctx.font = `64px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`; ctx.fillText(flagEmoji(d.arrCc) || '✈', sx + sw / 2, sy + 104);
  ctx.font = `700 38px ui-monospace, Consolas, monospace`; ctx.fillText(d.arr || '', sx + sw / 2, sy + 160);
  ctx.font = `600 13px ${sans}`; ctx.fillText('POSTE AÉRIENNE', sx + sw / 2, sy + 190);
  ctx.font = `600 12px ${sans}`; ctx.fillText(`${d.distanceNm ? nf(d.distanceNm) + ' NM' : 'FLIGHTBRIEF'}`, sx + sw / 2, sy + 210);
  ctx.textAlign = 'left';
  // Cachet de la poste
  ctx.save(); ctx.translate(1290, 300); ctx.rotate(-0.22); ctx.strokeStyle = 'rgba(40,40,48,.55)'; ctx.fillStyle = 'rgba(40,40,48,.6)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, 78, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 64, 0, Math.PI * 2); ctx.stroke();
  ctx.textAlign = 'center'; ctx.font = `700 15px ${sans}`; ctx.fillText((d.arrCity || d.arr || '').toUpperCase().slice(0, 14), 0, -16);
  ctx.font = `700 19px ui-monospace, Consolas, monospace`; ctx.fillText(d.dateLabel, 0, 10); ctx.font = `600 12px ${sans}`; ctx.fillText('FLIGHTBRIEF', 0, 32);
  for(let i = 0; i < 4; i++){ ctx.beginPath(); for(let x2 = 90; x2 < 300; x2 += 4) { const y2 = -30 + i * 20 + Math.sin(x2 / 14) * 5; x2 === 90 ? ctx.moveTo(x2, y2) : ctx.lineTo(x2, y2); } ctx.stroke(); }
  ctx.restore(); ctx.textAlign = 'left';

  // Texte
  const tx = 1030, tw = 500;
  ctx.fillStyle = '#5b5348'; ctx.font = `italic 40px ${serif}`; ctx.fillText('Bons baisers de', tx, 420);
  const city = d.arrCity || d.arr || 'destination';
  ctx.fillStyle = '#2b2a33'; const cs = fitText(ctx, city, tw, 86, '700 {s}px ' + serif); ctx.font = `700 ${cs}px ${serif}`; ctx.fillText(city, tx, 420 + cs + 6);
  let y = 420 + cs + 70;
  ctx.font = `500 23px ${sans}`; ctx.fillStyle = '#3b3a43';
  const leg = [`Vol ${d.callsign || ''}`.trim(), `${d.depCity || d.dep || '?'} → ${city}`].filter(Boolean).join(' · ');
  const meta = [d.aircraft, d.durationLabel, d.distanceNm ? nf(d.distanceNm) + ' NM' : null].filter(Boolean).join(' · ');
  const land = d.fpm != null ? `Toucher −${nf(Math.abs(d.fpm))} ft/min${d.letter ? ' · note ' + d.letter : ''}` : null;
  [leg, meta, land].filter(Boolean).forEach(t => { wrap(ctx, t, tw).forEach(l => { ctx.fillText(l, tx, y); y += 34; }); });
  // Lignes d'adresse + passagers à la main
  y += 16;
  ctx.fillStyle = '#5b5348'; ctx.font = `600 15px ${sans}`; ctx.fillText(`À BORD · ${d.passengers.length} PASSAGER${d.passengers.length > 1 ? 'S' : ''}`, tx, y); y += 12;
  ctx.font = `28px ${script}`; ctx.fillStyle = '#1f3f7a';
  const shown = d.passengers.slice(0, 40), more = d.passengers.length - shown.length;
  const lines = wrap(ctx, shown.join(', ') + (more > 0 ? ` et ${more} autres` : ''), tw).slice(0, 5);
  lines.forEach(l => { y += 44; ctx.strokeStyle = 'rgba(80,65,45,.25)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(tx, y + 10); ctx.lineTo(tx + tw, y + 10); ctx.stroke(); ctx.fillText(l, tx, y); });
  // Signature
  ctx.font = `34px ${script}`; ctx.fillStyle = '#1f3f7a'; ctx.textAlign = 'right'; ctx.fillText('— ' + (d.pilot || 'Le commandant de bord'), 1540, 935); ctx.textAlign = 'left';
  return cv.toDataURL('image/jpeg', 0.9);
}

async function onLanded(rec){
  if(!rec || !rec.passengers || !rec.passengers.length) return;
  // Laisse le temps à la capture automatique d'atterrissage (+4 s) d'être prise.
  await new Promise(r => setTimeout(r, 9000));
  let photo = null;
  try{
    if(window.shots){
      const from = rec.startedAt ? new Date(rec.startedAt).getTime() - 60000 : Date.now() - 6 * 3600000;
      const list = await window.shots.list({ from, to: Date.now() + 1000 });
      const pick = list[list.length - 1]; // la plus récente : la capture auto d'atterrissage si elle est activée
      if(pick) photo = await window.shots.dataUrl(pick.name);
    }
  }catch(e){ photo = null; }
  const card = (window.FBv15 && FBv15.lastLandingCard) || {};
  const pts = (typeof _liveTrackPoints !== 'undefined' && _liveTrackPoints.length > 1) ? _liveTrackPoints.slice() : null;
  const mins = rec.startedAt ? Math.round((Date.now() - new Date(rec.startedAt)) / 60000) : null;
  const now = new Date();
  try{
    const dataUrl = await buildPostcard({
      photo, path: pts, arr: rec.arr, arrCity: rec.arrCity, arrCc: rec.arrCc, dep: rec.dep, depCity: rec.depCity, callsign: rec.callsign, aircraft: rec.aircraft,
      distanceNm: rec.distanceNm, durationLabel: mins ? (mins >= 60 ? `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, '0')}` : `${mins} min`) : null,
      fpm: card.fpm != null ? card.fpm : rec.landingRate, letter: card.letter || null,
      passengers: rec.passengers.map(p => p.name), pilot: cfg().publicPilot || (db.userProfile && (db.userProfile.twitchHandle || db.userProfile.firstName)) || '',
      dateLabel: now.toLocaleDateString(FBI18N.locale(), { day: '2-digit', month: '2-digit', year: '2-digit' })
    });
    const r = await window.cabin.savePostcard({ key: rec.key, dataUrl, city: rec.arrCity || rec.arr });
    if(r.ok && window.FBv15 && FBv15.fx) FBv15.fx(`<div class="shot-toast"><img src="${esc(r.file)}" alt=""><div><div class="lc-eyebrow">Carte postale</div><div class="hint" style="margin:2px 0 0;">Bons baisers de ${esc(rec.arrCity || rec.arr || '')} · ${rec.passengers.length} passager${rec.passengers.length > 1 ? 's' : ''}.<br>Envoyée sur l'overlay Alertes.</div></div></div>`, 'fx-shot', 7000);
    renderCards();
  }catch(e){ console.warn('[À bord] carte postale', e); }
}
FBCabin._buildPostcard = buildPostcard; // (tests)

/* ---------- démarrage ---------- */
FBCabin.onViewChange = name => { if(name === 'cabin'){ FBCabin.refresh(); renderChan(); const f = $('cbObsFrame'); if(f && obsUrl && !f.src) f.src = obsUrl + '?preview=1'; } };
async function init(){
  if(!window.cabin || !$('view-cabin')) return;
  try{ bindSettings(); }catch(e){ console.warn('[À bord] réglages', e); }
  window.cabin.setConfig(cfg());
  window.cabin.onState(s => { st = s; renderState(); if($('view-cabin').classList.contains('active')) window.cabin.ranking().then(r => { ranking = r; renderRanking(); }); });
  window.cabin.onLanded(rec => onLanded(rec));
  window.cabin.onProposeTitle(s => { if(streamFeaturesOn()) FBCabin.openTitle(s); });
  window.cabin.onChannelLogin(r => { $('cbChanDevice').classList.add('hidden'); const m = $('cbChanMsg'); m.className = 'status-msg ' + (r.ok ? 'ok' : 'err'); m.textContent = r.ok ? `Compte ${r.login} connecté ✓` : `Connexion annulée ou refusée (${r.error}).`; renderChan(); });
  $('cbTitleText').addEventListener('input', e => { $('cbTitleCount').textContent = `(${e.target.value.length}/140)`; });
  try{ const port = await window.alerts.getPort(); obsUrl = `http://localhost:${port}/cabin`; $('cbObsLink').value = obsUrl; }catch(e){ /* ignoré */ }
  // Prolonge la navigation d'onglets de v1.5 sans la modifier.
  if(window.FBv15){ const prev = FBv15.onViewChange; FBv15.onViewChange = name => { prev && prev(name); FBCabin.onViewChange(name); }; }
  st = await window.cabin.getState(); renderState();
}
if(window.__fbAppReady) init(); else window.addEventListener('fb:ready', init, { once: true });
FBCabin.init = init;
})();
