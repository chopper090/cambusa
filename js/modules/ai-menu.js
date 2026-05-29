(function(){
'use strict';
const RM = window.RM = window.RM || {};
RM.modules = RM.modules || {};
const {el, toast} = RM.utils;
const {store} = RM;

function mount(root){
  const ingr = store.all('ingredienti');
  root.innerHTML='';
  const fIng = el('textarea',{placeholder:'Es. pomodoro, mozzarella, basilico, farina 00…',style:{minHeight:'90px'}});
  const fStile = el('input',{type:'text',placeholder:'Es. cucina italiana stagionale, comfort food, mediterranea…'});
  const fStag  = el('select');
  for(const s of ['','primavera','estate','autunno','inverno']) fStag.appendChild(el('option',{value:s,text:s||'— qualsiasi —'}));
  const fBudget= el('input',{type:'number',min:'0',step:'0.5',placeholder:'Es. 4.50'});
  const fVinc  = el('input',{type:'text',placeholder:'Es. vegano, gluten-free, no maiale…'});

  root.append(
    el('div',{class:'view-head'},[
      el('h1',{},['AI Menù ',el('span',{class:'tag-pill',text:'BETA'})]),
    ]),
    el('div',{class:'view-sub',text:'Funzione in arrivo: genera idee di menù partendo dalle materie prime, con tecniche di cottura e abbinamenti.'}),
    el('div',{class:'card'},[
      el('div',{class:'field'},[el('label',{text:'Ingredienti disponibili'}), fIng,
        ingr.length?el('span',{class:'hint',text:`Hai ${ingr.length} ingredienti in anagrafica. In futuro potrai selezionarli direttamente.`}):null]),
      el('div',{class:'grid-2'},[
        el('div',{class:'field'},[el('label',{text:'Stile cucina'}),fStile]),
        el('div',{class:'field'},[el('label',{text:'Stagione'}),fStag]),
      ]),
      el('div',{class:'grid-2'},[
        el('div',{class:'field'},[el('label',{text:'Budget food cost / porzione (€)'}),fBudget]),
        el('div',{class:'field'},[el('label',{text:'Vincoli'}),fVinc]),
      ]),
      el('div',{class:'row end',style:{marginTop:'12px'}},[
        el('button',{class:'btn btn-primary',text:'Genera proposta (preview)',onclick:()=>toast('Funzione in arrivo: integrazione con LLM','')}),
      ]),
      el('hr',{class:'sep'}),
      el('div',{class:'muted',style:{fontSize:'12px'}},[
        el('p',{text:'Roadmap della feature:'}),
        el('ul',{style:{margin:'6px 0 0 18px',padding:0}},[
          el('li',{text:'Knowledge base locale (JSON) con tecniche × ingrediente × abbinamenti classici.'}),
          el('li',{text:'Endpoint Anthropic API per generare 3-5 proposte di piatti coerenti coi vincoli.'}),
          el('li',{text:'Output: piatti pre-compilati pronti per la sezione Piatti, con stima foodcost.'}),
        ])
      ])
    ])
  );
}
function unmount(){}

RM.modules['ai-menu'] = {mount, unmount};
})();
