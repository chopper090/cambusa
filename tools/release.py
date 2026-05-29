#!/usr/bin/env python3
"""
Bump di versione semantica (xx.yy.zz) su TUTTI i file che la contengono,
aggiornamento del CHANGELOG e (opzionale) commit + tag git.

USO:
    python tools/release.py patch        # 1.4.0 -> 1.4.1
    python tools/release.py minor        # 1.4.0 -> 1.5.0
    python tools/release.py major        # 1.4.0 -> 2.0.0
    python tools/release.py 1.6.2        # imposta una versione esatta
    python tools/release.py patch --git  # esegue anche commit + tag git

Senza --git vengono solo modificati i file e stampati i comandi git da lanciare.
"""
import sys, re, subprocess, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def read_version():
    return (ROOT / "VERSION").read_text(encoding="utf-8").strip()

def bump(cur, how):
    if re.fullmatch(r"\d+\.\d+\.\d+", how):
        return how
    major, minor, patch = (int(x) for x in cur.split("."))
    if how == "major": return f"{major+1}.0.0"
    if how == "minor": return f"{major}.{minor+1}.0"
    if how == "patch": return f"{major}.{minor}.{patch+1}"
    raise SystemExit(f"Argomento non valido: {how} (usa major|minor|patch oppure x.y.z)")

def replace_in(path, pattern, repl):
    p = ROOT / path
    if not p.exists():
        print(f"  ! saltato (non trovato): {path}"); return
    txt = p.read_text(encoding="utf-8")
    new, n = re.subn(pattern, repl, txt, count=1)
    if n:
        p.write_text(new, encoding="utf-8"); print(f"  ✓ {path}")
    else:
        print(f"  ! pattern non trovato in {path}")

def update_changelog(new):
    p = ROOT / "CHANGELOG.md"
    if not p.exists(): return
    txt = p.read_text(encoding="utf-8")
    today = datetime.date.today().isoformat()
    # inserisce una nuova sezione dopo "## [Unreleased]"
    section = f"## [Unreleased]\n\n## [{new}] - {today}\n### Modificato\n- _descrivi qui le modifiche_\n"
    txt = txt.replace("## [Unreleased]\n", section, 1)
    p.write_text(txt, encoding="utf-8")
    print("  ✓ CHANGELOG.md (aggiungi i dettagli nella nuova sezione)")

def main():
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    how = sys.argv[1]
    do_git = "--git" in sys.argv
    cur = read_version()
    new = bump(cur, how)
    print(f"Versione: {cur}  ->  {new}\n")

    (ROOT / "VERSION").write_text(new + "\n", encoding="utf-8"); print("  ✓ VERSION")
    replace_in("js/version.js",          r"RM\.VERSION\s*=\s*'[\d.]+'", f"RM.VERSION = '{new}'")
    replace_in("sw.js",                  r"CACHE_VERSION\s*=\s*'rm-v[\d.]+'", f"CACHE_VERSION = 'rm-v{new}'")
    replace_in("manifest.webmanifest",   r'"version":\s*"[\d.]+"', f'"version": "{new}"')
    update_changelog(new)

    print()
    if do_git:
        subprocess.run(["git", "add", "-A"], cwd=ROOT, check=True)
        subprocess.run(["git", "commit", "-m", f"release: v{new}"], cwd=ROOT, check=True)
        subprocess.run(["git", "tag", "-a", f"v{new}", "-m", f"v{new}"], cwd=ROOT, check=True)
        print(f"\nFatto. Ora esegui:  git push origin main --tags")
    else:
        print("File aggiornati. Per registrare la release esegui:")
        print(f"  git add -A")
        print(f'  git commit -m "release: v{new}"')
        print(f'  git tag -a v{new} -m "v{new}"')
        print(f"  git push origin main --tags")

if __name__ == "__main__":
    main()
