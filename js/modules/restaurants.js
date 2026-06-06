(function(){
'use strict';
const RM = window.RM = window.RM || {};
RM.modules = RM.modules || {};
const {el, toast, confirmDialog, openModal, FONTS} = RM.utils;
const {store} = RM;
const {THEMES, ORDER, resolve, initials} = RM.clients;

let off=null;
function mount(root){ render(root); off=RM.onChange(k=>{ if(k==='__app__') render(root); }); }
function unmount(){ off?.(); off=null; }

function render(root){
  const rs = store.getRestaurants();
  const activeId = store.getActiveId();
  root.innerHTML='';
  root.append(
    el('div',{class:'view-head'},[
      el('h1',{},['Ristoranti ', el('span',{class:'count',text:`(${rs.length})`})]),
      el('div',{class:'actions'},[ el('button',{class:'btn btn-primary',text:'+ Aggiungi ristorante',onclick:()=>edit(null)}) ])
    ]),
    el('div',{class:'view-sub',text:'Gestisci più locali da un’unica app — il tuo, il baretto, e altri ancora. Ognuno ha i propri piatti, menù e dati, e soprattutto il proprio stile: logo, palette e font. Scegli quello attivo e l’app (e i menù che esporti) si vestono di conseguenza.'}),
    grid(rs, activeId)
  );
}

function grid(rs, activeId){
  const g = el('div',{class:'rest-grid'});
  for(const r of rs) g.appendChild(card(r, r.id===activeId));
  return g;
}

function card(r, isActive){
  const t = resolve(r);
  const logo = r.logo
    ? el('span',{class:'rest-logo',style:{backgroundImage:`url(${r.logo})`}})
    : el('span',{class:'rest-logo',style:{background:t.accent,color:'#fff',fontFamily:t.fontDisplay},text:initials(r.name)});
  const head = el('div',{class:'rest-card-head'},[
    logo,
    el('div',{class:'grow'},[
      el('div',{class:'rest-name',style:{fontFamily:t.fontDisplay,color:'var(--text)'},text:r.name}),
      el('div',{class:'rest-sub',text:[r.kind,r.place].filter(Boolean).join(' · ')||'—'}),
    ]),
    isActive ? el('span',{class:'badge ok',text:'● Attivo'}) : null,
  ]);
  const swatches = el('div',{class:'rest-swatches'},
    [t.accent,t.ink,t.paper,t.gold,t.muted].map(c=>el('span',{class:'sw',style:{background:c},title:c}))
  );
  const meta = el('div',{class:'rest-card-meta'},[
    el('span',{class:'chip',text:(THEMES[r.themeKey]||THEMES.classico).label}),
    r.custom && Object.keys(r.custom).length ? el('span',{class:'chip',text:'personalizzato'}) : null,
    t.decor==='coast' ? el('span',{class:'chip',text:'decori mare'}) : null,
  ]);
  const actions = el('div',{class:'rest-card-actions'},[
    isActive
      ? el('button',{class:'btn btn-sm',disabled:true,text:'In uso'})
      : el('button',{class:'btn btn-primary btn-sm',text:'✓ Rendi attivo',onclick:()=>{
          store.setActive(r.id); toast(`Ora stai gestendo “${r.name}”`,'ok');
        }}),
    el('button',{class:'btn btn-sm',text:'✎ Stile e dati',onclick:()=>edit(r.id)}),
    el('div',{class:'spacer'}),
    el('button',{class:'btn btn-sm btn-danger',title:'Elimina ristorante',text:'🗑',onclick:()=>del(r)}),
  ]);
  const c = el('div',{class:'card rest-card'+(isActive?' active':'')});
  c.append(el('div',{class:'rest-card-bar',style:{background:`linear-gradient(135deg, ${t.accent}, ${t.accent2||t.accent})`}}), head, swatches, meta, actions);
  return c;
}

async function del(r){
  const rs = store.getRestaurants();
  if(rs.length<=1){ toast('Deve restare almeno un ristorante','err'); return; }
  if(!await confirmDialog(`Eliminare “${r.name}” e TUTTI i suoi dati (piatti, menù, HACCP, impostazioni)? Operazione irreversibile.`,'Elimina ristorante')) return;
  store.removeRestaurant(r.id);
  toast('Ristorante eliminato','ok');
}

// ---- Editor ristorante (dati anagrafici + stile, con anteprima live) ----
function edit(id){
  const existing = id ? store.getRestaurants().find(r=>r.id===id) : null;
  const draft = existing
    ? {name:existing.name, kind:existing.kind, place:existing.place, logo:existing.logo||'', themeKey:existing.themeKey||'classico', custom:{...(existing.custom||{})}}
    : {name:'', kind:'', place:'', logo:'', themeKey:'classico', custom:{}};

  const eff = f => (draft.custom[f]!=null ? draft.custom[f] : (THEMES[draft.themeKey]||THEMES.classico)[f]);

  // --- campi anagrafici ---
  const fName = el('input',{type:'text',value:draft.name,placeholder:'Es. DaLentini',oninput:e=>{draft.name=e.target.value;paint();}});
  const fKind = el('input',{type:'text',value:draft.kind,placeholder:'Es. Home Restaurant',oninput:e=>{draft.kind=e.target.value;paint();}});
  const fPlace= el('input',{type:'text',value:draft.place,placeholder:'Es. Messina',oninput:e=>{draft.place=e.target.value;paint();}});

  // --- logo ---
  const logoPrev = el('span',{class:'rest-logo lg'});
  const fLogo = el('input',{type:'file',accept:'image/*'});
  fLogo.addEventListener('change',e=>{
    const f=e.target.files?.[0]; if(!f) return;
    const fr=new FileReader(); fr.onload=()=>{ draft.logo=fr.result; paint(); }; fr.readAsDataURL(f);
    fLogo.value='';
  });
  const logoRow = el('div',{class:'row',style:{gap:'10px',alignItems:'center'}},[
    logoPrev,
    el('label',{class:'btn btn-sm',text:'Carica logo'},[fLogo]),
    el('button',{class:'btn btn-ghost btn-sm',text:'Rimuovi',onclick:()=>{draft.logo='';paint();}}),
  ]);

  // --- preset swatches ---
  const presetRow = el('div',{class:'theme-swatches'});
  function buildPresets(){
    presetRow.innerHTML='';
    for(const key of ORDER){
      const th = THEMES[key];
      const on = draft.themeKey===key && !Object.keys(draft.custom).length;
      const btn = el('button',{class:'theme-swatch'+(on?' on':''),title:th.hint,onclick:()=>{ draft.themeKey=key; draft.custom={}; syncAdvanced(); paint(); }},[
        el('span',{class:'ts-colors'},[th.accent,th.ink,th.paper,th.gold].map(c=>el('i',{style:{background:c}}))),
        el('span',{class:'ts-label',text:th.label}),
      ]);
      presetRow.appendChild(btn);
    }
  }

  // --- avanzate (override) ---
  const cAccent = colorInput('accent'), cInk = colorInput('ink'), cPaper = colorInput('paper'), cGold = colorInput('gold'), cMuted = colorInput('muted');
  const sDisp = fontSelect('fontDisplay'), sBody = fontSelect('fontBody');
  const cDecor = el('input',{type:'checkbox',onchange:e=>{ setCustom('decor', e.target.checked?'coast':'none'); }});
  function colorInput(field){
    const i = el('input',{type:'color',style:{height:'34px',padding:'2px',cursor:'pointer'},oninput:e=>setCustom(field,e.target.value)});
    return i;
  }
  function fontSelect(field){
    const s = el('select',{onchange:e=>setCustom(field,e.target.value)});
    for(const [v,l] of FONTS) s.appendChild(el('option',{value:v,text:l}));
    return s;
  }
  function setCustom(field, val){ draft.custom[field]=val; paint(); }
  function syncAdvanced(){
    cAccent.value = toHex(eff('accent')); cInk.value=toHex(eff('ink')); cPaper.value=toHex(eff('paper'));
    cGold.value=toHex(eff('gold')); cMuted.value=toHex(eff('muted'));
    sDisp.value=eff('fontDisplay'); sBody.value=eff('fontBody');
    cDecor.checked = eff('decor')==='coast';
  }

  const advanced = el('details',{class:'rest-advanced'},[
    el('summary',{text:'Personalizza colori e font'}),
    el('div',{class:'grid-3',style:{marginTop:'10px'}},[
      field('Accento (brand)', cAccent), field('Testo', cInk), field('Carta (sfondo)', cPaper),
    ]),
    el('div',{class:'grid-3'},[
      field('Accento foglio', cGold), field('Testo secondario', cMuted),
      el('label',{class:'row',style:{gap:'6px',fontSize:'12px',color:'var(--text-2)',alignItems:'center',marginTop:'22px'}},[cDecor,'Decori “mare/agrumi”']),
    ]),
    el('div',{class:'grid-2'},[
      field('Font titoli', sDisp), field('Font corpo', sBody),
    ]),
  ]);

  // --- anteprima live ---
  const preview = el('div',{class:'rest-preview-wrap'});
  function paint(){
    buildPresets();
    // logo preview
    if(draft.logo){ logoPrev.style.backgroundImage=`url(${draft.logo})`; logoPrev.textContent=''; logoPrev.style.background=''; }
    else { logoPrev.style.backgroundImage=''; logoPrev.style.background=eff('accent'); logoPrev.style.color='#fff'; logoPrev.style.fontFamily=eff('fontDisplay'); logoPrev.textContent=initials(draft.name||'?'); }
    preview.innerHTML=''; preview.appendChild(previewSheet());
  }
  function previewSheet(){
    const ink=eff('ink'), paper=eff('paper'), gold=eff('gold'), muted=eff('muted');
    const disp=eff('fontDisplay'), body=eff('fontBody'), coast=eff('decor')==='coast';
    const sheet = el('div',{class:'rest-preview',style:{background:paper,color:ink,fontFamily:body}});
    sheet.append(
      el('div',{class:'rp-name',style:{fontFamily:disp,color:ink,textTransform:coast?'uppercase':'none',letterSpacing:coast?'.02em':'normal'},text:draft.name||'Nome del locale'}),
      el('div',{class:'rp-stamp',style:{color:muted},text:[draft.kind,draft.place].filter(Boolean).join(' · ')||'Tipologia · Città'}),
      el('div',{class:'rp-rule',style:{background:gold}}),
      el('div',{class:'rp-cat',style:{fontFamily:disp,color:ink,textTransform:coast?'uppercase':'none'},text:'Antipasti'}),
      dishRow('Tartare di gambero','agrumi, pane croccante','12,00 €',{ink,muted,gold,body,coast}),
      dishRow('Spaghettoni','pomodoro confit, basilico','10,50 €',{ink,muted,gold,body,coast}),
    );
    return sheet;
  }
  function dishRow(name, desc, price, c){
    return el('div',{class:'rp-dish'},[
      el('div',{class:'rp-dish-head'},[
        el('span',{style:{fontWeight:'600',color:c.ink},text:name}),
        c.coast
          ? el('span',{style:{color:c.gold,fontWeight:'600'}},[el('i',{style:{color:c.muted,fontStyle:'normal',marginRight:'4px'},text:'|'}), price])
          : el('span',{style:{color:c.gold,fontWeight:'600'},text:price}),
      ]),
      el('div',{class:'rp-dish-desc',style:{color:c.muted},text:desc}),
    ]);
  }

  syncAdvanced(); paint();

  const body = el('div',{class:'rest-editor grid-2'},[
    el('div',{class:'col'},[
      el('div',{class:'grid-2'},[ field('Nome del locale *', fName), field('Tipologia', fKind) ]),
      field('Città', fPlace),
      field('Logo', logoRow),
      el('hr',{class:'sep'}),
      el('label',{class:'lbl',text:'Stile'}),
      presetRow,
      advanced,
    ]),
    el('div',{class:'col'},[
      el('label',{class:'lbl',text:'Anteprima'}),
      preview,
      el('p',{class:'muted',style:{fontSize:'11.5px',marginTop:'8px'},text:'L’anteprima mostra come appariranno i menù di questo locale. Lo stile si applica anche alla chrome dell’app quando il ristorante è attivo.'}),
    ]),
  ]);

  const {close} = openModal({
    large:true,
    title: id ? 'Modifica ristorante' : 'Nuovo ristorante',
    body,
    footer:[
      el('button',{class:'btn',text:'Annulla',onclick:()=>close()}),
      el('button',{class:'btn btn-primary',text:id?'Salva':'Crea ristorante',onclick:()=>{
        if(!draft.name.trim()){ toast('Il nome è obbligatorio','err'); return; }
        // pulizia override ridondanti (uguali al preset)
        const base = THEMES[draft.themeKey]||THEMES.classico;
        for(const k of Object.keys(draft.custom)) if(draft.custom[k]===base[k]) delete draft.custom[k];
        const payload = {name:draft.name.trim(), kind:draft.kind.trim(), place:draft.place.trim(), logo:draft.logo, themeKey:draft.themeKey, custom:draft.custom};
        if(id) store.updateRestaurant(id, payload);
        else store.addRestaurant(payload);
        toast(id?'Ristorante aggiornato':'Ristorante creato','ok');
        close();
      }}),
    ]
  });
}

function field(label, node){ return el('div',{class:'field',style:{marginBottom:'10px'}},[el('label',{text:label}), node]); }
function toHex(c){
  if(typeof c!=='string') return '#000000';
  if(/^#[0-9a-f]{6}$/i.test(c)) return c;
  if(/^#[0-9a-f]{3}$/i.test(c)) return '#'+c.slice(1).split('').map(x=>x+x).join('');
  return '#000000';
}

RM.modules.ristoranti = {mount, unmount};
})();
