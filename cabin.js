/* =========================================================
   FlightBrief — « À bord » : programme passagers du chat (v1.7)
   ---------------------------------------------------------
   Les viewers montent à bord du vol (!embarquer), gagnent des miles pendant qu'ils sont
   présents dans le chat, récoltent un tampon de passeport à chaque arrivée, enchaînent
   des correspondances et reçoivent une carte postale du vol.
   Pendant la croisière, de quoi garder le chat éveillé :
     • Vue du hublot  : ville et pays survolés, à intervalle régulier ;
     • Survol des viewers : « on survole chez Kéro ! » (ville donnée avec !maville),
       annoncé quelques minutes avant, puis au passage ;
     • Programme du vol : au décollage, la liste des viewers qu'on survolera ;
     • Quiz du hublot : ville sous nos ailes, pays, altitude, distance restante (!rep) ;
     • Heure d'arrivée : le chat devine l'heure du toucher (!arrivee 21:47).
   Tout est local : fichier cabin.json dans le dossier de l'appli.
   ========================================================= */
const { EventEmitter } = require('events');
const geo = require('./cabin-geo');
const { writeJsonSafe, readJsonSafe } = require('./backups');

const TIERS = [
  { k: 'membre', name: 'Membre', min: 0, icon: '🎫' },
  { k: 'argent', name: 'Argent', min: 1500, icon: '🥈' },
  { k: 'or', name: 'Or', min: 6000, icon: '🥇' },
  { k: 'platine', name: 'Platine', min: 20000, icon: '💠' },
  { k: 'legende', name: 'Légende', min: 60000, icon: '👑' }
];
const BONUS = { landing: 100, flyover: 150, quiz: 50, arrival: 100, connection: 100 };
const PRESENT_MS = 20 * 60000;   // un passager compte comme présent 20 min après son dernier message
const NM_PER_KM = 1 / 1.852;

const DEFAULT_CFG = {
  enabled: true,
  window: { enabled: true, everyMin: 12 },
  flyover: { enabled: true, radiusKm: 20, warnMin: 5 },
  routeAnnounce: true,
  countries: true,
  quiz: { enabled: true, everyMin: 15, answerSec: 75 },
  arrivalGuess: true,
  title: { autoPropose: true, template: '✈️ {indicatif} · {depart} → {arrivee} · {avion} | !embarquer pour monter à bord', category: 'Microsoft Flight Simulator 2024' },
  publicUrl: '', publicDir: ''
};
function mergeCfg(c) {
  c = c || {};
  return { ...DEFAULT_CFG, ...c, window: { ...DEFAULT_CFG.window, ...(c.window || {}) }, flyover: { ...DEFAULT_CFG.flyover, ...(c.flyover || {}) },
    quiz: { ...DEFAULT_CFG.quiz, ...(c.quiz || {}) }, title: { ...DEFAULT_CFG.title, ...(c.title || {}) } };
}
const tierOf = miles => TIERS.slice().reverse().find(t => miles >= t.min) || TIERS[0];
const nextTier = miles => TIERS.find(t => t.min > miles) || null;
const I18N = require('./renderer/i18n.js');
const fmtNum = n => Math.round(n || 0).toLocaleString(I18N.locale());
const clean = s => String(s || '').replace(/[\u0000-\u001f<>]/g, '').slice(0, 40);

class Cabin extends EventEmitter {
  // ctx : { file, rendererDir, say(text), reply(text, user), alert(a), lookupAirport(icao), getBriefing(), getPhase(), now() }
  constructor(ctx) {
    super();
    this.ctx = ctx;
    this.cfg = mergeCfg(null);
    this.data = this._load();
    this.flight = null;        // session de vol en cours (voir _newFlight)
    this.plan = null;          // { dep, arr, pts:[[lat,lon]] } envoyé par l'interface (route prévue)
    this.quiz = null;
    this.welcomeQueue = [];
    this.welcomeTimer = null;
    this.cooldowns = new Map();
    this._saveTimer = null;
    geo.load(ctx.rendererDir);
  }

  /* ---------- persistance ---------- */
  _load() {
    const d = readJsonSafe(this.ctx.file) || {};
    return { viewers: d.viewers || {}, flights: d.flights || [], lastFlight: d.lastFlight || null };
  }
  _save(now) {
    clearTimeout(this._saveTimer);
    const write = () => { try { writeJsonSafe(this.ctx.file, this.data); } catch (e) { /* best effort */ } };
    if (now) write(); else this._saveTimer = setTimeout(write, 2000);
  }
  setConfig(c) { this.cfg = mergeCfg(c); this.emit('state'); }
  setPlan(p) {
    if (!p || !Array.isArray(p.pts)) { this.plan = null; return; }
    this.plan = { dep: String(p.dep || '').toUpperCase(), arr: String(p.arr || '').toUpperCase(), pts: p.pts.filter(x => Array.isArray(x) && isFinite(x[0]) && isFinite(x[1])).slice(0, 2000) };
  }

  /* ---------- viewers ---------- */
  viewer(user, displayName) {
    let v = this.data.viewers[user];
    if (!v) v = this.data.viewers[user] = { name: clean(displayName || user), miles: 0, flights: 0, nm: 0, stamps: {}, countries: [], postcards: [], trip: null, bestTrip: 0, city: null, hidden: false, since: new Date().toISOString() };
    if (displayName) v.name = clean(displayName);
    return v;
  }
  addMiles(user, n, why) {
    const v = this.data.viewers[user]; if (!v || !n) return;
    const before = tierOf(v.miles);
    v.miles = Math.round((v.miles || 0) + n);
    const after = tierOf(v.miles);
    if (after.min > before.min) {
      this.ctx.say(`${after.icon} ${v.name} passe au statut ${after.name} ! (${fmtNum(v.miles)} miles)`);
      this.ctx.alert({ type: 'cabin-tier', title: `Statut ${after.name}`, text: v.name, icon: after.icon });
    }
    if (this.flight && this.flight.pax.has(user)) { const p = this.flight.pax.get(user); p.miles += n; if (why) p.why[why] = (p.why[why] || 0) + n; }
    this._save();
  }
  isPresent(p) { return Date.now() - p.lastSeen < PRESENT_MS; }

  /* ---------- session de vol ---------- */
  _newFlight(reason) {
    const b = this.ctx.getBriefing() || {};
    this.flight = {
      key: Date.now(), opened: new Date().toISOString(), reason, dep: up(b.dep), arr: up(b.arr), callsign: clean(b.callsign), aircraft: clean(b.aircraft),
      boarding: true, airborne: false, startedAt: null, landedAt: null, pax: new Map(), lastPos: null, distanceNm: 0,
      lastWindow: 0, lastQuiz: 0, country: null, countryCand: null, countryN: 0, countries: [],
      flyoverDone: new Set(), warnDone: new Set(), routeAnnounced: false,
      arrival: { state: 'closed', guesses: new Map() }, stamps: null, postcard: null
    };
    this.emit('state');
    return this.flight;
  }
  openBoarding(manual) {
    if (!this.cfg.enabled) return false;
    if (!this.flight) this._newFlight(manual ? 'manuel' : 'tracker');
    else this.flight.boarding = true;
    const f = this.flight, b = this.ctx.getBriefing() || {};
    f.dep = up(b.dep) || f.dep; f.arr = up(b.arr) || f.arr; f.callsign = clean(b.callsign) || f.callsign; f.aircraft = clean(b.aircraft) || f.aircraft;
    const route = f.dep || f.arr ? ` ${f.dep || '????'} → ${f.arr || '????'}` : '';
    this.ctx.say(`🛫 Embarquement ouvert pour le vol${f.callsign ? ' ' + f.callsign : ''}${route} ! Tape !embarquer pour monter à bord et gagner des miles.`);
    this.ctx.alert({ type: 'cabin-open', title: 'Embarquement ouvert', text: `${f.callsign || 'Vol'}${route}`, data: { dep: f.dep, arr: f.arr } });
    this.emit('state');
    return true;
  }
  closeBoarding() { if (this.flight) { this.flight.boarding = false; this.emit('state'); } }
  // Fin de vol sans atterrissage (tracker coupé) : la session est abandonnée.
  abort() {
    if (!this.flight) return;
    if (!this.flight.landedAt && this.flight.pax.size) this.ctx.say('Vol interrompu : les miles gagnés sont conservés, mais pas de tampon cette fois.');
    this._closeQuiz(false);
    this.flight = null; this.emit('state'); this._save(true);
  }

  board(m, silentIfAboard) {
    const f = this.flight;
    if (!this.cfg.enabled) return false;
    if (!f) { if (!silentIfAboard) this._replyOnce(m, 'board-closed', `@${m.displayName} aucun vol à l'embarquement pour l'instant. Reviens au prochain départ !`); return false; }
    if (f.pax.has(m.user)) { f.pax.get(m.user).lastSeen = Date.now(); if (!silentIfAboard) this._replyOnce(m, 'board-dup', `@${m.displayName} tu es déjà à bord 😉`); return true; }
    const phase = this.ctx.getPhase();
    if (!f.boarding || ['descent', 'approach', 'final_approach', 'touchdown', 'taxi_in'].includes(phase) || f.landedAt) {
      if (!silentIfAboard) this._replyOnce(m, 'board-late', `@${m.displayName} les portes sont fermées pour ce vol, rendez-vous au prochain !`);
      return false;
    }
    const v = this.viewer(m.user, m.displayName);
    // Correspondance : le passager était à bord du vol précédent, et on repart de son arrivée.
    const last = this.data.lastFlight;
    let leg = 1;
    if (v.trip && last && v.trip.lastKey === last.key && last.arr && f.dep && last.arr === f.dep) leg = v.trip.legs.length + 1;
    const p = { user: m.user, name: v.name, joined: Date.now(), lastSeen: Date.now(), miles: 0, why: {}, leg, firstTime: !v.flights, late: !!f.airborne };
    f.pax.set(m.user, p);
    this.welcomeQueue.push(p);
    if (!this.welcomeTimer) this.welcomeTimer = setTimeout(() => this._flushWelcome(), 12000);
    this.emit('state');
    return true;
  }
  _flushWelcome() {
    this.welcomeTimer = null;
    const list = this.welcomeQueue.splice(0);
    if (!list.length || !this.flight) return;
    const names = list.map(p => p.name);
    const conn = list.filter(p => p.leg > 1);
    const shown = names.slice(0, 8).join(', ') + (names.length > 8 ? ` et ${names.length - 8} autres` : '');
    let msg = `🎫 Bienvenue à bord ${shown} ! (${this.flight.pax.size} passager${this.flight.pax.size > 1 ? 's' : ''})`;
    if (conn.length) msg += ' · Correspondance validée pour ' + conn.slice(0, 4).map(p => `${p.name} (${p.leg}e vol d'affilée)`).join(', ');
    this.ctx.say(msg);
    this.ctx.alert({ type: 'cabin-boarding', title: 'Embarquement', data: { names: names.slice(0, 12), more: Math.max(0, names.length - 12), total: this.flight.pax.size, connections: conn.map(p => ({ name: p.name, leg: p.leg })) } });
  }
  _replyOnce(m, kind, text) {
    const k = m.user + '|' + kind, now = Date.now();
    if (this.cooldowns.get(k) && now - this.cooldowns.get(k) < 60000) return;
    this.cooldowns.set(k, now);
    this.ctx.reply(text, m.displayName);
  }

  /* ---------- chat ---------- */
  onMessage(m) {
    if (!this.cfg.enabled) return;
    const f = this.flight;
    if (f && f.pax.has(m.user)) f.pax.get(m.user).lastSeen = Date.now();
    const text = String(m.text || '').trim();
    if (!text.startsWith('!')) return;
    const [raw, ...args] = text.slice(1).split(/\s+/);
    const cmd = geo.norm(raw).replace(/\s/g, '');
    const rest = args.join(' ').trim();
    const C = {
      embarquer: 'board', board: 'board', monter: 'board', abord: 'board', boarding: 'board', embarcar: 'board', abordar: 'board',
      miles: 'miles', statut: 'miles', status: 'miles', millas: 'miles', estatus: 'miles',
      passeport: 'passport', passport: 'passport', pasaporte: 'passport',
      maville: 'city', ville: 'city', mycity: 'city', city: 'city', miciudad: 'city', ciudad: 'city',
      voyage: 'trip', correspondance: 'trip', trip: 'trip', viaje: 'trip',
      passagers: 'pax', manifeste: 'pax', passengers: 'pax', pasajeros: 'pax',
      rep: 'answer', reponse: 'answer', answer: 'answer', resp: 'answer', respuesta: 'answer',
      arrivee: 'arrival', arrival: 'arrival', llegada: 'arrival',
      cabine: 'help', abords: 'help', cabin: 'help', cabina: 'help'
    }[cmd];
    if (!C) return;
    switch (C) {
      case 'board': return this.board(m);
      case 'miles': return this._cmdMiles(m);
      case 'passport': return this._cmdPassport(m, rest);
      case 'city': return this._cmdCity(m, rest);
      case 'trip': return this._cmdTrip(m);
      case 'pax': return this._cmdPax(m);
      case 'answer': return this._cmdAnswer(m, rest);
      case 'arrival': return this._cmdArrival(m, rest);
      case 'help': return this._replyOnce(m, 'help', 'À bord : !embarquer · !miles · !passeport · !maville <ta ville> · !voyage · !passagers · en croisière : !rep <réponse> et !arrivee <hh:mm>');
    }
  }
  _cool(m, k, sec) {
    const key = m.user + '|' + k, now = Date.now();
    if (!m.isMod && this.cooldowns.get(key) && now - this.cooldowns.get(key) < sec * 1000) return false;
    this.cooldowns.set(key, now); return true;
  }
  _cmdMiles(m) {
    if (!this._cool(m, 'miles', 30)) return;
    const v = this.data.viewers[m.user];
    if (!v) return this.ctx.reply(`@${m.displayName} pas encore de miles : tape !embarquer au prochain vol pour commencer.`, m.displayName);
    const t = tierOf(v.miles), n = nextTier(v.miles);
    const rank = this.ranking().findIndex(x => x.user === m.user) + 1;
    this.ctx.reply(`${t.icon} ${v.name} · ${t.name} · ${fmtNum(v.miles)} miles · ${v.flights} vol${v.flights > 1 ? 's' : ''}${rank ? ` · ${rank === 1 ? '1er' : rank + 'e'} du classement` : ''}${n ? ` · encore ${fmtNum(n.min - v.miles)} pour ${n.name}` : ''}`, m.displayName);
  }
  _cmdPassport(m, rest) {
    const v = this.data.viewers[m.user];
    const a = geo.norm(rest);
    if (v && ['cacher', 'masquer', 'prive', 'hide', 'private', 'ocultar', 'privado'].includes(a)) { v.hidden = true; this._save(); return this.ctx.reply(`@${m.displayName} ton passeport n'apparaîtra plus sur le carnet de vol public.`, m.displayName); }
    if (v && ['montrer', 'afficher', 'public', 'show', 'mostrar', 'publico'].includes(a)) { v.hidden = false; this._save(); return this.ctx.reply(`@${m.displayName} ton passeport est de nouveau visible sur le carnet de vol public.`, m.displayName); }
    if (!this._cool(m, 'passport', 30)) return;
    if (!v || !Object.keys(v.stamps).length) return this.ctx.reply(`@${m.displayName} ton passeport est encore vierge : embarque (!embarquer) et atterris avec nous pour ton premier tampon !`, m.displayName);
    const st = Object.entries(v.stamps).sort((a, b) => b[1].count - a[1].count);
    const flags = v.countries.map(geo.flag).join('');
    const url = this.cfg.publicUrl ? ` · ${this.cfg.publicUrl.replace(/\/$/, '')}/#/p/${encodeURIComponent(m.user)}` : '';
    this.ctx.reply(`🛂 Passeport de ${v.name} : ${st.length} aéroport${st.length > 1 ? 's' : ''} (${st.slice(0, 5).map(([k]) => k).join(', ')}${st.length > 5 ? '…' : ''}) · ${v.countries.length} pays ${flags}${url}`, m.displayName);
  }
  _cmdCity(m, rest) {
    const v = this.viewer(m.user, m.displayName);
    const a = geo.norm(rest);
    if (!rest) {
      if (!this._cool(m, 'city', 30)) return;
      return this.ctx.reply(v.city ? `@${m.displayName} ta ville : ${v.city.name} ${geo.flag(v.city.cc)} — on criera quand on passera au-dessus ! (!maville oublier pour l'effacer)` : `@${m.displayName} donne ta ville pour qu'on te salue en la survolant : !maville Lyon (ou !maville Valence ES)`, m.displayName);
    }
    if (['oublier', 'supprimer', 'effacer', 'aucune', 'forget', 'delete', 'none', 'olvidar', 'borrar', 'ninguna'].includes(a)) { v.city = null; this._save(); return this.ctx.reply(`@${m.displayName} ville effacée.`, m.displayName); }
    if (!this._cool(m, 'cityset', 10)) return;
    const c = geo.geocode(rest);
    if (!c) return this.ctx.reply(`@${m.displayName} je ne trouve pas « ${clean(rest)} ». Essaie la grande ville la plus proche, ou ajoute le pays : !maville Valence ES`, m.displayName);
    v.city = { name: c.name, cc: c.cc, lat: c.lat, lon: c.lon };
    this._save();
    this.ctx.reply(`📍 ${m.displayName} habite près de ${c.name} ${geo.flag(c.cc)}. On te fera coucou en passant au-dessus !`, m.displayName);
    this.emit('state');
  }
  _cmdTrip(m) {
    if (!this._cool(m, 'trip', 30)) return;
    const v = this.data.viewers[m.user];
    const cur = this.flight && this.flight.pax.get(m.user);
    if (!v || !v.trip || !v.trip.legs.length) return this.ctx.reply(`@${m.displayName} pas de voyage en cours. Enchaîne les vols sans en rater un pour cumuler des correspondances (bonus de miles) !`, m.displayName);
    const legs = v.trip.legs, chain = [legs[0].dep, ...legs.map(l => l.arr)].join(' → ');
    this.ctx.reply(`🧳 Voyage de ${v.name} : ${chain} (${legs.length} vol${legs.length > 1 ? 's' : ''}${cur && cur.leg > 1 ? `, correspondance en cours vers ${this.flight.arr || '?'}` : ''}) · record : ${v.bestTrip} vol${v.bestTrip > 1 ? 's' : ''} d'affilée`, m.displayName);
  }
  _cmdPax(m) {
    if (!this._cool(m, 'pax', 20)) return;
    const f = this.flight;
    if (!f || !f.pax.size) return this.ctx.reply('Aucun passager à bord pour l\'instant. !embarquer pour être le premier !', m.displayName);
    const list = [...f.pax.values()];
    this.ctx.reply(`👥 ${list.length} passager${list.length > 1 ? 's' : ''} à bord : ${list.slice(0, 15).map(p => p.name).join(', ')}${list.length > 15 ? '…' : ''}`, m.displayName);
  }

  /* ---------- croisière : tick télémétrie (1 Hz) ---------- */
  onTick(d, phase) {
    const f = this.flight;
    if (!this.cfg.enabled || !f || d.lat == null) return;
    const now = Date.now();
    // Miles : distance parcourue en vol, créditée aux passagers présents dans le chat.
    if (f.lastPos && d.phase === 'airborne') {
      const nm = geo.distKm(f.lastPos.lat, f.lastPos.lon, d.lat, d.lon) * NM_PER_KM;
      if (nm < 5) { // saut de position (pause, slew) ignoré
        f.distanceNm += nm;
        for (const p of f.pax.values()) {
          if (!this.isPresent(p)) continue;
          p._acc = (p._acc || 0) + nm;
          if (p._acc >= 1) { const n = Math.floor(p._acc); p._acc -= n; const v = this.data.viewers[p.user]; if (v) { v.nm = (v.nm || 0) + n; this.addMiles(p.user, n, 'distance'); } }
        }
      }
    }
    f.lastPos = { lat: d.lat, lon: d.lon };
    if (d.phase === 'airborne' && !f.airborne) { f.airborne = true; f.startedAt = new Date().toISOString(); }
    if (!f.airborne || d.onGround) return;
    if (!this._tickN) this._tickN = 0;
    this._tickN++;
    const cruising = phase === 'cruise' || (phase === 'climb' && (d.altFt || 0) > 15000);

    // Fermeture de l'embarquement / ouverture du jeu d'heure d'arrivée
    if (phase === 'descent' || phase === 'approach') {
      if (f.boarding) { f.boarding = false; this.emit('state'); }
      if (f.arrival.state === 'open') this._lockArrival();
    }
    if (this.cfg.arrivalGuess && phase === 'cruise' && f.arrival.state === 'closed' && !f.arrival.done) this._openArrival();

    // Programme du vol (une fois, ~1 min après le décollage)
    if (this.cfg.routeAnnounce && !f.routeAnnounced && f.startedAt && now - new Date(f.startedAt) > 60000) { f.routeAnnounced = true; this._announceRoute(); }

    // Survol des viewers (toutes les 5 s suffisent)
    if (this.cfg.flyover.enabled && this._tickN % 5 === 0) this._checkFlyovers(d);
    // Pays (toutes les 20 s, confirmé sur 2 relevés)
    if (this.cfg.countries && (d.altFt || 0) > 4000 && this._tickN % 20 === 0) this._checkCountry(d);
    // Vue du hublot / quiz, seulement en croisière et sans se marcher dessus
    if (cruising && !this.quiz) {
      const winEvery = Math.max(4, this.cfg.window.everyMin) * 60000, quizEvery = Math.max(6, this.cfg.quiz.everyMin) * 60000;
      if (!f.lastWindow) f.lastWindow = now - winEvery + 3 * 60000;   // premier hublot ~3 min après le début de croisière
      if (!f.lastQuiz) f.lastQuiz = now - quizEvery + 8 * 60000;      // premier quiz ~8 min après
      if (this.cfg.window.enabled && now - f.lastWindow > winEvery && now - (f.lastQuizAt || 0) > 90000) { f.lastWindow = now; this._window(d); }
      else if (this.cfg.quiz.enabled && now - f.lastQuiz > quizEvery && now - f.lastWindow > 120000) { f.lastQuiz = now; this._startQuiz(d, phase); }
    }
    if (this.quiz && now > this.quiz.endsAt) this._closeQuiz(true);
  }

  _window(d) {
    const c = geo.notable(d.lat, d.lon, d.headingDeg);
    const alt = d.altFt >= 10000 ? `FL${String(Math.round(d.altFt / 100)).padStart(3, '0')}` : `${fmtNum(d.altFt)} ft`;
    if (!c) {
      this.ctx.say(`🪟 Vue du hublot : pas une ville à l'horizon, juste ${this.flight.country ? 'la campagne' : 'la mer'} · ${alt} · ${d.gsKt} kt sol`);
      this.ctx.alert({ type: 'cabin-window', title: 'Vue du hublot', data: { city: null, country: this.flight.country, alt, gs: d.gsKt } });
      return;
    }
    const where = c.distKm < 8 ? 'juste sous nos ailes' : `à ${Math.round(c.distKm)} km ${sideOf(d.headingDeg, geo.bearingDeg(d.lat, d.lon, c.lat, c.lon))}`;
    this.ctx.say(`🪟 Vue du hublot : ${c.name} ${geo.flag(c.cc)} ${where} · ${alt} · ${d.gsKt} kt sol`);
    this.ctx.alert({ type: 'cabin-window', title: 'Vue du hublot', data: { city: c.name, cc: c.cc, country: geo.countryName(c.cc), flag: geo.flag(c.cc), where, alt, gs: d.gsKt } });
  }
  _checkCountry(d) {
    const f = this.flight, cc = geo.countryAt(d.lat, d.lon);
    if (!cc || cc === f.country) { f.countryCand = null; return; }
    if (f.countryCand !== cc) { f.countryCand = cc; return; }
    const first = !f.country;
    f.country = cc; f.countryCand = null;
    if (!f.countries.includes(cc)) f.countries.push(cc);
    if (first) return; // pays de départ : pas d'annonce
    this.ctx.say(`${geo.flag(cc)} Nouveau pays sous nos ailes : ${geo.countryName(cc)} !`);
    this.ctx.alert({ type: 'cabin-country', title: 'Nouveau pays', data: { cc, name: geo.countryName(cc), flag: geo.flag(cc) } });
  }
  _viewersWithCity() { return Object.entries(this.data.viewers).filter(([, v]) => v.city); }
  _checkFlyovers(d) {
    const f = this.flight, R = this.cfg.flyover.radiusKm;
    for (const [user, v] of this._viewersWithCity()) {
      if (f.flyoverDone.has(user)) continue;
      const c = v.city;
      if (Math.abs(c.lat - d.lat) > 3) continue;
      const dist = geo.distKm(d.lat, d.lon, c.lat, c.lon);
      if (dist <= R) {
        f.flyoverDone.add(user);
        const aboard = f.pax.has(user);
        this.ctx.say(`🏠 On survole chez ${v.name} (${c.name}) ! ${aboard ? `Coucou en bas ! +${BONUS.flyover} miles 🎁` : 'Coucou ! (embarque la prochaine fois pour gagner le bonus)'}`);
        this.ctx.alert({ type: 'cabin-flyover', title: 'Survol', data: { name: v.name, city: c.name, cc: c.cc, flag: geo.flag(c.cc), aboard } });
        if (aboard) this.addMiles(user, BONUS.flyover, 'flyover');
        continue;
      }
      // Préavis : ville devant nous, à moins du rayon de la trajectoire, dans ~warnMin minutes.
      if (f.warnDone.has(user) || !d.gsKt || d.gsKt < 80) continue;
      const brg = geo.bearingDeg(d.lat, d.lon, c.lat, c.lon), delta = ((brg - d.headingDeg + 540) % 360) - 180;
      const along = dist * Math.cos(delta * Math.PI / 180), cross = Math.abs(dist * Math.sin(delta * Math.PI / 180));
      const etaMin = along / (d.gsKt * 1.852) * 60;
      if (along > 0 && cross <= R && etaMin <= this.cfg.flyover.warnMin && etaMin > 1.5) {
        f.warnDone.add(user);
        this.ctx.say(`👀 Dans ~${Math.round(etaMin)} min on passe au-dessus de chez ${v.name} (${c.name}). Prépare-toi à faire coucou !`);
        this.ctx.alert({ type: 'cabin-flyover-soon', title: 'Survol imminent', data: { name: v.name, city: c.name, flag: geo.flag(c.cc), etaMin: Math.round(etaMin) } });
      }
    }
  }
  // Viewers dont la ville est à moins du rayon de la route prévue (OFP SimBrief ou ligne directe).
  plannedFlyovers() {
    const pts = this.plan && this.plan.pts;
    if (!pts || pts.length < 2) return [];
    const R = this.cfg.flyover.radiusKm, out = [];
    const minLat = Math.min(...pts.map(p => p[0])) - 1, maxLat = Math.max(...pts.map(p => p[0])) + 1;
    for (const [user, v] of this._viewersWithCity()) {
      const c = v.city;
      if (c.lat < minLat || c.lat > maxLat) continue;
      let best = Infinity, at = 0, run = 0;
      for (let i = 1; i < pts.length; i++) {
        const dd = segDistKm(c.lat, c.lon, pts[i - 1], pts[i]);
        if (dd.d < best) { best = dd.d; at = run + dd.t * dd.len; }
        run += dd.len;
      }
      if (best <= R) out.push({ user, name: v.name, city: c.name, cc: c.cc, alongKm: at });
    }
    return out.sort((a, b) => a.alongKm - b.alongKm);
  }
  _announceRoute() {
    const list = this.plannedFlyovers();
    if (!list.length) return;
    const names = list.slice(0, 6).map(x => `${x.name} (${x.city})`).join(', ') + (list.length > 6 ? ` et ${list.length - 6} autres` : '');
    this.ctx.say(`🗺️ Au programme de ce vol : on survolera chez ${names}. Ouvrez l'œil !`);
    this.ctx.alert({ type: 'cabin-route', title: 'Au programme', data: { list: list.slice(0, 8).map(x => ({ name: x.name, city: x.city, flag: geo.flag(x.cc) })), more: Math.max(0, list.length - 8) } });
  }

  /* ---------- quiz du hublot ---------- */
  _startQuiz(d, phase) {
    const f = this.flight, kinds = [];
    const city = geo.around(d.lat, d.lon, 60, 30000)[0];
    if (city) kinds.push('city');
    const cc = geo.countryAt(d.lat, d.lon);
    if (cc && f.countries.length > 1) kinds.push('country'); // seulement si on a changé de pays
    kinds.push('alt');
    const arrAp = f.arr && this.ctx.lookupAirport(f.arr);
    if (arrAp) kinds.push('dist');
    const kind = kinds.filter(k => k !== this._lastQuizKind)[Math.floor(Math.random() * kinds.filter(k => k !== this._lastQuizKind).length)] || kinds[0];
    this._lastQuizKind = kind;
    const sec = Math.max(30, this.cfg.quiz.answerSec);
    let q;
    if (kind === 'city') {
      const n = city.name;
      q = { kind, text: `Quelle ville se trouve sous nos ailes ? Indice : ${n.length} lettres, commence par « ${n[0]} »`, answer: n, accept: [geo.norm(n)] };
    } else if (kind === 'country') {
      const names = ['fr', 'en', 'es'].map(l => geo.norm(geo.countryName(cc, l)));
      q = { kind, text: 'Au-dessus de quel pays volons-nous en ce moment ?', answer: `${geo.countryName(cc)} ${geo.flag(cc)}`, accept: names.concat(names.map(n => n.replace(/^(la|le|les|l|the|el|los|las) /, ''))) };
    } else if (kind === 'alt') {
      q = { kind, numeric: true, text: 'À quelle altitude volons-nous (en pieds) ? Le plus proche gagne.', target: Math.round(d.altFt / 100) * 100, unit: 'ft' };
    } else {
      const nm = Math.round(geo.distKm(d.lat, d.lon, arrAp.lat, arrAp.lon) * NM_PER_KM);
      q = { kind, numeric: true, text: `À combien de milles nautiques (NM) sommes-nous de ${f.arr} ? Le plus proche gagne.`, target: nm, unit: 'NM' };
    }
    this.quiz = { ...q, endsAt: Date.now() + sec * 1000, guesses: new Map(), winner: null };
    this.ctx.say(`🧭 Quiz du hublot (+${BONUS.quiz} miles) : ${q.text} — réponds avec !rep … (${sec} s)`);
    this.ctx.alert({ type: 'cabin-quiz', title: 'Quiz du hublot', data: { text: q.text, sec } });
    this.emit('state');
  }
  _cmdAnswer(m, rest) {
    const q = this.quiz;
    if (!q || !rest) return;
    if (!this.flight.pax.has(m.user)) this.board(m, true); // jouer fait monter à bord
    if (q.numeric) {
      const v = parseInt(String(rest).replace(/[^\d]/g, ''), 10);
      if (Number.isFinite(v)) q.guesses.set(m.user, { user: m.user, name: m.displayName, v, at: Date.now() });
      return;
    }
    if (q.winner) return;
    const a = geo.norm(rest).replace(/^(la|le|les|l|the|el|los|las) /, '');
    const ok = q.accept.some(x => x && (x === a || (x.length > 5 && lev(x, a) <= 1)));
    if (ok) { q.winner = { user: m.user, name: m.displayName }; this._closeQuiz(true); }
  }
  _closeQuiz(announce) {
    const q = this.quiz; if (!q) return;
    this.quiz = null;
    if (this.flight) this.flight.lastQuizAt = Date.now();
    if (!announce) return this.emit('state');
    let w = q.winner, txt;
    if (q.numeric) {
      const best = [...q.guesses.values()].map(g => ({ ...g, diff: Math.abs(g.v - q.target) })).sort((a, b) => a.diff - b.diff || a.at - b.at)[0];
      w = best ? { user: best.user, name: best.name, v: best.v } : null;
      txt = `Réponse : ${fmtNum(q.target)} ${q.unit}.` + (w ? ` Bravo ${w.name} (${fmtNum(w.v)}) ! +${BONUS.quiz} miles` : ' Personne n\'a tenté sa chance.');
    } else txt = `Réponse : ${q.answer}.` + (w ? ` Bravo ${w.name}, le plus rapide ! +${BONUS.quiz} miles` : ' Personne n\'a trouvé cette fois.');
    if (w) { this.viewer(w.user, w.name); this.addMiles(w.user, BONUS.quiz, 'quiz'); }
    this.ctx.say('🧭 ' + txt);
    this.ctx.alert({ type: 'cabin-quiz-result', title: 'Quiz du hublot', data: { answer: q.numeric ? `${fmtNum(q.target)} ${q.unit}` : q.answer, winner: w ? w.name : null } });
    this.emit('state');
  }

  /* ---------- heure d'arrivée ---------- */
  _openArrival() {
    const a = this.flight.arrival;
    a.state = 'open'; a.guesses = new Map();
    this.ctx.say(`⏱️ À quelle heure va-t-on toucher la piste${this.flight.arr ? ' à ' + this.flight.arr : ''} ? Pronostique jusqu'au début de la descente : !arrivee 21:47 (+${BONUS.arrival} miles au plus proche)`);
    this.ctx.alert({ type: 'cabin-arrival-open', title: "Heure d'arrivée", data: { arr: this.flight.arr } });
  }
  _lockArrival() {
    const a = this.flight.arrival;
    a.state = 'locked';
    if (a.guesses.size) this.ctx.say(`⏱️ Pronostics d'arrivée fermés (${a.guesses.size}). Verdict au toucher des roues !`);
  }
  _cmdArrival(m, rest) {
    const f = this.flight;
    if (!f || f.arrival.state !== 'open') return;
    const mm = String(rest).match(/(\d{1,2})\s*[h:.]\s*(\d{2})/);
    if (!mm) return;
    const h = +mm[1], mi = +mm[2];
    if (h > 23 || mi > 59) return;
    if (!f.pax.has(m.user)) this.board(m, true);
    f.arrival.guesses.set(m.user, { user: m.user, name: m.displayName, min: h * 60 + mi, label: `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`, at: Date.now() });
    this.emit('state');
  }
  _resolveArrival(when) {
    const a = this.flight.arrival;
    if (a.state === 'closed' || a.done) return;
    a.done = true; a.state = 'closed';
    if (!a.guesses.size) return;
    const t = when.getHours() * 60 + when.getMinutes();
    const diff = g => Math.min(Math.abs(g.min - t), 1440 - Math.abs(g.min - t));
    const best = [...a.guesses.values()].sort((x, y) => diff(x) - diff(y) || x.at - y.at)[0];
    const lbl = `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`;
    this.addMiles(best.user, BONUS.arrival, 'arrival');
    this.ctx.say(`⏱️ Toucher à ${lbl} ! Bravo ${best.name} (${best.label}${diff(best) ? `, à ${diff(best)} min près` : ', pile à la minute'}) +${BONUS.arrival} miles`);
    this.ctx.alert({ type: 'cabin-arrival-result', title: "Heure d'arrivée", data: { time: lbl, winner: best.name, guess: best.label } });
  }

  /* ---------- atterrissage : tampons, correspondances, bonus ---------- */
  onLanded(info) {
    const f = this.flight;
    if (!this.cfg.enabled || !f || f.landedAt) return null;
    f.landedAt = new Date().toISOString();
    f.boarding = false;
    this._closeQuiz(false);
    const arr = up((info && info.icao) || f.arr || (this.ctx.getBriefing() || {}).arr);
    f.arr = arr || f.arr;
    const ap = arr && this.ctx.lookupAirport(arr);
    const city = ap ? geo.cityOf(ap.lat, ap.lon) : null;
    const cc = city ? city.cc : null;
    this._resolveArrival(new Date());
    const last = this.data.lastFlight;
    const pax = [...f.pax.values()];
    const conn = [];
    for (const p of pax) {
      const v = this.viewer(p.user, p.name);
      v.flights = (v.flights || 0) + 1;
      if (arr) {
        const s = v.stamps[arr] || (v.stamps[arr] = { count: 0, first: f.landedAt, name: ap ? ap.name : arr, city: city ? city.name : null, cc });
        s.count++; s.last = f.landedAt;
      }
      if (cc && !v.countries.includes(cc)) v.countries.push(cc);
      // Correspondances
      const continues = v.trip && last && v.trip.lastKey === last.key && last.arr && f.dep && last.arr === f.dep;
      if (!continues) v.trip = { legs: [], lastKey: null };
      v.trip.legs.push({ dep: f.dep || '????', arr: arr || '????', at: f.landedAt });
      v.trip.legs = v.trip.legs.slice(-30);
      v.trip.lastKey = f.key;
      v.bestTrip = Math.max(v.bestTrip || 0, v.trip.legs.length);
      this.addMiles(p.user, BONUS.landing, 'landing');
      if (v.trip.legs.length > 1) { const b = BONUS.connection * (v.trip.legs.length - 1); this.addMiles(p.user, b, 'connection'); conn.push({ name: v.name, legs: v.trip.legs.length, bonus: b }); }
    }
    // Les voyages des viewers absents de ce vol s'arrêtent (correspondance ratée).
    for (const [user, v] of Object.entries(this.data.viewers)) { if (v.trip && last && v.trip.lastKey === last.key && !f.pax.has(user)) v.trip = null; }
    const rec = {
      key: f.key, date: f.landedAt, dep: f.dep || null, arr: arr || null, arrName: ap ? ap.name : null, arrCity: city ? city.name : null, arrCc: cc,
      callsign: f.callsign || null, aircraft: f.aircraft || null, distanceNm: Math.round(f.distanceNm), countries: f.countries,
      passengers: pax.map(p => ({ user: p.user, name: p.name, miles: Math.round(p.miles), leg: p.leg })), postcard: null
    };
    this.data.flights.unshift(rec);
    this.data.flights = this.data.flights.slice(0, 300);
    this.data.lastFlight = { key: f.key, arr: arr || null, dep: f.dep || null };
    this._save(true);
    if (pax.length) {
      const top = pax.slice().sort((a, b) => b.miles - a.miles)[0];
      this.ctx.say(`🛬 Bienvenue à ${city ? city.name : (arr || 'destination')} ! ${pax.length} passager${pax.length > 1 ? 's' : ''} reçoi${pax.length > 1 ? 'vent' : 't'} le tampon ${arr || ''} dans leur passeport (+${BONUS.landing} miles).${conn.length ? ' Correspondances : ' + conn.slice(0, 4).map(c => `${c.name} ${c.legs} vols (+${c.bonus})`).join(', ') + '.' : ''} Plus gros cumul : ${top.name} (${fmtNum(top.miles)} miles).`);
    }
    this.emit('state');
    return { ...rec, depName: f.dep && this.ctx.lookupAirport(f.dep) ? this.ctx.lookupAirport(f.dep).name : null, depCity: this.cityForIcao(f.dep), connections: conn };
  }
  setPostcard(key, file) {
    const r = this.data.flights.find(x => x.key === key);
    if (!r) return;
    r.postcard = file;
    r.passengers.forEach(p => { const v = this.data.viewers[p.user]; if (v) { v.postcards = [...new Set([...(v.postcards || []), file])].slice(-200); } });
    this._save(true);
  }
  // Après l'atterrissage, la session reste ouverte (roulage, bienvenue) jusqu'à la fin du vol.
  onFlightEnd() { if (this.flight && this.flight.landedAt) { this.flight = null; this.emit('state'); } }

  cityForIcao(icao) {
    const ap = icao && this.ctx.lookupAirport(up(icao));
    if (!ap) return null;
    const c = geo.cityOf(ap.lat, ap.lon);
    return c ? c.name : null;
  }

  /* ---------- état pour l'interface et les overlays ---------- */
  ranking(n) {
    return Object.entries(this.data.viewers).map(([user, v]) => ({ user, name: v.name, miles: v.miles || 0, flights: v.flights || 0, stamps: Object.keys(v.stamps || {}).length, countries: (v.countries || []).length, tier: tierOf(v.miles || 0), bestTrip: v.bestTrip || 0, hasCity: !!v.city, hidden: !!v.hidden }))
      .sort((a, b) => b.miles - a.miles).slice(0, n || 1e9);
  }
  publicState() {
    const f = this.flight, next = f ? this._nextFlyover() : null;
    return {
      enabled: this.cfg.enabled,
      flight: f ? { key: f.key, callsign: f.callsign, dep: f.dep, arr: f.arr, boarding: f.boarding, airborne: f.airborne, landed: !!f.landedAt, distanceNm: Math.round(f.distanceNm), country: f.country ? { cc: f.country, name: geo.countryName(f.country), flag: geo.flag(f.country) } : null,
        arrival: { state: f.arrival.state, count: f.arrival.guesses.size } } : null,
      passengers: f ? [...f.pax.values()].map(p => { const v = this.data.viewers[p.user] || {}; const t = tierOf(v.miles || 0); return { user: p.user, name: p.name, miles: Math.round(p.miles), total: v.miles || 0, tier: t.name, tierIcon: t.icon, tierKey: t.k, leg: p.leg, present: this.isPresent(p), first: p.firstTime }; }) : [],
      nextFlyover: next,
      quiz: this.quiz ? { text: this.quiz.text, endsAt: this.quiz.endsAt, count: this.quiz.guesses.size } : null,
      planned: this.plannedFlyovers().slice(0, 12).map(x => ({ name: x.name, city: x.city, flag: geo.flag(x.cc) })),
      viewersCount: Object.keys(this.data.viewers).length,
      citiesCount: this._viewersWithCity().length,
      geo: geo.info()
    };
  }
  _nextFlyover() {
    const f = this.flight, pos = f && f.lastPos;
    if (!pos || !this.plan) return null;
    const list = this.plannedFlyovers().filter(x => !f.flyoverDone.has(x.user));
    if (!list.length) return null;
    // Distance restante approximative : jusqu'au point de la route le plus proche de la ville.
    const x = list.map(c => ({ ...c, d: geo.distKm(pos.lat, pos.lon, this.data.viewers[c.user].city.lat, this.data.viewers[c.user].city.lon) })).sort((a, b) => a.d - b.d)[0];
    return { name: x.name, city: x.city, flag: geo.flag(x.cc), km: Math.round(x.d) };
  }
  viewerDetail(user) {
    const v = this.data.viewers[user];
    if (!v) return null;
    return { user, ...v, tier: tierOf(v.miles || 0), next: nextTier(v.miles || 0), countriesNamed: (v.countries || []).map(cc => ({ cc, name: geo.countryName(cc), flag: geo.flag(cc) })) };
  }
  removeViewer(user) { delete this.data.viewers[user]; if (this.flight) this.flight.pax.delete(user); this._save(true); this.emit('state'); }
  forgetCity(user) { const v = this.data.viewers[user]; if (v) { v.city = null; this._save(true); this.emit('state'); } }
  // Données publiables (carnet de vol public) : jamais les villes des viewers.
  publicExport() {
    const viewers = Object.entries(this.data.viewers).filter(([, v]) => !v.hidden && (v.flights || v.miles)).map(([user, v]) => ({
      id: user, name: v.name, miles: v.miles || 0, flights: v.flights || 0, tier: tierOf(v.miles || 0).name, tierIcon: tierOf(v.miles || 0).icon, bestTrip: v.bestTrip || 0,
      countries: (v.countries || []).map(cc => ({ cc, name: geo.countryName(cc), flag: geo.flag(cc) })),
      stamps: Object.entries(v.stamps || {}).map(([icao, s]) => ({ icao, name: s.name, city: s.city, cc: s.cc, count: s.count, first: s.first })),
      postcards: (v.postcards || []).slice(-60)
    }));
    return { viewers, flights: this.data.flights.map(f => ({ ...f, passengers: f.passengers.filter(p => !(this.data.viewers[p.user] || {}).hidden).map(p => ({ id: p.user, name: p.name, miles: p.miles })) })), tiers: TIERS };
  }
  flightRecordAround(fromMs, toMs) {
    return this.data.flights.find(f => f.key >= fromMs - 6 * 3600000 && new Date(f.date).getTime() >= fromMs && new Date(f.date).getTime() <= toMs) || null;
  }
}

function up(s) { return String(s || '').trim().toUpperCase(); }
function sideOf(hdg, brg) {
  const d = ((brg - (hdg || 0) + 540) % 360) - 180;
  if (Math.abs(d) < 25) return 'droit devant';
  if (Math.abs(d) > 155) return 'derrière nous';
  return d > 0 ? 'sur notre droite' : 'sur notre gauche';
}
// Distance d'un point à un segment [a,b] (projection équirectangulaire locale, km).
function segDistKm(lat, lon, a, b) {
  const k = Math.cos(lat * Math.PI / 180) * 111.32, K = 110.57;
  const ax = (a[1] - lon) * k, ay = (a[0] - lat) * K, bx = (b[1] - lon) * k, by = (b[0] - lat) * K;
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
  let t = len2 ? -(ax * dx + ay * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const px = ax + t * dx, py = ay + t * dy;
  return { d: Math.hypot(px, py), t, len: Math.sqrt(len2) };
}
function lev(a, b) {
  if (Math.abs(a.length - b.length) > 1) return 2;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

module.exports = { Cabin, TIERS, BONUS, DEFAULT_CFG, mergeCfg, geo };
