(function(){
'use strict';
const RM = window.RM = window.RM || {};

// ============================================================================
// Sincronizzazione tra dispositivi tramite Gist GitHub segreto.
// La "memoria" sincronizzata è l'intero backup del workspace (tutti i
// ristoranti). Strategia: "vince l'ultima modifica" (per timestamp updatedAt).
//   - all'apertura: se il remoto è più recente → scarica (pull)
//   - dopo ogni modifica (auto): invia (push) con debounce
//   - pulsanti manuali: Sincronizza ora / Invia / Scarica
// Il token GitHub (solo permesso "gist") resta in localStorage del dispositivo.
// ============================================================================

const NS  = 'rm:v1:sync:';
const FILE = 'cambusa-backup.json';
const API  = 'https://api.github.com';

const cfg = {
  get token(){ return localStorage.getItem(NS+'token')||''; },
  set token(v){ v?localStorage.setItem(NS+'token',v):localStorage.removeItem(NS+'token'); },
  get gistId(){ return localStorage.getItem(NS+'gist')||''; },
  set gistId(v){ v?localStorage.setItem(NS+'gist',v):localStorage.removeItem(NS+'gist'); },
  get auto(){ return localStorage.getItem(NS+'auto')==='1'; },
  set auto(v){ localStorage.setItem(NS+'auto', v?'1':'0'); },
  get localUpdatedAt(){ return +localStorage.getItem(NS+'localUpd')||0; },
  set localUpdatedAt(v){ localStorage.setItem(NS+'localUpd', String(v)); },
  get syncedUpdatedAt(){ return +localStorage.getItem(NS+'syncUpd')||0; },
  set syncedUpdatedAt(v){ localStorage.setItem(NS+'syncUpd', String(v)); },
};

let suppressBump=false, pushTimer=null, busy=false, ready=false;
const listeners=new Set();
const emit = s => { for(const fn of listeners) try{fn(s);}catch(e){} };

async function ghFetch(url, opts={}){
  const res = await fetch(url, {...opts, headers:{
    'Authorization':'Bearer '+cfg.token,
    'Accept':'application/vnd.github+json',
    'X-GitHub-Api-Version':'2022-11-28',
    ...(opts.headers||{}),
  }});
  if(!res.ok){
    let msg = res.status+' '+res.statusText;
    try{ const j=await res.json(); if(j && j.message) msg=res.status+' — '+j.message; }catch(e){}
    if(res.status===401) msg='token rifiutato — usa un token CLASSIC con permesso “gist”. I token “fine-grained” NON funzionano con i Gist.';
    else if(res.status===403) msg='accesso negato — il token deve avere il permesso “gist” (oppure limite richieste raggiunto, riprova tra poco).';
    else if(res.status===404) msg='non trovato — token senza permesso “gist” o Gist inesistente.';
    throw new Error(msg);
  }
  return res;
}

function buildPayload(){
  const backup = RM.store.backup();            // {_fmt, app, parts, savedAt}
  backup.updatedAt = cfg.localUpdatedAt || Date.now();
  return backup;
}

// trova un gist esistente (di questo account) che contiene il nostro file
async function findGist(){
  const res = await ghFetch(API+'/gists?per_page=100');
  const arr = await res.json();
  const g = Array.isArray(arr) ? arr.find(x=>x.files && x.files[FILE]) : null;
  return g ? g.id : '';
}

async function push(){
  if(!cfg.token) throw new Error('token mancante');
  const payload = buildPayload();
  const body = JSON.stringify({ description:'Cambusa — memoria (sync)', public:false, files:{ [FILE]:{ content: JSON.stringify(payload) } } });
  if(!cfg.gistId){ cfg.gistId = await findGist(); }
  const res = cfg.gistId
    ? await ghFetch(API+'/gists/'+cfg.gistId, {method:'PATCH', body})
    : await ghFetch(API+'/gists', {method:'POST', body});
  const data = await res.json();
  cfg.gistId = data.id;
  cfg.localUpdatedAt  = payload.updatedAt;
  cfg.syncedUpdatedAt = payload.updatedAt;
  return payload.updatedAt;
}

async function fetchRemote(){
  if(!cfg.token) throw new Error('token mancante');
  if(!cfg.gistId){ cfg.gistId = await findGist(); }
  if(!cfg.gistId) return null;
  const res = await ghFetch(API+'/gists/'+cfg.gistId);
  const data = await res.json();
  const f = data.files && data.files[FILE];
  if(!f) return null;
  let content = f.content;
  if(f.truncated && f.raw_url){ content = await (await fetch(f.raw_url)).text(); }
  try{ return JSON.parse(content); }catch(e){ return null; }
}

function applyRemote(payload){
  if(!payload || payload._fmt!=='cambusa-backup') throw new Error('contenuto remoto non valido');
  suppressBump=true;
  RM.store.restore(payload);
  cfg.localUpdatedAt  = payload.updatedAt || Date.now();
  cfg.syncedUpdatedAt = cfg.localUpdatedAt;
  setTimeout(()=>{ suppressBump=false; }, 0);
}

async function pull(){
  const remote = await fetchRemote();
  if(!remote) throw new Error('nessun dato in cloud da scaricare');
  applyRemote(remote);
}

// diagnostica: verifica il token SALVATO SU QUESTO DISPOSITIVO
async function verify(){
  if(!cfg.token) throw new Error('nessun token salvato su questo dispositivo');
  const res = await fetch(API+'/user', {headers:{
    'Authorization':'Bearer '+cfg.token, 'Accept':'application/vnd.github+json', 'X-GitHub-Api-Version':'2022-11-28' }});
  if(res.status===401) throw new Error('401 — il token salvato QUI non è valido. Probabilmente è ancora quello vecchio: reincollalo e premi “Salva token”.');
  if(!res.ok) throw new Error(res.status+' '+res.statusText);
  const u = await res.json();
  const raw = res.headers.get('x-oauth-scopes'); // null se non esposto dal browser
  const scopes = raw==null ? null : raw.split(',').map(s=>s.trim()).filter(Boolean);
  const hasGist = scopes==null ? null : scopes.includes('gist');
  return { login:u.login, scopes, hasGist };
}

function clearToken(){ cfg.token=''; cfg.gistId=''; cfg.localUpdatedAt=0; cfg.syncedUpdatedAt=0; }

// confronto per timestamp: pull se remoto più recente, push se locale più recente
async function syncNow(){
  if(busy) return {skipped:true};
  busy=true; emit('sync');
  try{
    if(!cfg.token) throw new Error('configura prima il token');
    const remote = await fetchRemote();
    if(!remote){ await push(); return {pushed:true, created:true}; }
    const rU = remote.updatedAt||0, lU = cfg.localUpdatedAt||0;
    if(rU>lU){ applyRemote(remote); return {pulled:true}; }
    if(lU>rU){ await push(); return {pushed:true}; }
    cfg.syncedUpdatedAt = rU;
    return {inSync:true};
  } finally { busy=false; emit('idle'); }
}

function scheduleAutoPush(){
  if(!ready || !cfg.auto || !cfg.token) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(()=>{ push().then(()=>emit('idle')).catch(e=>emit('error:'+e.message)); }, 4000);
}

// ogni modifica dei dati aggiorna il timestamp locale e programma un push
RM.onChange(k=>{
  if(suppressBump) return;
  if(k==='__app__' || (RM.store.KEYS && RM.store.KEYS.includes(k))){
    cfg.localUpdatedAt = Date.now();
    scheduleAutoPush();
  }
});

async function init(){
  try{
    if(cfg.auto && cfg.token){
      const r = await syncNow();
      if(r && r.pulled){ location.reload(); return; }
    }
  }catch(e){ emit('error:'+e.message); }
  finally{
    ready=true;
    if(cfg.auto && cfg.token && cfg.localUpdatedAt>cfg.syncedUpdatedAt) scheduleAutoPush();
  }
}

RM.sync = {
  cfg, push, pull, syncNow, verify, clearToken,
  onState: fn => { listeners.add(fn); return ()=>listeners.delete(fn); },
  status(){ return { hasToken:!!cfg.token, gistId:cfg.gistId, auto:cfg.auto,
    localUpdatedAt:cfg.localUpdatedAt, syncedUpdatedAt:cfg.syncedUpdatedAt }; },
};

if(document.readyState!=='loading') setTimeout(init, 400);
else document.addEventListener('DOMContentLoaded', ()=>setTimeout(init, 400));
})();
