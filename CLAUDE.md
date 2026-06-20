# Vereinsbudget-Tool

Client-seitige, no-login Web-App fuer Budgetplanung des 1. SC 1911 Heiligenstadt.

- `vereinsbudget.html` — Haupt-App (Budgetuebersicht, Einnahmen/Ausgaben, Backups, Einstellungen).
- `beleg-eingang.html` — separates, mobil-faehiges Formular fuer Helfer zum Einreichen von Belegen.
- `worker.js` — Cloudflare-Worker-Proxy, den `beleg-eingang.html` fuer den Upload nutzt
  (siehe Abschnitt "Beleg-Upload" unten).

## Hosting

Der App-Code (nur die beiden HTML-Dateien) liegt im oeffentlichen GitHub-Repo
`Tecko1985/sc-heiligenstadt-budget` und wird per GitHub Pages ausgeliefert:

- https://tecko1985.github.io/sc-heiligenstadt-budget/vereinsbudget.html
- https://tecko1985.github.io/sc-heiligenstadt-budget/beleg-eingang.html

**Niemals echte Vereinsdaten ins Repo committen.** `vereinsbudget_daten.json`,
der `Backup/`-Ordner und der `Belege/`-Ordner enthalten echte Finanzdaten,
Namen und Belege und sind ueber `.gitignore` ausgeschlossen — das muss so bleiben.

## Beleg-Upload (beleg-eingang.html)

Die File System Access API (`showDirectoryPicker`) funktioniert nur in
Desktop-Chrome/Edge, nicht auf Handys — Belege werden aber meist vom Handy
eingereicht. Direkter Cross-Origin-Upload vom Browser zum Nextcloud-Server
(`nx88695.your-storageshare.de`) ist serverseitig per CORS blockiert
(unabhaengig vom Share-Typ, mit curl verifiziert).

Loesung: `beleg-eingang.html` schickt das Formular per `fetch()` an einen
**Cloudflare Worker** (`worker.js`, Deploy ueber Cloudflare-Dashboard, nicht
Teil des Repos-Deployments). Der Worker leitet die Daten server-seitig
(kein CORS-Problem zwischen Servern) per WebDAV-PUT an den Nextcloud-Freigabe-
link weiter. Der Nextcloud-Share-Token liegt **nur** als Cloudflare-Worker-
Secret (`NEXTCLOUD_SHARE_TOKEN`), niemals im Code/Repo.

Jede Einreichung erzeugt zwei eigenstaendige Dateien im Eingangs-Ordner (kein
Lesen/Mergen einer zentralen Indexdatei mehr, vermeidet Race Conditions bei
gleichzeitigen Einreichungen):
- Beleg-Datei: `<timestamp>_<datum>_<beschreibung>_<name>.<ext>`
- Metadaten-Sidecar: gleicher Basisname + `.meta.json`

`vereinsbudget.html` (Kassierer, Desktop) liest diesen Ordner weiterhin per
File System Access API, baut die Liste aber direkt aus den `*.meta.json`-
Dateien im Ordner auf (`loadEingaenge()`), nicht mehr aus einer einzelnen
`eingaenge.json`.

## Workflow nach Aenderungen

Nach jeder Aenderung an `vereinsbudget.html` oder `beleg-eingang.html` automatisch,
ohne erst zu fragen:

```
git add vereinsbudget.html beleg-eingang.html
git commit -m "<kurze Beschreibung der Aenderung>"
git push
```

Damit ist die GitHub-Pages-Version immer synchron mit dem lokalen Stand.
Aenderungen an `worker.js` werden ebenfalls committet, muessen aber zusaetzlich
manuell im Cloudflare-Dashboard neu deployed werden (kein automatisches Deployment
aus dem Git-Repo heraus).
