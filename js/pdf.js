(function(){
'use strict';
const RM = window.RM = window.RM || {};
const {store} = RM;
const {toast, fmtEur, fmtPct, fmtDate} = RM.utils;
const {foodcostPiatto, ingredientiMap} = RM.calc;

function jspdf(){
  if(!window.jspdf || !window.jspdf.jsPDF){ toast('Libreria jsPDF non caricata','err'); return null; }
  return window.jspdf.jsPDF;
}

const COL = { text:'#191918', muted:'#737373', light:'#d4d4d4', accent:'#2563eb', warn:'#b25e09', err:'#b3261e', ok:'#176b3a' };

function wrap(doc, text, maxW){ return doc.splitTextToSize(text||'', maxW); }

// ===== Ricettario =====
function esportaRicettario(){
  const J = jspdf(); if(!J) return;
  const piatti = store.all('piatti').filter(p=>p.in_ricettario!==false);
  if(!piatti.length){ toast('Nessun piatto da esportare','err'); return; }
  const ingMap = ingredientiMap();
  const settings = store.getSettings();
  const doc = new J({unit:'mm',format:'a4'});
  drawCover(doc, settings, 'Ricettario di cucina', `${piatti.length} piatti · generato il ${fmtDate(Date.now())}`);
  for(const p of piatti){
    doc.addPage();
    drawHeader(doc, settings, 'Ricettario');
    drawPiattoPage(doc, p, ingMap, settings);
  }
  const stamp = new Date().toISOString().slice(0,10);
  doc.save(`ricettario_${stamp}.pdf`);
  toast('Ricettario PDF generato','ok');
}

function drawPiattoPage(doc, p, ingMap, settings){
  const c = foodcostPiatto(p, ingMap);
  let y = 36;
  doc.setFont('helvetica','bold').setFontSize(22).setTextColor(COL.text);
  doc.text(p.nome||'—', 20, y); y+=8;
  doc.setFont('helvetica','normal').setFontSize(10).setTextColor(COL.muted);
  doc.text(`${p.categoria||'—'}  ·  ${p.porzioni||1} porzioni  ·  ${p.tempo_min||0} min  ·  ${p.difficolta||'—'}`, 20, y); y+=10;
  doc.setDrawColor(COL.light).setFillColor('#fafafa').roundedRect(20,y,170,16,2,2,'FD');
  doc.setTextColor(COL.muted).setFontSize(8);
  doc.text('COSTO / PORZIONE', 24, y+5);
  doc.text('FOOD COST', 75, y+5);
  doc.text('PREZZO VENDITA', 122, y+5);
  doc.text('ALLERGENI', 165, y+5);
  doc.setFont('helvetica','bold').setFontSize(13).setTextColor(COL.text);
  doc.text(fmtEur(c.costo_porz_sicuro), 24, y+12);
  doc.setTextColor(c.foodcost_pct<=(settings.foodcost_target_pct||30)?COL.ok:c.foodcost_pct<=(settings.foodcost_target_pct||30)+8?COL.warn:COL.err);
  doc.text(c.foodcost_pct?fmtPct(c.foodcost_pct):'—', 75, y+12);
  doc.setTextColor(COL.text);
  doc.text(p.prezzo_vendita?fmtEur(p.prezzo_vendita):'—', 122, y+12);
  doc.setFontSize(9).setFont('helvetica','normal').setTextColor(COL.muted);
  doc.text(c.allergeni.length?String(c.allergeni.length):'—', 165, y+12);
  y += 24;

  const leftW = 78, rightX = 110, rightW = 80;
  doc.setFont('helvetica','bold').setFontSize(12).setTextColor(COL.text);
  doc.text('Ingredienti', 20, y);
  doc.text('Procedimento', rightX, y);
  doc.setDrawColor(COL.light).line(20, y+1.5, 20+leftW, y+1.5);
  doc.line(rightX, y+1.5, rightX+rightW, y+1.5);
  y += 6;

  doc.setFont('helvetica','normal').setFontSize(9.5).setTextColor(COL.text);
  let yL = y;
  for(const r of (p.ingredienti||[])){
    const ing = ingMap.get(r.ing_id); if(!ing) continue;
    const u = ing.unita==='kg'?'g':ing.unita==='L'?'ml':ing.unita;
    if(yL>275){ doc.addPage(); drawHeader(doc, settings, 'Ricettario · '+p.nome); yL=36; }
    doc.setTextColor(COL.text);
    const nameLines = wrap(doc, ing.nome, leftW-22);
    doc.text(nameLines, 20, yL);
    doc.setTextColor(COL.muted);
    doc.text(`${r.grammi} ${u}`, 20+leftW, yL, {align:'right'});
    yL += nameLines.length*4.4 + 1.4;
    if(r.note){
      doc.setFontSize(8).setTextColor(COL.muted);
      const nLines = wrap(doc, r.note, leftW-4);
      doc.text(nLines, 22, yL);
      yL += nLines.length*3.6 + 1;
      doc.setFontSize(9.5);
    }
  }
  if(c.allergeni.length){
    yL += 4;
    doc.setFont('helvetica','bold').setFontSize(9).setTextColor(COL.muted);
    doc.text('ALLERGENI', 20, yL); yL+=4;
    doc.setFont('helvetica','normal').setTextColor(COL.warn).setFontSize(9);
    doc.text(wrap(doc, c.allergeni.join(' · '), leftW), 20, yL);
  }

  doc.setFont('helvetica','normal').setFontSize(10).setTextColor(COL.text);
  const pLines = wrap(doc, p.procedimento||'—', rightW);
  let yR = y;
  for(const line of pLines){
    if(yR>278){ doc.addPage(); drawHeader(doc, settings, 'Ricettario · '+p.nome); yR=36; }
    doc.text(line, rightX, yR); yR+=5;
  }
  if(p.impiattamento){
    yR += 6;
    if(yR>270){ doc.addPage(); drawHeader(doc, settings, 'Ricettario · '+p.nome); yR=36; }
    doc.setFont('helvetica','bold').setFontSize(11).setTextColor(COL.text); doc.text('Impiattamento', rightX, yR); yR+=6;
    doc.setFont('helvetica','normal').setFontSize(10);
    for(const line of wrap(doc, p.impiattamento, rightW)){ if(yR>278){ doc.addPage(); drawHeader(doc, settings, 'Ricettario · '+p.nome); yR=36; } doc.text(line, rightX, yR); yR+=5; }
  }
  drawFooter(doc, settings, 'ricettario');
}

// ===== Listino ingredienti (per il fornitore) =====
// Riceve la lista già filtrata/ordinata dalla vista Ingredienti.
function esportaIngredienti(list, opts={}){
  const J = jspdf(); if(!J) return;
  if(!list || !list.length){ toast('Nessun ingrediente da esportare','err'); return; }
  const settings = store.getSettings();
  const CATS = (RM.utils.CATEGORIE_INGR||[]);   // include già 'altro' → niente sezione duplicata
  const groups = new Map(CATS.map(c=>[c,[]]));
  for(const i of list){ const k = groups.has(i.categoria)?i.categoria:'altro'; groups.get(k).push(i); }

  const doc = new J({unit:'mm',format:'a4'});
  const LABEL = 'Listino ingredienti';
  drawHeader(doc, settings, LABEL);
  let y = 28;
  doc.setFont('helvetica','bold').setFontSize(20).setTextColor(COL.text);
  doc.text(LABEL, 20, y); y += 7;
  doc.setFont('helvetica','normal').setFontSize(10).setTextColor(COL.muted);
  const sub = [opts.subtitle, `${list.length} voci`, 'generato il '+fmtDate(Date.now())].filter(Boolean).join('  ·  ');
  doc.text(wrap(doc, sub, 170), 20, y); y += 9;

  const xName=20, xUni=112, xCur=155, xOffA=160, xOffB=189;
  function tableHead(){
    doc.setFont('helvetica','bold').setFontSize(7.5).setTextColor(COL.muted);
    doc.text('INGREDIENTE', xName, y);
    doc.text('U.M.', xUni, y);
    doc.text('€/u ATTUALE', xCur, y, {align:'right'});
    doc.text('€/u OFFERTA', (xOffA+xOffB)/2, y, {align:'center'});
    doc.setDrawColor(COL.light).line(20, y+1.5, 190, y+1.5); y += 5;
  }
  function newPage(catLabel){ doc.addPage(); drawHeader(doc, settings, LABEL+(catLabel?(' · '+catLabel):'')); y=28; tableHead(); }

  for(const cat of CATS){
    const items = groups.get(cat); if(!items.length) continue;
    if(y>258){ newPage(); }
    doc.setFont('helvetica','bold').setFontSize(12).setTextColor(COL.text);
    doc.text(cat.charAt(0).toUpperCase()+cat.slice(1), 20, y); y+=5;
    tableHead();
    doc.setFont('helvetica','normal').setFontSize(9.5);
    for(const i of items){
      const nameLines = wrap(doc, i.nome||'—', xUni-xName-4);
      const rowH = Math.max(nameLines.length*4.6, 5) + 2.6;
      if(y+rowH>282){ newPage(cat); doc.setFont('helvetica','normal').setFontSize(9.5); }
      const baseline = y + 4;
      doc.setTextColor(COL.text);  doc.text(nameLines, xName, baseline);
      doc.setTextColor(COL.muted); doc.text(i.unita||'—', xUni, baseline);
      const price = Number(i.prezzo_sicuro)||0;
      doc.text(price>0?fmtEur(price):'—', xCur, baseline, {align:'right'});
      const sepY = y + rowH - 1;                                     // un'unica riga a fondo cella
      doc.setDrawColor('#e8e8e8').line(20,   sepY, xCur+2, sepY);    // sotto nome/UM/attuale
      doc.setDrawColor('#c0c0c0').line(xOffA, sepY, xOffB, sepY);    // campo €/u offerta da compilare
      y += rowH;
    }
    y += 6;
  }
  drawFooter(doc, settings, null);   // solo numeri di pagina, niente filigrana
  const stamp = new Date().toISOString().slice(0,10);
  doc.save(`ingredienti_${stamp}.pdf`);
  toast('Listino ingredienti PDF generato','ok');
}

// ===== Menù =====
function esportaMenu(menuId){
  const J = jspdf(); if(!J) return;
  const m = store.get('menu', menuId); if(!m){ toast('Menù non trovato','err'); return; }
  const piattiAll = new Map(store.all('piatti').map(p=>[p.id,p]));
  const settings = store.getSettings();
  const piatti = (m.piatti_ids||[]).map(id=>piattiAll.get(id)).filter(Boolean);
  if(!piatti.length){ toast('Nessun piatto nel menù','err'); return; }

  const doc = new J({unit:'mm',format:'a4'});
  const ORD = ['Piazzetta','Salse','Buns','Crostoni','Sfizi','Insalatine','Piatti','Signature','altro'];
  const groups = new Map(ORD.map(c=>[c,[]]));
  for(const p of piatti){ const k=groups.has(p.categoria)?p.categoria:'altro'; groups.get(k).push(p); }

  if(settings.logo){ try{ doc.addImage(settings.logo,'PNG', 88, 40, 34, 34, undefined, 'FAST'); }catch{} }
  doc.setFont('times','bold').setFontSize(34).setTextColor(COL.text);
  doc.text(settings.nome_locale||'Menù', 105, 90, {align:'center'});
  doc.setFont('times','italic').setFontSize(14).setTextColor(COL.muted);
  doc.text(m.nome||'', 105, 100, {align:'center'});
  doc.setDrawColor('#191918').setLineWidth(0.5);
  doc.line(75,108,135,108);
  if(m.data){ doc.setFont('times','normal').setFontSize(11).setTextColor(COL.muted); doc.text(fmtDate(m.data), 105, 116, {align:'center'}); }
  if(settings.indirizzo){ doc.setFontSize(9); doc.text(settings.indirizzo, 105, 280, {align:'center'}); }

  doc.addPage();
  let y = 30;
  const ingMap = ingredientiMap();
  for(const cat of ORD){
    const list = groups.get(cat); if(!list?.length) continue;
    if(y>250){ doc.addPage(); y=30; }
    doc.setFont('times','bold').setFontSize(18).setTextColor(COL.text);
    const title = cat.charAt(0).toUpperCase()+cat.slice(1);
    doc.text(title, 105, y, {align:'center'}); y+=2;
    doc.setDrawColor(COL.light).line(70,y+2,140,y+2); y+=10;
    for(const p of list){
      if(y>275){ doc.addPage(); y=30; }
      doc.setFont('times','bold').setFontSize(13).setTextColor(COL.text);
      doc.text(p.nome, 25, y);
      if(p.prezzo_vendita){ doc.setFont('times','normal'); doc.text(fmtEur(p.prezzo_vendita), 185, y, {align:'right'}); }
      y+=5;
      const desc = (p.procedimento||'').slice(0,140) || (p.ingredienti||[]).slice(0,5).map(r=>ingMap.get(r.ing_id)?.nome).filter(Boolean).join(', ');
      if(desc){
        doc.setFont('times','italic').setFontSize(10).setTextColor(COL.muted);
        const lines = wrap(doc, desc, 160);
        doc.text(lines, 25, y); y += lines.length*4.2;
      }
      const c = foodcostPiatto(p, ingMap);
      if(c.allergeni.length){
        doc.setFont('helvetica','normal').setFontSize(7.5).setTextColor(COL.warn);
        doc.text('contiene: '+c.allergeni.join(', '), 25, y); y+=3.5;
      }
      y += 5;
    }
    y += 6;
  }
  drawFooter(doc, settings, 'menu');
  doc.save(`menu_${(m.nome||'menu').replace(/[^a-z0-9]+/gi,'_').toLowerCase()}.pdf`);
  toast('Menù PDF generato','ok');
}

// ===== HACCP — forme normative =====
// disegna una forma centrata in (cx,cy) con dimensioni boxW x boxH
function drawShape(doc, tipo, cx, cy, w, h, fillRGB, strokeRGB){
  doc.setDrawColor(strokeRGB);
  doc.setFillColor(fillRGB);
  const x = cx-w/2, y = cy-h/2;
  switch(tipo){
    case 'terminatore':
      // pillola (stadio)
      doc.roundedRect(x,y,w,h, h/2, h/2, 'FD'); break;
    case 'parallelogramma':{
      const sk = h*0.5;
      doc.lines([[w-sk,0],[-sk,h],[-(w-sk),0],[sk,-h]], x+sk, y, [1,1], 'FD', true);
      break;
    }
    case 'trapezio':{
      const sk = h*0.45;
      doc.lines([[w-2*sk,0],[sk,h],[-w,0],[sk,-h]], x+sk, y, [1,1], 'FD', true);
      break;
    }
    case 'rombo':{
      doc.lines([[w/2,h/2],[-w/2,h/2],[-w/2,-h/2],[w/2,-h/2]], x, y+h/2, [1,1], 'FD', true);
      break;
    }
    case 'cilindro':{
      // rettangolo con archi top/bottom
      const er = h*0.18;
      doc.roundedRect(x, y+er, w, h-2*er, 0, 0, 'F');
      doc.setFillColor(fillRGB);
      doc.ellipse(x+w/2, y+er, w/2, er, 'F');
      doc.ellipse(x+w/2, y+h-er, w/2, er, 'F');
      // bordi
      doc.line(x, y+er, x, y+h-er);
      doc.line(x+w, y+er, x+w, y+h-er);
      doc.ellipse(x+w/2, y+er, w/2, er, 'S');
      // arco inferiore (solo metà sotto): jsPDF non ha arco — disegniamo ellisse completa, è ok
      doc.ellipse(x+w/2, y+h-er, w/2, er, 'S');
      break;
    }
    case 'rettangolo':
    default:
      doc.rect(x,y,w,h,'FD');
  }
}

function esportaHaccp(haccpId){
  const J = jspdf(); if(!J) return;
  const h = store.get('haccp', haccpId); if(!h){ toast('Diagramma non trovato','err'); return; }
  const settings = store.getSettings();
  const doc = new J({unit:'mm',format:'a4'});
  drawHeader(doc, settings, 'Manuale HACCP');

  let y = 36;
  doc.setFont('helvetica','bold').setFontSize(20).setTextColor(COL.text);
  doc.text('Diagramma di flusso', 20, y); y+=7;
  doc.setFont('helvetica','normal').setFontSize(11).setTextColor(COL.muted);
  doc.text(h.alimento||'', 20, y); y+=10;

  const TIPI = Object.fromEntries(RM.utils.HACCP_TIPI.map(t=>[t.id,t]));
  const cx = 105, boxW = 110;
  for(let i=0;i<(h.fasi||[]).length;i++){
    const f = h.fasi[i];
    const def = TIPI[f.tipo] || TIPI['processo'];
    const isCcp = f.ccp || f.tipo==='ccp';
    const boxH = def.forma==='rombo'? 22 : 14;
    if(y+boxH+10 > 275){ doc.addPage(); drawHeader(doc, settings, 'HACCP · '+h.alimento); y=36; }

    const fillCol = isCcp?'#fbeae9': def.forma==='terminatore'?'#e6f4ec' : def.forma==='cilindro'?'#eaf1fd' : def.forma==='parallelogramma'?'#eaf1fd' : '#ffffff';
    drawShape(doc, def.forma, cx, y+boxH/2, boxW, boxH, fillCol, isCcp?COL.err:def.color);
    doc.setFont('helvetica','bold').setFontSize(10).setTextColor(isCcp?COL.err:COL.text);
    const label = (isCcp?'CCP — ':'')+(f.nome||def.label||`Fase ${i+1}`);
    doc.text(label, cx, y+boxH/2-0.5, {align:'center', baseline:'middle'});
    if(f.descrizione){
      doc.setFont('helvetica','normal').setFontSize(7.5).setTextColor(COL.muted);
      const desc = doc.splitTextToSize(f.descrizione, boxW-12)[0]||'';
      doc.text(desc, cx, y+boxH/2+3.5, {align:'center', baseline:'middle'});
    }
    y += boxH;
    if(i<h.fasi.length-1){
      doc.setDrawColor('#191918').setLineWidth(0.3);
      doc.line(cx, y, cx, y+5);
      doc.line(cx-1.4, y+3.5, cx, y+5);
      doc.line(cx+1.4, y+3.5, cx, y+5);
      y += 6;
    }
  }

  // legenda forme
  if(y < 240){ y = 260; } else { doc.addPage(); drawHeader(doc, settings, 'HACCP · '+h.alimento); y = 36; }
  doc.setFont('helvetica','bold').setFontSize(9).setTextColor(COL.muted);
  doc.text('LEGENDA SIMBOLI', 20, y); y+=4;
  doc.setDrawColor(COL.light).line(20,y,90,y); y+=4;
  const legenda = [['terminatore','Inizio/Fine'],['parallelogramma','Input/Output'],['rettangolo','Processo'],['trapezio','Operazione manuale'],['rombo','Decisione / CCP'],['cilindro','Stoccaggio']];
  for(const [forma,lbl] of legenda){
    drawShape(doc, forma, 28, y+2, 14, 4, '#ffffff', '#191918');
    doc.setFont('helvetica','normal').setFontSize(8).setTextColor(COL.text);
    doc.text(lbl, 40, y+3);
    y += 6;
  }

  // tabella dettagli CCP
  if((h.fasi||[]).some(f=>f.ccp || f.tipo==='ccp')){
    doc.addPage(); drawHeader(doc, settings, 'HACCP · '+h.alimento);
    let yy = 36;
    doc.setFont('helvetica','bold').setFontSize(14).setTextColor(COL.text);
    doc.text('Punti critici di controllo (CCP)', 20, yy); yy+=8;
    for(const f of h.fasi){
      if(!(f.ccp||f.tipo==='ccp')) continue;
      if(yy>250){ doc.addPage(); drawHeader(doc, settings, 'HACCP · '+h.alimento); yy=36; }
      doc.setFont('helvetica','bold').setFontSize(11).setTextColor(COL.err);
      doc.text('⚠ '+(f.nome||'CCP'), 20, yy); yy+=6;
      const fields = [['Descrizione',f.descrizione],['Limiti critici',f.limiti_critici],['Monitoraggio',f.monitoraggio],['Azioni correttive',f.azioni_correttive]];
      for(const [lbl,val] of fields){
        doc.setFont('helvetica','bold').setFontSize(8).setTextColor(COL.muted); doc.text(lbl.toUpperCase(), 20, yy); yy+=3.5;
        doc.setFont('helvetica','normal').setFontSize(9.5).setTextColor(COL.text);
        const lines = wrap(doc, val||'—', 170);
        doc.text(lines, 20, yy); yy += lines.length*4.5 + 2;
      }
      yy += 4;
      doc.setDrawColor(COL.light).line(20,yy,190,yy); yy+=6;
    }
  }

  drawFooter(doc, settings, 'haccp');
  doc.save(`haccp_${(h.alimento||'haccp').replace(/[^a-z0-9]+/gi,'_').toLowerCase()}.pdf`);
  toast('HACCP PDF generato','ok');
}

// === Branding helpers ===
function logoById(settings, id){ return (settings.logos||[]).find(l=>l.id===id); }
function getBranding(settings, key){
  const b = settings.branding?.[key];
  if(!b || !b.logo_id) return null;
  const logo = logoById(settings, b.logo_id);
  if(!logo) return null;
  return {...b, logo};
}
function withOpacity(doc, opacity, fn){
  // jsPDF GState support
  let restored=false;
  try{
    if(doc.GState && opacity<1){
      const gs = new doc.GState({opacity});
      doc.setGState(gs);
      fn();
      const gs2 = new doc.GState({opacity:1});
      doc.setGState(gs2);
      restored=true;
    }
  }catch{}
  if(!restored) fn();
}
function safeAddImage(doc, dataUrl, x, y, w, h){
  try{
    const fmt = /^data:image\/png/i.test(dataUrl)?'PNG':/^data:image\/jpeg/i.test(dataUrl)?'JPEG':'PNG';
    doc.addImage(dataUrl, fmt, x, y, w, h, undefined, 'FAST');
  }catch(e){console.warn('logo error', e);}
}
function applyDocBranding(doc, settings, key){
  // logo specifico tipo doc + filigrana globale
  const PW=210, PH=297;
  const cfg = getBranding(settings, key);
  if(cfg){
    const size = (cfg.size||.2)*PW;
    if(cfg.mode==='header'){
      withOpacity(doc, cfg.opacity||1, ()=>safeAddImage(doc, cfg.logo.data, PW-size-15, 6, size, size*0.5));
    } else if(cfg.mode==='corner'){
      withOpacity(doc, cfg.opacity||1, ()=>safeAddImage(doc, cfg.logo.data, PW-size-8, PH-size-8, size, size));
    } else if(cfg.mode==='watermark'){
      withOpacity(doc, cfg.opacity||.06, ()=>safeAddImage(doc, cfg.logo.data, (PW-size)/2, (PH-size)/2, size, size));
    }
  }
  const wm = getBranding(settings, 'watermark_all');
  if(wm){
    const size = (wm.size||.45)*PW;
    withOpacity(doc, wm.opacity||.06, ()=>safeAddImage(doc, wm.logo.data, (PW-size)/2, (PH-size)/2, size, size));
  }
}

function drawHeader(doc, settings, label){
  doc.setFont('helvetica','normal').setFontSize(8).setTextColor(COL.muted);
  const name = settings.nome_locale || 'Restaurant Manager';
  doc.text(name, 20, 12);
  doc.text(label, 190, 12, {align:'right'});
  doc.setDrawColor(COL.light).line(20,15,190,15);
}
function drawFooter(doc, settings, brandingKey){
  const pages = doc.internal.getNumberOfPages();
  for(let i=1;i<=pages;i++){
    doc.setPage(i);
    // applica branding per ogni pagina
    if(brandingKey) applyDocBranding(doc, settings, brandingKey);
    doc.setFont('helvetica','normal').setFontSize(7.5).setTextColor(COL.muted);
    doc.text(`Pagina ${i} di ${pages}`, 190, 290, {align:'right'});
    doc.text(fmtDate(Date.now()), 20, 290);
  }
}
function drawCover(doc, settings, title, sub){
  if(settings.logo){ try{ doc.addImage(settings.logo,'PNG', 88, 60, 34, 34, undefined, 'FAST'); }catch{} }
  doc.setFont('times','bold').setFontSize(34).setTextColor(COL.text);
  doc.text(settings.nome_locale||'Restaurant Manager', 105, 120, {align:'center'});
  doc.setFont('times','italic').setFontSize(18).setTextColor(COL.muted);
  doc.text(title, 105, 134, {align:'center'});
  doc.setFont('helvetica','normal').setFontSize(10);
  doc.text(sub, 105, 150, {align:'center'});
  if(settings.indirizzo){ doc.setFontSize(9); doc.text(settings.indirizzo, 105, 280, {align:'center'}); }
}

RM.pdf = {esportaRicettario, esportaMenu, esportaHaccp, esportaIngredienti, drawShape};
})();
