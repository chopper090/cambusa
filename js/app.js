(function(){
'use strict';
const RM = window.RM = window.RM || {};
const {$, $$} = RM.utils;
const {store} = RM;

let current = null;

function mount(name){
  const view = $('#view');
  if(current && current.unmount) try{current.unmount();}catch{}
  view.innerHTML = '';
  const mod = RM.modules[name] || RM.modules.dashboard;
  if(!mod){
    view.innerHTML = `<div class="card"><h2>Modulo non trovato</h2><p class="muted">${name}</p></div>`;
    return;
  }
  current = mod;
  $$('#sidebar a[data-route]').forEach(a=>a.classList.toggle('active', a.dataset.route===name));
  try{ mod.mount(view); }
  catch(e){
    console.error(e);
    view.innerHTML = `<div class="card"><h2>Errore</h2><p class="muted">${e.message}</p></div>`;
  }
}

function currentRoute(){
  const raw = location.hash.replace(/^#/,'').trim() || 'dashboard';
  return raw.split('?')[0]; // ignora query string
}
window.addEventListener('hashchange', ()=>mount(currentRoute()));

// Excel I/O wiring
$('#btn-export-xlsx').addEventListener('click', ()=>RM.excel.exportWorkbook());
$('#file-import-xlsx').addEventListener('change', (e)=>{
  const f = e.target.files?.[0]; if(!f) return;
  RM.excel.importWorkbook(f);
  e.target.value = '';
});

// theme toggle wiring
function refreshThemeButtons(){
  const cur = RM.utils.getTheme();
  $$('#sidebar [data-theme-set]').forEach(b=>b.classList.toggle('on', b.dataset.themeSet===cur));
}
$$('#sidebar [data-theme-set]').forEach(b=>{
  b.addEventListener('click', ()=>{ RM.utils.setTheme(b.dataset.themeSet); refreshThemeButtons(); });
});
refreshThemeButtons();
// quando il sistema cambia preferenza in modalità auto
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', ()=>{
  // no-op: il CSS @media gestisce il caso "data-theme assente"
});

// ===== Ristorante attivo: skin + switcher in sidebar =====
function paintActive(){
  const r = store.getActive();
  if(!r) return;
  RM.clients.apply(r);
  const nameEl = $('#brand-name'); if(nameEl) nameEl.textContent = r.name || 'Cambusa';
  const kindEl = $('#brand-kind'); if(kindEl) kindEl.textContent = [r.kind, r.place].filter(Boolean).join(' · ');
  const logoEl = $('#brand-logo');
  if(logoEl){
    if(r.logo){
      logoEl.textContent = '';
      logoEl.style.backgroundImage = `url(${r.logo})`;
      logoEl.classList.add('has-img');
    } else {
      logoEl.style.backgroundImage = '';
      logoEl.classList.remove('has-img');
      logoEl.textContent = RM.clients.initials(r.name);
    }
  }
  buildSwitch();
}
function buildSwitch(){
  const sel = $('#rest-switch'); if(!sel) return;
  const rs = store.getRestaurants(), act = store.getActiveId();
  sel.innerHTML = '';
  for(const r of rs){
    const o = document.createElement('option');
    o.value = r.id; o.textContent = r.name; o.selected = r.id===act;
    sel.appendChild(o);
  }
}
const switchEl = $('#rest-switch');
if(switchEl){
  switchEl.addEventListener('change', e=>{
    if(store.setActive(e.target.value)){
      const cur = currentRoute();
      // l'editor menù è legato a un id specifico: torna alla lista evitando stati incoerenti
      if(cur==='menu-editor' || cur==='ricettario-editor') location.hash = '#dashboard';
      else mount(cur);
    }
  });
}
// re-skin + aggiorna switcher quando cambia il registro/ristorante attivo
RM.onChange(k=>{ if(k==='__app__') paintActive(); });
paintActive();

// versione in sidebar
const verEl = $('#app-version');
if(verEl) verEl.textContent = 'v' + (RM.VERSION||'?') + (RM.CHANNEL && RM.CHANNEL!=='stable' ? ' · '+RM.CHANNEL : '');

// install PWA (beforeinstallprompt)
let deferredPrompt = null;
const installBtn = $('#btn-install');
window.addEventListener('beforeinstallprompt', (e)=>{
  e.preventDefault(); deferredPrompt = e;
  if(installBtn) installBtn.style.display = '';
});
if(installBtn){
  installBtn.addEventListener('click', async ()=>{
    if(!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.style.display = 'none';
  });
}
window.addEventListener('appinstalled', ()=>{ if(installBtn) installBtn.style.display='none'; });

mount(currentRoute());
})();
