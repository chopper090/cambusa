// Cambusa — Service Worker
// Strategia: app shell precaching (cache-first per i propri file) + network-first per le CDN esterne.
// Aggiorna CACHE_VERSION quando rilasci nuove versioni dell'app.

const CACHE_VERSION = 'cambusa-v1.12.3';
const SHELL_CACHE  = CACHE_VERSION + '-shell';
const RUNTIME_CACHE = CACHE_VERSION + '-runtime';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './js/version.js',
  './css/base.css',
  './css/theme.css',
  './css/components.css',
  './js/utils.js',
  './js/clients.js',
  './js/store.js',
  './js/sync.js',
  './js/calc.js',
  './js/kb_prezzi.js',
  './js/excel.js',
  './js/pdf.js',
  './js/canvas_engine.js',
  './js/app.js',
  './js/modules/restaurants.js',
  './js/modules/dashboard.js',
  './js/modules/ingredienti.js',
  './js/modules/piatti.js',
  './js/modules/ricettario.js',
  './js/modules/menu.js',
  './js/modules/haccp.js',
  './js/modules/fornitori.js',
  './js/modules/giacenze.js',
  './js/modules/menu_editor.js',
  './js/modules/ricettario_editor.js',
  './js/modules/ai-menu.js',
  './js/modules/seed_carta.js',
  './js/modules/settings.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e)=>{
  e.waitUntil(
    caches.open(SHELL_CACHE).then(c => c.addAll(SHELL)).then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate', (e)=>{
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== SHELL_CACHE && k !== RUNTIME_CACHE).map(k => caches.delete(k))
    )).then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', (e)=>{
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);

  // CDN librerie esterne → network-first con fallback cache
  if(url.origin !== location.origin){
    e.respondWith(networkFirst(req, RUNTIME_CACHE));
    return;
  }

  // App shell e file locali → cache-first
  e.respondWith(cacheFirst(req, SHELL_CACHE));
});

async function cacheFirst(req, cacheName){
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req, {ignoreSearch:true});
  if(cached) return cached;
  try{
    const fresh = await fetch(req);
    if(fresh && fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  }catch(e){
    // fallback: index.html per request di navigazione (SPA-like)
    if(req.mode === 'navigate'){
      const fallback = await cache.match('./index.html');
      if(fallback) return fallback;
    }
    return new Response('Offline', {status:503, statusText:'Offline'});
  }
}

async function networkFirst(req, cacheName){
  const cache = await caches.open(cacheName);
  try{
    const fresh = await fetch(req);
    if(fresh && fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  }catch(e){
    const cached = await cache.match(req);
    if(cached) return cached;
    return new Response('Offline', {status:503, statusText:'Offline'});
  }
}

// listener opzionale per skipWaiting da UI ("aggiorna ora")
self.addEventListener('message', (e)=>{ if(e.data === 'skipWaiting') self.skipWaiting(); });
