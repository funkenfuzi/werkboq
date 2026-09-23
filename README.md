# Werkboq

Auftrags- und Baustellendokumentation für Handwerksbetriebe in Österreich,
Deutschland und der Schweiz. Ein modular aufgebauter Kern („Werkboq Basic")
plus Fachmodule – das erste davon ist **Elektro**.

Steuersätze, Rechnungspflichtangaben, Verzugszinsen, Aufbewahrungsfristen und
Elektronormen hängen am Rechtsraum, der beim Einrichten gewählt und dann
festgeschrieben wird: [docs/rechtsraeume.md](docs/rechtsraeume.md).

Wer was sehen und ändern darf, steht in [docs/rechte.md](docs/rechte.md) —
samt einer ehrlichen Liste dessen, was noch **nicht** serverseitig
durchgesetzt ist. `npm run rechte-pruefen` prüft es nach.

> Stand: Neustart der Entwicklung, September 2026. Das Vorgängerrepo ist fachliche
> Referenz, nicht Codebasis. Dieses Gerüst ist Scheibe 0: Struktur, Modulschnittstelle,
> Datenmodell, Design-Tokens, Offline-Warteschlange, Einrichtung.

## Aufbau

```
apps/
  web/                  Hülle: registriert Module, Seitenleiste, Routen, Anmeldung
packages/
  core/                 Werkboq Basic – Kunde, Auftrag, Mitarbeiter, Zugänge,
                        Modulschnittstelle, PocketBase-Client, Offline-Warteschlange
  baustein-zeiterfassung/   Arbeitszeit und Auftragsstunden (§ 26 AZG)
  baustein-planung/         Dispo-Kalender, Termine, Ressourcen
  baustein-material/        Katalog und Positionen am Auftrag
  baustein-verrechnung/     Angebot, Rechnung, Zahlungen, Mahnwesen
  modul-elektro/            Fachmodul Elektro – Prüfberichte, Anlagendaten
  tokens/               Design-Tokens (Funkenfuzi-Farben, Barlow, hell/dunkel)
server/
  start.mjs             startet PocketBase (lädt das Binary beim ersten Mal)
  schema.mjs            sammelt die Collections aller Pakete (je Paket: schema.mjs)
  einrichten.mjs        legt alle Collections an – idempotent, ersetzt Migrationen
  pb_hooks/             die wenigen Endpunkte, die PocketBase nicht mitbringt
scripts/
  start-mac.command     Doppelklick-Start macOS
  start-windows.bat     Doppelklick-Start Windows
```

Der Kern ist die Auftragsverwaltung und kennt keinen Baustein. Was einzeln
verkauft wird, welche Regeln zwischen den Modulen gelten und wie ein neuer
Baustein angeschlossen wird, steht in [docs/bausteine.md](docs/bausteine.md).

## Starten

```bash
cp .env.example .env          # beim ersten Mal: Zugangsdaten eintragen, siehe unten
npm start
```

Das war alles. `npm start` macht die Reihenfolge selbst und in einem Fenster:

1. `npm install`, falls sich die Paketliste geändert hat
2. PocketBase starten und warten, bis sie antwortet
3. `npm run einrichten` — gleicht das Schema ab, idempotent
4. Vite starten, Oberfläche auf `http://localhost:5173`

Strg+C beendet beides. Läuft der Vite-Server, landet jede geänderte Datei ohne
Zutun im Browser — für den Alltag heißt das: `npm start` einmal am Morgen, den
Rest erledigt das Neuladen von selbst.

Werkboq läuft bewusst auf **Port 8095**, nicht auf dem PocketBase-Standard 8090 —
damit eine andere lokal laufende PocketBase nicht versehentlich getroffen wird.
Der Serverstart legt den PocketBase-Admin aus `PB_ADMIN_*` gleich selbst an; das
Admin-UI unter `http://127.0.0.1:8095/_/` brauchst du nur, wenn du Daten von Hand
ansehen willst.

### Die Teile einzeln

Wenn etwas klemmt, lassen sich die Schritte weiterhin von Hand ausführen:

```bash
npm run server                # nur PocketBase
npm run einrichten            # nur das Schema abgleichen (Server muss laufen)
npm run dev                   # nur die Oberfläche
npm test                      # Rechentests, laufen in einer Sekunde
```

`npm run einrichten` ist beliebig oft ausführbar: bestehende Felder bleiben erhalten,
neue kommen dazu.

### Zwei Arten von Zugangsdaten

Das wird leicht verwechselt. Der **PocketBase-Admin** (`PB_ADMIN_*`) gehört der
Datenbank und wird nur für das Admin-UI und `einrichten.mjs` gebraucht. In Werkboq
selbst meldet man sich mit einem **Anwendungsbenutzer** aus der `users`-Collection
an — den legt `einrichten.mjs` beim ersten Lauf aus `WB_BENUTZER_EMAIL` und
`WB_BENUTZER_PASSWORT` an, mit allen Bereichen freigeschaltet. Existiert bereits ein
Benutzer, rührt das Skript die `users`-Collection nicht an.

### Entwicklungszugang

Solange entwickelt wird, ist das Tippen einer E-Mail bei jedem Neuladen lästig.
Mit `WB_ENTWICKLUNG=ja` in der `.env` legt `einrichten.mjs` deshalb den Zugang
**adm / admadm** an. Kürzer geht nicht: PocketBase lässt die Mindestlänge für
Passwörter nicht unter fünf Zeichen sinken. Der Zugang wirkt nur gegen eine
PocketBase auf `127.0.0.1`; ein anderes Passwort lässt sich über
`WB_ENTWICKLUNG_PASSWORT` setzen.

Das Konto trägt intern `entwicklung = true`. Vor jeder echten Inbetriebnahme:

```bash
npm run entwicklung-weg
```

Das löscht alle so gekennzeichneten Konten, setzt die Mindestlänge zurück auf acht
und warnt, falls danach überhaupt kein Benutzer mehr übrig ist. Normale Benutzer
bleiben unangetastet.

### Schutz vor fremden Datenbanken

`einrichten.mjs` verändert das Schema der PocketBase unter `PB_URL`. Beim ersten Lauf
legt es die Marker-Collection `werkboq_meta` an. Findet es später eine Datenbank mit
fremden Collections und ohne diesen Marker, bricht es ab, statt hineinzuschreiben —
so kann das Skript keine andere Anwendung beschädigen, wenn `PB_URL` einmal falsch
steht oder auf Port 8095 etwas anderes läuft.

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

**Jede Änderung ist nachvollziehbar.** Schreibvorgänge hinterlassen eine Zeile in
`protokoll` — wer, wann, was. Die Collection ist gegen Ändern und Löschen gesperrt;
ein Verlauf, den man nachträglich frisieren kann, ist als Nachweis wertlos.

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
