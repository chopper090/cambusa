(function(){
'use strict';
const RM = window.RM = window.RM || {};

// ============================================================================
// Knowledge base prezzi medi GDO Italia — stima 2026, IVA inclusa, al kg/L/pz.
// USO: auto-suggerire categoria/unità/prezzo_medio/allergeni quando si crea un
//      ingrediente. Il "prezzo sicuro" (fornitore reale) lo inserisce l'utente;
//      finché non ha accordi, parte da una stima = prezzo_medio GDO scontato 15%.
// I prezzi sono indicativi (grande distribuzione, scaffale, IVA inclusa) e vanno
// verificati: servono solo per le stime iniziali in fase di apertura.
// Formato riga: {nome, cat, u, p(€/u), alg[], alias[]}
// ============================================================================
const KB = [
  // ===== VERDURA (a foglia / da fiore) =====
  {nome:'insalata iceberg',     cat:'verdura', u:'kg', p:3.50, alg:[], alias:['iceberg']},
  {nome:'lattuga',              cat:'verdura', u:'kg', p:3.80, alg:[], alias:['lattuga romana','lattuga cappuccio']},
  {nome:'rucola',               cat:'verdura', u:'kg', p:9.50, alg:[], alias:['rughetta']},
  {nome:'songino',              cat:'verdura', u:'kg', p:12.00, alg:[], alias:['valeriana','valerianella']},
  {nome:'radicchio',            cat:'verdura', u:'kg', p:4.50, alg:[], alias:['radicchio rosso','radicchio trevigiano']},
  {nome:'spinaci',              cat:'verdura', u:'kg', p:3.80, alg:[], alias:['spinacino']},
  {nome:'bietola',              cat:'verdura', u:'kg', p:3.20, alg:[], alias:['erbette','coste']},
  {nome:'cavolo nero',          cat:'verdura', u:'kg', p:4.50, alg:[], alias:[]},
  {nome:'cavolo verza',         cat:'verdura', u:'kg', p:2.20, alg:[], alias:['verza']},
  {nome:'cavolo cappuccio',     cat:'verdura', u:'kg', p:2.00, alg:[], alias:['cappuccio']},
  {nome:'cavolfiore',           cat:'verdura', u:'kg', p:2.80, alg:[], alias:[]},
  {nome:'broccoli',             cat:'verdura', u:'kg', p:3.20, alg:[], alias:['broccolo']},
  {nome:'broccolo romanesco',   cat:'verdura', u:'kg', p:3.80, alg:[], alias:['romanesco']},
  {nome:'carciofi',             cat:'verdura', u:'kg', p:6.50, alg:[], alias:['carciofo']},
  {nome:'cime di rapa',         cat:'verdura', u:'kg', p:4.00, alg:[], alias:['friarielli']},
  {nome:'cicoria',              cat:'verdura', u:'kg', p:3.80, alg:[], alias:['catalogna']},
  {nome:'puntarelle',           cat:'verdura', u:'kg', p:6.00, alg:[], alias:[]},
  {nome:'indivia',              cat:'verdura', u:'kg', p:4.20, alg:[], alias:['scarola']},
  {nome:'finocchio',            cat:'verdura', u:'kg', p:2.80, alg:[], alias:['finocchi']},
  {nome:'asparagi',             cat:'verdura', u:'kg', p:9.00, alg:[], alias:['asparago']},

  // ===== ORTAGGI (frutto / radice / bulbo / tubero) =====
  {nome:'pomodoro',             cat:'ortaggi', u:'kg', p:2.80, alg:[], alias:['pomodori']},
  {nome:'pomodoro datterino',   cat:'ortaggi', u:'kg', p:4.50, alg:[], alias:['datterino']},
  {nome:'pomodoro ciliegino',   cat:'ortaggi', u:'kg', p:4.00, alg:[], alias:['ciliegino','pomodorini']},
  {nome:'pomodoro san marzano', cat:'ortaggi', u:'kg', p:3.80, alg:[], alias:['san marzano']},
  {nome:'pomodoro ramato',      cat:'ortaggi', u:'kg', p:3.00, alg:[], alias:['ramato']},
  {nome:'zucchina',             cat:'ortaggi', u:'kg', p:2.80, alg:[], alias:['zucchine']},
  {nome:'melanzana',            cat:'ortaggi', u:'kg', p:2.80, alg:[], alias:['melanzane']},
  {nome:'peperone',             cat:'ortaggi', u:'kg', p:3.50, alg:[], alias:['peperoni']},
  {nome:'cetriolo',             cat:'ortaggi', u:'kg', p:3.00, alg:[], alias:['cetrioli']},
  {nome:'zucca',                cat:'ortaggi', u:'kg', p:2.20, alg:[], alias:[]},
  {nome:'patate',               cat:'ortaggi', u:'kg', p:1.60, alg:[], alias:['patata']},
  {nome:'patate novelle',       cat:'ortaggi', u:'kg', p:2.50, alg:[], alias:['novelle']},
  {nome:'patata dolce',         cat:'ortaggi', u:'kg', p:3.50, alg:[], alias:['batata']},
  {nome:'carota',               cat:'ortaggi', u:'kg', p:1.60, alg:[], alias:['carote']},
  {nome:'sedano',               cat:'ortaggi', u:'kg', p:2.20, alg:['sedano'], alias:[]},
  {nome:'sedano rapa',          cat:'ortaggi', u:'kg', p:3.50, alg:['sedano'], alias:[]},
  {nome:'cipolla',              cat:'ortaggi', u:'kg', p:1.60, alg:[], alias:['cipolle','cipolla dorata']},
  {nome:'cipolla rossa',        cat:'ortaggi', u:'kg', p:2.20, alg:[], alias:['cipolla di tropea','tropea']},
  {nome:'cipollotto',           cat:'ortaggi', u:'kg', p:4.50, alg:[], alias:['cipollotti']},
  {nome:'scalogno',             cat:'ortaggi', u:'kg', p:5.50, alg:[], alias:[]},
  {nome:'porro',                cat:'ortaggi', u:'kg', p:3.50, alg:[], alias:['porri']},
  {nome:'aglio',                cat:'ortaggi', u:'kg', p:9.50, alg:[], alias:[]},
  {nome:'barbabietola',         cat:'ortaggi', u:'kg', p:2.80, alg:[], alias:['rapa rossa']},
  {nome:'ravanello',            cat:'ortaggi', u:'kg', p:5.00, alg:[], alias:['ravanelli']},
  {nome:'topinambur',           cat:'ortaggi', u:'kg', p:5.50, alg:[], alias:[]},
  {nome:'fagiolini',            cat:'ortaggi', u:'kg', p:4.50, alg:[], alias:['cornetti']},
  {nome:'piselli freschi',      cat:'ortaggi', u:'kg', p:5.00, alg:[], alias:['piselli']},
  {nome:'fave fresche',         cat:'ortaggi', u:'kg', p:4.50, alg:[], alias:['fave']},
  {nome:'mais',                 cat:'ortaggi', u:'kg', p:3.50, alg:[], alias:['granoturco']},
  {nome:'funghi champignon',    cat:'ortaggi', u:'kg', p:5.50, alg:[], alias:['champignon','funghi coltivati']},
  {nome:'funghi pleurotus',     cat:'ortaggi', u:'kg', p:7.50, alg:[], alias:['pleurotus','orecchioni']},
  {nome:'funghi porcini',       cat:'ortaggi', u:'kg', p:38.00, alg:[], alias:['porcini']},
  {nome:'funghi porcini secchi',cat:'secco e polveri', u:'kg', p:90.00, alg:['solfiti'], alias:[]},

  // ===== FRUTTA =====
  {nome:'mela',                 cat:'frutta', u:'kg', p:2.20, alg:[], alias:['mele']},
  {nome:'pera',                 cat:'frutta', u:'kg', p:2.50, alg:[], alias:['pere']},
  {nome:'banana',               cat:'frutta', u:'kg', p:1.80, alg:[], alias:['banane']},
  {nome:'arancia',              cat:'frutta', u:'kg', p:2.20, alg:[], alias:['arance']},
  {nome:'limone',               cat:'frutta', u:'kg', p:2.80, alg:[], alias:['limoni']},
  {nome:'lime',                 cat:'frutta', u:'kg', p:6.50, alg:[], alias:[]},
  {nome:'mandarino',            cat:'frutta', u:'kg', p:2.80, alg:[], alias:['mandarini','clementine']},
  {nome:'pompelmo',             cat:'frutta', u:'kg', p:2.80, alg:[], alias:[]},
  {nome:'fragole',              cat:'frutta', u:'kg', p:6.50, alg:[], alias:['fragola']},
  {nome:'lamponi',              cat:'frutta', u:'kg', p:22.00, alg:[], alias:['lampone']},
  {nome:'mirtilli',             cat:'frutta', u:'kg', p:18.00, alg:[], alias:['mirtillo']},
  {nome:'more',                 cat:'frutta', u:'kg', p:18.00, alg:[], alias:[]},
  {nome:'uva',                  cat:'frutta', u:'kg', p:3.50, alg:[], alias:['uva bianca','uva nera']},
  {nome:'pesca',                cat:'frutta', u:'kg', p:3.00, alg:[], alias:['pesche']},
  {nome:'albicocca',            cat:'frutta', u:'kg', p:3.50, alg:[], alias:['albicocche']},
  {nome:'susina',               cat:'frutta', u:'kg', p:3.00, alg:[], alias:['susine','prugne']},
  {nome:'ciliegie',             cat:'frutta', u:'kg', p:8.50, alg:[], alias:['ciliegia']},
  {nome:'melone',               cat:'frutta', u:'kg', p:2.20, alg:[], alias:[]},
  {nome:'anguria',              cat:'frutta', u:'kg', p:1.20, alg:[], alias:['cocomero']},
  {nome:'ananas',               cat:'frutta', u:'kg', p:2.50, alg:[], alias:[]},
  {nome:'kiwi',                 cat:'frutta', u:'kg', p:3.50, alg:[], alias:[]},
  {nome:'fichi',                cat:'frutta', u:'kg', p:7.00, alg:[], alias:['fico']},
  {nome:'avocado',              cat:'frutta', u:'kg', p:7.50, alg:[], alias:[]},
  {nome:'cocco',                cat:'frutta', u:'kg', p:3.50, alg:[], alias:[]},
  {nome:'mango',                cat:'frutta', u:'kg', p:6.50, alg:[], alias:[]},

  // ===== FRUTTA SECCA / OLEAGINOSA =====
  {nome:'mandorle',             cat:'frutta secca', u:'kg', p:18.00, alg:['frutta a guscio'], alias:['mandorla']},
  {nome:'noci',                 cat:'frutta secca', u:'kg', p:16.00, alg:['frutta a guscio'], alias:['noce']},
  {nome:'nocciole',             cat:'frutta secca', u:'kg', p:22.00, alg:['frutta a guscio'], alias:['nocciola']},
  {nome:'pinoli',               cat:'frutta secca', u:'kg', p:65.00, alg:['frutta a guscio'], alias:['pinolo']},
  {nome:'pistacchi',            cat:'frutta secca', u:'kg', p:32.00, alg:['frutta a guscio'], alias:['pistacchio']},
  {nome:'anacardi',             cat:'frutta secca', u:'kg', p:20.00, alg:['frutta a guscio'], alias:['anacardo']},
  {nome:'arachidi',             cat:'frutta secca', u:'kg', p:8.50, alg:['arachidi'], alias:['arachide']},
  {nome:'uvetta',               cat:'frutta secca', u:'kg', p:7.50, alg:['solfiti'], alias:['uva passa','uvetta sultanina']},
  {nome:'datteri',              cat:'frutta secca', u:'kg', p:9.00, alg:[], alias:['dattero']},
  {nome:'fichi secchi',         cat:'frutta secca', u:'kg', p:9.50, alg:['solfiti'], alias:[]},
  {nome:'albicocche secche',    cat:'frutta secca', u:'kg', p:11.00, alg:['solfiti'], alias:[]},
  {nome:'semi di sesamo',       cat:'frutta secca', u:'kg', p:8.00, alg:['sesamo'], alias:['sesamo']},
  {nome:'semi di girasole',     cat:'frutta secca', u:'kg', p:5.50, alg:[], alias:[]},
  {nome:'semi di zucca',        cat:'frutta secca', u:'kg', p:9.00, alg:[], alias:[]},

  // ===== CARNE =====
  {nome:'manzo macinato',       cat:'carne', u:'kg', p:13.50, alg:[], alias:['macinato di manzo','carne macinata']},
  {nome:'manzo controfiletto',  cat:'carne', u:'kg', p:28.00, alg:[], alias:['controfiletto','roast beef']},
  {nome:'manzo filetto',        cat:'carne', u:'kg', p:48.00, alg:[], alias:['filetto di manzo','filetto']},
  {nome:'manzo costata',        cat:'carne', u:'kg', p:24.00, alg:[], alias:['costata','entrecote']},
  {nome:'manzo tagliata',       cat:'carne', u:'kg', p:26.00, alg:[], alias:['tagliata']},
  {nome:'manzo polpa',          cat:'carne', u:'kg', p:14.00, alg:[], alias:['spezzatino di manzo','polpa di manzo']},
  {nome:'manzo guancia',        cat:'carne', u:'kg', p:13.00, alg:[], alias:['guancia di manzo','guancetta']},
  {nome:'manzo ossobuco',       cat:'carne', u:'kg', p:14.00, alg:[], alias:['ossobuco']},
  {nome:'vitello fesa',         cat:'carne', u:'kg', p:22.00, alg:[], alias:['fesa di vitello','vitello']},
  {nome:'vitello nodino',       cat:'carne', u:'kg', p:26.00, alg:[], alias:['nodino']},
  {nome:'maiale macinato',      cat:'carne', u:'kg', p:9.50, alg:[], alias:['macinato di maiale']},
  {nome:'maiale lonza',         cat:'carne', u:'kg', p:11.00, alg:[], alias:['lonza','arista']},
  {nome:'maiale costine',       cat:'carne', u:'kg', p:9.00, alg:[], alias:['costine','puntine']},
  {nome:'maiale salsiccia',     cat:'carne', u:'kg', p:10.50, alg:[], alias:['salsiccia']},
  {nome:'maiale filetto',       cat:'carne', u:'kg', p:14.00, alg:[], alias:['filetto di maiale']},
  {nome:'pollo intero',         cat:'carne', u:'kg', p:5.50, alg:[], alias:['pollo']},
  {nome:'pollo petto',          cat:'carne', u:'kg', p:11.50, alg:[], alias:['petto di pollo']},
  {nome:'pollo coscia',         cat:'carne', u:'kg', p:6.50, alg:[], alias:['cosce di pollo','fusi']},
  {nome:'pollo ali',            cat:'carne', u:'kg', p:5.00, alg:[], alias:['alette di pollo']},
  {nome:'tacchino petto',       cat:'carne', u:'kg', p:11.00, alg:[], alias:['fesa di tacchino','tacchino']},
  {nome:'agnello',              cat:'carne', u:'kg', p:24.00, alg:[], alias:['carre di agnello','costolette di agnello']},
  {nome:'coniglio',             cat:'carne', u:'kg', p:14.00, alg:[], alias:[]},
  {nome:'anatra',               cat:'carne', u:'kg', p:16.00, alg:[], alias:['petto di anatra']},
  {nome:'faraona',              cat:'carne', u:'kg', p:13.00, alg:[], alias:[]},

  // ===== PESCE / FRUTTI DI MARE =====
  {nome:'salmone',              cat:'pesce', u:'kg', p:24.00, alg:['pesce'], alias:['salmone filetto','filetto di salmone']},
  {nome:'salmone affumicato',   cat:'pesce', u:'kg', p:38.00, alg:['pesce'], alias:[]},
  {nome:'tonno fresco',         cat:'pesce', u:'kg', p:28.00, alg:['pesce'], alias:['tonno']},
  {nome:'tonno in scatola',     cat:'conserve', u:'kg', p:18.00, alg:['pesce'], alias:['tonno sott\'olio']},
  {nome:'merluzzo',             cat:'pesce', u:'kg', p:16.00, alg:['pesce'], alias:['nasello']},
  {nome:'baccala',              cat:'pesce', u:'kg', p:20.00, alg:['pesce'], alias:['baccalà','stoccafisso']},
  {nome:'orata',                cat:'pesce', u:'kg', p:16.00, alg:['pesce'], alias:[]},
  {nome:'branzino',             cat:'pesce', u:'kg', p:18.00, alg:['pesce'], alias:['spigola']},
  {nome:'spada',                cat:'pesce', u:'kg', p:24.00, alg:['pesce'], alias:['pesce spada']},
  {nome:'sgombro',              cat:'pesce', u:'kg', p:8.00, alg:['pesce'], alias:[]},
  {nome:'sardine',              cat:'pesce', u:'kg', p:7.00, alg:['pesce'], alias:['sarde']},
  {nome:'alici',                cat:'pesce', u:'kg', p:9.00, alg:['pesce'], alias:['acciughe']},
  {nome:'acciughe sott\'olio',  cat:'conserve', u:'kg', p:38.00, alg:['pesce'], alias:['filetti di acciuga']},
  {nome:'trota',                cat:'pesce', u:'kg', p:12.00, alg:['pesce'], alias:[]},
  {nome:'gamberi',              cat:'pesce', u:'kg', p:28.00, alg:['crostacei'], alias:['gambero','gamberetti']},
  {nome:'gamberi rossi',        cat:'pesce', u:'kg', p:45.00, alg:['crostacei'], alias:['gambero rosso']},
  {nome:'mazzancolle',          cat:'pesce', u:'kg', p:32.00, alg:['crostacei'], alias:['mazzancolla']},
  {nome:'scampi',               cat:'pesce', u:'kg', p:38.00, alg:['crostacei'], alias:['scampo']},
  {nome:'astice',               cat:'pesce', u:'kg', p:42.00, alg:['crostacei'], alias:[]},
  {nome:'calamari',             cat:'pesce', u:'kg', p:14.00, alg:['molluschi'], alias:['calamaro','totano']},
  {nome:'seppie',               cat:'pesce', u:'kg', p:14.00, alg:['molluschi'], alias:['seppia']},
  {nome:'polpo',                cat:'pesce', u:'kg', p:18.00, alg:['molluschi'], alias:['polipo']},
  {nome:'cozze',                cat:'pesce', u:'kg', p:5.50, alg:['molluschi'], alias:['mitili']},
  {nome:'vongole',              cat:'pesce', u:'kg', p:15.00, alg:['molluschi'], alias:['vongola']},
  {nome:'capesante',            cat:'pesce', u:'kg', p:32.00, alg:['molluschi'], alias:['cappasanta']},

  // ===== UOVA =====
  {nome:'uova',                 cat:'uova', u:'pz', p:0.40, alg:['uova'], alias:['uovo','uova fresche']},
  {nome:'tuorli',               cat:'uova', u:'pz', p:0.45, alg:['uova'], alias:['tuorlo']},
  {nome:'albume',               cat:'uova', u:'L', p:6.00, alg:['uova'], alias:['albumi']},

  // ===== LATTICINI =====
  {nome:'latte intero',         cat:'latticini', u:'L', p:1.80, alg:['latticini'], alias:['latte']},
  {nome:'latte parzialmente scremato',cat:'latticini', u:'L', p:1.70, alg:['latticini'], alias:[]},
  {nome:'panna fresca',         cat:'latticini', u:'L', p:6.50, alg:['latticini'], alias:['panna','panna da montare']},
  {nome:'panna da cucina',      cat:'latticini', u:'L', p:4.50, alg:['latticini'], alias:[]},
  {nome:'burro',                cat:'latticini', u:'kg', p:11.00, alg:['latticini'], alias:[]},
  {nome:'yogurt naturale',      cat:'latticini', u:'kg', p:3.50, alg:['latticini'], alias:['yogurt']},
  {nome:'yogurt greco',         cat:'latticini', u:'kg', p:6.00, alg:['latticini'], alias:[]},
  {nome:'mozzarella fior di latte',cat:'latticini', u:'kg', p:9.50, alg:['latticini'], alias:['mozzarella','fior di latte']},
  {nome:'mozzarella di bufala', cat:'latticini', u:'kg', p:18.00, alg:['latticini'], alias:['bufala']},
  {nome:'burrata',              cat:'latticini', u:'kg', p:19.00, alg:['latticini'], alias:[]},
  {nome:'stracciatella',        cat:'latticini', u:'kg', p:22.00, alg:['latticini'], alias:[]},
  {nome:'ricotta',              cat:'latticini', u:'kg', p:7.50, alg:['latticini'], alias:[]},
  {nome:'mascarpone',           cat:'latticini', u:'kg', p:9.00, alg:['latticini'], alias:[]},
  {nome:'parmigiano reggiano',  cat:'latticini', u:'kg', p:22.00, alg:['latticini'], alias:['parmigiano']},
  {nome:'grana padano',         cat:'latticini', u:'kg', p:18.00, alg:['latticini'], alias:['grana']},
  {nome:'pecorino romano',      cat:'latticini', u:'kg', p:18.00, alg:['latticini'], alias:['pecorino']},
  {nome:'gorgonzola',           cat:'latticini', u:'kg', p:14.00, alg:['latticini'], alias:[]},
  {nome:'taleggio',             cat:'latticini', u:'kg', p:16.00, alg:['latticini'], alias:[]},
  {nome:'fontina',              cat:'latticini', u:'kg', p:16.00, alg:['latticini'], alias:[]},
  {nome:'provola',              cat:'latticini', u:'kg', p:11.00, alg:['latticini'], alias:['provola affumicata','scamorza']},
  {nome:'caciocavallo',         cat:'latticini', u:'kg', p:14.00, alg:['latticini'], alias:[]},
  {nome:'emmental',             cat:'latticini', u:'kg', p:13.00, alg:['latticini'], alias:['emmenthal']},
  {nome:'brie',                 cat:'latticini', u:'kg', p:14.00, alg:['latticini'], alias:[]},
  {nome:'feta',                 cat:'latticini', u:'kg', p:12.00, alg:['latticini'], alias:[]},
  {nome:'philadelphia',         cat:'latticini', u:'kg', p:11.00, alg:['latticini'], alias:['formaggio spalmabile']},

  // ===== SALUMI =====
  {nome:'prosciutto crudo',     cat:'salumi', u:'kg', p:32.00, alg:[], alias:['crudo','prosciutto di parma','san daniele']},
  {nome:'prosciutto cotto',     cat:'salumi', u:'kg', p:18.00, alg:[], alias:['cotto']},
  {nome:'pancetta',             cat:'salumi', u:'kg', p:14.00, alg:[], alias:['pancetta affumicata','pancetta tesa']},
  {nome:'guanciale',            cat:'salumi', u:'kg', p:16.00, alg:[], alias:[]},
  {nome:'salame',               cat:'salumi', u:'kg', p:22.00, alg:[], alias:['salame milano','salame napoli']},
  {nome:'mortadella',           cat:'salumi', u:'kg', p:14.00, alg:['frutta a guscio'], alias:[]},
  {nome:'speck',                cat:'salumi', u:'kg', p:26.00, alg:[], alias:[]},
  {nome:'bresaola',             cat:'salumi', u:'kg', p:38.00, alg:[], alias:[]},
  {nome:'coppa',                cat:'salumi', u:'kg', p:24.00, alg:[], alias:['capocollo']},
  {nome:'lardo',                cat:'salumi', u:'kg', p:14.00, alg:[], alias:['lardo di colonnata']},
  {nome:'wurstel',              cat:'salumi', u:'kg', p:7.50, alg:[], alias:['wurstel']},

  // ===== FARINACEI / PANE / PASTA =====
  {nome:'farina 00',            cat:'farinacei', u:'kg', p:1.20, alg:['glutine'], alias:['farina']},
  {nome:'farina 0',             cat:'farinacei', u:'kg', p:1.30, alg:['glutine'], alias:[]},
  {nome:'farina manitoba',      cat:'farinacei', u:'kg', p:1.80, alg:['glutine'], alias:['manitoba']},
  {nome:'farina integrale',     cat:'farinacei', u:'kg', p:2.20, alg:['glutine'], alias:[]},
  {nome:'semola di grano duro', cat:'farinacei', u:'kg', p:1.60, alg:['glutine'], alias:['semola','semola rimacinata']},
  {nome:'pasta secca',          cat:'farinacei', u:'kg', p:2.20, alg:['glutine'], alias:['spaghetti','penne','rigatoni','fusilli','linguine','maccheroni']},
  {nome:'pasta fresca all\'uovo',cat:'farinacei', u:'kg', p:8.50, alg:['glutine','uova'], alias:['tagliatelle','fettuccine','tagliolini']},
  {nome:'pasta ripiena',        cat:'farinacei', u:'kg', p:12.00, alg:['glutine','uova','latticini'], alias:['ravioli','tortellini','agnolotti']},
  {nome:'gnocchi di patate',    cat:'farinacei', u:'kg', p:4.50, alg:['glutine'], alias:['gnocchi']},
  {nome:'pane',                 cat:'farinacei', u:'kg', p:4.50, alg:['glutine'], alias:['pane bianco','pane casereccio']},
  {nome:'pane integrale',       cat:'farinacei', u:'kg', p:5.50, alg:['glutine'], alias:[]},
  {nome:'pangrattato',          cat:'farinacei', u:'kg', p:3.50, alg:['glutine'], alias:['pan grattato']},
  {nome:'pasta sfoglia',        cat:'farinacei', u:'kg', p:6.50, alg:['glutine'], alias:['sfoglia']},
  {nome:'pasta brisee',         cat:'farinacei', u:'kg', p:6.00, alg:['glutine'], alias:['brisée']},
  {nome:'lievito di birra',     cat:'farinacei', u:'kg', p:14.00, alg:[], alias:['lievito']},
  {nome:'lievito madre',        cat:'farinacei', u:'kg', p:8.00, alg:['glutine'], alias:[]},

  // ===== RISO E CEREALI =====
  {nome:'riso carnaroli',       cat:'riso e cereali', u:'kg', p:5.50, alg:[], alias:['carnaroli']},
  {nome:'riso arborio',         cat:'riso e cereali', u:'kg', p:4.50, alg:[], alias:['arborio']},
  {nome:'riso basmati',         cat:'riso e cereali', u:'kg', p:4.50, alg:[], alias:['basmati']},
  {nome:'riso venere',          cat:'riso e cereali', u:'kg', p:6.50, alg:[], alias:['riso nero']},
  {nome:'farro',                cat:'riso e cereali', u:'kg', p:4.00, alg:['glutine'], alias:[]},
  {nome:'orzo',                 cat:'riso e cereali', u:'kg', p:3.00, alg:['glutine'], alias:['orzo perlato']},
  {nome:'quinoa',               cat:'riso e cereali', u:'kg', p:7.50, alg:[], alias:[]},
  {nome:'cous cous',            cat:'riso e cereali', u:'kg', p:4.50, alg:['glutine'], alias:['couscous']},
  {nome:'polenta',              cat:'riso e cereali', u:'kg', p:3.20, alg:[], alias:['farina di mais','polenta bramata']},
  {nome:'avena',                cat:'riso e cereali', u:'kg', p:3.50, alg:['glutine'], alias:['fiocchi di avena']},

  // ===== LEGUMI =====
  {nome:'fagioli cannellini',   cat:'legumi', u:'kg', p:4.50, alg:[], alias:['cannellini']},
  {nome:'fagioli borlotti',     cat:'legumi', u:'kg', p:4.50, alg:[], alias:['borlotti']},
  {nome:'ceci',                 cat:'legumi', u:'kg', p:4.00, alg:[], alias:[]},
  {nome:'lenticchie',           cat:'legumi', u:'kg', p:4.50, alg:[], alias:['lenticchia']},
  {nome:'piselli secchi',       cat:'legumi', u:'kg', p:3.50, alg:[], alias:[]},
  {nome:'fave secche',          cat:'legumi', u:'kg', p:4.00, alg:[], alias:[]},
  {nome:'soia',                 cat:'legumi', u:'kg', p:3.50, alg:['soia'], alias:['fagioli di soia']},

  // ===== SECCO E POLVERI / CONSERVE =====
  {nome:'zucchero',             cat:'secco e polveri', u:'kg', p:1.20, alg:[], alias:['zucchero semolato']},
  {nome:'zucchero a velo',      cat:'secco e polveri', u:'kg', p:2.50, alg:[], alias:[]},
  {nome:'zucchero di canna',    cat:'secco e polveri', u:'kg', p:2.20, alg:[], alias:[]},
  {nome:'sale fino',            cat:'secco e polveri', u:'kg', p:0.50, alg:[], alias:['sale']},
  {nome:'sale grosso',          cat:'secco e polveri', u:'kg', p:0.40, alg:[], alias:[]},
  {nome:'lievito per dolci',    cat:'secco e polveri', u:'kg', p:9.00, alg:[], alias:['lievito vanigliato']},
  {nome:'bicarbonato',          cat:'secco e polveri', u:'kg', p:2.50, alg:[], alias:[]},
  {nome:'amido di mais',        cat:'secco e polveri', u:'kg', p:3.50, alg:[], alias:['maizena']},
  {nome:'fecola di patate',     cat:'secco e polveri', u:'kg', p:3.00, alg:[], alias:['fecola']},
  {nome:'cacao amaro',          cat:'secco e polveri', u:'kg', p:14.00, alg:[], alias:['cacao']},
  {nome:'gelatina in fogli',    cat:'secco e polveri', u:'kg', p:28.00, alg:[], alias:['colla di pesce']},
  {nome:'agar agar',            cat:'secco e polveri', u:'kg', p:60.00, alg:[], alias:[]},
  {nome:'pomodori pelati',      cat:'conserve', u:'kg', p:2.50, alg:[], alias:['pelati']},
  {nome:'passata di pomodoro',  cat:'conserve', u:'kg', p:2.20, alg:[], alias:['passata']},
  {nome:'concentrato di pomodoro',cat:'conserve', u:'kg', p:6.00, alg:[], alias:['doppio concentrato']},
  {nome:'olive nere',           cat:'conserve', u:'kg', p:9.50, alg:[], alias:[]},
  {nome:'olive verdi',          cat:'conserve', u:'kg', p:9.00, alg:[], alias:['olive taggiasche']},
  {nome:'capperi',              cat:'conserve', u:'kg', p:18.00, alg:[], alias:[]},
  {nome:'carciofini sott\'olio',cat:'conserve', u:'kg', p:12.00, alg:[], alias:['carciofini']},
  {nome:'pomodori secchi',      cat:'conserve', u:'kg', p:16.00, alg:['solfiti'], alias:['pomodori essiccati']},

  // ===== OLI =====
  {nome:'olio extravergine di oliva',cat:'oli', u:'L', p:11.50, alg:[], alias:['olio evo','olio extravergine','olio di oliva']},
  {nome:'olio di oliva',        cat:'oli', u:'L', p:7.50, alg:[], alias:[]},
  {nome:'olio di semi di girasole',cat:'oli', u:'L', p:3.00, alg:[], alias:['olio di semi','olio di girasole']},
  {nome:'olio di arachide',     cat:'oli', u:'L', p:4.50, alg:['arachidi'], alias:[]},
  {nome:'olio di mais',         cat:'oli', u:'L', p:3.50, alg:[], alias:[]},
  {nome:'olio di sesamo',       cat:'oli', u:'L', p:14.00, alg:['sesamo'], alias:[]},
  {nome:'olio di cocco',        cat:'oli', u:'L', p:12.00, alg:[], alias:[]},
  {nome:'strutto',              cat:'oli', u:'kg', p:4.50, alg:[], alias:['sugna']},

  // ===== ACETI =====
  {nome:'aceto di vino',        cat:'aceti', u:'L', p:2.50, alg:['solfiti'], alias:['aceto']},
  {nome:'aceto balsamico',      cat:'aceti', u:'L', p:9.00, alg:['solfiti'], alias:['balsamico']},
  {nome:'aceto balsamico di modena igp',cat:'aceti', u:'L', p:16.00, alg:['solfiti'], alias:['balsamico di modena']},
  {nome:'aceto di mele',        cat:'aceti', u:'L', p:3.50, alg:['solfiti'], alias:[]},
  {nome:'aceto di riso',        cat:'aceti', u:'L', p:5.50, alg:[], alias:[]},

  // ===== CONDIMENTI / SALSE =====
  {nome:'miele',                cat:'condimenti', u:'kg', p:14.00, alg:[], alias:[]},
  {nome:'senape',               cat:'condimenti', u:'kg', p:7.50, alg:['senape'], alias:['mostarda']},
  {nome:'maionese',             cat:'condimenti', u:'kg', p:6.50, alg:['uova','senape'], alias:[]},
  {nome:'ketchup',              cat:'condimenti', u:'kg', p:4.50, alg:[], alias:[]},
  {nome:'salsa di soia',        cat:'condimenti', u:'L', p:8.00, alg:['soia','glutine'], alias:['soia salsa']},
  {nome:'pesto genovese',       cat:'condimenti', u:'kg', p:12.00, alg:['frutta a guscio','latticini'], alias:['pesto']},
  {nome:'tahina',               cat:'condimenti', u:'kg', p:12.00, alg:['sesamo'], alias:['tahin','crema di sesamo']},
  {nome:'brodo vegetale granulare',cat:'condimenti', u:'kg', p:9.00, alg:['sedano'], alias:['dado','dado vegetale']},

  // ===== SPEZIE ED ERBE =====
  {nome:'basilico',             cat:'spezie', u:'kg', p:38.00, alg:[], alias:['basilico fresco']},
  {nome:'prezzemolo',           cat:'spezie', u:'kg', p:28.00, alg:[], alias:[]},
  {nome:'rosmarino',            cat:'spezie', u:'kg', p:32.00, alg:[], alias:[]},
  {nome:'salvia',               cat:'spezie', u:'kg', p:32.00, alg:[], alias:[]},
  {nome:'timo',                 cat:'spezie', u:'kg', p:36.00, alg:[], alias:[]},
  {nome:'origano',              cat:'spezie', u:'kg', p:24.00, alg:[], alias:['origano secco']},
  {nome:'menta',                cat:'spezie', u:'kg', p:30.00, alg:[], alias:[]},
  {nome:'alloro',               cat:'spezie', u:'kg', p:24.00, alg:[], alias:['foglie di alloro']},
  {nome:'pepe nero',            cat:'spezie', u:'kg', p:24.00, alg:[], alias:['pepe']},
  {nome:'pepe bianco',          cat:'spezie', u:'kg', p:28.00, alg:[], alias:[]},
  {nome:'peperoncino',          cat:'spezie', u:'kg', p:18.00, alg:[], alias:['peperoncino piccante']},
  {nome:'paprika',              cat:'spezie', u:'kg', p:16.00, alg:[], alias:['paprica']},
  {nome:'curry',                cat:'spezie', u:'kg', p:18.00, alg:[], alias:[]},
  {nome:'curcuma',              cat:'spezie', u:'kg', p:16.00, alg:[], alias:[]},
  {nome:'cannella',             cat:'spezie', u:'kg', p:22.00, alg:[], alias:[]},
  {nome:'noce moscata',         cat:'spezie', u:'kg', p:38.00, alg:[], alias:[]},
  {nome:'chiodi di garofano',   cat:'spezie', u:'kg', p:35.00, alg:[], alias:[]},
  {nome:'cumino',               cat:'spezie', u:'kg', p:18.00, alg:[], alias:[]},
  {nome:'zenzero',              cat:'spezie', u:'kg', p:6.50, alg:[], alias:['ginger']},
  {nome:'zafferano',            cat:'spezie', u:'kg', p:8000.00, alg:[], alias:['zafferano in pistilli']},
  {nome:'vaniglia',             cat:'spezie', u:'kg', p:600.00, alg:[], alias:['bacca di vaniglia','vaniglia bourbon']},

  // ===== DOLCI / PASTICCERIA =====
  {nome:'cioccolato fondente',  cat:'dolci', u:'kg', p:14.00, alg:['soia'], alias:['cioccolato']},
  {nome:'cioccolato al latte',  cat:'dolci', u:'kg', p:13.00, alg:['latticini','soia'], alias:[]},
  {nome:'cioccolato bianco',    cat:'dolci', u:'kg', p:14.00, alg:['latticini','soia'], alias:[]},
  {nome:'crema di nocciole',    cat:'dolci', u:'kg', p:9.00, alg:['frutta a guscio','latticini','soia'], alias:['nutella']},
  {nome:'gelato',               cat:'dolci', u:'kg', p:8.50, alg:['latticini','uova'], alias:[]},
  {nome:'savoiardi',            cat:'dolci', u:'kg', p:8.00, alg:['glutine','uova'], alias:[]},
  {nome:'amaretti',             cat:'dolci', u:'kg', p:14.00, alg:['frutta a guscio'], alias:[]},
  {nome:'pasta di mandorle',    cat:'dolci', u:'kg', p:16.00, alg:['frutta a guscio'], alias:['marzapane']},

  // ===== BEVANDE =====
  {nome:'vino bianco',          cat:'bevande', u:'L', p:5.00, alg:['solfiti'], alias:['vino bianco da cucina']},
  {nome:'vino rosso',           cat:'bevande', u:'L', p:6.00, alg:['solfiti'], alias:['vino rosso da cucina']},
  {nome:'marsala',              cat:'bevande', u:'L', p:8.00, alg:['solfiti'], alias:[]},
  {nome:'birra',                cat:'bevande', u:'L', p:3.00, alg:['glutine'], alias:[]},
  {nome:'brodo di carne',       cat:'bevande', u:'L', p:3.50, alg:['sedano'], alias:['brodo']},
  {nome:'acqua',                cat:'bevande', u:'L', p:0.40, alg:[], alias:['acqua naturale']},
  {nome:'caffe',                cat:'bevande', u:'kg', p:22.00, alg:[], alias:['caffè','caffè in grani','caffè macinato']},
  {nome:'latte di cocco',       cat:'bevande', u:'L', p:5.00, alg:[], alias:[]},
  {nome:'latte di mandorla',    cat:'bevande', u:'L', p:3.50, alg:['frutta a guscio'], alias:[]},
];

const normalize = s => (s||'').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/['’`]/g,'').trim();

function score1(hay, q){
  if(hay===q) return 100;
  if(hay.startsWith(q)) return 80 - hay.length*0.1;
  if(hay.includes(q)) return 55 - hay.length*0.1;
  const words = q.split(/\s+/).filter(Boolean);
  const matched = words.filter(w=>hay.includes(w)).length;
  if(words.length && matched===words.length) return 35 - hay.length*0.1;
  if(matched>0) return 15*matched;
  return 0;
}

function toResult(it){
  return {
    nome: it.nome.charAt(0).toUpperCase()+it.nome.slice(1),
    categoria: it.cat, unita: it.u, prezzo_medio: it.p, allergeni: (it.alg||[]).slice(),
  };
}

function search(query, limit=8){
  const q = normalize(query); if(!q || q.length<1) return [];
  const scored = [];
  for(const it of KB){
    const hays = [it.nome, ...(it.alias||[])].map(normalize);
    let best = 0;
    for(const h of hays) best = Math.max(best, score1(h, q));
    if(best>0) scored.push({it, s:best});
  }
  scored.sort((a,b)=>b.s-a.s);
  return scored.slice(0,limit).map(x=>toResult(x.it));
}

function exactMatch(name){
  const n = normalize(name); if(!n) return null;
  for(const it of KB){
    const hays = [it.nome, ...(it.alias||[])].map(normalize);
    if(hays.includes(n)) return toResult(it);
  }
  return null;
}

// elenco per categoria, utile per popolamento massivo / pannello "ingredienti base"
function byCategory(){
  const m = {};
  for(const it of KB){ (m[it.cat]=m[it.cat]||[]).push(toResult(it)); }
  return m;
}
function all(){ return KB.map(toResult); }

RM.kbPrezzi = {search, exactMatch, byCategory, all, count: KB.length};
})();
