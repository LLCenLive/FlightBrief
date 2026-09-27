const { app, BrowserWindow, ipcMain, clipboard, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { startServer, startLiveOverlayServer, startMobileAppServer, startMobileSetupServer } = require('./server');
const { LocalTls, startMdnsResponder, localIPv4s, HOSTNAME: MOBILE_HOSTNAME } = require('./mobile-tls');
const { FlightTracker } = require('./tracker');

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

function readDb() {
  try {
    const raw = fs.readFileSync(dataFilePath(), 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return null; // pas encore de fichier -> le renderer utilisera les valeurs par défaut
  }
}

function writeDb(data) {
  fs.mkdirSync(path.dirname(dataFilePath()), { recursive: true });
  fs.writeFileSync(dataFilePath(), JSON.stringify(data, null, 2), 'utf-8');
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
    liveOverlayServer = startLiveOverlayServer(LIVE_OVERLAY_PORT, () => liveOverlayState);
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

app.whenReady().then(() => {
  if (!gotLock) return;
  startObsServerSafely();
  startLiveOverlayServerSafely();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  tracker.disconnect();
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
  tracker.disconnect();
  stopMobileServer();
  if (obsServer) { try { obsServer.close(); } catch (e) { /* déjà fermé */ } }
  if (liveOverlayServer) { try { liveOverlayServer.close(); } catch (e) { /* déjà fermé */ } }
});

/* ---------------- Stockage local ---------------- */
ipcMain.handle('db:load', () => readDb());
ipcMain.handle('db:save', (evt, data) => { writeDb(data); return true; });
ipcMain.handle('obs:getPort', () => OBS_PORT);
ipcMain.handle('obs:getLiveOverlayPort', () => LIVE_OVERLAY_PORT);
ipcMain.handle('clipboard:write', (evt, text) => { clipboard.writeText(text); return true; });
ipcMain.handle('shell:openExternal', (evt, url) => { shell.openExternal(url); return true; });
ipcMain.handle('app:getDataPath', () => dataFilePath());
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
        path: downsamplePath(td.path, 150)
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
    profile: { firstName: p.firstName || '', network: p.network || '', homeBase: p.homeBase || '', twitchHandle: p.twitchHandle || '' },
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
      getToken: getMobileToken, getPayload: buildMobilePayload, getLive: buildLivePayload,
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

tracker.on('status', data => mainWindow && mainWindow.webContents.send('tracker:status', data));
tracker.on('telemetry', data => mainWindow && mainWindow.webContents.send('tracker:telemetry', data));
tracker.on('flight-start', data => mainWindow && mainWindow.webContents.send('tracker:flight-start', data));
tracker.on('flight-landed', data => mainWindow && mainWindow.webContents.send('tracker:flight-landed', data));
tracker.on('flight-end', data => mainWindow && mainWindow.webContents.send('tracker:flight-end', data));
// Phases + rapport détaillé mis à jour en direct au fil du vol (voir tracker.js) —
// affichés désormais directement dans la page Briefing, plus seulement à la fin
// dans la vue synthétique de l'onglet Carte du Logbook.
tracker.on('flight-progress', data => mainWindow && mainWindow.webContents.send('tracker:progress', data));
tracker.on('error', err => logFatalError('tracker', err));
