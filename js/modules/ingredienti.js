(function(){
'use strict';
const RM = window.RM = window.RM || {};
RM.modules = RM.modules || {};
const {el, toast, confirmDialog, openModal, ALLERGENI, CATEGORIE_INGR, UNITA} = RM.utils;
const {store, onChange} = RM;

let off=null, root=null, q='', filterCat='', filterAlg='';

function mount(r){ root=r; render(); off=onChange(k=>{ if(k==='ingredienti'||k==='fornitori') render(); }); }
function unmount(){ off?.(); off=null; }

function render(){
  const list = store.all('ingredienti');
  const forn = store.all('fornitori');
  const fornMap = new Map(forn.map(f=>[f.id,f]));
  const filtered = list.filter(i=>{
    if(q && !(i.nome||'').toLowerCase().includes(q.toLowerCase())) return false;
    if(filterCat && i.categoria!==filterCat) return false;
    if(filterAlg && !(i.allergeni||[]).includes(filterAlg)) return false;
    return true;
  });
  root.innerHTML = '';
  root.append(
    el('div',{class:'view-head'},[
      el('h1',{},['Ingredienti ', el('span',{class:'muted',style:{fontSize:'14px',fontWeight:'400'},text:`(${list.length})`})]),
      el('div',{class:'actions'},[
        el('div',{class:'search'},[ el('input',{type:'text',placeholder:'Cerca ingrediente…',value:q,oninput:e=>{q=e.target.value;render();}}) ]),
        el('button',{class:'btn',text:'📖 Catalogo base',title:'Importa dagli ingredienti base con prezzo GDO stimato',onclick:()=>catalogo()}),
        el('button',{class:'btn btn-primary',text:'+ Nuovo ingrediente',onclick:()=>edit(null)}),
      ])
    ]),
    el('div',{class:'view-sub'},['Doppio prezzo: ', el('b',{text:'sicuro'}), ' = il tuo fornitore, ', el('b',{text:'medio'}), ' = stima nazionale supermercato.']),
    filterBar(),
    list.length===0
      ? el('div',{class:'tbl-wrap'},[ el('div',{class:'tbl-empty'},[
          el('h3',{text:'Nessun ingrediente'}),
          el('p',{class:'muted',text:'Aggiungi ingredienti qui o creali al volo quando inserisci un piatto.'}),
          el('div',{style:{marginTop:'12px'}},[ el('button',{class:'btn btn-primary',text:'+ Nuovo ingrediente',onclick:()=>edit(null)}) ])
        ])])
      : table(filtered, fornMap)
  );
}

function filterBar(){
  const wrap = el('div',{class:'row wrap',style:{marginBottom:'12px'}});
  const cat = el('select',{onchange:e=>{filterCat=e.target.value;render();},style:{maxWidth:'180px'}});
  cat.appendChild(el('option',{value:'',text:'Tutte le categorie'}));
  for(const c of CATEGORIE_INGR) cat.appendChild(el('option',{value:c,text:c,selected:filterCat===c}));
  const alg = el('select',{onchange:e=>{filterAlg=e.target.value;render();},style:{maxWidth:'180px'}});
  alg.appendChild(el('option',{value:'',text:'Tutti gli allergeni'}));
  for(const a of ALLERGENI) alg.appendChild(el('option',{value:a,text:a,selected:filterAlg===a}));
  wrap.append(cat, alg);
  if(filterCat||filterAlg||q) wrap.appendChild(el('button',{class:'btn btn-ghost btn-sm',text:'azzera filtri',onclick:()=>{q='';filterCat='';filterAlg='';render();}}));
  return wrap;
}

function table(list, fornMap){
  const {fmtEur} = RM.utils;
  const tb = el('div',{class:'tbl-wrap'});
  const t = el('table',{class:'tbl'});
  t.appendChild(el('thead',{},[ el('tr',{},[
    el('th',{text:'Nome'}), el('th',{text:'Categoria'}), el('th',{text:'Unità'}),
    el('th',{class:'num',text:'€ sicuro'}), el('th',{class:'num',text:'€ medio'}),
    el('th',{text:'Fornitore'}), el('th',{text:'Allergeni'}), el('th',{class:'actions'}),
  ])]));
  const tbody = el('tbody');
  for(const i of list){
    const algs = (i.allergeni||[]).map(a=>el('span',{class:'badge',text:a}));
    const row = el('tr',{},[
      el('td',{},[ el('div',{},[ el('b',{text:i.nome||'—'}), i.note?el('div',{class:'muted',style:{fontSize:'12px'},text:i.note}):null ]) ]),
      el('td',{},[ i.categoria? el('span',{class:'chip',text:i.categoria}) : el('span',{class:'muted',text:'—'}) ]),
      el('td',{text:i.unita||'—'}),
      el('td',{class:'num',text:fmtEur(i.prezzo_sicuro)}),
      el('td',{class:'num muted',text:fmtEur(i.prezzo_medio)}),
      el('td',{},[ i.fornitore_id && fornMap.get(i.fornitore_id) ? el('span',{class:'chip',text:fornMap.get(i.fornitore_id).nome}) : el('span',{class:'muted',text:'—'}) ]),
      el('td',{},[ el('div',{class:'chips'}, algs.length?algs:[el('span',{class:'muted',text:'—'})]) ]),
      el('td',{class:'actions'},[
        el('button',{class:'btn btn-sm',text:'Modifica',onclick:()=>edit(i.id)}),
        el('button',{class:'btn btn-sm btn-danger',text:'Elimina',onclick:()=>del(i)}),
      ])
    ]);
    tbody.appendChild(row);
  }
  t.appendChild(tbody);
  tb.appendChild(t);
  return tb;
}

async function del(i){
  if(!await confirmDialog(`Eliminare l'ingrediente "${i.nome}"?`,'Elimina')) return;
  store.remove('ingredienti', i.id);
  toast('Ingrediente eliminato','ok');
}

function edit(id, prefill={}){
  const data = id ? {...store.get('ingredienti', id)} : {nome:'',categoria:'',unita:'kg',prezzo_sicuro:0,prezzo_medio:0,fornitore_id:'',allergeni:[],note:'',...prefill};
  const forn = store.all('fornitori');

  const fNome = el('input',{type:'text',value:data.nome||'',placeholder:'Es. Pomodoro San Marzano',autocomplete:'off'});
  const acList = el('div',{class:'autocomplete-list',style:{display:'none'}});
  const acWrap = el('div',{class:'autocomplete'},[fNome, acList]);
  let acItems=[], acActive=-1;
  function renderAc(items, query){
    acItems = items;
    acList.innerHTML='';
    if(!items.length){ acList.style.display='none'; return; }
    items.forEach((it,i)=>{
      const re = new RegExp('('+query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','ig');
      const name = it.nome.replace(re,'<mark>$1</mark>');
      acList.appendChild(el('div',{
        class:'autocomplete-item'+(i===acActive?' active':''),
        html:`<span style="flex:1">${name}</span><span class="meta">${RM.utils.fmtEur(it.prezzo_medio)}/${it.unita} · ${it.categoria}</span>`,
        onclick:()=>applyAc(it),
      }));
    });
    acList.style.display='';
  }
  function applyAc(it){
    fNome.value = it.nome;
    fCat.value = it.categoria; fUni.value = it.unita;
    if(!parseFloat(fPm.value)) fPm.value = it.prezzo_medio.toFixed(2);
    if(!parseFloat(fPs.value)) fPs.value = (it.prezzo_medio*0.85).toFixed(2); // suggerimento iniziale fornitore = -15%
    algState.clear(); for(const a of it.allergeni) algState.add(a); redrawAlg();
    acList.style.display='none'; acActive=-1;
  }
  fNome.addEventListener('input',()=>{
    const v = fNome.value.trim();
    if(v.length<2){ acList.style.display='none'; return; }
    renderAc(RM.kbPrezzi.search(v, 6), v);
    acActive=-1;
  });
  fNome.addEventListener('keydown', e=>{
    if(acList.style.display==='none' || !acItems.length) return;
    if(e.key==='ArrowDown'){ e.preventDefault(); acActive=(acActive+1)%acItems.length; renderAc(acItems, fNome.value.trim()); }
    else if(e.key==='ArrowUp'){ e.preventDefault(); acActive=(acActive-1+acItems.length)%acItems.length; renderAc(acItems, fNome.value.trim()); }
    else if(e.key==='Enter' && acActive>=0){ e.preventDefault(); applyAc(acItems[acActive]); }
    else if(e.key==='Escape'){ acList.style.display='none'; }
  });
  fNome.addEventListener('blur',()=>setTimeout(()=>acList.style.display='none', 200));
  const fCat  = el('select');
  fCat.appendChild(el('option',{value:'',text:'— categoria —'}));
  for(const c of CATEGORIE_INGR) fCat.appendChild(el('option',{value:c,text:c,selected:data.categoria===c}));
  const fUni  = el('select');
  for(const u of UNITA) fUni.appendChild(el('option',{value:u,text:u,selected:data.unita===u}));
  const fPs   = el('input',{type:'number',step:'0.01',min:'0',value:data.prezzo_sicuro??0});
  const fPm   = el('input',{type:'number',step:'0.01',min:'0',value:data.prezzo_medio??0});
  const fForn = el('select');
  fForn.appendChild(el('option',{value:'',text:'— nessuno —'}));
  for(const f of forn) fForn.appendChild(el('option',{value:f.id,text:f.nome,selected:data.fornitore_id===f.id}));
  const fNote = el('textarea',{value:data.note||'',placeholder:'Note (resa, calibro, stagionalità…)'});

  const algState = new Set(data.allergeni||[]);
  const fAlg = el('div',{class:'chips'});
  const redrawAlg = ()=>{
    fAlg.innerHTML='';
    for(const a of ALLERGENI){
      const on = algState.has(a);
      fAlg.appendChild(el('button',{
        type:'button', class:'badge '+(on?'acc':''),
        style:{cursor:'pointer',border:on?'none':'1px solid var(--border-2)',background:on?'var(--accent-soft)':'var(--bg)',color:on?'var(--accent)':'var(--text-2)'},
        text:a,
        onclick:()=>{ if(algState.has(a))algState.delete(a); else algState.add(a); redrawAlg(); }
      }));
    }
  };
  redrawAlg();

  const body = el('div',{},[
    el('div',{class:'grid-2'},[
      el('div',{class:'field'},[ el('label',{text:'Nome *'}), acWrap,
        el('span',{class:'hint',text:`Inizia a digitare: cerco fra ${RM.kbPrezzi.count} ingredienti comuni e compilo categoria, unità e prezzo medio.`}) ]),
      el('div',{class:'field'},[ el('label',{text:'Categoria'}), fCat ]),
    ]),
    el('div',{class:'grid-3'},[
      el('div',{class:'field'},[ el('label',{text:'Unità di misura'}), fUni,
        el('span',{class:'hint',text:'Il prezzo è per €/kg, €/L o €/pz.'}) ]),
      el('div',{class:'field'},[ el('label',{text:'€ sicuro (fornitore)'}), fPs ]),
      el('div',{class:'field'},[ el('label',{text:'€ medio (stima nazionale)'}), fPm ]),
    ]),
    el('div',{class:'field'},[ el('label',{text:'Fornitore'}), fForn ]),
    el('div',{class:'field'},[ el('label',{text:'Allergeni'}), fAlg ]),
    el('div',{class:'field'},[ el('label',{text:'Note'}), fNote ]),
  ]);

  const {close} = openModal({
    title: id?'Modifica ingrediente':'Nuovo ingrediente', body,
    footer:[
      el('button',{class:'btn',text:'Annulla',onclick:()=>close()}),
      el('button',{class:'btn btn-primary',text:'Salva',onclick:()=>{
        const item = {
          ...(data.id?{id:data.id}:{}),
          nome: fNome.value.trim(), categoria: fCat.value, unita: fUni.value,
          prezzo_sicuro: parseFloat(fPs.value)||0, prezzo_medio: parseFloat(fPm.value)||0,
          fornitore_id: fForn.value||'', allergeni: [...algState], note: fNote.value.trim(),
        };
        if(!item.nome){ toast('Nome obbligatorio','err'); return; }
        store.upsert('ingredienti', item);
        toast('Ingrediente salvato','ok');
        close();
      }})
    ]
  });
}

// API per creare al volo da altre viste (con auto-fill dalla knowledge base)
function createQuick(nome, opts={}){
  if(!nome) return null;
  const cur = store.all('ingredienti');
  const existing = cur.find(i=>i.nome.toLowerCase()===nome.toLowerCase());
  if(existing) return existing;
  // se l'utente non ha specificato prezzo/unità, prova a recuperarli dalla KB
  const kb = RM.kbPrezzi?.exactMatch?.(nome) || RM.kbPrezzi?.search?.(nome,1)?.[0];
  const merged = {
    nome,
    categoria: opts.categoria || kb?.categoria || '',
    unita:     opts.unita     || kb?.unita     || 'kg',
    prezzo_sicuro: opts.prezzo_sicuro || (kb? +(kb.prezzo_medio*0.85).toFixed(2) : 0),
    prezzo_medio:  opts.prezzo_medio  || kb?.prezzo_medio || 0,
    fornitore_id:'',
    allergeni: opts.allergeni && opts.allergeni.length ? opts.allergeni : (kb?.allergeni||[]),
    note: opts.note || (kb? '(prezzo stima KB — da verificare con fornitore)' : '(da completare)'),
  };
  return store.upsert('ingredienti', merged);
}

// === Catalogo ingredienti base (KB) con import multiplo ===
function catalogo(){
  const byCat = RM.kbPrezzi.byCategory();
  const have = new Set(store.all('ingredienti').map(i=>(i.nome||'').toLowerCase()));
  const sel = new Set();
  let cq = '';

  const counter = el('span',{class:'muted',style:{fontSize:'12px'}});
  const grid = el('div');

  function draw(){
    grid.innerHTML='';
    const cats = Object.keys(byCat).sort();
    for(const cat of cats){
      let items = byCat[cat];
      if(cq) items = items.filter(i=>i.nome.toLowerCase().includes(cq.toLowerCase()));
      if(!items.length) continue;
      const sec = el('div',{style:{marginBottom:'16px'}});
      const allSel = items.every(i=>sel.has(i.nome)||have.has(i.nome.toLowerCase()));
      sec.appendChild(el('div',{class:'row between',style:{marginBottom:'6px'}},[
        el('h4',{text:cat,style:{textTransform:'capitalize'}}),
        el('button',{class:'btn btn-sm btn-ghost',text:allSel?'deseleziona':'seleziona tutti',onclick:()=>{
          items.forEach(i=>{ if(!have.has(i.nome.toLowerCase())){ if(allSel) sel.delete(i.nome); else sel.add(i.nome); } });
          draw(); updateCounter();
        }})
      ]));
      const wrap = el('div',{class:'chips',style:{gap:'6px'}});
      for(const it of items){
        const already = have.has(it.nome.toLowerCase());
        const on = sel.has(it.nome);
        wrap.appendChild(el('button',{
          type:'button',
          class:'chip',
          style:{cursor:already?'default':'pointer',opacity:already?0.5:1,
                 borderColor:on?'var(--accent)':'transparent',
                 background:on?'var(--accent-soft)':'var(--chip)',
                 color:on?'var(--accent)':'var(--chip-text)'},
          title: already?'già in anagrafica':`${RM.utils.fmtEur(it.prezzo_medio)}/${it.unita}`,
          onclick: already?null:(()=>{ if(sel.has(it.nome))sel.delete(it.nome); else sel.add(it.nome); draw(); updateCounter(); }),
          html: `${RM.utils.escapeHtml(it.nome)} <span style="opacity:.6;font-size:11px">${RM.utils.fmtEur(it.prezzo_medio)}/${it.unita}</span>`,
        }));
      }
      sec.appendChild(wrap);
      grid.appendChild(sec);
    }
  }
  function updateCounter(){ counter.textContent = `${sel.size} selezionati`; }
  draw(); updateCounter();

  const body = el('div',{},[
    el('p',{class:'muted',style:{fontSize:'12.5px',marginBottom:'10px'},text:'Seleziona gli ingredienti da importare. Il prezzo medio è la stima GDO 2026 (IVA inclusa); il prezzo "sicuro" parte da -15% e lo aggiornerai con i tuoi fornitori.'}),
    el('div',{class:'search',style:{maxWidth:'none',marginBottom:'12px'}},[ el('input',{type:'text',placeholder:'Filtra catalogo…',oninput:e=>{cq=e.target.value;draw();}}) ]),
    grid,
  ]);
  const {close} = openModal({
    large:true, title:`Catalogo ingredienti base (${RM.kbPrezzi.count})`, body,
    footer:[
      counter,
      el('div',{class:'spacer'}),
      el('button',{class:'btn',text:'Annulla',onclick:()=>close()}),
      el('button',{class:'btn btn-primary',text:'Importa selezionati',onclick:()=>{
        let n=0;
        for(const nome of sel){ createQuick(nome); n++; }
        toast(n?`${n} ingredienti importati`:'Nessuna selezione', n?'ok':'err');
        if(n) close();
      }})
    ]
  });
}

RM.modules.ingredienti = {mount, unmount, edit, createQuick, catalogo};
})();
