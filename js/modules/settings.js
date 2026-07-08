(function(){
'use strict';
const RM = window.RM = window.RM || {};
RM.modules = RM.modules || {};
const {el, toast, confirmDialog, uid, downloadBlob, fmtDate} = RM.utils;
const {store} = RM;

function mount(root){
  let s = store.getSettings();

  const fNome = el('input',{type:'text',value:s.nome_locale||'',placeholder:'Es. Trattoria del Borgo'});
  const fIndir = el('input',{type:'text',value:s.indirizzo||'',placeholder:'Via Roma 1, 00100 Roma'});
  const fIva   = el('input',{type:'number',min:'0',max:'100',step:'0.5',value:s.iva_default||10});
  const fFc    = el('input',{type:'number',min:'5',max:'80',step:'0.5',value:s.foodcost_target_pct||30});
  const fBackup= el('input',{type:'number',min:'1',step:'1',value:s.backup_ogni_n_modifiche||25});

  // === BACKUP COMPLETO (tutti i ristoranti) ===
  const fRestore = el('input',{type:'file',accept:'.json,application/json',hidden:true});
  fRestore.addEventListener('change', async e=>{
    const f = e.target.files?.[0]; fRestore.value='';
    if(!f) return;
    let data; try{ data = JSON.parse(await f.text()); }catch{ toast('File non valido','err'); return; }
    if(!data || data._fmt!=='cambusa-backup'){ toast('Non è un backup di Cambusa','err'); return; }
    const n = (data.app?.restaurants||[]).length;
    const when = data.savedAt ? fmtDate(data.savedAt) : '?';
    if(!await confirmDialog(`Ripristinare il backup (${n} ristorante${n===1?'':'i'}, del ${when})? TUTTI i dati attuali verranno sostituiti. Operazione irreversibile.`,'Ripristina')) return;
    if(store.restore(data)){ toast('Backup ripristinato','ok'); setTimeout(()=>location.reload(),400); }
    else toast('Ripristino fallito','err');
  });

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

  // === Sposta dati tra ristoranti ===
  const rests = store.getRestaurants();
  const fFrom = el('select');
  const fTo   = el('select');
  for(const r of rests){
    fFrom.appendChild(el('option',{value:r.id,text:r.name,selected:r.id===active?.id}));
    fTo.appendChild(el('option',{value:r.id,text:r.name}));
  }
  // destinazione predefinita: il primo ristorante diverso dall'origine
  const firstOther = rests.find(r=>r.id!==active?.id); if(firstOther) fTo.value=firstOther.id;
  const fMove = el('input',{type:'checkbox'});
  async function doTransfer(){
    const fromId=fFrom.value, toId=fTo.value;
    if(fromId===toId){ toast('Scegli due ristoranti diversi','err'); return; }
    const fromN = rests.find(r=>r.id===fromId)?.name||'origine';
    const toN   = rests.find(r=>r.id===toId)?.name||'destinazione';
    const move  = fMove.checked;
    const azione = move?'SPOSTARE':'copiare';
    if(!await confirmDialog(`Vuoi ${azione} tutti i dati (piatti, ingredienti, preparazioni, menù, fornitori, HACCP, giacenze) da “${fromN}” a “${toN}”?${move?` I dati verranno RIMOSSI da “${fromN}”.`:''} Nome, stile e loghi di “${toN}” restano invariati. Nessun doppione.`, move?'Sposta dati':'Copia dati')) return;
    const s = store.transferData(fromId, toId, {move});
    if(!s){ toast('Trasferimento non riuscito','err'); return; }
    const tot = Object.values(s).reduce((a,b)=>a+b,0);
    toast(`${tot} elementi trasferiti su “${toN}” (piatti ${s.piatti||0}, ingredienti ${s.ingredienti||0}, menù ${s.menu||0})`,'ok');
  }

  // === Sincronizzazione (GitHub Gist) ===
  const fToken = el('input',{type:'password',value:'',autocomplete:'off',placeholder: RM.sync?.cfg.token ? 'token già impostato — incolla per sostituirlo' : 'ghp_… (token con permesso gist)'});
  const fAuto  = el('input',{type:'checkbox'}); fAuto.checked = !!RM.sync?.cfg.auto;
  const syncStatus = el('div',{class:'muted',style:{fontSize:'12px',margin:'8px 0'}});
  function refreshSyncStatus(){
    if(!RM.sync){ syncStatus.textContent='Modulo sync non disponibile.'; return; }
    const s = RM.sync.status();
    const last = s.syncedUpdatedAt ? new Date(s.syncedUpdatedAt).toLocaleString('it-IT') : 'mai';
    syncStatus.textContent = `${s.hasToken?'✓ token impostato':'✗ token mancante'} · ${s.gistId?('gist '+s.gistId.slice(0,8)+'…'):'gist non ancora creato'} · auto ${s.auto?'ON':'OFF'} · ultima sync: ${last}`;
  }
  refreshSyncStatus();
  async function runSync(kind){
    if(!RM.sync){ toast('Modulo sync non disponibile','err'); return; }
    try{
      if(kind==='save'){ const v=fToken.value.trim(); if(!v){ toast('Incolla il token','err'); return; } RM.sync.cfg.token=v; fToken.value=''; fToken.placeholder='token già impostato — incolla per sostituirlo'; toast('Token salvato','ok'); refreshSyncStatus(); return; }
      if(!RM.sync.cfg.token){ toast('Salva prima il token','err'); return; }
      if(kind==='push'){ await RM.sync.push(); toast('Dati inviati in cloud','ok'); refreshSyncStatus(); }
      else if(kind==='pull'){
        if(!await confirmDialog('Scaricare i dati dal cloud e SOSTITUIRE quelli su questo dispositivo? Consigliato la prima volta su telefono/PC secondari.','Scarica')) return;
        await RM.sync.pull(); toast('Dati scaricati — ricarico…','ok'); setTimeout(()=>location.reload(),600);
      }
      else { const r=await RM.sync.syncNow(); toast(r.pulled?'Scaricato dal cloud — ricarico…':r.pushed?'Inviato in cloud':'Già sincronizzato','ok'); if(r.pulled){ setTimeout(()=>location.reload(),600); return; } refreshSyncStatus(); }
    }catch(e){ toast('Sync fallita: '+e.message,'err'); }
  }
  fAuto.addEventListener('change',()=>{ if(RM.sync){ RM.sync.cfg.auto=fAuto.checked; refreshSyncStatus(); toast('Sync automatica '+(fAuto.checked?'attivata':'disattivata'),'ok'); } });

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
    el('div',{class:'card',style:{marginTop:'14px'}},[
      el('h2',{text:'Backup completo'}),
      el('p',{class:'muted',style:{marginBottom:'12px',fontSize:'12.5px'},text:'Salva o ripristina TUTTI i ristoranti e i loro dati in un unico file .json. Utile per spostare il lavoro su un altro dispositivo o tenere una copia di sicurezza.'}),
      el('div',{class:'row',style:{gap:'10px',flexWrap:'wrap'}},[
        el('button',{class:'btn btn-primary',text:'↥ Esporta backup (.json)',onclick:()=>{
          const data = store.backup();
          const blob = new Blob([JSON.stringify(data)],{type:'application/json'});
          downloadBlob(blob, `cambusa-backup-${new Date().toISOString().slice(0,10)}.json`);
          toast('Backup esportato','ok');
        }}),
        el('label',{class:'btn',text:'↧ Importa backup'},[fRestore]),
      ]),
    ]),
    el('div',{class:'card',style:{marginTop:'14px'}},[
      el('h2',{text:'Menù della Carta'}),
      el('p',{class:'muted',style:{marginBottom:'12px',fontSize:'12.5px'},text:'Carica il menù completo (Piazzetta, Salse, Buns, Crostoni, Sfizi, Insalatine, Piatti, Signature) su questo ristorante. Aggiorna la categoria dei piatti già presenti e aggiunge quelli mancanti con ingredienti e allergeni. Non crea doppioni: puoi premerlo più volte in sicurezza.'}),
      el('button',{class:'btn btn-primary',text:'↧ Carica / aggiorna menù della Carta',onclick:async()=>{
        const nm = store.getActive()?.name || 'questo ristorante';
        if(!await confirmDialog(`Caricare/aggiornare il menù della Carta su “${nm}”? I piatti esistenti verranno ricategorizzati e quelli mancanti aggiunti. Nessun doppione.`,'Carica menù')) return;
        const {fixedCat, addedDish} = RM.modules.seedCarta.run();
        toast(`Menù aggiornato: ${addedDish} piatti aggiunti, ${fixedCat} ricategorizzati`,'ok');
        location.hash = '#piatti';
      }}),
    ]),
    el('div',{class:'card',style:{marginTop:'14px'}},[
      el('h2',{text:'Sposta dati tra ristoranti'}),
      el('p',{class:'muted',style:{marginBottom:'12px',fontSize:'12.5px'},text:'Copia o sposta piatti, ingredienti, preparazioni, menù, fornitori, HACCP e giacenze da un ristorante all\'altro. Nome, stile e loghi del ristorante di destinazione restano invariati; i collegamenti (ricette, allergeni) sono preservati. Non crea doppioni.'}),
      el('div',{class:'grid-2'},[
        el('div',{class:'field'},[ el('label',{text:'Da (origine)'}), fFrom ]),
        el('div',{class:'field'},[ el('label',{text:'A (destinazione)'}), fTo ]),
      ]),
      el('label',{class:'row',style:{gap:'8px',alignItems:'center',cursor:'pointer',margin:'8px 0'}},[
        fMove, el('span',{text:'Svuota il ristorante di origine dopo lo spostamento (altrimenti resta una copia)'}) ]),
      el('button',{class:'btn btn-primary',text:'Trasferisci dati',onclick:doTransfer}),
    ]),
    el('div',{class:'card',style:{marginTop:'14px'}},[
      el('h2',{text:'Sincronizzazione tra dispositivi'}),
      el('p',{class:'muted',style:{marginBottom:'10px',fontSize:'12.5px'},text:'Salva la memoria (tutti i ristoranti) in un Gist segreto del tuo account GitHub, per ritrovarla su telefono e PC. Serve un token con il solo permesso “gist”.'}),
      el('ol',{class:'muted',style:{fontSize:'12px',margin:'0 0 12px 18px',lineHeight:'1.6'}},[
        el('li',{},[ 'Crea un token ',
          el('b',{text:'CLASSIC'}),
          ' qui: ',
          el('a',{href:'https://github.com/settings/tokens/new?scopes=gist&description=Cambusa%20Sync',target:'_blank',rel:'noopener',style:{color:'var(--accent)',fontWeight:'600'},text:'github.com/settings/tokens/new'}),
          ' (spunta solo “gist”), genera e copia. I token “fine-grained” non funzionano coi Gist.' ]),
        el('li',{text:'Incollalo qui sotto → “Salva token”.'}),
        el('li',{text:'Sul dispositivo che HA i dati premi “Invia”. Sugli altri premi “Scarica”. Poi attiva l’auto-sync.'}),
      ]),
      el('div',{class:'field'},[ el('label',{text:'Token GitHub (permesso gist)'}), fToken ]),
      el('div',{class:'row wrap',style:{gap:'8px',margin:'8px 0'}},[
        el('button',{class:'btn',text:'Salva token',onclick:()=>runSync('save')}),
        el('button',{class:'btn btn-primary',text:'⇅ Sincronizza ora',onclick:()=>runSync('now')}),
        el('button',{class:'btn',text:'⬆︎ Invia',onclick:()=>runSync('push')}),
        el('button',{class:'btn',text:'⬇︎ Scarica',onclick:()=>runSync('pull')}),
      ]),
      el('label',{class:'row',style:{gap:'8px',alignItems:'center',cursor:'pointer',margin:'6px 0'}},[
        fAuto, el('span',{text:'Sincronizza automaticamente (all’apertura e dopo ogni modifica)'}) ]),
      syncStatus,
      el('p',{class:'muted',style:{fontSize:'11px'},text:'Sicurezza: il token resta salvato in questo browser; usa un token con solo permesso “gist”, revocabile in ogni momento da GitHub. La sincronizzazione usa “vince l’ultima modifica”: se modifichi in contemporanea su due dispositivi, l’ultimo salvataggio prevale.'}),
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
