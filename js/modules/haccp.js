(function(){
'use strict';
const RM = window.RM = window.RM || {};
RM.modules = RM.modules || {};
const {el, toast, confirmDialog, openModal, HACCP_TIPI} = RM.utils;
const {store, onChange} = RM;

const TIPI_MAP = Object.fromEntries(HACCP_TIPI.map(t=>[t.id,t]));

let off=null;
function mount(r){ render(r); off=onChange(()=>render(r)); }
function unmount(){ off?.(); off=null; }

function render(root){
  const list = store.all('haccp');
  root.innerHTML='';
  root.append(
    el('div',{class:'view-head'},[
      el('h1',{},['HACCP ',el('span',{class:'muted',style:{fontSize:'14px',fontWeight:'400'},text:`(${list.length})`})]),
      el('div',{class:'actions'},[el('button',{class:'btn btn-primary',text:'+ Nuovo diagramma',onclick:()=>edit(null)})])
    ]),
    el('div',{class:'view-sub',text:'Diagrammi di flusso secondo simbologia normativa (ISO 5807 / HACCP): cerchio inizio-fine, rettangolo processo, rombo decisione/CCP, parallelogramma input-output, trapezio operazione manuale, cilindro stoccaggio.'}),
    list.length===0
      ? el('div',{class:'tbl-wrap'},[el('div',{class:'tbl-empty'},[
          el('h3',{text:'Nessun diagramma'}),
          el('p',{class:'muted',text:'Crea un diagramma di flusso per il primo alimento.'}),
          el('div',{style:{marginTop:'12px'}},[ el('button',{class:'btn btn-primary',text:'+ Nuovo diagramma',onclick:()=>edit(null)}) ])
        ])])
      : ul(list)
  );
}

function ul(list){
  const wrap = el('div',{class:'list'});
  for(const h of list){
    const ccpN = (h.fasi||[]).filter(f=>f.ccp||f.tipo==='ccp').length;
    wrap.appendChild(el('div',{class:'list-item'},[
      el('div',{class:'grow'},[
        el('div',{class:'title',text:h.alimento||'—'}),
        el('div',{class:'sub',text:`${(h.fasi||[]).length} fasi · ${ccpN} CCP`}),
      ]),
      el('button',{class:'btn btn-sm',text:'Modifica',onclick:()=>edit(h.id)}),
      el('button',{class:'btn btn-sm',text:'Esporta PDF',onclick:()=>RM.pdf.esportaHaccp(h.id)}),
      el('button',{class:'btn btn-sm btn-danger',text:'Elimina',onclick:async()=>{
        if(!await confirmDialog(`Eliminare il diagramma "${h.alimento}"?`,'Elimina')) return;
        store.remove('haccp',h.id); toast('Eliminato','ok');
      }}),
    ]));
  }
  return wrap;
}

// SVG renderer per le forme normative
function shapeSVG(tipo, w, h, isCcp, label){
  const def = TIPI_MAP[tipo] || TIPI_MAP['processo'];
  const stroke = isCcp ? '#b3261e' : def.color;
  const fill = isCcp ? '#fbeae9'
              : def.forma==='terminatore' ? '#e6f4ec'
              : def.forma==='cilindro' || def.forma==='parallelogramma' ? '#eaf1fd'
              : '#ffffff';
  const strokeW = isCcp ? 2 : 1.4;
  let shape = '';
  switch(def.forma){
    case 'terminatore':
      shape = `<rect x="1" y="1" width="${w-2}" height="${h-2}" rx="${h/2}" ry="${h/2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}"/>`;
      break;
    case 'parallelogramma':{
      const s = h*0.35;
      shape = `<polygon points="${s},0 ${w},0 ${w-s},${h} 0,${h}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}"/>`;
      break;
    }
    case 'trapezio':{
      const s = h*0.30;
      shape = `<polygon points="${s},0 ${w-s},0 ${w},${h} 0,${h}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}"/>`;
      break;
    }
    case 'rombo':
      shape = `<polygon points="${w/2},0 ${w},${h/2} ${w/2},${h} 0,${h/2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}"/>`;
      break;
    case 'cilindro':{
      const e = h*0.16;
      shape = `
        <path d="M 1 ${e} L 1 ${h-e} A ${(w-2)/2} ${e} 0 0 0 ${w-1} ${h-e} L ${w-1} ${e}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}"/>
        <ellipse cx="${w/2}" cy="${e}" rx="${(w-2)/2}" ry="${e}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}"/>
      `;
      break;
    }
    case 'rettangolo':
    default:
      shape = `<rect x="1" y="1" width="${w-2}" height="${h-2}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}"/>`;
  }
  const labelTxt = (isCcp?'⚠ CCP — ':'') + (label || def.label || 'Fase');
  const txtCol = isCcp?'#b3261e':'#191918';
  const txtWeight = isCcp?'600':'500';
  // word-wrap manuale per max 2 righe
  const words = labelTxt.split(/\s+/);
  const lines = [];
  let line='';
  const maxChars = Math.floor(w/6);
  for(const wd of words){
    if((line+' '+wd).trim().length>maxChars){ if(line) lines.push(line); line=wd; }
    else line=(line?line+' ':'')+wd;
    if(lines.length>=2) break;
  }
  if(line && lines.length<2) lines.push(line);
  const lineTags = lines.map((l,i)=>`<tspan x="${w/2}" dy="${i===0?0:14}">${escapeSvg(l)}</tspan>`).join('');
  const yText = lines.length===1 ? h/2+4 : h/2-3;
  const txt = `<text x="${w/2}" y="${yText}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" font-weight="${txtWeight}" fill="${txtCol}">${lineTags}</text>`;

  return `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:auto">${shape}${txt}</svg>`;
}

function escapeSvg(s){ return String(s).replace(/[&<>"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }

function edit(id){
  const data = id ? structuredClone(store.get('haccp',id)) : {alimento:'',fasi:[]};
  const fA = el('input',{type:'text',value:data.alimento||'',placeholder:'Es. Ragù alla bolognese'});
  const fasiBox = el('div',{class:'list'});
  const preview = el('div',{style:{padding:'14px',background:'var(--side)',borderRadius:'8px',marginTop:'10px',minHeight:'120px'}});

  // pulsanti per aggiungere fase di un certo tipo
  const tipoButtons = el('div',{class:'row wrap',style:{gap:'6px',marginTop:'8px'}});
  for(const t of HACCP_TIPI){
    tipoButtons.appendChild(el('button',{
      class:'btn btn-sm', type:'button',
      style:{borderColor:t.color, color:t.color},
      text:'+ '+t.label,
      onclick:()=>{
        const fasi = data.fasi;
        const isCcp = t.id==='ccp';
        fasi.push({
          nome: t.label==='Processo'||t.label==='Decisione' ? '' : t.label,
          tipo: t.id,
          descrizione:'',
          ccp: isCcp,
          limiti_critici:'', monitoraggio:'', azioni_correttive:''
        });
        renderFasi();
      }
    }));
  }

  function renderFasi(){
    fasiBox.innerHTML='';
    if(!data.fasi.length) fasiBox.appendChild(el('div',{class:'drop',text:'Aggiungi una fase scegliendo il tipo dai bottoni sopra ↑'}));
    data.fasi.forEach((f,idx)=>{
      const def = TIPI_MAP[f.tipo] || TIPI_MAP['processo'];
      const card = el('div',{class:'list-item',style:{alignItems:'flex-start',flexDirection:'column',gap:'8px'}});
      const tipoSel = el('select');
      for(const t of HACCP_TIPI) tipoSel.appendChild(el('option',{value:t.id,text:t.label,selected:f.tipo===t.id}));
      tipoSel.addEventListener('change',()=>{ f.tipo = tipoSel.value; if(f.tipo==='ccp') f.ccp=true; renderFasi(); });

      const nm = el('input',{type:'text',value:f.nome||'',placeholder:`Etichetta fase ${idx+1}`,style:{fontWeight:'500'}});
      nm.addEventListener('input',()=>{f.nome=nm.value; updatePreviewSoft(idx,f);});

      const desc = el('textarea',{value:f.descrizione||'',placeholder:'Descrizione (cosa avviene, temperature, tempi…)',style:{minHeight:'48px'}});
      desc.addEventListener('input',()=>{f.descrizione=desc.value;});
      const lc = el('input',{type:'text',value:f.limiti_critici||'',placeholder:'Limiti critici (es. T ≤ 4°C)'});
      lc.addEventListener('input',()=>{f.limiti_critici=lc.value;});
      const mo = el('input',{type:'text',value:f.monitoraggio||'',placeholder:'Monitoraggio (chi, come, frequenza)'});
      mo.addEventListener('input',()=>{f.monitoraggio=mo.value;});
      const az = el('input',{type:'text',value:f.azioni_correttive||'',placeholder:'Azioni correttive'});
      az.addEventListener('input',()=>{f.azioni_correttive=az.value;});

      const symbolPreview = el('div',{style:{minWidth:'90px'},html:shapeSVG(f.tipo,90,38,f.ccp||f.tipo==='ccp', f.nome||def.label)});
      const ccpCb = el('input',{type:'checkbox',checked:!!f.ccp});
      ccpCb.addEventListener('change',()=>{f.ccp=ccpCb.checked; renderFasi();});

      card.append(
        el('div',{class:'row between',style:{width:'100%',gap:'8px'}},[
          el('div',{class:'row',style:{gap:'8px',flex:1,alignItems:'center'}},[
            el('span',{class:'badge',text:`F${idx+1}`}),
            symbolPreview,
            tipoSel,
            nm
          ]),
          el('div',{class:'row',style:{gap:'4px'}},[
            el('button',{class:'btn btn-sm',text:'↑',type:'button',disabled:idx===0,onclick:()=>{[data.fasi[idx-1],data.fasi[idx]]=[data.fasi[idx],data.fasi[idx-1]];renderFasi();}}),
            el('button',{class:'btn btn-sm',text:'↓',type:'button',disabled:idx===data.fasi.length-1,onclick:()=>{[data.fasi[idx+1],data.fasi[idx]]=[data.fasi[idx],data.fasi[idx+1]];renderFasi();}}),
            el('button',{class:'btn btn-sm btn-danger',type:'button',text:'×',onclick:()=>{data.fasi.splice(idx,1);renderFasi();}}),
          ])
        ]),
        el('label',{class:'row',style:{gap:'6px',fontSize:'12px',color: f.tipo==='ccp'||f.ccp?'var(--err)':'var(--text-2)'}},[ ccpCb, 'Marcalo come CCP (Punto Critico di Controllo)']),
        desc,
        el('div',{class:'grid-3'},[ lc, mo, az ]),
      );
      fasiBox.appendChild(card);
    });
    renderPreview();
  }

  function updatePreviewSoft(){ renderPreview(); }

  function renderPreview(){
    preview.innerHTML='';
    if(!data.fasi.length){ preview.appendChild(el('p',{class:'muted',text:'Anteprima diagramma — vuoto.'})); return; }
    preview.appendChild(el('div',{class:'kpi-label',style:{marginBottom:'10px'},text:'ANTEPRIMA DIAGRAMMA DI FLUSSO'}));
    const flow = el('div',{style:{display:'flex',flexDirection:'column',alignItems:'center',gap:'2px'}});
    data.fasi.forEach((f,i)=>{
      const def = TIPI_MAP[f.tipo] || TIPI_MAP['processo'];
      const isCcp = f.ccp||f.tipo==='ccp';
      const isDiamond = def.forma==='rombo';
      const W = isDiamond?220:240;
      const H = isDiamond?80:56;
      const svgWrap = el('div',{style:{display:'flex',justifyContent:'center'},html:shapeSVG(f.tipo, W, H, isCcp, f.nome||def.label)});
      flow.appendChild(svgWrap);
      if(i<data.fasi.length-1){
        flow.appendChild(el('div',{style:{color:'var(--text-3)',lineHeight:'1',fontSize:'18px'},html:'&darr;'}));
      }
    });
    preview.appendChild(flow);
  }

  renderFasi();

  const body = el('div',{},[
    el('div',{class:'field'},[el('label',{text:'Alimento *'}),fA]),
    el('hr',{class:'sep'}),
    el('div',{class:'row between'},[
      el('h3',{text:'Fasi del processo'}),
    ]),
    el('div',{class:'kpi-label',text:'AGGIUNGI FASE PER TIPO (simbologia normativa)'}),
    tipoButtons,
    fasiBox,
    preview,
  ]);

  const {close} = openModal({
    large:true,
    title: id?'Modifica diagramma HACCP':'Nuovo diagramma HACCP', body,
    footer:[
      el('button',{class:'btn',text:'Annulla',onclick:()=>close()}),
      el('button',{class:'btn btn-primary',text:'Salva',onclick:()=>{
        const item = {...(data.id?{id:data.id}:{}),alimento:fA.value.trim(),fasi:data.fasi};
        if(!item.alimento){ toast('Nome alimento obbligatorio','err'); return; }
        store.upsert('haccp',item); toast('Diagramma salvato','ok'); close();
      }})
    ]
  });
}

RM.modules.haccp = {mount, unmount};
})();
