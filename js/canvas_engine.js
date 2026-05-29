(function(){
'use strict';
const RM = window.RM = window.RM || {};
const {el, toast} = RM.utils;

// Pagina A4 a 96dpi
const PAGE = {a4:{w:794, h:1123}, a4l:{w:1123, h:794}, a5:{w:559, h:794}};
const GRID = 10;          // snap-to-grid in px logici
const SNAP = 6;           // soglia snap a guide
const PT = {w:595.28, h:841.89}; // A4 in pt (portrait)

// helper jsPDF font (fix combinazioni valide: only normal/bold/italic/bolditalic su helvetica/times/courier)
function pdfFont(doc, family, weight, italic){
  const f = (family||'').toLowerCase();
  const base = /mono|courier/.test(f) ? 'courier'
             : /serif|times|georgia|playfair|garamond/.test(f) ? 'times'
             : 'helvetica';
  let style = 'normal';
  if(weight>=600 && italic) style='bolditalic';
  else if(weight>=600) style='bold';
  else if(italic) style='italic';
  doc.setFont(base, style);
}

// ============================================================================
// create(opts) → editor
// opts = {root, doc, onChange(doc), exportName, fmt:'a4',
//         boundHTML(item)->HTMLElement|null, boundPDF(doc,item,{x,y,w,h,sc})->void,
//         boundLabel(item)->string, extraTools:[{label,icon,onAdd()}], leftExtras()->Node}
// doc = { pages:[ {id, bg, wm, items:[ {id,type,x,y,w,h,rot,z,...} ] } ] }
// ============================================================================
function create(opts){
  const fmt = opts.fmt || 'a4';
  const DIM = PAGE[fmt] || PAGE.a4;
  const doc = opts.doc;
  if(!doc.pages || !doc.pages.length) doc.pages = [newPage()];

  let active = 0;          // pagina attiva
  let selId = null;        // elemento selezionato
  let zoom = 0.72;
  let clipboard = null;
  const undo = [], redo = [];

  // ----- DOM -----
  const rootEl = opts.root;
  rootEl.innerHTML='';
  const wrap = el('div',{class:'cnv-editor'});
  const toolbar = el('div',{class:'cnv-toolbar'});
  const body = el('div',{class:'cnv-body'});
  const pagesPane = el('div',{class:'cnv-pages'});
  const stage = el('div',{class:'cnv-stage'});
  const inspector = el('div',{class:'cnv-inspector'});
  body.append(pagesPane, stage, inspector);
  wrap.append(toolbar, body);
  rootEl.appendChild(wrap);

  const pageEl = el('div',{class:'cnv-page'});
  const guides = el('div',{class:'cnv-guides'});
  const stageInner = el('div',{class:'cnv-stage-inner'});
  stageInner.append(pageEl, guides);
  stage.appendChild(stageInner);

  // ----- helpers -----
  function newPage(){ return {id:'pg_'+Math.random().toString(36).slice(2,8), bg:'#ffffff', wm:'', items:[]}; }
  function curPage(){ return doc.pages[active]; }
  function items(){ return curPage().items; }
  function selItem(){ return items().find(i=>i.id===selId); }
  function maxZ(){ return items().reduce((m,i)=>Math.max(m, i.z||0), 0); }
  function snapshot(){ return JSON.stringify(doc); }
  function commit(){ undo.push(snapshot()); if(undo.length>40) undo.shift(); redo.length=0; opts.onChange?.(doc); }
  function restore(json){ const d=JSON.parse(json); doc.pages=d.pages; if(active>=doc.pages.length) active=doc.pages.length-1; selId=null; opts.onChange?.(doc); drawAll(); }

  // ----- toolbar -----
  function buildToolbar(){
    toolbar.innerHTML='';
    const addBtns = [
      {l:'Testo', i:'𝐓', f:()=>addItem({type:'text', text:'Testo', w:240, h:40, style:{fontFamily:'Inter, sans-serif',fontSize:16,color:'#191918',align:'left',weight:400,italic:false,lineHeight:1.3}})},
      {l:'Titolo', i:'H', f:()=>addItem({type:'text', text:'Titolo', w:420, h:56, style:{fontFamily:'Playfair Display, serif',fontSize:34,color:'#191918',align:'center',weight:700,italic:false,lineHeight:1.15}})},
      {l:'Linea', i:'—', f:()=>addItem({type:'line', w:240, h:2, style:{color:'#191918', thickness:2}})},
      {l:'Rett.', i:'▭', f:()=>addItem({type:'rect', w:220, h:120, style:{fill:'#f0f0ec', stroke:'#00000000', strokeW:0, radius:8}})},
      {l:'Ellisse', i:'◯', f:()=>addItem({type:'ellipse', w:160, h:160, style:{fill:'#eaf1fd', stroke:'#00000000', strokeW:0}})},
      {l:'Immagine', i:'🖼', f:()=>pickImage()},
    ];
    for(const cfg of (opts.extraTools||[])) addBtns.push({l:cfg.label, i:cfg.icon, f:cfg.onAdd});
    const left = el('div',{class:'row',style:{gap:'4px',flexWrap:'wrap'}});
    for(const b of addBtns) left.appendChild(el('button',{class:'cnv-tbtn',title:'Aggiungi '+b.l,onclick:b.f},[el('span',{class:'ic',text:b.i}), el('span',{text:b.l})]));

    const right = el('div',{class:'row',style:{gap:'6px'}});
    right.append(
      el('button',{class:'btn btn-sm',title:'Annulla (Ctrl+Z)',text:'↶',onclick:doUndo}),
      el('button',{class:'btn btn-sm',title:'Ripeti (Ctrl+Y)',text:'↷',onclick:doRedo}),
      zoomCtl(),
      el('button',{class:'btn btn-sm',text:'⤢ Adatta',title:'Adatta alla vista',onclick:fitZoom}),
      el('button',{class:'btn btn-primary btn-sm',text:'⤓ Esporta PDF',onclick:exportPDF}),
    );
    toolbar.append(left, right);
  }
  function zoomCtl(){
    const wrap = el('div',{class:'segment'});
    wrap.append(
      el('button',{text:'–',onclick:()=>setZoom(zoom-0.1)}),
      el('button',{class:'zlabel',text:Math.round(zoom*100)+'%',style:{minWidth:'44px',cursor:'default'}}),
      el('button',{text:'+',onclick:()=>setZoom(zoom+0.1)}),
    );
    return wrap;
  }
  function setZoom(z){ zoom = Math.max(0.25, Math.min(2, Math.round(z*100)/100)); applyZoom(); const zl=toolbar.querySelector('.zlabel'); if(zl) zl.textContent=Math.round(zoom*100)+'%'; }
  function fitZoom(){ const avail = stage.clientWidth - 48; setZoom(avail/DIM.w); }
  function applyZoom(){
    pageEl.style.width = DIM.w+'px'; pageEl.style.height = DIM.h+'px';
    pageEl.style.transform = `scale(${zoom})`;
    stageInner.style.width = (DIM.w*zoom)+'px';
    stageInner.style.height = (DIM.h*zoom)+'px';
    guides.style.transform = `scale(${zoom})`;
    guides.style.width = DIM.w+'px'; guides.style.height = DIM.h+'px';
  }

  // ----- pages pane -----
  function buildPages(){
    pagesPane.innerHTML='';
    pagesPane.appendChild(el('div',{class:'kpi-label',style:{padding:'2px 4px 8px'},text:`Pagine (${doc.pages.length})`}));
    doc.pages.forEach((pg,i)=>{
      const thumb = el('div',{class:'cnv-thumb'+(i===active?' on':''),onclick:()=>{active=i;selId=null;drawAll();}});
      const tb = el('div',{class:'cnv-thumb-page'});
      const s = 150/DIM.w;
      tb.style.width=DIM.w+'px'; tb.style.height=DIM.h+'px'; tb.style.transform=`scale(${s})`; tb.style.background=pg.bg||'#fff';
      for(const it of pg.items){ const n=renderItem(it, true); tb.appendChild(n); }
      const tw = el('div',{class:'cnv-thumb-wrap',style:{height:(DIM.h*s)+'px'}}); tw.appendChild(tb);
      thumb.append(tw, el('div',{class:'cnv-thumb-bar'},[
        el('span',{class:'muted',style:{fontSize:'11px'},text:'Pag. '+(i+1)}),
        el('span',{class:'spacer'}),
        el('button',{class:'btn btn-ghost btn-sm',title:'Duplica',text:'⎘',onclick:e=>{e.stopPropagation();dupPage(i);}}),
        doc.pages.length>1 && el('button',{class:'btn btn-ghost btn-sm',title:'Elimina',text:'×',onclick:e=>{e.stopPropagation();delPage(i);}}),
      ]));
      pagesPane.appendChild(thumb);
    });
    pagesPane.appendChild(el('button',{class:'btn btn-sm',style:{width:'100%',marginTop:'8px'},text:'+ Pagina',onclick:addPage}));
  }
  function addPage(){ doc.pages.splice(active+1,0,newPage()); active++; commit(); drawAll(); }
  function dupPage(i){ const cp=JSON.parse(JSON.stringify(doc.pages[i])); cp.id=newPage().id; cp.items.forEach(it=>it.id='it_'+Math.random().toString(36).slice(2,8)); doc.pages.splice(i+1,0,cp); active=i+1; commit(); drawAll(); }
  function delPage(i){ if(doc.pages.length<=1)return; doc.pages.splice(i,1); if(active>=doc.pages.length)active=doc.pages.length-1; selId=null; commit(); drawAll(); }

  // ----- stage / items render -----
  function drawAll(){ buildToolbar(); buildPages(); drawStage(); buildInspector(); }
  function drawStage(){
    const pg = curPage();
    pageEl.style.background = pg.bg || '#fff';
    const wm = resolveWm(pg.wm);
    pageEl.style.setProperty('--cnv-wm', wm? `url(${wm})` : 'none');
    pageEl.classList.toggle('has-wm', !!wm);
    applyZoom();
    pageEl.innerHTML='';
    const sorted = [...items()].sort((a,b)=>(a.z||0)-(b.z||0));
    for(const it of sorted) pageEl.appendChild(renderItem(it, false));
  }
  function resolveWm(id){
    if(!id) return '';
    const lg = (RM.store.getSettings().logos||[]).find(l=>l.id===id);
    return lg? lg.data : '';
  }

  function renderItem(it, isThumb){
    const d = el('div',{class:'cnv-item'+(!isThumb&&it.id===selId?' selected':'')});
    d.dataset.id = it.id;
    d.style.left=it.x+'px'; d.style.top=it.y+'px'; d.style.width=it.w+'px'; d.style.height=it.h+'px';
    if(it.rot) d.style.transform=`rotate(${it.rot}deg)`;
    d.style.zIndex = it.z||0;

    if(it.type==='text'){
      styleText(d, it);
      d.textContent = it.text||'';
    } else if(it.type==='line'){
      d.style.background='transparent';
      const ln = el('div'); ln.style.position='absolute'; ln.style.left='0'; ln.style.right='0'; ln.style.top='50%';
      ln.style.height=(it.style.thickness||2)+'px'; ln.style.transform='translateY(-50%)'; ln.style.background=it.style.color||'#191918';
      d.appendChild(ln);
    } else if(it.type==='rect'){
      d.style.background=it.style.fill||'#f0f0ec';
      if(it.style.radius) d.style.borderRadius=it.style.radius+'px';
      if(it.style.strokeW) d.style.border=`${it.style.strokeW}px solid ${it.style.stroke||'#000'}`;
    } else if(it.type==='ellipse'){
      d.style.background=it.style.fill||'#eaf1fd'; d.style.borderRadius='50%';
      if(it.style.strokeW) d.style.border=`${it.style.strokeW}px solid ${it.style.stroke||'#000'}`;
    } else if(it.type==='image'){
      if(it.style?.opacity!=null) d.style.opacity=it.style.opacity;
      if(it.src){
        const img = el('img',{src:it.src}); img.style.width='100%'; img.style.height='100%';
        img.style.objectFit = it.style?.fit||'cover'; img.draggable=false;
        d.appendChild(img);
      } else {
        d.style.border='1.5px dashed var(--border-2, #ccc)';
        d.style.display='grid'; d.style.placeItems='center';
        d.style.color='#9a9a9a'; d.style.fontSize='12px'; d.style.fontFamily='Inter, sans-serif';
        d.style.textAlign='center'; d.style.background='rgba(0,0,0,.02)';
        d.appendChild(el('span',{text:it.placeholder||'Immagine (doppio click)'}));
      }
    } else if(it.bound || it.type==='dish' || (it.type||'').startsWith('recipe')){
      // delega al modulo per il contenuto
      const node = opts.boundHTML ? opts.boundHTML(it) : null;
      if(node){ node.style.width='100%'; node.style.height='100%'; node.style.overflow='hidden'; d.appendChild(node); }
      else d.appendChild(el('span',{class:'muted',style:{fontSize:'12px'},text:opts.boundLabel?opts.boundLabel(it):'[campo]'}));
    }

    if(!isThumb){
      if(it.id===selId){
        ['tl','tr','bl','br','tc','bc','ml','mr'].forEach(p=>d.appendChild(el('div',{class:'cnv-h '+p})));
      }
      d.addEventListener('mousedown', e=>onItemDown(e, it, d));
      d.addEventListener('dblclick', e=>onItemDbl(e, it, d));
    }
    return d;
  }
  function styleText(d, it){
    const s=it.style||{};
    d.style.fontFamily=s.fontFamily||'Inter, sans-serif';
    d.style.fontSize=(s.fontSize||14)+'px';
    d.style.color=s.color||'#191918';
    d.style.textAlign=s.align||'left';
    d.style.fontWeight=s.weight||400;
    d.style.fontStyle=s.italic?'italic':'normal';
    d.style.lineHeight=s.lineHeight||1.3;
    d.style.whiteSpace='pre-wrap';
    d.style.overflow='hidden';
    d.style.textDecoration = s.underline ? 'underline' : 'none';
    // trasformazione maiuscole/minuscole (display-only, testo grezzo preservato)
    d.classList.remove('cnv-sentence');
    if(s.transform==='upper') d.style.textTransform='uppercase';
    else if(s.transform==='lower') d.style.textTransform='lowercase';
    else if(s.transform==='caps') d.style.textTransform='capitalize';
    else if(s.transform==='sentence'){ d.style.textTransform='none'; d.classList.add('cnv-sentence'); }
    else d.style.textTransform='none';
    if(s.opacity!=null) d.style.opacity=s.opacity;
    if(s.bg) d.style.background=s.bg;
    if(s.letterSpacing) d.style.letterSpacing=s.letterSpacing+'px';
  }

  // ----- interactions -----
  function onItemDown(e, it, node){
    if(node.getAttribute('contenteditable')==='true') return;
    e.preventDefault(); e.stopPropagation();
    selId = it.id; drawStage(); buildInspector();
    const handle = e.target.classList.contains('cnv-h') ? [...e.target.classList].find(c=>c!=='cnv-h') : null;
    const rect = pageEl.getBoundingClientRect();
    const start = {mx:e.clientX, my:e.clientY, x:it.x, y:it.y, w:it.w, h:it.h};
    const moved = {v:false};
    function mm(ev){
      const dx=(ev.clientX-start.mx)/zoom, dy=(ev.clientY-start.my)/zoom;
      if(Math.abs(dx)+Math.abs(dy)>2) moved.v=true;
      if(handle) doResize(it, handle, start, dx, dy, ev.shiftKey);
      else doMove(it, start, dx, dy, ev.altKey);
      const n = pageEl.querySelector(`.cnv-item[data-id="${it.id}"]`);
      if(n){ n.style.left=it.x+'px'; n.style.top=it.y+'px'; n.style.width=it.w+'px'; n.style.height=it.h+'px'; }
    }
    function mu(){
      document.removeEventListener('mousemove',mm); document.removeEventListener('mouseup',mu);
      clearGuides();
      if(moved.v) commit();
      buildInspector(); buildPages();
    }
    document.addEventListener('mousemove',mm); document.addEventListener('mouseup',mu);
  }
  function doMove(it, start, dx, dy, free){
    let nx = start.x+dx, ny = start.y+dy;
    if(!free){ const sn = snapMove(it, nx, ny); nx=sn.x; ny=sn.y; }
    it.x = Math.round(nx); it.y = Math.round(ny);
  }
  function doResize(it, h, start, dx, dy, keepRatio){
    let {x,y,w,hh}= {x:start.x,y:start.y,w:start.w,hh:start.h};
    if(h.includes('r')||h==='mr') w=start.w+dx;
    if(h.includes('l')||h==='ml'){ w=start.w-dx; x=start.x+dx; }
    if(h.includes('b')||h==='bc') hh=start.h+dy;
    if(h.includes('t')||h==='tc'){ hh=start.h-dy; y=start.y+dy; }
    w=Math.max(16,w); hh=Math.max(8,hh);
    if(keepRatio && start.w&&start.h){ const r=start.w/start.h; hh=w/r; }
    it.x=Math.round(x); it.y=Math.round(y); it.w=Math.round(w); it.h=Math.round(hh);
  }
  function snapMove(it, nx, ny){
    clearGuides();
    const cx=nx+it.w/2, cy=ny+it.h/2;
    let outX=nx, outY=ny;
    const vlines=[{p:DIM.w/2,t:'v'}], hlines=[{p:DIM.h/2,t:'h'}];
    for(const o of items()){ if(o.id===it.id)continue; vlines.push({p:o.x},{p:o.x+o.w},{p:o.x+o.w/2}); hlines.push({p:o.y},{p:o.y+o.h},{p:o.y+o.h/2}); }
    // X: prova center, left, right
    for(const cand of [{v:cx,off:it.w/2},{v:nx,off:0},{v:nx+it.w,off:it.w}]){
      for(const l of vlines){ if(Math.abs(cand.v-l.p)<=SNAP){ outX=l.p-cand.off; showGuide('v',l.p); break; } }
    }
    for(const cand of [{v:cy,off:it.h/2},{v:ny,off:0},{v:ny+it.h,off:it.h}]){
      for(const l of hlines){ if(Math.abs(cand.v-l.p)<=SNAP){ outY=l.p-cand.off; showGuide('h',l.p); break; } }
    }
    // grid fallback
    if(outX===nx) outX=Math.round(nx/GRID)*GRID;
    if(outY===ny) outY=Math.round(ny/GRID)*GRID;
    return {x:outX, y:outY};
  }
  function showGuide(type,pos){
    const g=el('div',{class:'cnv-guide '+type});
    if(type==='v'){ g.style.left=pos+'px'; } else { g.style.top=pos+'px'; }
    guides.appendChild(g);
  }
  function clearGuides(){ guides.innerHTML=''; }

  function onItemDbl(e, it, node){
    if(it.type==='text'){
      e.preventDefault();
      node.setAttribute('contenteditable','true'); node.focus();
      const r=document.createRange(); r.selectNodeContents(node); const s=getSelection(); s.removeAllRanges(); s.addRange(r);
      node.addEventListener('blur',()=>{ it.text=node.textContent; node.setAttribute('contenteditable','false'); commit(); drawStage(); buildPages(); },{once:true});
    } else if(it.type==='image'){ pickImage(it); }
  }

  // ----- add / image -----
  function addItem(spec){
    const it = Object.assign({id:'it_'+Math.random().toString(36).slice(2,8), x:Math.round((DIM.w-(spec.w||200))/2), y:120, rot:0, z:maxZ()+1, style:{}}, spec);
    items().push(it); selId=it.id; commit(); drawStage(); buildInspector(); buildPages();
    return it;
  }
  function pickImage(existing){
    const inp = el('input',{type:'file',accept:'image/*'}); inp.click();
    inp.addEventListener('change',ev=>{
      const f=ev.target.files?.[0]; if(!f)return;
      const r=new FileReader();
      r.onload=()=>{ if(existing){ existing.src=r.result; commit(); drawStage(); } else addItem({type:'image', src:r.result, w:220, h:220, style:{fit:'cover'}}); };
      r.readAsDataURL(f);
    });
  }
  function addBound(item){ return addItem(item); } // esposto ai moduli
  opts._addItem = addItem; opts._addBound = addBound;

  // ----- inspector -----
  function buildInspector(){
    inspector.innerHTML='';
    const it = selItem();
    if(!it){ inspector.appendChild(pageInspector()); return; }
    const col = el('div',{class:'col'});
    col.append(el('div',{class:'row between'},[ el('h4',{text:itemLabel(it)}), el('button',{class:'btn btn-ghost btn-sm',text:'✕ deseleziona',onclick:()=>{selId=null;drawStage();buildInspector();}}) ]));

    if(it.type==='text'){
      col.append(field('Testo', textarea(it.text||'', v=>{it.text=v;drawStage();buildPages();}, 3)));
      textStyleBlock(it).forEach(n=>col.append(n));
    } else if(opts.isTextlike && opts.isTextlike(it)){
      textStyleBlock(it).forEach(n=>col.append(n));
    }
    if(it.type==='line'){
      col.append(colorF('Colore', it.style.color||'#191918', v=>{it.style.color=v;drawStage();}));
      col.append(numF('Spessore', it.style.thickness||2, v=>{it.style.thickness=v;it.h=v;drawStage();}, 1, 40));
    }
    if(it.type==='rect'||it.type==='ellipse'){
      col.append(colorF('Riempimento', it.style.fill||'#f0f0ec', v=>{it.style.fill=v;drawStage();}));
      col.append(grid2(
        colorF('Bordo', it.style.stroke&&it.style.stroke!=='#00000000'?it.style.stroke:'#191918', v=>{it.style.stroke=v;if(!it.style.strokeW)it.style.strokeW=1;drawStage();}),
        numF('Spess. bordo', it.style.strokeW||0, v=>{it.style.strokeW=v;drawStage();}, 0, 20),
      ));
      if(it.type==='rect') col.append(numF('Angoli', it.style.radius||0, v=>{it.style.radius=v;drawStage();}, 0, 80));
    }
    if(it.type==='image'){
      col.append(selF('Adattamento', it.style.fit||'cover', [['cover','Riempi (cover)'],['contain','Contieni'],['fill','Deforma']], v=>{it.style.fit=v;drawStage();}));
      col.append(numF('Opacità', it.style.opacity!=null?it.style.opacity:1, v=>{it.style.opacity=Math.max(0,Math.min(1,v));drawStage();}, 0, 1));
      col.append(el('button',{class:'btn btn-sm',text:it.src?'Sostituisci immagine':'Carica immagine',onclick:()=>pickImage(it)}));
    }
    if(opts.boundInspector && (it.bound||it.type==='dish'||(it.type||'').startsWith('recipe'))){
      const extra = opts.boundInspector(it, ()=>{drawStage();buildPages();});
      if(extra) col.append(extra);
    }

    // posizione
    col.append(el('h4',{text:'Posizione & dimensione',style:{marginTop:'10px'}}));
    col.append(grid2(
      numF('X', it.x, v=>{it.x=v;drawStage();}, -200, DIM.w),
      numF('Y', it.y, v=>{it.y=v;drawStage();}, -200, DIM.h),
    ));
    col.append(grid2(
      numF('Larghezza', it.w, v=>{it.w=v;drawStage();}, 8, DIM.w),
      numF('Altezza', it.h, v=>{it.h=v;drawStage();}, 4, DIM.h),
    ));
    col.append(numF('Rotazione °', it.rot||0, v=>{it.rot=v;drawStage();}, -180, 180));

    // ordine + azioni
    col.append(el('h4',{text:'Ordine',style:{marginTop:'10px'}}));
    col.append(el('div',{class:'row',style:{gap:'4px',flexWrap:'wrap'}},[
      el('button',{class:'btn btn-sm',text:'⬆ Avanti',onclick:()=>{it.z=maxZ()+1;commit();drawStage();}}),
      el('button',{class:'btn btn-sm',text:'⬇ Indietro',onclick:()=>{const mn=items().reduce((m,i)=>Math.min(m,i.z||0),0);it.z=mn-1;commit();drawStage();}}),
    ]));
    col.append(el('div',{class:'row',style:{gap:'4px',marginTop:'8px'}},[
      el('button',{class:'btn btn-sm',text:'⎘ Duplica',onclick:()=>duplicate(it)}),
      el('div',{class:'spacer'}),
      el('button',{class:'btn btn-sm btn-danger',text:'🗑 Elimina',onclick:()=>removeItem(it)}),
    ]));
    inspector.appendChild(col);
  }
  function pageInspector(){
    const pg = curPage();
    const col = el('div',{class:'col'});
    col.append(el('h4',{text:`Pagina ${active+1} di ${doc.pages.length}`}));
    col.append(colorF('Sfondo pagina', pg.bg||'#ffffff', v=>{pg.bg=v;commit();drawStage();buildPages();}));
    const logos = RM.store.getSettings().logos||[];
    col.append(selF('Filigrana logo', pg.wm||'', [['','— nessuna —'], ...logos.map(l=>[l.id,l.name])], v=>{pg.wm=v;commit();drawStage();}));
    if(!logos.length) col.append(el('div',{class:'muted',style:{fontSize:'11px'},html:'Carica loghi in <a href="#settings" style="color:var(--accent)">Impostazioni</a>.'}));
    col.append(el('hr',{class:'sep'}));
    col.append(el('div',{class:'inspector-empty',text:'Seleziona un elemento per modificarlo, oppure trascinalo. Doppio click sul testo per scriverci. Tasti: Canc elimina, Ctrl+D duplica, frecce spostano.'}));
    if(opts.leftExtras){ const ex=opts.leftExtras(); if(ex){ col.append(el('hr',{class:'sep'}), ex); } }
    return col;
  }
  function itemLabel(it){
    const L={text:'Testo',line:'Linea',rect:'Rettangolo',ellipse:'Ellisse',image:'Immagine',dish:'Piatto'};
    if(opts.boundLabelShort && (it.bound||(it.type||'').startsWith('recipe'))) return opts.boundLabelShort(it);
    return L[it.type]||it.type;
  }

  function duplicate(it){ const cp=JSON.parse(JSON.stringify(it)); cp.id='it_'+Math.random().toString(36).slice(2,8); cp.x+=16; cp.y+=16; cp.z=maxZ()+1; items().push(cp); selId=cp.id; commit(); drawStage(); buildInspector(); buildPages(); }
  function removeItem(it){ const i=items().indexOf(it); if(i>=0)items().splice(i,1); selId=null; commit(); drawStage(); buildInspector(); buildPages(); }

  // ----- form helpers -----
  function field(label, node){ return el('div',{class:'field',style:{marginBottom:'8px'}},[el('label',{text:label}), node]); }
  function grid2(a,b){ return el('div',{class:'grid-2',style:{gap:'8px'}},[a,b]); }
  function textarea(val,on,rows=2){ const t=el('textarea',{value:val,rows,oninput:e=>on(e.target.value)}); return t; }
  function numF(label,val,on,min,max){ return field(label, el('input',{type:'number',value:val,min,max,oninput:e=>on(parseFloat(e.target.value)||0)})); }
  function selF(label,val,opts2,on){ const s=el('select',{onchange:e=>on(e.target.value)}); for(const [v,l] of opts2) s.appendChild(el('option',{value:v,text:l,selected:String(v)===String(val)})); return field(label,s); }
  function colorF(label,val,on){ return field(label, el('input',{type:'color',value:val,oninput:e=>on(e.target.value),style:{height:'34px',padding:'2px',cursor:'pointer'}})); }
  function toggleF(label,val,on){ const cb=el('input',{type:'checkbox',checked:val,onchange:e=>on(e.target.checked)}); return el('label',{class:'row',style:{gap:'6px',fontSize:'12px',color:'var(--text-2)',marginTop:'18px'}},[cb,label]); }
  function styleToggle(label,on,fn,extra){ return el('button',{class:on?'on':'',style:Object.assign({flex:'1'},extra||{}),text:label,onclick:fn}); }
  function textStyleBlock(it){
    if(!it.style) it.style={};
    return [
      grid2(
        numF('Dimensione', it.style.fontSize||14, v=>{it.style.fontSize=v;drawStage();}, 6, 200),
        selF('Font', it.style.fontFamily||'Inter, sans-serif', RM.utils.FONTS, v=>{it.style.fontFamily=v;drawStage();}),
      ),
      grid2(
        selF('Allineamento', it.style.align||'left', [['left','◧ Sx'],['center','▣ Centro'],['right','◨ Dx'],['justify','☰ Giust.']], v=>{it.style.align=v;drawStage();}),
        selF('Peso', String(it.style.weight||400), [['400','Normale'],['500','Medio'],['600','Semibold'],['700','Bold']], v=>{it.style.weight=+v;drawStage();}),
      ),
      field('Stile', el('div',{class:'segment',style:{width:'100%'}},[
        styleToggle('B', it.style.weight>=600, ()=>{it.style.weight = it.style.weight>=600?400:700; drawStage(); buildInspector();}, {fontWeight:'700'}),
        styleToggle('I', !!it.style.italic, ()=>{it.style.italic=!it.style.italic; drawStage(); buildInspector();}, {fontStyle:'italic'}),
        styleToggle('U', !!it.style.underline, ()=>{it.style.underline=!it.style.underline; drawStage(); buildInspector();}, {textDecoration:'underline'}),
      ])),
      grid2(
        selF('Maiuscole', it.style.transform||'', [['','Originale'],['upper','MAIUSCOLO'],['lower','minuscolo'],['caps','Iniziali Maiuscole'],['sentence','Prima maiuscola']], v=>{it.style.transform=v;drawStage();}),
        colorF('Colore testo', it.style.color||'#191918', v=>{it.style.color=v;drawStage();}),
      ),
      numF('Interlinea', it.style.lineHeight||1.3, v=>{it.style.lineHeight=v;drawStage();}, 0.8, 3),
    ];
  }

  // ----- keyboard -----
  function onKey(e){
    if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)||document.activeElement?.getAttribute?.('contenteditable')==='true') return;
    const it = selItem();
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='z'){ e.preventDefault(); doUndo(); return; }
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='y'){ e.preventDefault(); doRedo(); return; }
    if(!it) return;
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='d'){ e.preventDefault(); duplicate(it); return; }
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='c'){ clipboard=JSON.parse(JSON.stringify(it)); return; }
    if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='v'){ if(clipboard){ const cp=JSON.parse(JSON.stringify(clipboard)); cp.id='it_'+Math.random().toString(36).slice(2,8); cp.x+=16;cp.y+=16;cp.z=maxZ()+1; items().push(cp); selId=cp.id; commit(); drawStage(); buildInspector(); } return; }
    if(e.key==='Delete'||e.key==='Backspace'){ e.preventDefault(); removeItem(it); return; }
    const step = e.shiftKey?10:1;
    if(e.key==='ArrowLeft'){ e.preventDefault(); it.x-=step; drawStage(); commitSoon(); }
    else if(e.key==='ArrowRight'){ e.preventDefault(); it.x+=step; drawStage(); commitSoon(); }
    else if(e.key==='ArrowUp'){ e.preventDefault(); it.y-=step; drawStage(); commitSoon(); }
    else if(e.key==='ArrowDown'){ e.preventDefault(); it.y+=step; drawStage(); commitSoon(); }
    else if(e.key==='Escape'){ selId=null; drawStage(); buildInspector(); }
  }
  let commitT=null; function commitSoon(){ clearTimeout(commitT); commitT=setTimeout(commit,400); }
  function doUndo(){ if(!undo.length)return; redo.push(snapshot()); restore(undo.pop()); }
  function doRedo(){ if(!redo.length)return; undo.push(snapshot()); restore(redo.pop()); }
  document.addEventListener('keydown', onKey);
  stage.addEventListener('mousedown', e=>{ if(e.target===stage||e.target===stageInner){ selId=null; drawStage(); buildInspector(); } });

  // ----- PDF export -----
  function exportPDF(){
    if(!window.jspdf?.jsPDF){ toast('jsPDF non caricato','err'); return; }
    const J = window.jspdf.jsPDF;
    const orient = (fmt==='a4l')?'landscape':'portrait';
    const pdf = new J({unit:'pt', format: fmt==='a5'?'a5':'a4', orientation:orient});
    const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight();
    const sc = pw/DIM.w;
    doc.pages.forEach((pg,pi)=>{
      if(pi>0) pdf.addPage();
      if(pg.bg && pg.bg!=='#ffffff'){ pdf.setFillColor(pg.bg); pdf.rect(0,0,pw,ph,'F'); }
      const wm = resolveWm(pg.wm);
      if(wm){ try{ const s=pw*0.5; withOpacity(pdf,0.07,()=>pdf.addImage(wm,'PNG',(pw-s)/2,(ph-s)/2,s,s,undefined,'FAST')); }catch(e){} }
      const sorted=[...pg.items].sort((a,b)=>(a.z||0)-(b.z||0));
      for(const it of sorted) drawItemPDF(pdf, it, sc);
    });
    pdf.save((opts.exportName||'documento')+'.pdf');
    toast('PDF esportato','ok');
  }
  function withOpacity(pdf, op, fn){
    try{ if(pdf.GState&&op<1){ pdf.setGState(new pdf.GState({opacity:op})); fn(); pdf.setGState(new pdf.GState({opacity:1})); return; } }catch(e){}
    fn();
  }
  function drawItemPDF(pdf, it, sc){
    const x=it.x*sc, y=it.y*sc, w=it.w*sc, h=it.h*sc;
    if(it.type==='text'){
      const fs=(it.style.fontSize||14)*sc;
      pdfFont(pdf, it.style.fontFamily, it.style.weight||400, !!it.style.italic);
      pdf.setFontSize(fs).setTextColor(it.style.color||'#191918');
      const raw = RM.utils.applyCase(it.text||'', it.style.transform);
      const lines=pdf.splitTextToSize(raw, w);
      const al=it.style.align||'left';
      const ax = al==='center'?x+w/2 : (al==='right')?x+w : x;
      const lh=fs*(it.style.lineHeight||1.3);
      const drawOne=()=>lines.forEach((ln,i)=>{
        const yy=y+fs+i*lh;
        pdf.text(ln, ax, yy, {align:(al==='justify'?'left':al)});
        if(it.style.underline){
          const tw=pdf.getTextWidth(ln);
          const ux = al==='center'?ax-tw/2 : al==='right'?ax-tw : ax;
          pdf.setDrawColor(it.style.color||'#191918').setLineWidth(Math.max(0.4,fs*0.05));
          pdf.line(ux, yy+fs*0.12, ux+tw, yy+fs*0.12);
        }
      });
      if(it.style.opacity!=null && it.style.opacity<1) withOpacity(pdf, it.style.opacity, drawOne); else drawOne();
    } else if(it.type==='line'){
      pdf.setDrawColor(it.style.color||'#191918').setLineWidth(Math.max(0.5,(it.style.thickness||2)*sc));
      pdf.line(x, y+h/2, x+w, y+h/2);
    } else if(it.type==='rect'){
      if(it.style.fill && it.style.fill!=='#00000000'){ pdf.setFillColor(it.style.fill); if(it.style.radius) pdf.roundedRect(x,y,w,h,it.style.radius*sc,it.style.radius*sc,'F'); else pdf.rect(x,y,w,h,'F'); }
      if(it.style.strokeW){ pdf.setDrawColor(it.style.stroke||'#000').setLineWidth(it.style.strokeW*sc); if(it.style.radius) pdf.roundedRect(x,y,w,h,it.style.radius*sc,it.style.radius*sc,'S'); else pdf.rect(x,y,w,h,'S'); }
    } else if(it.type==='ellipse'){
      if(it.style.fill && it.style.fill!=='#00000000'){ pdf.setFillColor(it.style.fill); pdf.ellipse(x+w/2,y+h/2,w/2,h/2,'F'); }
      if(it.style.strokeW){ pdf.setDrawColor(it.style.stroke||'#000').setLineWidth(it.style.strokeW*sc); pdf.ellipse(x+w/2,y+h/2,w/2,h/2,'S'); }
    } else if(it.type==='image' && it.src){
      try{ const fmt2=/png/i.test(it.src.slice(0,20))?'PNG':'JPEG';
        const draw=()=>pdf.addImage(it.src,fmt2,x,y,w,h,undefined,'FAST');
        if(it.style?.opacity!=null && it.style.opacity<1) withOpacity(pdf, it.style.opacity, draw); else draw();
      }catch(e){}
    } else if(opts.boundPDF && (it.bound||it.type==='dish'||(it.type||'').startsWith('recipe'))){
      opts.boundPDF(pdf, it, {x,y,w,h,sc, pdfFont});
    }
  }

  // ----- public api -----
  drawAll();
  setTimeout(fitZoom, 30);
  return {
    addItem, addBound, redraw:drawAll, exportPDF, get doc(){return doc;},
    destroy(){ document.removeEventListener('keydown', onKey); },
  };
}

RM.canvas = {create, pdfFont, PAGE};
})();
