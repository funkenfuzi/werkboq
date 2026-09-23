/**
 * Collections der Zeiterfassung.
 *
 * Eine einzige Collection für beides: ein Eintrag ohne `auftrag` ist
 * allgemeine Arbeitszeit, einer mit `auftrag` ist gebuchte Zeit. Dieselbe
 * Stunde zählt damit nie doppelt.
 *
 * `benutzer` ist der Erfasser, `mitarbeiter` derjenige, der gearbeitet hat.
 * Meist dieselbe Person, aber das Büro bucht auch für Monteure ohne Zugang.
 *
 * DIE EINZIGE STELLE für diese Collections. `server/einrichten.mjs` lädt
 * die Datei über server/schema.mjs und legt an bzw. gleicht ab.
 * Verknüpfungen dürfen nur auf Collections zeigen, die dort vorher stehen.
 */
export default [
  {
    // Zeiten. Ein Eintrag ohne Auftrag ist allgemeine Arbeitszeit, einer mit
    // Auftrag ist auf den Auftrag gebuchte Zeit — dieselbe Stunde zählt also
    // nie doppelt. Beginn und Ende als "HH:MM", weil Handwerker so denken und
    // schreiben; die Dauer rechnet die Anwendung daraus.
    //
    // Arbeitszeitaufzeichnungen nach § 26 AZG verlangen Beginn, Ende und
    // Pausen und sind ein Jahr aufzubewahren (Fahrzeuglenker zwei Jahre).
    // Deshalb ist auch hier Ändern erlaubt, Löschen aber nur für Admins.
    name: "zeiten",
    schema: [
      { name: "benutzer", type: "relation", required: true, options: { collectionId: "users", maxSelect: 1 } },
      { name: "benutzername", type: "text", required: true },
      // Wer gearbeitet hat. Meist derselbe wie der Erfasser, aber das Büro
      // bucht auch für Monteure ohne Zugang.
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
  {
    // Fahrten zu einem Auftrag. Das Fahrzeug steht als Kennung und als
    // Kennzeichen da, nicht als Verknüpfung: die Zeiterfassung darf den
    // Fuhrpark nicht kennen, und ohne ihn soll die Fahrt lesbar bleiben.
    // Regeln wie bei den Zeiten: der Monteur erfasst seine eigenen.
    name: "fahrten",
    schema: [
      { name: "auftrag", type: "relation", required: true, options: { collectionId: "auftraege", maxSelect: 1, cascadeDelete: true } },
      { name: "mitarbeiter", type: "relation", options: { collectionId: "mitarbeiter", maxSelect: 1 } },
      { name: "datum", type: "date", required: true },
      { name: "kmEinfach", type: "number", required: true, options: { min: 1, noDecimal: true } },
      { name: "hinRetour", type: "bool" },
      { name: "fahrzeug", type: "text" },
      { name: "kennzeichen", type: "text", options: { max: 20 } },
      { name: "notiz", type: "text" },
    ],
    indexes: ["CREATE INDEX idx_fahrten_auftrag ON fahrten (auftrag, datum)"],
  },
];
