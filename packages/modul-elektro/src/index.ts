import type { WerkboqModul } from "@werkboq/core";
import { PruefberichteSeite } from "./seiten/Pruefberichte";
import { AuftragElektroReiter } from "./erweiterungen/AuftragElektroReiter";
import { ELEKTRO_COLLECTIONS } from "./daten/collections";

/**
 * Modul Elektro – erster Konsument der Modulschnittstelle.
 * Alles, was hier fachlich passiert, darf den Kern nicht kennen müssen
 * über das hinaus, was "@werkboq/core" exportiert.
 */
export const modulElektro: WerkboqModul = {
  id: "elektro",
  name: "Elektro",
  version: "0.1.0",
  benoetigtKern: "^0.1.0",

  collections: ELEKTRO_COLLECTIONS,

  navigation: [
    {
      pfad: "/elektro/pruefberichte",
      titel: "Prüfberichte",
      symbol: "pruefung",
      komponente: PruefberichteSeite,
      bereich: "elektro",
    },
  ],

  erweiterungen: {
    "auftrag.reiter": AuftragElektroReiter,
  },

  initialisieren: () => {
    // Platz für Offline-Handler, Voreinstellungen usw.
  },
};

export default modulElektro;
