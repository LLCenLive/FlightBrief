const { app, BrowserWindow, ipcMain, clipboard, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { startServer, startLiveOverlayServer } = require('./server');
const { FlightTracker } = require('./tracker');

const OBS_PORT = 4813;
const LIVE_OVERLAY_PORT = 4814; // port distinct -> URL OBS différente de celle du briefing
let liveState = { theme: null };
let liveOverlayState = { config: null, telemetry: null }; // overlay Twitch personnalisable (page Outil Live)
let mainWindow = null;
let obsServer = null;
let liveOverlayServer = null;
const tracker = new FlightTracker(path.join(__dirname, 'renderer'), app.getPath('userData'));

// Index des aéroports (OACI -> coordonnées), utilisé pour estimer la distance totale
// du trajet (départ -> arrivée saisis dans le briefing) et donc la progression en %
// affichée sur l'overlay live personnalisable.
let airportsByIcao = null;
function loadAirportIndex() {
  if (airportsByIcao) return airportsByIcao;
  airportsByIcao = new Map();
  try {
    const list = JSON.parse(fs.readFileSync(path.join(__dirname, 'renderer', 'data', 'airports.json'), 'utf-8'));
    for (const [icao, name, lat, lon, elevFt] of list) airportsByIcao.set(icao, { icao, name, lat, lon, elevFt });
  } catch (e) { /* index indisponible -> lookup renverra null */ }
  return airportsByIcao;
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1040,
    minHeight: 720,
    backgroundColor: '#0a0d11',
    icon: path.join(__dirname, 'build', 'icon.png'),
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
});
ipcMain.handle('airport:lookup', (evt, icao) => lookupAirport(icao));

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
