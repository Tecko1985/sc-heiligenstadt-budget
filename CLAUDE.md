# sc-heiligenstadt-budget

Vereinsbudget-Tool für den 1. SC 1911 Heiligenstadt. Client-seitige, no-login Web-App.

## Dateien

- `vereinsbudget.html` — Haupt-App (Kassierer, Desktop): Budgetübersicht, Einnahmen/Ausgaben, Backups, Einstellungen.
- `beleg-eingang.html` — separates, mobilfähiges Formular für Helfer zum Einreichen von Belegen.
- `geschaeftsstelle.html` — dritte eigenständige Seite: Geschäftsstelle prüft eingehende Helfer-Belege (ansehen, "geprüft"/"erledigt" markieren, löschen), ohne Einblick in die Budgetplanung.
- `worker.js` — Cloudflare-Worker-Proxy für den Beleg-Upload aus `beleg-eingang.html`.

## Hosting

Public GitHub-Repo `Tecko1985/sc-heiligenstadt-budget`, ausgeliefert per GitHub Pages:
- https://tecko1985.github.io/sc-heiligenstadt-budget/vereinsbudget.html
- https://tecko1985.github.io/sc-heiligenstadt-budget/beleg-eingang.html

**Niemals echte Vereinsdaten ins Repo committen.** `vereinsbudget_daten.json`, `Backup/`, `Belege/` enthalten echte Finanzdaten/Namen/Belege und sind per `.gitignore` ausgeschlossen — muss so bleiben.

Repo-Branch heißt `main` (nicht master). Lokaler Dev-Server: `E:\.claude\launch.json`, Eintrag `sc-heiligenstadt-budget`, Port 8772 (Root-Datei `vereinsbudget.html`, nicht `index.html`).

## Echte Nextcloud-Speicherpfade

(Nextcloud-Desktop-Client-Sync auf Michels Rechner, bestätigt 2026-07-01). Es gab zwei ähnlich benannte Ordner ("Budget" und "sc-heiligenstadt-budget") — **`sc-heiligenstadt-budget` ist korrekt/aktiv**, "Budget" ist verwaist.

- Datendatei: `C:\Users\Michel Brunner\Nextcloud\05_Nachwuchsbereich\02_Förderung\Tools\sc-heiligenstadt-budget\vereinsbudget_daten.json`
- Belege-Ordner: `...\Tools\sc-heiligenstadt-budget\Belege`
- Backup-Ordner: `...\Tools\sc-heiligenstadt-budget\Backup`
- Eingangs-Ordner (Helfer-Belege aus `beleg-eingang.html`, per Nextcloud-Freigabelink/`NEXTCLOUD_SHARE_TOKEN`): `C:\Users\Michel Brunner\Nextcloud\02_Geschäftsstelle\Belege_aus_Belegtool` — bewusst *nicht* unter `Tools/sc-heiligenstadt-budget`, sondern im Geschäftsstelle-Bereich.

Diese vier Pfade stehen als "Empfohlener Ort"-Hinweistext im Einstellungen-Panel von `vereinsbudget.html` (vier Location-Bars: `locSub`, `folderSub`, `eingangFolderSub`, `backupFolderSub`, sowohl im initialen HTML als auch in den jeweiligen `update*UI()`-JS-Funktionen). **Bei Änderungen an den Location-Bars beide Stellen pro Ordner aktualisieren**, sonst driften Erstladung und Re-Render auseinander. Hardcoding von Nutzername/Pfad in diesem öffentlichen Repo ist ok — nur echte Secrets/Passwörter nie im Code.

## Beleg-Upload (beleg-eingang.html)

Die File System Access API (`showDirectoryPicker`) funktioniert nur in Desktop-Chrome/Edge, nicht auf Handys — Belege werden aber meist vom Handy eingereicht. Direkter Cross-Origin-Upload vom Browser zum Nextcloud-Server (`nx88695.your-storageshare.de`) ist serverseitig per CORS blockiert (verifiziert mit curl).

Lösung: `beleg-eingang.html` schickt das Formular per `fetch()` an den **Cloudflare Worker** (`worker.js`, Deploy über Cloudflare-Dashboard, nicht Teil des Repo-Deployments). Der Worker leitet die Daten serverseitig per WebDAV-PUT an den Nextcloud-Freigabelink weiter. Der Nextcloud-Share-Token liegt **nur** als Cloudflare-Worker-Secret (`NEXTCLOUD_SHARE_TOKEN`), niemals im Code/Repo.

Jede Einreichung erzeugt zwei eigenständige Dateien im Eingangs-Ordner (kein Lesen/Mergen einer zentralen Indexdatei, vermeidet Race Conditions bei gleichzeitigen Einreichungen):
- Beleg-Datei: `<timestamp>_<datum>_<beschreibung>_<name>.<ext>`
- Metadaten-Sidecar: gleicher Basisname + `.meta.json`

`vereinsbudget.html` liest diesen Ordner per File System Access API, baut die Liste direkt aus den `*.meta.json`-Dateien im Ordner (`loadEingaenge()`), nicht mehr aus einer zentralen `eingaenge.json`.

HEIC-Fotos (iPhone) werden von Lightbox/Druck nicht angezeigt (Browser-Limitation; Upload-Worker erlaubt sie bewusst) — akzeptierte Limitierung.

## Datenformat v4 (seit 1.1)

`buildExportData()` schreibt `version:4` mit Top-Level `seasons` (`{ "2026/27": {income, expense}, ... }`, nur nicht-leere Saisons) und `categories` (`{income:[], expense:[]}`) — zusätzlich bleiben `income`/`expense` der aktuellen Saison flach in der Datei (Abwärtskompatibilität, `applyLoadedData`-Validierung prüft weiter nur diese). Grund: Die verknüpfte Datei enthielt vorher NUR die aktuelle Saison; ein Saisonwechsel überschrieb die Cloud-Kopie aller anderen Saisons. `applyLoadedData` übernimmt alle in `data.seasons` enthaltenen Saisons und die Kategorien; fehlende Saisons bleiben lokal unangetastet.

Außerdem seit 1.1: `convertEingang` bricht bei Beleg-Kopierfehlern ab (löscht Originale NICHT mehr), `deleteEntry` mit confirm, Datumsangaben lokal via `localDateIso()` (auch in beleg-eingang.html), `save()` meldet Quota-Fehler und wirft.

## Aktions-Passwort "Saison leeren" (seit 1.2)

Das früher hardcodierte `CLEAR_ALL_PASSWORD='1911'` wird jetzt serverseitig geprüft: `clearAll()` ist async und fragt den ToolsUebersicht-Worker (`verify-action-password`, Scope `budget-saison-leeren`, Worker-Secret `PW_BUDGET_LEEREN` — siehe `E:\ToolsUebersicht\CLAUDE.md`). Ohne Internet ist "Saison leeren" dadurch bewusst nicht mehr möglich; bis zum Worker-Deploy kommt ein Hinweis-Toast. **Stand 2026-07-02: Worker-Deploy noch AUSSTEHEND.**

## Zugriffscode für beleg-eingang.html (seit 2026-07-02)

Das früher lokal in `worker.js` (`env.ACCESS_CODE`) geprüfte Secret ist entfallen — der Code wird jetzt per `verify-action-password` an die ToolsUebersicht-Landingpage delegiert (Scope `budget-beleg-eingang`, Worker-Secret `PW_BUDGET_EINGANG_ZUGANG` dort, siehe `E:\ToolsUebersicht\CLAUDE.md`). `beleg-eingang.html` selbst ist unverändert (schickt weiterhin `code` im Formular an diesen Worker). **Verhaltensänderung:** Vorher lief die Prüfung "fail-open" (kein `ACCESS_CODE` gesetzt = keine Prüfung), jetzt "fail-closed" wie bei allen anderen Aktions-Passwörtern (kein `PW_BUDGET_EINGANG_ZUGANG` auf der Landingpage gesetzt = alle Einreichungen werden mit 401 abgelehnt). **Setup-Reihenfolge wichtig:** Erst `PW_BUDGET_EINGANG_ZUGANG` im Landingpage-Dashboard setzen, dann diesen Worker neu deployen — sonst Lücke, in der Helfer keine Belege einreichen können.

## Workflow nach Änderungen

Nach jeder Änderung an `vereinsbudget.html` oder `beleg-eingang.html` automatisch, ohne erst zu fragen:

```
git add vereinsbudget.html beleg-eingang.html
git commit -m "<kurze Beschreibung der Änderung>"
git push
```

Damit ist die GitHub-Pages-Version immer synchron mit dem lokalen Stand. Änderungen an `worker.js` werden ebenfalls committet, müssen aber zusätzlich manuell im Cloudflare-Dashboard neu deployed werden (kein automatisches Deployment aus dem Git-Repo).

## Akzeptierte Limitierungen (nicht erneut melden/fixen)

- Geldbeträge als JS-Floats summiert (keine Cent-Integer-Migration geplant, Anzeige rundet auf 2 Stellen, praktisch kein sichtbarer Fehler).
