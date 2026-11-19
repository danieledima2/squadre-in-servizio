// Squadre in Servizio - funzionamento offline (v2)
const APP = 'squadre-app-v2';
const TILES = 'tiles-v1';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
const LIBS = ['https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'];
const TILE_HOSTS = ['tile.openstreetmap.org', 'server.arcgisonline.com'];
const LIB_HOSTS = ['unpkg.com', 'cdnjs.cloudflare.com'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(APP);
    await c.addAll(SHELL);
    for (const u of LIBS) { try { await c.put(u, await fetch(u, { mode: 'cors' })); } catch (_) { try { await c.put(u, await fetch(u, { mode: 'no-cors' })); } catch (__) {} } }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== APP && k !== TILES) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // pezzi di mappa: prima la copia salvata, poi internet (e la salvo)
  if (TILE_HOSTS.includes(url.hostname)) {
    e.respondWith((async () => {
      const c = await caches.open(TILES);
      const hit = await c.match(req.url);
      if (hit && !(hit.type === 'opaque' && req.mode === 'cors')) return hit;
      try { const r = await fetch(req); if (r.ok || r.type === 'opaque') c.put(req.url, r.clone()); return r; }
      catch (_) { return hit && req.mode !== 'cors' ? hit : new Response('', { status: 504 }); }
    })());
    return;
  }
  // ricerca luoghi: solo internet
  if (url.hostname.includes('nominatim')) return;

  // librerie (mappa, lettura Excel): copia salvata
  if (LIB_HOSTS.includes(url.hostname)) {
    e.respondWith((async () => {
      const c = await caches.open(APP);
      const hit = await c.match(req.url);
      if (hit) return hit;
      const r = await fetch(req); c.put(req.url, r.clone()); return r;
    })());
    return;
  }

  // file dell'app: prima internet (per avere gli aggiornamenti), se manca la copia salvata
  if (url.origin === self.location.origin) {
    e.respondWith((async () => {
      const c = await caches.open(APP);
      try { const r = await fetch(req); if (r.ok) c.put(req, r.clone()); return r; }
      catch (_) { return (await c.match(req, { ignoreSearch: true })) || (await c.match('./index.html')); }
    })());
  }
});
