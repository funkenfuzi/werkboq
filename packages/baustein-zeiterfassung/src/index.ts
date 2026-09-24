import { dienstAnbieten, type WerkboqModul } from "@werkboq/core";
import { Zeiten } from "./seiten/Zeiten";
import { AuftragArbeit, ArbeitKacheln } from "./erweiterungen/AuftragArbeit";
import { dauer, summe, zeitenVonBisAlle, zeitenZuAuftrag } from "./daten/zeiten";
import { fahrtenZuAuftrag, summeKm } from "./daten/fahrten";

export * from "./daten/zeiten";
export * from "./daten/fahrten";
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
 *   auftragsstunden — gebuchte Minuten auf einem Auftrag. Die Verrechnung
 *                     macht daraus eine Zeile.
 *   auftragsfahrten — Fahrten und Kilometer auf einem Auftrag. Die
 *                     Verrechnung macht daraus die Fahrtkosten, so wie der
 *                     Betrieb es eingestellt hat.
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


  navigation: [
    {
      pfad: "/zeiten",
      titel: "Meine Zeiten",
      symbol: "uhr",
      komponente: Zeiten,
      gruppe: "auftraege",
    },
  ],

  erweiterungen: {
    "auftrag.arbeit": AuftragArbeit,
    "auftrag.kachel": ArbeitKacheln,
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

    dienstAnbieten("auftragsfahrten", async (auftragId) => {
      const fahrten = await fahrtenZuAuftrag(auftragId);
      return { fahrten: fahrten.length, km: summeKm(fahrten) };
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
