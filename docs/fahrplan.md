# Fahrplan

Entwicklung in Scheiben. Jede Scheibe geht durch Kern **und** mindestens ein
Modul – damit die Modulschnittstelle laufend an einem echten Konsumenten
geprüft wird.

Wo die Grenze zwischen Kern und einzeln verkaufbaren Bausteinen liegt und
welche Regeln dabei gelten, steht in [bausteine.md](bausteine.md). Neue
Funktionen entstehen ab jetzt als Baustein, nicht im Kern.

## Scheibe 0 – Gerüst (erledigt)

Monorepo, Modulschnittstelle, Datenmodell, Design-Tokens, Offline-Warteschlange,
`einrichten.mjs`, Startskripte, CI.

## Scheibe 1 – Kunde und Auftrag (erledigt)

Kundenliste als sortierbare Tabelle, Kundenakte mit Reitern, Ansprechpartner.
Aufträge als Phasenbrett (Karten per Ziehen zwischen den Phasen) und als Liste,
Auftragsakte mit Phasenleiste, Anlegen mit vorgeschlagener Nummer.
Änderungsverlauf über die Collection `protokoll`, gegen Ändern und Löschen
gesperrt.

Offen aus dieser Scheibe: Standorte anlegen und bearbeiten (bisher nur
anzeigen), Dokumente am Kunden, Elektro-Reiter in der Auftragsakte.

## Scheibe 2 – Zeiterfassung (erledigt)

Eine Collection `zeiten` für beides: ein Eintrag ohne Auftrag ist allgemeine
Arbeitszeit, einer mit Auftrag ist gebuchte Zeit — dieselbe Stunde zählt nie
doppelt. Wochenansicht je Mitarbeiter mit Tages- und Wochensumme, Warnung ab
zehn Stunden am Tag, Buchung direkt in der Auftragsakte mit Summe verrechenbar
und gesamt.

Arbeitszeitaufzeichnungen nach § 26 AZG verlangen Beginn, Ende und Pausen und
sind ein Jahr aufzubewahren, bei Fahrzeuglenkern zwei. Werkboq löscht nichts
von selbst.

Offen: Auswertung über alle Mitarbeiter (nur der eigene Stand ist sichtbar),
Stundensätze, Zeiten nachträglich ändern.

## Scheibe 3 – Stammdaten und Planung (erledigt)

Betriebsstammdaten (ein Datensatz) mit den Angaben, die nach § 11 UStG auf
jede Rechnung gehören; die Einstellungsseite weist darauf hin, solange etwas
fehlt. Mitarbeiter als eigene Collection, getrennt von den Benutzern: wer
eingeplant wird und wer sich anmelden kann, ist nicht dasselbe. Mitarbeiter
werden stillgelegt statt gelöscht, weil Zeiten und Termine an ihnen hängen.

Dispo-Kalender: Mitarbeiter als Zeilen, Wochentage als Spalten, Termine per
Ziehen zwischen Tagen und Personen verschiebbar. In jeder Zelle stehen
geplante und gebuchte Stunden nebeneinander — genau dafür gehören Planung und
Zeiterfassung zusammen.

Offen: Monats- und Tagesansicht, Abwesenheiten aus Urlaubsplanung, Auslastung
über die Woche, Termine aus der Auftragsakte heraus anlegen.

## Scheibe 3b – Kern und Bausteine trennen (erledigt)

Die Grundfunktionen liegen jetzt in eigenen Paketen und sind einzeln
verkaufbar: `baustein-zeiterfassung` und `baustein-planung` neben dem
Fachmodul `modul-elektro`. Der Kern ist die Auftragsverwaltung und kennt
keinen von ihnen.

Zwei Sockel im Kern halten das zusammen, ohne dass ein Modul ein anderes
kennt: Erweiterungspunkte reichen Oberfläche durch (der Zeiten-Block hängt an
`auftrag.abschnitt`), Dienste reichen Daten durch (die Planung fragt
`tagesstunden` und bekommt sie von der Zeiterfassung, wenn diese da ist).
Fehlt der Nachbar, fehlt seine Zutat und sonst nichts — ohne Zeiterfassung
zeigt der Dispo-Kalender nur die geplanten Stunden.

Unter Einstellungen → Bausteine steht, was dieser Betrieb hat. Das ist ein
Aufräumschalter, kein Kopierschutz; die Begründung steht in bausteine.md.

Offen: die Collection-Definitionen stehen weiterhin doppelt — im Modul und
gespiegelt in `einrichten.mjs`.

## Scheibe 4 – Positionen und Material (Baustein)

Leistungspositionen und Material am Auftrag. Zusammen mit den Stunden entstehen
daraus später Angebot und Rechnung fast von selbst.

Entsteht als eigener Baustein `baustein-material`, hängt am Auftrag aus dem
Kern und bietet später einen Dienst `auftragspositionen` für die
Verrechnung an.

## Scheibe 5 – Prüfbericht am Tablet (Fachmodul Elektro)

Prüfbericht nach OVE E 8101 als Formular, das offline vollständig ausfüllbar ist;
PDF-Erzeugung; Anhang am Auftrag. Prüft die Offline-Warteschlange unter echten
Bedingungen, inklusive Fotos.

## Scheibe 6 – Zugänge (erledigt)

Benutzer und Mitarbeiter werden gemeinsam geführt. Ein Zugang gehört immer zu
einer Person im Betrieb und entsteht in deren Mitarbeiterdatensatz unter
Einstellungen → Mitarbeiter; es gibt keine Benutzerliste daneben, die
auseinanderlaufen könnte. Wer nur eingeplant wird — eine Fremdfirma etwa —
bekommt keinen. Kunden bekommen bewusst gar keinen: ein Kundenportal wäre eine
eigene Anmeldung mit eigenen Regeln, kein Mitarbeiterzugang mit weniger
Rechten.

Im Zugangsblock: anlegen mit E-Mail und erstem Passwort, Bereiche als
Ankreuzfelder (Kernbereiche plus jedes angemeldete Fachmodul), Administrator
als eigener Schalter, Passwort zurücksetzen, Zugang entfernen. Den eigenen
Adminstatus kann man nicht entziehen und den eigenen Zugang nicht löschen —
sonst sperrt sich der letzte Administrator selbst aus. Wird ein Zugang
entfernt, bleibt der Mitarbeiter samt Zeiten und Terminen erhalten.

Die Regeln der Collection `users` setzt `einrichten.mjs`: Administratoren
dürfen anlegen, ändern und löschen, jeder sich selbst ändern, Selbst-
registrierung bleibt gesperrt.

`server/pb_hooks/passwort.pb.js` ergänzt zwei Endpunkte, die PocketBase nicht
mitbringt: das Passwort eines *anderen* Kontos setzen (PocketBase verlangt
sonst immer das alte — ausgerechnet im Fall, in dem es vergessen wurde) und
die eingestellte Mindestlänge abfragen, damit die Maske dieselbe Zahl nennt,
an der der Server misst.

Offen: Bereiche auch serverseitig je Collection durchsetzen (bisher steuern
sie die Oberfläche), Zugang vorübergehend sperren statt entfernen.

## Scheibe 7 – Angebot, Rechnung, Mahnwesen (Baustein)

Angebots- und Rechnungs-PDF mit den österreichischen Pflichtangaben nach
§11 UStG (UID, Firmenbuchnummer, fortlaufende Nummer, Leistungszeitraum),
Zahlungsziel und dreistufiges Mahnwesen.

Bewusst **nicht** vorgesehen: Registrierkasse und Buchhaltung. Die
Registrierkassenpflicht greift ab 15.000 EUR Jahresumsatz netto und zugleich
7.500 EUR Barumsätze netto und verlangt RKSV-Signatur, Datenerfassungsprotokoll
und Zertifizierung — das ist ein eigenes Produkt. Gebucht wird beim
Steuerberater; Werkboq liefert einen Export.

## Vor der ersten echten Inbetriebnahme

- `npm run entwicklung-weg` ausführen: löscht den Zugang adm/adm und setzt die
  Passwort-Mindestlänge zurück auf acht Zeichen.
- Mindestens einen echten Administrator anlegen, bevor der Entwicklungszugang
  verschwindet — sonst kann niemand mehr Zugänge vergeben.
- `WB_ENTWICKLUNG` aus der `.env` der Zielinstallation entfernen.

## Offene Punkte

- Collection-Definitionen an einer Stelle halten statt in Modul und `einrichten.mjs`
  gespiegelt (z. B. `einrichten.mjs` per tsx laufen lassen).
- Datei-Uploads in der Offline-Warteschlange puffern.
- Konfliktbehandlung beim Nachspielen (derzeit: letzter gewinnt).
- Desktop-Verpackung (Tauri) und die Frage, ob das Tablet nativ oder als
  installierbare Web-App läuft.
