(function(){
'use strict';
const RM = window.RM = window.RM || {};

const uid = (p='id') => p+'_'+Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-3);

const fmtEur = (n,d=2)=>{
  if(n==null||isNaN(n))return '—';
  return new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',minimumFractionDigits:d,maximumFractionDigits:d}).format(n);
};
const fmtNum = (n,d=2)=>{
  if(n==null||isNaN(n))return '—';
  return new Intl.NumberFormat('it-IT',{minimumFractionDigits:d,maximumFractionDigits:d}).format(n);
};
const fmtPct = (n,d=1)=>n==null||isNaN(n)?'—':fmtNum(n,d)+' %';
const fmtDate = d=>{
  if(!d)return '—';
  const dt = d instanceof Date ? d : new Date(d);
  if(isNaN(dt))return '—';
  return dt.toLocaleDateString('it-IT',{day:'2-digit',month:'2-digit',year:'numeric'});
};

const slug = s => (s||'').toString().normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

const debounce = (fn,ms=200)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};};

const escapeHtml = s => (s==null?'':String(s)).replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const el = (tag, attrs={}, children=[])=>{
  const e = document.createElement(tag);
  for(const k in attrs){
    const v = attrs[k];
    if(v==null||v===false)continue;
    if(k==='class')e.className=v;
    else if(k==='html')e.innerHTML=v;
    else if(k==='text')e.textContent=v;
    else if(k.startsWith('on')&&typeof v==='function')e.addEventListener(k.slice(2).toLowerCase(),v);
    else if(k==='style'&&typeof v==='object')Object.assign(e.style,v);
    else if(k in e && typeof e[k]!=='object')e[k]=v;
    else e.setAttribute(k,v);
  }
  if(!Array.isArray(children))children=[children];
  for(const c of children){
    if(c==null||c===false)continue;
    e.appendChild(c.nodeType?c:document.createTextNode(c));
  }
  return e;
};

const $  = (sel,root=document)=>root.querySelector(sel);
const $$ = (sel,root=document)=>[...root.querySelectorAll(sel)];

const UNITA = ['kg','g','L','ml','pz'];
const toBase = (qty, unita)=>{
  switch(unita){
    case 'kg': return qty*1000;
    case 'g':  return qty;
    case 'L':  return qty*1000;
    case 'ml': return qty;
    case 'pz': return qty;
    default:   return qty;
  }
};
const pricePerBase = (price, unita)=>{
  switch(unita){
    case 'kg': case 'g':  return price/1000;
    case 'L':  case 'ml': return price/1000;
    case 'pz':            return price;
    default:              return price;
  }
};
const baseUnitLabel = unita => unita==='kg'?'g':unita==='L'?'ml':unita;

const ALLERGENI = [
  'glutine','crostacei','uova','pesce','arachidi','soia','latticini',
  'frutta a guscio','sedano','senape','sesamo','solfiti','lupini','molluschi'
];
const CATEGORIE_PIATTI = ['Piazzetta','Salse','Buns','Crostoni','Sfizi','Insalatine','Piatti','Signature'];
const CATEGORIE_INGR  = ['verdura','ortaggi','frutta','frutta secca','carne','pesce','latticini','salumi','uova','farinacei','legumi','riso e cereali','secco e polveri','oli','aceti','condimenti','conserve','bevande','spezie','dolci','altro'];

// HACCP — simboli normativi (ISO 5807 + HACCP standard)
const HACCP_TIPI = [
  {id:'inizio',     label:'Inizio',          forma:'terminatore', color:'#176b3a'},
  {id:'ricevimento',label:'Ricevimento',     forma:'parallelogramma', color:'#2563eb'},
  {id:'stoccaggio', label:'Stoccaggio',      forma:'cilindro', color:'#2563eb'},
  {id:'processo',   label:'Processo',        forma:'rettangolo', color:'#191918'},
  {id:'manuale',    label:'Operaz. manuale', forma:'trapezio', color:'#191918'},
  {id:'decisione',  label:'Decisione',       forma:'rombo', color:'#b25e09'},
  {id:'ccp',        label:'CCP (Punto Critico di Controllo)', forma:'rombo', color:'#b3261e'},
  {id:'cp',         label:'CP (Punto di Controllo)', forma:'rombo', color:'#b25e09'},
  {id:'output',     label:'Uscita',          forma:'parallelogramma', color:'#2563eb'},
  {id:'fine',       label:'Fine',            forma:'terminatore', color:'#176b3a'},
];

const toast = (msg,kind='')=>{
  const r = document.getElementById('toast');
  if(!r)return;
  const t = el('div',{class:'toast '+kind,text:msg});
  r.appendChild(t);
  requestAnimationFrame(()=>t.classList.add('show'));
  setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),250);},2400);
};

const confirmDialog = (msg, okLabel='Conferma')=>new Promise(res=>{
  const root = document.getElementById('modal-root');
  const close = v => {root.innerHTML='';res(v);};
  const bg = el('div',{class:'modal-bg',onclick:e=>{if(e.target===bg)close(false);}});
  const m = el('div',{class:'modal',style:{maxWidth:'420px'}},[
    el('div',{class:'modal-head'},[el('h2',{text:'Conferma'})]),
    el('div',{class:'modal-body'},[el('p',{text:msg})]),
    el('div',{class:'modal-foot'},[
      el('button',{class:'btn',text:'Annulla',onclick:()=>close(false)}),
      el('button',{class:'btn btn-primary',text:okLabel,onclick:()=>close(true)}),
    ]),
  ]);
  bg.appendChild(m); root.appendChild(bg);
});

const openModal = ({title, body, footer, large=false})=>{
  const root = document.getElementById('modal-root');
  const close = ()=>{root.innerHTML='';};
  const bg = el('div',{class:'modal-bg',onclick:e=>{if(e.target===bg)close();}});
  const m = el('div',{class:'modal '+(large?'modal-lg':'')},[
    el('div',{class:'modal-head'},[
      el('h2',{text:title}),
      el('button',{class:'btn btn-ghost btn-icon',html:'&times;',onclick:close,title:'Chiudi'})
    ]),
    el('div',{class:'modal-body'},body instanceof Node?[body]:body),
    footer && el('div',{class:'modal-foot'}, Array.isArray(footer)?footer:[footer]),
  ]);
  bg.appendChild(m); root.appendChild(bg);
  return {close, modal:m};
};

const downloadBlob = (blob, filename)=>{
  const url = URL.createObjectURL(blob);
  const a = el('a',{href:url,download:filename});
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
};

const csvToArr = s => !s ? [] : String(s).split(',').map(x=>x.trim()).filter(Boolean);
const arrToCsv = a => Array.isArray(a) ? a.join(', ') : '';

// Trasformazione maiuscole/minuscole testo (per i campi del canvas)
function applyCase(str, mode){
  str = str==null ? '' : String(str);
  switch(mode){
    case 'upper':    return str.toUpperCase();
    case 'lower':    return str.toLowerCase();
    case 'caps':     return str.toLowerCase().replace(/(^|\s)([a-zà-ù])/g,(m,a,b)=>a+b.toUpperCase());
    case 'sentence': return str.toLowerCase().replace(/^(\s*)([a-zà-ù])/,(m,a,b)=>a+b.toUpperCase());
    default:         return str;
  }
}
// Quantità leggibile: 1000g→1kg, 1500ml→1,5L, ecc.
function formatQty(q, unita){
  q = Number(q)||0;
  if(unita==='pz') return q+' pz';
  const liquid = unita==='L' || unita==='ml';
  if(q>=1000){ const v=Math.round((q/1000)*100)/100; return String(v).replace('.',',')+(liquid?'L':'kg'); }
  return q+(liquid?'ml':'g');
}
// Font disponibili nell'editor (label → famiglia CSS); il PDF mappa su helvetica/times/courier
const FONTS = [
  ['Poppins, sans-serif','Poppins'],
  ['Inter, sans-serif','Inter'],
  ['Quicksand, sans-serif','Quicksand'],
  ['Playfair Display, serif','Playfair'],
  ['Georgia, serif','Georgia'],
  ['Courier, monospace','Monospace'],
];

// Theme management
const THEME_KEY = 'rm:theme';
function getTheme(){ try{return localStorage.getItem(THEME_KEY)||'auto';}catch{return 'auto';} }
function setTheme(t){
  try{
    if(t==='auto') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, t);
  }catch{}
  if(t==='auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  document.dispatchEvent(new CustomEvent('rm:theme', {detail:{theme:t}}));
}
function effectiveTheme(){
  const t = getTheme();
  if(t!=='auto') return t;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

RM.utils = {uid,fmtEur,fmtNum,fmtPct,fmtDate,slug,debounce,escapeHtml,el,$,$$,
  UNITA,toBase,pricePerBase,baseUnitLabel,ALLERGENI,CATEGORIE_PIATTI,CATEGORIE_INGR,HACCP_TIPI,
  toast,confirmDialog,openModal,downloadBlob,csvToArr,arrToCsv,applyCase,formatQty,FONTS,
  getTheme,setTheme,effectiveTheme};
})();
