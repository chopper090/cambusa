# Deploy, versioning e gestione branch

Guida operativa per pubblicare Restaurant Manager su GitHub Pages, generare l'app
installabile (APK / EXE) con PWABuilder e gestire versioni e downgrade.

---

## 1. Pubblicare su GitHub Pages

Il repo è `https://github.com/chopper090/RistoManager` (branch `main` già pushato).

Per mettere online il sito basta **abilitare Pages una volta** (metodo classico, come note-trainer):

1. Repo **RistoManager → Settings → Pages**
2. **Build and deployment → Source: _Deploy from a branch_**
3. **Branch: `main`** · **Folder: `/ (root)`** → **Save**

Dopo ~1 minuto il sito è online su:

```
https://chopper090.github.io/RistoManager/
```

Il file `.nojekyll` (già presente) fa servire correttamente le cartelle `js/`, `css/`, `icons/`.
Ogni `git push origin main` successivo aggiorna automaticamente il sito.

> Nota: usiamo il deploy "da branch" (semplice e affidabile) invece del workflow GitHub Actions,
> esattamente come note-trainer. Resta attivo solo il workflow `release.yml` che crea le Release dai tag.

---

## 2. App installabile (APK / EXE) con PWABuilder

Quando il sito è online in HTTPS:

1. Vai su **https://www.pwabuilder.com/**
2. Incolla l'URL `https://<tuo-utente>.github.io/restaurant-manager/` → **Start**
3. PWABuilder valida manifest + service worker (già presenti e corretti).
4. **Package For Stores**:
   - **Windows** → pacchetto `.msixbundle` (EXE installabile / Microsoft Store)
   - **Android** → `.apk` (sideload) o `.aab` (Play Store)
   - **iOS** → progetto Xcode (serve macOS + account Apple Developer)
5. Alla voce *version* indica la stessa del file `VERSION`.

> Suggerimento: prima del package prova a installare direttamente dal browser
> (Chrome/Edge → icona "Installa" nella barra indirizzi, o il pulsante **⬇ Installa app** in sidebar).

---

## 3. Versionamento semantico `xx.yy.zz`

La versione vive in 4 punti, tenuti allineati dallo script:

| File | Cosa |
|---|---|
| `VERSION` | sorgente di verità |
| `js/version.js` | `RM.VERSION` mostrata in app |
| `sw.js` | `CACHE_VERSION` (forza l'aggiornamento cache PWA) |
| `manifest.webmanifest` | campo `version` |

**Regole:**
- `zz` PATCH → bugfix (`python tools/release.py patch`)
- `yy` MINOR → nuove funzioni retrocompatibili (`python tools/release.py minor`)
- `xx` MAJOR → cambi che rompono i dati salvati (`python tools/release.py major`)

### Rilasciare una nuova versione

```bash
# aggiorna i 4 file + CHANGELOG, poi commit + tag automatici:
python tools/release.py patch --git

# pubblica (deploy Pages + crea la GitHub Release dal tag):
git push origin main --tags
```

Il push del tag `vX.Y.Z` fa partire il workflow `Release` che crea la Release su GitHub
(storico ufficiale + note generate automaticamente).

---

## 4. Modello dei branch

```
main      ← sempre stabile e deployato (ogni commit qui va in produzione)
  └─ develop   ← integrazione delle novità prima di portarle in main
       └─ feature/<nome>   ← una funzione/bugfix per branch
```

Flusso tipico:

```bash
git switch develop
git switch -c feature/lista-spesa     # nuova funzione
# ...lavori e committi...
git switch develop && git merge feature/lista-spesa
# quando develop è pronto e testato:
git switch main && git merge develop
python tools/release.py minor --git
git push origin main develop --tags
```

I **tag** `vX.Y.Z` sono lo storico immutabile delle versioni.

---

## 5. Downgrade (codice rotto → torno indietro)

Le versioni sono salvate come tag git e come GitHub Release: puoi sempre tornare indietro.

**Vedere le versioni disponibili:**
```bash
git tag --list
```

**Tornare temporaneamente a una versione (per provarla):**
```bash
git checkout v1.3.0      # stato "detached", solo lettura
git switch main          # per tornare all'ultima
```

**Riportare main a una versione precedente (rollback pubblicato):**
```bash
git switch main
git revert <hash-del-commit-rotto>      # crea un commit che annulla (consigliato)
git push origin main
```
oppure, rollback "duro" (riscrive la storia, usare con cautela):
```bash
git switch main
git reset --hard v1.3.0
git push --force origin main
```

Dopo il push, GitHub Pages ripubblica automaticamente la versione ripristinata.
Sui dispositivi con la PWA installata, il `CACHE_VERSION` più basso + il banner
"Nuova versione disponibile" gestiscono l'aggiornamento al riavvio.

> In alternativa puoi scaricare il sorgente di una versione dalla pagina
> **Releases** del repo e ripubblicarlo.

---

## 6. Checklist rapida per ogni aggiornamento

1. Lavori su un branch `feature/...`, poi merge in `develop` e `main`.
2. `python tools/release.py <patch|minor|major> --git`
3. Compili la sezione nuova del `CHANGELOG.md`.
4. `git push origin main --tags`
5. Pages si aggiorna da solo; la Release viene creata dal tag.
6. Se serve l'app installabile aggiornata, rilancia PWABuilder con la nuova versione.
