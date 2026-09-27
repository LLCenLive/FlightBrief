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

/* =========================================================
   Compagnon mobile (PWA) — v1.3.1 : synchro Wi-Fi + consultation hors ligne
   ---------------------------------------------------------
   Deux serveurs, actifs seulement si l'utilisateur l'a activé (Admin → Application mobile),
   et les SEULS de l'appli à écouter sur le réseau local (0.0.0.0) :
   • 4815 (HTTP)  : page d'installation — téléchargement du certificat local à approuver
                    une fois sur le téléphone, puis lien vers l'appli.
   • 4816 (HTTPS) : l'appli elle-même, installable, avec service worker -> elle s'ouvre
                    ensuite sans PC ni Wi-Fi et affiche la dernière synchro.
   Données : uniquement via /api/data en HTTPS, protégé par un jeton aléatoire. Lecture seule.
   ========================================================= */
const https = require('https');

const JS = 'application/javascript; charset=utf-8';
const MOBILE_APP_STATIC = {
  '/': ['mobile/index.html', 'text/html; charset=utf-8'],
  '/index.html': ['mobile/index.html', 'text/html; charset=utf-8'],
  '/mobile.css': ['mobile/mobile.css', 'text/css; charset=utf-8'],
  '/mobile.js': ['mobile/mobile.js', JS],
  '/fb-shared.js': ['fb-shared.js', JS],
  '/icon-192.png': ['mobile/icon-192.png', 'image/png'],
  '/icon-512.png': ['mobile/icon-512.png', 'image/png'],
  '/apple-touch-icon.png': ['mobile/apple-touch-icon.png', 'image/png'],
  '/vendor/leaflet/leaflet.js': ['vendor/leaflet/leaflet.js', JS],
  '/vendor/leaflet/leaflet.css': ['vendor/leaflet/leaflet.css', 'text/css; charset=utf-8'],
  '/vendor/leaflet/images/layers.png': ['vendor/leaflet/images/layers.png', 'image/png'],
  '/vendor/leaflet/images/layers-2x.png': ['vendor/leaflet/images/layers-2x.png', 'image/png'],
  '/vendor/leaflet/images/marker-icon.png': ['vendor/leaflet/images/marker-icon.png', 'image/png'],
  '/vendor/leaflet/images/marker-icon-2x.png': ['vendor/leaflet/images/marker-icon-2x.png', 'image/png'],
  '/vendor/leaflet/images/marker-shadow.png': ['vendor/leaflet/images/marker-shadow.png', 'image/png']
};
// Fichiers mis en cache par le service worker (l'appli complète, pour le hors ligne).
const MOBILE_SHELL = ['/', '/mobile.css', '/mobile.js', '/fb-shared.js', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png',
  '/vendor/leaflet/leaflet.js', '/vendor/leaflet/leaflet.css', '/vendor/leaflet/images/layers.png', '/vendor/leaflet/images/marker-icon.png'];

function sendFile(res, rel, type, extraHeaders) {
  fs.readFile(path.join(__dirname, 'renderer', rel), (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache', ...(extraHeaders || {}) });
    res.end(buf);
  });
}
function sendJson(res, code, obj, extraHeaders) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...(extraHeaders || {}) });
  res.end(JSON.stringify(obj));
}
function parseReq(req) {
  try { return new URL(req.url || '/', 'http://localhost'); } catch (e) { return null; }
}

// Version du cache hors ligne : change dès qu'un fichier de l'appli change -> le téléphone
// récupère la nouvelle version à la synchro suivante.
function shellVersion(appVersion) {
  let stamp = 0;
  Object.values(MOBILE_APP_STATIC).forEach(([rel]) => {
    try { stamp = Math.max(stamp, fs.statSync(path.join(__dirname, 'renderer', rel)).mtimeMs); } catch (e) { /* absent */ }
  });
  return `fb-${appVersion || '0'}-${Math.round(stamp).toString(36)}`;
}

function startMobileAppServer(port, opts) {
  const tls = opts.getTls();
  const server = https.createServer({ key: tls.key, cert: tls.cert }, (req, res) => {
    const u = parseReq(req);
    if (!u) { res.writeHead(400); return res.end(); }
    const url = u.pathname;
    const tokenOk = () => {
      const t = u.searchParams.get('t') || req.headers['x-flightbrief-token'] || '';
      return !!t && t === opts.getToken();
    };

    if (MOBILE_APP_STATIC[url]) { const [rel, type] = MOBILE_APP_STATIC[url]; return sendFile(res, rel, type); }

    if (url === '/sw.js') {
      fs.readFile(path.join(__dirname, 'renderer', 'mobile', 'sw.js'), 'utf-8', (err, src) => {
        if (err) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'Content-Type': JS, 'Cache-Control': 'no-cache', 'Service-Worker-Allowed': '/' });
        res.end(src
          .replace("const VERSION = '__VERSION__';", 'const VERSION = ' + JSON.stringify(shellVersion(opts.appVersion)) + ';')
          .replace('const SHELL = __SHELL__;', 'const SHELL = ' + JSON.stringify(MOBILE_SHELL) + ';'));
      });
      return;
    }

    // Test depuis la page d'installation (HTTP) : si cette requête HTTPS aboutit, c'est que
    // le téléphone fait bien confiance au certificat local (et trouve flightbrief.local).
    if (url === '/api/ping') return sendJson(res, 200, { ok: true, app: 'flightbrief' }, { 'Access-Control-Allow-Origin': '*' });

    // Manifeste généré à la volée : l'icône installée rouvre l'appli AVEC le jeton.
    if (url === '/manifest.webmanifest') {
      if (!tokenOk()) { res.writeHead(401, { 'Content-Type': 'text/plain' }); return res.end('Jeton invalide'); }
      res.writeHead(200, { 'Content-Type': 'application/manifest+json; charset=utf-8', 'Cache-Control': 'no-cache' });
      return res.end(JSON.stringify({
        name: 'FlightBrief', short_name: 'FlightBrief',
        description: 'Ton logbook FlightBrief dans la poche, même hors ligne.',
        start_url: '/?t=' + encodeURIComponent(opts.getToken()),
        scope: '/', display: 'standalone', orientation: 'portrait',
        background_color: '#0a0d11', theme_color: '#0a0d11', lang: 'fr',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      }));
    }

    // Vol en direct (onglet du même nom sur le téléphone) : petit JSON interrogé toutes les 2 s.
    if (url === '/api/live') {
      if (!tokenOk()) return sendJson(res, 401, { error: 'unauthorized' });
      try { return sendJson(res, 200, opts.getLive ? opts.getLive() : { connected: false }); }
      catch (e) { return sendJson(res, 500, { error: String(e && e.message || e) }); }
    }

    if (url === '/api/data') {
      if (!tokenOk()) return sendJson(res, 401, { error: 'unauthorized' });
      try { return sendJson(res, 200, opts.getPayload()); }
      catch (e) { return sendJson(res, 500, { error: String(e && e.message || e) }); }
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  });
  server.listen(port, '0.0.0.0', () => console.log(`FlightBrief : appli mobile (HTTPS) sur le port ${port}`));
  return server;
}

function startMobileSetupServer(port, opts) {
  const server = http.createServer((req, res) => {
    const u = parseReq(req);
    if (!u) { res.writeHead(400); return res.end(); }
    const url = u.pathname;
    if (url === '/' || url === '/setup' || url === '/index.html') return sendFile(res, 'mobile/setup.html', 'text/html; charset=utf-8');
    if (url === '/icon-192.png') return sendFile(res, 'mobile/icon-192.png', 'image/png');
    if (url === '/apple-touch-icon.png') return sendFile(res, 'mobile/apple-touch-icon.png', 'image/png');
    // Certificat racine local, en DER : Safari (iPhone) propose directement de l'installer
    // comme profil, Android l'ouvre dans l'installateur de certificats.
    if (url === '/flightbrief-ca.crt') {
      let der;
      try { der = opts.getCaDer(); } catch (e) { res.writeHead(500); return res.end(); }
      res.writeHead(200, { 'Content-Type': 'application/x-x509-ca-cert', 'Content-Disposition': 'attachment; filename="FlightBrief-local.crt"', 'Cache-Control': 'no-store' });
      return res.end(der);
    }
    if (url === '/api/setup-info') {
      const t = u.searchParams.get('t') || '';
      if (!t || t !== opts.getToken()) return sendJson(res, 401, { error: 'unauthorized' });
      return sendJson(res, 200, opts.getSetupInfo());
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  });
  server.listen(port, '0.0.0.0', () => console.log(`FlightBrief : installation mobile (HTTP) sur le port ${port}`));
  return server;
}

module.exports = { startServer, startLiveOverlayServer, startMobileAppServer, startMobileSetupServer };
