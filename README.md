# Cambusa

App offline-first per la gestione di un ristorante: **food cost**, **ricettario**, **menù**, **HACCP**, fornitori, giacenze. Esporta tutto in **Excel** e **PDF**, con editor di impaginazione stile Canva. Stack: HTML + CSS + vanilla JS (zero build, zero framework).

Funziona aperta da doppio click (`index.html`) e come **PWA installabile** (APK / EXE via PWABuilder) quando deployata su GitHub Pages.

> **Deploy, versioni, branch e downgrade**: vedi **[DEPLOY.md](DEPLOY.md)**.
> **Storico modifiche**: vedi **[CHANGELOG.md](CHANGELOG.md)**. Versione corrente in `VERSION`.

## Avvio rapido (locale)

Apri `index.html` con doppio click. Funziona offline tranne le 2 librerie esterne (xlsx, jsPDF) caricate da CDN al primo avvio.

## Deploy su GitHub Pages

1. **Crea il repo su GitHub** (privato o pubblico, l'importante è che Pages sia attivabile — sul piano free serve repo pubblico).
2. Dal terminale, dentro la cartella `FOODCOST/`:

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<tuo-utente>/<nome-repo>.git
   git push -u origin main
   ```

3. **Attiva Pages**: vai su Settings → Pages → Source: `Deploy from a branch` → Branch: `main` / Folder: `/ (root)` → Save.
4. Aspetta 1-2 minuti, l'URL sarà `https://<tuo-utente>.github.io/<nome-repo>/`.

Il file `.nojekyll` è già incluso così GitHub non prova a processare il sito con Jekyll.

## Trasformare in app installabile con PWABuilder

Una volta che il sito è online su `https://<tuo-utente>.github.io/<nome-repo>/`:

1. Vai su **https://www.pwabuilder.com/**
2. Incolla l'URL del tuo sito GitHub Pages → **Start**
3. PWABuilder analizzerà manifest e service worker (già presenti in questo progetto) e ti dirà se ci sono problemi.
4. Sezione **Package For Stores**:
   - **Windows**: scarica il pacchetto `.msixbundle` (puoi pubblicarlo sul Microsoft Store o installarlo localmente abilitando "Modalità sviluppatore")
   - **Android**: scarica il pacchetto `.aab` (per Play Store) o `.apk` (sideload)
   - **iOS**: PWABuilder fornisce un progetto Xcode da compilare con macOS + account Apple Developer
5. Segui le istruzioni a schermo per la firma/upload.

> Suggerimento: prima del package, prova ad installare la PWA dal browser stesso (Chrome/Edge → icona "Installa" nella barra indirizzi). Se funziona da lì, andrà bene anche con PWABuilder.

## Generare/rigenerare le icone

Le icone PNG necessarie al manifest sono già incluse in `icons/`. Se vuoi rigenerarle (es. dopo aver modificato `icons/icon.svg` o lo script):

```bash
python tools/generate_icons.py
```

Richiede Python con Pillow installato (`pip install pillow`). Genera:
- `icon-192.png`, `icon-512.png` (any)
- `icon-maskable-512.png` (per Android adaptive icons)
- `apple-touch-icon.png` (180x180)
- `favicon-32.png`

## Struttura del progetto

```
FOODCOST/
├── index.html                  # shell con sidebar + main view
├── manifest.webmanifest        # PWA manifest
├── sw.js                       # service worker (app shell cache)
├── .nojekyll                   # GitHub Pages: skip Jekyll
├── .gitignore
├── README.md
├── css/
│   ├── base.css                # layout, typography, sidebar
│   ├── theme.css               # variabili colore Notion-like
│   └── components.css          # bottoni, tabelle, modal, badge
├── js/
│   ├── utils.js                # helper (el, fmt, modal, toast, costanti)
│   ├── store.js                # CRUD localStorage rm:v1:*
│   ├── calc.js                 # foodcost engine
│   ├── excel.js                # SheetJS import/export 8 fogli
│   ├── pdf.js                  # jsPDF: ricettario / menù / HACCP
│   ├── app.js                  # router hash-based
│   └── modules/                # 10 viste (dashboard, ingredienti, piatti, ...)
├── icons/
│   ├── icon.svg                # master vettoriale
│   ├── icon-192.png            # PWA 192x192
│   ├── icon-512.png            # PWA 512x512
│   ├── icon-maskable-512.png   # Android adaptive
│   ├── apple-touch-icon.png    # iOS 180x180
│   └── favicon-32.png
└── tools/
    └── generate_icons.py       # rigenera le icone da Python
```

## Aggiornare l'app sul dispositivo dopo nuovi deploy

Quando rilasci una nuova versione su GitHub Pages, aggiorna `CACHE_VERSION` in `sw.js` (es. da `rm-v1.0.0` a `rm-v1.0.1`). Al prossimo accesso, il service worker rileverà il nuovo SW, mostrerà il banner "Nuova versione disponibile → Aggiorna" e dopo il click ricaricherà l'app con la cache pulita.

## Caratteristiche

- **Food cost** con doppio prezzo (sicuro = fornitore, medio = stima nazionale) e calcolo costo/porzione in tempo reale
- **Auto-creazione ingredienti** dal modal piatto (poi li completi in anagrafica)
- **Allergeni** propagati automaticamente dagli ingredienti al piatto (Reg. UE 1169/2011)
- **HACCP** con simbologia normativa ISO 5807: pillola (inizio/fine), parallelogramma (input/output), cilindro (stoccaggio), rettangolo (processo), trapezio (operazione manuale), rombo (decisione / CCP)
- **Excel** import/export su workbook con 9 fogli (Dashboard, Ingredienti, Fornitori, Piatti, Ricette, Menu, HACCP, Giacenze, Settings)
- **PDF** vettoriali: ricettario A4 per piatto, menù editoriale impaginato, HACCP con diagramma + tabella CCP
- **Offline-first**: tutti i dati in localStorage, sincronizzazione via Excel
- **Installabile** come PWA su Windows / Android / iOS

## Licenza

Progetto personale dell'utente.
