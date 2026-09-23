import { angemeldet, nurAdmin, schreibt } from "@werkboq/core/schema/regeln.mjs";

/**
 * Collections des Bausteins Material.
 *
 * Geldbeträge stehen durchgehend als Cent in ganzen Zahlen (`noDecimal`).
 * Fließkomma und Geld vertragen sich nicht: 0.1 + 0.2 ergibt in JavaScript
 * nicht 0.3, und auf einer Rechnung mit dreißig Zeilen wird daraus ein Cent
 * Differenz zwischen Summe und Einzelwerten.
 *
 * DIE EINZIGE STELLE für diese Collections. `server/einrichten.mjs` lädt
 * die Datei über server/schema.mjs und legt an bzw. gleicht ab.
 * Verknüpfungen dürfen nur auf Collections zeigen, die dort vorher stehen.
 */
export default [
  {
    // Leistungs- und Materialkatalog. Preise als Cent in ganzen Zahlen:
    // Fließkomma und Geld vertragen sich nicht.
    name: "artikel",
    schema: [
      { name: "nummer", type: "text", required: true, options: { max: 20 } },
      { name: "bezeichnung", type: "text", required: true },
      { name: "art", type: "select", required: true, options: { maxSelect: 1, values: ["leistung", "material", "fremdleistung", "sonstiges"] } },
      { name: "einheit", type: "text", required: true, options: { max: 12 } },
      { name: "preis", type: "number", options: { min: 0, noDecimal: true } },
      { name: "einkauf", type: "number", options: { min: 0, noDecimal: true } },
      // Nachkommastellen erlaubt: die Schweiz kennt 8,1 %.
      { name: "ustsatz", type: "number", options: { min: 0, max: 100 } },
      { name: "beschreibung", type: "text" },
      { name: "aktiv", type: "bool" },
      // EAN/GTIN für den Scanner. Keine Pflicht und bewusst nicht
      // eindeutig: derselbe Strichcode klebt manchmal auf zwei Artikeln,
      // und ein eindeutiger Index würde dann das Anlegen verweigern statt
      // zu helfen. Die Suche zeigt in dem Fall beide zur Auswahl.
      { name: "ean", type: "text", options: { max: 20 } },
      // Schnellauswahl für die Baustelle — betriebsweit, nicht je Person.
      { name: "favorit", type: "bool" },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_artikel_nummer ON artikel (nummer)",
      "CREATE INDEX idx_artikel_aktiv ON artikel (aktiv)",
      "CREATE INDEX idx_artikel_ean ON artikel (ean)",
      "CREATE INDEX idx_artikel_favorit ON artikel (favorit)",
    ],
    // Den Katalog liest jeder — der Monteur sucht darin, was er verbaut.
    // Anlegen und Preise ändern nur mit Lagerrecht. Den Einkaufspreis
    // bekommt ohne Lager- oder Buchhaltungsrecht niemand zu sehen; das
    // kann keine Regel (sie gilt je Datensatz), das macht der Hook
    // server/pb_hooks/artikel.pb.js.
    listRule: angemeldet,
    viewRule: angemeldet,
    createRule: schreibt("lager"),
    updateRule: schreibt("lager"),
    deleteRule: nurAdmin,
  },
  {
    // Positionen am Auftrag. Preis und Steuersatz werden beim Einfügen aus
    // dem Katalog KOPIERT, nicht verknüpft — ein späterer Preiswechsel darf
    // einen halbfertigen Auftrag nicht rückwirkend verteuern.
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
      { name: "einzelpreis", type: "number", options: { noDecimal: true } },
      { name: "rabatt", type: "number", options: { min: 0, max: 100 } },
      // Nachkommastellen erlaubt: die Schweiz kennt 8,1 %.
      { name: "ustsatz", type: "number", options: { min: 0, max: 100 } },
      { name: "verrechnet", type: "bool" },
      // Vom Monteur erfasst und noch ungeprüft, oder vom Büro freigegeben.
      // LEER BEDEUTET FREIGEGEBEN: Positionen, die es vor dieser
      // Unterscheidung gab, ändern ihre Bedeutung nicht, und was das Büro
      // selbst eintippt, braucht keine Freigabe von sich selbst.
      { name: "zustand", type: "select", options: { maxSelect: 1, values: ["vorschlag", "freigegeben"] } },
      { name: "erfasstVon", type: "relation", options: { collectionId: "mitarbeiter", maxSelect: 1 } },
      { name: "freigabeVon", type: "relation", options: { collectionId: "users", maxSelect: 1 } },
      { name: "freigabeAm", type: "date" },
    ],
    indexes: [
      "CREATE INDEX idx_positionen_auftrag ON positionen (auftrag, pos)",
      "CREATE INDEX idx_positionen_zustand ON positionen (zustand)",
    ],
    // FREIGEBEN DARF NUR, WER LAGER SCHREIBEN DARF — und zwar wirklich,
    // nicht bloß in der Oberfläche ausgeblendet. Gegen die API geprüft.
    //
    // PocketBase kennt keine Regeln je Feld, wohl aber `@request.data`
    // (was hereinkommt) und den Feldnamen allein (was gespeichert ist).
    // Daraus lässt sich die Freigabe einzeln absichern:
    //
    //   ANLEGEN: wer kein Lagerrecht hat, darf nur Vorschläge anlegen.
    //   Ausdrücklich `= "vorschlag"` und nicht `!= "freigegeben"` — sonst
    //   legt man die Position einfach ganz ohne Zustandsfeld an, und weil
    //   leer als freigegeben gilt, wäre die Freigabe umgangen.
    //
    //   ÄNDERN: an einer Position, die ein Vorschlag IST, darf ohne
    //   Lagerrecht nur ändern, wer sie einen Vorschlag bleiben lässt. Das
    //   sperrt beides: das Setzen auf "freigegeben" und das Leerräumen
    //   des Feldes, was auf dasselbe hinausliefe.
    //
    //   Und seit September 2026 auch: eine FREIGEGEBENE Position ändert
    //   und löscht nur, wer Lagerrecht hat. Vorher durfte das jeder
    //   Angemeldete — Menge und Preis einer Zeile, die gleich auf eine
    //   Rechnung geht. Ein Vorschlag dagegen darf ohne Lagerrecht
    //   gelöscht werden (der Monteur nimmt einen Irrtum zurück).
    listRule: angemeldet,
    viewRule: angemeldet,
    createRule: `${angemeldet} && (@request.data.zustand = "vorschlag" || ${schreibt("lager")})`,
    updateRule:
      `${angemeldet} && ((zustand = "vorschlag" && @request.data.zustand = "vorschlag") || ${schreibt("lager")})`,
    deleteRule: `${angemeldet} && (zustand = "vorschlag" || ${schreibt("lager")})`,
  },
];
