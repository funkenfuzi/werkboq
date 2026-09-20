import type { ModulCollection } from "@werkboq/core";

/**
 * Collections der Planung.
 *
 * Ein Termin sagt, wer wann wo sein soll. Was daraus wurde, steht in den
 * Zeiten — deshalb ist `auftrag` nicht Pflicht: Urlaub, Schulung und
 * Werkstatttage sind innerbetrieblich und hängen an keinem Auftrag.
 */
export const PLANUNG_COLLECTIONS: ModulCollection[] = [
  {
    name: "termine",
    schema: [
      { name: "auftrag", type: "relation", options: { collectionId: "auftraege", maxSelect: 1, cascadeDelete: true } },
      { name: "mitarbeiter", type: "relation", options: { collectionId: "mitarbeiter", maxSelect: 20 } },
      { name: "titel", type: "text", required: true },
      { name: "datum", type: "date", required: true },
      { name: "beginn", type: "text", options: { max: 5 } },
      { name: "ende", type: "text", options: { max: 5 } },
      { name: "ganztags", type: "bool" },
      { name: "art", type: "select", options: { maxSelect: 1, values: ["baustelle", "kundentermin", "werkstatt", "urlaub", "schulung", "sonstiges"] } },
      { name: "ort", type: "text" },
      { name: "notizen", type: "text" },
    ],
    indexes: ["CREATE INDEX idx_termine_datum ON termine (datum)"],
  },
];
