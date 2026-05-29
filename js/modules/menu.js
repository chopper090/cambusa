(function(){
'use strict';
const RM = window.RM = window.RM || {};
RM.modules = RM.modules || {};
const {el, fmtEur, toast, confirmDialog, openModal, CATEGORIE_PIATTI} = RM.utils;
const {store, onChange} = RM;

let off=null;
function mount(r){ render(r); off=onChange(()=>render(r)); }
function unmount(){ off?.(); off=null; }

function render(root){
  const menus = store.all('menu');
  root.innerHTML='';
  root.append(
    el('div',{class:'view-head'},[
      el('h1',{},['Menù ',el('span',{class:'muted',style:{fontSize:'14px',fontWeight:'400'},text:`(${menus.length})`})]),
      el('div',{class:'actions'},[el('button',{class:'btn btn-primary',text:'+ Nuovo menù',onclick:()=>edit(null)})])
    ]),
    el('div',{class:'view-sub',text:'Componi un menù scegliendo dai piatti già creati. Esporta in PDF per condividere con il proprietario.'}),
    menus.length===0
      ? el('div',{class:'tbl-wrap'},[el('div',{class:'tbl-empty'},[
          el('h3',{text:'Nessun menù'}),
          el('p',{class:'muted',text:'Crea il tuo primo menù selezionando i piatti.'}),
          el('div',{style:{marginTop:'12px'}},[ el('button',{class:'btn btn-primary',text:'+ Nuovo menù',onclick:()=>edit(null)}) ])
        ])])
      : list(menus)
  );
}

function list(menus){
  const piatti = store.all('piatti');
  const pMap = new Map(piatti.map(p=>[p.id,p]));
  const wrap = el('div',{class:'list'});
  for(const m of menus){
    const cnt = (m.piatti_ids||[]).filter(id=>pMap.has(id)).length;
    wrap.appendChild(el('div',{class:'list-item'},[
      el('div',{class:'grow'},[
        el('div',{class:'title',text:m.nome||'Menù senza nome'}),
        el('div',{class:'sub',text:`${cnt} piatt${cnt===1?'o':'i'}${m.data?' · '+m.data:''}${m.note?' · '+m.note:''}`}),
      ]),
      el('button',{class:'btn btn-sm',text:'Modifica',onclick:()=>edit(m.id)}),
      el('a',{class:'btn btn-sm',href:`#menu-editor?id=${m.id}`,text:'✎ Editor visuale'}),
      el('button',{class:'btn btn-sm',text:'PDF rapido',onclick:()=>RM.pdf.esportaMenu(m.id)}),
      el('button',{class:'btn btn-sm btn-danger',text:'Elimina',onclick:async()=>{
        if(!await confirmDialog(`Eliminare il menù "${m.nome}"?`,'Elimina')) return;
        store.remove('menu',m.id); toast('Menù eliminato','ok');
      }}),
    ]));
  }
  return wrap;
}

function edit(id){
  const piatti = store.all('piatti');
  const data = id ? structuredClone(store.get('menu',id)) : {nome:'',data:new Date().toISOString().slice(0,10),piatti_ids:[],note:''};

  const fNome = el('input',{type:'text',value:data.nome||'',placeholder:'Es. Menù di primavera 2026'});
  const fData = el('input',{type:'date',value:data.data||''});
  const fNote = el('textarea',{value:data.note||'',placeholder:'Note per il proprietario, occasione…'});

  const sel = new Set(data.piatti_ids||[]);
  const grpBox = el('div');
  const grouped = {};
  for(const c of CATEGORIE_PIATTI) grouped[c]=[];
  grouped['altro'] = grouped['altro']||[];
  for(const p of piatti){ const cat = grouped[p.categoria] ? p.categoria : 'altro'; grouped[cat].push(p); }

  function renderGroups(){
    grpBox.innerHTML='';
    for(const cat of CATEGORIE_PIATTI){
      const items = grouped[cat]; if(!items?.length) continue;
      const sec = el('div',{style:{marginBottom:'14px'}});
      sec.appendChild(el('h4',{style:{margin:'8px 0 6px',textTransform:'capitalize',color:'var(--text-2)'},text:cat}));
      for(const p of items){
        sec.appendChild(el('label',{class:'list-item',style:{cursor:'pointer'}},[
          el('input',{type:'checkbox',checked:sel.has(p.id),onchange:e=>{ if(e.target.checked) sel.add(p.id); else sel.delete(p.id); }}),
          el('div',{class:'grow'},[
            el('div',{class:'title',text:p.nome}),
            el('div',{class:'sub',text:`${p.prezzo_vendita?fmtEur(p.prezzo_vendita):'(prezzo non impostato)'}`}),
          ]),
        ]));
      }
    }
    if(piatti.length===0) grpBox.appendChild(el('div',{class:'drop',text:'Crea prima dei piatti nella sezione Piatti.'}));
  }
  renderGroups();

  const body = el('div',{},[
    el('div',{class:'grid-2'},[
      el('div',{class:'field'},[el('label',{text:'Nome menù *'}),fNome]),
      el('div',{class:'field'},[el('label',{text:'Data'}),fData]),
    ]),
    el('div',{class:'field'},[el('label',{text:'Note'}),fNote]),
    el('hr',{class:'sep'}),
    el('h3',{text:'Seleziona i piatti'}),
    grpBox,
  ]);

  const {close} = openModal({
    large:true,
    title: id?'Modifica menù':'Nuovo menù', body,
    footer:[
      el('button',{class:'btn',text:'Annulla',onclick:()=>close()}),
      el('button',{class:'btn btn-primary',text:'Salva',onclick:()=>{
        const item = {...(data.id?{id:data.id}:{}),nome:fNome.value.trim(),data:fData.value,piatti_ids:[...sel],note:fNote.value.trim()};
        if(!item.nome){ toast('Nome obbligatorio','err'); return; }
        store.upsert('menu',item); toast('Menù salvato','ok'); close();
      }})
    ]
  });
}

RM.modules.menu = {mount, unmount};
})();
