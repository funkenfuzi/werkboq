# Österreich, Deutschland, Schweiz

Werkboq soll in allen drei Ländern verkauft werden. In allen dreien gelten
andere Steuersätze, andere Pflichtangaben auf der Rechnung, andere
Verzugszinsen, andere Aufbewahrungsfristen und andere Elektronormen.

Diese Unterschiede stehen an **einer** Stelle: `packages/core/src/werkzeug/laender.ts`.
Jeder Baustein fragt das Profil und rechnet damit. Wer einen Steuersatz oder
eine Fundstelle im Code eines Bausteins findet, hat einen Fehler gefunden.

## Das Land wird beim Einrichten gewählt und dann festgeschrieben

Unter **Einstellungen → Betrieb** steht ganz oben der Rechtsraum. Solange kein
Beleg festgeschrieben ist, lässt er sich ändern. Danach ist das Feld gesperrt.

Das ist keine Bequemlichkeit, sondern notwendig. Eine festgeschriebene Rechnung
trägt einen Steuersatz, eine Währung und einen Pflichthinweis aus dem Recht
ihres Landes. Würde man nachträglich umschalten, stünden alte Rechnungen mit
falscher Rechtsgrundlage da — und niemand würde es merken. Wer in zwei Ländern
abrechnet, braucht zwei Mandanten.

Technisch fragt der Kern über den Dienst `rechtsraumSperre`, ob schon etwas an
diesem Recht hängt. Der Baustein Verrechnung beantwortet ihn. Ist der Baustein
nicht gekauft, antwortet niemand und das Land bleibt frei — es gibt dann auch
keine Belege, die falsch werden könnten. Kann die Frage nicht beantwortet
werden (kein Netz, keine Rechte), wird gesperrt: lieber sperren als raten.

## Was das Profil festlegt

| | Österreich | Deutschland | Schweiz |
|---|---|---|---|
| Währung | € nachgestellt | € nachgestellt | CHF vorangestellt |
| Schreibweise | `1.234,56` | `1.234,56` | `1’234.56` |
| Steuer | USt 20 / 13 / 10 / 0 % | USt 19 / 7 / 0 % | MWST 8.1 / 3.8 / 2.6 / 0 % |
| Rechnungspflichtangaben | § 11 UStG | § 14 UStG | Art. 26 MWSTG |
| Kleinbetragsrechnung | bis 400 € (§ 11 Abs 6 UStG) | bis 250 € (§ 33 UStDV) | gibt es nicht |
| Steuernummer des Empfängers | ab 10.000 € brutto | nicht betragsabhängig | nicht betragsabhängig |
| Bauleistung, Übergang der Steuerschuld | § 19 Abs 1a UStG | § 13b Abs 2 Nr 4 UStG | **gibt es nicht** |
| Kleinunternehmer | § 6 Abs 1 Z 27 UStG | § 19 UStG | Art. 10 Abs 2 MWSTG |
| Verzugszinsen B2B | 10,73 % (§ 456 UGB) | 10,52 % (§ 288 Abs 2 BGB) | 5 % (Art. 104 OR) |
| Verzugszinsen B2C | 4 % (§ 1000 ABGB) | 6,52 % (§ 288 Abs 1 BGB) | 5 % (Art. 104 OR) |
| Kostenpauschale B2B | 40 € (§ 458 UGB) | 40 € (§ 288 Abs 5 BGB) | **keine** |
| Aufbewahrung | 7 Jahre (§ 132 BAO) | 8 Jahre (§ 147 AO) | 10 Jahre (Art. 958f OR) |
| Elektronorm | OVE E 8101 | DIN VDE 0100 / 0105-100 | NIN / SN 411000 |
| Nachweis | Prüfbefund | Prüfprotokoll, DGUV V3 | Sicherheitsnachweis (SiNa) |

## Zinssätze veralten

Der Basiszinssatz wird halbjährlich neu festgesetzt — in Österreich von der
OeNB, in Deutschland von der Bundesbank. Die Werte im Profil tragen jeweils
Stand und Fundstelle im Feld `zinsStand`; ändert sich der Satz, ist genau eine
Zahl je Land zu ändern.

Werkboq **schlägt** Zinsen vor, es behauptet sie nicht: im Mahnblock lässt sich
jeder Betrag überschreiben, bevor die Mahnung festgehalten wird.

Stand der hinterlegten Werte:

* Österreich: Basiszinssatz 1,53 %, unverändert seit 11.6.2025
* Deutschland: Basiszinssatz 1,52 %, seit 1.7.2026
* Schweiz: 5 % gesetzlicher Verzugszins, gilt unverändert

## Was Werkboq bewusst nicht tut

**Keine Registrierkasse.** Österreich verlangt ab 15.000 € Jahresumsatz netto
und zugleich 7.500 € Barumsatz netto eine RKSV-Signatureinheit mit
Datenerfassungsprotokoll und Zertifizierung, Deutschland eine zertifizierte
technische Sicherheitseinrichtung nach KassenSichV. Das ist ein eigenes Produkt
mit eigener Haftung.

**Keine QR-Rechnung.** In der Schweiz ist der Zahlteil mit Swiss QR Code seit
Oktober 2022 der Standard. Werkboq druckt ihn noch nicht — eine Schweizer
Rechnung aus Werkboq ist gültig, aber unüblich. Das gehört auf den Fahrplan,
bevor das erste Schweizer Exemplar verkauft wird.

**Keine E-Rechnung.** Weder ebInterface/Peppol (AT) noch XRechnung/ZUGFeRD (DE).
Steht im Fahrplan.

**Keine Steuerberatung.** Ob eine Leistung eine Bauleistung ist, ob ein Kunde
Unternehmer ist, welcher Satz auf welche Leistung gehört — das entscheidet der
Betrieb, nicht das Programm. Werkboq prüft nur, was es wissen kann, und sagt
das auch so.

## Für Entwickler

```ts
import { aktuellerRechtsraum, schreibweiseVon, alsEuro, satzText } from "@werkboq/core";

const raum = aktuellerRechtsraum();      // synchron, beim Start geladen
const sw = schreibweiseVon(raum.id);     // Tausender, Komma, Währungszeichen

alsEuro(123456, sw)                      // "1.234,56 €" bzw. "CHF 1’234.56"
raum.steuersaetze.map((s) => satzText(raum, s.satz));
raum.normalsatz                          // Voreinstellung einer neuen Position
```

Regeln:

* Kein Steuersatz, keine Währung, kein Paragraf hartcodiert in einem Baustein.
* Jede Geldausgabe bekommt die Schreibweise mit: `alsEuro(x, sw)`, nie `alsEuro(x)`.
* Prozentzahlen über `zahlText(raum, wert)` — die Schweiz schreibt `8.1`, Österreich `20`.
* Beträge bleiben ganzzahlige Cent bzw. Rappen. `ustsatz` darf Nachkommastellen
  haben (8,1 %) — deshalb steht in den Collections kein `noDecimal`.
