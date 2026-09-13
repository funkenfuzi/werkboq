import type { ModulCollection } from "@werkboq/core";

/**
 * Zusätzliche Collections des Moduls Elektro.
 * Werden von server/einrichten.mjs zusammen mit den Kern-Collections angelegt.
 */
export const ELEKTRO_COLLECTIONS: ModulCollection[] = [
  {
    name: "elektro_pruefberichte",
    schema: [
      { name: "auftrag", type: "relation", required: true, options: { collectionId: "auftraege", maxSelect: 1 } },
      { name: "art", type: "select", required: true, options: { maxSelect: 1, values: ["erstpruefung", "wiederkehrend", "aenderung"] } },
      { name: "norm", type: "text", options: { max: 60 } },
      { name: "pruefdatum", type: "date" },
      { name: "pruefer", type: "text" },
      { name: "ergebnis", type: "select", options: { maxSelect: 1, values: ["offen", "ohne_maengel", "mit_maengeln", "gefahr"] } },
      { name: "daten", type: "json" },
      { name: "pdf", type: "file", options: { maxSelect: 1, maxSize: 20971520, mimeTypes: ["application/pdf"] } },
    ],
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.admin = true",
  },
];

export interface Pruefbericht {
  id: string;
  auftrag: string;
  art: "erstpruefung" | "wiederkehrend" | "aenderung";
  norm?: string;
  pruefdatum?: string;
  pruefer?: string;
  ergebnis?: "offen" | "ohne_maengel" | "mit_maengeln" | "gefahr";
  daten?: Record<string, unknown>;
  pdf?: string;
}
