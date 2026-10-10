const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadDb: () => ipcRenderer.invoke('db:load'),
  saveDb: (data) => ipcRenderer.invoke('db:save', data),
  getObsPort: () => ipcRenderer.invoke('obs:getPort'),
  getLiveOverlayPort: () => ipcRenderer.invoke('obs:getLiveOverlayPort'),
  copyToClipboard: (text) => ipcRenderer.invoke('clipboard:write', text),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  getDataPath: () => ipcRenderer.invoke('app:getDataPath'),
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  checkUpdate: () => ipcRenderer.invoke('app:checkUpdate'),
  releaseNotes: (version) => ipcRenderer.invoke('app:releaseNotes', version),
  reload: () => ipcRenderer.invoke('app:reload'),
  pushLiveUpdate: (data) => ipcRenderer.send('live:update', data),
  onObsServerError: (cb) => ipcRenderer.on('obs:serverError', (_, msg) => cb(msg)),
  onLiveOverlayServerError: (cb) => ipcRenderer.on('liveOverlay:serverError', (_, msg) => cb(msg)),
  pushLiveOverlayUpdate: (data) => ipcRenderer.send('live:updateOverlay', data),
  lookupAirport: (icao) => ipcRenderer.invoke('airport:lookup', icao),
  airportIndexInfo: () => ipcRenderer.invoke('airport:indexInfo')
});

// v1.5 — sauvegardes automatiques du fichier de données
contextBridge.exposeInMainWorld('backups', {
  list: () => ipcRenderer.invoke('backups:list'),
  now: () => ipcRenderer.invoke('backups:now'),
  restore: (name) => ipcRenderer.invoke('backups:restore', name),
  openFolder: () => ipcRenderer.invoke('backups:openFolder'),
  recoveryInfo: () => ipcRenderer.invoke('backups:recoveryInfo')
});

// v1.5 — mise à jour en un clic
contextBridge.exposeInMainWorld('updater', {
  download: () => ipcRenderer.invoke('update:download'),
  install: () => ipcRenderer.invoke('update:install'),
  onProgress: (cb) => ipcRenderer.on('update:progress', (_, d) => cb(d)),
  onDownloaded: (cb) => ipcRenderer.on('update:downloaded', (_, d) => cb(d)),
  onError: (cb) => ipcRenderer.on('update:error', (_, d) => cb(d))
});

// v1.5 — contrôleurs en ligne (VATSIM + IVAO)
contextBridge.exposeInMainWorld('atc', {
  get: (opts) => ipcRenderer.invoke('atc:get', opts || {})
});

// v1.5 — overlay d'alertes (OBS) et bot Twitch
contextBridge.exposeInMainWorld('alerts', {
  push: (a) => ipcRenderer.send('alerts:push', a),
  setConfig: (c) => ipcRenderer.send('alerts:config', c),
  getPort: () => ipcRenderer.invoke('alerts:getPort'),
  onPushed: (cb) => ipcRenderer.on('alerts:pushed', (_, a) => cb(a))
});
contextBridge.exposeInMainWorld('twitch', {
  getState: () => ipcRenderer.invoke('twitch:getState'),
  setConfig: (c) => ipcRenderer.invoke('twitch:setConfig', c),
  startLogin: () => ipcRenderer.invoke('twitch:startLogin'),
  cancelLogin: () => ipcRenderer.invoke('twitch:cancelLogin'),
  checkClientId: (id) => ipcRenderer.invoke('twitch:checkClientId', id),
  logout: () => ipcRenderer.invoke('twitch:logout'),
  reconnect: () => ipcRenderer.invoke('twitch:reconnect'),
  bet: (action) => ipcRenderer.invoke('twitch:bet', action),
  test: (kind) => ipcRenderer.invoke('twitch:test', kind),
  landingInfo: (info) => ipcRenderer.send('twitch:landingInfo', info),
  onState: (cb) => ipcRenderer.on('twitch:state', (_, s) => cb(s)),
  onLoginResult: (cb) => ipcRenderer.on('twitch:loginResult', (_, r) => cb(r))
});

// v1.6 — captures d'écran des vols
contextBridge.exposeInMainWorld('shots', {
  setConfig: (c) => ipcRenderer.invoke('shots:setConfig', c),
  capture: (reason) => ipcRenderer.invoke('shots:capture', reason),
  list: (range) => ipcRenderer.invoke('shots:list', range),
  resolve: (names) => ipcRenderer.invoke('shots:resolve', names),
  remove: (name) => ipcRenderer.invoke('shots:delete', name),
  stats: () => ipcRenderer.invoke('shots:stats'),
  openFolder: () => ipcRenderer.invoke('shots:openFolder'),
  openFile: (name) => ipcRenderer.invoke('shots:openFile', name),
  importFiles: () => ipcRenderer.invoke('shots:import'),
  onTaken: (cb) => ipcRenderer.on('shots:taken', (_, s) => cb(s))
});
// v1.6 — rappel « tracker non lancé »
contextBridge.exposeInMainWorld('watch', {
  setConfig: (c) => ipcRenderer.invoke('watch:setConfig', c),
  onMoving: (cb) => ipcRenderer.on('watch:moving', (_, d) => cb(d)),
  onAutoStarted: (cb) => ipcRenderer.on('watch:autostarted', () => cb()),
  onFocusTracker: (cb) => ipcRenderer.on('watch:focus-tracker', () => cb())
});

// Compagnon mobile (PWA servie sur le réseau local, voir main.js / server.js)
contextBridge.exposeInMainWorld('mobile', {
  setEnabled: (enabled) => ipcRenderer.invoke('mobile:setEnabled', !!enabled),
  getStatus: () => ipcRenderer.invoke('mobile:getStatus'),
  regenToken: () => ipcRenderer.invoke('mobile:regenToken'),
  onStatus: (cb) => ipcRenderer.on('mobile:status', (_, s) => cb(s))
});

contextBridge.exposeInMainWorld('winCtl', {
  minimize: () => ipcRenderer.invoke('win:minimize'),
  maximizeToggle: () => ipcRenderer.invoke('win:maximizeToggle'),
  close: () => ipcRenderer.invoke('win:close'),
  isMaximized: () => ipcRenderer.invoke('win:isMaximized'),
  platform: () => ipcRenderer.invoke('win:platform'),
  onMaximizedChange: (cb) => ipcRenderer.on('win:maximized-change', (_, v) => cb(v))
});

contextBridge.exposeInMainWorld('tracker', {
  connect: () => ipcRenderer.invoke('tracker:connect'),
  disconnect: () => ipcRenderer.invoke('tracker:disconnect'),
  isConnected: () => ipcRenderer.invoke('tracker:isConnected'),
  stopTracking: () => ipcRenderer.invoke('tracker:stopTracking'),
  loadPendingFlight: () => ipcRenderer.invoke('tracker:loadPendingFlight'),
  clearPendingFlight: () => ipcRenderer.invoke('tracker:clearPendingFlight'),
  onStatus: (cb) => ipcRenderer.on('tracker:status', (_, d) => cb(d)),
  onTelemetry: (cb) => ipcRenderer.on('tracker:telemetry', (_, d) => cb(d)),
  onFlightStart: (cb) => ipcRenderer.on('tracker:flight-start', (_, d) => cb(d)),
  onFlightLanded: (cb) => ipcRenderer.on('tracker:flight-landed', (_, d) => cb(d)),
  onFlightEnd: (cb) => ipcRenderer.on('tracker:flight-end', (_, d) => cb(d)),
  onProgress: (cb) => ipcRenderer.on('tracker:progress', (_, d) => cb(d))
});
