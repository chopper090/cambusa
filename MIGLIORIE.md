# Restaurant Manager — Roadmap migliorie

Stato attuale (v1.2): foodcost, ricettario, menù, HACCP, fornitori, giacenze, dashboard, Excel I/O,
PWA installabile, dark mode, knowledge base 292 ingredienti GDO, **editor Canva multi-pagina** per
ricettario e menù (drag/resize/snap/undo/z-order/export PDF vettoriale), sistema loghi + filigrana.

Di seguito cosa consiglierei di aggiungere, in ordine di valore/sforzo.

## 🔝 Priorità alta (valore alto, sforzo contenuto)

1. **Scalatore di ricetta (resa)** — slider "per N coperti" che ricalcola grammature e costo totale.
   Fondamentale in cucina per il batch cooking. Riusa `calc.foodcostPiatto`.
2. **Lista della spesa** — da uno o più menù + n. coperti → somma ingredienti, raggruppa per fornitore,
   sottrae le giacenze, export Excel/PDF. È già previsto nello schema (giacenze + ricette).
3. **Scheda tecnica piatto (A5)** — un layout Canva dedicato, una scheda per piatto, per la linea di cucina
   (foto, dosi, plating, allergeni, tempi). Riusa il `canvas_engine` con formato `a5`.
4. **Margine e ricarico in dashboard** — oltre al food cost %, mostrare margine €, incidenza per categoria,
   e un "alert" sui piatti fuori target.
5. **Storico prezzi ingredienti** — salvare ogni variazione di `prezzo_sicuro` con data; grafico andamento.
   Campo `aggiornato` già presente, basta uno storico in un foglio Excel dedicato.
6. **Duplica piatto / menù / ricetta** — clonazione rapida per varianti (es. "Caprese" → "Caprese con burrata").
7. **Template di layout salvabili** — salvare un layout Canva come "template" riutilizzabile su altri menù/ricette.

## 🎯 Priorità media

8. **Allineamento e distribuzione multi-elemento** nell'editor Canva (selezione multipla, allinea a sx/centro/dx,
   distribuisci, raggruppa). Oggi si sposta un elemento alla volta.
9. **Griglie e righelli** nell'editor + snap configurabile + blocco proporzioni immagini.
10. **Libreria forme/icone** (badge "vegano", "piccante", "novità", stelle, separatori decorativi) per i menù.
11. **Gestione categorie personalizzabili** (l'utente definisce le proprie categorie piatti/ingredienti).
12. **Multi-valuta e IVA per riga** (utile se si gestiscono più aliquote o fornitori esteri).
13. **Conversioni avanzate** — peso netto/lordo con scarto % (sfrido) per ingrediente, così il foodcost reale
    tiene conto della resa (es. carciofi 60% scarto). Alto impatto sulla precisione del costo.
14. **Import listini fornitori** da Excel/CSV (mappatura colonne) per aggiornare i prezzi in massa.
15. **Ricerca globale** (Cmd/Ctrl+K) per saltare a piatti, ingredienti, menù.

## 🚀 Avanzate / futuro

16. **AI Menù Generator** (già predisposto): partendo dagli ingredienti disponibili + vincoli (stagione, stile,
    budget foodcost, diete) generare proposte di piatti con tecniche e abbinamenti. Integrazione Anthropic API
    o knowledge base locale tecnica×ingrediente. Output: piatti pre-compilati pronti con stima foodcost.
17. **Analisi menu engineering** (matrice popolarità×margine: Star / Plowhorse / Puzzle / Dog) per decidere
    cosa promuovere o togliere. Richiede dati di vendita (anche import POS).
18. **QR menu pubblico** — esporta il menù come pagina web con QR code per i tavoli.
19. **Multi-dispositivo / cloud sync** — oggi i dati sono su localStorage del singolo browser. Opzioni:
    sync via file (già c'è Excel), oppure backend leggero (Supabase/Firebase) per più postazioni.
20. **Stampa etichette** (scadenze, conservazione, allergeni) per HACCP — formato etichettatrice.
21. **Calendario produzione / mise en place** legato alle ricette e ai coperti previsti.
22. **Gestione utenti/ruoli** (chef, cuoco, titolare) con permessi diversi.

## 🛠 Debito tecnico / robustezza

- **Librerie offline reali**: oggi xlsx e jsPDF arrivano da CDN. Per uso 100% offline conviene scaricarli in
  `vendor/` e referenziarli localmente (il service worker già li mette in runtime-cache, ma il primo avvio
  richiede rete). → scaricare i 2 file e cambiare gli `src` in `index.html`.
- **Limite localStorage (~5-10MB)**: foto piatti e loghi in base64 possono saturarlo. Migrare a **IndexedDB**
  per gli asset binari quando si inizia a caricare molte immagini.
- **Backup automatico**: il contatore `modifiche_dall_ultimo_backup` esiste ma non innesca ancora un export
  automatico. Aggiungere un promemoria/zip periodico.
- **Test**: nessun test automatico. Aggiungere qualche test su `calc.js` (il cuore dei numeri) e
  sull'import/export Excel (round-trip).
- **Validazione import Excel** più severa con report errori per riga.

## Suggerimento d'uso in fase di apertura

Workflow consigliato ora:
1. **Ingredienti → 📖 Catalogo base**: importa in blocco gli ingredienti che userai (prezzi GDO stimati).
2. Aggiusta i prezzi "sicuri" man mano che arrivano i preventivi dei fornitori.
3. **Piatti**: componi le ricette (puoi creare ingredienti al volo). Il foodcost è immediato.
4. **Ricettario → ✎ Editor Canva**: una pagina per ricetta, impagina liberamente, esporta il manuale PDF.
5. **Menù → ✎ Editor visuale**: impagina il menù per il proprietario, applica logo/filigrana.
6. **HACCP**: costruisci i diagrammi di flusso con la simbologia normativa.
7. **Excel**: esporta tutto come backup/condivisione; reimporta quando aggiorni i prezzi.
