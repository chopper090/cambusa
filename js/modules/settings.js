(function(){
'use strict';
const RM = window.RM = window.RM || {};
RM.modules = RM.modules || {};
const {el, toast, confirmDialog, uid} = RM.utils;
const {store} = RM;

function mount(root){
  let s = store.getSettings();

  const fNome = el('input',{type:'text',value:s.nome_locale||'',placeholder:'Es. Trattoria del Borgo'});
  const fIndir = el('input',{type:'text',value:s.indirizzo||'',placeholder:'Via Roma 1, 00100 Roma'});
  const fIva   = el('input',{type:'number',min:'0',max:'100',step:'0.5',value:s.iva_default||10});
  const fFc    = el('input',{type:'number',min:'5',max:'80',step:'0.5',value:s.foodcost_target_pct||30});
  const fBackup= el('input',{type:'number',min:'1',step:'1',value:s.backup_ogni_n_modifiche||25});

  // === LOGHI MULTIPLI ===
  const logosBox = el('div',{class:'list'});
  function refreshLogos(){
    s = store.getSettings();
    logosBox.innerHTML='';
    if(!s.logos?.length){
      logosBox.appendChild(el('div',{class:'drop',text:'Carica un logo (PNG/JPG con sfondo trasparente per la filigrana)'}));
    }else{
      for(const l of s.logos){
        logosBox.appendChild(el('div',{class:'list-item'},[
          el('img',{src:l.data,style:{width:48,height:48,objectFit:'contain',background:'var(--side)',borderRadius:'6px',padding:'4px'}}),
          el('div',{class:'grow'},[el('div',{class:'title',text:l.name})]),
          el('button',{class:'btn btn-sm btn-danger',text:'×',title:'Rimuovi',onclick:async()=>{
            if(!await confirmDialog(`Eliminare il logo "${l.name}"?`)) return;
            const ns = store.getSettings(); ns.logos = ns.logos.filter(x=>x.id!==l.id);
            // rimuovi anche dai branding che lo usano
            for(const k of Object.keys(ns.branding||{})) if(ns.branding[k]?.logo_id===l.id) ns.branding[k].logo_id='';
            store.setSettings(ns);
            refreshLogos(); refreshBrandingPickers();
          }}),
        ]));
      }
    }
  }
  refreshLogos();
  const fLogoUp = el('input',{type:'file',accept:'image/*',multiple:true});
  fLogoUp.addEventListener('change', async e=>{
    const files = [...(e.target.files||[])];
    for(const f of files){
      const data = await new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.readAsDataURL(f);});
      const ns = store.getSettings();
      ns.logos = ns.logos||[];
      ns.logos.push({id:uid('lg'), name:f.name.replace(/\.[^.]+$/,''), data});
      store.setSettings(ns);
    }
    fLogoUp.value='';
    refreshLogos(); refreshBrandingPickers();
    toast(`${files.length} logo${files.length>1?'ghi':''} caricato`,'ok');
  });

  // === BRANDING per documento ===
  const brandingBox = el('div',{class:'col'});
  const PICKERS = [
    {key:'ricettario', label:'Ricettario PDF',  desc:'Logo in alto a destra di ogni pagina ricetta'},
    {key:'menu',       label:'Menù PDF',         desc:'Logo nella copertina e header pagine'},
    {key:'haccp',      label:'HACCP PDF',        desc:'Logo nell\'angolo dell\'header'},
    {key:'watermark_all', label:'Filigrana globale', desc:'Watermark in trasparenza al centro di tutti i PDF (consigliata opacità 5-10%)'},
  ];
  const MODES = [['header','In alto'],['corner','Angolo'],['watermark','Filigrana centrale']];

  function refreshBrandingPickers(){
    s = store.getSettings();
    brandingBox.innerHTML='';
    const logos = s.logos||[];
    for(const cfg of PICKERS){
      const b = s.branding?.[cfg.key] || {logo_id:'',mode:'header',opacity:1,size:.2};
      const row = el('div',{class:'card',style:{padding:'14px'}});
      const head = el('div',{class:'row between',style:{marginBottom:'10px'}},[
        el('div',{},[el('div',{class:'bold',text:cfg.label}), el('div',{class:'muted',style:{fontSize:'11.5px'},text:cfg.desc})]),
      ]);
      const sel = el('select',{onchange:e=>{b.logo_id=e.target.value;save();}});
      sel.appendChild(el('option',{value:'',text:'— nessuno —'}));
      for(const l of logos) sel.appendChild(el('option',{value:l.id,text:l.name,selected:b.logo_id===l.id}));
      const mode = el('select',{onchange:e=>{b.mode=e.target.value;save();}});
      for(const [v,lab] of MODES) mode.appendChild(el('option',{value:v,text:lab,selected:b.mode===v}));
      const opac = el('input',{type:'range',min:'0.03',max:'1',step:'0.01',value:b.opacity||1,oninput:e=>{b.opacity=parseFloat(e.target.value);opacLab.textContent=Math.round(b.opacity*100)+'%';save();}});
      const opacLab = el('span',{class:'muted',style:{fontSize:'11px',minWidth:'36px',textAlign:'right'},text:Math.round((b.opacity||1)*100)+'%'});
      const size = el('input',{type:'range',min:'0.05',max:'1',step:'0.01',value:b.size||.2,oninput:e=>{b.size=parseFloat(e.target.value);sizeLab.textContent=Math.round(b.size*100)+'%';save();}});
      const sizeLab = el('span',{class:'muted',style:{fontSize:'11px',minWidth:'36px',textAlign:'right'},text:Math.round((b.size||.2)*100)+'%'});
      row.append(head, el('div',{class:'grid-2'},[
        el('div',{class:'field',style:{marginBottom:0}},[el('label',{text:'Logo'}), sel]),
        el('div',{class:'field',style:{marginBottom:0}},[el('label',{text:'Posizione'}), mode]),
      ]), el('div',{class:'grid-2',style:{marginTop:'10px'}},[
        el('div',{class:'field',style:{marginBottom:0}},[el('label',{text:'Opacità'}), el('div',{class:'row',style:{gap:'8px'}},[opac, opacLab])]),
        el('div',{class:'field',style:{marginBottom:0}},[el('label',{text:'Dimensione'}), el('div',{class:'row',style:{gap:'8px'}},[size, sizeLab])]),
      ]));
      brandingBox.appendChild(row);

      function save(){
        const ns = store.getSettings();
        ns.branding = ns.branding||{};
        ns.branding[cfg.key] = b;
        store.setSettings(ns);
      }
    }
  }
  refreshBrandingPickers();

  const active = store.getActive();
  root.innerHTML='';
  root.append(
    el('div',{class:'view-head'},[el('h1',{text:'Impostazioni'})]),
    el('div',{class:'view-sub'},[
      'Queste impostazioni valgono per il ristorante attivo: ',
      el('b',{text:active?.name||'—'}),
      '. Per gestire più locali e il loro stile (logo, palette, font) vai su ',
      el('a',{href:'#ristoranti',style:{color:'var(--accent)',fontWeight:'600'},text:'Ristoranti'}),
      '.',
    ]),
    el('div',{class:'card'},[
      el('h2',{text:'Locale'}),
      el('div',{class:'grid-2'},[
        el('div',{class:'field'},[el('label',{text:'Nome del locale'}),fNome]),
        el('div',{class:'field'},[el('label',{text:'Indirizzo'}),fIndir]),
      ]),
    ]),
    el('div',{class:'card',style:{marginTop:'14px'}},[
      el('h2',{text:'Loghi'}),
      el('p',{class:'muted',style:{marginBottom:'12px',fontSize:'12.5px'},text:'Carica uno o più loghi (PNG consigliato, con sfondo trasparente per le filigrane). Li userai nei documenti e nell\'editor visuale.'}),
      logosBox,
      el('div',{class:'row',style:{marginTop:'10px'}},[
        el('label',{class:'btn btn-primary',text:'+ Carica logo'},[fLogoUp]),
      ]),
    ]),
    el('div',{class:'card',style:{marginTop:'14px'}},[
      el('h2',{text:'Branding documenti'}),
      el('p',{class:'muted',style:{marginBottom:'12px',fontSize:'12.5px'},text:'Per ogni tipo di PDF scegli logo, posizione e dimensione. La "Filigrana globale" si sovrappone a tutti i PDF: usa opacità bassa (5-10%) per un effetto firma elegante.'}),
      brandingBox,
    ]),
    el('div',{class:'card',style:{marginTop:'14px'}},[
      el('h2',{text:'Parametri food cost'}),
      el('div',{class:'grid-3'},[
        el('div',{class:'field'},[el('label',{text:'IVA default %'}),fIva]),
        el('div',{class:'field'},[el('label',{text:'Target food cost %'}),fFc,
          el('span',{class:'hint',text:'Tipico ristorazione: 25-35%.'})]),
        el('div',{class:'field'},[el('label',{text:'Backup auto ogni N modifiche'}),fBackup]),
      ]),
    ]),
    el('div',{class:'row',style:{marginTop:'18px'}},[
      el('button',{class:'btn btn-primary',text:'Salva impostazioni',onclick:()=>{
        store.setSettings({
          nome_locale:fNome.value.trim(),
          indirizzo:fIndir.value.trim(),
          iva_default:parseFloat(fIva.value)||0,
          foodcost_target_pct:parseFloat(fFc.value)||30,
          backup_ogni_n_modifiche:parseInt(fBackup.value)||25,
        });
        toast('Impostazioni salvate','ok');
      }}),
      el('div',{class:'spacer'}),
      el('button',{class:'btn btn-danger',text:'Azzera dati di questo ristorante',onclick:async()=>{
        const nm = store.getActive()?.name || 'questo ristorante';
        if(!await confirmDialog(`Sei sicuro? Verranno cancellati ingredienti, piatti, menù, HACCP e loghi di “${nm}”. Gli altri ristoranti non saranno toccati. Operazione irreversibile.`,'Azzera tutto')) return;
        store.resetAll();
        toast('Dati del ristorante azzerati','ok');
        location.hash='#dashboard';
      }})
    ])
  );
}
function unmount(){}

RM.modules.settings = {mount, unmount};
})();
