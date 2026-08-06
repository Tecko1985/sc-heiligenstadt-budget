# 💰 Vereinsbudget

Saison-Budget des Vereins: Einnahmen und Ausgaben planen, eingereichte Belege prüfen und zuordnen. Drei Seiten für drei Rollen — Helfer reichen ein, die Geschäftsstelle prüft, der Kassierer plant.

**➡️ [Vereinsbudget öffnen](https://sc1911heiligenstadt.github.io/sc-heiligenstadt-budget/vereinsbudget.html)**

## Seiten

| Seite | Wofür |
|---|---|
| [Beleg-Eingang](https://sc1911heiligenstadt.github.io/sc-heiligenstadt-budget/beleg-eingang.html) | Mobiles Formular für Helfer zum Einreichen von Belegen. |
| [Geschäftsstelle](https://sc1911heiligenstadt.github.io/sc-heiligenstadt-budget/geschaeftsstelle.html) | Eingegangene Belege prüfen, korrigieren und als geprüft markieren — ohne Einblick in die Budgetplanung. |
| [Vereinsbudget](https://sc1911heiligenstadt.github.io/sc-heiligenstadt-budget/vereinsbudget.html) | Budgetübersicht, Einnahmen/Ausgaben und Belegverwaltung für den Kassierer. |

## Zugang

Jede der drei Seiten ist mit einem eigenen Passwort geschützt, nicht über das Vereinskonto — so sieht die Geschäftsstelle die Belege, ohne Einblick in die Budgetplanung zu bekommen.

## Lokal starten

Über den Eintrag `sc-heiligenstadt-budget` in `E:\.claude\launch.json` — der Server läuft dann auf `http://localhost:8772/`.

## Technik

Vanilla JavaScript ohne Build-Schritt — die Dateien werden so ausgeliefert, wie sie im Repo liegen. Veröffentlicht über GitHub Pages. Eigene Cloudflare-Worker in diesem Repo: `worker.js`. Die werden **nicht** über GitHub Pages ausgeliefert, sondern separat bei Cloudflare veröffentlicht.

---

Ein Werkzeug des 1. SC 1911 Heiligenstadt. Alle Werkzeuge auf einen Blick: [Tools-Übersicht](https://sc1911heiligenstadt.github.io/ToolsUebersicht/) · Erklärungen im [Toolbox Wiki](https://sc1911heiligenstadt.github.io/Vereinswiki/).
