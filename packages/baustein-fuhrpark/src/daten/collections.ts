import type { ModulCollection } from "@werkboq/core";

/**
 * Collections des Bausteins Fuhrpark.
 *
 * Zwei Tabellen, nicht eine: an einem Fahrzeug hängen mehrere Termine
 * gleichzeitig, und erledigte bleiben stehen. Als Felder am Fahrzeug wäre
 * jede neue Fristart eine Schemaänderung.
 */
export const FUHRPARK_COLLECTIONS: ModulCollection[] = [
  {
    name: "fahrzeuge",
    schema: [
      { name: "kennzeichen", type: "text", required: true, options: { max: 20 } },
      { name: "bezeichnung", type: "text", required: true },
      { name: "art", type: "select", required: true, options: { maxSelect: 1, values: ["pkw", "kastenwagen", "lkw", "anhaenger", "maschine"] } },
      { name: "marke", type: "text" },
      { name: "modell", type: "text" },
      { name: "erstzulassung", type: "date" },
      // Poolfahrzeuge haben keinen festen Fahrer — deshalb nicht Pflicht.
      { name: "mitarbeiter", type: "relation", options: { collectionId: "mitarbeiter", maxSelect: 1 } },
      { name: "kmStand", type: "number", options: { min: 0, noDecimal: true } },
      // Ein Kilometerstand ohne Datum ist wertlos: man weiß nicht, ob er
      // von gestern ist oder von vorletztem Jahr.
      { name: "kmStandAm", type: "date" },
      { name: "notiz", type: "text" },
      { name: "aktiv", type: "bool" },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_fahrzeuge_kennzeichen ON fahrzeuge (kennzeichen)",
      "CREATE INDEX idx_fahrzeuge_aktiv ON fahrzeuge (aktiv)",
    ],
  },
  {
    name: "fahrzeugfristen",
    schema: [
      { name: "fahrzeug", type: "relation", required: true, options: { collectionId: "fahrzeuge", maxSelect: 1, cascadeDelete: true } },
      { name: "art", type: "select", required: true, options: { maxSelect: 1, values: ["begutachtung", "service", "reifen", "versicherung", "leasing", "pruefung", "sonstiges"] } },
      { name: "titel", type: "text" },
      { name: "faellig", type: "date" },
      // Ein Service ist fällig "in zwölf Monaten oder nach 30.000 km, je
      // nachdem was zuerst eintritt" — deshalb beides.
      { name: "kmFaellig", type: "number", options: { min: 0, noDecimal: true } },
      { name: "erinnerungTage", type: "number", options: { min: 0, noDecimal: true } },
      { name: "intervallMonate", type: "number", options: { min: 0, noDecimal: true } },
      { name: "intervallKm", type: "number", options: { min: 0, noDecimal: true } },
      { name: "erledigtAm", type: "date" },
      { name: "erledigtKm", type: "number", options: { min: 0, noDecimal: true } },
      { name: "notiz", type: "text" },
      { name: "datei", type: "file", options: { maxSelect: 1, maxSize: 20971520 } },
    ],
    indexes: [
      "CREATE INDEX idx_fahrzeugfristen_fahrzeug ON fahrzeugfristen (fahrzeug, faellig)",
      "CREATE INDEX idx_fahrzeugfristen_offen ON fahrzeugfristen (erledigtAm, faellig)",
    ],
  },
];
