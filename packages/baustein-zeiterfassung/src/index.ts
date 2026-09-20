import { dienstAnbieten, type WerkboqModul } from "@werkboq/core";
import { Zeiten } from "./seiten/Zeiten";
import { AuftragZeiten } from "./erweiterungen/AuftragZeiten";
import { ZEITERFASSUNG_COLLECTIONS } from "./daten/collections";
import { dauer, summe, zeitenVonBisAlle, zeitenZuAuftrag } from "./daten/zeiten";

export * from "./daten/zeiten";
export { Zeitmaske } from "./erweiterungen/Zeitmaske";

/**
 * Baustein Zeiterfassung.
 *
 * Einzeln verkaufbar: eine Arbeitszeitaufzeichnung nach § 26 AZG braucht
 * jeder Betrieb, auch einer, der seine Aufträge woanders führt. Der Auftrag
 * an einem Eintrag ist deshalb optional — ohne ihn ist es allgemeine
 * Arbeitszeit.
 *
 * Was dieser Baustein anderen anbietet:
 *   tagesstunden    — gebuchte Minuten je Mitarbeiter und Tag. Die Planung
 *                     stellt damit geplant und gebucht nebeneinander.
 *   auftragsstunden — gebuchte Minuten auf einem Auftrag. Später rechnet die
 *                     Verrechnung damit.
 * Beide über die Dienstschnittstelle des Kerns: wer sie nutzt, muss diesen
 * Baustein nicht kennen, und ohne ihn fehlt die Zahl, sonst nichts.
 */
export const bausteinZeiterfassung: WerkboqModul = {
  id: "zeiterfassung",
  name: "Zeiterfassung",
  beschreibung:
    "Arbeitszeit und auftragsbezogene Stunden. Wochenansicht je Mitarbeiter, Buchung direkt am Auftrag, Warnung ab zehn Stunden am Tag.",
  art: "baustein",
  version: "0.1.0",
  benoetigtKern: "^0.1.0",

  collections: ZEITERFASSUNG_COLLECTIONS,

  navigation: [
    {
      pfad: "/zeiten",
      titel: "Meine Zeiten",
      symbol: "uhr",
      komponente: Zeiten,
    },
  ],

  erweiterungen: {
    "auftrag.abschnitt": AuftragZeiten,
  },

  initialisieren: () => {
    dienstAnbieten("tagesstunden", async (von, bis) => {
      const zeiten = await zeitenVonBisAlle(von, bis);
      const karte: Record<string, number> = {};
      for (const z of zeiten) {
        if (!z.mitarbeiter) continue;
        const schluessel = `${z.mitarbeiter}|${z.datum.slice(0, 10)}`;
        karte[schluessel] = (karte[schluessel] ?? 0) + dauer(z);
      }
      return karte;
    });

    dienstAnbieten("auftragsstunden", async (auftragId) => {
      const zeiten = await zeitenZuAuftrag(auftragId);
      return {
        gesamt: summe(zeiten),
        verrechenbar: summe(zeiten.filter((z) => z.verrechenbar)),
      };
    });
  },
};

export default bausteinZeiterfassung;
