# Vereinsbudget-Tool

Client-seitige, no-login Web-App fuer Budgetplanung des 1. SC 1911 Heiligenstadt.

- `vereinsbudget.html` — Haupt-App (Budgetuebersicht, Einnahmen/Ausgaben, Backups, Einstellungen).
- `beleg-eingang.html` — separates Formular fuer Helfer zum Einreichen von Belegen.

## Hosting

Der App-Code (nur die beiden HTML-Dateien) liegt im oeffentlichen GitHub-Repo
`Tecko1985/sc-heiligenstadt-budget` und wird per GitHub Pages ausgeliefert:

- https://tecko1985.github.io/sc-heiligenstadt-budget/vereinsbudget.html
- https://tecko1985.github.io/sc-heiligenstadt-budget/beleg-eingang.html

**Niemals echte Vereinsdaten ins Repo committen.** `vereinsbudget_daten.json`,
der `Backup/`-Ordner und der `Belege/`-Ordner enthalten echte Finanzdaten,
Namen und Belege und sind ueber `.gitignore` ausgeschlossen — das muss so bleiben.

## Workflow nach Aenderungen

Nach jeder Aenderung an `vereinsbudget.html` oder `beleg-eingang.html` automatisch,
ohne erst zu fragen:

```
git add vereinsbudget.html beleg-eingang.html
git commit -m "<kurze Beschreibung der Aenderung>"
git push
```

Damit ist die GitHub-Pages-Version immer synchron mit dem lokalen Stand.
