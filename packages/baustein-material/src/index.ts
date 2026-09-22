import { dienstAnbieten, type WerkboqModul } from "@werkboq/core";
import { Katalog } from "./seiten/Katalog";
import { AuftragPositionen, MaterialImAuftrag, MaterialKacheln } from "./erweiterungen/AuftragPositionen";
import { MATERIAL_COLLECTIONS } from "./daten/collections";
import { nurFreigegebene, positionenZuAuftrag, positionswert, summieren } from "./daten/positionen";

export * from "./daten/artikel";
export * from "./daten/positionen";
export * from "./daten/schnellwahl";

/**
 * Baustein Material.
 *
 * Leistungs- und Materialkatalog, Positionen am Auftrag. Was verbaut und
 * geleistet wurde — die eine Hälfte dessen, was später auf der Rechnung
 * steht; die andere sind die Stunden aus der Zeiterfassung. Beide bleiben
 * getrennt, sonst wird dieselbe Arbeit irgendwann zweimal verrechnet.
 *
 * Bewusst kein Lager: Bestände zu führen wäre ein eigener Baustein und für
 * die meisten Elektrobetriebe Aufwand ohne Ertrag — der Kleinkram kommt vom
 * Großhändler direkt auf die Baustelle.
 *
 * Was dieser Baustein anbietet:
 *   auftragspositionen — die Positionen eines Auftrags mit Summen. Die
 *                        Verrechnung übernimmt sie damit in einen Beleg,
 *                        ohne diesen Baustein zu kennen.
 */
export const bausteinMaterial: WerkboqModul = {
  id: "material",
  name: "Material und Positionen",
  beschreibung:
    "Leistungs- und Materialkatalog mit Preisen, Positionen am Auftrag mit Menge, Rabatt und Steuersatz, Summen je Steuersatz.",
  art: "baustein",
  version: "0.1.0",
  benoetigtKern: "^0.1.0",

  collections: MATERIAL_COLLECTIONS,

  navigation: [
    {
      pfad: "/katalog",
      titel: "Katalog",
      symbol: "katalog",
      komponente: Katalog,
      bereich: "lager",
    },
  ],

  erweiterungen: {
    "auftrag.arbeit": MaterialImAuftrag,
    "auftrag.abrechnung": AuftragPositionen,
    "auftrag.kachel": MaterialKacheln,
  },

  initialisieren: () => {
    dienstAnbieten("auftragspositionen", async (auftragId) => {
      const alle = await positionenZuAuftrag(auftragId);
      // Nur Freigegebenes darf auf einen Beleg. Die Zahl der offenen
      // Vorschläge geht trotzdem mit, damit die Verrechnung warnen kann,
      // statt sie stillschweigend zu unterschlagen.
      const positionen = nurFreigegebene(alle);
      const offeneVorschlaege = alle.length - positionen.length;
      const summen = summieren(positionen);
      return {
        offeneVorschlaege,
        positionen: positionen.map((p) => ({
          pos: p.pos,
          art: p.art,
          bezeichnung: p.bezeichnung,
          beschreibung: p.beschreibung ?? "",
          menge: p.menge,
          einheit: p.einheit,
          einzelpreis: p.einzelpreis,
          rabatt: p.rabatt ?? 0,
          ustsatz: p.ustsatz,
          betrag: positionswert(p),
          quelle: p.id,
        })),
        netto: summen.netto,
        ust: summen.ust,
        brutto: summen.brutto,
      };
    });
  },
};

export default bausteinMaterial;
