(function(){
'use strict';
const RM = window.RM = window.RM || {};
RM.modules = RM.modules || {};
const {el, toast, confirmDialog, openModal, ALLERGENI, CATEGORIE_INGR, UNITA} = RM.utils;
const {store, onChange} = RM;

let off=null, root=null, q='', filterCat='', filterAlg='', filterTipo='';
let sortKey='', sortDir=1;    // ordinamento tabella: '' = ordine di inserimento; dir 1=asc, -1=desc
const selected = new Set();   // id ingredienti spuntati per l'assegnazione fornitore in massa

function mount(r){ root=r; render(); off=onChange(k=>{ if(k==='ingredienti'||k==='fornitori') render(); }); }
function unmount(){ off?.(); off=null; selected.clear(); }

// Filtro + ordinamento correnti applicati alla lista (condiviso da tabella ed export PDF).
function filteredSorted(list, ingMap){
  let out = list.filter(i=>{
    if(q && !(i.nome||'').toLowerCase().includes(q.toLowerCase())) return false;
    if(filterCat && i.categoria!==filterCat) return false;
    if(filterTipo==='preparazione' && i.tipo!=='preparazione') return false;
    if(filterTipo==='semplice' && i.tipo==='preparazione') return false;
    if(filterAlg && !RM.calc.resolveAllergeni(i, ingMap).includes(filterAlg)) return false;
    return true;
  });
  if(sortKey){
    const num = (i,which)=> Number(displayPrice(i,ingMap,which))||0;
    const cmp = {
      nome:(a,b)=>(a.nome||'').localeCompare(b.nome||'','it',{sensitivity:'base'}),
      categoria:(a,b)=>(a.categoria||'').localeCompare(b.categoria||'','it',{sensitivity:'base'}),
      sicuro:(a,b)=>num(a,'sicuro')-num(b,'sicuro'),
      medio:(a,b)=>num(a,'medio')-num(b,'medio'),
    }[sortKey];
    if(cmp) out = [...out].sort((a,b)=>sortDir*cmp(a,b));
  }
  return out;
}

function render(){
  const list = store.all('ingredienti');
  const forn = store.all('fornitori');
  const fornMap = new Map(forn.map(f=>[f.id,f]));
  const ingMap = new Map(list.map(i=>[i.id,i]));
  const filtered = filteredSorted(list, ingMap);
  root.innerHTML = '';
  root.append(
    el('div',{class:'view-head'},[
      el('h1',{},['Ingredienti ', el('span',{class:'muted',style:{fontSize:'14px',fontWeight:'400'},text:`(${list.length})`})]),
      el('div',{class:'actions'},[
        el('div',{class:'search'},[ el('input',{type:'text',placeholder:'Cerca ingrediente…',value:q,oninput:e=>{q=e.target.value;render();}}) ]),
        el('button',{class:'btn',text:'📖 Catalogo base',title:'Importa dagli ingredienti base con prezzo GDO stimato',onclick:()=>catalogo()}),
        el('button',{class:'btn',text:'🧹 Pulizia',title:'Trova e unisci doppioni e refusi',onclick:()=>pulizia()}),
        el('button',{class:'btn',text:'📄 PDF',title:'Scegli le voci ed esporta il listino in PDF per il fornitore',onclick:()=>esportaPdfDialog()}),
        el('button',{class:'btn',text:'+ Nuova preparazione',title:'Crea una ricetta/base composta da zero',onclick:()=>edit(null,{tipo:'preparazione'})}),
        el('button',{class:'btn btn-primary',text:'+ Nuovo ingrediente',onclick:()=>edit(null)}),
      ])
    ]),
    el('div',{class:'view-sub'},['Doppio prezzo: ', el('b',{text:'sicuro'}), ' = il tuo fornitore, ', el('b',{text:'medio'}), ' = stima nazionale supermercato.']),
    filterBar(),
    bulkBar(forn),
    list.length===0
      ? el('div',{class:'tbl-wrap'},[ el('div',{class:'tbl-empty'},[
          el('h3',{text:'Nessun ingrediente'}),
          el('p',{class:'muted',text:'Aggiungi ingredienti qui o creali al volo quando inserisci un piatto.'}),
          el('div',{style:{marginTop:'12px'}},[ el('button',{class:'btn btn-primary',text:'+ Nuovo ingrediente',onclick:()=>edit(null)}) ])
        ])])
      : table(filtered, forn, fornMap, ingMap)
  );
}

// Barra azioni in massa: compare quando spunti uno o più ingredienti.
// Scegli un fornitore dalla tendina e lo assegni a tutti i selezionati in un colpo.
function bulkBar(forn){
  if(!selected.size) return null;
  const sel = el('select',{style:{maxWidth:'240px'}});
  sel.appendChild(el('option',{value:'',text:'— assegna fornitore… —',disabled:true,selected:true}));
  for(const f of forn) sel.appendChild(el('option',{value:f.id,text:f.nome}));
  if(forn.length) sel.appendChild(el('option',{value:'__none__',text:'✕ togli fornitore'}));
  sel.appendChild(el('option',{value:'__new__',text:'+ nuovo fornitore…'}));
  sel.addEventListener('change',()=>{
    const v = sel.value; sel.selectedIndex = 0;
    if(v==='__new__'){ quickForn(f=>applyBulk(f.id)); return; }
    if(v==='__none__'){ applyBulk(''); return; }
    if(v) applyBulk(v);
  });
  return el('div',{class:'row wrap between',style:{background:'var(--accent-soft)',border:'1px solid var(--accent)',borderRadius:'var(--radius)',padding:'8px 12px',marginBottom:'12px',alignItems:'center'}},[
    el('div',{class:'row',style:{gap:'10px',alignItems:'center'}},[
      el('b',{text:`${selected.size} selezionat${selected.size===1?'o':'i'}`}),
      sel,
    ]),
    el('button',{class:'btn btn-ghost btn-sm',text:'Deseleziona',onclick:()=>{ selected.clear(); render(); }}),
  ]);
}

// Assegna (o rimuove, con fid='') un fornitore a tutti gli ingredienti spuntati.
function applyBulk(fid){
  const ids = new Set(selected); selected.clear();   // svuota prima: il render conseguente nasconde la barra
  const list = store.all('ingredienti');
  let n = 0;
  for(const ing of list){ if(ids.has(ing.id) && ing.tipo!=='preparazione'){ ing.fornitore_id = fid||''; n++; } }
  store.set('ingredienti', list);   // un'unica notifica → un solo re-render
  const fname = fid ? (store.get('fornitori',fid)?.nome||'fornitore') : 'nessun fornitore';
  toast(`${n} ingredient${n===1?'e':'i'} → ${fname}`,'ok');
}

// Imposta il fornitore di un singolo ingrediente dalla tendina inline.
function setForn(ingId, fid){
  const ing = store.get('ingredienti', ingId); if(!ing) return;
  if((ing.fornitore_id||'')===(fid||'')) return;
  ing.fornitore_id = fid||''; store.upsert('ingredienti', ing);
}

// Creazione lampo di un fornitore (solo nome) senza lasciare la schermata Ingredienti.
function quickForn(onCreated){
  const fN = el('input',{type:'text',placeholder:'Es. Metro, Ortofrutta Rossi…',autocomplete:'off'});
  const body = el('div',{},[ el('div',{class:'field'},[ el('label',{text:'Nome fornitore *'}), fN,
    el('span',{class:'hint',text:'Lo ritrovi in anagrafica Fornitori per aggiungere contatti e telefono.'}) ]) ]);
  const {close} = openModal({ title:'Nuovo fornitore', body, footer:[
    el('button',{class:'btn',text:'Annulla',onclick:()=>close()}),
    el('button',{class:'btn btn-primary',text:'Crea',onclick:save}),
  ]});
  function save(){
    const nome = fN.value.trim(); if(!nome){ toast('Nome obbligatorio','err'); fN.focus(); return; }
    const ex = store.all('fornitori').find(f=>(f.nome||'').toLowerCase()===nome.toLowerCase());
    const f = ex || store.upsert('fornitori',{nome});
    toast(ex?`"${f.nome}" esiste già`:'Fornitore creato','ok'); close(); onCreated && onCreated(f);
  }
  fN.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); save(); } });
  setTimeout(()=>fN.focus(), 50);
}

// Tendina fornitore inline per una riga (assegnazione diretta, senza aprire la modifica).
function fornRowSelect(forn, ing){
  const sel = el('select',{style:{maxWidth:'160px',fontSize:'12px',padding:'4px 6px'}});
  sel.appendChild(el('option',{value:'',text:'— nessuno —',selected:!ing.fornitore_id}));
  for(const f of forn) sel.appendChild(el('option',{value:f.id,text:f.nome,selected:ing.fornitore_id===f.id}));
  sel.appendChild(el('option',{value:'__new__',text:'+ nuovo…'}));
  sel.addEventListener('change',()=>{
    const v = sel.value;
    if(v==='__new__'){ sel.value = ing.fornitore_id||''; quickForn(f=>setForn(ing.id,f.id)); return; }
    setForn(ing.id, v);
  });
  return sel;
}

function filterBar(){
  const wrap = el('div',{class:'row wrap',style:{marginBottom:'12px'}});
  const tipo = el('select',{onchange:e=>{filterTipo=e.target.value;render();},style:{maxWidth:'170px'}});
  for(const [v,t] of [['','Tutti i tipi'],['semplice','Solo materie prime'],['preparazione','Solo preparazioni']])
    tipo.appendChild(el('option',{value:v,text:t,selected:filterTipo===v}));
  const cat = el('select',{onchange:e=>{filterCat=e.target.value;render();},style:{maxWidth:'180px'}});
  cat.appendChild(el('option',{value:'',text:'Tutte le categorie'}));
  for(const c of CATEGORIE_INGR) cat.appendChild(el('option',{value:c,text:c,selected:filterCat===c}));
  const alg = el('select',{onchange:e=>{filterAlg=e.target.value;render();},style:{maxWidth:'180px'}});
  alg.appendChild(el('option',{value:'',text:'Tutti gli allergeni'}));
  for(const a of ALLERGENI) alg.appendChild(el('option',{value:a,text:a,selected:filterAlg===a}));
  wrap.append(tipo, cat, alg);
  if(filterCat||filterAlg||filterTipo||q) wrap.appendChild(el('button',{class:'btn btn-ghost btn-sm',text:'azzera filtri',onclick:()=>{q='';filterCat='';filterAlg='';filterTipo='';render();}}));
  return wrap;
}

// prezzo per unità (€/kg, €/L, €/pz) da mostrare in tabella: calcolato per le preparazioni
function displayPrice(i, ingMap, which){
  if(i.tipo==='preparazione'){
    const perBase = RM.calc.unitCost(i, ingMap, which);       // €/g, €/ml, €/pz
    return (i.unita==='kg'||i.unita==='L') ? perBase*1000 : perBase; // → €/unità
  }
  return which==='medio' ? i.prezzo_medio : i.prezzo_sicuro;
}

function table(list, forn, fornMap, ingMap){
  const {fmtEur} = RM.utils;
  const selectable = list.filter(i=>i.tipo!=='preparazione');   // le preparazioni non hanno fornitore
  const allChecked = selectable.length>0 && selectable.every(i=>selected.has(i.id));
  const tb = el('div',{class:'tbl-wrap'});
  const t = el('table',{class:'tbl'});
  const selAll = el('input',{type:'checkbox',title:'Seleziona tutti'}); selAll.checked = allChecked;
  selAll.addEventListener('change',()=>{
    if(selAll.checked) selectable.forEach(i=>selected.add(i.id));
    else selectable.forEach(i=>selected.delete(i.id));
    render();
  });
  // intestazione cliccabile per ordinare (Nome, Categoria, prezzi); freccia = verso attivo
  const sortTh = (label, key, numeric)=>{
    const on = sortKey===key;
    return el('th',{
      class:numeric?'num':'', style:{cursor:'pointer',userSelect:'none',whiteSpace:'nowrap'},
      title:'Clicca per ordinare', text: label+(on?(sortDir>0?' ▲':' ▼'):''),
      onclick:()=>{ if(sortKey===key) sortDir=-sortDir; else { sortKey=key; sortDir=1; } render(); },
    });
  };
  t.appendChild(el('thead',{},[ el('tr',{},[
    el('th',{style:{width:'34px'}},[selAll]),
    sortTh('Nome','nome'), sortTh('Categoria','categoria'), el('th',{text:'Unità'}),
    sortTh('€ sicuro','sicuro',true), sortTh('€ medio','medio',true),
    el('th',{text:'Fornitore'}), el('th',{text:'Allergeni'}), el('th',{class:'actions'}),
  ])]));

  const tbody = el('tbody');
  for(const i of list){
    const isPrep = i.tipo==='preparazione';
    const algs = RM.calc.resolveAllergeni(i, ingMap).map(a=>el('span',{class:'badge',text:a}));
    let cb = null;
    if(!isPrep){
      cb = el('input',{type:'checkbox'}); cb.checked = selected.has(i.id);
      cb.addEventListener('change',()=>{ if(cb.checked) selected.add(i.id); else selected.delete(i.id); render(); });
    }
    const row = el('tr', selected.has(i.id)?{style:{background:'var(--accent-soft)'}}:{}, [
      el('td',{},[ cb ]),
      el('td',{},[ el('div',{},[
        el('b',{text:i.nome||'—'}),
        isPrep? el('span',{class:'badge acc',style:{marginLeft:'6px',fontSize:'10px'},text:'preparazione'}) : null,
        i.note?el('div',{class:'muted',style:{fontSize:'12px'},text:i.note}):null ]) ]),
      el('td',{},[ i.categoria? el('span',{class:'chip',text:i.categoria}) : el('span',{class:'muted',text:'—'}) ]),
      el('td',{text:i.unita||'—'}),
      el('td',{class:'num',text:fmtEur(displayPrice(i,ingMap,'sicuro'))}),
      el('td',{class:'num muted',text:fmtEur(displayPrice(i,ingMap,'medio'))}),
      el('td',{},[ isPrep ? el('span',{class:'muted',text:'—'}) : fornRowSelect(forn, i) ]),
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
  const data = id ? {...store.get('ingredienti', id)} : {nome:'',categoria:'',unita:'kg',prezzo_sicuro:0,prezzo_medio:0,fornitore_id:'',allergeni:[],note:'',tipo:'semplice',sub:[],resa:0,porzioni:1,procedimento:'',...prefill};
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

  // === TIPO: materia prima vs preparazione (ingrediente composto) ===
  const fTipo = el('select');
  for(const [v,t] of [['semplice','Materia prima'],['preparazione','Preparazione (ha una sua ricetta)']])
    fTipo.appendChild(el('option',{value:v,text:t,selected:(data.tipo||'semplice')===v}));

  // ---- pannello preparazione: sotto-ingredienti + resa + anteprima costo/allergeni ----
  const subData = Array.isArray(data.sub) ? data.sub.map(r=>({ing_id:r.ing_id, grammi:r.grammi||0})) : [];
  const fResa = el('input',{type:'number',min:'0',step:'1',value:data.resa||0,style:{maxWidth:'140px'}});
  const fResaUnit = el('span',{class:'muted'});
  const fPorz = el('input',{type:'number',min:'1',step:'1',value:data.porzioni||1,style:{maxWidth:'110px'}});
  let prepPorz = Math.max(1, Number(data.porzioni)||1);   // per il riscalo proporzionale
  const fPrepProc = el('textarea',{value:data.procedimento||'',placeholder:'Procedimento della preparazione (facoltativo)…',style:{minHeight:'70px'}});
  const subBox = el('div',{class:'list'});
  const subPicker = el('select',{style:{flex:'1'}});
  const prepPreview = el('div',{class:'row wrap',style:{gap:'14px',marginTop:'10px'}});
  const ingMapNow = ()=> new Map(store.all('ingredienti').map(i=>[i.id,i]));

  // aggiunta rapida di un ingrediente NUOVO (creato in anagrafica) + Invio, come nei piatti
  const qpNome = el('input',{type:'text',placeholder:'Nuovo ingrediente (es. Salsa di soia)',style:{flex:'2'}});
  const qpUni  = el('select',{style:{maxWidth:'70px'}}); for(const u of UNITA) qpUni.appendChild(el('option',{value:u,text:u,selected:u==='kg'}));
  const qpPrezzo = el('input',{type:'number',min:'0',step:'0.01',placeholder:'€/unità',style:{maxWidth:'90px'}});
  const qpQty  = el('input',{type:'number',min:'0',step:'1',placeholder:'qty',style:{maxWidth:'90px'}});
  function quickAddPrep(){
    const nome = qpNome.value.trim(); if(!nome){ toast('Nome ingrediente obbligatorio','err'); qpNome.focus(); return; }
    const ing = createQuick(nome, {unita:qpUni.value, prezzo_sicuro:parseFloat(qpPrezzo.value)||0, prezzo_medio:parseFloat(qpPrezzo.value)||0});
    if(subData.some(r=>r.ing_id===ing.id)) toast('Già presente nella ricetta','err');
    else subData.push({ing_id:ing.id, grammi:parseFloat(qpQty.value)||0});
    qpNome.value=''; qpPrezzo.value=''; qpQty.value='';
    refreshSubPicker(); renderSub(); qpNome.focus();
  }
  const qpBtn = el('button',{class:'btn btn-primary',text:'+ Crea e aggiungi',onclick:quickAddPrep});
  for(const inp of [qpNome, qpPrezzo, qpQty]) inp.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); quickAddPrep(); } });

  function refreshSubPicker(){
    const all = store.all('ingredienti').filter(i=>i.id!==data.id); // niente auto-riferimento
    subPicker.innerHTML='';
    subPicker.appendChild(el('option',{value:'',text: all.length?'+ aggiungi componente…':'(nessun altro ingrediente)'}));
    for(const i of all) subPicker.appendChild(el('option',{value:i.id,text:`${i.nome} (${i.unita})`+(i.tipo==='preparazione'?' · prep':'')}));
  }
  subPicker.addEventListener('change', e=>{
    const cid=e.target.value; if(!cid) return;
    if(subData.some(r=>r.ing_id===cid)){ toast('Già presente','err'); e.target.value=''; return; }
    subData.push({ing_id:cid, grammi:0}); e.target.value=''; renderSub();
  });
  function subRm(idx){ return el('button',{class:'btn btn-sm btn-danger',text:'×',title:'Rimuovi',onclick:()=>{ subData.splice(idx,1); renderSub(); }}); }
  function renderSub(){
    subBox.innerHTML='';
    if(!subData.length) subBox.appendChild(el('div',{class:'drop',text:'Nessun componente. Puoi salvare così e aggiungerli anche più tardi ↑'}));
    const map = ingMapNow();
    subData.forEach((r,idx)=>{
      const ing = map.get(r.ing_id);
      const li = el('div',{class:'list-item'});
      if(!ing){ li.append(el('div',{class:'grow'},[el('span',{class:'badge err',text:'non trovato'})]), subRm(idx)); subBox.appendChild(li); return; }
      const qty = el('input',{type:'number',min:'0',step:'1',value:r.grammi||0,style:{maxWidth:'90px'}});
      qty.addEventListener('input',()=>{ r.grammi=parseFloat(qty.value)||0; recalcPrep(); });
      li.append(
        el('div',{class:'grow'},[ el('div',{class:'title',text:ing.nome}),
          el('div',{class:'sub',text:`${ing.categoria||'—'}`+(ing.tipo==='preparazione'?' · preparazione':'')}) ]),
        qty, el('span',{class:'muted',text:baseUnitLabel(ing.unita)}), subRm(idx)
      );
      subBox.appendChild(li);
    });
    recalcPrep();
  }
  const {baseUnitLabel} = RM.utils;
  function kpiBox(label,val){ return el('div',{class:'kpi'},[el('span',{class:'kpi-label',text:label}),el('span',{style:{fontSize:'15px',fontWeight:'600'},text:val})]); }
  function recalcPrep(){
    fResaUnit.textContent = baseUnitLabel(fUni.value);
    const key = data.id||'__new__';
    const virt = {id:key, tipo:'preparazione', unita:fUni.value, sub:subData, resa:parseFloat(fResa.value)||0, allergeni:[...algState]};
    const map = ingMapNow(); map.set(key, virt);
    const perBaseS = RM.calc.unitCost(virt, map, 'sicuro');
    const perUnitS = (fUni.value==='kg'||fUni.value==='L')?perBaseS*1000:perBaseS;
    const resaEff = (parseFloat(fResa.value)||RM.calc.subQtyTotal(subData)||0);
    const totCost = perBaseS*resaEff;
    const porz = Math.max(1, parseFloat(fPorz.value)||1);
    const alg = RM.calc.resolveAllergeni(virt, map);
    prepPreview.innerHTML='';
    prepPreview.append(
      kpiBox('Costo totale', RM.utils.fmtEur(totCost)),
      kpiBox('Costo / porzione', RM.utils.fmtEur(totCost/porz)),
      kpiBox('Costo / '+fUni.value, RM.utils.fmtEur(perUnitS)),
      kpiBox('Allergeni', alg.length?alg.join(', '):'—'),
    );
  }
  fResa.addEventListener('input', recalcPrep);
  fUni.addEventListener('change', recalcPrep);
  // cambiando le porzioni, riscala proporzionalmente le grammature dei componenti e la resa
  fPorz.addEventListener('change', ()=>{
    const nv = Math.max(1, parseFloat(fPorz.value)||1);
    const ratio = nv/(prepPorz||1);
    if(ratio>0 && ratio!==1){
      for(const r of subData) r.grammi = +(((Number(r.grammi)||0)*ratio).toFixed(3));
      const resaN = parseFloat(fResa.value)||0; if(resaN>0) fResa.value = +((resaN*ratio).toFixed(3));
    }
    prepPorz = nv; fPorz.value = nv;
    renderSub();
  });

  const prepPanel = el('div',{class:'card',style:{padding:'12px',background:'var(--side)'}},[
    el('div',{class:'kpi-label',style:{marginBottom:'6px'},text:'COMPOSIZIONE DELLA PREPARAZIONE'}),
    el('p',{class:'muted',style:{fontSize:'12px',margin:'0 0 8px'},text:'Aggiungi gli ingredienti che la compongono: costo e allergeni sono calcolati e propagati in automatico ai piatti che la usano.'}),
    el('div',{class:'row wrap',style:{gap:'8px',marginBottom:'8px'}},[ subPicker ]),
    el('div',{class:'muted',style:{fontSize:'11px',margin:'4px 0'},text:'oppure crea un nuovo ingrediente al volo (premi Invio per aggiungerlo e passare al successivo):'}),
    el('div',{class:'row wrap',style:{gap:'6px',marginBottom:'8px'}},[ qpNome, qpUni, qpPrezzo, qpQty, qpBtn ]),
    subBox,
    el('div',{class:'grid-2',style:{marginTop:'10px'}},[
      el('div',{class:'field'},[ el('label',{text:'Porzioni'}), fPorz,
        el('span',{class:'hint',text:'Cambiandole, le grammature si riscalano in proporzione.'}) ]),
      el('div',{class:'field'},[ el('label',{},['Resa — quantità prodotta ', fResaUnit]), fResa,
        el('span',{class:'hint',text:'Quanto ne ottieni in totale (es. 500). Se 0, uso la somma dei componenti.'}) ]),
    ]),
    prepPreview,
    el('div',{class:'field',style:{marginTop:'10px'}},[ el('label',{text:'Procedimento della preparazione'}), fPrepProc ]),
  ]);

  // ---- collegamento: "usata nei piatti" (dalla ricetta scelgo i piatti) ----
  const piattiLink = new Set();
  if(data.id){ for(const p of store.all('piatti')){ if((p.ingredienti||[]).some(r=>r.ing_id===data.id)) piattiLink.add(p.id); } }
  const linkBox = el('div',{class:'list',style:{maxHeight:'220px',overflow:'auto'}});
  function buildLinks(){
    const piatti = store.all('piatti');
    linkBox.innerHTML='';
    if(!piatti.length){ linkBox.appendChild(el('div',{class:'drop',text:'Nessun piatto ancora. Crea prima i piatti, poi torna qui a collegarli.'})); return; }
    for(const p of piatti){
      const cb = el('input',{type:'checkbox'}); cb.checked = piattiLink.has(p.id);
      cb.addEventListener('change',()=>{ if(cb.checked) piattiLink.add(p.id); else piattiLink.delete(p.id); });
      linkBox.appendChild(el('label',{class:'list-item',style:{cursor:'pointer',gap:'10px'}},[
        cb, el('div',{class:'grow'},[ el('div',{class:'title',text:p.nome}),
          el('div',{class:'sub',text:p.categoria||'—'}) ])
      ]));
    }
  }
  const linkPanel = el('div',{class:'field'},[
    el('label',{text:'Usata nei piatti'}),
    el('span',{class:'hint',text:'Spunta i piatti che usano questa preparazione: verrà aggiunta ai loro ingredienti (quantità 0, da impostare nel piatto). Togliendo la spunta la rimuovi dal piatto.'}),
    linkBox,
  ]);

  const priceWrap = el('div',{class:'grid-2'},[
    el('div',{class:'field'},[ el('label',{text:'€ sicuro (fornitore)'}), fPs ]),
    el('div',{class:'field'},[ el('label',{text:'€ medio (stima nazionale)'}), fPm ]),
  ]);
  const fornWrap = el('div',{class:'field'},[ el('label',{text:'Fornitore'}), fForn ]);
  const algLabel = el('label',{text:'Allergeni'});

  function applyTipo(){
    const prep = fTipo.value==='preparazione';
    priceWrap.style.display = prep?'none':'';
    fornWrap.style.display  = prep?'none':'';
    prepPanel.style.display = prep?'':'none';
    linkPanel.style.display = prep?'':'none';
    algLabel.textContent = prep ? 'Allergeni aggiuntivi (oltre a quelli calcolati dai componenti)' : 'Allergeni';
    if(prep){ refreshSubPicker(); renderSub(); buildLinks(); }
  }
  fTipo.addEventListener('change', applyTipo);

  const body = el('div',{},[
    el('div',{class:'grid-2'},[
      el('div',{class:'field'},[ el('label',{text:'Nome *'}), acWrap,
        el('span',{class:'hint',text:`Inizia a digitare: cerco fra ${RM.kbPrezzi.count} ingredienti comuni e compilo categoria, unità e prezzo medio.`}) ]),
      el('div',{class:'field'},[ el('label',{text:'Tipo'}), fTipo ]),
    ]),
    el('div',{class:'grid-2'},[
      el('div',{class:'field'},[ el('label',{text:'Categoria'}), fCat ]),
      el('div',{class:'field'},[ el('label',{text:'Unità di misura'}), fUni,
        el('span',{class:'hint',text:'Il prezzo è per €/kg, €/L o €/pz.'}) ]),
    ]),
    priceWrap,
    prepPanel,
    linkPanel,
    fornWrap,
    el('div',{class:'field'},[ algLabel, fAlg ]),
    el('div',{class:'field'},[ el('label',{text:'Note'}), fNote ]),
  ]);
  applyTipo();

  const {close} = openModal({
    title: id?'Modifica ingrediente':'Nuovo ingrediente', body,
    footer:[
      el('button',{class:'btn',text:'Annulla',onclick:()=>close()}),
      el('button',{class:'btn btn-primary',text:'Salva',onclick:()=>{
        const tipo = fTipo.value==='preparazione' ? 'preparazione' : 'semplice';
        const item = {
          ...(data.id?{id:data.id}:{}),
          nome: fNome.value.trim(), categoria: fCat.value, unita: fUni.value, tipo,
          fornitore_id: tipo==='preparazione' ? '' : (fForn.value||''),
          allergeni: [...algState], note: fNote.value.trim(),
        };
        if(!item.nome){ toast('Nome obbligatorio','err'); return; }
        if(tipo==='preparazione'){
          item.sub  = subData.filter(r=>r.ing_id).map(r=>({ing_id:r.ing_id, grammi:parseFloat(r.grammi)||0}));
          item.resa = parseFloat(fResa.value)||0;
          item.porzioni = Math.max(1, parseFloat(fPorz.value)||1);
          item.procedimento = fPrepProc.value.trim();
          // i componenti si possono aggiungere anche in un secondo momento
          // snapshot costo (€/unità) + allergeni derivati, per export/altre viste; i piatti ricalcolano comunque live
          const key = item.id || '__tmp__';
          const map = new Map(store.all('ingredienti').map(i=>[i.id,i])); map.set(key, {...item, id:key});
          const f = (item.unita==='kg'||item.unita==='L') ? 1000 : 1;
          item.prezzo_sicuro = +(RM.calc.unitCost(map.get(key), map, 'sicuro')*f).toFixed(4);
          item.prezzo_medio  = +(RM.calc.unitCost(map.get(key), map, 'medio')*f).toFixed(4);
          item.allergeni     = RM.calc.resolveAllergeni(map.get(key), map);
        } else {
          item.prezzo_sicuro = parseFloat(fPs.value)||0;
          item.prezzo_medio  = parseFloat(fPm.value)||0;
          item.sub = []; item.resa = 0;
        }
        const saved = store.upsert('ingredienti', item);
        // collega/scollega ai piatti selezionati (solo per le preparazioni)
        let linked=0, unlinked=0;
        if(tipo==='preparazione'){
          for(const p of store.all('piatti')){
            const has  = (p.ingredienti||[]).some(r=>r.ing_id===saved.id);
            const want = piattiLink.has(p.id);
            if(want && !has){ p.ingredienti=[...(p.ingredienti||[]), {ing_id:saved.id, grammi:0, note:''}]; store.upsert('piatti', p); linked++; }
            else if(!want && has){ p.ingredienti=(p.ingredienti||[]).filter(r=>r.ing_id!==saved.id); store.upsert('piatti', p); unlinked++; }
          }
        }
        const extra = linked||unlinked ? ` (${linked} collegati, ${unlinked} scollegati)` : '';
        toast('Ingrediente salvato'+extra,'ok');
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

// ============================================================================
// Export PDF: prima fai scegliere quali voci stampare (per non inviare al
// fornitore prodotti che non tratta). Parte dalla lista già filtrata/ordinata.
// ============================================================================
function esportaPdfDialog(){
  const l0 = store.all('ingredienti'); const im = new Map(l0.map(i=>[i.id,i]));
  const list = filteredSorted(l0, im);
  if(!list.length){ toast('Nessun ingrediente da stampare','err'); return; }
  const chosen = new Set(list.map(i=>i.id));   // default: tutte selezionate
  const byCat = new Map();
  for(const i of list){ const k = CATEGORIE_INGR.includes(i.categoria)?i.categoria:'altro'; (byCat.get(k)||byCat.set(k,[]).get(k)).push(i); }

  const counter = el('span',{class:'muted',style:{fontSize:'12px'}});
  const grid = el('div');
  const upd = ()=>{ counter.textContent = `${chosen.size} di ${list.length} selezionate`; };
  function draw(){
    grid.innerHTML='';
    for(const cat of CATEGORIE_INGR){
      const items = byCat.get(cat); if(!items || !items.length) continue;
      const allOn = items.every(i=>chosen.has(i.id));
      const sec = el('div',{style:{marginBottom:'12px'}});
      sec.appendChild(el('div',{class:'row between',style:{marginBottom:'4px',alignItems:'center'}},[
        el('h4',{text:cat.charAt(0).toUpperCase()+cat.slice(1),style:{margin:0}}),
        el('button',{class:'btn btn-sm btn-ghost',text:allOn?'deseleziona':'seleziona tutti',onclick:()=>{
          items.forEach(i=>{ if(allOn) chosen.delete(i.id); else chosen.add(i.id); }); draw(); upd();
        }}),
      ]));
      const box = el('div',{class:'list'});
      for(const i of items){
        const cb = el('input',{type:'checkbox'}); cb.checked = chosen.has(i.id);
        cb.addEventListener('change',()=>{ if(cb.checked) chosen.add(i.id); else chosen.delete(i.id); upd(); });
        const meta = [ i.unita||'', Number(i.prezzo_sicuro)>0?RM.utils.fmtEur(i.prezzo_sicuro):'senza prezzo',
                       i.tipo==='preparazione'?'preparazione':null ].filter(Boolean).join(' · ');
        box.appendChild(el('label',{class:'list-item',style:{cursor:'pointer',gap:'10px',alignItems:'center'}},[
          cb, el('div',{class:'grow'},[ el('div',{class:'title',text:i.nome||'—'}), el('div',{class:'sub',text:meta}) ])
        ]));
      }
      sec.appendChild(box); grid.appendChild(sec);
    }
  }
  draw(); upd();

  const body = el('div',{},[
    el('p',{class:'muted',style:{fontSize:'12.5px',marginBottom:'10px'},text:'Spunta solo le voci da inviare al fornitore (escludi i prodotti che non tratta). Parte da tutto selezionato; puoi restringere ancora con i filtri della lista prima di aprire questa finestra.'}),
    el('div',{class:'row between',style:{marginBottom:'10px',alignItems:'center'}},[
      el('div',{class:'row',style:{gap:'8px'}},[
        el('button',{class:'btn btn-sm',text:'Seleziona tutto',onclick:()=>{ list.forEach(i=>chosen.add(i.id)); draw(); upd(); }}),
        el('button',{class:'btn btn-sm',text:'Deseleziona tutto',onclick:()=>{ chosen.clear(); draw(); upd(); }}),
      ]),
      counter,
    ]),
    grid,
  ]);
  const {close} = openModal({
    large:true, title:'Stampa listino — scegli le voci', body,
    footer:[
      el('button',{class:'btn',text:'Annulla',onclick:()=>close()}),
      el('button',{class:'btn btn-primary',text:'Genera PDF',onclick:()=>{
        const out = list.filter(i=>chosen.has(i.id));
        if(!out.length){ toast('Seleziona almeno una voce','err'); return; }
        const sub = [ filterCat&&('cat.: '+filterCat), filterTipo==='semplice'&&'solo materie prime',
                      filterTipo==='preparazione'&&'solo preparazioni', filterAlg&&('allergene: '+filterAlg),
                      q&&('ricerca: “'+q+'”') ].filter(Boolean).join('  ·  ');
        RM.pdf.esportaIngredienti(out, {subtitle: sub}); close();
      }}),
    ]
  });
}

// ============================================================================
// Pulizia lista: trova doppioni e refusi (accenti, maiuscole, spazi, plurali,
// poche lettere di differenza) e li unisce SOLO su conferma dell'utente,
// spostando gli utilizzi (piatti e preparazioni) sull'ingrediente tenuto.
// ============================================================================
function normName(s){
  return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/g,' ').trim();
}
function lev(a,b){
  const m=a.length, n=b.length;
  if(!m) return n; if(!n) return m;
  let prev=Array.from({length:n+1},(_,i)=>i), cur=new Array(n+1);
  for(let i=1;i<=m;i++){
    cur[0]=i;
    for(let j=1;j<=n;j++){
      const cost = a[i-1]===b[j-1]?0:1;
      cur[j]=Math.min(prev[j]+1, cur[j-1]+1, prev[j-1]+cost);
    }
    [prev,cur]=[cur,prev];
  }
  return prev[n];
}
// Union-find: raggruppa gli ingredienti simili. Restituisce solo i gruppi con >1 elemento.
function buildClusters(list){
  const n=list.length, norm=list.map(i=>normName(i.nome));
  const parent=list.map((_,i)=>i);
  const find=x=>{ while(parent[x]!==x){ parent[x]=parent[parent[x]]; x=parent[x]; } return x; };
  const union=(a,b)=>{ parent[find(a)]=find(b); };
  for(let i=0;i<n;i++) for(let j=i+1;j<n;j++){
    const a=norm[i], b=norm[j]; if(!a||!b) continue;
    let match = a===b;
    if(!match){
      const minL=Math.min(a.length,b.length);
      if(minL>=5 && a[0]===b[0] && lev(a,b)<=2) match=true;   // refusi/plurali, conservativo
    }
    if(match) union(i,j);
  }
  const map=new Map();
  for(let i=0;i<n;i++){ const r=find(i); (map.get(r)||map.set(r,[]).get(r)).push(list[i]); }
  return [...map.values()].filter(g=>g.length>1);
}
function usageCount(id, piatti, preps){
  let c=0;
  for(const p of piatti) if((p.ingredienti||[]).some(r=>r.ing_id===id)) c++;
  for(const pr of preps) if((pr.sub||[]).some(r=>r.ing_id===id)) c++;
  return c;
}
// Suggerisce quale tenere: più usato → con prezzo → con fornitore → nome più corto.
function suggestKeep(group, piatti, preps){
  return [...group].sort((a,b)=>{
    const u=usageCount(b.id,piatti,preps)-usageCount(a.id,piatti,preps); if(u) return u;
    const p=(Number(b.prezzo_sicuro)>0?1:0)-(Number(a.prezzo_sicuro)>0?1:0); if(p) return p;
    const f=(b.fornitore_id?1:0)-(a.fornitore_id?1:0); if(f) return f;
    return (a.nome||'').length-(b.nome||'').length;
  })[0].id;
}
// Unisce otherIds dentro keepId: ripunta i riferimenti in piatti e preparazioni,
// riempie i campi vuoti del tenuto, poi elimina gli altri.
function mergeInto(keepId, otherIds){
  const others = new Set(otherIds);
  const repoint = rows => {
    let changed=false; const seen=new Set(); const out=[];
    for(const r of (rows||[])){
      const id = others.has(r.ing_id) ? keepId : r.ing_id;
      if(id!==r.ing_id) changed=true;
      if(seen.has(id)){ changed=true; continue; }   // evita doppia riga dello stesso ingrediente
      seen.add(id); out.push(id===r.ing_id?r:{...r, ing_id:id});
    }
    return {changed, out};
  };
  for(const p of store.all('piatti')){
    const {changed,out}=repoint(p.ingredienti);
    if(changed){ p.ingredienti=out; store.upsert('piatti', p); }
  }
  for(const ing of store.all('ingredienti')){
    if(ing.tipo!=='preparazione' || !Array.isArray(ing.sub)) continue;
    const {changed,out}=repoint(ing.sub);
    if(changed){ ing.sub=out; store.upsert('ingredienti', ing); }
  }
  const keep = store.get('ingredienti', keepId);
  if(keep){
    for(const oid of otherIds){
      const o = store.get('ingredienti', oid); if(!o) continue;
      if(!keep.fornitore_id && o.fornitore_id) keep.fornitore_id=o.fornitore_id;
      if(!(Number(keep.prezzo_sicuro)>0) && Number(o.prezzo_sicuro)>0) keep.prezzo_sicuro=o.prezzo_sicuro;
      if(!(Number(keep.prezzo_medio)>0)  && Number(o.prezzo_medio)>0)  keep.prezzo_medio =o.prezzo_medio;
      if(!keep.categoria && o.categoria) keep.categoria=o.categoria;
      const ka=new Set(keep.allergeni||[]); (o.allergeni||[]).forEach(a=>ka.add(a)); keep.allergeni=[...ka];
    }
    store.upsert('ingredienti', keep);
  }
  for(const oid of otherIds) store.remove('ingredienti', oid);
}

function pulizia(){
  const list = store.all('ingredienti');
  const piatti = store.all('piatti');
  const preps = list.filter(i=>i.tipo==='preparazione');
  const fornMap = new Map(store.all('fornitori').map(f=>[f.id,f]));
  const clusters = buildClusters(list);
  const state = clusters.map(g=>({keepId:suggestKeep(g,piatti,preps), skip:false}));

  const body = el('div',{});
  body.appendChild(el('p',{class:'muted',style:{fontSize:'13px',marginBottom:'12px'},
    html:'Ho analizzato tutti i nomi e raggruppato i <b>probabili doppioni e refusi</b> (accenti, maiuscole, spazi, singolare/plurale, poche lettere di differenza). Per ogni gruppo scegli <b>quale tenere</b>: gli altri vengono uniti a quello e i loro utilizzi nei piatti e nelle preparazioni <b>spostati automaticamente</b>. Niente viene eliminato senza la tua conferma qui. Spunta <b>“salta”</b> se un gruppo non è un vero doppione.'}));

  if(!clusters.length){
    body.appendChild(el('div',{class:'drop',text:'Nessun doppione evidente trovato. La lista è già pulita 🎉'}));
  }
  const cards = el('div',{class:'list'});
  clusters.forEach((g,idx)=>{
    const card = el('div',{class:'card',style:{padding:'10px',marginBottom:'8px'}});
    const skipCb = el('input',{type:'checkbox'});
    skipCb.addEventListener('change',()=>{ state[idx].skip=skipCb.checked; card.style.opacity=skipCb.checked?0.45:1; });
    card.appendChild(el('div',{class:'row between',style:{alignItems:'center',marginBottom:'4px'}},[
      el('b',{text:`Gruppo ${idx+1} · ${g.length} simili`}),
      el('label',{class:'row',style:{gap:'6px',fontSize:'12px',cursor:'pointer',alignItems:'center'}},[skipCb,'salta']),
    ]));
    card.appendChild(el('div',{class:'muted',style:{fontSize:'11px',marginBottom:'6px'},text:'Tieni:'}));
    g.forEach(i=>{
      const rb=el('input',{type:'radio',name:'clu_'+idx,value:i.id}); rb.checked = state[idx].keepId===i.id;
      rb.addEventListener('change',()=>{ if(rb.checked) state[idx].keepId=i.id; });
      const u = usageCount(i.id,piatti,preps);
      const meta = [ i.tipo==='preparazione'?'preparazione':(i.categoria||'—'), i.unita||'',
        Number(i.prezzo_sicuro)>0?RM.utils.fmtEur(i.prezzo_sicuro):'senza prezzo',
        (i.fornitore_id&&fornMap.get(i.fornitore_id))?('→ '+fornMap.get(i.fornitore_id).nome):null,
        `usato in ${u}` ].filter(Boolean).join(' · ');
      card.appendChild(el('label',{class:'list-item',style:{cursor:'pointer',gap:'10px',alignItems:'center'}},[
        rb, el('div',{class:'grow'},[ el('div',{class:'title',text:i.nome||'—'}), el('div',{class:'sub',text:meta}) ])
      ]));
    });
    cards.appendChild(card);
  });
  body.appendChild(cards);

  const {close} = openModal({
    large:true, title:`Pulizia lista ingredienti${clusters.length?` (${clusters.length} gruppi)`:''}`, body,
    footer:[
      el('button',{class:'btn',text:'Chiudi',onclick:()=>close()}),
      clusters.length ? el('button',{class:'btn btn-primary',text:'Unisci i gruppi',onclick:()=>{
        let merged=0, removed=0;
        clusters.forEach((g,idx)=>{
          if(state[idx].skip) return;
          const keepId = state[idx].keepId;
          const otherIds = g.filter(i=>i.id!==keepId).map(i=>i.id);
          if(!otherIds.length) return;
          mergeInto(keepId, otherIds);
          merged++; removed+=otherIds.length;
        });
        toast(merged?`${removed} doppioni uniti in ${merged} grupp${merged===1?'o':'i'}`:'Nessun gruppo da unire (tutti saltati)', merged?'ok':'err');
        close();
      }}) : null,
    ]
  });
}

RM.modules.ingredienti = {mount, unmount, edit, createQuick, catalogo, pulizia};
})();
