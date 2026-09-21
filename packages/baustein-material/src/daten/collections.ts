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
      // Nachkommastellen erlaubt: die Schweiz kennt 8,1 %.
      { name: "ustsatz", type: "number", required: true, options: { min: 0, max: 100 } },
      { name: "beschreibung", type: "text" },
      { name: "aktiv", type: "bool" },
      // EAN/GTIN für den Scanner. Keine Pflicht und nicht eindeutig:
      // derselbe Strichcode klebt manchmal auf zwei Artikeln, und ein
      // eindeutiger Index würde dann das Anlegen verweigern statt zu
      // helfen. Die Suche zeigt in dem Fall beide zur Auswahl.
      { name: "ean", type: "text", options: { max: 20 } },
      // Schnellauswahl für die Baustelle — betriebsweit, nicht je Person.
      // Was ein Elektriker ständig braucht, braucht der nächste auch.
      { name: "favorit", type: "bool" },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_artikel_nummer ON artikel (nummer)",
      "CREATE INDEX idx_artikel_aktiv ON artikel (aktiv)",
      "CREATE INDEX idx_artikel_ean ON artikel (ean)",
      "CREATE INDEX idx_artikel_favorit ON artikel (favorit)",
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
      // Nachkommastellen erlaubt: die Schweiz kennt 8,1 %.
      { name: "ustsatz", type: "number", required: true, options: { min: 0, max: 100 } },
      { name: "verrechnet", type: "bool" },
      // Vom Monteur erfasst und noch nicht geprüft, oder vom Büro
      // freigegeben. Leer bedeutet freigegeben: Positionen, die es vor
      // dieser Unterscheidung gab, ändern ihre Bedeutung nicht.
      { name: "zustand", type: "select", options: { maxSelect: 1, values: ["vorschlag", "freigegeben"] } },
      { name: "erfasstVon", type: "relation", options: { collectionId: "mitarbeiter", maxSelect: 1 } },
      { name: "freigabeVon", type: "relation", options: { collectionId: "users", maxSelect: 1 } },
      { name: "freigabeAm", type: "date" },
    ],
    indexes: [
      "CREATE INDEX idx_positionen_auftrag ON positionen (auftrag, pos)",
      "CREATE INDEX idx_positionen_zustand ON positionen (zustand)",
    ],
  },
];
