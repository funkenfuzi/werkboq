# Werkboq

Auftrags- und Baustellendokumentation für österreichische Handwerksbetriebe.
Ein modular aufgebauter Kern („Werkboq Basic") plus Fachmodule – das erste davon ist **Elektro**.

> Stand: Neustart der Entwicklung, September 2026. Das Vorgängerrepo ist fachliche
> Referenz, nicht Codebasis. Dieses Gerüst ist Scheibe 0: Struktur, Modulschnittstelle,
> Datenmodell, Design-Tokens, Offline-Warteschlange, Einrichtung.

## Aufbau

```
apps/
  web/                  Shell: registriert Module, Routing, Anmeldung
packages/
  core/                 Werkboq Basic – Modulschnittstelle, Datenmodell,
                        PocketBase-Client, Offline-Warteschlange, Rechte
  modul-elektro/        Fachmodul Elektro – Prüfberichte, Anlagendaten
  tokens/               Design-Tokens (Funkenfuzi-Farben, Barlow, hell/dunkel)
server/
  start.mjs             startet PocketBase (lädt das Binary beim ersten Mal)
  einrichten.mjs        legt alle Collections an – idempotent, ersetzt Migrationen
scripts/
  start-mac.command     Doppelklick-Start macOS
  start-windows.bat     Doppelklick-Start Windows
```

## Erste Inbetriebnahme

```bash
npm install
cp .env.example .env          # PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD eintragen
npm run server                # PocketBase auf http://127.0.0.1:8090
```

Im Admin-UI unter `http://127.0.0.1:8090/_/` einmalig den Admin anlegen (dieselben
Zugangsdaten wie in der `.env`), dann in einem zweiten Terminal:

```bash
npm run einrichten            # Collections anlegen / abgleichen
npm run dev                   # Oberfläche auf http://localhost:5173
```

`npm run einrichten` ist beliebig oft ausführbar: bestehende Felder bleiben erhalten,
neue kommen dazu.

## Grundsätze

**Der Kunde ist die Wurzel.** Jeder Auftrag hängt an einem Kunden; eigene Vorhaben des
Betriebs laufen über einen internen Kunden (`kunde.intern = true`).

**Auftragsphasen.** Anfrage → Spezifikation → Angebot → Termine → Projekt →
Errichtung/Erweiterung → Abnahme → Wartung, oder verkürzt nur Materialverkauf.

**Der Kern kennt keine Fachmodule.** Ein Modul beschreibt sich selbst über
`WerkboqModul` und wird in `apps/web/src/main.tsx` registriert – eine Zeile. Es bringt
eigene Collections, Navigationseinträge und Komponenten für definierte
Erweiterungspunkte mit. Ein zweites Modul (Holz) darf keinen Umbau des Kerns erfordern.
Siehe `docs/module.md`.

**Offline zuerst.** Schreibzugriffe laufen über `schreiben()` aus dem Kern. Ohne Netz
landen sie in einer lokalen Warteschlange und werden bei Verbindung in Reihenfolge
nachgespielt – gedacht für den Keller ohne Empfang.

**Ein Satz Design-Tokens.** Farben, Schrift und Abstände kommen aus
`packages/tokens/tokens.css`. Hell- und Dunkelmodus von Anfang an, Tap-Ziele mindestens
44 px fürs Tablet. Module verwenden keine eigenen Hex-Werte.

**Benutzer und Bereiche.** Jeder Nutzer hat freigegebene Bereiche (verwaltung,
buchhaltung, technik, lager, entwickler und je Modul dessen ID). `darf(bereich)`
entscheidet über Sichtbarkeit; die endgültige Durchsetzung liegt in den
PocketBase-Regeln.

## Zielplattformen

Web (Vite-Build), Desktop Mac und Windows, Tablet. Online und offline. Die Tablet-Nutzung
ist der anspruchsvollste Fall und hat Vorrang vor Funktionsbreite.

## Stack

PocketBase (Go-Binary, SQLite) · Vite · React · TypeScript · npm-Workspaces. Alles
lizenzfrei.

## Nächste Scheiben

Siehe `docs/fahrplan.md`.
