(function(){
'use strict';
const RM = window.RM = window.RM || {};
RM.modules = RM.modules || {};
const {el, fmtEur, fmtPct, baseUnitLabel, toast} = RM.utils;
const {store, onChange} = RM;
const {foodcostPiatto, ingredientiMap} = RM.calc;

let off=null;
function mount(r){ render(r); off=onChange(()=>render(r)); }
function unmount(){ off?.(); off=null; }

function render(root){
  const piatti = store.all('piatti');
  const ingMap = ingredientiMap();
  root.innerHTML='';
  root.append(
    el('div',{class:'view-head'},[
      el('h1',{text:'Ricettario'}),
      el('div',{class:'actions'},[
        el('button',{class:'btn',text:'Stampa anteprima',onclick:()=>window.print()}),
        el('a',{class:'btn',href:'#ricettario-editor',text:'✎ Editor Canva'}),
        el('button',{class:'btn btn-primary',text:'PDF rapido',disabled:piatti.length===0,onclick:()=>RM.pdf.esportaRicettario()}),
      ])
    ]),
    el('div',{class:'view-sub'},[
      'Anteprima del manuale di cucina. Ogni piatto è una scheda; clicca ',
      el('b',{text:'Modifica procedimento'}),
      ' per aggiungere i dettagli senza tornare nella sezione Piatti.'
    ]),
    piatti.length===0
      ? el('div',{class:'tbl-wrap'},[ el('div',{class:'tbl-empty'},[el('h3',{text:'Nessun piatto'}),el('p',{class:'muted',text:'Crea i tuoi piatti per generare il ricettario.'})])])
      : pages(piatti, ingMap)
  );
}

function pages(piatti, ingMap){
  const wrap = el('div',{class:'recettario-print'});
  for(const p of piatti){
    const c = foodcostPiatto(p, ingMap);
    const ingrLines = (p.ingredienti||[]).map(r=>{
      const ing = ingMap.get(r.ing_id);
      if(!ing) return el('tr',{},[el('td',{colspan:3,class:'muted',text:'(ingrediente non trovato)'})]);
      return el('tr',{},[
        el('td',{text:ing.nome}),
        el('td',{class:'num',text:r.grammi+' '+baseUnitLabel(ing.unita)}),
        el('td',{class:'muted',text:r.note||''}),
      ]);
    });
    const card = el('div',{class:'card',style:{marginBottom:'18px',pageBreakAfter:'always'}},[
      el('div',{class:'row between wrap',style:{borderBottom:'1px solid var(--border)',paddingBottom:'10px',marginBottom:'12px'}},[
        el('div',{},[
          el('h2',{text:p.nome,style:{fontSize:'22px'}}),
          el('div',{class:'muted',text:`${p.categoria||'—'} · ${p.porzioni||1} porz. · ${p.tempo_min||0} min · ${p.difficolta||'—'}`}),
        ]),
        el('div',{style:{textAlign:'right'}},[
          el('div',{class:'kpi-label',text:'Costo / porzione'}),
          el('div',{style:{fontSize:'20px',fontWeight:'600'},text:fmtEur(c.costo_porz_sicuro)}),
          p.prezzo_vendita ? el('div',{class:'muted',style:{fontSize:'12px'},text:`Prezzo ${fmtEur(p.prezzo_vendita)} · FC ${fmtPct(c.foodcost_pct)}`}) : null,
        ])
      ]),
      el('div',{class:'grid-2',style:{gap:'24px'}},[
        el('div',{},[
          el('h3',{text:'Ingredienti'}),
          el('table',{class:'tbl',style:{marginTop:'8px'}},[
            el('thead',{},[el('tr',{},[el('th',{text:'Ingrediente'}),el('th',{class:'num',text:'Quantità'}),el('th',{text:'Note'})])]),
            el('tbody',{}, ingrLines.length?ingrLines:[el('tr',{},[el('td',{colspan:3,class:'muted',text:'—'})])]),
          ]),
          c.allergeni.length ? el('div',{style:{marginTop:'10px'}},[
            el('div',{class:'kpi-label',text:'Allergeni'}),
            el('div',{class:'chips',style:{marginTop:'4px'}}, c.allergeni.map(a=>el('span',{class:'badge warn',text:a})))
          ]) : null,
        ]),
        el('div',{},[
          el('div',{class:'row between'},[
            el('h3',{text:'Procedimento'}),
            el('button',{class:'btn btn-sm no-print',text:'Modifica procedimento',onclick:()=>editProc(p)}),
          ]),
          el('div',{style:{whiteSpace:'pre-wrap',lineHeight:'1.65',marginTop:'8px',color: p.procedimento?'var(--text)':'var(--text-3)'},text:p.procedimento || '— da compilare —'}),
        ]),
      ])
    ]);
    wrap.appendChild(card);
  }
  return wrap;
}

function editProc(p){
  const ta = RM.utils.el('textarea',{value:p.procedimento||'',style:{minHeight:'260px'},placeholder:'Procedimento dettagliato…'});
  const {close} = RM.utils.openModal({
    title:'Procedimento — '+p.nome,
    body: ta,
    footer:[
      RM.utils.el('button',{class:'btn',text:'Annulla',onclick:()=>close()}),
      RM.utils.el('button',{class:'btn btn-primary',text:'Salva',onclick:()=>{
        p.procedimento = ta.value.trim();
        store.upsert('piatti', p);
        toast('Procedimento salvato','ok'); close();
      }}),
    ]
  });
}

RM.modules.ricettario = {mount, unmount};
})();
