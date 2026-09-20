import type { WerkboqModul } from "@werkboq/core";
import { Belege } from "./seiten/Belege";
import { BelegAkte } from "./seiten/BelegAkte";
import { BelegDruck } from "./seiten/BelegDruck";
import { AuftragBelege } from "./erweiterungen/AuftragBelege";
import { VERRECHNUNG_COLLECTIONS } from "./daten/collections";
import "./gestaltung/beleg.css";

export * from "./daten/belege";
export * from "./daten/zahlungen";
export * from "./daten/mahnwesen";

/**
 * Baustein Verrechnung.
 *
 * Angebot, Auftragsbestätigung, Rechnung, Gutschrift — dazu Zahlungen,
 * offene Posten und ein dreistufiges Mahnwesen.
 *
 * Was dieser Baustein von anderen nimmt, wenn sie da sind:
 *   auftragspositionen — die Zeilen aus dem Baustein Material
 *   auftragsstunden    — die verrechenbaren Stunden aus der Zeiterfassung
 * Fehlt beides, schreibt man die Zeilen von Hand. Eine Rechnung ohne
 * Materialkatalog ist ein vollkommen normaler Vorgang.
 *
 * Was er bewusst NICHT tut:
 *   - keine Buchhaltung. Kein Kontenrahmen, keine UVA, kein Abschluss.
 *     Gebucht wird beim Steuerberater; Werkboq liefert den Export.
 *   - keine Registrierkasse. Die Registrierkassenpflicht greift ab 15.000 €
 *     Jahresumsatz netto und zugleich 7.500 € Barumsatz netto und verlangt
 *     RKSV-Signatureinheit, Datenerfassungsprotokoll und Zertifizierung.
 *     Das ist ein eigenes Produkt mit eigener Haftung.
 */
export const bausteinVerrechnung: WerkboqModul = {
  id: "verrechnung",
  name: "Verrechnung",
  beschreibung:
    "Angebot, Auftragsbestätigung, Rechnung und Gutschrift mit den Pflichtangaben nach § 11 UStG, Zahlungen, offene Posten und dreistufiges Mahnwesen.",
  art: "baustein",
  version: "0.1.0",
  benoetigtKern: "^0.1.0",
  ergaenzt: ["material", "zeiterfassung"],

  collections: VERRECHNUNG_COLLECTIONS,

  navigation: [
    {
      pfad: "/belege",
      titel: "Belege",
      symbol: "beleg",
      komponente: Belege,
      bereich: "buchhaltung",
    },
    {
      pfad: "/belege/:id",
      titel: "Beleg",
      komponente: BelegAkte,
      bereich: "buchhaltung",
      versteckt: true,
    },
    {
      pfad: "/belege/:id/druck",
      titel: "Beleg drucken",
      komponente: BelegDruck,
      bereich: "buchhaltung",
      versteckt: true,
    },
  ],

  erweiterungen: {
    "auftrag.abschnitt": AuftragBelege,
  },
};

export default bausteinVerrechnung;
