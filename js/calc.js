(function(){
'use strict';
const RM = window.RM = window.RM || {};
const {pricePerBase} = RM.utils;
const {store} = RM;

// prezzo per unita ingrediente (€/kg, €/L, €/pz). Quantità ricetta in unità base (g, ml, pz).
function costoRiga(ing, riga){
  if(!ing) return {sicuro:0, medio:0};
  const qty = Number(riga.grammi)||0;
  const pSic = pricePerBase(Number(ing.prezzo_sicuro)||0, ing.unita);
  const pMed = pricePerBase(Number(ing.prezzo_medio)||0,  ing.unita);
  return { sicuro: qty*pSic, medio: qty*pMed };
}

function foodcostPiatto(piatto, ingMap){
  let tot_s=0, tot_m=0;
  const porz = Math.max(1, Number(piatto.porzioni)||1);
  const allergeni = new Set();
  for(const r of (piatto.ingredienti||[])){
    const ing = ingMap.get(r.ing_id);
    if(!ing) continue;
    const c = costoRiga(ing, r);
    tot_s += c.sicuro; tot_m += c.medio;
    for(const a of (ing.allergeni||[])) allergeni.add(a);
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

RM.calc = {costoRiga, foodcostPiatto, ingredientiMap, prezzoSuggerito, kpiGlobali};
})();
