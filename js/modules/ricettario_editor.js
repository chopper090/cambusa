(function(){
'use strict';
const RM = window.RM = window.RM || {};
RM.modules = RM.modules || {};
const {el, fmtEur, fmtPct, baseUnitLabel, toast, confirmDialog} = RM.utils;
const {store, onChange} = RM;

const M = 64;                  // margine pagina
const PW = 794, PH = 1123;
// palette template (blu professionale)
const BLU = '#2f6fb0';         // titolo + intestazioni sezione
const NAVY = '#243f63';        // separatori
const BODY = '#1f2937';        // testo corpo
let eng=null, docRef=null, off=null;

function mount(root){
  docRef = loadDoc();
  buildEditor(root);
  off = onChange(k=>{ if(k==='piatti'||k==='ingredienti'||k==='settings'){ eng?.redraw(); } });
}
function unmount(){ off?.(); off=null; eng?.destroy(); eng=null; }

function loadDoc(){
  const s = store.getSettings();
  let d = s.ricettario_layout;
  if(d && d.pages && d.pages.length) return syncPages(structuredClone(d));
  return buildFromPiatti();
}
// allinea le pagine ai piatti esistenti (aggiunge pagine per nuovi piatti, segnala mancanti)
function syncPages(d){
  const piatti = store.all('piatti');
  const have = new Set(d.pages.map(p=>p.piattoId).filter(Boolean));
  for(const p of piatti){ if(!have.has(p.id)) d.pages.push(makePage(p.id)); }
  return d;
}
function buildFromPiatti(){
  const piatti = store.all('piatti');
  const pages = piatti.length ? piatti.map(p=>makePage(p.id)) : [makePage(null)];
  return {pages};
}
function head(text,x,y,w){
  return {id:rid(),type:'text',x,y,w,h:28,z:3,rot:0,text,
    style:{fontFamily:'Poppins, sans-serif',fontSize:15,color:BLU,align:'left',weight:600,italic:false,underline:false,transform:'upper',lineHeight:1.2}};
}
function imgSlot(x,y,w,h,label,opacity){
  return {id:rid(),type:'image',x,y,w,h,z:4,rot:0,src:'',placeholder:label,style:{fit:'contain',opacity:opacity!=null?opacity:1}};
}
function makePage(piattoId){
  const W = PW-2*M;
  return {
    id:'pg_'+Math.random().toString(36).slice(2,8), bg:'#ffffff', wm:'', piattoId,
    items:[
      // logo locale in alto (placeholder, lo inserisce l'utente)
      imgSlot((PW-180)/2, 40, 180, 70, 'LOGO LOCALE'),
      // separatore sotto al logo
      {id:rid(),type:'line', x:M, y:122, w:W, h:3, z:2, rot:0, style:{color:NAVY, thickness:3}},
      // nome ricetta (titolo blu, centrato)
      it('recipe-title', M, 138, W, 50, {fontFamily:'Poppins, sans-serif',fontSize:30,color:BLU,align:'center',weight:600,italic:false,underline:false,transform:'',lineHeight:1.1}),
      // INGREDIENTI
      head('Ingredienti', M, 210, W),
      it('recipe-ingredients', M, 244, W, 170, {fontFamily:'Inter, sans-serif',fontSize:13,color:BODY,align:'left',weight:400,italic:false,lineHeight:1.6}),
      // PREPARAZIONE
      head('Preparazione', M, 430, W),
      it('recipe-procedure', M, 464, W, 200, {fontFamily:'Inter, sans-serif',fontSize:13,color:BODY,align:'left',weight:400,italic:false,lineHeight:1.55}),
      // IMPIATTAMENTO
      head('Impiattamento', M, 686, W),
      it('recipe-impiattamento', M, 720, W, 150, {fontFamily:'Inter, sans-serif',fontSize:13,color:BODY,align:'left',weight:400,italic:false,lineHeight:1.55}),
      // separatore in basso
      {id:rid(),type:'line', x:M, y:998, w:W, h:3, z:2, rot:0, style:{color:NAVY, thickness:3}},
      // logo piccolo locale (centro)
      imgSlot((PW-110)/2, 1016, 110, 56, 'logo piccolo'),
      // filigrana logo in basso a destra
      imgSlot(PW-M-120, 1024, 120, 70, 'filigrana', 0.28),
    ]
  };
}
function it(type,x,y,w,h,style){ return {id:rid(),type,x,y,w,h,z:3,rot:0,style:style||{}}; }
function rid(){ return 'it_'+Math.random().toString(36).slice(2,8); }

function persist(){ store.setSettings({ricettario_layout: docRef}); }

function pageOf(itemId){
  for(const pg of docRef.pages){ if(pg.items.some(i=>i.id===itemId)) return pg; }
  return null;
}
function piattoOfItem(item){
  const pg = pageOf(item.id);
  const pid = item.piattoId || pg?.piattoId;
  return pid ? store.get('piatti', pid) : null;
}

function buildEditor(root){
  root.innerHTML='';
  const piatti = store.all('piatti');
  root.append(
    el('div',{class:'view-head'},[
      el('h1',{},['Editor Ricettario ', el('span',{class:'count',text:`(${docRef.pages.length} pagine)`})]),
      el('div',{class:'actions'},[
        el('a',{href:'#ricettario',class:'btn btn-ghost',text:'← Ricettario'}),
        el('button',{class:'btn',text:'💾 Salva layout',onclick:()=>{persist();toast('Layout salvato','ok');}}),
      ])
    ]),
    el('div',{class:'view-sub',text:'Una pagina per ricetta, modificabile come in Canva: trascina, ridimensiona, aggiungi testo/immagini/linee. I campi "ricetta" si aggiornano in automatico dai dati dei Piatti.'}),
  );
  if(!piatti.length){
    root.append(el('div',{class:'card'},[ el('p',{class:'muted',text:'Crea prima dei piatti per generare il ricettario.'}), el('a',{href:'#piatti',class:'btn btn-primary',style:{marginTop:'10px'},text:'→ Vai a Piatti'}) ]));
    return;
  }
  const host = el('div'); root.append(host);

  eng = RM.canvas.create({
    root: host, doc: docRef, fmt:'a4', exportName:'ricettario',
    onChange:(d)=>{ docRef=d; persist(); },
    boundHTML, boundPDF, boundLabelShort, boundInspector,
    isTextlike:(it)=> (it.type||'').startsWith('recipe') && it.type!=='recipe-image',
    extraTools:[
      {label:'Campo ricetta', icon:'🍝', onAdd:addRecipeField},
    ],
    leftExtras: pageBindControl,
  });
}

// pannello in fondo all'inspector pagina: scegli a quale piatto è legata la pagina attiva
function pageBindControl(){
  // troviamo la pagina attiva: l'engine non la espone, ma possiamo dedurla dalla prima pagina con items renderizzati.
  // Più semplice: offrire un selettore che applica al "piatto della pagina corrente" via prompt sugli item recipe.
  const wrap = el('div',{class:'col'});
  wrap.append(el('h4',{text:'Ricetta della pagina'}));
  const piatti = store.all('piatti');
  const sel = el('select');
  sel.appendChild(el('option',{value:'',text:'— scegli piatto —'}));
  for(const p of piatti) sel.appendChild(el('option',{value:p.id,text:p.nome}));
  wrap.append(sel);
  wrap.append(el('button',{class:'btn btn-sm',style:{marginTop:'6px'},text:'Applica alla pagina visibile',onclick:()=>{
    const pid = sel.value; if(!pid){ toast('Scegli un piatto','err'); return; }
    // applica alla pagina che contiene un elemento selezionato, o alla prima visibile nello stage
    const visible = visiblePage();
    if(visible){ visible.piattoId = pid; persist(); eng.redraw(); toast('Ricetta assegnata alla pagina','ok'); }
  }}));
  wrap.append(el('hr',{class:'sep'}));
  wrap.append(el('button',{class:'btn btn-sm',text:'↺ Rigenera da Piatti',onclick:async()=>{
    if(!await confirmDialog('Ricostruire il ricettario dai piatti? Le modifiche manuali al layout verranno perse.','Rigenera')) return;
    docRef = buildFromPiatti(); persist(); eng.destroy();
    buildEditor(document.getElementById('view'));
  }}));
  return wrap;
}
function visiblePage(){
  // pagina il cui thumbnail è marcato .on
  const thumbs=[...document.querySelectorAll('.cnv-thumb')];
  const idx=thumbs.findIndex(t=>t.classList.contains('on'));
  return docRef.pages[idx>=0?idx:0];
}

function addRecipeField(){
  const fields = [
    ['recipe-title','Nome ricetta'],['recipe-meta','Info (categoria/porzioni)'],
    ['recipe-ingredients','Ingredienti'],['recipe-procedure','Preparazione'],['recipe-impiattamento','Impiattamento'],
    ['recipe-foodcost','Food cost'],['recipe-allergeni','Allergeni'],['recipe-image','Foto piatto'],
  ];
  const sel = el('select'); for(const [v,l] of fields) sel.appendChild(el('option',{value:v,text:l}));
  const {close} = RM.utils.openModal({
    title:'Aggiungi campo ricetta', body: el('div',{class:'field'},[el('label',{text:'Tipo di campo'}), sel]),
    footer:[ el('button',{class:'btn',text:'Annulla',onclick:()=>close()}),
             el('button',{class:'btn btn-primary',text:'Aggiungi',onclick:()=>{ eng.addItem(it(sel.value, 80, 120, sel.value==='recipe-image'?200:300, sel.value==='recipe-procedure'?400:60)); close(); }}) ]
  });
}

// ============ BOUND RENDERING ============
function ctx(item){
  const p = piattoOfItem(item); if(!p) return null;
  const ingMap = RM.calc.ingredientiMap();
  return {p, ingMap, c:RM.calc.foodcostPiatto(p, ingMap)};
}

function boundLabelShort(it){
  const L={'recipe-title':'Nome ricetta','recipe-meta':'Info','recipe-ingredients':'Ingredienti','recipe-procedure':'Preparazione','recipe-impiattamento':'Impiattamento','recipe-foodcost':'Food cost','recipe-allergeni':'Allergeni','recipe-image':'Foto'};
  return L[it.type]||'Campo';
}

// applica le proprietà di stile (impostabili da Canva) a un nodo testo
function applyStyle(node, s){
  s=s||{};
  node.style.fontFamily = s.fontFamily||'Inter, sans-serif';
  node.style.fontSize = (s.fontSize||13)+'px';
  node.style.color = s.color||BODY;
  node.style.textAlign = s.align||'left';
  node.style.fontWeight = s.weight||400;
  node.style.fontStyle = s.italic?'italic':'normal';
  node.style.textDecoration = s.underline?'underline':'none';
  node.style.lineHeight = s.lineHeight||1.5;
  node.classList.remove('cnv-sentence');
  if(s.transform==='upper') node.style.textTransform='uppercase';
  else if(s.transform==='lower') node.style.textTransform='lowercase';
  else if(s.transform==='caps') node.style.textTransform='capitalize';
  else if(s.transform==='sentence'){ node.style.textTransform='none'; node.classList.add('cnv-sentence'); }
  else node.style.textTransform='none';
}

function boundHTML(item){
  const data = ctx(item);
  const wrap = el('div',{style:{width:'100%',height:'100%',overflow:'hidden'}});
  if(!data){ wrap.appendChild(el('span',{style:{color:'#b3261e',fontSize:'12px',fontFamily:'Inter,sans-serif'},text:'[assegna una ricetta a questa pagina]'})); return wrap; }
  const {p,c,ingMap}=data;
  applyStyle(wrap, item.style);
  switch(item.type){
    case 'recipe-title':
      wrap.textContent = p.nome||'—'; break;
    case 'recipe-meta':
      wrap.textContent = `${p.categoria||'—'}  ·  ${p.porzioni||1} porzioni  ·  ${p.tempo_min||0} min  ·  ${p.difficolta||'—'}`; break;
    case 'recipe-ingredients':{
      const lines = (p.ingredienti||[]).map(r=>{ const ing=ingMap.get(r.ing_id); return ing? `•  ${ing.nome}, ${RM.utils.formatQty(r.grammi, ing.unita)}` : null; }).filter(Boolean);
      wrap.style.whiteSpace='pre-wrap';
      wrap.textContent = lines.length? lines.join('\n') : '—'; break;
    }
    case 'recipe-procedure':
      wrap.style.whiteSpace='pre-wrap';
      if(!p.procedimento) wrap.style.color='#9aa0a6';
      wrap.textContent = p.procedimento || '— preparazione da compilare —'; break;
    case 'recipe-impiattamento':
      wrap.style.whiteSpace='pre-wrap';
      if(!p.impiattamento) wrap.style.color='#9aa0a6';
      wrap.textContent = p.impiattamento || '— impiattamento da compilare —'; break;
    case 'recipe-foodcost':
      wrap.innerHTML = `<div style="font-size:.62em;text-transform:uppercase;letter-spacing:.05em;opacity:.7">Costo / porzione</div>
        <div style="font-size:1.3em;font-weight:700">${fmtEur(c.costo_porz_sicuro)}</div>
        ${p.prezzo_vendita?`<div style="font-size:.72em;opacity:.7">prezzo ${fmtEur(p.prezzo_vendita)} · FC ${fmtPct(c.foodcost_pct)}</div>`:''}`;
      break;
    case 'recipe-allergeni':
      if(c.allergeni.length){
        wrap.innerHTML = `<span style="text-transform:uppercase;letter-spacing:.05em;opacity:.7;font-size:.85em">Allergeni:</span> ${c.allergeni.join(' · ')}`;
      } else { wrap.style.color='#9aa0a6'; wrap.textContent='Nessun allergene'; }
      break;
    case 'recipe-image':
      if(p.foto_dataurl){ const im=el('img',{src:p.foto_dataurl}); im.style.width='100%';im.style.height='100%';im.style.objectFit='cover'; wrap.appendChild(im); }
      else { wrap.style.border='1.5px dashed #ccc'; wrap.style.display='grid'; wrap.style.placeItems='center'; wrap.style.color='#9aa0a6'; wrap.style.fontFamily='Inter,sans-serif'; wrap.style.fontSize='12px'; wrap.textContent='Nessuna foto'; }
      break;
  }
  return wrap;
}

function boundInspector(item, refresh){
  const wrap = el('div',{class:'col'});
  const data = ctx(item);
  wrap.append(el('div',{class:'muted',style:{fontSize:'12px'},text: data? `Ricetta: ${data.p.nome}` : 'Pagina senza ricetta assegnata'}));
  // override piatto per singolo campo
  const piatti = store.all('piatti');
  const sel = el('select',{onchange:e=>{ item.piattoId=e.target.value||undefined; refresh(); }});
  sel.appendChild(el('option',{value:'',text:'(usa ricetta della pagina)'}));
  for(const p of piatti) sel.appendChild(el('option',{value:p.id,text:p.nome,selected:item.piattoId===p.id}));
  wrap.append(el('div',{class:'field',style:{marginTop:'6px'}},[el('label',{text:'Collega a piatto specifico'}), sel]));
  return wrap;
}

// disegna testo multi-riga rispettando item.style (font, size, color, align, underline, transform, interlinea)
function drawStyled(pdf, str, item, g, defColor){
  const {x,y,w,h,sc,pdfFont}=g; const s=item.style||{};
  const fs=(s.fontSize||13)*sc;
  pdfFont(pdf, s.fontFamily, s.weight||400, !!s.italic);
  pdf.setFontSize(fs).setTextColor(s.color||defColor||'#1f2937');
  const al=s.align||'left'; const ax= al==='center'?x+w/2 : al==='right'?x+w : x;
  const txt = RM.utils.applyCase(str, s.transform);
  const lines = pdf.splitTextToSize(txt, w);
  const lh = fs*(s.lineHeight||1.5);
  let yy=y+fs;
  for(const ln of lines){
    if(yy>y+h+fs) break;
    pdf.text(ln, ax, yy, {align:(al==='justify'?'left':al)});
    if(s.underline){ const tw=pdf.getTextWidth(ln); const ux=al==='center'?ax-tw/2:al==='right'?ax-tw:ax; pdf.setDrawColor(s.color||defColor||'#1f2937').setLineWidth(Math.max(0.3,fs*0.05)); pdf.line(ux,yy+fs*0.12,ux+tw,yy+fs*0.12); }
    yy+=lh;
  }
}

function boundPDF(pdf, item, g){
  const {x,y,w,h,sc}=g;
  const data=ctx(item); if(!data) return;
  const {p,c,ingMap}=data;
  switch(item.type){
    case 'recipe-title':   drawStyled(pdf, p.nome||'—', item, g, BLU); break;
    case 'recipe-meta':    drawStyled(pdf, `${p.categoria||'—'}  ·  ${p.porzioni||1} porzioni  ·  ${p.tempo_min||0} min  ·  ${p.difficolta||'—'}`, item, g, '#737373'); break;
    case 'recipe-ingredients':{
      const lines=(p.ingredienti||[]).map(r=>{const ing=ingMap.get(r.ing_id);return ing?`•  ${ing.nome}, ${RM.utils.formatQty(r.grammi, ing.unita)}`:null;}).filter(Boolean);
      drawStyled(pdf, lines.length?lines.join('\n'):'—', item, g, BODY); break;
    }
    case 'recipe-procedure':     drawStyled(pdf, p.procedimento||'—', item, g, BODY); break;
    case 'recipe-impiattamento': drawStyled(pdf, p.impiattamento||'—', item, g, BODY); break;
    case 'recipe-allergeni':     drawStyled(pdf, c.allergeni.length?('Allergeni: '+c.allergeni.join(' · ')):'Nessun allergene', item, g, '#a25c00'); break;
    case 'recipe-foodcost':{
      const pdfFont=g.pdfFont;
      pdfFont(pdf,'Inter',400,false); pdf.setFontSize(8*sc).setTextColor('#737373'); pdf.text('COSTO / PORZIONE', x+w, y+8*sc, {align:'right'});
      pdfFont(pdf,'Inter',700,false); pdf.setFontSize(15*sc).setTextColor(item.style?.color||BLU); pdf.text(fmtEur(c.costo_porz_sicuro), x+w, y+24*sc, {align:'right'});
      if(p.prezzo_vendita){ pdfFont(pdf,'Inter',400,false); pdf.setFontSize(9*sc).setTextColor('#737373'); pdf.text(`prezzo ${fmtEur(p.prezzo_vendita)} · FC ${fmtPct(c.foodcost_pct)}`, x+w, y+36*sc, {align:'right'}); }
      break;
    }
    case 'recipe-image':
      if(p.foto_dataurl){ try{ pdf.addImage(p.foto_dataurl, /png/i.test(p.foto_dataurl.slice(0,20))?'PNG':'JPEG', x,y,w,h,undefined,'FAST'); }catch(e){} }
      break;
  }
}

RM.modules['ricettario-editor'] = {mount, unmount};
})();
