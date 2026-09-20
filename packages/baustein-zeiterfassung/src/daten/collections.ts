import type { ModulCollection } from "@werkboq/core";

/**
 * Collections der Zeiterfassung.
 *
 * Eine einzige Collection für beides: ein Eintrag ohne `auftrag` ist
 * allgemeine Arbeitszeit, einer mit `auftrag` ist gebuchte Zeit. Dieselbe
 * Stunde zählt damit nie doppelt.
 *
 * `benutzer` ist der Erfasser, `mitarbeiter` derjenige, der gearbeitet hat.
 * Meist dieselbe Person, aber das Büro bucht auch für Monteure ohne Zugang.
 */
export const ZEITERFASSUNG_COLLECTIONS: ModulCollection[] = [
  {
    name: "zeiten",
    schema: [
      { name: "benutzer", type: "relation", required: true, options: { collectionId: "users", maxSelect: 1 } },
      { name: "benutzername", type: "text", required: true },
      { name: "mitarbeiter", type: "relation", options: { collectionId: "mitarbeiter", maxSelect: 1 } },
      { name: "datum", type: "date", required: true },
      { name: "beginn", type: "text", required: true, options: { max: 5 } },
      { name: "ende", type: "text", options: { max: 5 } },
      { name: "pause", type: "number", options: { min: 0, noDecimal: true } },
      { name: "auftrag", type: "relation", options: { collectionId: "auftraege", maxSelect: 1 } },
      { name: "art", type: "select", required: true, options: { maxSelect: 1, values: ["arbeit", "fahrt", "urlaub", "zeitausgleich", "krankenstand", "feiertag"] } },
      { name: "taetigkeit", type: "text" },
      { name: "verrechenbar", type: "bool" },
    ],
    indexes: [
      "CREATE INDEX idx_zeiten_benutzer_datum ON zeiten (benutzer, datum)",
      "CREATE INDEX idx_zeiten_auftrag ON zeiten (auftrag)",
    ],
  },
];
