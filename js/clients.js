(function(){
'use strict';
// ============================================================================
// clients.js — registro stili "vestito" per i ristoranti (multi-cliente).
// Ogni ristorante ha un tema (palette + font + decori) che ri-veste la chrome
// dell'app e alimenta i default dell'editor menù. Caricato PRIMA di store.js.
// ============================================================================
const RM = window.RM = window.RM || {};

// Preset di stile. Ogni voce mappa i ruoli semantici del foglio menù:
//  accent/accent2 → colore brand (chrome + accenti)
//  ink            → testo principale del foglio
//  paper          → sfondo carta del foglio
//  gold           → accento del foglio (divisori, prezzi)
//  muted          → testo secondario
//  fontDisplay    → titoli / nomi voci
//  fontBody       → corpo / descrizioni
//  decor          → 'none' | 'coast' (onde/agrumi stile bar)
const THEMES = {
  classico: {
    label:'Classico', hint:'Elegante, terracotta — il default',
    accent:'#b25e09', accent2:'#ce7822',
    ink:'#191918', paper:'#ffffff', gold:'#b25e09', muted:'#737373',
    fontDisplay:'Playfair Display, serif', fontBody:'Inter, sans-serif',
    decor:'none', fontUrl:null,
  },
  baretto: {
    label:'il baretto', hint:'Cocktail bar — navy, azzurro, arancio',
    accent:'#F2972E', accent2:'#f0b760',
    ink:'#21477F', paper:'#EAF3FB', gold:'#F2972E', muted:'#5E7CA6',
    fontDisplay:'Bebas Neue, Impact, sans-serif', fontBody:'Jost, system-ui, sans-serif',
    decor:'coast', fontUrl:null,
  },
  elegante: {
    label:'Elegante', hint:'Fine dining — blu notte e oro',
    accent:'#9a7b32', accent2:'#b8983f',
    ink:'#1b2438', paper:'#fbfaf6', gold:'#9a7b32', muted:'#6b7286',
    fontDisplay:'Playfair Display, serif', fontBody:'Inter, sans-serif',
    decor:'none', fontUrl:null,
  },
  mediterraneo: {
    label:'Mediterraneo', hint:'Trattoria — verde oliva e creta',
    accent:'#5e7a3a', accent2:'#7a9850',
    ink:'#2c3320', paper:'#faf7ef', gold:'#a8632a', muted:'#79795f',
    fontDisplay:'Playfair Display, serif', fontBody:'Inter, sans-serif',
    decor:'none', fontUrl:null,
  },
  minimal: {
    label:'Minimal', hint:'Bistrot — bianco e nero, Oswald',
    accent:'#1a1a1a', accent2:'#444444',
    ink:'#111111', paper:'#ffffff', gold:'#1a1a1a', muted:'#8a8a8a',
    fontDisplay:'Oswald, sans-serif', fontBody:'Inter, sans-serif',
    decor:'none', fontUrl:null,
  },
  custom: {
    label:'Personalizzato', hint:'Parti da una base e personalizza tutto',
    accent:'#b25e09', accent2:'#ce7822',
    ink:'#191918', paper:'#ffffff', gold:'#b25e09', muted:'#737373',
    fontDisplay:'Playfair Display, serif', fontBody:'Inter, sans-serif',
    decor:'none', fontUrl:null,
  },
};

const ORDER = ['classico','baretto','elegante','mediterraneo','minimal','custom'];

// Risolve i token di un ristorante = preset base + override personalizzati.
function resolve(rest){
  const base = THEMES[(rest && rest.themeKey) || 'classico'] || THEMES.classico;
  const custom = (rest && rest.custom) || {};
  return Object.assign({}, base, custom);
}

// inietta un font cliente (per temi con fontUrl personalizzato). Idempotente.
function applyFonts(url){
  const id = 'client-fonts';
  let link = document.getElementById(id);
  if(!url){ if(link) link.remove(); return; }
  if(!link){ link = document.createElement('link'); link.id=id; link.rel='stylesheet'; document.head.appendChild(link); }
  if(link.href !== url) link.href = url;
}

// Applica il "vestito" del ristorante alla chrome dell'app (variabili CSS su :root).
function apply(rest){
  const t = resolve(rest);
  const root = document.documentElement;
  const themeKey = (rest && rest.themeKey) || 'classico';
  const hasCustomAccent = !!(rest && rest.custom && rest.custom.accent);

  // Per il tema di default lasciamo che theme.css governi l'accento (chiaro/scuro).
  if(themeKey === 'classico' && !hasCustomAccent){
    root.style.removeProperty('--accent');
    root.style.removeProperty('--accent-2');
    root.style.removeProperty('--accent-soft');
  } else {
    root.style.setProperty('--accent', t.accent);
    root.style.setProperty('--accent-2', t.accent2 || t.accent);
    root.style.setProperty('--accent-soft', `color-mix(in srgb, ${t.accent} 16%, transparent)`);
  }

  // Token del foglio menù (consumati dall'editor e dall'anteprima).
  root.style.setProperty('--rest-ink', t.ink);
  root.style.setProperty('--rest-paper', t.paper);
  root.style.setProperty('--rest-gold', t.gold);
  root.style.setProperty('--rest-muted', t.muted);
  root.style.setProperty('--rest-font-display', t.fontDisplay);
  root.style.setProperty('--rest-font-body', t.fontBody);
  root.setAttribute('data-client', themeKey);
  applyFonts(t.fontUrl);
}

// Iniziali per il badge logo quando non c'è immagine.
function initials(name){
  const words = String(name||'').trim().split(/\s+/).filter(Boolean);
  if(!words.length) return 'Cb';
  if(words.length === 1) return words[0].slice(0,2).toUpperCase();
  return (words[0][0] + words[words.length-1][0]).toUpperCase();
}

RM.clients = { THEMES, ORDER, resolve, apply, applyFonts, initials };
})();
