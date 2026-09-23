import type { ModulCollection } from "@werkboq/core";

/**
 * Collections der Verrechnung.
 *
 * Belege sind gegen Löschen gesperrt — auch für Administratoren. Eine
 * fortlaufende Rechnungsnummer ist nur dann eine, wenn dazwischen nichts
 * verschwindet; § 132 BAO verlangt sieben Jahre Aufbewahrung. Entwürfe
 * löscht die Anwendung über einen eigenen Weg, der prüft, dass der Beleg
 * noch nicht festgeschrieben ist.
 */
export const VERRECHNUNG_COLLECTIONS: ModulCollection[] = [
  {
    name: "belege",
    schema: [
      { name: "belegart", type: "select", required: true, options: { maxSelect: 1, values: ["angebot", "auftragsbestaetigung", "rechnung", "gutschrift"] } },
      { name: "nummer", type: "text", required: true, options: { max: 30 } },
      { name: "kunde", type: "relation", required: true, options: { collectionId: "kunden", maxSelect: 1 } },
      { name: "auftrag", type: "relation", options: { collectionId: "auftraege", maxSelect: 1 } },
      { name: "status", type: "select", required: true, options: { maxSelect: 1, values: ["entwurf", "offen", "angenommen", "abgelehnt", "bezahlt", "storniert"] } },
      { name: "datum", type: "date", required: true },
      { name: "festgeschrieben", type: "date" },
      { name: "leistungVon", type: "date" },
      { name: "leistungBis", type: "date" },
      { name: "empfaengerName", type: "text", required: true },
      { name: "empfaengerAnschrift", type: "text" },
      { name: "empfaengerUid", type: "text", options: { max: 20 } },
      { name: "steuerfrei", type: "select", required: true, options: { maxSelect: 1, values: ["keiner", "bauleistung", "kleinunternehmer", "innergemeinschaftlich", "ausfuhr"] } },
      { name: "zahlungszielTage", type: "number", options: { min: 0, noDecimal: true } },
      { name: "skontoProzent", type: "number", options: { min: 0, max: 100 } },
      { name: "skontoTage", type: "number", options: { min: 0, noDecimal: true } },
      { name: "kopftext", type: "text" },
      { name: "fusstext", type: "text" },
      // Beträge ohne „required": PocketBase hält bei einem Zahlenfeld mit
      // required die Null für einen fehlenden Wert. Bis September 2026 ließ
      // sich deshalb keine Rechnung mit Übergang der Steuerschuld speichern
      // (ust = 0) und kein leerer Angebotsentwurf anlegen (netto = 0).
      { name: "netto", type: "number", options: { noDecimal: true } },
      { name: "ust", type: "number", options: { noDecimal: true } },
      { name: "brutto", type: "number", options: { noDecimal: true } },
      { name: "nettoJeSatz", type: "json", options: { maxSize: 4000 } },
      { name: "storniert", type: "relation", options: { collectionId: "belege", maxSelect: 1 } },
      { name: "folgebeleg", type: "relation", options: { collectionId: "belege", maxSelect: 1 } },
      // Angebotsverfolgung: nächster vereinbarter Termin, und warum ein
      // Angebot verloren ging. Die Liste der Gründe steht in nachfassen.ts.
      { name: "wiedervorlage", type: "date" },
      { name: "absagegrund", type: "select", options: { maxSelect: 1, values: ["preis", "konkurrenz", "zeitpunkt", "kein_bedarf", "keine_rueckmeldung", "sonstiges"] } },
      { name: "absagenotiz", type: "text" },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_belege_nummer ON belege (nummer)",
      "CREATE INDEX idx_belege_kunde ON belege (kunde)",
      "CREATE INDEX idx_belege_art_status ON belege (belegart, status)",
    ],
    // Kein Löschen: eine fortlaufende Nummer verträgt keine Lücken.
    deleteRule: null,
  },
  {
    name: "belegpositionen",
    schema: [
      { name: "beleg", type: "relation", required: true, options: { collectionId: "belege", maxSelect: 1, cascadeDelete: true } },
      { name: "pos", type: "number", required: true, options: { min: 0, noDecimal: true } },
      { name: "art", type: "text" },
      { name: "bezeichnung", type: "text", required: true },
      { name: "beschreibung", type: "text" },
      { name: "menge", type: "number", required: true },
      { name: "einheit", type: "text", options: { max: 12 } },
      { name: "einzelpreis", type: "number", options: { noDecimal: true } },
      { name: "rabatt", type: "number", options: { min: 0, max: 100 } },
      // Nachkommastellen erlaubt: die Schweiz kennt 8,1 %.
      { name: "ustsatz", type: "number", options: { min: 0, max: 100 } },
      { name: "betrag", type: "number", options: { noDecimal: true } },
      { name: "quelle", type: "text" },
    ],
    indexes: ["CREATE INDEX idx_belegpositionen_beleg ON belegpositionen (beleg, pos)"],
    deleteRule: null,
  },
  {
    // Jeder Anruf, jede Mail zu einem offenen Angebot. Nie geändert, nie
    // gelöscht: das ist der Nachweis, dass nachgefasst wurde, und die
    // Grundlage dafür, wann das nächste Mal fällig ist.
    name: "angebotskontakte",
    schema: [
      { name: "beleg", type: "relation", required: true, options: { collectionId: "belege", maxSelect: 1 } },
      { name: "datum", type: "date", required: true },
      { name: "art", type: "select", required: true, options: { maxSelect: 1, values: ["telefon", "mail", "persoenlich", "sonstiges"] } },
      { name: "notiz", type: "text" },
      { name: "wer", type: "text", options: { max: 80 } },
    ],
    indexes: ["CREATE INDEX idx_angebotskontakte_beleg ON angebotskontakte (beleg, datum)"],
    updateRule: null,
    deleteRule: null,
  },
  {
    name: "zahlungen",
    schema: [
      { name: "beleg", type: "relation", required: true, options: { collectionId: "belege", maxSelect: 1 } },
      { name: "datum", type: "date", required: true },
      { name: "betrag", type: "number", required: true, options: { noDecimal: true } },
      { name: "art", type: "select", required: true, options: { maxSelect: 1, values: ["ueberweisung", "bar", "karte", "verrechnung"] } },
      { name: "notiz", type: "text" },
    ],
    indexes: ["CREATE INDEX idx_zahlungen_beleg ON zahlungen (beleg)"],
  },
  {
    name: "mahnungen",
    schema: [
      { name: "beleg", type: "relation", required: true, options: { collectionId: "belege", maxSelect: 1 } },
      { name: "stufe", type: "number", required: true, options: { min: 1, max: 3, noDecimal: true } },
      { name: "datum", type: "date", required: true },
      { name: "frist", type: "date", required: true },
      { name: "zinsen", type: "number", options: { noDecimal: true } },
      { name: "spesen", type: "number", options: { noDecimal: true } },
      { name: "text", type: "text" },
    ],
    indexes: ["CREATE INDEX idx_mahnungen_beleg ON mahnungen (beleg, stufe)"],
  },
];
