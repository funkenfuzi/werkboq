# Datensicherung

Eine Werkboq-Datenbank enthält Rechnungen, die sieben Jahre aufzubewahren
sind (§ 132 BAO, § 147 AO), Personalakten und Unterschriften. Bis
September 2026 wurde sie gar nicht gesichert.

## Was jetzt passiert

**Jede Nacht um 2:30** erstellt PocketBase selbst eine Sicherung, die
letzten 14 bleiben liegen. Eingeschaltet von `npm run einrichten` (also auch
von `npm start`), sofern noch nichts eingestellt war. Die ZIP enthält die
ganze Datenbank samt hochgeladenen Fotos und Dokumenten und ist in sich
stimmig — PocketBase erstellt sie im laufenden Betrieb richtig. Eine Kopie
von `data.db` allein taugt dagegen nicht: ohne die WAL-Datei daneben fehlen
die jüngsten Änderungen, und manchmal ist die Datei gar nicht lesbar.

Diese Sicherungen liegen in `server/pb_data/backups` — **auf demselben
Rechner**. Gegen versehentliches Löschen helfen sie, gegen einen kaputten
Rechner, einen Diebstahl oder Verschlüsselungstrojaner nicht.

## Eine Kopie woanders hin

```
npm run sicherung
```

erstellt sofort eine Sicherung und lädt sie nach `SICHERUNG_ZIEL` (in der
`.env`), etwa ein USB-Stick, ein Netzlaufwerk oder ein Cloud-Ordner. Das
Skript prüft, dass eine echte ZIP ankam, bevor es sie speichert.

```
npm run sicherung -- liste
```

zeigt, was auf dem Server liegt und wie die nächtliche Sicherung
eingestellt ist.

Wer es ganz bequem will: im Admin-UI (`http://127.0.0.1:8095/_/` →
Settings → Backups) einen S3-Speicher eintragen; dann legt PocketBase die
nächtlichen Sicherungen gleich dort ab.

## Wiederherstellen

Im Admin-UI unter Settings → Backups die Sicherung auswählen und
„Restore" wählen. PocketBase startet danach neu.

Von Hand, etwa auf einem neuen Rechner:

1. Werkboq installieren, **nicht** starten.
2. Den Inhalt der ZIP nach `server/pb_data/` entpacken (es entstehen
   `data.db`, `storage/` und die übrigen Dateien).
3. `npm start`.

Nachgeprüft am 23. September 2026: eine Sicherung aus der
Entwicklungsdatenbank entpackt, eine zweite PocketBase darauf gestartet —
Aufträge, Belege, Zeilen, Zahlungen, Fotos samt Dateien, Personalakten und
Nachfasseinträge waren vollständig da.

## Was keine Sicherung ersetzt

Eine Sicherung, die nie zurückgespielt wurde, ist eine Hoffnung. Einmal im
Quartal eine Sicherung auf einem zweiten Rechner auspacken und
nachsehen, ob die letzte Rechnung drin ist.
