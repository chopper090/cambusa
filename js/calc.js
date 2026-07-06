(function(){
'use strict';
const RM = window.RM = window.RM || {};
const {pricePerBase} = RM.utils;
const {store} = RM;

// somma delle quantità (unità base) dei componenti di una preparazione
function subQtyTotal(sub){ let t=0; for(const r of (sub||[])) t+=Number(r.grammi)||0; return t; }

// costo per UNITÀ BASE (€/g, €/ml, €/pz) di un ingrediente.
// Per le "preparazioni" (ingredienti composti) è calcolato ricorsivamente dai
// componenti diviso la resa; guardia anti-ciclo tramite `seen`.
function unitCost(ing, ingMap, which='sicuro', seen=new Set()){
  if(!ing) return 0;
  if(ing.tipo==='preparazione' && Array.isArray(ing.sub) && ing.sub.length && !seen.has(ing.id)){
    seen.add(ing.id);
    let tot=0;
    for(const r of ing.sub){
      const child = ingMap && ingMap.get(r.ing_id);
      tot += (Number(r.grammi)||0) * unitCost(child, ingMap, which, seen);
    }
    seen.delete(ing.id);
    const resa = Number(ing.resa)>0 ? Number(ing.resa) : subQtyTotal(ing.sub);
    return resa>0 ? tot/resa : 0;
  }
  const prezzo = which==='medio' ? (Number(ing.prezzo_medio)||0) : (Number(ing.prezzo_sicuro)||0);
  return pricePerBase(prezzo, ing.unita);
}

// allergeni effettivi di un ingrediente: i propri + (ricorsivo) quelli dei
// componenti se è una preparazione. Guardia anti-ciclo tramite `seen`.
function resolveAllergeni(ing, ingMap, seen=new Set()){
  if(!ing) return [];
  const out = new Set(ing.allergeni||[]);
  if(ing.tipo==='preparazione' && Array.isArray(ing.sub) && !seen.has(ing.id)){
    seen.add(ing.id);
    for(const r of ing.sub){
      const child = ingMap && ingMap.get(r.ing_id);
      for(const a of resolveAllergeni(child, ingMap, seen)) out.add(a);
    }
    seen.delete(ing.id);
  }
  return [...out];
}

// prezzo per unita ingrediente (€/kg, €/L, €/pz). Quantità ricetta in unità base (g, ml, pz).
function costoRiga(ing, riga, ingMap){
  if(!ing) return {sicuro:0, medio:0};
  const qty = Number(riga.grammi)||0;
  return { sicuro: qty*unitCost(ing, ingMap, 'sicuro'), medio: qty*unitCost(ing, ingMap, 'medio') };
}

function foodcostPiatto(piatto, ingMap){
  let tot_s=0, tot_m=0;
  const porz = Math.max(1, Number(piatto.porzioni)||1);
  const allergeni = new Set();
  for(const r of (piatto.ingredienti||[])){
    const ing = ingMap.get(r.ing_id);
    if(!ing) continue;
    const c = costoRiga(ing, r, ingMap);
    tot_s += c.sicuro; tot_m += c.medio;
    for(const a of resolveAllergeni(ing, ingMap)) allergeni.add(a);
  }
  const cs_porz = tot_s/porz, cm_porz = tot_m/porz;
  const prezzo = Number(piatto.prezzo_vendita)||0;
  return {
    costo_tot_sicuro: tot_s, costo_tot_medio: tot_m,
    costo_porz_sicuro: cs_porz, costo_porz_medio: cm_porz,
    margine: prezzo - cs_porz,
    margine_pct: prezzo>0 ? (1 - cs_porz/prezzo)*100 : 0,
    foodcost_pct: prezzo>0 ? (cs_porz/prezzo)*100 : 0,
    allergeni: [...allergeni],
  };
}

function ingredientiMap(){ return new Map(store.all('ingredienti').map(i=>[i.id,i])); }

function prezzoSuggerito(costoPorz, fcTargetPct){
  if(!costoPorz || !fcTargetPct) return 0;
  return costoPorz / (fcTargetPct/100);
}

function kpiGlobali(){
  const piatti = store.all('piatti');
  const ingr   = store.all('ingredienti');
  const ingMap = new Map(ingr.map(i=>[i.id,i]));
  let fcSum=0, fcN=0, costSum=0, costN=0;
  for(const p of piatti){
    const c = foodcostPiatto(p, ingMap);
    if(c.foodcost_pct>0){ fcSum += c.foodcost_pct; fcN++; }
    if(c.costo_porz_sicuro>0){ costSum += c.costo_porz_sicuro; costN++; }
  }
  return { n_piatti:piatti.length, n_ingredienti:ingr.length,
           foodcost_medio: fcN?fcSum/fcN:0, costo_medio_porz: costN?costSum/costN:0 };
}

RM.calc = {costoRiga, foodcostPiatto, ingredientiMap, prezzoSuggerito, kpiGlobali, unitCost, resolveAllergeni, subQtyTotal};
})();
