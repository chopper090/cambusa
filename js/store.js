(function(){
'use strict';
const RM = window.RM = window.RM || {};
const {uid} = RM.utils;

const NS = 'rm:v1:';
const APP_KEY = NS + '__app__';                 // registro globale ristoranti + attivo
// Chiavi partizionate per-ristorante (ogni locale ha i propri dati e impostazioni):
const KEYS = ['ingredienti','fornitori','piatti','menu','haccp','giacenze','settings'];

const defaults = {
  ingredienti:[], fornitori:[], piatti:[], menu:[], haccp:[], giacenze:[],
  settings:{
    iva_default:10, foodcost_target_pct:30, valuta:'EUR',
    nome_locale:'', logo:'', indirizzo:'',
    backup_ogni_n_modifiche:25, modifiche_dall_ultimo_backup:0,
    // sistema loghi multipli: array {id,name,data(base64)}
    logos: [],
    // mappa: per ogni tipo doc → {logo_id, mode: 'watermark'|'corner'|'header', opacity:0..1, size:0..1}
    branding: {
      ricettario: {logo_id:'', mode:'header',    opacity:1,   size:.18},
      menu:      {logo_id:'', mode:'header',    opacity:1,   size:.22},
      haccp:     {logo_id:'', mode:'corner',    opacity:1,   size:.10},
      watermark_all: {logo_id:'', mode:'watermark', opacity:.06, size:.45},
    },
  }
};

// ---- chiavi namespacate per ristorante ----
const partKey = (restId,k) => NS + 'r:' + restId + ':' + k;

const readFor = (restId,k) => {
  try{
    const raw = localStorage.getItem(partKey(restId,k));
    if(raw==null) return structuredClone(defaults[k]);
    return JSON.parse(raw);
  }catch{ return structuredClone(defaults[k]); }
};
const writeFor = (restId,k,v) => localStorage.setItem(partKey(restId,k), JSON.stringify(v));

// ============================================================================
// Registro ristoranti (globale) + migrazione dai dati legacy non partizionati.
// ============================================================================
function readApp(){ try{ const raw=localStorage.getItem(APP_KEY); return raw==null?null:JSON.parse(raw); }catch{ return null; } }
function writeApp(a){ localStorage.setItem(APP_KEY, JSON.stringify(a)); }

function makeRestaurant(o){
  return {
    id: o.id || ('r_'+uid('').slice(1)),
    name: o.name || 'Ristorante',
    kind: o.kind || '',
    place: o.place || '',
    logo: o.logo || '',
    themeKey: o.themeKey || 'classico',
    custom: o.custom || {},
    createdAt: o.createdAt || Date.now(),
  };
}

function syncName(restId, name){
  const s = readFor(restId,'settings');
  if(s.nome_locale !== name){ s.nome_locale = name; writeFor(restId,'settings',s); }
}

// Prima esecuzione con la nuova versione: crea il ristorante di default,
// migra i dati legacy (copiandoli, senza mai cancellarli) e semina "il baretto".
function migrate(){
  const legacyRaw = k => { try{ return localStorage.getItem(NS+k); }catch{ return null; } };
  let legacyName = '';
  try{ const ls = JSON.parse(legacyRaw('settings')||'null'); if(ls && ls.nome_locale) legacyName = ls.nome_locale; }catch{}

  const mainId = 'r_main';
  // copia legacy → partizione del ristorante principale (solo se non già migrato)
  for(const k of KEYS){
    const dst = partKey(mainId,k);
    if(localStorage.getItem(dst) != null) continue;
    const raw = legacyRaw(k);
    if(raw != null) localStorage.setItem(dst, raw);
  }

  const main = makeRestaurant({ id:mainId, name: legacyName || 'Il mio ristorante', kind:'Ristorante', themeKey:'classico' });
  const baretto = makeRestaurant({ id:'r_baretto', name:'il baretto', kind:'Cocktail & Wine Bar', place:'Messina', themeKey:'baretto' });

  const meta = { restaurants:[main, baretto], active: mainId };
  writeApp(meta);
  syncName(mainId, main.name);
  syncName('r_baretto', baretto.name);
  return meta;
}

let appMeta = readApp() || migrate();
const activeId = () => appMeta.active;

// ---- read/write sul ristorante attivo ----
const read  = k => readFor(activeId(), k);
const write = (k,v) => writeFor(activeId(), k, v);

const listeners = new Set();
const notify = (k)=>{ for(const fn of listeners) try{fn(k);}catch(e){console.error(e);} };
const onChange = fn => { listeners.add(fn); return ()=>listeners.delete(fn); };

function _bumpMod(k){
  if(k==='settings')return;
  const s = read('settings');
  s.modifiche_dall_ultimo_backup = (s.modifiche_dall_ultimo_backup||0)+1;
  write('settings', s);
}

const store = {
  all(k){ return read(k); },
  set(k,v){ write(k,v); notify(k); _bumpMod(k); },
  get(k,id){ return read(k).find(x=>x.id===id); },
  upsert(k, item){
    const list = read(k);
    if(!item.id){ item.id = uid(k.slice(0,3)); item.aggiornato = Date.now(); list.push(item); }
    else{
      const i = list.findIndex(x=>x.id===item.id);
      item.aggiornato = Date.now();
      if(i>=0) list[i]=item; else list.push(item);
    }
    write(k,list); notify(k); _bumpMod(k);
    return item;
  },
  remove(k, id){
    const list = read(k).filter(x=>x.id!==id);
    write(k,list); notify(k); _bumpMod(k);
  },
  getSettings(){ return read('settings'); },
  setSettings(patch){
    const s = {...read('settings'), ...patch};
    write('settings', s); notify('settings');
    // mantieni il nome del ristorante allineato al nome del locale
    if(patch && patch.nome_locale != null){
      const r = appMeta.restaurants.find(x=>x.id===activeId());
      if(r && r.name !== patch.nome_locale){ r.name = patch.nome_locale; writeApp(appMeta); notify('__app__'); }
    }
    return s;
  },
  exportAll(){ const o={}; for(const k of KEYS) o[k]=read(k); return o; },
  importAll(data){
    for(const k of KEYS){
      if(!(k in data)) continue;
      if(k==='settings') write(k, {...defaults.settings, ...data[k]});
      else write(k, data[k]||[]);
      notify(k);
    }
  },
  resetAll(){ for(const k of KEYS){ write(k, structuredClone(defaults[k])); notify(k); } },
  KEYS,

  // ===== Ristoranti (multi-cliente) =====
  getRestaurants(){ return appMeta.restaurants.map(r=>({...r})); },
  getActiveId(){ return appMeta.active; },
  getActive(){ return appMeta.restaurants.find(r=>r.id===appMeta.active) || appMeta.restaurants[0]; },
  setActive(id){
    if(!appMeta.restaurants.some(r=>r.id===id)) return false;
    if(appMeta.active===id) return true;
    appMeta.active = id; writeApp(appMeta); notify('__app__');
    return true;
  },
  addRestaurant(o){
    const r = makeRestaurant(o);
    appMeta.restaurants.push(r); writeApp(appMeta);
    const s = structuredClone(defaults.settings); s.nome_locale = r.name;
    writeFor(r.id,'settings',s);
    notify('__app__');
    return r;
  },
  updateRestaurant(id, patch){
    const r = appMeta.restaurants.find(x=>x.id===id); if(!r) return null;
    Object.assign(r, patch); writeApp(appMeta);
    if(patch && patch.name!=null) syncName(id, patch.name);
    notify('__app__');
    return {...r};
  },
  removeRestaurant(id){
    if(appMeta.restaurants.length<=1) return false;
    appMeta.restaurants = appMeta.restaurants.filter(r=>r.id!==id);
    for(const k of KEYS) localStorage.removeItem(partKey(id,k));
    if(appMeta.active===id) appMeta.active = appMeta.restaurants[0].id;
    writeApp(appMeta); notify('__app__');
    return true;
  },
  duplicateRestaurant(id, copyData){
    const src = appMeta.restaurants.find(r=>r.id===id); if(!src) return null;
    const r = makeRestaurant({ name:src.name+' (copia)', kind:src.kind, place:src.place, logo:src.logo, themeKey:src.themeKey, custom:{...(src.custom||{})} });
    appMeta.restaurants.push(r); writeApp(appMeta);
    if(copyData){
      for(const k of KEYS){ const raw=localStorage.getItem(partKey(id,k)); if(raw!=null) localStorage.setItem(partKey(r.id,k), raw); }
      syncName(r.id, r.name);
    } else {
      const s = structuredClone(defaults.settings); s.nome_locale = r.name; writeFor(r.id,'settings',s);
    }
    notify('__app__');
    return r;
  },

  // ===== Backup / ripristino dell'intero spazio di lavoro (tutti i ristoranti) =====
  // ⚠️ La configurazione di sync (chiavi rm:v1:sync:* — token GitHub incluso) è
  // ESCLUSA da backup e sync: il token non deve MAI finire nel Gist/file, altrimenti
  // il secret-scanning di GitHub lo revoca. Ed è locale al dispositivo.
  backup(){
    const SYNC = NS + 'sync:';
    const out = { _fmt:'cambusa-backup', _v:1, savedAt:Date.now(), app:structuredClone(appMeta), parts:{} };
    for(let i=0;i<localStorage.length;i++){
      const k = localStorage.key(i);
      if(k && k.startsWith(NS) && k!==APP_KEY && !k.startsWith(SYNC)) out.parts[k] = localStorage.getItem(k);
    }
    return out;
  },
  restore(obj){
    if(!obj || obj._fmt!=='cambusa-backup' || !obj.app || !Array.isArray(obj.app.restaurants)) return false;
    const SYNC = NS + 'sync:';
    const del=[];
    // non cancellare la config di sync locale (token) durante un ripristino/pull
    for(let i=0;i<localStorage.length;i++){ const k=localStorage.key(i); if(k && k.startsWith(NS) && !k.startsWith(SYNC)) del.push(k); }
    del.forEach(k=>localStorage.removeItem(k));
    for(const k of Object.keys(obj.parts||{})){ if(!k.startsWith(SYNC)) localStorage.setItem(k, obj.parts[k]); }
    appMeta = obj.app; writeApp(appMeta);
    notify('__app__'); for(const k of KEYS) notify(k);
    return true;
  },

  // ===== Trasferimento dati tra ristoranti =====
  // Copia (o sposta) i contenuti da un ristorante all'altro SENZA toccare le
  // impostazioni (nome, stile, loghi) del ristorante di destinazione.
  // Merge per id: gli elementi già presenti nel target non vengono duplicati.
  // Ritorna un riepilogo {ingredienti, piatti, menu, ...} con i conteggi aggiunti.
  CONTENT_KEYS: ['ingredienti','fornitori','piatti','menu','haccp','giacenze'],
  transferData(fromId, toId, opts={}){
    if(!fromId || !toId || fromId===toId) return null;
    if(!appMeta.restaurants.some(r=>r.id===fromId) || !appMeta.restaurants.some(r=>r.id===toId)) return null;
    const summary = {};
    for(const k of this.CONTENT_KEYS){
      const src = readFor(fromId,k);
      if(!Array.isArray(src)){ continue; }
      const dst = readFor(toId,k);
      const seen = new Set(dst.map(x=>x && x.id));
      let added=0;
      for(const item of src){ if(item && !seen.has(item.id)){ dst.push(item); seen.add(item.id); added++; } }
      writeFor(toId,k,dst);
      if(opts.move) writeFor(fromId,k,structuredClone(defaults[k]));
      summary[k]=added;
    }
    notify('__app__'); for(const k of this.CONTENT_KEYS) notify(k);
    return summary;
  },
};

RM.store = store;
RM.onChange = onChange;
})();
