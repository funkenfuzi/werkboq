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

Die Collection-Definitionen standen damals doppelt — im Modul und gespiegelt
in `einrichten.mjs`. Seit September 2026 an einer Stelle: `schema.mjs` je
Paket, eingesammelt in `server/schema.mjs`.

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

## Scheibe 8 – Export für den Steuerberater (erledigt, BMD ungeprüft)

Seite „Steuerberater" (Bereich Buchhaltung): Zeitraum wählen (voriger
Monat, Quartal, Jahr oder frei), oben die Summen je Steuersatz, darunter
drei Dateien:

* **Rechnungsausgangsbuch** — eine Zeile je Beleg und Steuersatz,
  Semikolon, Komma als Dezimaltrenner, UTF-8 mit BOM für Excel. Nur
  festgeschriebene Rechnungen und Gutschriften; Gutschriften negativ, mit
  der Nummer der stornierten Rechnung. Die Steuer je Satz ist genauso
  gerundet wie auf dem Beleg.
* **Zahlungseingänge** — Datum, Belegnummer, Kunde, Betrag, Art.
* **BMD-Buchungsimport** — Feldaufbau nach der öffentlichen BMD-Beschreibung
  (konto = Erlöskonto, gkto = Debitor, betrag netto und im Haben negativ,
  steucod 3 bzw. 17 für die Bauleistung nach § 19 Abs 1a), Windows-1252.
  Braucht die Konten des Betriebs, die auf derselben Seite eingetragen
  werden. **Nicht gegen eine echte BMD-Installation geprüft** —
  Importdefinitionen sind je Kanzlei einstellbar. Vor dem ersten Einsatz
  mit dem Steuerberater an einer Testdatei abstimmen.

Offen: RZL hat ein eigenes Format mit 41 Feldern (zweizeilig, Brutto am
Kunden), DATEV einen EXTF-Buchungsstapel. Beide kommen, wenn ein Kunde
sie braucht; bis dahin nimmt jede Kanzlei das Rechnungsausgangsbuch.
Kein Kontenrahmen, keine UVA, kein Abschluss — gebucht wird beim
Steuerberater.

## Scheibe 9 – Verträge (Baustein)

Wartungsverträge mit Intervall und wiederkehrender Verrechnung,
Vertragsdokumente am Kunden mit Laufzeit, Kündigungsfrist und Erinnerung vor
Ablauf, Auftragsbestätigung aus dem angenommenen Angebot.

## Scheibe 10 – Fuhrpark (erledigt)

Baustein `fuhrpark`: Fahrzeuge mit Kilometerstand und Zuordnung,
wiederkehrende Fristen für Begutachtung, Service, Reifen, Versicherung und
Leasing, Erinnerung als Kachel auf der Startseite.

Eine Frist hängt an einem Datum, an einem Kilometerstand oder an beidem,
und der schlimmere Zustand gewinnt. Die Zeile nennt dann auch, woran es
liegt: neben „überfällig" steht „1.000 km über 120.000" und nicht „in 190
Tagen" — eine Zeile, die sich selbst widerspricht, nimmt der Ampel den
Glauben.

Beim Erledigen entsteht der Nachfolger im selben Zug, gerechnet vom
Fälligkeitsdatum und nicht vom Tag der Erledigung: sonst wandert der Termin
mit jeder Erledigung nach vorne. Monatsenden werden gekappt (31. Jänner
plus ein Monat ist der 28. Februar), Schaltjahre stehen unter Test.

Was bewusst fehlt: die gesetzliche Frist auszurechnen. Der Rechtsraum
liefert nur den Namen und die Fundstelle — § 57a KFG, § 29 StVZO,
Art. 33 VTS.

Offen: das Fahrzeuglager als Nachfüllliste („was fehlt im Bus"). Jetzt, wo
es Fahrzeuge gibt, lässt es sich bauen; es gehört in den Baustein Material
und fragt die Fahrzeuge über einen Dienst ab, damit kein Modul das andere
kennt.

## Scheibe 10b – Phasen, Reiter, Kilometer (erledigt)

Phasengerüst mit Namen je Auftragsart, einstellbar je Betrieb; Phasenbrett
mit Filter nach Art, passt bei 1280 px ohne Seitwärtsscrollen; Auftragsakte
in Reitern mit Kacheln; Fahrten am Auftrag mit Fahrtkosten auf der Rechnung.
Einzelheiten in `produkt.md`, Punkt 4.

Beim Umbau gelernt:

* **PocketBase ohne `--automigrate=0`** schreibt bei jeder Schemaänderung
  Migrationsdateien und bricht dabei gelegentlich mit einer nackten 400 ab
  („Failed to update the collection."). `server/start.mjs` startet richtig;
  wer PocketBase von Hand startet, muss den Schalter selbst setzen.
  `einrichten.mjs` versucht es bei dieser Meldung dreimal. Eine frühere
  Aussage in dieser Sitzung, jede Neuinstallation breche ab, war falsch —
  sie kam aus dem Testaufbau.
* **Farbnamen:** Die Daten sagten „fehler", das Stylesheet kannte nur
  „error". Abgelaufene Fristen und Schadensfotos waren grau statt rot.
  Behoben; `farben.test.ts` prüft jetzt jede Farbe aus den Daten gegen das
  Stylesheet.

## Scheibe 10c – Angebotsverfolgung (erledigt)

Nachfassen nach Rhythmus oder Wiedervorlage, Zusage mit Auftrag und
Auftragsbestätigung, Absage mit Grund, Auswertung. Einzelheiten in
`produkt.md`, Punkt 6.

Nebenbei gefunden und behoben: **Null galt als „fehlt".** PocketBase hält
bei einem Zahlenfeld mit `required` die Null für einen fehlenden Wert.
`belege.ust` war Pflicht — keine Rechnung mit Übergang der Steuerschuld
ließ sich speichern, ebenso kein leerer Angebotsentwurf und keine Zeile mit
Preis null (etwa „Kilometersatz hinterlegen"). Betroffen waren Beträge und
Steuersätze in `belege`, `belegpositionen`, `positionen` und `artikel`.
Dazu kam, dass `einrichten.mjs` ein einmal gesetztes `required` nie wieder
zurücknahm; jetzt gilt die Definition, und der Lauf meldet „nicht mehr
Pflicht". Ein Test in `schema-spiegel.test.ts` wacht darüber.

Die Rechte dazu (nur Buchhaltung) und der Hinweis statt einer leeren Seite
sind seit dem 23. September nachgezogen, siehe „Zweiter Durchgang Rechte".

## Vor der ersten echten Inbetriebnahme

- `SICHERUNG_ZIEL` in der `.env` auf einen zweiten Datenträger setzen und
  `npm run sicherung` einmal laufen lassen. Die nächtliche Sicherung läuft
  von selbst, liegt aber auf demselben Rechner — siehe docs/sicherung.md.

- `npm run entwicklung-weg` ausführen: löscht den Zugang adm/adm und setzt die
  Passwort-Mindestlänge zurück auf acht Zeichen.
- Mindestens einen echten Administrator anlegen, bevor der Entwicklungszugang
  verschwindet — sonst kann niemand mehr Zugänge vergeben.
- `WB_ENTWICKLUNG` aus der `.env` der Zielinstallation entfernen.

## Bevor das erste Exemplar in die Schweiz geht

- QR-Rechnung (Swiss QR Code im Zahlteil) — seit Oktober 2022 der Standard.
  Eine Schweizer Rechnung aus Werkboq ist ohne ihn gültig, aber unüblich.

## Zweiter Durchgang Rechte

Serverseitig durchgesetzt sind bisher das Personalwesen, die Verrechnung
(seit 23. September 2026, samt Unveränderlichkeit festgeschriebener
Belege über einen Hook), die Unveränderlichkeit der Unterschriften und die
Freigabe von Positionen, und seit demselben Tag auch Aufträge, Kunden,
Artikel (samt Einkaufspreis) und freigegebene Positionen.

Beim Durchgang Verrechnung nebenbei gefunden: `belege` und
`belegpositionen` hatten `deleteRule: null` — damit konnte in der App
niemand einen Entwurf verwerfen oder eine Zeile aus einem Entwurf löschen,
nur der Serveradministrator. Nachgeprüft gegen die alte Regel. `npm run rechte-pruefen`
listet den Rückstand am Ende namentlich auf; siehe docs/rechte.md.

Reihenfolge war: Belege, Artikel, Aufträge — alle drei erledigt am
23. September 2026, dazu Kunden und der Versandnachweis. Der Abschnitt
„noch nicht durchgesetzt" in `npm run rechte-pruefen` ist leer.

Die Unterschrift ist die Ausnahme: `unterschriften` hat keine `updateRule`,
gelöscht werden darf nur von einem Administrator. Das ist gegen die API
geprüft, nicht bloß in der Oberfläche ausgeblendet.

Bei den Positionen ist seit September 2026 die Freigabe gesperrt — ohne
Schreibrecht `lager` lässt sich `zustand` nicht auf „freigegeben" setzen,
auch nicht über einen Umweg beim Anlegen. Seit dem 23. September ändert
und löscht eine schon freigegebene Position ebenfalls nur, wer Lagerrecht
hat. Wie man ein einzelnes
Feld absichert, obwohl PocketBase nur Regeln je Datensatz kennt, steht in
docs/rechte.md.

Beim Versandnachweis war es lockerer: `versand` ließ Ändern durch jeden
Angemeldeten zu, damit die Rückfrage („wirklich hinausgegangen?") das Feld
`bestaetigt` umlegen kann — und damit auch Empfänger oder Weg. Seit dem
23. September 2026 lässt der Hook `server/pb_hooks/versand.pb.js` nur noch
`bestaetigt` und das neue `nichtErfolgt` zu, beides ohne Zurücknehmen.
Nebenbei behoben: auf „Nein" blieb die Rückfrage für immer stehen.

## Handybreite — was noch offen ist

Die Anwendung passt ab 360 px ohne waagrechtes Schieben — zuletzt am
20. September 2026 über Start, Aufträge, Auftragsakte, Belegakte, Personal
und Einstellungen bei 360, 390, 768 und 1280 px nachgemessen. Auf 320 px
(iPhone SE der ersten Reihe) ragt die Einstellungsseite um sieben Pixel
hinaus; das ist bewusst nicht gejagt worden.

Wie man es prüft, ohne sich selbst zu täuschen: `document.body.scrollWidth`
gegen `window.visualViewport.width` vergleichen, **nicht** gegen
`window.innerWidth`. Läuft der Inhalt über, wächst der Layout-Viewport mit,
`innerWidth` wächst ebenfalls, und jede Prüfung der Form
`scrollWidth > innerWidth` meldet fröhlich "passt", während die Seite auf
dem Gerät 1066 px breit ist. Genau dieser Fehler hat die Überläufe bis
September 2026 verdeckt.

Und eine Gegenprobe gehört dazu: einen 900 px breiten Kasten in die Seite
hängen und nachsehen, ob die Messung ihn meldet. Eine Prüfung, die nur „ok"
sagen kann, prüft nichts.

## Strichcode auf dem iPhone

Die Materialerfassung liest Strichcodes über `BarcodeDetector`. Den gibt es
in Chrome auf Android, nicht in Safari auf dem iPhone — und iPhones stehen
auf Baustellen. Wo der Leser fehlt, erscheint kein Kameraknopf, sondern ein
Feld zum Eintippen und ein Satz, der sagt, warum.

Wenn das zu wenig ist, bleibt eine Fremdbibliothek (ZXing oder quagga2,
beides in der Größenordnung eines halben Megabyte). Dann aber nachgeladen
erst beim ersten Scanversuch, nicht im Grundpaket: im Keller mit einem
Balken Empfang lädt niemand ein halbes Megabyte, nur um eine Seite zu
öffnen.

## Offene Punkte

- E-Rechnung: ebInterface/Peppol (AT), XRechnung/ZUGFeRD (DE).
- Basiszinssätze veralten halbjährlich. Sie stehen je Land an einer Stelle
  (`werkzeug/laender.ts`, Feld `zinsStand` nennt Stand und Quelle); es braucht
  einen Vorgang, der sie zweimal im Jahr nachzieht.

- ~~Collection-Definitionen an einer Stelle halten~~ — erledigt am
  23. September 2026: `schema.mjs` je Paket, eingesammelt in
  `server/schema.mjs`. Beim Umzug wurde geprüft, dass die Definitionen
  Zeichen für Zeichen dieselben geblieben sind.

  Warum es nötig war: am 21. September fehlte `auftraege.art` in der
  Serverkopie — PocketBase nimmt ein unbekanntes Feld beim Speichern
  widerspruchslos an und wirft es weg —, und am 23. blockierte ein
  `required`, das nur noch in einer Kopie stand, Rechnungen ohne
  Umsatzsteuer. Merksatz aus dem ersten Fall bleibt: **einen Standardwert
  prüft man nie am Standardfall.**

  `packages/core/test/schema-spiegel.test.ts` prüft weiterhin, dass die
  Auswahlwerte im Schema zu den Konstanten im Code passen — das sind auch
  nach dem Umzug zwei Stellen.
- Datei-Uploads in der Offline-Warteschlange puffern.
- Konfliktbehandlung beim Nachspielen (derzeit: letzter gewinnt).
- Desktop-Verpackung (Tauri) und die Frage, ob das Tablet nativ oder als
  installierbare Web-App läuft.
