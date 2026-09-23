import { nurAdmin, schreibt, liest, bereichsregeln } from "@werkboq/core/schema/regeln.mjs";

/**
 * Collections des Bausteins Personalwesen.
 *
 * DREI TABELLEN, NICHT EINE — UND DER GRUND IST NICHT ORDNUNGSLIEBE.
 *
 * PocketBase kennt Zugriffsregeln je Datensatz, nicht je Feld. Stünde die
 * Sozialversicherungsnummer am Mitarbeiterdatensatz, käme sie bei jedem
 * Zugriff mit, den die Planung, der Auftrag oder die Zeiterfassung ohnehin
 * machen. Darum liegen die heiklen Angaben in einer eigenen Tabelle mit
 * eigener Regel.
 *
 * Der Mitarbeiterdatensatz selbst bleibt im Kern. Aufträge, Zeiten und
 * Termine verweisen darauf; wer kein Personalwesen gekauft hat, muss
 * trotzdem jemanden einplanen können.
 *
 * an der die Datenbank entsteht, und Rechte an zwei Orten sind Rechte, die
 * irgendwann auseinanderlaufen. Was diese Datei beschreibt, ist die Gestalt
 * der Daten.
 *
 * DIE EINZIGE STELLE für diese Collections. `server/einrichten.mjs` lädt
 * die Datei über server/schema.mjs und legt an bzw. gleicht ab.
 * Verknüpfungen dürfen nur auf Collections zeigen, die dort vorher stehen.
 */
export default [
  // ----------------------------------------------------------------------
  // Personalwesen
  //
  // Drei Collections statt einer, weil sie unterschiedlich heikel sind.
  // Die Personaldaten (Geburtsdatum, Sozialversicherungsnummer, Lohn) gehen
  // niemanden etwas an außer der Personalstelle und dem Betroffenen selbst.
  // Abwesenheiten stehen zwischen beidem: die Disposition muss wissen, dass
  // jemand nicht da ist, aber nicht warum. Trennen lässt sich das hier nicht
  // — PocketBase kennt Regeln je Datensatz, nicht je Feld, und mit dem
  // Datensatz käme auch "krankenstand" mit. Deshalb liest Abwesenheiten nur,
  // wer Personalwesen lesen darf, plus der Betroffene selbst. Wer die Dispo
  // macht, braucht also Leserecht auf Personalwesen und sieht damit auch den
  // Grund. Soll die Planung wirklich grundblind sein, braucht es eine eigene,
  // schmale Collection nur mit Tagen — bewusst nicht jetzt gebaut.
  //
  // Der Mitarbeiterdatensatz selbst bleibt im Kern: Aufträge, Zeiten und
  // Termine verweisen darauf. Wer kein Personalwesen gekauft hat, soll
  // trotzdem jemanden einplanen können.
  // ----------------------------------------------------------------------
  {
    // Die Personalakte. Eine Zeile je Mitarbeiter.
    name: "personaldaten",
    // Der Betroffene darf die eigene Akte lesen — das ist keine Nettigkeit,
    // sondern Auskunftsrecht. Ändern darf er sie nicht.
    ...bereichsregeln("personal", "mitarbeiter.benutzer = @request.auth.id"),
    schema: [
      { name: "mitarbeiter", type: "relation", required: true, options: { collectionId: "mitarbeiter", maxSelect: 1, cascadeDelete: true } },
      { name: "geburtsdatum", type: "date" },
      { name: "geburtsort", type: "text" },
      { name: "svnr", type: "text", options: { max: 20 } },
      { name: "staatsbuergerschaft", type: "text" },
      { name: "anschrift", type: "text" },
      { name: "plz", type: "text", options: { max: 10 } },
      { name: "ort", type: "text" },
      { name: "iban", type: "text", options: { max: 40 } },
      { name: "notfallkontakt", type: "text" },
      { name: "notfalltelefon", type: "text" },
      { name: "eintritt", type: "date" },
      { name: "austritt", type: "date" },
      { name: "austrittsgrund", type: "text" },
      { name: "beschaeftigung", type: "select", options: { maxSelect: 1, values: ["vollzeit", "teilzeit", "geringfuegig", "lehre", "ferialarbeit", "leihpersonal"] } },
      { name: "kollektivvertrag", type: "text" },
      { name: "verwendungsgruppe", type: "text", options: { max: 20 } },
      // Bruttomonatslohn bzw. Stundenlohn in Cent — wie überall ganzzahlig.
      { name: "lohnart", type: "select", options: { maxSelect: 1, values: ["monat", "stunde"] } },
      { name: "lohn", type: "number", options: { min: 0, noDecimal: true } },
      { name: "urlaubsanspruch", type: "number", options: { min: 0 } },
      { name: "urlaubUebertrag", type: "number" },
      { name: "notizen", type: "text" },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_personaldaten_ma ON personaldaten (mitarbeiter)"],
  },
  {
    // Urlaub, Zeitausgleich, Krankenstand. Beantragt, genehmigt, abgelehnt.
    name: "abwesenheiten",
    // Anlegen darf jeder für sich selbst — ein Urlaubsantrag ist kein
    // Verwaltungsakt. Entscheiden (Status ändern) darf nur das Personalwesen.
    listRule: `${liest("personal")} || mitarbeiter.benutzer = @request.auth.id`,
    viewRule: `${liest("personal")} || mitarbeiter.benutzer = @request.auth.id`,
    createRule: `${schreibt("personal")} || (mitarbeiter.benutzer = @request.auth.id && @request.data.status = "beantragt")`,
    updateRule: schreibt("personal"),
    deleteRule: nurAdmin,
    schema: [
      { name: "mitarbeiter", type: "relation", required: true, options: { collectionId: "mitarbeiter", maxSelect: 1, cascadeDelete: true } },
      { name: "art", type: "select", required: true, options: { maxSelect: 1, values: ["urlaub", "zeitausgleich", "krankenstand", "pflegefreistellung", "sonderurlaub", "unbezahlt", "schulung", "praesenzdienst"] } },
      { name: "von", type: "date", required: true },
      { name: "bis", type: "date", required: true },
      // Halbe Tage kommen vor und sind der häufigste Rechenfehler von Hand.
      { name: "halberTagBeginn", type: "bool" },
      { name: "halberTagEnde", type: "bool" },
      { name: "status", type: "select", required: true, options: { maxSelect: 1, values: ["beantragt", "genehmigt", "abgelehnt", "storniert"] } },
      { name: "tage", type: "number", options: { min: 0 } },
      { name: "entschiedenVon", type: "relation", options: { collectionId: "users", maxSelect: 1 } },
      { name: "entschiedenAm", type: "date" },
      { name: "grund", type: "text" },
      { name: "notiz", type: "text" },
    ],
    indexes: [
      "CREATE INDEX idx_abwesenheiten_ma ON abwesenheiten (mitarbeiter, von)",
      "CREATE INDEX idx_abwesenheiten_zeitraum ON abwesenheiten (von, bis)",
    ],
  },
  {
    // Dienstvertrag, Zeugnis, Ausweis, Unterweisung — mit Ablaufdatum.
    // Die Unterweisungen sind der eigentliche Grund: eine abgelaufene
    // Elektrofachkraft-Unterweisung merkt sonst niemand, bis etwas passiert.
    name: "personaldokumente",
    ...bereichsregeln("personal", "mitarbeiter.benutzer = @request.auth.id"),
    schema: [
      { name: "mitarbeiter", type: "relation", required: true, options: { collectionId: "mitarbeiter", maxSelect: 1, cascadeDelete: true } },
      { name: "art", type: "select", required: true, options: { maxSelect: 1, values: ["dienstvertrag", "zeugnis", "ausweis", "unterweisung", "befaehigung", "aerztlich", "sonstiges"] } },
      { name: "titel", type: "text", required: true },
      { name: "ausgestelltAm", type: "date" },
      { name: "laeuftAb", type: "date" },
      // Wie viele Tage vor Ablauf erinnert wird. 0 heißt: gar nicht.
      { name: "erinnerungTage", type: "number", options: { min: 0, noDecimal: true } },
      { name: "erledigt", type: "bool" },
      { name: "notiz", type: "text" },
      { name: "datei", type: "file", options: { maxSelect: 1, maxSize: 20971520 } },
    ],
    indexes: [
      "CREATE INDEX idx_personaldokumente_ma ON personaldokumente (mitarbeiter)",
      "CREATE INDEX idx_personaldokumente_ablauf ON personaldokumente (laeuftAb)",
    ],
  },
];
