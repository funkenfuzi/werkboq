import type { WerkboqModul } from "@werkboq/core";
import { PruefberichteSeite } from "./seiten/Pruefberichte";

/**
 * Modul Elektro – erster Konsument der Modulschnittstelle.
 * Alles, was hier fachlich passiert, darf den Kern nicht kennen müssen
 * über das hinaus, was "@werkboq/core" exportiert.
 */
export const modulElektro: WerkboqModul = {
  id: "elektro",
  name: "Elektro",
  beschreibung:
    "Prüfberichte nach OVE E 8101, Anlagendokumentation und elektrotechnische Auftragsdaten.",
  art: "fachmodul",
  version: "0.1.0",
  benoetigtKern: "^0.1.0",


  navigation: [
    {
      pfad: "/elektro/pruefberichte",
      titel: "Prüfberichte",
      symbol: "pruefung",
      komponente: PruefberichteSeite,
      bereich: "elektro",
    },
  ],

  // Der Block in der Auftragsakte ist noch ein Platzhalter und deshalb nicht
  // angemeldet: ein Kasten, in dem "folgt in der nächsten Scheibe" steht,
  // gehört nicht in jede Akte. Kommt mit Scheibe 5 zurück.
  // erweiterungen: { "auftrag.abschnitt": AuftragElektroReiter },

  initialisieren: () => {
    // Platz für Offline-Handler, Voreinstellungen usw.
  },
};

export default modulElektro;
