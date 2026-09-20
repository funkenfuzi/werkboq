import type { ModulCollection } from "@werkboq/core";

/**
 * Collections des Bausteins Material.
 *
 * Geldbeträge stehen durchgehend als Cent in ganzen Zahlen (`noDecimal`).
 * Fließkomma und Geld vertragen sich nicht: 0.1 + 0.2 ergibt in JavaScript
 * nicht 0.3, und auf einer Rechnung mit dreißig Zeilen wird daraus ein Cent
 * Differenz zwischen Summe und Einzelwerten.
 */
export const MATERIAL_COLLECTIONS: ModulCollection[] = [
  {
    name: "artikel",
    schema: [
      { name: "nummer", type: "text", required: true, options: { max: 20 } },
      { name: "bezeichnung", type: "text", required: true },
      { name: "art", type: "select", required: true, options: { maxSelect: 1, values: ["leistung", "material", "fremdleistung", "sonstiges"] } },
      { name: "einheit", type: "text", required: true, options: { max: 12 } },
      { name: "preis", type: "number", required: true, options: { min: 0, noDecimal: true } },
      { name: "einkauf", type: "number", options: { min: 0, noDecimal: true } },
      { name: "ustsatz", type: "number", required: true, options: { min: 0, max: 100, noDecimal: true } },
      { name: "beschreibung", type: "text" },
      { name: "aktiv", type: "bool" },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_artikel_nummer ON artikel (nummer)",
      "CREATE INDEX idx_artikel_aktiv ON artikel (aktiv)",
    ],
  },
  {
    name: "positionen",
    schema: [
      { name: "auftrag", type: "relation", required: true, options: { collectionId: "auftraege", maxSelect: 1, cascadeDelete: true } },
      { name: "pos", type: "number", required: true, options: { min: 0, noDecimal: true } },
      { name: "artikel", type: "relation", options: { collectionId: "artikel", maxSelect: 1 } },
      { name: "art", type: "select", required: true, options: { maxSelect: 1, values: ["leistung", "material", "fremdleistung", "sonstiges"] } },
      { name: "bezeichnung", type: "text", required: true },
      { name: "beschreibung", type: "text" },
      { name: "menge", type: "number", required: true },
      { name: "einheit", type: "text", required: true, options: { max: 12 } },
      { name: "einzelpreis", type: "number", required: true, options: { noDecimal: true } },
      { name: "rabatt", type: "number", options: { min: 0, max: 100 } },
      { name: "ustsatz", type: "number", required: true, options: { min: 0, max: 100, noDecimal: true } },
      { name: "verrechnet", type: "bool" },
    ],
    indexes: ["CREATE INDEX idx_positionen_auftrag ON positionen (auftrag, pos)"],
  },
];
