/** Ein Prüfbericht, wie er in `elektro_pruefberichte` steht (Schema: ../../schema.mjs). */
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
