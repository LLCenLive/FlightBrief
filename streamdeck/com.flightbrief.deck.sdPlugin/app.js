/* =========================================================
   FlightBrief — plugin Stream Deck
   ---------------------------------------------------------
   Lit l'état de FlightBrief chaque seconde (API locale http://127.0.0.1:4814/api/deck/…,
   protégée par le code d'appairage de config.js, écrit par FlightBrief à l'installation)
   et dessine les touches à la volée. Les actions appellent les mêmes fonctions que les
   boutons de l'appli. Molettes et écran tactile du Stream Deck + pris en charge.
   ========================================================= */
const CFG = window.FB_DECK || { port: 4814, token: '', lang: 'en' };
const A = 'com.flightbrief.deck.';
const TXT = {
  fr: { closed: 'FlightBrief\nfermé', pair: 'Réinstaller\nle plugin', off: 'Arrêté', tracker: 'TRACKER', ground: 'Au sol', alt: 'Altitude', gs: 'Vit. sol', vs: 'Vario', eta: 'Arrivée', tod: 'Descente', left: 'restants', done: 'Terminée', copilot: 'Copilote', alerts: 'Alertes', mute: 'Muet', boarding: 'Embarq.', open: 'Ouvert', closedB: 'Fermé', bets: 'Paris', locked: 'Fermés', shot: 'Capture', now: 'Maint.', passed: 'Passé', stream: 'Live off' },
  en: { closed: 'FlightBrief\nclosed', pair: 'Reinstall\nplugin', off: 'Stopped', tracker: 'TRACKER', ground: 'On ground', alt: 'Altitude', gs: 'Gnd speed', vs: 'Vario', eta: 'Arrival', tod: 'Descent', left: 'left', done: 'Done', copilot: 'Copilot', alerts: 'Alerts', mute: 'Muted', boarding: 'Boarding', open: 'Open', closedB: 'Closed', bets: 'Bets', locked: 'Locked', shot: 'Screenshot', now: 'Now', passed: 'Passed', stream: 'Live off' },
  es: { closed: 'FlightBrief\ncerrado', pair: 'Reinstalar\nplugin', off: 'Detenido', tracker: 'TRACKER', ground: 'En tierra', alt: 'Altitud', gs: 'Vel. suelo', vs: 'Vario', eta: 'Llegada', tod: 'Descenso', left: 'pendientes', done: 'Hecha', copilot: 'Copiloto', alerts: 'Alertas', mute: 'Silencio', boarding: 'Embarque', open: 'Abierto', closedB: 'Cerrado', bets: 'Apuestas', locked: 'Cerradas', shot: 'Captura', now: 'Ya', passed: 'Pasado', stream: 'Live off' }
};
const PHASES = {
  fr: { taxi_out: 'Roulage', liftoff: 'Décollage', initial_climb: 'Montée', climb: 'Montée', cruise: 'Croisière', descent: 'Descente', approach: 'Approche', final_approach: 'Finale', touchdown: 'Toucher', taxi_in: 'Roulage' },
  en: { taxi_out: 'Taxi', liftoff: 'Takeoff', initial_climb: 'Climb', climb: 'Climb', cruise: 'Cruise', descent: 'Descent', approach: 'Approach', final_approach: 'Final', touchdown: 'Touchdown', taxi_in: 'Taxi' },
  es: { taxi_out: 'Rodaje', liftoff: 'Despegue', initial_climb: 'Ascenso', climb: 'Ascenso', cruise: 'Crucero', descent: 'Descenso', approach: 'Aproximación', final_approach: 'Final', touchdown: 'Toma', taxi_in: 'Rodaje' }
};
let L = TXT[CFG.lang] || TXT.en;
const PAGES = ['alt', 'gs', 'vs', 'eta', 'tod'];

let ws = null, state = null, error = 'closed';
const ctxs = new Map(); // context -> { action, controller, page, last }

/* ---------- API FlightBrief ---------- */
async function api(path, method) {
  const r = await fetch(`http://127.0.0.1:${CFG.port}/api/deck/${path}`, { method: method || 'GET', headers: { 'X-FlightBrief-Deck': CFG.token }, cache: 'no-store' });
  if (r.status === 401) throw new Error('pair');
  if (!r.ok) throw new Error('http');
  return r.json();
}
async function poll() {
  try { state = await api('state'); error = null; if (state.lang && TXT[state.lang]) L = TXT[state.lang]; }
  catch (e) { state = null; error = e.message === 'pair' ? 'pair' : 'closed'; }
  render();
}
async function act(a) {
  try { state = await api('action?a=' + encodeURIComponent(a), 'POST'); error = null; } catch (e) { error = e.message === 'pair' ? 'pair' : 'closed'; }
  render(); setTimeout(poll, 400);
}

/* ---------- Valeurs affichées ---------- */
const nf = n => Math.round(n).toLocaleString(CFG.lang === 'en' ? 'en-GB' : CFG.lang === 'es' ? 'es-ES' : 'fr-FR');
function value(page) {
  const s = state || {};
  if (page === 'alt') return s.altFt == null ? '—' : s.altFt >= 10000 ? 'FL' + String(Math.round(s.altFt / 100)).padStart(3, '0') : nf(s.altFt) + ' ft';
  if (page === 'gs') return s.gsKt == null ? '—' : s.gsKt + ' kt';
  if (page === 'vs') return s.vsFpm == null ? '—' : (s.vsFpm > 0 ? '+' : '') + nf(s.vsFpm);
  if (page === 'eta') return s.etaIso ? new Date(s.etaIso).toTimeString().slice(0, 5) : '—';
  if (page === 'tod') return s.todMin == null ? '—' : s.todMin <= 0 ? L.passed : s.todMin < 1 ? L.now : Math.round(s.todMin) + ' min';
  return '—';
}

/* ---------- Dessin des touches (SVG 144 × 144) ---------- */
const esc = t => String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const CAMERA = '<g fill="none" stroke="#54d6e8" stroke-width="6" stroke-linejoin="round"><rect x="40" y="34" width="64" height="44" rx="8"/><circle cx="72" cy="56" r="13"/><path d="M58 34l6-9h16l6 9"/></g>';
function key(lines, color, accent, glyph) {
  const n = lines.length, size = [0, 30, 26, 22][Math.min(n, 3)] || 20, step = size + 8, y0 = (glyph ? 112 : 72) - ((n - 1) * step) / 2 + size / 3;
  const text = lines.map((l, i) => `<text x="72" y="${y0 + i * step}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-weight="${i === 0 && n > 1 ? 600 : 700}" font-size="${i === 0 && n > 1 ? size - 6 : size}" fill="${i === 0 && n > 1 ? '#9aa6b2' : color}">${esc(String(l).slice(0, 12))}</text>`).join('');
  return 'data:image/svg+xml;charset=utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144"><rect width="144" height="144" fill="#0a0d11"/><rect x="0" y="136" width="144" height="8" fill="${accent || color}"/>${glyph || ''}${text}</svg>`);
}
const GREEN = '#39e88f', GREY = '#7c8894', AMBER = '#ffb020', CYAN = '#54d6e8', RED = '#ff5c5c';

function keyImage(c) {
  const s = state;
  if (!s) return key((error === 'pair' ? L.pair : L.closed).split('\n'), GREY, RED);
  switch (c.action) {
    case A + 'tracker':
      if (!s.connected) return key([L.tracker, L.off], GREY);
      return key([(PHASES[CFG.lang] || PHASES.en)[s.phase] || (s.flying ? '' : L.ground), value('alt')], GREEN);
    case A + 'flightinfo': { const p = PAGES[c.page % PAGES.length]; return key([L[p], value(p)], CYAN); }
    case A + 'screenshot': return key([L.shot], CYAN, null, CAMERA);
    case A + 'copilot': return key([L.copilot, s.copilot ? 'ON' : 'OFF'], s.copilot ? GREEN : GREY);
    case A + 'boarding': return s.stream === false ? key([L.boarding, L.stream], GREY) : key([L.boarding, s.boarding ? L.open : L.closedB], s.boarding ? GREEN : GREY);
    case A + 'bets': return s.stream === false ? key([L.bets, L.stream], GREY) : key([L.bets, s.bets === 'open' ? L.open : s.bets === 'locked' ? L.locked : '—'], s.bets === 'open' ? GREEN : s.bets === 'locked' ? AMBER : GREY);
    default: return key(['FlightBrief'], GREY);
  }
}
function dialFeedback(c) {
  const s = state;
  if (!s) return { title: 'FlightBrief', value: error === 'pair' ? L.pair.replace('\n', ' ') : L.closed.replace('\n', ' '), indicator: { value: 0 } };
  if (c.action === A + 'copilotdial') return { title: L.copilot, value: s.copilot ? (s.copilotVol || 0) + ' %' : 'OFF', indicator: { value: s.copilot ? s.copilotVol || 0 : 0 } };
  if (c.action === A + 'alertsdial') return { title: L.alerts, value: s.alertsSound ? (s.alertsVol || 0) + ' %' : L.mute, indicator: { value: s.alertsSound ? s.alertsVol || 0 : 0 } };
  const pages = PAGES, p = pages[((c.page % pages.length) + pages.length) % pages.length];
  return { title: L[p], value: value(p), indicator: { value: Math.round(((pages.indexOf(p) + 1) / pages.length) * 100) } };
}
function render() {
  for (const [ctx, c] of ctxs) {
    if (c.controller === 'Encoder') {
      const fb = dialFeedback(c), sig = JSON.stringify(fb);
      if (sig !== c.last) { c.last = sig; send({ event: 'setFeedback', context: ctx, payload: fb }); }
    } else {
      const img = keyImage(c);
      if (img !== c.last) { c.last = img; send({ event: 'setImage', context: ctx, payload: { image: img, target: 0 } }); }
    }
  }
}

/* ---------- Événements Stream Deck ---------- */
function send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }
function onKey(c) {
  switch (c.action) {
    case A + 'tracker': return act('tracker');
    case A + 'flightinfo': c.page++; c.last = null; return render();
    case A + 'screenshot': send({ event: 'showOk', context: c.ctx }); return act('shot');
    case A + 'copilot': return act('copilot');
    case A + 'boarding': return act('boarding');
    case A + 'bets': return act('bets');
  }
}
function onDial(c, ticks) {
  if (c.action === A + 'infodial') { c.page += ticks; c.last = null; return render(); }
  const a = c.action === A + 'copilotdial' ? 'copilot-vol' : 'alerts-vol';
  for (let i = 0; i < Math.min(4, Math.abs(ticks)); i++) act(a + (ticks > 0 ? '+' : '-'));
}
function onPush(c) {
  if (c.action === A + 'copilotdial') return act('copilot');
  if (c.action === A + 'alertsdial') return act('alerts-mute');
  if (c.action === A + 'infodial') return act('copilot-brief');
}

// Appelée par le logiciel Stream Deck au chargement du plugin.
window.connectElgatoStreamDeckSocket = function (port, uuid, registerEvent) {
  ws = new WebSocket('ws://127.0.0.1:' + port);
  ws.onopen = () => { send({ event: registerEvent, uuid }); poll(); };
  ws.onmessage = e => {
    const m = JSON.parse(e.data), ctx = m.context;
    if (m.event === 'willAppear') { ctxs.set(ctx, { ctx, action: m.action, controller: (m.payload && m.payload.controller) || 'Keypad', page: 0, last: null }); render(); }
    else if (m.event === 'willDisappear') ctxs.delete(ctx);
    else if (!ctxs.has(ctx)) return;
    else if (m.event === 'keyDown') onKey(ctxs.get(ctx));
    else if (m.event === 'dialRotate') onDial(ctxs.get(ctx), (m.payload && m.payload.ticks) || 0);
    else if (m.event === 'dialDown') onPush(ctxs.get(ctx));
    else if (m.event === 'touchTap') { const c = ctxs.get(ctx); if (c.action === A + 'infodial') { c.page++; c.last = null; render(); } else onPush(c); }
  };
  setInterval(poll, 1000);
};
