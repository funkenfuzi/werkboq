# E-Rechnung — vorgesehen, nicht eingebaut

Stand: 24. September 2026. Julian hat entschieden, die E-Rechnung für
Deutschland, Österreich und die Schweiz **vorzusehen, aber noch nicht
einzubauen**. Dieses Papier hält fest, was dafür nötig ist, was im
Datenmodell noch fehlt und in welcher Reihenfolge es gebaut wird, sobald es
ansteht. Es gibt dafür noch keinen Code und keine Schemafelder.

Die Rechtslage unten ist aus den am Ende genannten Quellen zusammengetragen,
nicht aus dem Gedächtnis. Sie ändert sich. **Vor dem Einbau neu prüfen.**

## Worauf es ankommt: das Land der Installation

Eine Werkboq-Installation hat genau einen Rechtsraum (siehe
docs/rechtsraeume.md). Ob E-Rechnungen Pflicht sind, hängt am Land des
Betriebs, der die Rechnung stellt, und an der Art des Kunden. Daraus ergeben
sich drei verschiedene Fälle:

| | Österreich | Deutschland | Schweiz |
|---|---|---|---|
| An Unternehmer (B2B) | keine Pflicht, kein Termin beschlossen | Empfang seit 1.1.2025; Ausstellung Pflicht ab 1.1.2027 (Vorjahresumsatz über 800.000 €), ab 1.1.2028 für alle | keine Pflicht |
| An öffentliche Auftraggeber | Bund: Pflicht seit 1.1.2014 | Bund und Länder: E-Rechnung mit Leitweg-ID, meist XRechnung | Bund: Pflicht ab Vertragswert über CHF 5.000, seit 2016 |
| Format | ebInterface (derzeit 6.1; 7.0 für Q4 2026 angekündigt) oder Peppol BIS 3.0 | XRechnung (derzeit 3.0.2; 4.0 erwartet) oder ZUGFeRD ab 2.0.1, **nicht** die Profile MINIMUM und BASIC-WL | über zugelassene Dienstleister (Portal, PDF-Hochladen, ERP-Anbindung) |
| Weg | Hochladen im USP oder über Peppol | E-Mail, Portal oder Peppol | Dienstleister-Portal |
| Ausnahmen | — | Kleinbetragsrechnungen bis 250 € brutto | Bund: bis CHF 5.000 Vertragswert |

Für die Kundschaft von Werkboq heißt das:

- **Deutschland ist der dringende Fall.** Ein deutscher Elektrobetrieb muss
  spätestens ab 2028 jede Rechnung an Unternehmer elektronisch stellen.
  Ohne E-Rechnung ist Werkboq in Deutschland ab dann nicht verkaufbar, für
  größere Betriebe schon ab 2027. **Spätester Einbau: vor dem ersten
  Verkauf nach Deutschland oder bis Mitte 2027, je nachdem, was früher
  kommt.**
- **Österreich** braucht ebInterface nur für Rechnungen an den Bund, etwa
  bei Arbeiten in Bundesgebäuden. Das kommt vor, ist aber selten. Die
  EU-Vorgaben (ViDA) bringen ab 1. Juli 2030 strukturierte Rechnungen für
  Geschäfte zwischen Unternehmern in verschiedenen EU-Ländern.
- **Schweiz**: Praktisch nötig ist die QR-Rechnung (Zahlteil), keine
  E-Rechnung. Rechnungen an den Bund laufen über die Portale der
  Dienstleister, dort kann man auch ein PDF hochladen. Die QR-Rechnung steht
  im Fahrplan als eigener Punkt, hängt aber an derselben Vorarbeit
  (strukturierte Anschrift, siehe unten).

## Wie es gebaut wird

**Ort.** Im Baustein Verrechnung, unter `daten/erechnung/`. Die E-Rechnung
ist eine andere Darstellung eines Belegs, kein eigener Baustein. Ohne die
Verrechnung gibt es keine Belege.

**Ein Datenmodell, mehrere Schreibweisen.** Alle genannten Formate bilden
dasselbe europäische Datenmodell ab (EN 16931: Verkäufer, Käufer,
Positionen, Steuer je Kategorie, Zahlungsangaben). ebInterface 7.0 soll
sich enger daran binden. Also:

1. eine reine Funktion `rechnungsdaten(beleg, zeilen, betrieb)` →
   EN-16931-Modell mit den Geschäftsbegriffen (BT-…), einmal geschrieben
   und einmal getestet;
2. je Format eine reine Funktion, die dieses Modell als XML schreibt:
   `xrechnungCii()`, `ebinterface()`, später `zugferd()`.

Wer ein Format ergänzt, schreibt nur den zweiten Teil. Rundung und
Steuerlogik stehen dann nur an einer Stelle, wie bei den Belegen selbst.

**Nur aus festgeschriebenen Belegen.** Ein Entwurf kann sich noch ändern,
eine E-Rechnung nicht. Weil der festgeschriebene Beleg unveränderlich ist
(Hook `belege.pb.js`), ergibt dasselbe Programm aus denselben Daten
dieselbe Datei. Beim Versand wird die Datei als Anhang am Versandnachweis
abgelegt, damit belegt ist, was wirklich hinausging, auch wenn das
Programm später eine neuere Formatversion schreibt.

**Vorprüfung statt Fehlermeldung am Ende.** Ist ein Kunde auf E-Rechnung
gestellt, zeigt die Belegakte schon vor dem Festschreiben, was fehlt
(Leitweg-ID, Auftragsreferenz, Ländercode, Einheitencode …). Ein
festgeschriebener Beleg lässt sich nicht mehr ergänzen, nur stornieren.

**Versand.** Entschieden (Julian, 24. September 2026): als Datei, zum
Herunterladen oder als Anhang im Dokumentenversand mit Nachweis. An den
österreichischen Bund lädt der Betrieb sie selbst im USP hoch. Kein
Fremddienst, keine laufenden Kosten. Peppol kommt erst mit einem
Access-Point-Anbieter und einem Vertrag. Es wird nur vorgesehen, nicht
gebaut.

**ZUGFeRD** ist ein PDF/A-3 mit eingebetteter XML-Datei. Werkboq druckt
Belege über den Browser (siehe `BelegDruck.tsx`), und so ein PDF kann keine
Datei tragen und ist kein PDF/A. ZUGFeRD braucht deshalb einen eigenen
PDF-Erzeuger. Das ist eine eigene Entscheidung mit eigenem Aufwand. Für die
deutsche Pflicht reicht XRechnung. ZUGFeRD ist bequemer für kleine
Empfänger, weil sie das PDF lesen können.

**Prüfen.** XRechnung gegen den KoSIT-Validator mit der amtlichen
XRechnung-Konfiguration, ebInterface gegen das amtliche XSD. Beides
braucht Java oder Netz und gehört deshalb in einen eigenen Prüflauf, nicht
in die normalen Tests. Die normalen Tests prüfen das Datenmodell.

## Was im Datenmodell fehlt

Das ist die eigentliche Vorarbeit. Gebaut ist davon nichts.

| # | Lücke | Heute | Nötig für | Anmerkung |
|---|---|---|---|---|
| 1 | Empfängeranschrift am Beleg | ein eingefrorener Textblock `empfaengerAnschrift` | alle Formate **und die QR-Rechnung** | Straße, PLZ, Ort, Land getrennt einfrieren. Die QR-Rechnung lässt seit 21. November 2025 nur noch strukturierte Adressen (Typ S) zu. Den Textblock für den Druck behalten. |
| 2 | Land | freier Text (`kunden.land`, `betrieb.land`); `anschriftVon` vergleicht mit „Österreich" | alle Formate | ISO-3166-Code (AT, DE, CH …) daneben führen, Anzeige bleibt Text. |
| 3 | Einheit | freier Text je Position („Std", „Stk", „Pausch.") | alle Formate | Zuordnung zu UN/ECE-Rec-20-Codes (HUR, H87, MTR, KMT, LS …) als Tabelle. Unbekannte Einheiten meldet die Vorprüfung. |
| 4 | Steuerkategorie | `steuerfrei` mit Gründen | alle Formate | Zuordnung: keiner → S, bauleistung → AE, innergemeinschaftlich → K, ausfuhr → G, kleinunternehmer → E. Die Hinweistexte gibt es schon. |
| 5 | Referenz des Kunden | fehlt | DE: Käuferreferenz (bei Behörden die Leitweg-ID); AT Bund: Auftragsreferenz | Feld am Beleg, mit dem Beleg eingefroren. AT Bund kennt drei Formen: 10-stellige Bestellnummer, 3-stelliges Kürzel, Kürzel:Referenz. |
| 6 | Kundendaten für E-Rechnung | fehlt | alle | Am Kunden: E-Rechnung ja/nein und Format, Leitweg-ID (DE-Behörde), Lieferantennummer (AT Bund), Adresse für den Empfang. |
| 7 | Ansprechpartner des Rechnungsstellers | `betrieb` hat Telefon und E-Mail, keinen Namen | XRechnung | Beim Einbau gegen die XRechnung-Regeln prüfen, welche Kontaktangaben Pflicht sind. |
| 8 | Skonto | `skontoProzent`, `skontoTage` | XRechnung | XRechnung hat für Skonto eine eigene Schreibweise im Zahlungsbedingungstext. Beim Einbau aus der Spezifikation übernehmen. |
| 9 | Gutschrift / Storno | `storniert` verweist auf den Ursprungsbeleg | alle | Rechnungsart „Gutschrift" samt Verweis auf die ursprüngliche Rechnung. Die Daten sind da. |

Die Punkte 1 und 2 braucht auch die QR-Rechnung. Sie gehören deshalb an
den Anfang, egal welches Land zuerst kommt.

## Reihenfolge, wenn es so weit ist

1. Strukturierte Anschrift und Ländercode (Lücken 1 und 2). Bringt auch die
   QR-Rechnung einen Schritt näher.
2. EN-16931-Modell mit Einheiten- und Steuerzuordnung (3, 4, 9) samt Tests.
3. XRechnung (CII) und Kundendaten, Referenz, Vorprüfung (5 bis 8). Das ist
   der deutsche Pflichtfall.
4. ebInterface für den österreichischen Bund.
5. Anhang im Dokumentenversand, KoSIT- und XSD-Prüflauf.
6. Erst bei Bedarf: ZUGFeRD mit eigenem PDF-Erzeuger, Peppol über einen
   Anbieter.

## Quellen (abgerufen am 24. September 2026)

- IHK Oberfranken Bayreuth, „Die neuen Vorschriften zur E-Rechnungsstellung
  im B2B-Bereich":
  https://www.ihk.de/bayreuth/hauptnavigation/service/steuern/rechnungen/die-erechnung-fuer-b2b-umsaetze-kommt--6055042
- milchrechnung.at, „ebInterface 7.0 in Vorbereitung":
  https://milchrechnung.at/de/blog/ebinterface-7-2026/
- finanzinfo.at, „E-Rechnung in Österreich":
  https://finanzinfo.at/business/e-rechnung/
- e-Rechnung.gv.at, Auftragsreferenz: https://www.erechnung.gv.at/go/orderref_fedgov
- e-Rechnung.gv.at, Rechnungsinhalte: https://www.erechnung.gv.at/erb/de_AT/content
- Factora, XRechnung 4.0: https://factora.software/blog/xrechnung-4-0-aenderungen/
- FNFE-MPE, Factur-X 1.08 / ZUGFeRD 2.4 (Pressemitteilung):
  https://fnfe-mpe.org/wp-content/uploads/2025/12/2025-12-04_Factur-X_1.08_ZUGFeRD_2.4_Press_Release_EN.pdf
- Bundeskanzlei, E-Rechnung:
  https://www.bk.admin.ch/bk/de/home/digitale-transformation-ikt-lenkung/e-services-bund/services/e-rechnung.html
- ecosio, E-Rechnung Schweiz: https://ecosio.com/de/blog/e-rechnung-schweiz/
- loops.ch, „QR-Rechnung 2025: Strukturierte Adressen werden Pflicht":
  https://www.loops.ch/blog/qr-rechnung-2025-strukturierte-adressen-werden-pflicht-das-muessen-unternehmen-wissen
- easybill, Leitweg-ID: https://www.easybill.de/ratgeber/leitweg-id/
