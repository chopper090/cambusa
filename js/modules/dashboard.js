(function(){
'use strict';
const RM = window.RM = window.RM || {};
RM.modules = RM.modules || {};
const {el, fmtEur, fmtPct} = RM.utils;
const {store, onChange} = RM;
const {kpiGlobali, foodcostPiatto, ingredientiMap} = RM.calc;

let off=null;
function mount(r){ render(r); off=onChange(()=>render(r)); }
function unmount(){ off?.(); off=null; }

function render(root){
  const k = kpiGlobali();
  const settings = store.getSettings();
  const target = settings.foodcost_target_pct||30;

  const piatti = store.all('piatti');
  const ingMap = ingredientiMap();
  const piattiCon = piatti.map(p=>({p, c:foodcostPiatto(p,ingMap)}));
  const topCost = [...piattiCon].sort((a,b)=>b.c.costo_porz_sicuro-a.c.costo_porz_sicuro).slice(0,5);
  const worstFC = [...piattiCon].filter(x=>x.c.foodcost_pct>0).sort((a,b)=>b.c.foodcost_pct-a.c.foodcost_pct).slice(0,5);

  root.innerHTML='';
  root.append(
    el('div',{class:'view-head'},[
      el('h1',{text:settings.nome_locale ? settings.nome_locale : 'Dashboard'}),
      el('div',{class:'actions'},[
        el('a',{href:'#piatti',class:'btn',text:'→ Piatti'}),
        el('a',{href:'#ingredienti',class:'btn',text:'→ Ingredienti'}),
      ])
    ]),
    el('div',{class:'view-sub',text:`Target food cost: ${target}%. Le voci sotto target sono in verde, vicino al limite in giallo, oltre in rosso.`}),
    el('div',{class:'grid-4',style:{marginBottom:'18px'}},[
      kpiCard('Piatti', k.n_piatti),
      kpiCard('Ingredienti', k.n_ingredienti),
      kpiCard('Food cost medio', k.foodcost_medio?fmtPct(k.foodcost_medio):'—'),
      kpiCard('Costo medio porz.', k.costo_medio_porz?fmtEur(k.costo_medio_porz):'—'),
    ]),
    el('div',{class:'grid-2'},[
      el('div',{class:'card'},[
        el('h2',{text:'Piatti più costosi (per porzione)'}),
        topCost.length===0 ? el('p',{class:'muted',text:'Crea un piatto per vedere la classifica.'}) : listSimple(topCost,'cost'),
      ]),
      el('div',{class:'card'},[
        el('h2',{text:'Food cost più alto'}),
        worstFC.length===0 ? el('p',{class:'muted',text:'Imposta i prezzi di vendita sui piatti per calcolare il food cost.'}) : listSimple(worstFC,'fc', target),
      ]),
    ])
  );
}

function kpiCard(label,value){
  return el('div',{class:'card'},[ el('div',{class:'kpi'},[
    el('span',{class:'kpi-label',text:label}),
    el('span',{class:'kpi-value',text:value}),
  ])]);
}

function listSimple(rows, kind, target=30){
  const root = el('div',{class:'list'});
  for(const {p,c} of rows){
    const right = kind==='cost'
      ? el('b',{text:fmtEur(c.costo_porz_sicuro)})
      : (()=>{ const cls = c.foodcost_pct<=target?'ok':c.foodcost_pct<=target+8?'warn':'err';
               return el('span',{class:'badge '+cls,text:fmtPct(c.foodcost_pct)}); })();
    root.appendChild(el('div',{class:'list-item'},[
      el('div',{class:'grow'},[
        el('div',{class:'title',text:p.nome}),
        el('div',{class:'sub',text:(p.categoria||'—')}),
      ]),
      right,
    ]));
  }
  return root;
}

RM.modules.dashboard = {mount, unmount};
})();
