const { app, BrowserWindow, ipcMain, clipboard, shell, net, safeStorage, desktopCapturer, screen, globalShortcut, dialog, Notification, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { startServer, startLiveOverlayServer, startMobileAppServer, startMobileSetupServer, setLang: setServerLang } = require('./server');
const { LocalTls, startMdnsResponder, localIPv4s, HOSTNAME: MOBILE_HOSTNAME } = require('./mobile-tls');
const { FlightTracker, computeTouchdownZone, windComponents } = require('./tracker');
const { DataStore, writeJsonSafe, readJsonSafe } = require('./backups');
const I18N = require('./renderer/i18n.js');
require('./renderer/i18n/translations.js');
const T = s => I18N.tr(s);
const { fetchAtc } = require('./atc');
const { TwitchAuth, TwitchChat, FlightBot, mergeConfig: mergeTwitchConfig } = require('./twitch');
const { Shots } = require('./shots');
const { Cabin, mergeCfg: mergeCabinCfg } = require('./cabin');
const { exportPublicLogbook } = require('./public-logbook');
const { Prediction, SCOPE: PREDICTION_SCOPE } = require('./predictions');
const { suggest, pickDiverse, bestRunwayFt } = require('./suggest');
const { Tts } = require('./tts');

const OBS_PORT = 4813;
const LIVE_OVERLAY_PORT = 4814; // port distinct -> URL OBS différente de celle du briefing
const MOBILE_PORT = 4815; // compagnon téléphone : page d'installation (HTTP, réseau local, désactivé par défaut)
const MOBILE_HTTPS_PORT = 4816; // compagnon téléphone : l'appli (HTTPS, installable, hors ligne)
let liveState = { theme: null };
let liveOverlayState = { config: null, telemetry: null }; // overlay Twitch personnalisable (page Outil Live)
let mainWindow = null;
let obsServer = null;
let liveOverlayServer = null;
let mobileServer = null; // serveur HTTPS de l'appli
let mobileSetupServer = null; // serveur HTTP de la page d'installation
let mobileMdns = null;
let mobileServerError = null;
let mobileMdnsError = null;
let localTls = null;
let liveOverlayUpdatedAt = 0;
const tracker = new FlightTracker(path.join(__dirname, 'renderer'), app.getPath('userData'));

// Index des aéroports (OACI -> coordonnées), utilisé pour estimer la distance totale
// du trajet (départ -> arrivée saisis dans le briefing) et donc la progression en %
// affichée sur l'overlay live personnalisable.
// Emplacements possibles des fichiers de données (airports.json, runways.json) : l'appli
// les cherche à plusieurs endroits plutôt que d'échouer si l'arborescence locale diffère
// (ex. dossier data/ à la racine du projet dans d'anciennes versions, ou ressources
// externes à côté de l'exécutable installé).
function findDataFile(name, rendererDir) {
  const res = process.resourcesPath || '';
  const candidates = [
    rendererDir && path.join(rendererDir, 'data', name),
    path.join(__dirname, 'renderer', 'data', name),
    path.join(__dirname, 'data', name),
    res && path.join(res, 'data', name),
    res && path.join(res, 'renderer', 'data', name),
    res && path.join(res, 'app.asar.unpacked', 'renderer', 'data', name)
  ].filter(Boolean);
  for (const p of candidates) { try { if (fs.existsSync(p)) return p; } catch (e) { /* suivant */ } }
  return candidates[0];
}

let airportsByIcao = null;
let airportIndexError = null;
// Accepte plusieurs formats d'airports.json (tableau de tableaux [icao, nom, lat, lon, alt],
// tableau d'objets, ou objet indexé par OACI) : un format inattendu ne doit plus vider
// silencieusement tout l'index (globe sans aéroport, distances inconnues...).
function airportFromEntry(entry, key) {
  if (Array.isArray(entry)) {
    const [icao, name, lat, lon, elevFt] = entry;
    return { icao, name, lat: +lat, lon: +lon, elevFt };
  }
  if (entry && typeof entry === 'object') {
    const icao = entry.icao || entry.ident || entry.gps_code || entry.id || key;
    const lat = entry.lat ?? entry.latitude ?? entry.latitude_deg;
    const lon = entry.lon ?? entry.lng ?? entry.longitude ?? entry.longitude_deg;
    return { icao, name: entry.name || '', lat: +lat, lon: +lon, elevFt: entry.elevFt ?? entry.elevation_ft ?? entry.elev ?? null };
  }
  return null;
}
function loadAirportIndex() {
  if (airportsByIcao && airportsByIcao.size) return airportsByIcao;
  const map = new Map();
  try {
    const raw = JSON.parse(fs.readFileSync(findDataFile('airports.json'), 'utf-8'));
    const entries = Array.isArray(raw) ? raw.map(e => [null, e]) : Object.entries(raw || {});
    for (const [key, e] of entries) {
      const a = airportFromEntry(e, key);
      if (a && a.icao && Number.isFinite(a.lat) && Number.isFinite(a.lon)) map.set(String(a.icao).trim().toUpperCase(), a);
    }
    airportIndexError = map.size ? null : 'fichier lu mais aucun aéroport reconnu (format inattendu)';
  } catch (e) {
    airportIndexError = e.message || String(e);
    logFatalError('airports-index', e);
  }
  // Index vide = on retentera au prochain appel au lieu de rester bloqué jusqu'au redémarrage.
  airportsByIcao = map;
  return map;
}
function lookupAirport(icao) {
  if (!icao) return null;
  return loadAirportIndex().get(String(icao).trim().toUpperCase()) || null;
}

/* ---------------- Robustesse au démarrage / à la fermeture ----------------
   Avant : une exception non interceptée (ex. port OBS déjà occupé par une
   précédente instance qui ne s'est pas fermée proprement, ou une autre appli)
   remontait telle quelle et faisait planter le process principal Electron
   avec une boîte de dialogue d'erreur générique et un stack trace technique
   au lancement ou à la fermeture. On journalise maintenant systématiquement
   ces erreurs dans un fichier (consultable depuis Admin) au lieu de crasher
   silencieusement, et on empêche les causes les plus probables (deux
   instances de l'appli en même temps, port déjà utilisé). */
function crashLogPath() {
  try { return path.join(app.getPath('userData'), 'flightbrief-crash.log'); }
  catch (e) { return path.join(__dirname, 'flightbrief-crash.log'); }
}
function logFatalError(context, err) {
  const line = `[${new Date().toISOString()}] ${context} : ${err && err.stack ? err.stack : err}\n`;
  console.error(line);
  try { fs.appendFileSync(crashLogPath(), line); } catch (e) { /* rien de plus à faire */ }
}
process.on('uncaughtException', (err) => logFatalError('uncaughtException', err));
process.on('unhandledRejection', (err) => logFatalError('unhandledRejection', err));

// Empêche deux instances de FlightBrief de tourner en même temps (source la plus
// probable d'un plantage au lancement : la 2e instance ne peut pas se lier au port
// OBS déjà pris par la 1ère). Si une 2e instance est lancée, on redonne le focus
// à la fenêtre existante au lieu de planter.
// Windows : identifiant d'appli identique à "appId" (package.json). Sans lui, Windows rattache
// la fenêtre à electron.exe et affiche l'icône Electron (atome) dans la barre des tâches.
if (process.platform === 'win32') app.setAppUserModelId('com.flightbrief.app');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function dataFilePath() {
  return path.join(app.getPath('userData'), 'flightbrief-data.json');
}

// v1.5 : lecture/écriture via DataStore (écriture atomique + sauvegarde quotidienne, 7 jours
// gardés, restauration automatique si le fichier est illisible) — voir backups.js.
let _store = null;
function store() { if (!_store) _store = new DataStore(app.getPath('userData')); return _store; }
function readDb() {
  try { return store().read(); }
  catch (e) { logFatalError('db-read', e); return null; }
}
function writeDb(data) {
  // Si la lecture avait échoué sans sauvegarde valide, le fichier abîmé a déjà été copié de
  // côté (flightbrief-data.corrompu-….json) : rien n'est perdu même si on réécrit ici.
  store().write(data);
}

// Icône de la fenêtre : .ico sous Windows (toutes les tailles pour la barre des tâches et
// Alt+Tab), sinon .png — en prenant le premier fichier qui existe vraiment, pour ne jamais
// retomber sur l'icône Electron par défaut si l'arborescence locale diffère.
function appIconPath() {
  const names = process.platform === 'win32'
    ? ['icon.ico', 'icons/icon.ico', 'icon.png', 'icons/png/256x256.png']
    : ['icon.png', 'icons/png/512x512.png', 'icon.ico'];
  for (const n of names) {
    const p = path.join(__dirname, 'build', n);
    try { if (fs.existsSync(p)) return p; } catch (e) { /* suivant */ }
  }
  return undefined;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1040,
    minHeight: 720,
    backgroundColor: '#0a0d11',
    icon: appIconPath(),
    frame: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('maximize', () => mainWindow.webContents.send('win:maximized-change', true));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('win:maximized-change', false));
  // Sans ça, mainWindow garde une référence vers une fenêtre déjà détruite après la
  // fermeture — inoffensif la plupart du temps, mais source d'erreurs sourdes si un
  // handler IPC est appelé entre la fermeture et la fin réelle du process (cf. le
  // filet de sécurité process.exit ci-dessous, qui peut laisser une fenêtre de temps
  // avant que le process ne meure si SimConnect traîne à se libérer).
  mainWindow.on('closed', () => { mainWindow = null; });
}

// Démarre le petit serveur HTTP local qui sert la source OBS. Avant : aucune gestion
// de l'événement 'error' du serveur -> si le port était déjà occupé (ex. instance
// précédente pas totalement fermée), Node remontait une exception non interceptée
// qui plantait l'appli entière au lancement. On journalise et on continue sans
// bloquer le reste de l'appli (le briefing/logbook restent utilisables même si la
// source OBS n'a pas pu démarrer).
// Démarre les deux petits serveurs HTTP locaux (briefing + overlay live, ports
// distincts). Avant : aucune gestion de l'événement 'error' du serveur -> si un
// port était déjà occupé (ex. instance précédente pas totalement fermée), Node
// remontait une exception non interceptée qui plantait l'appli entière au
// lancement. On journalise et on continue sans bloquer le reste de l'appli.
function startObsServerSafely() {
  try {
    obsServer = startServer(OBS_PORT, () => liveState);
    obsServer.on('error', (err) => {
      logFatalError('obs-server', err);
      if (mainWindow) {
        mainWindow.webContents.send('obs:serverError',
          err.code === 'EADDRINUSE'
            ? `Le port ${OBS_PORT} est déjà utilisé (une autre instance de FlightBrief tourne peut-être déjà) — la source OBS du briefing est indisponible.`
            : (err.message || 'Erreur inconnue du serveur OBS.'));
      }
    });
  } catch (err) {
    logFatalError('obs-server-start', err);
  }
}
function startLiveOverlayServerSafely() {
  try {
    liveOverlayServer = startLiveOverlayServer(LIVE_OVERLAY_PORT, () => liveOverlayState, alertsSince, {
      getCabin: () => ({ ...cabin.publicState(), style: alertsConfig.style || {} }), postcardDir: postcardDir(),
      deck: { token: deckToken, state: deckState, action: deckAction }
    });
    liveOverlayServer.on('error', (err) => {
      logFatalError('live-overlay-server', err);
      if (mainWindow) {
        mainWindow.webContents.send('liveOverlay:serverError',
          err.code === 'EADDRINUSE'
            ? `Le port ${LIVE_OVERLAY_PORT} est déjà utilisé — l'overlay live est indisponible.`
            : (err.message || "Erreur inconnue du serveur de l'overlay live."));
      }
    });
  } catch (err) {
    logFatalError('live-overlay-server-start', err);
  }
}

/* ---- v1.7 — langue de l'appli (FR / EN / ES) : interface, overlays, mobile et messages du bot ---- */
const prefsFile = () => path.join(app.getPath('userData'), 'prefs.json');
function applyLang(l) { I18N.use(l); setServerLang(I18N.lang); }
ipcMain.on('i18n:getLang', evt => { evt.returnValue = I18N.lang; });
ipcMain.handle('i18n:setLang', (evt, l) => {
  applyLang(I18N.pick(l));
  try { writeJsonSafe(prefsFile(), { ...(readJsonSafe(prefsFile()) || {}), lang: I18N.lang }); } catch (e) { /* best effort */ }
  return I18N.lang;
});

app.whenReady().then(() => {
  if (!gotLock) return;
  applyLang((readJsonSafe(prefsFile()) || {}).lang || I18N.pick(app.getLocale()));
  startObsServerSafely();
  startLiveOverlayServerSafely();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  try { store().flushSync(); } catch (e) { /* ignoré */ }
  tracker.disconnect();
  try { twitchChat.stop(true); } catch (e) { /* ignoré */ }
  stopMobileServer();
  if (obsServer) { try { obsServer.close(); } catch (e) { /* déjà fermé */ } }
  if (liveOverlayServer) { try { liveOverlayServer.close(); } catch (e) { /* déjà fermé */ } }
  if (process.platform !== 'darwin') {
    app.quit();
    // Filet de sécurité : si un vol était en cours de tracking au moment de la fermeture,
    // le handle SimConnect natif (node-simconnect, hors de notre contrôle) peut rester
    // ouvert un instant et empêcher le process de terminer complètement — obligeant
    // jusqu'ici à le tuer depuis le Gestionnaire des tâches avant de pouvoir relancer
    // l'appli (le verrou d'instance unique refusant la nouvelle instance tant que
    // l'ancien process est encore vivant). On force donc la sortie du process 1,5 s après
    // app.quit() si celui-ci n'a pas suffi entre-temps.
    setTimeout(() => { app.exit(0); }, 1500);
  }
});

app.on('before-quit', () => {
  try { store().flushSync(); } catch (e) { /* ignoré */ }
  tracker.disconnect();
  try { twitchChat.stop(true); } catch (e) { /* ignoré */ }
  stopMobileServer();
  if (obsServer) { try { obsServer.close(); } catch (e) { /* déjà fermé */ } }
  if (liveOverlayServer) { try { liveOverlayServer.close(); } catch (e) { /* déjà fermé */ } }
});

/* ---------------- Stockage local ---------------- */
ipcMain.handle('db:load', () => fixTouchdownZones(readDb()));

// Correctif pistes parallèles (v1.3.3) : les vols déjà enregistrés gardaient une zone de
// toucher calculée sur la mauvaise piste (34C au lieu de 34R…). On la recalcule à la lecture
// à partir du point de toucher mémorisé ; le renderer réenregistre le fichier à sa prochaine
// sauvegarde. Idempotent : sans effet quand la piste trouvée est déjà la bonne.
function fixTouchdownZones(db) {
  if (!db || !Array.isArray(db.logbook)) return db;
  for (const f of db.logbook) {
    const td = f && f.trackData && f.trackData.touchdown;
    if (!td || !td.zone || td.lat == null || td.lon == null) continue;
    const arr = String(f.arr || (f.trackData.arrGuess && f.trackData.arrGuess.icao) || '').toUpperCase();
    try {
      const zone = computeTouchdownZone(td, arr, path.join(__dirname, 'renderer'));
      // v1.5 : on complète aussi les zones d'avant la 1.5 (sans géométrie de piste, utile à
      // l'approche 3D) et le vent traversier quand le vent a été mesuré.
      if (zone && (zone.runway !== td.zone.runway || td.zone.thresholdLat == null)) td.zone = zone;
      if (td.windDir != null && td.crosswindKt == null && td.zone && td.zone.runwayHdg != null) {
        const wc = windComponents(td.windDir, td.windKt, td.zone.runwayHdg);
        if (wc) { td.headwindKt = wc.headwindKt; td.crosswindKt = wc.crosswindKt; }
      }
    } catch (e) { /* on garde l'ancienne zone */ }
  }
  return db;
}
ipcMain.handle('db:save', (evt, data) => { writeDb(data); return true; });

/* ---------------- v1.5 — sauvegardes ---------------- */
ipcMain.handle('backups:list', () => store().list().map(b => store().summary(b)));
ipcMain.handle('backups:now', () => { const p = store().dailyBackup(true); return { ok: !!p }; });
ipcMain.handle('backups:restore', (evt, name) => {
  try { store().restore(name); return { ok: true }; }
  catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('backups:openFolder', () => { fs.mkdirSync(store().backupDir, { recursive: true }); shell.openPath(store().backupDir); return true; });
ipcMain.handle('backups:recoveryInfo', () => store().lastRecovery);
ipcMain.handle('app:reload', () => { if (mainWindow) mainWindow.reload(); return true; });
ipcMain.handle('obs:getPort', () => OBS_PORT);
ipcMain.handle('obs:getLiveOverlayPort', () => LIVE_OVERLAY_PORT);
ipcMain.handle('clipboard:write', (evt, text) => { clipboard.writeText(text); return true; });
ipcMain.handle('shell:openExternal', (evt, url) => {
  const u = String(url || '');
  // Liens web, ou fichiers de l'appli (cartes postales) : rien d'autre ne s'ouvre d'ici.
  const ok = /^https?:\/\//i.test(u) || (/^file:/i.test(u) && (() => { try { return require('url').fileURLToPath(u).startsWith(app.getPath('userData')); } catch (e) { return false; } })());
  if (ok) shell.openExternal(u);
  return ok;
});
ipcMain.handle('app:getDataPath', () => dataFilePath());

/* ---------------- Vérification des mises à jour ----------------
   Interroge l'API GitHub (dernière release publiée du dépôt) et compare le tag à la
   version installée. Aucune donnée n'est envoyée : simple GET public, sans jeton.
   Le téléchargement se fait depuis la landing page, jamais automatiquement. */
const UPDATE_REPO = 'LLCenLive/FlightBrief';
const UPDATE_LANDING_URL = 'https://llcenlive.github.io/FlightBrief/';
function parseSemver(v) {
  const m = String(v || '').trim().replace(/^v/i, '').match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  return m ? [+m[1], +(m[2] || 0), +(m[3] || 0)] : null;
}
function isNewerVersion(remote, local) {
  const a = parseSemver(remote), b = parseSemver(local);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) { if (a[i] !== b[i]) return a[i] > b[i]; }
  return false;
}
async function checkForUpdate() {
  const current = app.getVersion();
  try {
    const res = await net.fetch(`https://api.github.com/repos/${UPDATE_REPO}/releases/latest`, {
      headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': `FlightBrief/${current}` }
    });
    if (!res.ok) return { ok: false, current, error: 'HTTP ' + res.status };
    const rel = await res.json();
    const latest = String(rel.tag_name || rel.name || '').replace(/^v/i, '');
    return {
      ok: true, current, latest,
      available: !rel.draft && !rel.prerelease && isNewerVersion(latest, current),
      name: rel.name || ('v' + latest),
      notes: typeof rel.body === 'string' ? rel.body.slice(0, 4000) : '',
      publishedAt: rel.published_at || null,
      url: UPDATE_LANDING_URL
    };
  } catch (e) {
    return { ok: false, current, error: e && e.message ? e.message : String(e) };
  }
}
ipcMain.handle('app:getVersion', () => app.getVersion());
// Notes de la release GitHub d'une version donnée (repli du changelog intégré à l'appli).
ipcMain.handle('app:releaseNotes', async (evt, version) => {
  const v = String(version || '').replace(/^v/i, '');
  if (!/^\d+\.\d+\.\d+$/.test(v)) return null;
  for (const tag of ['v' + v, v]) {
    try {
      const res = await net.fetch(`https://api.github.com/repos/${UPDATE_REPO}/releases/tags/${tag}`, {
        headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': `FlightBrief/${app.getVersion()}` }
      });
      if (!res.ok) continue;
      const rel = await res.json();
      return { version: v, name: rel.name || tag, notes: typeof rel.body === 'string' ? rel.body.slice(0, 6000) : '', publishedAt: rel.published_at || null };
    } catch (e) { /* hors ligne : pas de notes */ }
  }
  return null;
});
ipcMain.handle('app:checkUpdate', () => checkForUpdate());
ipcMain.on('live:update', (evt, data) => { liveState = data; });
// Overlay Twitch personnalisable (Outil Live) : le renderer pousse à la fois la
// config (champs affichés + style, choisis par le user) et la télémétrie live ;
// l'overlay servi par le serveur local (route /live) affiche le tout en direct.
ipcMain.on('live:updateOverlay', (evt, data) => {
  liveOverlayState = { ...liveOverlayState, ...data };
  if (data && data.telemetry) liveOverlayUpdatedAt = Date.now();
});
ipcMain.handle('airport:lookup', (evt, icao) => lookupAirport(icao));
ipcMain.handle('airport:indexInfo', () => { const m = loadAirportIndex(); return { count: m.size, error: airportIndexError }; });

/* ---------------- Compagnon mobile (PWA sur le réseau local) ----------------
   Le téléphone ouvre http://<IP du PC>:4815/?t=<jeton>. Le jeton (aléatoire, stocké à
   côté des données) empêche un autre appareil du même réseau de lire le logbook sans
   avoir scanné le QR code. Régénérer le jeton invalide les anciens liens installés. */
function mobileTokenPath() { return path.join(app.getPath('userData'), 'mobile-token.txt'); }
let _mobileToken = null;
function getMobileToken() {
  if (_mobileToken) return _mobileToken;
  try { _mobileToken = fs.readFileSync(mobileTokenPath(), 'utf-8').trim(); } catch (e) { _mobileToken = null; }
  if (!_mobileToken || _mobileToken.length < 8) regenMobileToken();
  return _mobileToken;
}
function regenMobileToken() {
  _mobileToken = crypto.randomBytes(9).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  try { fs.mkdirSync(path.dirname(mobileTokenPath()), { recursive: true }); fs.writeFileSync(mobileTokenPath(), _mobileToken, 'utf-8'); } catch (e) { logFatalError('mobile-token', e); }
  return _mobileToken;
}

// Adresses IPv4 locales de ce PC (Wi-Fi / Ethernet), les réseaux privés en premier.
function lanAddresses() {
  const out = [];
  const ifaces = os.networkInterfaces();
  Object.keys(ifaces).forEach(name => (ifaces[name] || []).forEach(i => {
    const fam = typeof i.family === 'string' ? i.family : (i.family === 4 ? 'IPv4' : 'IPv6');
    if (fam !== 'IPv4' || i.internal) return;
    if (/^169\.254\./.test(i.address)) return; // auto-IP sans réseau
    const priv = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(i.address);
    const virtual = /vethernet|virtualbox|vmware|wsl|hyper-v|docker|loopback|tailscale|zerotier/i.test(name);
    out.push({ name, address: i.address, score: (priv ? 2 : 0) + (virtual ? -3 : 0) });
  }));
  return out.sort((a, b) => b.score - a.score);
}

// Données envoyées au téléphone : le logbook, les carrières/tours, le hangar et le profil,
// avec les trajets GPS allégés (≤ 150 points par vol) pour rester léger sur mobile.
let _mobileDbCache = { mtimeMs: -1, payloadBase: null };
function downsamplePath(pathPts, max) {
  if (!Array.isArray(pathPts) || pathPts.length < 2) return [];
  const step = Math.max(1, Math.ceil(pathPts.length / max));
  const out = [];
  for (let i = 0; i < pathPts.length; i += step) out.push([+pathPts[i].lat.toFixed(4), +pathPts[i].lon.toFixed(4)]);
  const last = pathPts[pathPts.length - 1];
  out.push([+last.lat.toFixed(4), +last.lon.toFixed(4)]);
  return out;
}
function buildMobilePayloadBase() {
  let mtimeMs = 0;
  try { mtimeMs = fs.statSync(dataFilePath()).mtimeMs; } catch (e) { mtimeMs = 0; }
  if (_mobileDbCache.payloadBase && _mobileDbCache.mtimeMs === mtimeMs) return _mobileDbCache.payloadBase;
  const db = readDb() || {};
  const logbook = (db.logbook || []).map(f => {
    const out = { ...f };
    if (f.trackData) {
      const td = f.trackData;
      out.trackData = {
        distanceNm: td.distanceNm, maxAltFt: td.maxAltFt, maxIasKt: td.maxIasKt,
        landingRateFpm: td.landingRateFpm != null ? td.landingRateFpm : td.landingRate,
        fuelUsedLbs: td.fuelUsedLbs, bounceCount: td.bounceCount, turnStats: td.turnStats,
        simAircraft: td.simAircraft || null,
        touchdown: td.touchdown ? { lat: td.touchdown.lat, lon: td.touchdown.lon, vsFpm: td.touchdown.vsFpm, zone: td.touchdown.zone || null } : null,
        phases: Array.isArray(td.phases) ? td.phases.map(p => ({ phase: p.phase, durationSec: p.durationSec, distanceNm: p.distanceNm, minAltFt: p.minAltFt, maxAltFt: p.maxAltFt, avgIasKt: p.avgIasKt, maxIasKt: p.maxIasKt })) : [],
        path: downsamplePath(td.path, 150),
        screenshots: Array.isArray(td.screenshots) ? td.screenshots : [] // v1.8 : photos du vol sur le téléphone
      };
    }
    return out;
  });
  const icaos = new Set();
  logbook.forEach(f => { if (f.dep) icaos.add(String(f.dep).toUpperCase()); if (f.arr) icaos.add(String(f.arr).toUpperCase()); });
  (db.careers || []).forEach(c => (c.tours || []).forEach(t => (t.legs || []).forEach(l => { if (l.dep) icaos.add(l.dep); if (l.arr) icaos.add(l.arr); })));
  const airports = {};
  icaos.forEach(icao => { const a = lookupAirport(icao); if (a) airports[icao] = [a.lat, a.lon, a.name]; });
  const p = db.userProfile || {};
  const base = {
    appVersion: app.getVersion(),
    profile: { firstName: p.firstName || '', network: p.network || '', homeBase: p.homeBase || '', twitchHandle: p.twitchHandle || '', landingThresholds: p.landingThresholds || null, planeIcon: db.planeIcon || 'airliner', streamer: p.twitchFeatures !== false },
    logbook, careers: db.careers || [], hangar: db.hangar || [], airports,
    dataUpdatedAt: mtimeMs ? new Date(mtimeMs).toISOString() : null
  };
  _mobileDbCache = { mtimeMs, payloadBase: base };
  return base;
}
function buildMobilePayload() {
  const t = liveOverlayState.telemetry || null;
  const fresh = t && t.altFt != null && (Date.now() - liveOverlayUpdatedAt) < 20000;
  return { ...buildMobilePayloadBase(), generatedAt: new Date().toISOString(), live: fresh ? t : null };
}

/* ---- v1.8 — Téléphone : onglet Stream (bot, paris, passagers, télécommande) et photos ---- */
function buildMobileStream() {
  const bet = flightBot.betState();
  const cs = cabin.publicState ? cabin.publicState() : {};
  const st = twitchStatus || {};
  return {
    at: new Date().toISOString(),
    enabled: !!twitchConfig.enabled,
    bot: { name: (twitchConfig.botName || 'FlightBot').trim(), state: st.state || 'disconnected', channel: st.channel || twitchConfig.channel || '', anonymous: !!st.anonymous, canSpeak: twitchChat.canSpeak() },
    bet: { state: bet.state, count: bet.count, openedAt: bet.openedAt, lockedAt: bet.lockedAt,
      guesses: bet.guesses.slice(-12).reverse().map(g => ({ name: g.name, fpm: g.fpm })),
      result: bet.result ? { actual: bet.result.actual, icao: bet.result.icao, winner: bet.result.winner ? { name: bet.result.winner.name, fpm: bet.result.winner.fpm, diff: bet.result.winner.diff } : null, podium: bet.result.podium || [] } : null },
    leaderboard: flightBot.leaderboard(5).map(p => ({ name: p.name || p.user, wins: p.wins || 0, bets: p.bets || 0 })),
    log: flightBot.log.slice(0, 20).map(e => ({ at: e.at, kind: e.kind, user: e.user || null, text: String(e.text || '').slice(0, 280) })),
    cabin: cs.enabled ? { flight: cs.flight ? { dep: cs.flight.dep, arr: cs.flight.arr, boarding: cs.flight.boarding, landed: cs.flight.landed } : null,
      passengers: (cs.passengers || []).slice(0, 60).map(p => ({ name: p.name, miles: p.miles, tier: p.tier, tierIcon: p.tierIcon, present: p.present })), nextFlyover: cs.nextFlyover || null } : null,
    remote: deckState()
  };
}
const MOBILE_REMOTE_ACTIONS = new Set(['tracker', 'shot', 'copilot', 'boarding', 'bets', 'alerts-mute', 'copilot-brief']);
function mobileRemoteAction(a) {
  if (!MOBILE_REMOTE_ACTIONS.has(a)) return { ok: false, error: 'action' };
  return deckAction(a);
}
function mobileListShots() {
  return getShots().list().map(s => ({ name: s.name, ts: s.ts }));
}
// Miniatures redimensionnées une fois puis gardées en mémoire (le téléphone en affiche beaucoup).
const _thumbCache = new Map();
function mobileShot(name, w) {
  const file = path.join(getShots().dir, name);
  if (!fs.existsSync(file)) return null;
  const width = w ? Math.max(160, Math.min(1600, Math.round(w))) : 0;
  if (!width) return { type: /\.png$/i.test(name) ? 'image/png' : /\.webp$/i.test(name) ? 'image/webp' : 'image/jpeg', buf: fs.readFileSync(file) };
  const key = name + '@' + width;
  if (_thumbCache.has(key)) return _thumbCache.get(key);
  const img = nativeImage.createFromPath(file);
  if (img.isEmpty()) return null;
  const out = { type: 'image/jpeg', buf: img.resize({ width, quality: 'good' }).toJPEG(78) };
  _thumbCache.set(key, out);
  if (_thumbCache.size > 300) _thumbCache.delete(_thumbCache.keys().next().value);
  return out;
}

function getLocalTls() {
  if (!localTls) localTls = new LocalTls(path.join(app.getPath('userData'), 'mobile-tls'));
  return localTls;
}
// Certificat serveur à jour (IP du PC changée -> ré-émission + rechargement à chaud).
function refreshMobileCert() {
  const tls = getLocalTls().ensureServerCert();
  if (tls.changed && mobileServer && mobileServer.setSecureContext) {
    try { mobileServer.setSecureContext({ key: tls.key, cert: tls.cert }); } catch (e) { logFatalError('mobile-tls-reload', e); }
  }
  return tls;
}

function mobileStatus() {
  const token = getMobileToken();
  const addrs = lanAddresses();
  let caName = null, caFingerprint = null;
  try { caName = getLocalTls().caName(); caFingerprint = getLocalTls().caFingerprint(); } catch (e) { /* CA pas encore créée */ }
  return {
    running: !!mobileServer && !!mobileSetupServer && !mobileServerError,
    port: MOBILE_PORT, httpsPort: MOBILE_HTTPS_PORT, hostname: MOBILE_HOSTNAME, token,
    error: mobileServerError, mdnsError: mobileMdnsError, caName, caFingerprint,
    appUrl: `https://${MOBILE_HOSTNAME}:${MOBILE_HTTPS_PORT}/?t=${encodeURIComponent(token)}`,
    // Le QR code pointe vers la page d'installation (HTTP) : c'est elle qui guide l'installation
    // du certificat puis ouvre l'appli en HTTPS.
    urls: addrs.map(a => ({ iface: a.name, url: `http://${a.address}:${MOBILE_PORT}/setup?t=${encodeURIComponent(token)}` }))
  };
}

function onMobileServerError(which, port) {
  return (err) => {
    logFatalError('mobile-server-' + which, err);
    mobileServerError = err.code === 'EADDRINUSE'
      ? `Le port ${port} est déjà utilisé — le compagnon mobile est indisponible.`
      : (err.message || 'Erreur inconnue du serveur mobile.');
    stopMobileServer();
    if (mainWindow) mainWindow.webContents.send('mobile:status', mobileStatus());
  };
}

function startMobileServerSafely() {
  if (mobileServer && mobileSetupServer) { refreshMobileCert(); return mobileStatus(); }
  mobileServerError = null;
  try {
    refreshMobileCert();
    mobileServer = startMobileAppServer(MOBILE_HTTPS_PORT, {
      appVersion: app.getVersion(),
      getToken: getMobileToken, getPayload: buildMobilePayload, getLive: buildLivePayload, getAtc: buildAtcForEfb, getOfp: efbOfp,
      getStream: buildMobileStream, remoteAction: mobileRemoteAction, listShots: mobileListShots, getShot: mobileShot,
      getTls: () => refreshMobileCert()
    });
    mobileServer.on('error', onMobileServerError('https', MOBILE_HTTPS_PORT));
    mobileSetupServer = startMobileSetupServer(MOBILE_PORT, {
      getToken: getMobileToken,
      getCaDer: () => getLocalTls().caDer(),
      getSetupInfo: () => {
        refreshMobileCert();
        const st = mobileStatus();
        return { hostname: MOBILE_HOSTNAME, httpsPort: MOBILE_HTTPS_PORT, ips: localIPv4s().map(i => i.address), caName: st.caName, caFingerprint: st.caFingerprint, appVersion: app.getVersion() };
      }
    });
    mobileSetupServer.on('error', onMobileServerError('http', MOBILE_PORT));
  } catch (err) {
    logFatalError('mobile-server-start', err);
    mobileServerError = err.message || String(err);
    stopMobileServer();
  }
  // Annonce de flightbrief.local sur le réseau (Bonjour/mDNS). En cas d'échec, l'appli
  // reste joignable par l'adresse IP du PC (voir la page d'installation).
  if (!mobileMdns) {
    mobileMdnsError = null;
    mobileMdns = startMdnsResponder(err => {
      logFatalError('mobile-mdns', err);
      mobileMdnsError = `Annonce de ${MOBILE_HOSTNAME} impossible (${err.code || err.message}) — utilise l'adresse IP du PC.`;
    });
  }
  return mobileStatus();
}
function stopMobileServer() {
  [mobileServer, mobileSetupServer].forEach(s => { if (s) { try { s.close(); } catch (e) { /* déjà fermé */ } } });
  mobileServer = null;
  mobileSetupServer = null;
  if (mobileMdns) { try { mobileMdns.destroy(); } catch (e) { /* déjà fermé */ } }
  mobileMdns = null;
}
ipcMain.handle('mobile:setEnabled', (evt, enabled) => {
  if (enabled) return startMobileServerSafely();
  stopMobileServer();
  mobileServerError = null;
  return mobileStatus();
});
ipcMain.handle('mobile:getStatus', () => mobileStatus());
ipcMain.handle('mobile:regenToken', () => { regenMobileToken(); return mobileStatus(); });

/* ---------------- Barre de titre custom ---------------- */
ipcMain.handle('win:minimize', () => mainWindow && mainWindow.minimize());
ipcMain.handle('win:maximizeToggle', () => {
  if (!mainWindow) return false;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
  return mainWindow.isMaximized();
});
ipcMain.handle('win:close', () => mainWindow && mainWindow.close());
ipcMain.handle('win:isMaximized', () => mainWindow ? mainWindow.isMaximized() : false);
ipcMain.handle('win:platform', () => process.platform);

/* ---------------- Suivi de vol (SimConnect) ---------------- */
ipcMain.handle('tracker:connect', async () => {
  try {
    const res = await tracker.connect();
    return res;
  } catch (e) {
    return { ok: false, error: e.message };
  }
});
ipcMain.handle('tracker:disconnect', () => { tracker.disconnect(); return true; });
ipcMain.handle('tracker:isConnected', () => tracker.isConnected());
ipcMain.handle('tracker:stopTracking', () => tracker.stopTracking());
// Récupération après crash/fermeture inattendue : voir tracker.js _writeSnapshot/loadPendingSnapshot.
ipcMain.handle('tracker:loadPendingFlight', () => tracker.loadPendingSnapshot());
ipcMain.handle('tracker:clearPendingFlight', () => { tracker.clearPendingSnapshot(); return true; });

/* ---------------- Vol en direct pour le téléphone (/api/live) ----------------
   Le process principal reçoit directement les événements du tracker : il garde ici un
   état compact du vol en cours (position, télémétrie, trajet allégé, phases) que l'appli
   téléphone interroge toutes les 2 s sur l'onglet « Vol en direct ». */
let liveTrack = { connected: false, tracking: false, sim: null, startedAt: null, aircraft: null, pos: null, path: [], phases: [], distanceNm: 0, durationMin: 0, landed: null, ended: null, updatedAt: 0 };
function liveTrackPath(pathPts) {
  if (!Array.isArray(pathPts) || !pathPts.length) return [];
  const max = 400, step = Math.max(1, Math.ceil(pathPts.length / max)), out = [];
  for (let i = 0; i < pathPts.length; i += step) out.push([+pathPts[i].lat.toFixed(4), +pathPts[i].lon.toFixed(4)]);
  const last = pathPts[pathPts.length - 1];
  out.push([+last.lat.toFixed(4), +last.lon.toFixed(4)]);
  return out;
}
tracker.on('status', d => {
  liveTrack.connected = !!(d && d.connected);
  if (d && d.sim) liveTrack.sim = d.sim;
  if (!liveTrack.connected) { liveTrack.tracking = false; liveTrack.pos = null; }
  liveTrack.updatedAt = Date.now();
});
tracker.on('flight-start', d => {
  liveTrack = { ...liveTrack, connected: true, tracking: true, startedAt: new Date(d.startedAt).toISOString(), aircraft: d.aircraft || null, path: [], phases: [], distanceNm: 0, durationMin: 0, landed: null, ended: null, updatedAt: Date.now() };
});
tracker.on('telemetry', d => {
  if (d.lat == null || d.lon == null) return;
  liveTrack.pos = { lat: d.lat, lon: d.lon, altFt: d.altFt, iasKt: d.iasKt, gsKt: d.gsKt, vsFpm: d.vsFpm, headingDeg: d.headingDeg, comFreqMhz: d.comFreqMhz, onGround: !!d.onGround, phase: d.phase };
  liveTrack.connected = true;
  liveTrack.updatedAt = Date.now();
});
tracker.on('flight-progress', d => {
  liveTrack.path = liveTrackPath(d.path);
  liveTrack.phases = (d.phases || []).map(p => ({ phase: p.phase, durationSec: p.durationSec }));
  liveTrack.distanceNm = d.distanceNm || 0;
  liveTrack.durationMin = d.durationMin || 0;
  liveTrack.maxAltFt = d.maxAltFt;
  liveTrack.depGuess = d.depGuess ? { icao: d.depGuess.icao, name: d.depGuess.name } : null;
});
tracker.on('flight-landed', d => { liveTrack.landed = { landingRateFpm: d.landingRate, bounceCount: d.bounceCount }; });
tracker.on('flight-end', d => {
  liveTrack.tracking = false;
  liveTrack.ended = { at: new Date().toISOString(), durationMin: d.durationMin, distanceNm: d.distanceNm, landingRateFpm: d.landingRateFpm, bounceCount: d.bounceCount, maxAltFt: d.maxAltFt, dep: d.depGuess && d.depGuess.icao, arr: d.arrGuess && d.arrGuess.icao };
  liveTrack.path = liveTrackPath(d.path);
});
function buildLivePayload() {
  const t = liveOverlayState.telemetry || {};
  const dep = (t.dep || (liveTrack.depGuess && liveTrack.depGuess.icao) || '').toUpperCase() || null;
  const arr = (t.arr || '').toUpperCase() || null;
  const pos = liveTrack.pos;
  const posAgeSec = liveTrack.updatedAt ? Math.round((Date.now() - liveTrack.updatedAt) / 1000) : null;
  const ap = icao => { const a = icao && lookupAirport(icao); return a ? { icao: a.icao, name: a.name, lat: a.lat, lon: a.lon } : null; };
  return {
    serverTime: new Date().toISOString(),
    connected: liveTrack.connected, tracking: liveTrack.tracking, sim: liveTrack.sim,
    startedAt: liveTrack.startedAt, aircraft: liveTrack.aircraft,
    callsign: t.callsign || null, dep: ap(dep) || (dep ? { icao: dep } : null), arr: ap(arr) || (arr ? { icao: arr } : null),
    pos, posAgeSec,
    phase: (liveTrack.phases.length ? liveTrack.phases[liveTrack.phases.length - 1].phase : null) || (pos && pos.phase) || null,
    phases: liveTrack.phases, path: liveTrack.path,
    distanceNm: liveTrack.distanceNm, durationMin: liveTrack.durationMin, maxAltFt: liveTrack.maxAltFt || null,
    progressPct: t.progressPct != null ? t.progressPct : null,
    landed: liveTrack.landed,
    // Résumé du dernier vol terminé, gardé 45 min pour l'afficher sur le téléphone.
    ended: liveTrack.ended && (Date.now() - new Date(liveTrack.ended.at)) < 45 * 60000 ? liveTrack.ended : null
  };
}

// Dernière télémétrie reçue (état affiché sur le Stream Deck).
let lastTelemetry = null;
tracker.on('telemetry', d => { lastTelemetry = d; });
tracker.on('status', d => { if (!(d && d.connected)) lastTelemetry = null; });

tracker.on('status', data => mainWindow && mainWindow.webContents.send('tracker:status', data));
tracker.on('telemetry', data => mainWindow && mainWindow.webContents.send('tracker:telemetry', data));
tracker.on('fast-agl', data => mainWindow && mainWindow.webContents.send('tracker:fastAgl', data));
tracker.on('flight-start', data => mainWindow && mainWindow.webContents.send('tracker:flight-start', data));
tracker.on('flight-landed', data => mainWindow && mainWindow.webContents.send('tracker:flight-landed', data));
tracker.on('flight-end', data => mainWindow && mainWindow.webContents.send('tracker:flight-end', data));
tracker.on('flight-rejected', data => mainWindow && mainWindow.webContents.send('tracker:flight-rejected', data));
// Phases + rapport détaillé mis à jour en direct au fil du vol (voir tracker.js) —
// affichés désormais directement dans la page Briefing, plus seulement à la fin
// dans la vue synthétique de l'onglet Carte du Logbook.
tracker.on('flight-progress', data => mainWindow && mainWindow.webContents.send('tracker:progress', data));
tracker.on('error', err => logFatalError('tracker', err));


/* =========================================================
   v1.5 — Mise à jour en un clic (electron-updater, Releases GitHub)
   ---------------------------------------------------------
   La détection reste celle d'avant (API GitHub, voir checkForUpdate). Quand l'utilisateur
   clique « Mettre à jour maintenant », electron-updater lit latest.yml dans la Release,
   télécharge l'installeur, puis relance l'appli à jour. L'installeur n'étant pas signé,
   aucune vérification de signature n'est configurée (publisherName absent).
   Si la Release ne contient pas latest.yml, on retombe sur la page de téléchargement.
   ========================================================= */
let _autoUpdater = null;
function getAutoUpdater() {
  if (_autoUpdater) return _autoUpdater;
  const { autoUpdater } = require('electron-updater');
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.setFeedURL({ provider: 'github', owner: 'LLCenLive', repo: 'FlightBrief' });
  const send = (ch, d) => mainWindow && mainWindow.webContents.send(ch, d);
  autoUpdater.on('download-progress', p => send('update:progress', { percent: Math.round(p.percent || 0), transferred: p.transferred, total: p.total, bytesPerSecond: p.bytesPerSecond }));
  autoUpdater.on('update-downloaded', info => send('update:downloaded', { version: info && info.version }));
  autoUpdater.on('error', err => send('update:error', { error: (err && err.message) || String(err) }));
  _autoUpdater = autoUpdater;
  return autoUpdater;
}
ipcMain.handle('update:download', async () => {
  if (!app.isPackaged) return { ok: false, error: "Mise à jour automatique indisponible en mode développement (npm start).", fallbackUrl: UPDATE_LANDING_URL };
  try {
    const u = getAutoUpdater();
    const r = await u.checkForUpdates();
    if (!r || !r.updateInfo || !isNewerVersion(r.updateInfo.version, app.getVersion())) return { ok: false, error: 'Aucune version plus récente trouvée dans la Release.', fallbackUrl: UPDATE_LANDING_URL };
    u.downloadUpdate().catch(err => mainWindow && mainWindow.webContents.send('update:error', { error: err.message || String(err) }));
    return { ok: true, version: r.updateInfo.version };
  } catch (e) {
    return { ok: false, error: e.message || String(e), fallbackUrl: UPDATE_LANDING_URL };
  }
});
ipcMain.handle('update:install', () => {
  try {
    tracker.disconnect();
    try { twitchChat.stop(true); } catch (e) { /* ignoré */ }
    setImmediate(() => getAutoUpdater().quitAndInstall(true, true));
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
});

/* =========================================================
   v1.5 — Contrôleurs en ligne VATSIM + IVAO (carte et panneau ATC du Briefing)
   ========================================================= */
// v1.7 — EFB : contrôleurs en ligne autour de l'avion (ou du départ), contours allégés pour le téléphone.
async function buildAtcForEfb(q) {
  const nets = { vatsim: q.get('vatsim') !== '0', ivao: q.get('ivao') !== '0' };
  const r = await fetchAtc((url, o) => net.fetch(url, o), { networks: nets, cacheDir: path.join(app.getPath('userData'), 'atc-data'), lookupAirport });
  const t = liveOverlayState.telemetry || {};
  const c = liveTrack.pos || lookupAirport((t.arr || t.dep || '').toUpperCase()) || null;
  const near = (lat, lon) => !c || (Math.abs(lat - c.lat) < 12 && Math.abs(((lon - c.lon + 540) % 360) - 180) < 18);
  const thin = ring => ring.filter((p, i) => i % Math.max(1, Math.ceil(ring.length / 80)) === 0).map(p => [+p[0].toFixed(3), +p[1].toFixed(3)]);
  const stations = [];
  ['vatsim', 'ivao'].forEach(n => (((r[n] && r[n].ok) ? r[n].stations : null) || []).forEach(s => {
    const at = s.ap || (s.pos ? { lat: s.pos[0], lon: s.pos[1] } : null) || (s.poly && s.poly[0] && s.poly[0][0] ? { lat: s.poly[0][0][0], lon: s.poly[0][0][1] } : null);
    if (!at || !near(at.lat, at.lon)) return;
    stations.push({ network: s.network || n, callsign: s.callsign, facility: s.facility, frequency: s.frequency, name: s.name || s.sector || null,
      ap: s.ap ? { icao: s.ap.icao, lat: s.ap.lat, lon: s.ap.lon } : null, pos: s.pos || null, poly: s.poly ? s.poly.map(thin) : null });
  }));
  return { at: new Date().toISOString(), stations };
}
function efbOfp() {
  const o = (readDb() || {}).ofp;
  return o ? { dep: o.dep, arr: o.arr, callsign: o.callsign, aircraft: o.aircraft, route: o.route, airac: o.airac, cruiseAltFt: o.cruiseAltFt, generatedAt: o.generatedAt, navlog: o.navlog || [], planHtml: o.planHtml || '' } : null;
}

/* ---- v1.7 — plugin Stream Deck : code d'appairage, état affiché sur les touches, actions ---- */
let _deckToken = null, deckUi = {};
function deckToken() {
  if (_deckToken) return _deckToken;
  const p = readJsonSafe(prefsFile()) || {};
  if (!p.deckToken) { p.deckToken = crypto.randomBytes(12).toString('hex'); try { writeJsonSafe(prefsFile(), p); } catch (e) { /* best effort */ } }
  return (_deckToken = p.deckToken);
}
function deckState() {
  const t = lastTelemetry || {}, ot = liveOverlayState.telemetry || {};
  return {
    ok: true, lang: I18N.lang, connected: !!liveTrack.connected, flying: t.phase === 'airborne', phase: currentDetailedPhase(),
    altFt: t.altFt != null ? t.altFt : null, gsKt: t.gsKt != null ? t.gsKt : null, vsFpm: t.vsFpm != null ? t.vsFpm : null, hdg: t.headingDeg != null ? t.headingDeg : null,
    etaIso: ot.etaIso || null, todMin: ot.todMin != null ? ot.todMin : null, arr: (ot.arr || '').toUpperCase() || null,
    bets: flightBot.betState().state, boarding: !!(cabin.flight && cabin.flight.boarding), ...deckUi
  };
}
const DECK_ACTIONS = new Set(['tracker', 'shot', 'copilot', 'copilot-vol+', 'copilot-vol-', 'alerts-vol+', 'alerts-vol-', 'alerts-mute', 'boarding', 'bets', 'copilot-brief']);
function deckAction(a) {
  if (!DECK_ACTIONS.has(a)) return { ok: false, error: 'action' };
  if (mainWindow) mainWindow.webContents.send('deck:action', a); // mêmes fonctions que les boutons de l'appli
  return deckState();
}
// v1.9 — copilote vocal sur une sortie audio au choix (casque, VoiceMeeter…) : voir tts.js.
const tts = new Tts();
ipcMain.handle('tts:available', () => tts.available());
ipcMain.handle('tts:speak', (evt, text, opts) => tts.speak(text, opts));
ipcMain.on('tts:warm', () => tts.warm());
app.on('will-quit', () => tts.stop());
ipcMain.on('deck:ui', (evt, s) => { if (s && typeof s === 'object') deckUi = { copilot: !!s.copilot, copilotVol: +s.copilotVol || 0, alertsVol: +s.alertsVol || 0, alertsSound: !!s.alertsSound, stream: !!s.stream }; });
// Installation en un clic : fichier .streamDeckPlugin (zip du dossier du plugin) avec le code
// d'appairage, puis ouverture -> le logiciel Stream Deck propose de l'installer.
ipcMain.handle('deck:install', async () => {
  try {
    const PLUGIN = 'com.flightbrief.deck.sdPlugin', src = path.join(__dirname, 'streamdeck', PLUGIN), files = [];
    const walk = rel => fs.readdirSync(path.join(src, rel), { withFileTypes: true }).forEach(e => {
      const r = rel ? rel + '/' + e.name : e.name;
      if (e.isDirectory()) walk(r); else if (r !== 'config.js') files.push({ name: PLUGIN + '/' + r, data: fs.readFileSync(path.join(src, r)) });
    });
    walk('');
    files.push({ name: PLUGIN + '/config.js', data: Buffer.from(`window.FB_DECK = ${JSON.stringify({ port: LIVE_OVERLAY_PORT, token: deckToken(), lang: I18N.lang })};\n`) });
    const outDir = path.join(app.getPath('userData'), 'streamdeck');
    fs.mkdirSync(outDir, { recursive: true });
    const out = path.join(outDir, 'FlightBrief.streamDeckPlugin');
    fs.writeFileSync(out, require('./zip').zip(files));
    const err = await shell.openPath(out); // ouvert par le logiciel Stream Deck s'il est installé
    if (err) shell.showItemInFolder(out);
    return { ok: true, file: out, opened: !err };
  } catch (e) { return { ok: false, error: e.message || String(e) }; }
});
ipcMain.handle('deck:newToken', () => { _deckToken = null; const p = readJsonSafe(prefsFile()) || {}; delete p.deckToken; try { writeJsonSafe(prefsFile(), p); } catch (e) { /* best effort */ } return deckToken(); });

/* ---- v1.7 — gratte-pays : pays de chaque aéroport (ville la plus proche, hors ligne) ---- */
const cabinGeo = require('./cabin-geo');
let _countryTotals = null;
const countryOfAirport = a => { const c = a && cabinGeo.nearest(a.lat, a.lon, 200); return c ? c.cc : null; };
ipcMain.handle('geo:countries', (evt, icaos) => {
  cabinGeo.load(path.join(__dirname, 'renderer'));
  // Total par pays : aéroports avec une piste revêtue d'au moins 2 500 ft (calculé une fois).
  if (!_countryTotals) {
    _countryTotals = {};
    try { _runwayIndex = _runwayIndex || JSON.parse(fs.readFileSync(findDataFile('runways.json'), 'utf-8')); } catch (e) { _runwayIndex = {}; }
    for (const a of loadAirportIndex().values()) {
      if (bestRunwayFt(_runwayIndex[a.icao], true) < 2500) continue;
      const cc = countryOfAirport(a);
      if (cc) _countryTotals[cc] = (_countryTotals[cc] || 0) + 1;
    }
  }
  const byIcao = {}, names = {};
  (Array.isArray(icaos) ? icaos : []).slice(0, 5000).forEach(ic => {
    const cc = countryOfAirport(lookupAirport(String(ic).toUpperCase()));
    if (cc) { byIcao[ic] = cc; names[cc] = names[cc] || cabinGeo.countryName(cc); }
  });
  return { byIcao, names, totals: _countryTotals };
});

/* ---- v1.7 — events VATSIM (API publique, gardés 15 min) : ICAO -> event ---- */
let _vatsimEvents = null;
async function vatsimEvents() {
  if (_vatsimEvents && Date.now() - _vatsimEvents.at < 15 * 60000) return _vatsimEvents.map;
  try {
    const res = await net.fetch('https://my.vatsim.net/api/v2/events/latest');
    const j = res.ok ? await res.json() : { data: [] }, map = new Map();
    (j.data || []).filter(e => e.type !== 'Controller Examination').forEach(e => (e.airports || []).forEach(a => {
      const ic = String(a.icao || '').toUpperCase();
      if (/^[A-Z]{4}$/.test(ic) && !map.has(ic)) map.set(ic, { name: String(e.name || '').slice(0, 80), start: Date.parse(e.start_time), end: Date.parse(e.end_time), link: /^https:\/\//.test(e.link || '') ? e.link : null });
    }));
    _vatsimEvents = { at: Date.now(), map };
    return map;
  } catch (e) { return _vatsimEvents ? _vatsimEvents.map : new Map(); }
}

/* ---- v1.7 — « Où voler aujourd'hui ? » : destinations selon le temps dispo, l'avion et la météo réelle ---- */
let _runwayIndex = null;
ipcMain.handle('fly:suggest', async (evt, o) => {
  o = o || {};
  const from = lookupAirport(String(o.from || '').toUpperCase());
  if (!from) return { ok: false, error: 'Aéroport de départ inconnu : indique un code OACI (ou ton aéroport de base dans le Profil).' };
  try { _runwayIndex = _runwayIndex || JSON.parse(fs.readFileSync(findDataFile('runways.json'), 'utf-8')); } catch (e) { _runwayIndex = {}; }
  // ATC en ligne (VATSIM + IVAO) et events VATSIM : en parallèle, sans bloquer si un service ne répond pas.
  const timeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(() => r(null), ms))]);
  const [atcData, events] = await Promise.all([
    o.atc === false ? null : timeout(fetchAtc((url, op) => net.fetch(url, op), { networks: { vatsim: true, ivao: true }, cacheDir: path.join(app.getPath('userData'), 'atc-data'), lookupAirport }).catch(() => null), 8000),
    o.events === false ? null : timeout(vatsimEvents(), 8000)
  ]);
  const atc = new Map();
  ['vatsim', 'ivao'].forEach(netw => ((atcData && atcData[netw] && atcData[netw].ok && atcData[netw].stations) || []).forEach(st => {
    if (!st.ap || !['DEL', 'GND', 'TWR', 'APP', 'DEP'].includes(st.facility)) return;
    const e = atc.get(st.ap.icao) || { nets: [], facs: [] };
    if (!e.nets.includes(netw)) e.nets.push(netw);
    if (!e.facs.includes(st.facility)) e.facs.push(st.facility);
    atc.set(st.ap.icao, e);
  }));
  const r = suggest(loadAirportIndex().values(), _runwayIndex, {
    from, minutes: Math.max(20, Math.min(900, +o.minutes || 60)), profile: o.profile, speedKt: +o.speedKt || null,
    visited: new Set((o.visited || []).map(String)), count: 12, mode: ['new', 'fav', 'any'].includes(o.mode) ? o.mode : 'new',
    favCounts: o.favCounts && typeof o.favCounts === 'object' ? o.favCounts : {}, atc, preferAtc: !!o.preferAtc, events: events || new Map()
  });
  // Météo réelle des candidats : on garde de préférence les terrains qui publient un METAR.
  let wx = {};
  try {
    const ids = [from.icao, ...r.list.map(c => c.icao)].join(',');
    const res = await net.fetch(`https://aviationweather.gov/api/data/metar?ids=${encodeURIComponent(ids)}&format=json`);
    (res.ok ? await res.json() : []).forEach(m => { wx[m.icaoId] = { raw: m.rawOb, cat: m.fltCat || null, wdir: m.wdir, wspd: m.wspd, wgst: m.wgst || null }; });
  } catch (e) { wx = {}; }
  const withWx = r.list.filter(c => wx[c.icao] || c.event); // un event passe même sans METAR
  const list = pickDiverse(withWx.length >= 3 ? withWx : r.list, 3).map(c => ({ ...c, wx: wx[c.icao] || null }));
  return { ok: true, from: { icao: from.icao, name: from.name, wx: wx[from.icao] || null }, targetNm: r.targetNm, list, atcCount: atc.size, eventsCount: events ? events.size : null };
});

ipcMain.handle('atc:get', (evt, opts) => fetchAtc((url, o) => net.fetch(url, o), {
  networks: (opts && opts.networks) || { vatsim: true, ivao: false }, force: !!(opts && opts.force),
  cacheDir: path.join(app.getPath('userData'), 'atc-data'), lookupAirport
}));

/* =========================================================
   v1.5 — Alertes à l'écran (source OBS http://localhost:4814/alerts)
   ---------------------------------------------------------
   File d'événements courte (atterrissage, paris, succès, réponses du bot) que la page
   d'alertes interroge chaque seconde. Les événements sont produits ici (bot Twitch) ou
   poussés par l'interface (carte d'atterrissage, succès débloqués).
   ========================================================= */
let alertSeq = 0;
let alertsQueue = [];
let alertsConfig = { durationSec: 9, position: 'top-right', scale: 100, accent: '#39e88f', types: { landing: true, achievement: true, bet: true, chat: true } };
function pushAlert(a) {
  const ev = { id: ++alertSeq, ts: Date.now(), ...a };
  alertsQueue.push(ev);
  alertsQueue = alertsQueue.filter(x => Date.now() - x.ts < 5 * 60000).slice(-40);
  return ev;
}
function alertsSince(sinceId) {
  return { config: alertsConfig, lastId: alertSeq, events: alertsQueue.filter(e => e.id > (sinceId || 0)) };
}
ipcMain.on('alerts:push', (evt, a) => { if (a && a.type) pushAlert(a); });
ipcMain.on('alerts:config', (evt, c) => { alertsConfig = { ...alertsConfig, ...(c || {}), types: { ...alertsConfig.types, ...((c && c.types) || {}) }, style: { ...((c && c.style) || alertsConfig.style || {}) } }; });
ipcMain.handle('alerts:getPort', () => LIVE_OVERLAY_PORT);

/* =========================================================
   v1.5 — Bot Twitch (commandes de vol + paris d'atterrissage)
   ========================================================= */
const twitchCrypt = {
  encrypt: s => (safeStorage && safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(s) : Buffer.from(s, 'utf-8')),
  decrypt: b => (safeStorage && safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(b) : b.toString('utf-8'))
};
let twitchAuth = null;
function getTwitchAuth() {
  if (!twitchAuth) twitchAuth = new TwitchAuth((u, o) => net.fetch(u, o), path.join(app.getPath('userData'), 'twitch-auth.bin'), twitchCrypt);
  return twitchAuth;
}
const twitchChat = new TwitchChat();
twitchChat.translate = T; // messages du bot dans la langue de l'appli
let twitchStatus = { state: 'disconnected' };
let twitchConfig = mergeTwitchConfig(null);
let lastLanding = null; // { fpm, icao, gForce, grade, bounces, at }
const metarCache = new Map();
async function fetchMetar(icao) {
  const c = metarCache.get(icao);
  if (c && Date.now() - c.at < 5 * 60000) return c.text;
  try {
    const res = await net.fetch(`https://aviationweather.gov/api/data/metar?ids=${encodeURIComponent(icao)}&format=raw`);
    const text = res.ok ? (await res.text()).trim().split('\n')[0] : '';
    metarCache.set(icao, { at: Date.now(), text: text || null });
    return text || null;
  } catch (e) { return null; }
}
function lastLandingFromLogbook() {
  const db = readDb();
  const f = (db && db.logbook || []).filter(x => x.trackData && (x.trackData.landingRateFpm != null || x.trackData.landingRate != null))
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0];
  if (!f) return null;
  const td = f.trackData;
  return { fpm: td.landingRateFpm ?? td.landingRate, icao: f.arr || null, gForce: td.touchdown && td.touchdown.gForce, bounces: td.bounceCount || 0, grade: td.landingScore && td.landingScore.letter };
}
const PHASE_LABELS_FR = { taxi_out: 'roulage', liftoff: 'décollage', initial_climb: 'montée initiale', climb: 'montée', cruise: 'croisière', descent: 'descente', approach: 'approche', final_approach: 'approche finale', touchdown: 'toucher', taxi_in: 'roulage' };
function currentDetailedPhase() {
  return (liveTrack.phases.length ? liveTrack.phases[liveTrack.phases.length - 1].phase : null);
}
const flightBot = new FlightBot(twitchChat, {
  statsFile: path.join(app.getPath('userData'), 'twitch-bets.json'),
  fetchMetar,
  getContext: () => {
    const t = { ...(liveOverlayState.telemetry || {}) };
    if (liveTrack.pos) { t.gsKt = liveTrack.pos.gsKt; if (t.altFt == null) t.altFt = liveTrack.pos.altFt; }
    const ph = currentDetailedPhase();
    t.phaseLabel = ph ? PHASE_LABELS_FR[ph] : (liveTrack.pos && liveTrack.pos.onGround ? 'au sol' : null);
    const fresh = liveTrack.connected && liveTrack.pos && (Date.now() - liveTrack.updatedAt) < 20000;
    return {
      connected: !!fresh, telemetry: t,
      briefing: { dep: liveState.dep, arr: liveState.arr, route: liveState.route, aircraft: liveState.aircraft, callsign: liveState.callsign },
      simAircraft: liveTrack.aircraft, lastLanding: lastLanding || lastLandingFromLogbook()
    };
  }
});
function twitchPublicState() {
  return {
    status: twitchStatus, config: twitchConfig, auth: getTwitchAuth().publicInfo(),
    bet: flightBot.betState(), prediction: prediction.publicState(), leaderboard: flightBot.leaderboard(10), log: flightBot.log.slice(0, 25),
    betsResolved: (flightBot.stats.history || []).length
  };
}
const sendTwitchState = (() => {
  let t = null;
  return () => { if (t) return; t = setTimeout(() => { t = null; if (mainWindow) mainWindow.webContents.send('twitch:state', twitchPublicState()); }, 150); };
})();
twitchChat.on('status', st => { twitchStatus = st; sendTwitchState(); });
twitchChat.on('log', msg => { flightBot._pushLog({ kind: 'info', text: msg }); });
twitchChat.on('auth-failed', async () => {
  // Jeton refusé : une tentative de rafraîchissement, sinon on repasse en lecture anonyme.
  const ok = await getTwitchAuth().refresh().catch(() => false);
  if (ok) applyTwitchConnection(); else { getTwitchAuth().logout(); applyTwitchConnection(); }
});
flightBot.on('state', sendTwitchState);
// v1.7 — Prédiction Twitch (points de chaîne) calquée sur les paris d'atterrissage du bot.
const prediction = new Prediction({
  fetch: (u, o) => net.fetch(u, o), getAuth: () => getBroadcasterAuth(), tr: T,
  log: text => { flightBot._pushLog({ kind: 'bet', text }); sendTwitchState(); }
});
flightBot.on('bet', (what, d) => {
  if (what === 'cancel') return prediction.cancel().then(sendTwitchState);
  if (!twitchConfig.bets.prediction) return;
  const p = what === 'open' ? prediction.open() : what === 'lock' ? prediction.lock() : what === 'resolve' ? prediction.resolve(d.fpm) : null;
  if (p) p.then(sendTwitchState);
});
flightBot.on('alert', a => pushAlert(a));
function applyTwitchConnection() {
  flightBot.setConfig(twitchConfig);
  if (!twitchConfig.enabled || !twitchConfig.channel) { twitchChat.stop(); return; }
  twitchChat.start({
    channel: twitchConfig.channel,
    getToken: async () => {
      const a = getTwitchAuth();
      const token = await a.ensureToken().catch(() => null);
      return token && a.data.login ? { login: a.data.login, token } : null;
    }
  });
}
ipcMain.handle('twitch:getState', () => twitchPublicState());
ipcMain.handle('twitch:setConfig', (evt, cfg) => {
  const prev = twitchConfig;
  twitchConfig = mergeTwitchConfig(cfg);
  // Client ID propre à l'utilisateur : changer d'application déconnecte le compte lié à l'ancienne.
  const loggedOut = getTwitchAuth().setClientId(twitchConfig.clientId);
  flightBot.setConfig(twitchConfig);
  if (loggedOut || prev.enabled !== twitchConfig.enabled || prev.channel !== twitchConfig.channel) applyTwitchConnection();
  sendTwitchState();
  return twitchPublicState();
});
let _twitchDevice = null;
ipcMain.handle('twitch:startLogin', async () => {
  try {
    const a = getTwitchAuth();
    _twitchDevice = await a.startDevice(twitchConfig.clientId);
    shell.openExternal(_twitchDevice.verificationUri);
    a.pollDevice(_twitchDevice)
      .then(info => { _twitchDevice = null; if (mainWindow) mainWindow.webContents.send('twitch:loginResult', { ok: true, ...info }); applyTwitchConnection(); sendTwitchState(); })
      .catch(err => { _twitchDevice = null; if (mainWindow) mainWindow.webContents.send('twitch:loginResult', { ok: false, error: err.message }); });
    return { ok: true, userCode: _twitchDevice.userCode, verificationUri: _twitchDevice.verificationUri, expiresIn: _twitchDevice.expiresIn };
  } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('twitch:checkClientId', (evt, id) => getTwitchAuth().checkClientId(id));
ipcMain.handle('twitch:cancelLogin', () => { getTwitchAuth().cancelPoll(); _twitchDevice = null; return true; });
ipcMain.handle('twitch:logout', () => { getTwitchAuth().logout(); applyTwitchConnection(); sendTwitchState(); return twitchPublicState(); });
ipcMain.handle('twitch:bet', (evt, action) => {
  if (action === 'open') flightBot.openBets('manuel');
  else if (action === 'lock') flightBot.lockBets('manuel');
  else if (action === 'cancel') flightBot.cancelBets();
  else if (action === 'reset-leaderboard') flightBot.resetLeaderboard();
  sendTwitchState();
  return flightBot.betState();
});
ipcMain.handle('twitch:test', (evt, kind) => {
  if (kind === 'bet') {
    pushAlert({ type: 'bet-result', title: 'Pari gagné ! (test)', text: '🎯 Toucher à −142 ft/min ! Bravo Viewer42 (150, à 8 près) sur 12 pronostics.', data: { actual: 142, winner: { name: 'Viewer42', fpm: 150, diff: 8 }, podium: [{ name: 'Viewer42', fpm: 150, diff: 8 }, { name: 'PiloteDu59', fpm: 120, diff: 22 }, { name: 'Kéro', fpm: 180, diff: 38 }], count: 12 } });
  } else {
    pushAlert({ type: 'chat-answer', title: twitchConfig.botName || 'FlightBot', text: 'ETA LFBO : 21:47 (dans 38 min) · 212 NM restants · début de descente dans 12 min', user: 'Viewer42' });
  }
  return true;
});
// L'interface transmet la note calculée de l'atterrissage (catégorie du hangar) pour !landing.
ipcMain.on('twitch:landingInfo', (evt, info) => { if (info && info.fpm != null) lastLanding = { ...info, at: Date.now() }; });

tracker.on('flight-start', () => flightBot.onFlightStart());
tracker.on('telemetry', d => {
  if (!twitchConfig.enabled) return;
  if (d.phase === 'airborne') flightBot.onFlightTick(currentDetailedPhase(), d.aglFt, d.vsFpm);
});
tracker.on('flight-landed', d => {
  lastLanding = { fpm: d.landingRate, icao: d.arr && d.arr.icao, gForce: d.gForce, bounces: d.bounceCount || 0, at: Date.now() };
  if (twitchConfig.enabled) flightBot.resolveBets({ fpm: d.landingRate, icao: d.arr && d.arr.icao });
});


/* =========================================================
   v1.7 — « À bord » : passagers du chat, miles, passeport, survols, croisière (cabin.js)
   ========================================================= */
const postcardDir = () => path.join(app.getPath('userData'), 'postcards');
const botPrefix = t => (twitchConfig.prefixMessages && (twitchConfig.botName || '').trim() ? `[${twitchConfig.botName.trim()}] ${t}` : t);
const cabin = new Cabin({
  file: path.join(app.getPath('userData'), 'cabin.json'),
  rendererDir: path.join(__dirname, 'renderer'),
  say: text => { if (twitchConfig.enabled) twitchChat.say(botPrefix(text)); flightBot._pushLog({ kind: 'reply', text, inChat: twitchChat.canSpeak() }); },
  reply: (text, user) => { if (twitchConfig.enabled) flightBot.reply(text, { user }); },
  alert: a => { if (twitchConfig.enabled) pushAlert(a); },
  lookupAirport: icao => lookupAirport(icao),
  getBriefing: () => ({ dep: liveState.dep, arr: liveState.arr, callsign: liveState.callsign, aircraft: liveState.aircraft }),
  getPhase: () => currentDetailedPhase()
});
const cabinOn = () => twitchConfig.enabled && cabin.cfg.enabled;
const sendCabinState = (() => {
  let t = null;
  return () => { if (t) return; t = setTimeout(() => { t = null; if (mainWindow) mainWindow.webContents.send('cabin:state', cabin.publicState()); }, 250); };
})();
cabin.on('state', sendCabinState);
twitchChat.on('message', m => { if (cabinOn()) cabin.onMessage(m); });
let _trackerWasConnected = false;
tracker.on('status', d => {
  const on = !!(d && d.connected);
  if (on && !_trackerWasConnected) {
    if (cabinOn() && !cabin.flight) cabin.openBoarding(false);
    if (cabin.cfg.title.autoPropose && mainWindow) mainWindow.webContents.send('cabin:proposeTitle', buildTitleSuggestion());
  }
  if (!on && _trackerWasConnected && cabin.flight && !cabin.flight.landedAt) cabin.abort();
  if (!on && _trackerWasConnected) flightBot.cancelBets(); // tracker coupé avant le toucher : la prédiction est remboursée
  _trackerWasConnected = on;
});
tracker.on('telemetry', d => { if (cabinOn()) cabin.onTick(d, currentDetailedPhase()); });
tracker.on('flight-landed', d => {
  if (!cabinOn()) return;
  const rec = cabin.onLanded({ icao: d.arr && d.arr.icao });
  if (rec && mainWindow) mainWindow.webContents.send('cabin:landed', { ...rec, landingRate: d.landingRate, startedAt: liveTrack.startedAt });
});
tracker.on('flight-end', () => cabin.onFlightEnd());

ipcMain.handle('cabin:getState', () => cabin.publicState());
ipcMain.handle('cabin:setConfig', (evt, c) => { cabin.setConfig(c); return cabin.publicState(); });
ipcMain.on('cabin:setPlan', (evt, p) => cabin.setPlan(p));
ipcMain.handle('cabin:boarding', (evt, action) => {
  if (action === 'open') cabin.openBoarding(true);
  else if (action === 'close') cabin.closeBoarding();
  else if (action === 'end') cabin.abort();
  return cabin.publicState();
});
ipcMain.handle('cabin:ranking', () => cabin.ranking(500));
ipcMain.handle('cabin:viewer', (evt, user) => cabin.viewerDetail(String(user || '')));
ipcMain.handle('cabin:removeViewer', (evt, user) => { cabin.removeViewer(String(user || '')); return true; });
ipcMain.handle('cabin:forgetCity', (evt, user) => { cabin.forgetCity(String(user || '')); return true; });
ipcMain.handle('cabin:flights', () => cabin.data.flights.slice(0, 100));
ipcMain.handle('cabin:flightInfo', (evt, r) => cabin.flightRecordAround(+(r && r.from) || 0, +(r && r.to) || Date.now()));
// Carte postale dessinée par l'interface (canvas) puis enregistrée ici en JPEG.
ipcMain.handle('cabin:savePostcard', (evt, p) => {
  try {
    const m = String((p && p.dataUrl) || '').match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
    if (!m || m[1].length > 12e6) return { ok: false, error: 'Image invalide.' };
    const key = String(+p.key || Date.now()), name = `carte-${key}.jpg`;
    fs.mkdirSync(postcardDir(), { recursive: true });
    fs.writeFileSync(path.join(postcardDir(), name), Buffer.from(m[1], 'base64'));
    cabin.setPostcard(+key, name);
    pushAlert({ type: 'cabin-postcard', title: 'Carte postale', data: { url: '/postcards/' + name, city: p.city || null } });
    return { ok: true, name, file: require('url').pathToFileURL(path.join(postcardDir(), name)).href };
  } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('cabin:postcardUrl', (evt, name) => /^[A-Za-z0-9_-]{1,64}\.jpg$/.test(name || '') && fs.existsSync(path.join(postcardDir(), name)) ? require('url').pathToFileURL(path.join(postcardDir(), name)).href : null);
ipcMain.handle('cabin:openPostcards', () => { fs.mkdirSync(postcardDir(), { recursive: true }); shell.openPath(postcardDir()); return true; });
ipcMain.handle('shots:dataUrl', (evt, name) => {
  try {
    if (!name || /[\\/]/.test(name)) return null;
    const buf = fs.readFileSync(path.join(getShots().dir, name));
    return 'data:image/' + (/\.png$/i.test(name) ? 'png' : 'jpeg') + ';base64,' + buf.toString('base64');
  } catch (e) { return null; }
});

/* ---- Titre du stream : proposé au lancement du vol, envoyé seulement après validation ---- */
let broadcasterAuth = null;
function getBroadcasterAuth() {
  if (!broadcasterAuth) broadcasterAuth = new TwitchAuth((u, o) => net.fetch(u, o), path.join(app.getPath('userData'), 'twitch-channel.bin'), twitchCrypt, 'channel:manage:broadcast ' + PREDICTION_SCOPE);
  if (twitchConfig.clientId) broadcasterAuth.setClientId(twitchConfig.clientId); // même application Twitch que le bot
  return broadcasterAuth;
}
// Remplit le modèle de titre ; les morceaux dont toutes les variables sont vides disparaissent
// avec leur séparateur (« · » ou « | »), et une flèche sans ville d'un côté est retirée.
function fillTitleTemplate(tpl, vals) {
  const parts = String(tpl).split(/(\s*[·|]\s*)/), out = [];
  for (let i = 0; i < parts.length; i += 2) {
    const seg = parts[i], keys = [...seg.matchAll(/\{(\w+)\}/g)].map(m => m[1]);
    let txt = seg.replace(/\{(\w+)\}/g, (m, k) => vals[k] != null ? vals[k] : m).replace(/^\s*→\s*|\s*→\s*$/g, '').trim();
    const bare = !txt.replace(/[\s\p{Extended_Pictographic}\uFE0F\u200D]/gu, '');
    if (keys.length && keys.every(k => !vals[k]) && i > 0) continue;
    if (!txt) continue;
    out.push({ sep: parts[i - 1], txt, bare });
  }
  return out.map((o, i) => (i ? (out[i - 1].bare ? ' ' : (o.sep || ' · ')) : '') + o.txt).join('').replace(/\s{2,}/g, ' ').trim();
}
function buildTitleSuggestion() {
  const ls = liveState || {};
  const city = (icao, name) => cabin.cityForIcao(icao) || (name || '').replace(/\s*(international\s*)?airport.*$/i, '').trim() || (icao || '').toUpperCase();
  const vals = {
    indicatif: (ls.callsign || '').trim(), dep: (ls.dep || '').toUpperCase(), arr: (ls.arr || '').toUpperCase(),
    depart: ls.dep ? city(ls.dep, ls.depName) : '', arrivee: ls.arr ? city(ls.arr, ls.arrName) : '', avion: (ls.aircraft || '').trim()
  };
  const t = fillTitleTemplate(T(cabin.cfg.title.template || ''), vals); // modèle par défaut traduit, modèle perso inchangé
  return { title: t.slice(0, 140), category: cabin.cfg.title.category || '', channel: twitchConfig.channel || '', auth: getBroadcasterAuth().publicInfo() };
}
ipcMain.handle('cabin:titleSuggest', () => buildTitleSuggestion());
ipcMain.handle('cabin:channelAuthInfo', () => getBroadcasterAuth().publicInfo());
let _chanDevice = null;
ipcMain.handle('cabin:channelLogin', async () => {
  try {
    const a = getBroadcasterAuth();
    _chanDevice = await a.startDevice(twitchConfig.clientId);
    shell.openExternal(_chanDevice.verificationUri);
    a.pollDevice(_chanDevice)
      .then(info => { _chanDevice = null; if (mainWindow) mainWindow.webContents.send('cabin:channelLoginResult', { ok: true, ...info }); })
      .catch(err => { _chanDevice = null; if (mainWindow) mainWindow.webContents.send('cabin:channelLoginResult', { ok: false, error: err.message }); });
    return { ok: true, userCode: _chanDevice.userCode };
  } catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('cabin:channelCancel', () => { getBroadcasterAuth().cancelPoll(); _chanDevice = null; return true; });
ipcMain.handle('cabin:channelLogout', () => { getBroadcasterAuth().logout(); return getBroadcasterAuth().publicInfo(); });
ipcMain.handle('cabin:setTitle', async (evt, p) => {
  const a = getBroadcasterAuth();
  const title = String((p && p.title) || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 140);
  if (!title) return { ok: false, error: 'Le titre est vide.' };
  const token = await a.ensureToken().catch(() => null);
  if (!token || !a.data.userId) return { ok: false, error: 'Connecte d\'abord le compte de ta chaîne (bouton ci-dessous).' };
  const headers = { Authorization: 'Bearer ' + token, 'Client-Id': a.clientId(), 'Content-Type': 'application/json' };
  const body = { title };
  try {
    const cat = String((p && p.category) || '').trim();
    if (cat) {
      const r = await net.fetch('https://api.twitch.tv/helix/games?name=' + encodeURIComponent(cat), { headers });
      const j = await r.json().catch(() => ({}));
      if (j.data && j.data[0]) body.game_id = j.data[0].id;
    }
    const res = await net.fetch('https://api.twitch.tv/helix/channels?broadcaster_id=' + encodeURIComponent(a.data.userId), { method: 'PATCH', headers, body: JSON.stringify(body) });
    if (res.status === 204 || res.ok) return { ok: true, title, category: body.game_id ? (p.category || '') : null };
    const j = await res.json().catch(() => ({}));
    if (res.status === 401) return { ok: false, error: 'Autorisation refusée : reconnecte le compte de ta chaîne.' };
    return { ok: false, error: j.message || ('Twitch a répondu HTTP ' + res.status) };
  } catch (e) { return { ok: false, error: 'Twitch injoignable : ' + (e.message || e) }; }
});

/* ---- Carnet de vol public (site statique, sans serveur ni compte) ---- */
ipcMain.handle('cabin:chooseExportDir', async () => {
  const r = await dialog.showOpenDialog(mainWindow, { title: T('Dossier du carnet de vol public'), properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});
ipcMain.handle('cabin:exportPublic', async (evt, opts) => {
  try {
    const dir = String((opts && opts.dir) || '');
    if (!dir) return { ok: false, error: 'Choisis d\'abord un dossier.' };
    const res = exportPublicLogbook({
      dir, rendererDir: path.join(__dirname, 'renderer'), db: readDb() || {}, cabin: cabin.publicExport(), postcardDir: postcardDir(),
      options: (opts && opts.options) || {}, version: app.getVersion()
    });
    return { ok: true, ...res };
  } catch (e) { return { ok: false, error: e.message || String(e) }; }
});
ipcMain.handle('cabin:openDir', (evt, dir) => { if (dir && fs.existsSync(dir)) shell.openPath(dir); return true; });

/* =========================================================
   v1.6 — Captures d'écran des vols (voir shots.js)
   ========================================================= */
let shots = null;
function getShots() {
  if (!shots) {
    shots = new Shots({ desktopCapturer, screen, globalShortcut }, app.getPath('userData'));
    shots.onTaken = shot => { if (mainWindow) mainWindow.webContents.send('shots:taken', shot); };
  }
  return shots;
}
ipcMain.handle('shots:setConfig', (evt, c) => getShots().setConfig(c));
ipcMain.handle('shots:capture', (evt, reason) => getShots().capture(reason || 'manuel'));
ipcMain.handle('shots:list', (evt, range) => getShots().list(range));
ipcMain.handle('shots:resolve', (evt, names) => getShots().resolve(names));
ipcMain.handle('shots:delete', (evt, name) => getShots().remove(name));
ipcMain.handle('shots:stats', () => getShots().stats());
ipcMain.handle('shots:openFolder', () => { fs.mkdirSync(getShots().dir, { recursive: true }); shell.openPath(getShots().dir); return true; });
ipcMain.handle('shots:openFile', (evt, name) => { if (name && !/[\\/]/.test(name)) shell.openPath(path.join(getShots().dir, name)); return true; });
ipcMain.handle('shots:import', async () => {
  const r = await dialog.showOpenDialog(mainWindow, { title: T('Ajouter des images au vol'), properties: ['openFile', 'multiSelections'], filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }] });
  if (r.canceled) return [];
  return getShots().importFiles(r.filePaths);
});
app.on('will-quit', () => { try { if (shots) shots.dispose(); globalShortcut.unregisterAll(); } catch (e) { /* ignoré */ } });

// Captures automatiques : décollage (+15 s), première croisière, atterrissage (+4 s).
let autoShot = { flightKey: 0, takeoff: false, cruise: false };
tracker.on('flight-start', () => { autoShot = { flightKey: Date.now(), takeoff: false, cruise: false }; });
tracker.on('telemetry', d => {
  const sh = getShots();
  if (sh.autoOn('takeoff') && !autoShot.takeoff && d.phase === 'airborne' && (d.aglFt == null || d.aglFt > 150)) {
    autoShot.takeoff = true;
    setTimeout(() => { if (sh.autoOn('takeoff')) sh.capture('décollage'); }, 15000);
  }
  if (sh.autoOn('cruise') && !autoShot.cruise && currentDetailedPhase() === 'cruise') {
    autoShot.cruise = true;
    setTimeout(() => { if (sh.autoOn('cruise')) sh.capture('croisière'); }, 20000);
  }
});
tracker.on('flight-landed', () => { if (getShots().autoOn('landing')) setTimeout(() => { if (getShots().autoOn('landing')) getShots().capture('atterrissage'); }, 4000); });

/* =========================================================
   v1.6 — Rappel « tracker non lancé »
   ---------------------------------------------------------
   Tant que le suivi n'est pas connecté, une connexion SimConnect LÉGÈRE et séparée
   (« FlightBrief Watch », 3 variables toutes les 2 s) surveille le simulateur. Dès que
   l'avion roule ou vole, l'interface joue une alerte sonore et une notification Windows
   rappelle de lancer le tracker (ou le lance toute seule si l'option est cochée).
   La surveillance s'arrête dès que le vrai tracker est connecté.
   ========================================================= */
let watchCfg = { enabled: true, autoStart: false };
let watchHandle = null, watchTimer = null, watchConnecting = false, watchState = { moving: false, movingSince: 0, notifiedAt: 0 };
// v1.8 : le 1er rappel n'arrive qu'après 5 min de mouvement continu (l'avion a eu le temps de
// rouler un peu : on ne bipe plus au lancement du simu, sur un repositionnement ou un pushback).
const WATCH_GRACE_MS = 5 * 60000;
async function watchTryConnect() {
  if (!watchCfg.enabled || watchHandle || watchConnecting || tracker.isConnected()) return;
  watchConnecting = true;
  try {
    const sc = require('node-simconnect');
    const res = await Promise.race([sc.open('FlightBrief Watch', sc.Protocol.KittyHawk), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))]);
    const h = res.handle;
    watchHandle = h;
    ['GROUND VELOCITY|knots', 'SIM ON GROUND|bool', 'PLANE ALT ABOVE GROUND|feet'].forEach((v, i) => { const [n, u] = v.split('|'); h.addToDataDefinition(9, n, u, sc.SimConnectDataType.FLOAT64, 0, i); });
    h.requestDataOnSimObject(9, 9, 0, sc.SimConnectPeriod.SECOND, 0, 0, 1, 0);
    h.on('simObjectData', p => {
      if (p.requestID !== 9) return;
      const gs = p.data.readFloat64(), onGround = p.data.readFloat64() > 0.5, agl = p.data.readFloat64();
      watchOnSample({ gs, onGround, agl });
    });
    const drop = () => { if (watchHandle === h) watchHandle = null; watchState.moving = false; watchState.movingSince = 0; };
    h.on('quit', drop); h.on('close', drop); h.on('error', () => {}); h.on('exception', () => {});
  } catch (e) { watchHandle = null; }
  finally { watchConnecting = false; }
}
function watchStop() {
  if (watchHandle) { try { watchHandle.close(); } catch (e) { /* ignoré */ } }
  watchHandle = null; watchState.moving = false; watchState.movingSince = 0;
}
function watchOnSample(s) {
  if (tracker.isConnected()) { watchStop(); return; }
  // v1.8 : vitesse sol exigée aussi « en l'air » — au menu de MSFS, l'avion de fond est souvent
  // vu hors sol à vitesse nulle, ce qui déclenchait l'alarme dès le lancement de l'appli.
  const moving = s.gs > 8;
  if (moving && !watchState.moving) {
    watchState.moving = true;
    watchState.movingSince = Date.now();
    if (watchCfg.autoStart) { watchStop(); tracker.connect().catch(() => {}); if (mainWindow) mainWindow.webContents.send('watch:autostarted'); return; }
  }
  // Un arrêt court (point d'attente, feu rouge du roulage…) ne remet pas le délai à zéro : il
  // faut 2 min immobile pour considérer que l'avion est vraiment arrêté.
  if (moving) watchState.stoppedSince = 0;
  else if (watchState.moving) {
    if (!watchState.stoppedSince) watchState.stoppedSince = Date.now();
    else if (Date.now() - watchState.stoppedSince > 120000) { watchState.moving = false; watchState.movingSince = 0; watchState.stoppedSince = 0; }
  }
  // Rappel après 5 min de mouvement, puis toutes les 60 s tant que l'avion bouge sans tracker.
  if (watchState.moving && Date.now() - watchState.movingSince >= WATCH_GRACE_MS && Date.now() - watchState.notifiedAt > 60000) {
    watchState.notifiedAt = Date.now();
    if (mainWindow) {
      mainWindow.webContents.send('watch:moving', { gs: Math.round(s.gs), airborne: !s.onGround });
      if (!mainWindow.isFocused()) mainWindow.flashFrame(true);
    }
    try {
      if (Notification.isSupported()) {
        const n = new Notification({ title: T('FlightBrief — le tracker ne tourne pas'), body: T(s.onGround ? "Ton avion roule mais le vol n'est pas suivi. Clique pour lancer le tracker." : "Tu voles mais le vol n'est pas suivi ! Clique pour lancer le tracker."), silent: true });
        n.on('click', () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); mainWindow.webContents.send('watch:focus-tracker'); } });
        n.show();
      }
    } catch (e) { /* notifications indisponibles */ }
  }
}
function watchLoop() {
  clearInterval(watchTimer);
  watchTimer = setInterval(() => {
    if (!watchCfg.enabled || tracker.isConnected()) { watchStop(); return; }
    watchTryConnect();
  }, 20000);
  setTimeout(watchTryConnect, 4000);
}
ipcMain.handle('watch:setConfig', (evt, c) => {
  watchCfg = { ...watchCfg, ...(c || {}) };
  if (!watchCfg.enabled) watchStop(); else watchLoop();
  return watchCfg;
});
tracker.on('status', d => { if (d && d.connected) watchStop(); });
app.whenReady().then(() => watchLoop());
app.on('before-quit', () => { watchStop(); clearInterval(watchTimer); });
