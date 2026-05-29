(function(){
'use strict';
const RM = window.RM = window.RM || {};
const {uid} = RM.utils;

const NS = 'rm:v1:';
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

const read = k => {
  try{
    const raw = localStorage.getItem(NS+k);
    if(raw==null) return structuredClone(defaults[k]);
    return JSON.parse(raw);
  }catch{ return structuredClone(defaults[k]); }
};
const write = (k,v) => localStorage.setItem(NS+k, JSON.stringify(v));

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
};

RM.store = store;
RM.onChange = onChange;
})();
