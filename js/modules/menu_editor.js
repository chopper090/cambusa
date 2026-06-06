(function(){
'use strict';
const RM = window.RM = window.RM || {};
RM.modules = RM.modules || {};
const {el, fmtEur, toast, confirmDialog, CATEGORIE_PIATTI} = RM.utils;
const {store, onChange} = RM;

const M = 56, PW = 794;
let eng=null, docRef=null, menuId=null, off=null;

function mount(root){
  const params = new URLSearchParams((location.hash.split('?')[1]||''));
  menuId = params.get('id') || store.all('menu')[0]?.id;
  if(!menuId){ renderEmpty(root); return; }
  const m = store.get('menu', menuId);
  docRef = (m && m.layout && m.layout.pages) ? structuredClone(m.layout) : buildFromMenu(m);
  buildEditor(root, m);
  off = onChange(k=>{ if(k==='piatti'||k==='settings') eng?.redraw(); });
}
function unmount(){ off?.(); off=null; eng?.destroy(); eng=null; }

function renderEmpty(root){
  root.innerHTML='';
  root.append(
    el('div',{class:'view-head'},[el('h1',{text:'Editor Menù'})]),
    el('div',{class:'card'},[ el('p',{class:'muted',text:'Crea prima un menù nella sezione "Menù", poi apri l\'editor da lì.'}), el('a',{href:'#menu',class:'btn btn-primary',style:{marginTop:'10px'},text:'→ Vai a Menù'}) ])
  );
}

function persist(){ const m=store.get('menu',menuId); if(m){ m.layout=docRef; store.upsert('menu',m); } }

function buildFromMenu(m){
  const s = store.getSettings();
  // stile del ristorante attivo (palette + font + decori)
  const t = (RM.clients && RM.clients.resolve) ? RM.clients.resolve(store.getActive()) : null;
  const ink = t?.ink || '#191918', paper = t?.paper || '#ffffff', gold = t?.gold || '#191918', muted = t?.muted || '#737373';
  const fDisp = t?.fontDisplay || 'Playfair Display, serif', fBody = t?.fontBody || 'Playfair Display, serif';
  const coast = t?.decor === 'coast';
  const tr = coast ? 'upper' : '';
  const dishStyle = {fontFamily:fBody, fontSize:15, color:ink, priceColor:gold, descColor:muted, priceSep:coast?'|':''};
  const W = PW-2*M;
  const items=[
    {id:rid(),type:'text',x:M,y:60,w:W,h:64,z:5,rot:0,text:s.nome_locale||'Il nostro menù',style:{fontFamily:fDisp,fontSize:42,color:ink,align:'center',weight:700,italic:false,lineHeight:1.1,transform:tr}},
    {id:rid(),type:'text',x:M,y:130,w:W,h:28,z:5,rot:0,text:m?.nome||'',style:{fontFamily:fDisp,fontSize:16,color:muted,align:'center',weight:500,italic:true,lineHeight:1.2}},
    {id:rid(),type:'line',x:PW/2-60,y:168,w:120,h:2,z:5,rot:0,style:{color:gold,thickness:2}},
  ];
  const pById = new Map(store.all('piatti').map(p=>[p.id,p]));
  const piatti = (m?.piatti_ids||[]).map(id=>pById.get(id)).filter(Boolean);
  const grouped={}; for(const c of CATEGORIE_PIATTI) grouped[c]=[]; grouped['altro']=[];
  for(const p of piatti){ const k=grouped[p.categoria]?p.categoria:'altro'; grouped[k].push(p); }
  let y=205;
  for(const cat of CATEGORIE_PIATTI){
    const list=grouped[cat]; if(!list?.length) continue;
    items.push({id:rid(),type:'text',x:M,y,w:W,h:32,z:5,rot:0,text:cat.charAt(0).toUpperCase()+cat.slice(1)+(list.length>1?'i':''),style:{fontFamily:fDisp,fontSize:22,color:ink,align:'center',weight:700,italic:false,lineHeight:1.2,transform:tr}});
    y+=40;
    for(const p of list){ items.push({id:rid(),type:'dish',x:M,y,w:W,h:48,z:6,rot:0,dishId:p.id,showPrice:true,showDesc:true,style:{...dishStyle}}); y+=54; if(y>1040){break;} }
    y+=14; if(y>1040) break;
  }
  return {pages:[{id:'pg_'+rid(),bg:paper,wm:'', items}]};
}
function rid(){ return Math.random().toString(36).slice(2,8); }

function buildEditor(root, m){
  root.innerHTML='';
  root.append(
    el('div',{class:'view-head'},[
      el('h1',{},['Editor Menù ', el('span',{class:'count',text:m?.nome||'—'})]),
      el('div',{class:'actions'},[
        el('a',{href:'#menu',class:'btn btn-ghost',text:'← Menù'}),
        el('button',{class:'btn',text:'💾 Salva',onclick:()=>{persist();toast('Layout salvato','ok');}}),
      ])
    ]),
    el('div',{class:'view-sub',text:'Impagina il menù come in Canva. I piatti restano collegati ai dati reali (prezzo, descrizione). Trascina, ridimensiona, aggiungi elementi.'}),
  );
  const host=el('div'); root.append(host);
  eng = RM.canvas.create({
    root:host, doc:docRef, fmt:'a4', exportName:'menu_'+((m?.nome||'menu').replace(/[^a-z0-9]+/gi,'_').toLowerCase()),
    onChange:(d)=>{docRef=d;persist();},
    boundHTML, boundPDF, boundLabelShort:()=>'Piatto', boundInspector,
    extraTools:[{label:'Piatto', icon:'🍽', onAdd:addDish}],
    leftExtras: ()=>{
      const w=el('div',{class:'col'});
      w.append(el('button',{class:'btn btn-sm',text:'↺ Rigenera da menù',onclick:async()=>{
        if(!await confirmDialog('Ricostruire il layout dal contenuto del menù? Le modifiche manuali verranno perse.','Rigenera')) return;
        docRef=buildFromMenu(store.get('menu',menuId)); persist(); eng.destroy(); buildEditor(document.getElementById('view'), store.get('menu',menuId));
      }}));
      return w;
    },
  });
}

function addDish(){
  const piatti=store.all('piatti'); if(!piatti.length){ toast('Crea prima dei piatti','err'); return; }
  const sel=el('select'); for(const p of piatti) sel.appendChild(el('option',{value:p.id,text:p.nome}));
  const {close}=RM.utils.openModal({ title:'Aggiungi piatto', body:el('div',{class:'field'},[el('label',{text:'Piatto'}),sel]),
    footer:[el('button',{class:'btn',text:'Annulla',onclick:()=>close()}),
            el('button',{class:'btn btn-primary',text:'Aggiungi',onclick:()=>{ eng.addItem({type:'dish',x:M,y:200,w:PW-2*M,h:50,dishId:sel.value,showPrice:true,showDesc:true,style:{fontFamily:'Playfair Display, serif',fontSize:15,color:'#191918'}}); close(); }})] });
}

function boundHTML(item){
  const p = store.get('piatti', item.dishId);
  const wrap=el('div',{style:{width:'100%',color:item.style?.color||'#191918',fontFamily:item.style?.fontFamily||'Playfair Display, serif'}});
  if(!p){ wrap.innerHTML='<span style="color:#b3261e;font-size:12px">[piatto non trovato]</span>'; return wrap; }
  const fs=item.style?.fontSize||15;
  const priceColor=item.style?.priceColor||item.style?.color||'#191918';
  const descColor=item.style?.descColor||'#737373';
  const sep=item.style?.priceSep;
  let priceNode=null;
  if(item.showPrice!==false && p.prezzo_vendita){
    priceNode = el('span',{style:{fontWeight:600,fontSize:fs+'px',color:priceColor}},[
      sep ? el('i',{style:{color:descColor,fontStyle:'normal',marginRight:'5px'},text:sep}) : null,
      fmtEur(p.prezzo_vendita),
    ]);
  }
  const head=el('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:'12px'}},[
    el('span',{style:{fontWeight:700,fontSize:fs+'px'},text:p.nome}),
    priceNode,
  ]);
  wrap.appendChild(head);
  if(item.showDesc!==false){
    const desc=(p.procedimento||'').slice(0,160) || (p.ingredienti||[]).slice(0,5).map(r=>store.get('ingredienti',r.ing_id)?.nome).filter(Boolean).join(', ');
    if(desc) wrap.appendChild(el('div',{style:{fontSize:(fs-3)+'px',fontStyle:'italic',color:descColor,marginTop:'2px'},text:desc}));
  }
  return wrap;
}

function boundInspector(item, refresh){
  const wrap=el('div',{class:'col'});
  const piatti=store.all('piatti');
  const sel=el('select',{onchange:e=>{item.dishId=e.target.value;refresh();}});
  for(const p of piatti) sel.appendChild(el('option',{value:p.id,text:p.nome,selected:item.dishId===p.id}));
  wrap.append(el('div',{class:'field'},[el('label',{text:'Piatto'}),sel]));
  const cb1=el('input',{type:'checkbox',checked:item.showPrice!==false,onchange:e=>{item.showPrice=e.target.checked;refresh();}});
  const cb2=el('input',{type:'checkbox',checked:item.showDesc!==false,onchange:e=>{item.showDesc=e.target.checked;refresh();}});
  wrap.append(el('label',{class:'row',style:{gap:'6px',fontSize:'12px',color:'var(--text-2)'}},[cb1,'Mostra prezzo']));
  wrap.append(el('label',{class:'row',style:{gap:'6px',fontSize:'12px',color:'var(--text-2)'}},[cb2,'Mostra descrizione']));
  return wrap;
}

function boundPDF(pdf, item, g){
  const {x,y,w,sc,pdfFont}=g;
  const p=store.get('piatti',item.dishId); if(!p) return;
  const fs=(item.style?.fontSize||15)*sc;
  pdfFont(pdf, item.style?.fontFamily||'Playfair', 700, false);
  pdf.setFontSize(fs).setTextColor(item.style?.color||'#191918');
  pdf.text(p.nome, x, y+fs);
  if(item.showPrice!==false && p.prezzo_vendita){
    pdfFont(pdf,'Inter',600,false);
    pdf.setFontSize(fs).setTextColor(item.style?.priceColor||item.style?.color||'#191918');
    const sep=item.style?.priceSep ? item.style.priceSep+' ' : '';
    pdf.text(sep+fmtEur(p.prezzo_vendita), x+w, y+fs, {align:'right'});
  }
  if(item.showDesc!==false){
    const desc=(p.procedimento||'').slice(0,160);
    if(desc){ pdfFont(pdf,'Playfair',400,true); pdf.setFontSize(fs*0.8).setTextColor(item.style?.descColor||'#737373'); pdf.splitTextToSize(desc,w).slice(0,2).forEach((ln,i)=>pdf.text(ln,x,y+fs+12*sc+i*fs*0.95)); }
  }
}

RM.modules['menu-editor'] = {mount, unmount};
})();
