import { dienstAnbieten, pb, type WerkboqModul } from "@werkboq/core";
import { Belege } from "./seiten/Belege";
import { BelegAkte } from "./seiten/BelegAkte";
import { BelegDruck } from "./seiten/BelegDruck";
import { AuftragBelege, BelegKachel } from "./erweiterungen/AuftragBelege";
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
 *   - keine Registrierkasse. In Österreich verlangt die RKSV Signatureinheit,
 *     Datenerfassungsprotokoll und Zertifizierung, in Deutschland die
 *     KassenSichV eine zertifizierte technische Sicherheitseinrichtung. Das
 *     ist ein eigenes Produkt mit eigener Haftung.
 */
export const bausteinVerrechnung: WerkboqModul = {
  id: "verrechnung",
  name: "Verrechnung",
  beschreibung:
    "Angebot, Auftragsbestätigung, Rechnung und Gutschrift mit den Pflichtangaben des jeweiligen Landes, Zahlungen, offene Posten und dreistufiges Mahnwesen.",
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
    "auftrag.abrechnung": AuftragBelege,
    "auftrag.kachel": BelegKachel,
  },

  async initialisieren() {
    // Sobald ein Beleg festgeschrieben ist, trägt er Steuersatz, Währung und
    // Pflichthinweis eines bestimmten Rechts. Ab da darf das Land nicht mehr
    // umgestellt werden — sonst stünden alte Rechnungen mit falscher
    // Grundlage da, und niemand würde es merken.
    dienstAnbieten("rechtsraumSperre", async () => {
      try {
        const treffer = await pb()
          .collection("belege")
          .getList(1, 1, { filter: 'festgeschrieben != ""', fields: "id" });
        return treffer.totalItems > 0
          ? {
              gesperrt: true,
              grund:
                "Es gibt bereits festgeschriebene Belege. Sie tragen Steuersätze und " +
                "Pflichtangaben dieses Landes — ein Wechsel würde sie rückwirkend falsch machen.",
            }
          : { gesperrt: false, grund: "" };
      } catch {
        // Lieber sperren als raten: wer nicht nachsehen kann, weiß es nicht.
        return {
          gesperrt: true,
          grund: "Die Belege lassen sich gerade nicht prüfen — das Land bleibt vorsichtshalber gesperrt.",
        };
      }
    });
  },
};

export default bausteinVerrechnung;
