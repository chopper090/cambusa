(function(){
'use strict';
const RM = window.RM = window.RM || {};
RM.modules = RM.modules || {};
const {el, fmtEur, fmtPct, toast, confirmDialog, openModal, ALLERGENI, CATEGORIE_PIATTI, CATEGORIE_INGR, UNITA, baseUnitLabel} = RM.utils;
const {store, onChange} = RM;
const {foodcostPiatto, ingredientiMap, prezzoSuggerito} = RM.calc;

let off=null, root=null, q='', filterCat='';

function mount(r){ root=r; render(); off=onChange(k=>{ if(k==='piatti'||k==='ingredienti'||k==='settings') render(); }); }
function unmount(){ off?.(); off=null; }

function render(){
  const piatti = store.all('piatti');
  const ingMap = ingredientiMap();
  const filtered = piatti.filter(p=>{
    if(q && !(p.nome||'').toLowerCase().includes(q.toLowerCase())) return false;
    if(filterCat && p.categoria!==filterCat) return false;
    return true;
  });
  root.innerHTML='';
  root.append(
    el('div',{class:'view-head'},[
      el('h1',{},['Piatti ', el('span',{class:'muted',style:{fontSize:'14px',fontWeight:'400'},text:`(${piatti.length})`})]),
      el('div',{class:'actions'},[
        el('div',{class:'search'},[ el('input',{type:'text',placeholder:'Cerca piatto…',value:q,oninput:e=>{q=e.target.value;render();}}) ]),
        el('button',{class:'btn btn-primary',text:'+ Nuovo piatto',onclick:()=>edit(null)}),
      ])
    ]),
    el('div',{class:'view-sub'},[
      'Componi la ricetta scegliendo dall\'anagrafica oppure ',
      el('b',{text:'aggiungi nuovi ingredienti al volo'}),
      ' — verranno salvati automaticamente nella sezione Ingredienti.'
    ]),
    filterBar(),
    piatti.length===0
      ? el('div',{class:'tbl-wrap'},[ el('div',{class:'tbl-empty'},[
          el('h3',{text:'Nessun piatto'}),
          el('p',{class:'muted',text:'Crea il tuo primo piatto: ingredienti, grammature, procedimento e food cost.'}),
          el('div',{style:{marginTop:'12px'}},[ el('button',{class:'btn btn-primary',text:'+ Nuovo piatto',onclick:()=>edit(null)}) ])
        ])])
      : table(filtered, ingMap)
  );
}

function filterBar(){
  const wrap = el('div',{class:'row wrap',style:{marginBottom:'12px'}});
  const cat = el('select',{onchange:e=>{filterCat=e.target.value;render();},style:{maxWidth:'180px'}});
  cat.appendChild(el('option',{value:'',text:'Tutte le categorie'}));
  for(const c of CATEGORIE_PIATTI) cat.appendChild(el('option',{value:c,text:c,selected:filterCat===c}));
  wrap.append(cat);
  if(filterCat||q) wrap.appendChild(el('button',{class:'btn btn-ghost btn-sm',text:'azzera filtri',onclick:()=>{q='';filterCat='';render();}}));
  return wrap;
}

function fcClass(pct, target){
  if(!pct) return '';
  if(pct <= target) return 'ok';
  if(pct <= target+8) return 'warn';
  return 'err';
}

function table(list, ingMap){
  const target = store.getSettings().foodcost_target_pct||30;
  const tb = el('div',{class:'tbl-wrap'});
  const t = el('table',{class:'tbl'});
  t.appendChild(el('thead',{},[ el('tr',{},[
    el('th',{text:'Piatto'}), el('th',{text:'Categoria'}), el('th',{class:'num',text:'Porz.'}),
    el('th',{class:'num',text:'Costo/porz.'}), el('th',{class:'num',text:'Prezzo'}),
    el('th',{class:'num',text:'Food cost %'}), el('th',{text:'Allergeni'}), el('th',{class:'actions'}),
  ])]));
  const tbody = el('tbody');
  for(const p of list){
    const c = foodcostPiatto(p, ingMap);
    const cls = fcClass(c.foodcost_pct, target);
    const algs = c.allergeni.slice(0,4).map(a=>el('span',{class:'badge',text:a}));
    if(c.allergeni.length>4) algs.push(el('span',{class:'muted',style:{fontSize:'11px'},text:`+${c.allergeni.length-4}`}));
    tbody.appendChild(el('tr',{},[
      el('td',{},[ el('b',{text:p.nome||'—'}) ]),
      el('td',{},[ p.categoria? el('span',{class:'chip',text:p.categoria}) : el('span',{class:'muted',text:'—'}) ]),
      el('td',{class:'num',text:p.porzioni||1}),
      el('td',{class:'num',text:fmtEur(c.costo_porz_sicuro)}),
      el('td',{class:'num',text:p.prezzo_vendita?fmtEur(p.prezzo_vendita):'—'}),
      el('td',{class:'num'},[
        el('div',{},[ el('span',{class:'badge '+cls,text:c.foodcost_pct?fmtPct(c.foodcost_pct):'—'}) ]),
        c.foodcost_pct ? el('div',{class:'fc-bar '+cls},[ el('div',{style:{width:Math.min(100,c.foodcost_pct)+'%'}}) ]) : null,
      ]),
      el('td',{},[ el('div',{class:'chips'}, algs.length?algs:[el('span',{class:'muted',text:'—'})]) ]),
      el('td',{class:'actions'},[
        el('button',{class:'btn btn-sm',text:'Modifica',onclick:()=>edit(p.id)}),
        el('button',{class:'btn btn-sm btn-danger',text:'Elimina',onclick:()=>del(p)}),
      ]),
    ]));
  }
  t.appendChild(tbody);
  tb.appendChild(t);
  return tb;
}

async function del(p){
  if(!await confirmDialog(`Eliminare il piatto "${p.nome}"?`,'Elimina')) return;
  store.remove('piatti', p.id);
  toast('Piatto eliminato','ok');
}

function edit(id){
  // ingMap rilegge dallo store ad ogni accesso così riflette le creazioni al volo
  const getIngMap = ()=> ingredientiMap();
  const settings = store.getSettings();
  const target = settings.foodcost_target_pct||30;

  const data = id
    ? structuredClone(store.get('piatti', id))
    : {nome:'',categoria:'',porzioni:1,prezzo_vendita:0,ingredienti:[],procedimento:'',impiattamento:'',tempo_min:0,difficolta:'media',allergeni:[],foto_dataurl:'',in_ricettario:true};

  const fNome = el('input',{type:'text',value:data.nome||'',placeholder:'Es. Spaghetti al pomodoro'});
  const fCat  = el('select');
  fCat.appendChild(el('option',{value:'',text:'— categoria —'}));
  for(const c of CATEGORIE_PIATTI) fCat.appendChild(el('option',{value:c,text:c,selected:data.categoria===c}));
  const fPorz   = el('input',{type:'number',min:'1',step:'1',value:data.porzioni||1});
  const fPrezzo = el('input',{type:'number',min:'0',step:'0.5',value:data.prezzo_vendita||0});
  const fProc   = el('textarea',{value:data.procedimento||'',placeholder:'Preparazione passo-passo (puoi compilarla anche dopo, dal Ricettario)…',style:{minHeight:'130px'}});
  const fImpiatt= el('textarea',{value:data.impiattamento||'',placeholder:'Come servire e impiattare (guarnizioni, accompagnamenti…)',style:{minHeight:'90px'}});
  const fTempo  = el('input',{type:'number',min:'0',step:'1',value:data.tempo_min||0});
  const fDiff   = el('select');
  for(const d of ['facile','media','alta']) fDiff.appendChild(el('option',{value:d,text:d,selected:data.difficolta===d}));
  const fRic    = el('input',{type:'checkbox'}); fRic.checked = data.in_ricettario!==false;

  // ricetta box
  const recBox = el('div',{class:'list'});
  const recInfo = el('div',{class:'row between wrap',style:{marginTop:'10px',padding:'12px',background:'var(--side)',borderRadius:'8px',gap:'12px'}});

  // sezione "aggiungi ingrediente": doppia modalità
  // 1) picker da anagrafica
  // 2) quick-add: scrivi nome → crea ingrediente con valori di default e aggiungilo
  const addPanel = el('div',{class:'card',style:{padding:'12px',marginBottom:'10px',background:'var(--side)'}});

  const ingPicker = el('select',{style:{flex:'1'}});
  function refreshPicker(){
    const ingr = store.all('ingredienti');
    ingPicker.innerHTML='';
    ingPicker.appendChild(el('option',{value:'',text:ingr.length?'+ scegli da anagrafica…':'(nessun ingrediente in anagrafica)'}));
    for(const i of ingr) ingPicker.appendChild(el('option',{value:i.id,text:`${i.nome}  (${i.unita}, ${fmtEur(i.prezzo_sicuro)})`+(i.tipo==='preparazione'?' · preparazione':'')}));
  }
  refreshPicker();
  ingPicker.addEventListener('change', e=>{
    const id=e.target.value; if(!id) return;
    if(data.ingredienti.some(r=>r.ing_id===id)){ toast('Già presente nella ricetta','err'); e.target.value=''; return; }
    data.ingredienti.push({ing_id:id, grammi:0, note:''});
    e.target.value=''; renderRec();
  });

  // quick add row
  const qkNome = el('input',{type:'text',placeholder:'Nome nuovo ingrediente (es. Olio EVO)',style:{flex:'2'}});
  const qkUni  = el('select',{style:{maxWidth:'70px'}});
  for(const u of UNITA) qkUni.appendChild(el('option',{value:u,text:u,selected:u==='kg'}));
  const qkPrezzo = el('input',{type:'number',min:'0',step:'0.01',placeholder:'€/unità',style:{maxWidth:'90px'}});
  const qkQty  = el('input',{type:'number',min:'0',step:'1',placeholder:'qty in ricetta',style:{maxWidth:'120px'}});

  // aggiunge l'ingrediente digitato e riporta il focus sul nome per inserire subito il successivo
  function quickAdd(){
    const nome = qkNome.value.trim(); if(!nome){ toast('Nome ingrediente obbligatorio','err'); qkNome.focus(); return; }
    const ing = RM.modules.ingredienti.createQuick(nome, {
      unita: qkUni.value,
      prezzo_sicuro: parseFloat(qkPrezzo.value)||0,
      prezzo_medio:  parseFloat(qkPrezzo.value)||0,
    });
    data.ingredienti.push({ing_id:ing.id, grammi:parseFloat(qkQty.value)||0, note:''});
    qkNome.value=''; qkPrezzo.value=''; qkQty.value='';
    refreshPicker();
    renderRec();
    toast(`"${nome}" creato in anagrafica`,'ok');
    qkNome.focus();
  }
  const qkBtn  = el('button',{class:'btn btn-primary',text:'+ Crea e aggiungi',onclick:quickAdd});

  // Enter / Shift+Enter in uno qualsiasi dei campi = crea e aggiungi, poi pronto per il prossimo
  for(const inp of [qkNome, qkPrezzo, qkQty]){
    inp.addEventListener('keydown', e=>{
      if(e.key==='Enter'){ e.preventDefault(); quickAdd(); }
    });
  }

  addPanel.append(
    el('div',{class:'kpi-label',style:{marginBottom:'6px'},text:'AGGIUNGI INGREDIENTE'}),
    el('div',{class:'row wrap',style:{gap:'8px',marginBottom:'8px'}},[ ingPicker ]),
    el('div',{class:'muted',style:{fontSize:'11px',margin:'4px 0'},text:'oppure crealo al volo (premi Invio per aggiungerlo e passare subito al successivo):'}),
    el('div',{class:'row wrap',style:{gap:'6px'}},[ qkNome, qkUni, qkPrezzo, qkQty, qkBtn ]),
  );

  function renderRec(){
    recBox.innerHTML='';
    if(!data.ingredienti.length){
      recBox.appendChild(el('div',{class:'drop',text:'Nessun ingrediente nella ricetta. Aggiungili sopra ↑'}));
    }
    const ingMap = getIngMap();
    data.ingredienti.forEach((r,idx)=>{
      const ing = ingMap.get(r.ing_id);
      const li = el('div',{class:'list-item'});
      if(!ing){
        li.append(el('div',{class:'grow'},[el('span',{class:'badge err',text:'Ingrediente non trovato'})]),
                  rmBtn(idx));
        recBox.appendChild(li); return;
      }
      const qty = el('input',{type:'number',min:'0',step:'1',value:r.grammi||0,style:{maxWidth:'90px'}});
      qty.addEventListener('input',()=>{ r.grammi=parseFloat(qty.value)||0; refreshTotals(); });
      const note = el('input',{type:'text',value:r.note||'',placeholder:'note (es. tritato)',style:{maxWidth:'180px'}});
      note.addEventListener('input',()=>{ r.note=note.value; });
      li.append(
        el('div',{class:'grow'},[
          el('div',{},[ el('span',{class:'title',text:ing.nome}),
            ing.tipo==='preparazione'? el('span',{class:'badge acc',style:{marginLeft:'6px',fontSize:'10px'},text:'preparazione'}) : null ]),
          el('div',{class:'sub'},[ `${ing.categoria||'—'} · ${fmtEur(ing.prezzo_sicuro)}/${ing.unita}` ])
        ]),
        qty, el('span',{class:'muted',text:baseUnitLabel(ing.unita)}),
        note, rmBtn(idx)
      );
      recBox.appendChild(li);
    });
    refreshTotals();
  }
  function rmBtn(idx){
    return el('button',{class:'btn btn-sm btn-danger',text:'×',title:'Rimuovi',onclick:()=>{ data.ingredienti.splice(idx,1); renderRec(); }});
  }

  function refreshTotals(){
    data.porzioni = Math.max(1,parseFloat(fPorz.value)||1);
    data.prezzo_vendita = parseFloat(fPrezzo.value)||0;
    const c = foodcostPiatto(data, getIngMap());
    const cls = fcClass(c.foodcost_pct, target);
    const sugg = prezzoSuggerito(c.costo_porz_sicuro, target);
    recInfo.innerHTML='';
    recInfo.append(
      kpiBlock('Costo totale ricetta', fmtEur(c.costo_tot_sicuro)),
      kpiBlock('Costo / porzione', fmtEur(c.costo_porz_sicuro)),
      kpiBlock('Food cost %', c.foodcost_pct?fmtPct(c.foodcost_pct):'—', cls),
      kpiBlock(`Prezzo suggerito (FC ${target}%)`, fmtEur(sugg)),
    );
  }
  function kpiBlock(label, value, cls=''){
    return el('div',{class:'kpi'},[
      el('span',{class:'kpi-label',text:label}),
      el('span',{style:{fontSize:'18px',fontWeight:'600',color:cls==='err'?'var(--err)':cls==='warn'?'var(--warn)':cls==='ok'?'var(--ok)':'var(--text)'}, text:value}),
    ]);
  }

  fPorz.addEventListener('input', refreshTotals);
  fPrezzo.addEventListener('input', refreshTotals);

  const body = el('div',{},[
    el('div',{class:'grid-2'},[
      el('div',{class:'field'},[ el('label',{text:'Nome piatto *'}), fNome ]),
      el('div',{class:'field'},[ el('label',{text:'Categoria'}), fCat ]),
    ]),
    el('div',{class:'grid-3'},[
      el('div',{class:'field'},[ el('label',{text:'Porzioni'}), fPorz ]),
      el('div',{class:'field'},[ el('label',{text:'Prezzo di vendita €'}), fPrezzo ]),
      el('div',{class:'field'},[ el('label',{text:'Tempo (min)'}), fTempo ]),
    ]),
    el('div',{class:'grid-2'},[
      el('div',{class:'field'},[ el('label',{text:'Difficoltà'}), fDiff ]),
      el('div',{class:'field'},[ el('label',{text:'Ricettario'}),
        el('label',{class:'row',style:{gap:'8px',alignItems:'center',cursor:'pointer',padding:'8px 0'}},[
          fRic, el('span',{text:'Mostra questo piatto nel Ricettario'}) ]),
        el('span',{class:'hint',text:'Disattiva per gli assemblaggi (es. panini) che non sono vere ricette.'}) ]),
    ]),
    el('hr',{class:'sep'}),
    el('h3',{text:'Ricetta'}),
    addPanel,
    recBox,
    recInfo,
    el('hr',{class:'sep'}),
    el('div',{class:'field'},[ el('label',{text:'Preparazione'}), fProc,
      el('span',{class:'hint',text:'Modificabile anche dopo, dal Ricettario.'}) ]),
    el('div',{class:'field'},[ el('label',{text:'Impiattamento'}), fImpiatt ]),
  ]);

  const {close} = openModal({
    large:true,
    title: id?'Modifica piatto':'Nuovo piatto',
    body,
    footer:[
      el('button',{class:'btn',text:'Annulla',onclick:()=>close()}),
      el('button',{class:'btn btn-primary',text:'Salva',onclick:()=>{
        const item = {
          ...(data.id?{id:data.id}:{}),
          nome: fNome.value.trim(), categoria: fCat.value,
          porzioni: Math.max(1,parseFloat(fPorz.value)||1),
          prezzo_vendita: parseFloat(fPrezzo.value)||0,
          ingredienti: data.ingredienti,
          procedimento: fProc.value.trim(),
          impiattamento: fImpiatt.value.trim(),
          tempo_min: parseFloat(fTempo.value)||0, difficolta: fDiff.value,
          in_ricettario: fRic.checked,
          foto_dataurl: data.foto_dataurl||'',
        };
        const c = foodcostPiatto(item, getIngMap());
        item.allergeni = c.allergeni;
        if(!item.nome){ toast('Nome obbligatorio','err'); return; }
        store.upsert('piatti', item);
        toast('Piatto salvato — è già nel Ricettario','ok');
        close();
      }})
    ]
  });

  renderRec();
}

RM.modules.piatti = {mount, unmount, edit};
})();
