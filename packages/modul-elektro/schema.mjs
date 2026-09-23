/**
 * Zusätzliche Collections des Moduls Elektro.
 *
 * DIE EINZIGE STELLE für diese Collections. `server/einrichten.mjs` lädt
 * die Datei über server/schema.mjs und legt an bzw. gleicht ab.
 * Verknüpfungen dürfen nur auf Collections zeigen, die dort vorher stehen.
 */
export default [
  {
    name: "elektro_pruefberichte",
    schema: [
      { name: "auftrag", type: "relation", required: true, options: { collectionId: "auftraege", maxSelect: 1 } },
      { name: "art", type: "select", required: true, options: { maxSelect: 1, values: ["erstpruefung", "wiederkehrend", "aenderung"] } },
      { name: "norm", type: "text", options: { max: 60 } },
      { name: "pruefdatum", type: "date" },
      { name: "pruefer", type: "text" },
      { name: "ergebnis", type: "select", options: { maxSelect: 1, values: ["offen", "ohne_maengel", "mit_maengeln", "gefahr"] } },
      { name: "daten", type: "json", options: { maxSize: 2000000 } },
      { name: "pdf", type: "file", options: { maxSelect: 1, maxSize: 20971520, mimeTypes: ["application/pdf"] } },
    ],
  },
];
