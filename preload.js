const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadDb: () => ipcRenderer.invoke('db:load'),
  saveDb: (data) => ipcRenderer.invoke('db:save', data),
  getObsPort: () => ipcRenderer.invoke('obs:getPort'),
  getLiveOverlayPort: () => ipcRenderer.invoke('obs:getLiveOverlayPort'),
  copyToClipboard: (text) => ipcRenderer.invoke('clipboard:write', text),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  getDataPath: () => ipcRenderer.invoke('app:getDataPath'),
  pushLiveUpdate: (data) => ipcRenderer.send('live:update', data),
  onObsServerError: (cb) => ipcRenderer.on('obs:serverError', (_, msg) => cb(msg)),
  onLiveOverlayServerError: (cb) => ipcRenderer.on('liveOverlay:serverError', (_, msg) => cb(msg)),
  pushLiveOverlayUpdate: (data) => ipcRenderer.send('live:updateOverlay', data),
  lookupAirport: (icao) => ipcRenderer.invoke('airport:lookup', icao)
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
