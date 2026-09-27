/* FlightBrief — service worker du compagnon mobile (v1.3.1)
   Met l'APPLI en cache (pas les données, qui vivent dans IndexedDB) pour qu'elle s'ouvre
   sans PC ni réseau. __VERSION__ et __SHELL__ sont remplacés par le serveur (server.js) :
   la version change dès qu'un fichier de l'appli change, et le téléphone récupère la
   nouvelle version à la synchro suivante sur le Wi-Fi. */
const VERSION = '__VERSION__';
const SHELL = __SHELL__;
const SHELL_CACHE = VERSION + '-shell';
const RUNTIME_CACHE = 'fb-runtime'; // polices + tuiles de carte déjà vues
const RUNTIME_LIMIT = 700;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== SHELL_CACHE && k !== RUNTIME_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trimRuntime(){
  const cache = await caches.open(RUNTIME_CACHE);
  const keys = await cache.keys();
  for(let i = 0; i < keys.length - RUNTIME_LIMIT; i++) await cache.delete(keys[i]);
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);

  if(url.origin === self.location.origin){
    // Données, manifeste et service worker : toujours en direct (jamais servis depuis le cache).
    if(url.pathname.startsWith('/api/') || url.pathname === '/manifest.webmanifest' || url.pathname === '/sw.js') return;
    // Ouverture de l'appli (avec ou sans ?t=...) : la page en cache, immédiatement.
    if(req.mode === 'navigate'){
      event.respondWith(caches.match('/', { cacheName: SHELL_CACHE }).then(r => r || fetch(req)));
      return;
    }
    event.respondWith(caches.match(req, { ignoreSearch: true }).then(r => r || fetch(req)));
    return;
  }

  // Polices Google et tuiles de carte : servies depuis le cache si déjà vues (hors ligne),
  // rafraîchies en arrière-plan quand le réseau est là.
  if(/fonts\.(googleapis|gstatic)\.com$|basemaps\.cartocdn\.com$/.test(url.hostname)){
    event.respondWith(caches.open(RUNTIME_CACHE).then(async cache => {
      const cached = await cache.match(req);
      const network = fetch(req).then(res => {
        if(res && (res.ok || res.type === 'opaque')){ cache.put(req, res.clone()).then(trimRuntime).catch(() => {}); }
        return res;
      }).catch(() => cached || Response.error());
      return cached || network;
    }));
  }
});
