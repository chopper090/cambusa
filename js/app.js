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

// header nome locale
const s = store.getSettings();
if(s.nome_locale) $('#brand-name').textContent = s.nome_locale;

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
