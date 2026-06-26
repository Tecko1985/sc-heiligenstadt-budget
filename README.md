# Vereinsbudget-Tool

Client-seitige, no-login Web-App zur Budgetplanung des 1. SC 1911 Heiligenstadt.
Läuft komplett im Browser, ohne Server oder Account — Daten bleiben lokal bzw.
im selbst gewählten Speicherort.

## Live-Version

- [vereinsbudget.html](https://tecko1985.github.io/sc-heiligenstadt-budget/vereinsbudget.html) — Haupt-App für den Kassierer
- [beleg-eingang.html](https://tecko1985.github.io/sc-heiligenstadt-budget/beleg-eingang.html) — Beleg-Einreichung für Helfer

## Funktionen

**Haupt-App (`vereinsbudget.html`)**
- Einnahmen & Ausgaben mit frei anlegbaren und löschbaren Kategorien erfassen
- Dashboard mit Saldo, Budget-Auslastung und Kreisdiagrammen je Kategorie (Werte & Prozente)
- Belege (Bilder/PDF) je Eintrag anhängen, ansehen und löschen — wahlweise im Browser-Speicher oder in einem verknüpften Ordner
- Fester Speicherort für die Datendatei mit automatischem Speichern & Laden (z. B. Hetzner Storage Share)
- CSV-Export sowie Drucken/PDF inkl. Belegnachweisen als eigene Seiten
- Nachträgliches Ändern der Kategorie bestehender Einträge
- Mehrere Saisons verwaltbar, mit Passwortschutz für „Saison leeren"
- „Erfasst von"-Kennzeichnung pro Eintrag
- Automatische lokale Backups (letzte 5) sowie optionales Backup in einem verknüpften Ordner
- Eingehende Helfer-Belege direkt aus dem Eingangs-Ordner einsehen, mit einem Klick als Einnahme/Ausgabe übernehmen oder verwerfen
- Änderungswünsche-Formular mit Speicherung im verknüpften Storage
- Übersichtliches Einstellungen-Panel für alle Ordner-Verknüpfungen, Exporte und Versionsinfo

**Beleg-Einreichung (`beleg-eingang.html`)**
- Separates, mobil-fähiges Formular für Helfer ohne Budget-Zugriff (z. B. zum Einreichen von Tankrechnungen)
- Upload per Foto oder PDF, funktioniert auf jedem Gerät/Browser ohne Login
- Übermittlung serverseitig über einen Cloudflare-Worker-Proxy (`worker.js`) an einen Nextcloud-Freigabelink

## Hinweise

Echte Vereinsdaten (Datendatei, Backups, Belege) werden **nicht** ins Repo committet —
diese liegen ausschließlich in den vom Nutzer verknüpften lokalen/Cloud-Ordnern.
Details zur Architektur stehen in [CLAUDE.md](CLAUDE.md).
