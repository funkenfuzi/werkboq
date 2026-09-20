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

## Scheibe 4 – Positionen und Material (erledigt)

Baustein `material`: Leistungs- und Materialkatalog mit Verkaufs- und
Einkaufspreis, Positionen am Auftrag mit Menge, Einheit, Rabatt und
Steuersatz, Aufstellung netto je Steuersatz. Katalogpreise werden beim
Einfügen kopiert, nicht verknüpft — ein späterer Preiswechsel darf einen
halbfertigen Auftrag nicht rückwirkend verteuern.

Geld steht durchgehend als Cent in ganzen Zahlen, und die Steuer wird je
Steuersatz aus der gerundeten Nettosumme gerechnet. Beides steht unter Test
(`npm test`), weil ein stiller Rundungsfehler hier Geld kostet.

Offen: Lagerbestände (bewusst nicht vorgesehen), Preislisten je Kunde,
Import einer Großhändlerdatei.


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

## Scheibe 7 – Verrechnung und Mahnwesen (erledigt)

Baustein `verrechnung`: Angebot, Auftragsbestätigung, Rechnung und
Gutschrift in einer Collection, weil sie dieselbe Gestalt haben und sich nur
in Nummernkreis, Pflichtangaben und erlaubten Statuswechseln unterscheiden.

Zwei Festlegungen tragen das Ganze:

*Positionen werden eingefroren.* Ein Beleg kopiert die Zeilen in eigene
Datensätze. Ändert danach jemand die Auftragsposition, bleibt die Rechnung,
wie sie war — sie ist ein Dokument, das aus dem Haus gegangen ist, kein
Fenster in den aktuellen Datenbestand.

*Belege werden festgeschrieben.* Ab dem Festschreiben ändert sich nichts
mehr, und gelöscht werden kann ein Beleg überhaupt nicht (`deleteRule: null`).
Korrektur heißt Storno per Gutschrift mit Gegenvorzeichen; beide Belege
bleiben stehen.

Enthalten: Pflichtangaben nach § 11 UStG als Prüfliste, die vor dem
Festschreiben sagt, was fehlt; Kleinbetragsrechnung bis 400 € brutto nach
§ 11 Abs 6; Steuersätze 20/13/10 und die steuerfreien Fälle, allen voran der
Übergang der Steuerschuld bei Bauleistungen nach § 19 Abs 1a UStG (keine USt
ausgewiesen, Pflichthinweis gedruckt, UID des Empfängers verlangt);
Leistungszeitraum, Zahlungsziel, Skonto; Druckansicht als A4-Seite mit
Druckstil statt PDF-Bibliothek.

Zahlungen und offene Posten: Teilzahlungen sind der Normalfall, der Beleg
gilt erst als bezahlt, wenn die Summe reicht. Die Liste der offenen Posten
zeigt Verzug in Tagen.

Mahnwesen dreistufig: Zahlungserinnerung, 1. Mahnung, 2. Mahnung. Zinsen
taggenau auf 365 Tage — zwischen Unternehmern 10,73 % nach § 456 UGB
(Basiszinssatz 1,53 plus 9,2 Punkte, Stand 2026), gegenüber Verbrauchern 4 %
nach § 1000 ABGB. Betreibungskostenpauschale 40 € nach § 458 UGB, nur im B2B
und nur einmal je Forderung. Vorschläge sind änderbar; ob der Kunde
Unternehmer ist, steht in seinen Stammdaten.

Offen: E-Rechnung als XML (ebInterface bzw. EN 16931). In Österreich gibt es
2026 noch keine B2B-Pflicht; EU-weit wird sie ab 1.7.2030 für
grenzüberschreitende Rechnungen verlangt. Das Datenmodell trägt es, die
Ausgabe fehlt. Ebenfalls offen: das PDF automatisch am Auftrag ablegen,
Sammelrechnung über mehrere Aufträge, Teilrechnung mit Anzahlung.

## Scheibe 8 – Export für den Steuerberater

Ausgangsrechnungsjournal und Zahlungen als CSV in einem Aufbau, den BMD und
RZL einlesen können. Kein Kontenrahmen, keine UVA, kein Abschluss —
gebucht wird beim Steuerberater.

## Scheibe 9 – Verträge (Baustein)

Wartungsverträge mit Intervall und wiederkehrender Verrechnung,
Vertragsdokumente am Kunden mit Laufzeit, Kündigungsfrist und Erinnerung vor
Ablauf, Auftragsbestätigung aus dem angenommenen Angebot.

## Vor der ersten echten Inbetriebnahme

- `npm run entwicklung-weg` ausführen: löscht den Zugang adm/adm und setzt die
  Passwort-Mindestlänge zurück auf acht Zeichen.
- Mindestens einen echten Administrator anlegen, bevor der Entwicklungszugang
  verschwindet — sonst kann niemand mehr Zugänge vergeben.
- `WB_ENTWICKLUNG` aus der `.env` der Zielinstallation entfernen.

## Bevor das erste Exemplar in die Schweiz geht

- QR-Rechnung (Swiss QR Code im Zahlteil) — seit Oktober 2022 der Standard.
  Eine Schweizer Rechnung aus Werkboq ist ohne ihn gültig, aber unüblich.

## Zweiter Durchgang Rechte

Serverseitig durchgesetzt ist bisher nur das Personalwesen. Aufträge,
Material und Verrechnung stehen noch auf „jeder Angemeldete darf alles“ —
die Stufe in der Oberfläche blendet dort nur aus. `npm run rechte-pruefen`
listet den Rückstand am Ende namentlich auf; siehe docs/rechte.md.

Reihenfolge, wenn es soweit ist: Belege (Geld), dann Artikel (Preise und
Einkaufspreise), dann Aufträge (der Monteur soll lesen, aber nicht ändern).

## Handybreite — was noch offen ist

Die Anwendung passt jetzt ab 360 px ohne waagrechtes Schieben. Auf 320 px
(iPhone SE der ersten Reihe) ragt die Einstellungsseite um sieben Pixel
hinaus; das ist bewusst nicht gejagt worden.

Wie man es prüft, ohne sich selbst zu täuschen: `document.body.scrollWidth`
gegen `window.visualViewport.width` vergleichen, **nicht** gegen
`window.innerWidth`. Läuft der Inhalt über, wächst der Layout-Viewport mit,
`innerWidth` wächst ebenfalls, und jede Prüfung der Form
`scrollWidth > innerWidth` meldet fröhlich "passt", während die Seite auf
dem Gerät 1066 px breit ist. Genau dieser Fehler hat die Überläufe bis
September 2026 verdeckt.

## Offene Punkte

- E-Rechnung: ebInterface/Peppol (AT), XRechnung/ZUGFeRD (DE).
- Basiszinssätze veralten halbjährlich. Sie stehen je Land an einer Stelle
  (`werkzeug/laender.ts`, Feld `zinsStand` nennt Stand und Quelle); es braucht
  einen Vorgang, der sie zweimal im Jahr nachzieht.

- Collection-Definitionen an einer Stelle halten statt in Modul und `einrichten.mjs`
  gespiegelt (z. B. `einrichten.mjs` per tsx laufen lassen).
- Datei-Uploads in der Offline-Warteschlange puffern.
- Konfliktbehandlung beim Nachspielen (derzeit: letzter gewinnt).
- Desktop-Verpackung (Tauri) und die Frage, ob das Tablet nativ oder als
  installierbare Web-App läuft.
