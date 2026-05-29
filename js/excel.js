(function(){
'use strict';
const RM = window.RM = window.RM || {};
const {store} = RM;
const {toast, fmtDate, arrToCsv, csvToArr, downloadBlob, confirmDialog} = RM.utils;
const {kpiGlobali, foodcostPiatto, ingredientiMap} = RM.calc;

const SHEETS = {
  Dashboard: {
    build(){
      const k = kpiGlobali();
      const s = store.getSettings();
      return [
        {Metrica:'Locale', Valore:s.nome_locale||''},
        {Metrica:'Indirizzo', Valore:s.indirizzo||''},
        {Metrica:'Generato il', Valore:fmtDate(Date.now())},
        {Metrica:'N. ingredienti', Valore:k.n_ingredienti},
        {Metrica:'N. piatti', Valore:k.n_piatti},
        {Metrica:'Food cost medio %', Valore:Number(k.foodcost_medio.toFixed(2))},
        {Metrica:'Costo medio porzione €', Valore:Number(k.costo_medio_porz.toFixed(2))},
        {Metrica:'Food cost target %', Valore:s.foodcost_target_pct},
      ];
    }, apply(){},
  },
  Ingredienti: {
    build(){
      const forn = new Map(store.all('fornitori').map(f=>[f.id,f.nome]));
      return store.all('ingredienti').map(i=>({
        id:i.id, nome:i.nome, categoria:i.categoria, unita:i.unita,
        prezzo_sicuro:i.prezzo_sicuro, prezzo_medio:i.prezzo_medio,
        fornitore:forn.get(i.fornitore_id)||'', fornitore_id:i.fornitore_id||'',
        allergeni:arrToCsv(i.allergeni), note:i.note||'',
      }));
    },
    apply(rows){
      const forn = store.all('fornitori');
      const byName = new Map(forn.map(f=>[(f.nome||'').toLowerCase(),f.id]));
      return rows.map(r=>({
        id: r.id||undefined,
        nome: r.nome||'', categoria: r.categoria||'', unita: r.unita||'kg',
        prezzo_sicuro: Number(r.prezzo_sicuro)||0,
        prezzo_medio:  Number(r.prezzo_medio)||0,
        fornitore_id: r.fornitore_id || (r.fornitore? byName.get(String(r.fornitore).toLowerCase())||'' : ''),
        allergeni: csvToArr(r.allergeni),
        note: r.note||'',
      })).filter(x=>x.nome);
    },
    storeKey:'ingredienti',
  },
  Fornitori: {
    build(){ return store.all('fornitori').map(f=>({id:f.id,nome:f.nome,contatto:f.contatto||'',telefono:f.telefono||'',email:f.email||'',note:f.note||''})); },
    apply(rows){ return rows.map(r=>({id:r.id||undefined,nome:r.nome||'',contatto:r.contatto||'',telefono:String(r.telefono||''),email:r.email||'',note:r.note||''})).filter(x=>x.nome); },
    storeKey:'fornitori',
  },
  Piatti: {
    build(){
      const ingMap = ingredientiMap();
      return store.all('piatti').map(p=>{
        const c = foodcostPiatto(p,ingMap);
        return {
          id:p.id, nome:p.nome, categoria:p.categoria||'',
          porzioni:p.porzioni||1, tempo_min:p.tempo_min||0, difficolta:p.difficolta||'',
          prezzo_vendita:p.prezzo_vendita||0,
          costo_porzione: Number(c.costo_porz_sicuro.toFixed(2)),
          foodcost_pct:  Number(c.foodcost_pct.toFixed(2)),
          allergeni: arrToCsv(c.allergeni),
          procedimento:p.procedimento||'',
          impiattamento:p.impiattamento||'',
        };
      });
    },
    apply(rows){
      const cur = new Map(store.all('piatti').map(p=>[p.id,p]));
      return rows.map(r=>{
        const ex = r.id ? cur.get(r.id) : null;
        return {
          id: r.id||undefined,
          nome: r.nome||'', categoria: r.categoria||'',
          porzioni: Number(r.porzioni)||1, tempo_min:Number(r.tempo_min)||0,
          difficolta: r.difficolta||'media',
          prezzo_vendita: Number(r.prezzo_vendita)||0,
          procedimento: r.procedimento||'',
          impiattamento: r.impiattamento||ex?.impiattamento||'',
          ingredienti: ex?.ingredienti||[],
          allergeni: ex?.allergeni||csvToArr(r.allergeni),
          foto_dataurl: ex?.foto_dataurl||'',
        };
      }).filter(x=>x.nome);
    },
    storeKey:'piatti',
  },
  Ricette: {
    build(){
      const ingMap = ingredientiMap();
      const rows = [];
      for(const p of store.all('piatti')){
        for(const r of (p.ingredienti||[])){
          const ing = ingMap.get(r.ing_id);
          rows.push({
            piatto_id:p.id, piatto:p.nome,
            ing_id:r.ing_id, ingrediente:ing?.nome||'',
            quantita:r.grammi, unita: ing?.unita==='kg'?'g':ing?.unita==='L'?'ml':ing?.unita||'',
            note:r.note||'',
          });
        }
      }
      return rows;
    },
    apply(rows){
      const byPiatto = new Map();
      for(const r of rows){
        if(!r.piatto_id) continue;
        if(!byPiatto.has(r.piatto_id)) byPiatto.set(r.piatto_id, []);
        byPiatto.get(r.piatto_id).push({ ing_id:r.ing_id, grammi:Number(r.quantita)||0, note:r.note||'' });
      }
      return {__map:byPiatto, __isComposition:true};
    },
    finalize(map){
      const piatti = store.all('piatti');
      for(const p of piatti){ if(map.has(p.id)) p.ingredienti = map.get(p.id); }
      store.set('piatti', piatti);
    },
  },
  Menu: {
    build(){ return store.all('menu').map(m=>({id:m.id,nome:m.nome,data:m.data||'',piatti_ids:arrToCsv(m.piatti_ids),note:m.note||''})); },
    apply(rows){ return rows.map(r=>({id:r.id||undefined,nome:r.nome||'',data:r.data||'',piatti_ids:csvToArr(r.piatti_ids),note:r.note||''})).filter(x=>x.nome); },
    storeKey:'menu',
  },
  HACCP: {
    build(){
      const rows=[];
      for(const h of store.all('haccp')){
        (h.fasi||[]).forEach((f,i)=>{
          rows.push({haccp_id:h.id,alimento:h.alimento,fase_idx:i+1,fase:f.nome||'',tipo:f.tipo||'processo',ccp:f.ccp?'SI':'NO',descrizione:f.descrizione||'',limiti_critici:f.limiti_critici||'',monitoraggio:f.monitoraggio||'',azioni_correttive:f.azioni_correttive||''});
        });
        if(!h.fasi?.length) rows.push({haccp_id:h.id,alimento:h.alimento,fase_idx:'',fase:'',tipo:'',ccp:'',descrizione:'',limiti_critici:'',monitoraggio:'',azioni_correttive:''});
      }
      return rows;
    },
    apply(rows){
      const byId = new Map();
      for(const r of rows){
        const hid = r.haccp_id; if(!hid && !r.alimento) continue;
        const key = hid || ('new:'+r.alimento);
        if(!byId.has(key)) byId.set(key, {id:hid||undefined, alimento:r.alimento||'', fasi:[]});
        if(r.fase || r.descrizione){
          byId.get(key).fasi.push({
            nome:r.fase||'', tipo:r.tipo||'processo',
            descrizione:r.descrizione||'',
            ccp:/^(si|sì|yes|true|x)$/i.test(String(r.ccp||'').trim()) || r.tipo==='ccp',
            limiti_critici:r.limiti_critici||'',monitoraggio:r.monitoraggio||'',azioni_correttive:r.azioni_correttive||''
          });
        }
      }
      return [...byId.values()].filter(x=>x.alimento);
    },
    storeKey:'haccp',
  },
  Giacenze: {
    build(){
      const ingMap = ingredientiMap();
      return store.all('giacenze').map(g=>({
        ing_id:g.ing_id, ingrediente: ingMap.get(g.ing_id)?.nome||'',
        quantita:g.quantita, unita:g.unita,
      }));
    },
    apply(rows){
      return rows.map(r=>({ id:r.ing_id, ing_id:r.ing_id, quantita:Number(r.quantita)||0, unita:r.unita||'' })).filter(x=>x.ing_id);
    },
    storeKey:'giacenze',
  },
  Settings:{
    build(){
      const s = store.getSettings();
      return Object.entries(s).map(([chiave,valore])=>({chiave,valore:typeof valore==='string'?valore:String(valore)}));
    },
    apply(rows){
      const o={};
      for(const r of rows){
        const k=r.chiave, v=r.valore;
        if(!k) continue;
        const n=Number(v);
        o[k]= (v==='true'?true:v==='false'?false: (!isNaN(n)&&v!=='' && k!=='nome_locale' && k!=='indirizzo' && k!=='valuta' && k!=='logo') ? n : v);
      }
      return o;
    },
    isSettings:true,
  },
};

function exportWorkbook(){
  if(typeof XLSX==='undefined'){ toast('Libreria Excel non caricata','err'); return; }
  const wb = XLSX.utils.book_new();
  for(const [name,def] of Object.entries(SHEETS)){
    const rows = def.build();
    const ws = XLSX.utils.json_to_sheet(rows.length?rows:[{info:'(nessun dato)'}]);
    XLSX.utils.book_append_sheet(wb,ws,name);
  }
  const stamp = new Date().toISOString().slice(0,10);
  const nome = (store.getSettings().nome_locale||'restaurant').replace(/[^a-z0-9]+/gi,'_').toLowerCase();
  const out = XLSX.write(wb,{bookType:'xlsx',type:'array'});
  downloadBlob(new Blob([out],{type:'application/octet-stream'}), `${nome}_${stamp}.xlsx`);
  store.setSettings({modifiche_dall_ultimo_backup:0});
  toast('Excel esportato','ok');
}

async function importWorkbook(file){
  if(typeof XLSX==='undefined'){ toast('Libreria Excel non caricata','err'); return; }
  if(!await confirmDialog('Importare i dati dal file Excel? I dati attuali verranno sostituiti dove presenti nel file.','Importa')) return;
  try{
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf,{type:'array'});
    let imported = 0;
    for(const [name,def] of Object.entries(SHEETS)){
      if(name==='Dashboard'||name==='Ricette') continue;
      const ws = wb.Sheets[name]; if(!ws) continue;
      const rows = XLSX.utils.sheet_to_json(ws,{defval:''});
      const result = def.apply(rows);
      if(def.isSettings){ store.setSettings(result); imported++; continue; }
      if(def.storeKey){ store.set(def.storeKey, result); imported++; }
    }
    if(wb.Sheets['Ricette']){
      const rows = XLSX.utils.sheet_to_json(wb.Sheets['Ricette'],{defval:''});
      const res = SHEETS.Ricette.apply(rows);
      if(res?.__isComposition){ SHEETS.Ricette.finalize(res.__map); imported++; }
    }
    toast(`Importati ${imported} fogli`,'ok');
    location.reload();
  }catch(e){
    console.error(e);
    toast('Errore lettura Excel: '+e.message,'err');
  }
}

RM.excel = {exportWorkbook, importWorkbook};
})();
