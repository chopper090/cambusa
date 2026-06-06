# CLAUDE.md — Cambusa

**Scopo.** Gestione **ristorazione multi-ristorante** (uso proprio + consulenza): food cost,
ricettario, composizione menù, HACCP, fornitori, giacenze. Export Excel (9 fogli) e PDF vettoriali.

**Stack.** HTML5 + CSS3 + **vanilla JS** (zero build). CDN: **SheetJS** (xlsx) per Excel,
**jsPDF** per PDF. `localStorage` (prefisso `rm:v1:*`). PWA app-shell. Editor canvas tipo Canva.

**Mappa file.**
- Core: `js/version.js`, `utils.js`, `clients.js`, `store.js` (CRUD localStorage), `calc.js`
  (motore food cost), `excel.js`, `pdf.js`, `canvas_engine.js`.
- UI: `js/modules/*` (restaurants, dashboard, ingredienti, piatti, ricettario, menu, haccp,
  fornitori, giacenze, *_editor, ai-menu, settings).
- Stili: `css/base.css` (layout/sidebar), `theme.css` (variabili), `components.css`.
- Ordine di caricamento dichiarato in commento in `index.html` (version→utils→…→moduli→app).

**Dove stanno i dati.** `localStorage` `rm:v1:*`. ⚠️ `localStorage.clear()` nei settings tocca
l'intero origin: attenzione se condivide origin con altre PWA.

**Come si edita.** Un modulo = un file in `js/modules/`. Zero duplicazione: rispettare le
dipendenze di caricamento.

**Gotcha.** La versione è in **4 punti** (VERSION, js/version.js, sw.js, manifest) → usare
`_scripts\Release.ps1` per sincronizzarli. `vendor/` è vuota (placeholder CDN offline mai usato).

**Deploy.** GitHub Pages (`chopper090.github.io/cambusa/`) + workflow `.github/`. Versionare con
`_scripts\Publish-Project.ps1`.

**Sovrapposizioni.** Possibile bridge futuro: ricettario Cambusa → accostamenti **Umami**;
impaginazione menù → **Carta**.
