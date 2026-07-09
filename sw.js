// Cambusa — Service Worker
// Strategia: NETWORK-FIRST per tutto (online = sempre l'ultima versione dalla rete;
// la cache è solo riserva offline). Le API GitHub non vengono intercettate.
// Aggiorna CACHE_VERSION quando rilasci nuove versioni dell'app.

const CACHE_VERSION = 'cambusa-v1.13.1';
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

  // API GitHub e contenuti raw: NON intercettare (passthrough diretto al browser),
  // così non vengono messe in cache né mascherate da risposte "offline".
  if(url.hostname==='api.github.com' || url.hostname.endsWith('githubusercontent.com')) return;

  // TUTTO il resto → network-first: online carica SEMPRE l'ultima versione dalla
  // rete (niente più versioni "incollate"); la cache resta solo riserva offline.
  e.respondWith(networkFirst(req, url.origin===location.origin ? SHELL_CACHE : RUNTIME_CACHE));
});

async function networkFirst(req, cacheName){
  const cache = await caches.open(cacheName);
  try{
    const fresh = await fetch(req);
    if(fresh && fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  }catch(e){
    const cached = await cache.match(req, {ignoreSearch:true});
    if(cached) return cached;
    if(req.mode === 'navigate'){
      const fallback = await cache.match('./index.html');
      if(fallback) return fallback;
    }
    return new Response('Offline', {status:503, statusText:'Offline'});
  }
}

// listener opzionale per skipWaiting da UI ("aggiorna ora")
self.addEventListener('message', (e)=>{ if(e.data === 'skipWaiting') self.skipWaiting(); });
