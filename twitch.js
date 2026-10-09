/* =========================================================
   FlightBrief — bot Twitch (v1.5)
   ---------------------------------------------------------
   • Chat Twitch via IRC sécurisé (irc.chat.twitch.tv:6697, TLS) : aucune dépendance.
     - Sans compte connecté : lecture ANONYME du chat (justinfanXXXX). Les commandes
       fonctionnent quand même : les réponses s'affichent sur l'overlay « Alertes » d'OBS.
     - Compte connecté (connexion Twitch par code, « Device Code Flow ») : le bot répond
       aussi directement dans le chat, sous le nom du compte connecté (ton compte ou un
       compte dédié au bot), préfixé du nom de bot choisi.
   • Commandes : !eta !route !metar !avion !alt !landing !pari !top !fb
   • Pari sur l'atterrissage : ouverture auto au début de la descente, fermeture auto
     sous 1 000 ft sol, résultat au toucher (le plus proche du taux réel gagne).
   ========================================================= */
const tls = require('tls');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

/* ⚙️ Client ID de l'application Twitch de FlightBrief.
   À créer UNE FOIS sur https://dev.twitch.tv/console/apps → « Enregistrer votre application » :
     - Nom : FlightBrief (ou autre)
     - URL de redirection OAuth : http://localhost
     - Catégorie : Chat Bot
     - Type de client : PUBLIC (important : pas de secret, c'est ce qui permet la connexion par code)
   puis colle ici le « ID client » obtenu. Un Client ID n'est pas un secret : il peut être
   publié dans le dépôt. Les utilisateurs peuvent aussi en saisir un autre dans l'appli. */
const DEFAULT_CLIENT_ID = '';

const SCOPES = 'chat:read chat:edit';
const IRC_HOST = 'irc.chat.twitch.tv';
const IRC_PORT = 6697;

/* ---------------- Connexion OAuth par code (Device Code Grant) ---------------- */
function form(obj) {
  return Object.entries(obj).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
}

class TwitchAuth {
  constructor(fetchFn, storeFile, crypt) {
    this.fetch = fetchFn;
    this.file = storeFile;
    this.crypt = crypt || null; // { encrypt(str)->Buffer, decrypt(Buffer)->str } (safeStorage)
    this.data = this._load(); // { clientId, accessToken, refreshToken, expiresAt, login, userId }
    this._pollAbort = null;
  }
  _load() {
    try {
      const raw = fs.readFileSync(this.file);
      if (this.crypt && raw[0] !== 0x7b /* { */) return JSON.parse(this.crypt.decrypt(raw));
      return JSON.parse(raw.toString('utf-8'));
    } catch (e) { return {}; }
  }
  _save() {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const json = JSON.stringify(this.data);
      fs.writeFileSync(this.file, this.crypt ? this.crypt.encrypt(json) : json);
    } catch (e) { /* best effort */ }
  }
  clientId(override) { return String(override || this.data.clientId || DEFAULT_CLIENT_ID || '').trim(); }
  isLoggedIn() { return !!(this.data.accessToken && this.data.login); }
  publicInfo() { return { loggedIn: this.isLoggedIn(), login: this.data.login || null, hasClientId: !!this.clientId() }; }

  async startDevice(clientIdOverride) {
    const clientId = this.clientId(clientIdOverride);
    if (!clientId) throw new Error("Aucun Client ID Twitch configuré (voir « Réglages avancés »).");
    const res = await this.fetch('https://id.twitch.tv/oauth2/device', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({ client_id: clientId, scopes: SCOPES })
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.message || ('HTTP ' + res.status));
    return { clientId, deviceCode: j.device_code, userCode: j.user_code, verificationUri: j.verification_uri, interval: j.interval || 5, expiresIn: j.expires_in || 1800 };
  }

  // Attend que l'utilisateur ait validé le code sur twitch.tv/activate.
  async pollDevice(dev, onTick) {
    const until = Date.now() + dev.expiresIn * 1000;
    let interval = Math.max(2, dev.interval) * 1000;
    const abort = { aborted: false };
    this._pollAbort = abort;
    while (Date.now() < until) {
      await new Promise(r => setTimeout(r, interval));
      if (abort.aborted) throw new Error('Connexion annulée.');
      const res = await this.fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form({ client_id: dev.clientId, scopes: SCOPES, device_code: dev.deviceCode, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' })
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.access_token) {
        this.data = { clientId: dev.clientId, accessToken: j.access_token, refreshToken: j.refresh_token || null, expiresAt: Date.now() + (j.expires_in || 3600) * 1000 };
        await this.validate();
        this._save();
        return this.publicInfo();
      }
      const msg = String(j.message || '').toLowerCase();
      if (msg.includes('slow_down')) interval += 2000;
      else if (!msg.includes('authorization_pending')) throw new Error(j.message || ('HTTP ' + res.status));
      onTick && onTick();
    }
    throw new Error('Code expiré : relance la connexion.');
  }
  cancelPoll() { if (this._pollAbort) this._pollAbort.aborted = true; }

  async validate() {
    if (!this.data.accessToken) return false;
    const res = await this.fetch('https://id.twitch.tv/oauth2/validate', { headers: { Authorization: 'OAuth ' + this.data.accessToken } });
    if (res.status === 401) return false;
    const j = await res.json().catch(() => ({}));
    if (!res.ok) return false;
    this.data.login = j.login; this.data.userId = j.user_id;
    if (j.expires_in) this.data.expiresAt = Date.now() + j.expires_in * 1000;
    this._save();
    return true;
  }

  async refresh() {
    if (!this.data.refreshToken) return false;
    const res = await this.fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({ client_id: this.clientId(), grant_type: 'refresh_token', refresh_token: this.data.refreshToken })
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.access_token) return false;
    this.data.accessToken = j.access_token;
    if (j.refresh_token) this.data.refreshToken = j.refresh_token;
    this.data.expiresAt = Date.now() + (j.expires_in || 3600) * 1000;
    this._save();
    return true;
  }

  // Jeton valide ou null (rafraîchi si besoin).
  async ensureToken() {
    if (!this.data.accessToken) return null;
    if (this.data.expiresAt && this.data.expiresAt - Date.now() > 5 * 60000) return this.data.accessToken;
    if (await this.validate()) return this.data.accessToken;
    if (await this.refresh()) { await this.validate(); return this.data.accessToken; }
    return null;
  }

  logout() {
    const token = this.data.accessToken, clientId = this.clientId();
    this.data = { clientId: this.data.clientId };
    this._save();
    if (token && clientId) {
      this.fetch('https://id.twitch.tv/oauth2/revoke', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form({ client_id: clientId, token })
      }).catch(() => {});
    }
  }
  setClientId(id) { this.data.clientId = String(id || '').trim(); this._save(); }
}

/* ---------------- Chat IRC ---------------- */
function parseTags(raw) {
  const tags = {};
  raw.split(';').forEach(kv => { const i = kv.indexOf('='); tags[kv.slice(0, i)] = kv.slice(i + 1).replace(/\\s/g, ' ').replace(/\\:/g, ';').replace(/\\\\/g, '\\'); });
  return tags;
}
function parseLine(line) {
  let rest = line, tags = {}, prefix = '';
  if (rest[0] === '@') { const i = rest.indexOf(' '); tags = parseTags(rest.slice(1, i)); rest = rest.slice(i + 1); }
  if (rest[0] === ':') { const i = rest.indexOf(' '); prefix = rest.slice(1, i); rest = rest.slice(i + 1); }
  const ti = rest.indexOf(' :');
  const trailing = ti >= 0 ? rest.slice(ti + 2) : null;
  const parts = (ti >= 0 ? rest.slice(0, ti) : rest).split(' ').filter(Boolean);
  return { tags, prefix, command: parts[0], params: parts.slice(1), trailing };
}

class TwitchChat extends EventEmitter {
  constructor() {
    super();
    this.sock = null; this.buf = ''; this.channel = null; this.login = null; this.anonymous = true;
    this.state = 'disconnected'; this.wanted = false; this.retry = 0; this.retryTimer = null;
    this.queue = []; this.sentTimes = []; this.drainTimer = null; this.pingTimer = null; this.lastRx = 0;
    this.getToken = null;
  }
  _status(state, extra) { this.state = state; this.emit('status', { state, channel: this.channel, anonymous: this.anonymous, login: this.login, ...(extra || {}) }); }

  // opts : { channel, getToken: async () => ({ login, token }) | null }
  start(opts) {
    this.stop(true);
    this.channel = String(opts.channel || '').replace(/^#/, '').trim().toLowerCase();
    this.getToken = opts.getToken;
    if (!this.channel) { this._status('disconnected', { error: 'Indique la chaîne Twitch à rejoindre.' }); return; }
    this.wanted = true; this.retry = 0;
    this._connect();
  }
  stop(silent) {
    this.wanted = false;
    clearTimeout(this.retryTimer); clearInterval(this.pingTimer); clearTimeout(this.drainTimer);
    this.retryTimer = null; this.pingTimer = null; this.drainTimer = null; this.queue = [];
    if (this.sock) { try { this.sock.destroy(); } catch (e) { /* ignoré */ } }
    this.sock = null;
    if (!silent) this._status('disconnected');
  }
  async _connect() {
    if (!this.wanted) return;
    this._status('connecting');
    let auth = null;
    try { auth = this.getToken ? await this.getToken() : null; } catch (e) { auth = null; }
    this.anonymous = !auth;
    this.login = auth ? auth.login : 'justinfan' + (10000 + Math.floor(Math.random() * 80000));
    const sock = tls.connect({ host: IRC_HOST, port: IRC_PORT, servername: IRC_HOST });
    this.sock = sock; this.buf = '';
    sock.setEncoding('utf8');
    sock.on('secureConnect', () => {
      this._raw('CAP REQ :twitch.tv/tags twitch.tv/commands');
      this._raw('PASS ' + (auth ? 'oauth:' + auth.token : 'SCHMOOPIIE'));
      this._raw('NICK ' + this.login);
      this._raw('JOIN #' + this.channel);
      this.lastRx = Date.now();
      clearInterval(this.pingTimer);
      this.pingTimer = setInterval(() => {
        if (Date.now() - this.lastRx > 6 * 60000) { try { sock.destroy(); } catch (e) { /* ignoré */ } return; }
        this._raw('PING :tmi.twitch.tv');
      }, 4 * 60000);
    });
    sock.on('data', chunk => {
      this.lastRx = Date.now();
      this.buf += chunk;
      let i;
      while ((i = this.buf.indexOf('\r\n')) >= 0) {
        const line = this.buf.slice(0, i); this.buf = this.buf.slice(i + 2);
        if (line) this._onLine(line);
      }
    });
    sock.on('error', err => this.emit('log', 'Erreur chat : ' + err.message));
    sock.on('close', () => {
      clearInterval(this.pingTimer);
      if (this.sock !== sock) return;
      this.sock = null;
      if (!this.wanted) return;
      const delay = Math.min(60000, 2000 * Math.pow(2, this.retry++));
      this._status('reconnecting', { retryInSec: Math.round(delay / 1000) });
      this.retryTimer = setTimeout(() => this._connect(), delay);
    });
  }
  _raw(line) { if (this.sock && !this.sock.destroyed) this.sock.write(line + '\r\n'); }
  _onLine(line) {
    const m = parseLine(line);
    switch (m.command) {
      case 'PING': this._raw('PONG :' + (m.trailing || 'tmi.twitch.tv')); break;
      case 'RECONNECT': try { this.sock.destroy(); } catch (e) { /* ignoré */ } break;
      case 'NOTICE':
        if (/authentication failed|improperly formatted auth|invalid nick/i.test(m.trailing || '')) {
          this.emit('auth-failed');
          this._status('error', { error: 'Connexion Twitch refusée (jeton expiré ?) — reconnecte le compte du bot.' });
        } else if (m.trailing) this.emit('log', 'Twitch : ' + m.trailing);
        break;
      case 'ROOMSTATE': break;
      case 'JOIN':
        if ((m.prefix || '').split('!')[0] === this.login) { this.retry = 0; this._status('connected'); }
        break;
      case 'PRIVMSG': {
        const user = (m.prefix || '').split('!')[0];
        const badges = m.tags.badges || '';
        this.emit('message', {
          user, displayName: m.tags['display-name'] || user, text: m.trailing || '', id: m.tags.id || null,
          isMod: m.tags.mod === '1' || badges.includes('broadcaster/'), isBroadcaster: badges.includes('broadcaster/')
        });
        break;
      }
      default: break;
    }
  }
  canSpeak() { return !this.anonymous && this.state === 'connected'; }
  // File d'envoi : au plus 1 message / 1,5 s et 18 / 30 s (sous la limite Twitch de 20).
  say(text) {
    if (!this.canSpeak()) return false;
    this.queue.push(String(text).replace(/[\r\n]+/g, ' ').slice(0, 480));
    this._drain();
    return true;
  }
  _drain() {
    if (this.drainTimer || !this.queue.length) return;
    const now = Date.now();
    this.sentTimes = this.sentTimes.filter(t => now - t < 30000);
    const last = this.sentTimes[this.sentTimes.length - 1] || 0;
    let wait = Math.max(0, 1500 - (now - last));
    if (this.sentTimes.length >= 18) wait = Math.max(wait, 30000 - (now - this.sentTimes[0]) + 50);
    this.drainTimer = setTimeout(() => {
      this.drainTimer = null;
      const msg = this.queue.shift();
      if (msg && this.canSpeak()) { this._raw(`PRIVMSG #${this.channel} :${msg}`); this.sentTimes.push(Date.now()); }
      this._drain();
    }, wait);
  }
}

/* ---------------- Bot de vol : commandes + paris ---------------- */
const COMMANDS = ['eta', 'route', 'metar', 'avion', 'alt', 'landing', 'pari', 'top', 'fb'];
const DEFAULT_CONFIG = {
  enabled: false, channel: '', botName: 'FlightBot', prefixMessages: true, clientId: '',
  commands: { eta: true, route: true, metar: true, avion: true, alt: true, landing: true, pari: true, top: true, fb: true },
  cooldownSec: 15,
  bets: { autoOpen: true, autoLock: true, lockAglFt: 1000, announceInChat: true },
  replyOnOverlay: false // true : réponses AUSSI affichées sur l'overlay Alertes quand le bot parle dans le chat
};

function mergeConfig(c) {
  c = c || {};
  return {
    ...DEFAULT_CONFIG, ...c,
    commands: { ...DEFAULT_CONFIG.commands, ...(c.commands || {}) },
    bets: { ...DEFAULT_CONFIG.bets, ...(c.bets || {}) }
  };
}

class FlightBot extends EventEmitter {
  // ctx : { getContext(): {...}, fetchMetar(icao): Promise<string|null>, statsFile }
  constructor(chat, ctx) {
    super();
    this.chat = chat; this.ctx = ctx;
    this.config = mergeConfig(null);
    this.cooldowns = {};
    this.bet = { state: 'closed', guesses: new Map(), openedAt: null, lockedAt: null, result: null, flightKey: null };
    this.stats = this._loadStats();
    this.log = [];
    chat.on('message', m => this._onMessage(m));
  }
  _loadStats() {
    try { const s = JSON.parse(fs.readFileSync(this.ctx.statsFile, 'utf-8')); return { players: s.players || {}, history: s.history || [] }; }
    catch (e) { return { players: {}, history: [] }; }
  }
  _saveStats() { try { fs.writeFileSync(this.ctx.statsFile, JSON.stringify(this.stats, null, 2)); } catch (e) { /* best effort */ } }
  setConfig(c) { this.config = mergeConfig(c); }
  _pushLog(entry) {
    this.log.unshift({ at: new Date().toISOString(), ...entry });
    this.log = this.log.slice(0, 40);
    this.emit('state');
  }

  // Réponse : dans le chat si le bot y est connecté, et/ou sur l'overlay Alertes.
  reply(text, opts) {
    opts = opts || {};
    const name = (this.config.botName || 'FlightBot').trim();
    const chatText = this.config.prefixMessages && name ? `[${name}] ${text}` : text;
    const said = this.chat.say(chatText);
    if (!said || this.config.replyOnOverlay) {
      this.emit('alert', { type: 'chat-answer', title: opts.title || name, text, user: opts.user || null });
    }
    this._pushLog({ kind: 'reply', text, inChat: said });
  }

  _onMessage(m) {
    const text = (m.text || '').trim();
    if (!text.startsWith('!')) return;
    const [rawCmd, ...args] = text.slice(1).split(/\s+/);
    const cmd = (rawCmd || '').toLowerCase()
      .replace(/^(landing|atterro|atterrissage)$/, 'landing')
      .replace(/^(avion|aircraft|plane)$/, 'avion')
      .replace(/^(alt|altitude)$/, 'alt')
      .replace(/^(pari|bet)$/, 'pari')
      .replace(/^(fb|flightbrief|commandes)$/, 'fb')
      .replace(/^(top|classement)$/, 'top');
    if (!COMMANDS.includes(cmd) || !this.config.commands[cmd]) return;
    this._pushLog({ kind: 'cmd', user: m.displayName, text });
    if (cmd === 'pari') return this._onBet(m, args);
    // Anti-spam : délai par commande (les modos et le streamer passent outre).
    const now = Date.now();
    if (!m.isMod && this.cooldowns[cmd] && now - this.cooldowns[cmd] < this.config.cooldownSec * 1000) return;
    this.cooldowns[cmd] = now;
    this._answer(cmd, args, m).catch(e => this._pushLog({ kind: 'error', text: e.message }));
  }

  async _answer(cmd, args, m) {
    const c = this.ctx.getContext();
    const t = c.telemetry || {}, b = c.briefing || {};
    const dep = (t.dep || b.dep || '').toUpperCase(), arr = (t.arr || b.arr || '').toUpperCase();
    const flying = !!c.connected;
    const user = m.displayName;
    switch (cmd) {
      case 'eta': {
        if (!flying || !t.etaIso) return this.reply(arr ? `Pas encore d'ETA calculable vers ${arr} (vol pas commencé ou vitesse trop faible).` : 'Aucun vol en cours.', { user });
        const eta = new Date(t.etaIso);
        const hh = eta.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: c.timeZone || undefined });
        let s = `ETA ${arr || 'arrivée'} : ${hh} (dans ${fmtMin(t.etaMin)})`;
        if (t.remainingNm != null) s += ` · ${Math.round(t.remainingNm)} NM restants`;
        if (t.todMin != null && t.todMin > 0) s += ` · début de descente dans ${fmtMin(t.todMin)}`;
        return this.reply(s, { user });
      }
      case 'route': {
        if (!dep && !arr) return this.reply('Aucun plan de vol chargé pour le moment.', { user });
        const route = (b.route || '').trim();
        return this.reply(`${dep || '????'} → ${arr || '????'}${route ? ' · route : ' + route.slice(0, 300) : ''}${b.callsign ? ' · indicatif ' + b.callsign : ''}`, { user });
      }
      case 'metar': {
        const icao = (args[0] || arr || dep || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
        if (!icao) return this.reply('Précise un aéroport : !metar LFPG', { user });
        const metar = await this.ctx.fetchMetar(icao);
        return this.reply(metar ? `METAR ${metar}` : `Pas de METAR disponible pour ${icao}.`, { user });
      }
      case 'avion': {
        const ac = b.aircraft || c.simAircraft;
        return this.reply(ac ? `Appareil : ${ac}` : 'Appareil pas encore renseigné.', { user });
      }
      case 'alt': {
        if (!flying || t.altFt == null) return this.reply('Pas de vol en cours.', { user });
        const lvl = t.altFt >= 10000 ? `FL${String(Math.round(t.altFt / 100)).padStart(3, '0')} (${t.altFt.toLocaleString('fr-FR')} ft)` : `${Math.round(t.altFt).toLocaleString('fr-FR')} ft`;
        return this.reply(`${lvl}${t.gsKt != null ? ' · ' + t.gsKt + ' kt sol' : ''}${t.phaseLabel ? ' · ' + t.phaseLabel : ''}`, { user });
      }
      case 'landing': {
        const l = c.lastLanding;
        if (!l) return this.reply("Aucun atterrissage enregistré pour l'instant.", { user });
        const bits = [`${fmtFpm(l.fpm)}${l.icao ? ' à ' + l.icao : ''}`];
        if (l.gForce) bits.push(l.gForce.toFixed(2) + ' G');
        if (l.grade) bits.push('note ' + l.grade);
        if (l.bounces) bits.push(l.bounces + ' rebond' + (l.bounces > 1 ? 's' : ''));
        return this.reply(`Dernier atterrissage : ${bits.join(' · ')}`, { user });
      }
      case 'top': {
        const top = this.leaderboard(3);
        if (!top.length) return this.reply("Personne n'a encore gagné de pari d'atterrissage. Tente ta chance avec !pari pendant la descente !", { user });
        return this.reply('🏆 Paris d\'atterrissage : ' + top.map((p, i) => `${i + 1}. ${p.name} (${p.wins})`).join(' · '), { user });
      }
      case 'fb': {
        const on = COMMANDS.filter(k => this.config.commands[k] && k !== 'fb').map(k => '!' + k);
        return this.reply(`Commandes du vol : ${on.join(' ')}`, { user });
      }
      default: return null;
    }
  }

  /* ---------- Paris ---------- */
  betState() {
    const guesses = [...this.bet.guesses.values()].sort((a, b) => a.at - b.at);
    return { state: this.bet.state, openedAt: this.bet.openedAt, lockedAt: this.bet.lockedAt, count: guesses.length, guesses: guesses.slice(-60), result: this.bet.result };
  }
  openBets(reason) {
    if (this.bet.state === 'open') return false;
    this.bet = { state: 'open', guesses: new Map(), openedAt: new Date().toISOString(), lockedAt: null, result: null, flightKey: this.bet.flightKey };
    const msg = `🛬 Les paris d'atterrissage sont ouverts ! Devine le taux de toucher en ft/min : !pari 180`;
    if (this.config.bets.announceInChat) this.chat.say(this.config.prefixMessages ? `[${this.config.botName}] ${msg}` : msg);
    this.emit('alert', { type: 'bet-open', title: 'Paris ouverts', text: 'Devine le taux de toucher : !pari 180' });
    this._pushLog({ kind: 'bet', text: 'Paris ouverts' + (reason ? ` (${reason})` : '') });
    return true;
  }
  lockBets(reason) {
    if (this.bet.state !== 'open') return false;
    this.bet.state = 'locked'; this.bet.lockedAt = new Date().toISOString();
    const n = this.bet.guesses.size;
    const msg = `🔒 Paris fermés — ${n} pronostic${n > 1 ? 's' : ''}. Réponse au toucher des roues !`;
    if (this.config.bets.announceInChat) this.chat.say(this.config.prefixMessages ? `[${this.config.botName}] ${msg}` : msg);
    this.emit('alert', { type: 'bet-locked', title: 'Paris fermés', text: `${n} pronostic${n > 1 ? 's' : ''} — verdict au toucher` });
    this._pushLog({ kind: 'bet', text: 'Paris fermés' + (reason ? ` (${reason})` : '') });
    return true;
  }
  cancelBets() {
    if (this.bet.state === 'closed' || this.bet.state === 'resolved') return false;
    this.bet = { state: 'closed', guesses: new Map(), openedAt: null, lockedAt: null, result: null, flightKey: this.bet.flightKey };
    this._pushLog({ kind: 'bet', text: 'Paris annulés' });
    return true;
  }
  _onBet(m, args) {
    const v = parseInt(String(args[0] || '').replace(/[^\d-]/g, ''), 10);
    if (this.bet.state !== 'open') return; // silencieux : pas de spam hors fenêtre
    if (!Number.isFinite(v) || Math.abs(v) > 3000) return;
    this.bet.guesses.set(m.user, { user: m.user, name: m.displayName, fpm: Math.abs(v), at: Date.now() });
    this.emit('state');
  }
  // Atterrissage mesuré -> verdict.
  resolveBets(landing) {
    if (this.bet.state !== 'open' && this.bet.state !== 'locked') return null;
    const actual = Math.abs(Math.round(landing.fpm));
    const ranked = [...this.bet.guesses.values()]
      .map(g => ({ ...g, diff: Math.abs(g.fpm - actual) }))
      .sort((a, b) => a.diff - b.diff || a.at - b.at);
    const winner = ranked[0] || null;
    const result = { actual, winner: winner ? { name: winner.name, user: winner.user, fpm: winner.fpm, diff: winner.diff } : null, podium: ranked.slice(0, 3).map(g => ({ name: g.name, fpm: g.fpm, diff: g.diff })), count: ranked.length, icao: landing.icao || null, at: new Date().toISOString() };
    this.bet.state = 'resolved'; this.bet.result = result;
    if (winner) {
      ranked.forEach(g => {
        const p = this.stats.players[g.user] || { name: g.name, wins: 0, bets: 0, exact: 0 };
        p.name = g.name; p.bets++;
        if (g.user === winner.user) { p.wins++; if (g.diff === 0) p.exact++; }
        this.stats.players[g.user] = p;
      });
      this.stats.history.unshift(result);
      this.stats.history = this.stats.history.slice(0, 50);
      this._saveStats();
    }
    const msg = winner
      ? `🎯 Toucher à −${actual} ft/min ! Bravo ${winner.name} (${winner.fpm}, à ${winner.diff} près) sur ${ranked.length} pronostic${ranked.length > 1 ? 's' : ''}.`
      : `Toucher à −${actual} ft/min — personne n'avait parié cette fois.`;
    if (this.config.bets.announceInChat) this.chat.say(this.config.prefixMessages ? `[${this.config.botName}] ${msg}` : msg);
    this.emit('alert', { type: 'bet-result', title: winner ? 'Pari gagné !' : 'Atterrissage', text: msg, data: result });
    this._pushLog({ kind: 'bet', text: msg });
    return result;
  }
  leaderboard(n) {
    return Object.entries(this.stats.players).map(([user, p]) => ({ user, ...p }))
      .filter(p => p.wins > 0).sort((a, b) => b.wins - a.wins || a.bets - b.bets).slice(0, n || 10);
  }
  resetLeaderboard() { this.stats = { players: {}, history: [] }; this._saveStats(); this.emit('state'); }

  // Ouverture / fermeture automatiques selon le vol (appelé à chaque télémétrie).
  onFlightTick(phaseDetail, aglFt, vsFpm) {
    const b = this.config.bets;
    if (!this.config.commands.pari) return;
    if (b.autoOpen && this.bet.state === 'closed' && (phaseDetail === 'descent' || phaseDetail === 'approach')) this.openBets('début de la descente');
    if (b.autoLock && this.bet.state === 'open' && aglFt != null && aglFt < (b.lockAglFt || 1000) && (vsFpm || 0) < 0) this.lockBets(`sous ${b.lockAglFt || 1000} ft sol`);
  }
  onFlightStart() {
    // Nouveau vol : paris remis à zéro (on garde le classement).
    this.bet = { state: 'closed', guesses: new Map(), openedAt: null, lockedAt: null, result: null, flightKey: Date.now() };
    this.emit('state');
  }
}

function fmtMin(min) {
  if (min == null || !isFinite(min)) return '—';
  min = Math.max(0, Math.round(min));
  return min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}` : `${min} min`;
}
function fmtFpm(v) { return v == null ? '—' : `−${Math.abs(Math.round(v))} ft/min`; }

module.exports = { TwitchAuth, TwitchChat, FlightBot, DEFAULT_CONFIG, mergeConfig, COMMANDS, parseLine, DEFAULT_CLIENT_ID };
