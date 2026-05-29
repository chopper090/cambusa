(function(){
'use strict';
const RM = window.RM = window.RM || {};
RM.modules = RM.modules || {};
const {el, toast, confirmDialog, openModal} = RM.utils;
const {store, onChange} = RM;

let off=null, root=null, q='';
function mount(r){ root=r; render(); off=onChange(k=>{if(k==='fornitori'||k==='ingredienti')render();}); }
function unmount(){ off?.(); off=null; }

function render(){
  const list = store.all('fornitori');
  const ingr = store.all('ingredienti');
  const used = new Map();
  for(const i of ingr) if(i.fornitore_id) used.set(i.fornitore_id,(used.get(i.fornitore_id)||0)+1);
  const filtered = list.filter(f=> !q || (f.nome||'').toLowerCase().includes(q.toLowerCase()));

  root.innerHTML='';
  root.append(
    el('div',{class:'view-head'},[
      el('h1',{},['Fornitori ',el('span',{class:'muted',style:{fontSize:'14px',fontWeight:'400'},text:`(${list.length})`})]),
      el('div',{class:'actions'},[
        el('div',{class:'search'},[ el('input',{type:'text',placeholder:'Cerca fornitore…',value:q,oninput:e=>{q=e.target.value;render();}}) ]),
        el('button',{class:'btn btn-primary',text:'+ Nuovo fornitore',onclick:()=>edit(null)}),
      ])
    ]),
    list.length===0
      ? el('div',{class:'tbl-wrap'},[ el('div',{class:'tbl-empty'},[
          el('h3',{text:'Nessun fornitore'}),
          el('p',{class:'muted',text:'Aggiungi i tuoi fornitori per collegarli agli ingredienti.'}),
          el('div',{style:{marginTop:'12px'}},[ el('button',{class:'btn btn-primary',text:'+ Nuovo fornitore',onclick:()=>edit(null)}) ])
        ])])
      : table(filtered, used)
  );
}

function table(list, used){
  const tb = el('div',{class:'tbl-wrap'});
  const t = el('table',{class:'tbl'});
  t.appendChild(el('thead',{},[ el('tr',{},[
    el('th',{text:'Nome'}), el('th',{text:'Contatto'}), el('th',{text:'Telefono'}), el('th',{text:'Email'}),
    el('th',{class:'num',text:'Ingr.'}), el('th',{class:'actions'}),
  ])]));
  const tbody = el('tbody');
  for(const f of list){
    tbody.appendChild(el('tr',{},[
      el('td',{},[el('b',{text:f.nome||'—'}), f.note?el('div',{class:'muted',style:{fontSize:'12px'},text:f.note}):null]),
      el('td',{text:f.contatto||'—'}),
      el('td',{text:f.telefono||'—'}),
      el('td',{text:f.email||'—'}),
      el('td',{class:'num',text:used.get(f.id)||0}),
      el('td',{class:'actions'},[
        el('button',{class:'btn btn-sm',text:'Modifica',onclick:()=>edit(f.id)}),
        el('button',{class:'btn btn-sm btn-danger',text:'Elimina',onclick:()=>del(f)}),
      ])
    ]));
  }
  t.appendChild(tbody); tb.appendChild(t); return tb;
}

async function del(f){
  if(!await confirmDialog(`Eliminare "${f.nome}"?`,'Elimina')) return;
  store.remove('fornitori', f.id);
  toast('Fornitore eliminato','ok');
}

function edit(id){
  const d = id ? {...store.get('fornitori',id)} : {nome:'',contatto:'',telefono:'',email:'',note:''};
  const fN=el('input',{type:'text',value:d.nome||''}),
        fC=el('input',{type:'text',value:d.contatto||''}),
        fT=el('input',{type:'tel',value:d.telefono||''}),
        fE=el('input',{type:'email',value:d.email||''}),
        fNote=el('textarea',{value:d.note||''});
  const body = el('div',{},[
    el('div',{class:'field'},[el('label',{text:'Nome *'}),fN]),
    el('div',{class:'grid-2'},[
      el('div',{class:'field'},[el('label',{text:'Persona di riferimento'}),fC]),
      el('div',{class:'field'},[el('label',{text:'Telefono'}),fT]),
    ]),
    el('div',{class:'field'},[el('label',{text:'Email'}),fE]),
    el('div',{class:'field'},[el('label',{text:'Note'}),fNote]),
  ]);
  const {close} = openModal({
    title: id?'Modifica fornitore':'Nuovo fornitore', body,
    footer:[
      el('button',{class:'btn',text:'Annulla',onclick:()=>close()}),
      el('button',{class:'btn btn-primary',text:'Salva',onclick:()=>{
        const item = {...(d.id?{id:d.id}:{}),nome:fN.value.trim(),contatto:fC.value.trim(),telefono:fT.value.trim(),email:fE.value.trim(),note:fNote.value.trim()};
        if(!item.nome){ toast('Nome obbligatorio','err'); return; }
        store.upsert('fornitori',item); toast('Fornitore salvato','ok'); close();
      }})
    ]
  });
}

RM.modules.fornitori = {mount, unmount};
})();
