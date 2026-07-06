(function(){
'use strict';
const RM = window.RM = window.RM || {};
RM.modules = RM.modules || {};

// ============================================================================
// Seed "Carta" — popola/aggiorna il menù del ristorante attivo secondo la carta
// (Piazzetta, Salse, Buns, Crostoni, Sfizi, Insalatine, Piatti, Signature).
//
// Idempotente:
//  - i piatti già presenti (per nome) non vengono duplicati: ne viene solo
//    corretta la categoria secondo la nuova tassonomia;
//  - i piatti mancanti vengono creati con ingredienti (via createQuick, che
//    riusa l'anagrafica esistente) e allergeni derivati.
// Legenda allergeni Carta → nomi app:
//  1 glutine · 2 crostacei · 3 uova · 4 pesce · 5 arachidi · 6 soia
//  7 latticini · 8 frutta a guscio · 9 sedano · 10 senape · 11 sesamo
//  12 solfiti · 13 lupini · 14 molluschi
// ============================================================================

// Piatti esistenti → nuova categoria (match per nome, case-insensitive)
const CAT_FIX = {
  'piazzetta':'Piazzetta',
  'tzatziki':'Salse', 'hummus':'Salse', 'guacamole':'Salse', 'alpino':'Salse',
  'classicone':'Buns', 'little tonny':'Buns', 'pa-nino':'Buns',
  'veg':'Buns', 'vegburger':'Buns',
};

// Piatti della Carta da creare se mancanti. Ogni ingrediente: [nome, [allergeni]]
const NUOVI = [
  // ---- CROSTONI ----
  {nome:'Burro alle erbe e alici', categoria:'Crostoni',
   desc:'Crostone, burro alle erbe montato, alici',
   ing:[['Crostone',['glutine']], ['Burro alle erbe',['latticini']], ['Alici',['pesce']]]},
  {nome:'Baccalà mantecato', categoria:'Crostoni',
   desc:'Crostone, baccalà mantecato',
   ing:[['Crostone',['glutine']], ['Baccalà mantecato',['pesce']]]},

  // ---- SFIZI ----
  {nome:'Fish & Chips', categoria:'Sfizi',
   desc:'Pesce in pastella, salsa tartara',
   ing:[['Pesce in pastella',['glutine','pesce']], ['Salsa tartara',['uova']]]},
  {nome:'Panella e tartare di carne', categoria:'Sfizi',
   desc:'Panella, tartare di carne, maionese di cappero e ravanelli, acciuga, tuorlo marinato',
   ing:[['Panella',[]], ['Tartare di carne',[]], ['Maionese di cappero e ravanelli',['uova']],
        ['Acciuga',['pesce']], ['Tuorlo marinato',['uova']]]},
  {nome:'Scagghiozza', categoria:'Sfizi',
   desc:'Salsa verde, lingua o alici (da confermare)',
   ing:[['Scagghiozza',[]], ['Salsa verde',[]], ['Alici',['pesce']]]},
  {nome:'Falafel', categoria:'Sfizi',
   desc:'Ceci, spezie, erbe',
   ing:[['Ceci',[]], ['Spezie',[]], ['Erbe aromatiche',[]]]},
  {nome:'Mix', categoria:'Sfizi',
   desc:'Selezione di sfizi',
   ing:[]},

  // ---- INSALATINE ----
  {nome:'Oriental', categoria:'Insalatine',
   desc:'Misticanza, salsa orientale, noci, feta veg, mela, pomodori confit',
   ing:[['Misticanza',[]], ['Salsa orientale',['soia']], ['Noci',['frutta a guscio']],
        ['Feta veg',[]], ['Mela',[]], ['Pomodori confit',[]]]},
  {nome:'Caesar', categoria:'Insalatine',
   desc:'Lattughino, salsa caesar, bacon, uova, petto di pollo, crostini (da confermare)',
   ing:[['Lattughino',[]], ['Salsa caesar',['uova','pesce','latticini']], ['Bacon',[]],
        ['Uova',['uova']], ['Petto di pollo',[]], ['Crostini',['glutine']]]},

  // ---- PIATTI ----
  {nome:'Sashimi di tonno', categoria:'Piatti',
   desc:'Tonno, cetriolo, menta, mela, salsa orientale',
   ing:[['Tonno',['pesce']], ['Cetriolo',[]], ['Menta',[]], ['Mela',[]], ['Salsa orientale',['soia']]]},
  {nome:'Caprese', categoria:'Piatti',
   desc:'Pomodorini variegati, basilico variegato, bufala (250 g)',
   ing:[['Pomodorini variegati',[]], ['Basilico',[]], ['Bufala',['latticini']]]},
  {nome:'Burratina', categoria:'Piatti',
   desc:'Marmellata di pomodoro, crostoni (friselle alle olive)',
   ing:[['Burratina',['latticini']], ['Marmellata di pomodoro',[]], ['Friselle alle olive',['glutine']]]},
  {nome:'Carpaccio di Black Angus', categoria:'Piatti',
   desc:'Carpaccio di Black Angus, rucola, scaglie di parmigiano',
   ing:[['Carpaccio di Black Angus',[]], ['Rucola',[]], ['Parmigiano',['latticini']]]},

  // ---- SIGNATURE ----
  {nome:'Crispy tamago', categoria:'Signature',
   desc:'Maionese di baccalà, gel umadashi (dashi, soia, kuzu), uovo poché panato nel panko e fritto, coste di bietola osmotizzate con soia, erba cipollina',
   ing:[['Maionese di baccalà',['uova','pesce']], ['Gel umadashi',['pesce','soia']],
        ['Uovo poché',['uova']], ['Panko',['glutine']], ['Coste di bietola',[]], ['Erba cipollina',[]]]},
];

// esegue il seed sul ristorante attivo, restituisce un riepilogo
function run(){
  const {store} = RM;
  const createQuick = RM.modules.ingredienti.createQuick;
  let fixedCat = 0, addedDish = 0;

  // 1) correggi la categoria dei piatti esistenti
  const piatti = store.all('piatti');
  const have = new Set(piatti.map(p => (p.nome||'').toLowerCase()));
  for(const p of piatti){
    const nc = CAT_FIX[(p.nome||'').toLowerCase()];
    if(nc && p.categoria !== nc){ p.categoria = nc; store.upsert('piatti', p); fixedCat++; }
  }

  // 2) aggiungi i piatti mancanti
  for(const d of NUOVI){
    if(have.has(d.nome.toLowerCase())) continue;
    const righe = [];
    for(const [nome, alg] of (d.ing || [])){
      const ing = createQuick(nome, alg && alg.length ? {allergeni: alg} : {});
      if(ing) righe.push({ing_id: ing.id, grammi: 0, note: ''});
    }
    const item = {
      nome: d.nome, categoria: d.categoria, porzioni: 1, prezzo_vendita: 0,
      ingredienti: righe, procedimento: d.desc || '', impiattamento: '',
      tempo_min: 0, difficolta: 'media', allergeni: [], foto_dataurl: '',
    };
    // allergeni derivati dagli ingredienti
    item.allergeni = RM.calc.foodcostPiatto(item, RM.calc.ingredientiMap()).allergeni;
    store.upsert('piatti', item);
    have.add(d.nome.toLowerCase());
    addedDish++;
  }

  return {fixedCat, addedDish};
}

RM.modules.seedCarta = {run};
})();
