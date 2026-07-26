const http = require('http');
const fs = require('fs');
const path = require('path');

function jsonResponse(res, getState) {
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify((getState && getState()) || {}));
}

function htmlResponse(res, filename) {
  const html = fs.readFileSync(path.join(__dirname, 'renderer', filename), 'utf-8');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

// Source OBS du briefing de vol (carte statique) — INCHANGÉE, ne pas toucher : c'est
// celle-ci que l'utilisateur a qualifiée de "parfaite".
function startServer(port, getLiveState) {
  const server = http.createServer((req, res) => {
    const url = (req.url || '/').split('?')[0];

    if (url === '/' || url === '/obs') return htmlResponse(res, 'obs.html');
    if (url === '/api/state') return jsonResponse(res, getLiveState);

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`FlightBrief : source OBS (briefing) disponible sur http://localhost:${port}/obs`);
  });

  return server;
}

// Overlay Twitch personnalisable (page Outil Live) — serveur HTTP totalement
// distinct (port différent) de celui du briefing ci-dessus, pour que les deux
// sources OBS aient des URLs (hôte:port) réellement différentes, pas seulement
// des chemins différents sur le même serveur.
function startLiveOverlayServer(port, getLiveOverlayState) {
  const server = http.createServer((req, res) => {
    const url = (req.url || '/').split('?')[0];

    if (url === '/' || url === '/live') return htmlResponse(res, 'live-overlay.html');
    if (url === '/api/live-state') return jsonResponse(res, getLiveOverlayState);

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`FlightBrief : overlay live disponible sur http://localhost:${port}/live`);
  });

  return server;
}

module.exports = { startServer, startLiveOverlayServer };
