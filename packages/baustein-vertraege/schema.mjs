import { liest, nurAdmin, schreibt } from "@werkboq/core/schema/regeln.mjs";

/**
 * Collections des Bausteins Verträge.
 *
 * Ein Wartungsvertrag ist Büroarbeit: lesen und ändern mit Recht
 * Buchhaltung. Der Monteur sieht den Wartungsauftrag, der daraus entsteht
 * — der ist ein ganz normaler Auftrag im Kern.
 *
 * DIE EINZIGE STELLE für diese Collections. `server/einrichten.mjs` lädt
 * die Datei über server/schema.mjs und legt an bzw. gleicht ab.
 */
const regeln = {
  listRule: liest("buchhaltung"),
  viewRule: liest("buchhaltung"),
  createRule: schreibt("buchhaltung"),
  updateRule: schreibt("buchhaltung"),
  deleteRule: nurAdmin,
};

export default [
  {
    name: "vertraege",
    schema: [
      { name: "nummer", type: "text", required: true, options: { max: 30 } },
      // In welche Richtung: mit einem Kunden (wir leisten, wir verrechnen)
      // oder mit einem Lieferanten (wir zahlen, jemand prüft bei uns die
      // Feuerlöscher). Leer heißt Kunde — so standen alle Verträge vor
      // September 2026 da.
      { name: "richtung", type: "select", options: { maxSelect: 1, values: ["kunde", "lieferant"] } },
      // Nicht mehr Pflicht, seit es eigene Verträge gibt; die Oberfläche
      // verlangt je nach Richtung Kunde oder Lieferanten.
      { name: "kunde", type: "relation", options: { collectionId: "kunden", maxSelect: 1 } },
      { name: "lieferant", type: "relation", options: { collectionId: "lieferanten", maxSelect: 1 } },
      { name: "kategorie", type: "select", options: { maxSelect: 1, values: ["wartung", "pruefung", "leasing", "miete", "versicherung", "software", "kommunikation", "sonstiges"] } },
      // Die Nummer, unter der der Vertragspartner den Vertrag führt (Polizze, Leasingnummer).
      { name: "fremdnummer", type: "text" },
      { name: "standort", type: "relation", options: { collectionId: "standorte", maxSelect: 1 } },
      { name: "titel", type: "text", required: true },
      // Was bei jeder Wartung zu tun ist — landet im Wartungsauftrag.
      { name: "leistungen", type: "text" },
      { name: "status", type: "select", required: true, options: { maxSelect: 1, values: ["aktiv", "gekuendigt", "beendet"] } },
      // Wartung
      // 0 oder leer: kein wiederkehrender Termin (Versicherung, Leasing).
      { name: "intervallMonate", type: "number", options: { min: 0, max: 120, noDecimal: true } },
      { name: "naechsteWartung", type: "date" },
      { name: "vorlaufTage", type: "number", options: { min: 0, max: 365, noDecimal: true } },
      // Verrechnung
      // Bei Kundenverträgen Pflicht (verlangt die Oberfläche); bei eigenen
      // Verträgen bedeutungslos.
      { name: "verrechnung", type: "select", options: { maxSelect: 1, values: ["pauschale", "aufwand"] } },
      // Netto in Cent, je Rhythmus. Null ist erlaubt (kein required) — ein
      // Vertrag ohne Pauschale ist ein Aufwandsvertrag. Bei eigenen
      // Verträgen: was WIR zahlen.
      { name: "pauschale", type: "number", options: { min: 0, noDecimal: true } },
      { name: "rhythmus", type: "select", options: { maxSelect: 1, values: ["monat", "quartal", "halbjahr", "jahr"] } },
      { name: "naechsteRechnung", type: "date" },
      { name: "preisStand", type: "date" },
      // Laufzeit
      { name: "beginn", type: "date", required: true },
      { name: "laufzeitMonate", type: "number", options: { min: 0, noDecimal: true } },
      { name: "verlaengerungMonate", type: "number", options: { min: 0, noDecimal: true } },
      { name: "kuendigungsfristMonate", type: "number", options: { min: 0, noDecimal: true } },
      { name: "gekuendigtZum", type: "date" },
      { name: "notiz", type: "text" },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_vertraege_nummer ON vertraege (nummer)",
      "CREATE INDEX idx_vertraege_kunde ON vertraege (kunde)",
      "CREATE INDEX idx_vertraege_lieferant ON vertraege (lieferant)",
    ],
    ...regeln,
  },
  {
    // Was aus einem Vertrag entstand: Wartungsaufträge und Pauschalrechnungen.
    // Eigene Tabelle statt eines Felds am Auftrag — der Auftrag gehört dem
    // Kern, und der Kern kennt keine Verträge.
    name: "vertragsereignisse",
    schema: [
      { name: "vertrag", type: "relation", required: true, options: { collectionId: "vertraege", maxSelect: 1, cascadeDelete: true } },
      { name: "art", type: "select", required: true, options: { maxSelect: 1, values: ["wartung", "rechnung", "kuendigung", "preis", "termin"] } },
      { name: "faellig", type: "date" },
      { name: "auftrag", type: "relation", options: { collectionId: "auftraege", maxSelect: 1 } },
      // Kennung des Belegs aus der Verrechnung — als Text, weil der Baustein
      // Verträge die Verrechnung nicht kennen darf.
      { name: "beleg", type: "text", options: { max: 30 } },
      { name: "text", type: "text" },
    ],
    indexes: ["CREATE INDEX idx_vertragsereignisse_vertrag ON vertragsereignisse (vertrag, faellig)"],
    ...regeln,
    updateRule: null,
  },
];
