# Changelog

Tutte le modifiche rilevanti a questo progetto sono documentate qui.
Formato basato su [Keep a Changelog](https://keepachangelog.com/it/1.1.0/),
versioni secondo [Semantic Versioning](https://semver.org/lang/it/): `MAJOR.MINOR.PATCH`.

- **MAJOR (xx)**: cambiamenti incompatibili (es. struttura dati che rompe i salvataggi esistenti).
- **MINOR (yy)**: nuove funzionalità retrocompatibili.
- **PATCH (zz)**: correzioni di bug e ritocchi.

## [Unreleased]

## [1.5.0] - 2026-06-06
### Aggiunto
- **Multi-ristorante (consulenza)**: nuova sezione **Ristoranti** per gestire più locali da un'unica app (il tuo, *il baretto*, e altri). Ogni ristorante ha i propri dati (ingredienti, piatti, menù, HACCP, impostazioni) e il proprio **stile**.
- **Stile per ristorante**: logo, palette e font con preset pronti (*Classico*, *il baretto*, *Elegante*, *Mediterraneo*, *Minimal*) oppure personalizzazione completa di colori e font, con **anteprima live** del menù.
- **Switcher in sidebar** per cambiare al volo il ristorante attivo; l'app (accento, logo, nome) si "veste" di conseguenza.
- I **menù generati** ereditano lo stile del ristorante attivo (font titoli/corpo, colori, prezzi in stile bar `| 8,00 €` e decori "mare/agrumi" per *il baretto*).
- Tema *il baretto*: titoli condensati (Bebas Neue), palette navy/azzurro/arancio; aggiunti i font Bebas Neue, Jost, Oswald.
### Modificato
- I dati ora sono **partizionati per ristorante**. I dati esistenti vengono migrati automaticamente nel ristorante "Il mio ristorante" (copia non distruttiva: i dati originali non vengono cancellati).
- **Impostazioni** ora valgono per il ristorante attivo; l'azzeramento dati agisce solo sul locale corrente.

## [1.4.1] - 2026-06-04
### Modificato
- _descrivi qui le modifiche_

### Da fare
- (vedi `MIGLIORIE.md` per la roadmap)

## [1.4.0] - 2026-05-29
### Aggiunto
- Versioning semantico `xx.yy.zz` con file `VERSION` e `js/version.js` (versione mostrata in sidebar).
- Pulsante **Installa app** (PWA `beforeinstallprompt`) nella barra laterale.
- Workflow GitHub Actions: deploy automatico su GitHub Pages (`pages.yml`) e creazione Release sui tag (`release.yml`).
- Script `tools/release.py` per il bump di versione su tutti i file + tag git.
- Guida `DEPLOY.md` (modello branch, release, downgrade, PWABuilder).
- Campo `version` e `id` nel manifest PWA.

## [1.3.0] - 2026-05-29
### Aggiunto
- Template **Ricettario** definitivo (logo, separatori, nome ricetta, INGREDIENTI/PREPARAZIONE/IMPIATTAMENTO, logo piccolo, filigrana) in blu, font Poppins.
- Campo **Impiattamento** sui piatti (separato dalla preparazione), in form, Excel e PDF.
- Controlli di formattazione testo nel canvas: grassetto/corsivo/sottolineato, MAIUSCOLO/minuscolo/Iniziali/Prima maiuscola, colore, interlinea, font multipli.
- Quantità ingredienti leggibili (1000 g → 1 kg, ecc.).

## [1.2.0] - 2026-05-29
### Aggiunto
- **Dark mode** + restyling completo (palette terracotta, Inter/Playfair, micro-animazioni).
- **Knowledge base** di 292 ingredienti GDO in 20 categorie + "Catalogo base" con import multiplo.
- **Editor canvas multi-pagina** stile Canva (drag/resize/snap/undo/z-order/export PDF) per Ricettario e Menù.
### Corretto
- Null-safety import Excel; combinazioni font jsPDF non valide.

## [1.1.0] - 2026-05-28
### Aggiunto
- **PWA**: manifest, service worker (cache offline), icone, installabilità.
- Sistema **loghi multipli** + filigrana configurabile per documento.

## [1.0.0] - 2026-05-28
### Aggiunto
- Prima versione: Foodcost, Ingredienti (doppio prezzo), Piatti, Ricettario, Menù, HACCP (simboli normativi), Fornitori, Giacenze, Dashboard, import/export Excel.

[Unreleased]: https://github.com/USERNAME/restaurant-manager/compare/v1.4.0...HEAD
[1.4.0]: https://github.com/USERNAME/restaurant-manager/releases/tag/v1.4.0
[1.3.0]: https://github.com/USERNAME/restaurant-manager/releases/tag/v1.3.0
[1.2.0]: https://github.com/USERNAME/restaurant-manager/releases/tag/v1.2.0
[1.1.0]: https://github.com/USERNAME/restaurant-manager/releases/tag/v1.1.0
[1.0.0]: https://github.com/USERNAME/restaurant-manager/releases/tag/v1.0.0
