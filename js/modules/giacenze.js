(function(){
'use strict';
const RM = window.RM = window.RM || {};
RM.modules = RM.modules || {};
const {el, fmtNum, toast} = RM.utils;
const {store, onChange} = RM;

let off=null;
function mount(r){ render(r); off=onChange(()=>render(r)); }
function unmount(){ off?.(); off=null; }

function render(root){
  const ingr = store.all('ingredienti');
  const g = store.all('giacenze');
  const gMap = new Map(g.map(x=>[x.ing_id,x]));

  root.innerHTML='';
  root.append(
    el('div',{class:'view-head'},[
      el('h1',{text:'Giacenze'}),
      el('div',{class:'actions'},[
        el('button',{class:'btn',text:'Azzera tutte',onclick:()=>{ for(const x of g) store.remove('giacenze',x.ing_id); toast('Giacenze azzerate','ok'); }})
      ])
    ]),
    el('div',{class:'view-sub',text:'Quantità correnti per ingrediente. Le modifiche vengono salvate automaticamente.'}),
    ingr.length===0
      ? el('div',{class:'tbl-wrap'},[ el('div',{class:'tbl-empty'},[el('h3',{text:'Nessun ingrediente'}),el('p',{class:'muted',text:'Aggiungi ingredienti prima di gestire le giacenze.'})])])
      : table(ingr, gMap)
  );
}

function table(ingr, gMap){
  const tb = el('div',{class:'tbl-wrap'});
  const t = el('table',{class:'tbl'});
  t.appendChild(el('thead',{},[el('tr',{},[
    el('th',{text:'Ingrediente'}), el('th',{text:'Categoria'}),
    el('th',{class:'num',text:'Quantità'}), el('th',{text:'Unità'}), el('th',{class:'num',text:'Valore €'}),
  ])]));
  const tbody = el('tbody');
  for(const i of ingr){
    const cur = gMap.get(i.id);
    const qty = cur?.quantita||0;
    const input = el('input',{type:'number',min:'0',step:'0.5',value:qty,style:{maxWidth:'120px',textAlign:'right'}});
    input.addEventListener('change',()=>{
      const v = parseFloat(input.value)||0;
      if(v<=0) store.remove('giacenze', i.id);
      else store.upsert('giacenze',{id:i.id, ing_id:i.id, quantita:v, unita:i.unita});
      toast('Aggiornato','ok');
    });
    tbody.appendChild(el('tr',{},[
      el('td',{},[el('b',{text:i.nome})]),
      el('td',{},[i.categoria?el('span',{class:'chip',text:i.categoria}):el('span',{class:'muted',text:'—'})]),
      el('td',{class:'num'},[input]),
      el('td',{text:i.unita}),
      el('td',{class:'num',text:fmtNum((qty*(i.prezzo_sicuro||0)),2)+' €'}),
    ]));
  }
  t.appendChild(tbody); tb.appendChild(t); return tb;
}

RM.modules.giacenze = {mount, unmount};
})();
