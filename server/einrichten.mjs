#!/usr/bin/env node
/**
 * Richtet PocketBase für Werkboq ein – idempotent.
 *
 * Legt alle Kern-Collections und alle Modul-Collections an bzw. gleicht sie ab.
 * Mehrfach ausführbar; ersetzt jede Form von Migrationen.
 *
 * Voraussetzung: PocketBase läuft (npm run server) und es gibt einen Admin.
 *   PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD aus .env oder Umgebung.
 *
 * SCHUTZ VOR FREMDEN DATENBANKEN
 * Dieses Skript verändert das Schema der PocketBase unter PB_URL. Läuft dort
 * eine andere Anwendung (etwa eine lokale FD-Book-Instanz), würden deren Daten
 * mit Werkboq-Collections vermischt. Deshalb:
 *   - Werkboq läuft auf Port 8095, nicht auf PocketBase-Standard 8090.
 *   - Beim ersten Lauf wird die Marker-Collection "werkboq_meta" angelegt.
 *   - Findet das Skript eine Datenbank mit fremden Collections und ohne diesen
 *     Marker, bricht es ab, statt hineinzuschreiben.
 * Der Abbruch lässt sich mit WERKBOQ_TROTZDEM=ja übergehen – bewusst umständlich.
 */
import PocketBase from "pocketbase";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/** Collection -> neu hinzugekommene Feldnamen, für die Schlussmeldung. */
const geaendert = new Map();

const hier = dirname(fileURLToPath(import.meta.url));
ladeEnv(join(hier, "..", ".env"));

const PB_URL = process.env.PB_URL ?? process.env.VITE_PB_URL ?? "http://127.0.0.1:8095";
const EMAIL = process.env.PB_ADMIN_EMAIL;
const PASSWORT = process.env.PB_ADMIN_PASSWORD;

if (!EMAIL || !PASSWORT) {
  console.error("PB_ADMIN_EMAIL und PB_ADMIN_PASSWORD setzen (siehe .env.example).");
  process.exit(1);
}

const angemeldet = "@request.auth.id != ''";
const nurAdmin = "@request.auth.admin = true";

/**
 * Regelbausteine für die Bereichsrechte.
 *
 * `bereiche` und `lesebereiche` sind JSON-Arrays. PocketBase kann darauf
 * keinen echten Mengenvergleich, also wird auf den Text gefiltert — mit
 * Anführungszeichen, damit "lager" nicht in "lagerleitung" trifft.
 *
 * DAS HIER IST DER ECHTE SCHUTZ, nicht die Oberfläche. Was in der App
 * ausgeblendet ist, liegt trotzdem hinter der API bereit, solange keine
 * Regel danebensteht.
 */
const schreibt = (bereich) => `${nurAdmin} || @request.auth.bereiche ~ '"${bereich}"'`;
const liest = (bereich) =>
  `${nurAdmin} || @request.auth.bereiche ~ '"${bereich}"' || @request.auth.lesebereiche ~ '"${bereich}"'`;

/**
 * Regeln für eine Collection, die einem Bereich gehört.
 * `eigene` ist ein zusätzlicher Ausdruck, unter dem jemand seinen eigenen
 * Datensatz trotzdem sehen darf — ein Mitarbeiter etwa seinen Resturlaub.
 */
function bereichsregeln(bereich, eigene = null) {
  const mitEigenen = (regel) => (eigene ? `(${regel}) || (${eigene})` : regel);
  return {
    listRule: mitEigenen(liest(bereich)),
    viewRule: mitEigenen(liest(bereich)),
    createRule: schreibt(bereich),
    updateRule: schreibt(bereich),
    deleteRule: nurAdmin,
  };
}
/** Marker-Collection, die diese Datenbank als Werkboq-Datenbank kennzeichnet. */
const MARKER = "werkboq_meta";

/** Alle Bereiche, die der erste Benutzer bekommt. */
const KERN_BEREICHE_UND_MODULE = [
  "verwaltung",
  "buchhaltung",
  "technik",
  "lager",
  "personal",
  "entwickler",
  "elektro",
];

const standardRegeln = {
  listRule: angemeldet,
  viewRule: angemeldet,
  createRule: angemeldet,
  updateRule: angemeldet,
  deleteRule: nurAdmin,
};

/** Kern-Collections. Reihenfolge beachten: Relationen zeigen nur nach oben. */
const KERN = [
  {
    // Stammdaten des eigenen Betriebs. Genau ein Datensatz; die Angaben
    // landen später auf Angebot und Rechnung, wo UID und Firmenbuchnummer
    // nach § 11 UStG Pflicht sind.
    name: "betrieb",
    schema: [
      { name: "name", type: "text", required: true },
      { name: "inhaber", type: "text" },
      { name: "strasse", type: "text" },
      { name: "plz", type: "text" },
      { name: "ort", type: "text" },
      { name: "land", type: "text" },
      { name: "telefon", type: "text" },
      { name: "email", type: "email" },
      { name: "web", type: "url" },
      { name: "uid", type: "text" },
      { name: "firmenbuch", type: "text" },
      { name: "gericht", type: "text" },
      { name: "iban", type: "text" },
      { name: "bic", type: "text" },
      { name: "bank", type: "text" },
      { name: "logo", type: "file", options: { maxSelect: 1, maxSize: 2097152, mimeTypes: ["image/png", "image/jpeg", "image/svg+xml"] } },
      // Welche Bausteine dieser Betrieb gekauft hat. Leer heißt "alle" —
      // ein Bestand ohne Eintrag soll nicht plötzlich dunkel werden.
      // Kein Kopierschutz: siehe packages/core/src/modul/bausteine.ts.
      { name: "bausteine", type: "json", options: { maxSize: 20000 } },
      // Verrechnungssatz für eine Arbeitsstunde, netto in Cent.
      { name: "stundensatz", type: "number", options: { min: 0, noDecimal: true } },
      // Rechtsraum: at, de oder ch. Beim Einrichten gewählt, danach fix —
      // daran hängen Steuersätze, Währung, Pflichtangaben und Zinsen.
      { name: "rechtsraum", type: "select", options: { maxSelect: 1, values: ["at", "de", "ch"] } },
    ],
    deleteRule: null,
  },
  {
    // Mitarbeiter. Bewusst getrennt von den Benutzern: ein Lehrling wird
    // eingeplant, hat aber vielleicht nie einen Zugang. Wer sich anmelden
    // kann, bekommt zusätzlich eine Verknüpfung auf users.
    name: "mitarbeiter",
    schema: [
      { name: "name", type: "text", required: true },
      { name: "kurzzeichen", type: "text", options: { max: 4 } },
      { name: "funktion", type: "select", required: true, options: { maxSelect: 1, values: ["meister", "monteur", "lehrling", "buero", "lager", "extern"] } },
      { name: "benutzer", type: "relation", options: { collectionId: "users", maxSelect: 1 } },
      { name: "telefon", type: "text" },
      { name: "email", type: "email" },
      { name: "farbe", type: "text", options: { max: 7 } },
      { name: "wochenstunden", type: "number", options: { min: 0 } },
      { name: "aktiv", type: "bool" },
      { name: "notizen", type: "text" },
    ],
    indexes: ["CREATE INDEX idx_mitarbeiter_aktiv ON mitarbeiter (aktiv)"],
  },
  {
    name: "kunden",
    schema: [
      { name: "name", type: "text", required: true },
      { name: "intern", type: "bool" },
      // Unternehmer oder Verbraucher — entscheidet über Verzugszinssatz,
      // Betreibungskostenpauschale und Übergang der Steuerschuld.
      { name: "unternehmer", type: "bool" },
      { name: "strasse", type: "text" },
      { name: "plz", type: "text" },
      { name: "ort", type: "text" },
      { name: "land", type: "text" },
      { name: "telefon", type: "text" },
      { name: "email", type: "email" },
      { name: "uid", type: "text" },
      { name: "notizen", type: "editor" },
    ],
  },
  {
    name: "standorte",
    schema: [
      { name: "kunde", type: "relation", required: true, options: { collectionId: "kunden", maxSelect: 1, cascadeDelete: true } },
      { name: "bezeichnung", type: "text", required: true },
      { name: "strasse", type: "text" },
      { name: "plz", type: "text" },
      { name: "ort", type: "text" },
    ],
  },
  {
    name: "auftraege",
    schema: [
      { name: "kunde", type: "relation", required: true, options: { collectionId: "kunden", maxSelect: 1 } },
      { name: "standort", type: "relation", options: { collectionId: "standorte", maxSelect: 1 } },
      { name: "nummer", type: "text", required: true },
      { name: "titel", type: "text", required: true },
      {
        name: "phase",
        type: "select",
        required: true,
        options: {
          maxSelect: 1,
          values: ["anfrage", "spezifikation", "angebot", "termine", "projekt", "errichtung", "abnahme", "wartung", "materialverkauf", "abgeschlossen"],
        },
      },
      // Die Art entscheidet, welche Phasen der Auftrag überhaupt hat.
      // Leer gilt als "projekt" — Aufträge aus der Zeit davor sehen damit
      // aus wie vorher. Die Werte müssen zu AUFTRAGSARTEN in
      // packages/core/src/daten/typen.ts passen; ein Test wacht darüber.
      {
        name: "art",
        type: "select",
        options: {
          maxSelect: 1,
          values: ["stoerung", "regie", "projekt", "wartung", "materialverkauf"],
        },
      },
      { name: "modul", type: "text" },
      { name: "beschreibung", type: "editor" },
      { name: "beginn", type: "date" },
      { name: "ende", type: "date" },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_auftraege_nummer ON auftraege (nummer)"],
  },
  {
    name: "dokumente",
    schema: [
      { name: "auftrag", type: "relation", required: true, options: { collectionId: "auftraege", maxSelect: 1, cascadeDelete: true } },
      { name: "titel", type: "text", required: true },
      { name: "datei", type: "file", required: true, options: { maxSelect: 1, maxSize: 52428800 } },
      { name: "art", type: "text" },
      { name: "modul", type: "text" },
    ],
  },
  {
    name: "fotos",
    schema: [
      { name: "auftrag", type: "relation", required: true, options: { collectionId: "auftraege", maxSelect: 1, cascadeDelete: true } },
      // thumbs MUSS hier stehen: PocketBase erzeugt nur Vorschaubilder in
      // Größen, die am Feld deklariert sind. Ohne das liefert ein Aufruf
      // mit ?thumb=400x0 klaglos das Original zurück — eine Galerie mit
      // dreißig Handyfotos wären dann hundert Megabyte über eine
      // Mobilverbindung, und niemandem fällt auf, warum es so lahm ist.
      { name: "datei", type: "file", required: true, options: { maxSelect: 1, maxSize: 20971520, mimeTypes: ["image/jpeg", "image/png", "image/heic", "image/webp"], thumbs: ["400x0", "1200x0"] } },
      // Ein Foto ohne Einordnung beweist wenig: "da war ein Loch in der
      // Wand" sagt nichts darüber, ob es vorher schon da war.
      { name: "art", type: "select", options: { maxSelect: 1, values: ["vorab", "vorher", "nachher", "schaden", "sonstiges"] } },
      { name: "beschreibung", type: "text" },
      { name: "aufgenommen", type: "date" },
      // Wer das Bild aufgenommen hat. Für die Beweiskraft so wichtig wie
      // das Bild selbst.
      { name: "mitarbeiter", type: "relation", options: { collectionId: "mitarbeiter", maxSelect: 1 } },
    ],
    indexes: ["CREATE INDEX idx_fotos_auftrag_art ON fotos (auftrag, art)"],
  },
  {
    // Unterschrift des Kunden, am Tablet auf der Baustelle.
    //
    // DIE ERKLÄRUNG WIRD MITGESPEICHERT UND EINGEFROREN.
    //
    // Eine Unterschrift ohne den Text, den sie bestätigt, ist wertlos — im
    // Streit zählt nicht der Strich, sondern wozu er gesetzt wurde. Deshalb
    // steht der volle Wortlaut im Datensatz, nicht bloß ein Verweis auf
    // eine Vorlage, die sich später ändern kann.
    //
    // Und deshalb ist sie unveränderlich: updateRule null, Löschen nur für
    // Administratoren. Eine nachträglich änderbare Unterschrift beweist
    // nichts.
    name: "unterschriften",
    listRule: angemeldet,
    viewRule: angemeldet,
    createRule: angemeldet,
    updateRule: null,
    deleteRule: nurAdmin,
    schema: [
      { name: "auftrag", type: "relation", required: true, options: { collectionId: "auftraege", maxSelect: 1 } },
      { name: "zweck", type: "select", required: true, options: { maxSelect: 1, values: ["abnahme", "stundennachweis", "zustand_vorher", "uebergabe"] } },
      // Wer unterschrieben hat — in Blockschrift daneben, weil eine
      // Unterschrift oft nicht lesbar ist.
      { name: "name", type: "text", required: true },
      { name: "funktion", type: "text" },
      { name: "datum", type: "date", required: true },
      { name: "ort", type: "text" },
      // Der Wortlaut, dem zugestimmt wurde. Eingefroren.
      { name: "erklaerung", type: "text", required: true },
      { name: "bild", type: "file", required: true, options: { maxSelect: 1, maxSize: 2097152, mimeTypes: ["image/png"], thumbs: ["400x0"] } },
      // Wer die Unterschrift eingeholt hat.
      { name: "mitarbeiter", type: "relation", options: { collectionId: "mitarbeiter", maxSelect: 1 } },
      { name: "vorbehalt", type: "text" },
    ],
    indexes: ["CREATE INDEX idx_unterschriften_auftrag ON unterschriften (auftrag, datum)"],
  },
  {
    name: "ansprechpartner",
    schema: [
      { name: "kunde", type: "relation", required: true, options: { collectionId: "kunden", maxSelect: 1, cascadeDelete: true } },
      { name: "name", type: "text", required: true },
      { name: "funktion", type: "text" },
      { name: "telefon", type: "text" },
      { name: "email", type: "email" },
      { name: "notizen", type: "text" },
    ],
  },
  {
    // Änderungsverlauf. Wird beim Schreiben mitgeschrieben und nie geändert:
    // updateRule und deleteRule bleiben gesperrt, sonst taugt er als Nachweis
    // nichts. Löschen darf nur ein Admin über das Admin-UI.
    name: "protokoll",
    schema: [
      { name: "bereich", type: "text", required: true },
      { name: "datensatz", type: "text", required: true },
      { name: "aktion", type: "select", required: true, options: { maxSelect: 1, values: ["anlegen", "aendern", "loeschen"] } },
      { name: "zusammenfassung", type: "text", required: true },
      { name: "benutzer", type: "relation", options: { collectionId: "users", maxSelect: 1 } },
      { name: "benutzername", type: "text" },
    ],
    indexes: ["CREATE INDEX idx_protokoll_datensatz ON protokoll (datensatz)"],
    listRule: angemeldet,
    viewRule: angemeldet,
    createRule: angemeldet,
    updateRule: null,
    deleteRule: null,
  },
  {
    // Versandprotokoll: wann ist welches Dokument an wen hinausgegangen.
    //
    // Das ist der Teil, der wirklich trägt. Ob die Mail über das
    // Mailprogramm oder über WhatsApp ging, ist zweitrangig — die Frage
    // im Streit lautet "haben Sie die Rechnung je bekommen?", und darauf
    // muss man ein Datum nennen können.
    //
    // Unveränderlich wie der Änderungsverlauf: ein Versandnachweis, den man
    // nachträglich eintragen oder löschen kann, ist keiner.
    name: "versand",
    schema: [
      { name: "bereich", type: "text", required: true },
      { name: "datensatz", type: "text", required: true },
      { name: "bezeichnung", type: "text", required: true },
      { name: "weg", type: "select", required: true, options: { maxSelect: 1, values: ["mail", "whatsapp", "druck", "uebergabe", "post"] } },
      { name: "empfaenger", type: "text" },
      { name: "betreff", type: "text" },
      { name: "nachricht", type: "text" },
      // Hat der Anwender bestätigt, dass er es wirklich abgeschickt hat?
      // Werkboq öffnet nur das Mailprogramm — ob dort auf Senden gedrückt
      // wurde, kann es nicht wissen und behauptet es deshalb nicht.
      { name: "bestaetigt", type: "bool" },
      { name: "benutzer", type: "relation", options: { collectionId: "users", maxSelect: 1 } },
      { name: "benutzername", type: "text" },
    ],
    indexes: ["CREATE INDEX idx_versand_datensatz ON versand (datensatz, created)"],
    listRule: angemeldet,
    viewRule: angemeldet,
    createRule: angemeldet,
    updateRule: angemeldet,
    deleteRule: null,
  },
];

/**
 * Collections der Bausteine — der Grundfunktionen, die einzeln verkauft
 * werden. Angelegt werden sie immer: ob ein Betrieb den Baustein gekauft hat,
 * entscheidet betrieb.bausteine in der Oberfläche, nicht das Schema. Eine
 * leere Tabelle kostet nichts, ein nachträglich fehlendes Schema dagegen
 * einen Ausfall, sobald jemand den Baustein dazukauft.
 */
const BAUSTEINE = [
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
    // Termine sind die Planung: wer soll wann wo sein. Was daraus wurde,
    // steht in den Zeiten. Ein Termin ohne Auftrag ist innerbetrieblich
    // (Urlaub, Schulung, Werkstatt), deshalb ist der Auftrag nicht Pflicht.
    name: "termine",
    schema: [
      { name: "auftrag", type: "relation", options: { collectionId: "auftraege", maxSelect: 1, cascadeDelete: true } },
      { name: "mitarbeiter", type: "relation", options: { collectionId: "mitarbeiter", maxSelect: 20 } },
      { name: "titel", type: "text", required: true },
      { name: "datum", type: "date", required: true },
      { name: "beginn", type: "text", options: { max: 5 } },
      { name: "ende", type: "text", options: { max: 5 } },
      { name: "ganztags", type: "bool" },
      { name: "art", type: "select", options: { maxSelect: 1, values: ["baustelle", "kundentermin", "werkstatt", "urlaub", "schulung", "sonstiges"] } },
      { name: "ort", type: "text" },
      { name: "notizen", type: "text" },
    ],
    indexes: ["CREATE INDEX idx_termine_datum ON termine (datum)"],
  },
  {
    // Leistungs- und Materialkatalog. Preise als Cent in ganzen Zahlen:
    // Fließkomma und Geld vertragen sich nicht.
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
      { name: "einzelpreis", type: "number", required: true, options: { noDecimal: true } },
      { name: "rabatt", type: "number", options: { min: 0, max: 100 } },
      // Nachkommastellen erlaubt: die Schweiz kennt 8,1 %.
      { name: "ustsatz", type: "number", required: true, options: { min: 0, max: 100 } },
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
    // Der Rest der Positionsrechte steht noch aus, siehe docs/rechte.md:
    // Menge und Preis einer bereits freigegebenen Position kann derzeit
    // jeder Angemeldete ändern.
    listRule: angemeldet,
    viewRule: angemeldet,
    createRule: `${angemeldet} && (@request.data.zustand = "vorschlag" || ${schreibt("lager")})`,
    updateRule:
      `${angemeldet} && (zustand != "vorschlag" || @request.data.zustand = "vorschlag" || ${schreibt("lager")})`,
    deleteRule: angemeldet,
  },
  {
    // Belege: Angebot, Auftragsbestätigung, Rechnung, Gutschrift.
    // Kein Löschen — eine fortlaufende Rechnungsnummer verträgt keine
    // Lücken, und § 132 BAO verlangt sieben Jahre Aufbewahrung. Entwürfe
    // räumt die Anwendung über einen eigenen Weg weg, der prüft, dass der
    // Beleg noch nicht festgeschrieben ist.
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
      { name: "netto", type: "number", required: true, options: { noDecimal: true } },
      { name: "ust", type: "number", required: true, options: { noDecimal: true } },
      { name: "brutto", type: "number", required: true, options: { noDecimal: true } },
      { name: "nettoJeSatz", type: "json", options: { maxSize: 4000 } },
      { name: "storniert", type: "relation", options: { collectionId: "belege", maxSelect: 1 } },
      { name: "folgebeleg", type: "relation", options: { collectionId: "belege", maxSelect: 1 } },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_belege_nummer ON belege (nummer)",
      "CREATE INDEX idx_belege_kunde ON belege (kunde)",
      "CREATE INDEX idx_belege_art_status ON belege (belegart, status)",
    ],
    deleteRule: null,
  },
  {
    // Eingefrorene Kopie der Positionen zum Zeitpunkt der Belegerstellung.
    // Ändert jemand später die Auftragsposition, bleibt die Rechnung, wie
    // sie war — sie ist ein Dokument, kein Fenster in den aktuellen Stand.
    name: "belegpositionen",
    schema: [
      { name: "beleg", type: "relation", required: true, options: { collectionId: "belege", maxSelect: 1, cascadeDelete: true } },
      { name: "pos", type: "number", required: true, options: { min: 0, noDecimal: true } },
      { name: "art", type: "text" },
      { name: "bezeichnung", type: "text", required: true },
      { name: "beschreibung", type: "text" },
      { name: "menge", type: "number", required: true },
      { name: "einheit", type: "text", options: { max: 12 } },
      { name: "einzelpreis", type: "number", required: true, options: { noDecimal: true } },
      { name: "rabatt", type: "number", options: { min: 0, max: 100 } },
      // Nachkommastellen erlaubt: die Schweiz kennt 8,1 %.
      { name: "ustsatz", type: "number", required: true, options: { min: 0, max: 100 } },
      { name: "betrag", type: "number", required: true, options: { noDecimal: true } },
      { name: "quelle", type: "text" },
    ],
    indexes: ["CREATE INDEX idx_belegpositionen_beleg ON belegpositionen (beleg, pos)"],
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

/** Modul-Collections: jedes Modul liefert seine in <modul>/src/daten/collections.ts;
 *  hier gespiegelt, weil Node die TS-Datei nicht direkt laden kann. */
const MODULE = [
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

const pb = new PocketBase(PB_URL);

try {
  await pb.admins.authWithPassword(EMAIL, PASSWORT);
  console.log(`Verbunden mit ${PB_URL}`);

  // Sicherstellen, dass dies wirklich die Werkboq-Datenbank ist
  await datenbankPruefen();

  // users-Collection um Werkboq-Felder ergänzen
  await benutzerErgaenzen();

  // Relationen werden in den Definitionen über den Collection-NAMEN
  // angegeben; PocketBase erwartet die interne Kennung. Die Zuordnung füllt
  // sich beim Anlegen — außer für "users", das es schon gibt.
  const ids = new Map();
  // Alles, was es schon gibt, vorab eintragen. Dann lösen sich Verknüpfungen
  // auf bestehende Collections gleich im ersten Durchgang auf, und eine
  // fertig eingerichtete Datenbank braucht den zweiten gar nicht.
  for (const c of await pb.collections.getFullList()) ids.set(c.name, c.id);

  const alle = [...KERN, ...BAUSTEINE, ...MODULE];

  /**
   * Zwei Durchgänge.
   *
   * Eine Collection kann auf sich selbst zeigen — "belege.storniert" auf den
   * stornierten Beleg — und PocketBase kennt beim Anlegen deren Kennung noch
   * nicht. Solche Felder bleiben im ersten Durchgang weg; im zweiten stehen
   * alle Kennungen fest und collectionAbgleichen hängt sie an. Idempotent,
   * also kostet der zweite Durchgang bei einer fertigen Datenbank nichts.
   */
  const zurueckgestellt = new Set();
  let angelegt = 0;

  for (const durchgang of [1, 2]) {
    for (const c of alle) {
      const schema = [];
      for (const f of c.schema) {
        if (f.type === "relation" && f.options?.collectionId) {
          const kennung = ids.get(f.options.collectionId);
          if (!kennung) {
            // Ziel noch nicht angelegt: im ersten Durchgang überspringen.
            zurueckgestellt.add(`${c.name}.${f.name}`);
            continue;
          }
          schema.push({ ...f, options: { ...f.options, collectionId: kennung } });
          continue;
        }
        schema.push(f);
      }
      // Gemeldet wird im ersten Durchgang. Der zweite hängt nur noch
      // zurückgestellte Verknüpfungen an und schweigt, sonst stünde jede
      // Collection zweimal da.
      const vorher = ids.has(c.name);
      const id = await collectionAbgleichen({ ...standardRegeln, ...c, schema }, durchgang === 2);
      if (!vorher) angelegt++;
      ids.set(c.name, id);
    }
    if (zurueckgestellt.size === 0) break;
    if (durchgang === 1) {
      console.log(
        `Verknüpfungen auf sich selbst werden nachgezogen: ${[...zurueckgestellt].join(", ")}`,
      );
    }
  }

  // Immer eine Zeile, auch wenn sich nichts geändert hat. Ein Lauf, der
  // schweigt, ist von einem Lauf, der nichts getan hat, nicht zu
  // unterscheiden — und genau das verunsichert zu Recht.
  console.log(
    `${alle.length} Collections geprüft, ${angelegt} neu angelegt, ` +
      `${geaendert.size} um Felder erweitert, ` +
      `${alle.length - angelegt - geaendert.size} unverändert.`,
  );

  // Ersten Anwendungsbenutzer anlegen, falls gewünscht und noch keiner da ist
  await erstenBenutzerAnlegen();

  // Bequemer Entwicklungszugang adm/adm, nur mit WB_ENTWICKLUNG=ja
  await entwicklungszugangAnlegen();

  // Betriebsstammdaten und Mitarbeiter für alle Benutzer ohne eigenen
  await betriebVorbereiten();
  await mitarbeiterNachziehen();

  console.log("Einrichtung abgeschlossen.");
} catch (e) {
  // Die PocketBase-Bibliothek wirft bei Fehlern ihren gesamten Quelltext aus.
  // Hier stattdessen nur das, was weiterhilft.
  console.error(`\nFehler beim Einrichten: ${lesbarerFehler(e)}\n`);
  process.exit(1);
}

/** Holt aus einem PocketBase-Fehler die Feldmeldungen heraus. */
function lesbarerFehler(e) {
  // Status 0 heißt: die Anfrage kam nie an. Fast immer läuft der Server nicht.
  const ursache = String(e?.originalError?.cause?.code ?? "");
  if (e?.status === 0 || /ECONNREFUSED|ENOTFOUND|ECONNRESET/.test(ursache)) {
    return (
      `PocketBase ist unter ${PB_URL} nicht erreichbar.\n` +
      `  Läuft der Server? In einem zweiten Terminal:  npm run server\n` +
      `  Stimmt die Adresse? Siehe VITE_PB_URL in der .env.`
    );
  }

  if (e?.status === 400 && !e?.response?.data) {
    return (
      `Anmeldung als Admin fehlgeschlagen (${PB_URL}).\n` +
      `  PB_ADMIN_EMAIL und PB_ADMIN_PASSWORD in der .env müssen zu dem Admin\n` +
      `  passen, den der Serverstart angelegt hat.`
    );
  }

  const antwort = e?.response ?? e?.data;
  if (!antwort || Object.keys(antwort).length === 0) {
    return e?.message || `${e?.name ?? "Fehler"} (Status ${e?.status ?? "?"})`;
  }

  const zeilen = [antwort.message || `Status ${antwort.code ?? e?.status ?? "?"}`];
  for (const [feld, angabe] of Object.entries(antwort.data ?? {})) {
    const text = angabe?.message ?? JSON.stringify(angabe);
    zeilen.push(`  ${feld}: ${text}`);
  }
  if (e?.url) zeilen.push(`  Aufruf: ${e.url}`);
  return zeilen.join("\n");
}

// ---------------------------------------------------------------------------

/**
 * Bricht ab, wenn unter PB_URL erkennbar eine fremde Anwendung liegt.
 * Erkennungsmerkmal: es gibt Collections, die weder zu Werkboq gehören noch
 * PocketBase-Systemcollections sind, und der Werkboq-Marker fehlt.
 */
async function datenbankPruefen() {
  const vorhanden = await pb.collections.getFullList({ batch: 200 });
  const hatMarker = vorhanden.some((c) => c.name === MARKER);

  if (!hatMarker) {
    const unsere = new Set([...KERN, ...BAUSTEINE, ...MODULE].map((c) => c.name));
    const fremd = vorhanden
      .filter((c) => !c.system && c.name !== "users" && !unsere.has(c.name))
      .map((c) => c.name);

    if (fremd.length > 0 && process.env.WERKBOQ_TROTZDEM !== "ja") {
      console.error(
        `\nAbbruch: Unter ${PB_URL} liegt offenbar eine fremde Datenbank.\n` +
          `Gefundene fremde Collections: ${fremd.join(", ")}\n\n` +
          `Werkboq erwartet eine eigene PocketBase auf Port 8095 (npm run server).\n` +
          `Läuft dort gerade eine andere Anwendung, beende sie oder setze PB_URL\n` +
          `auf die richtige Adresse. Es wurde nichts verändert.\n`,
      );
      process.exit(1);
    }

    await pb.collections.create({
      type: "base",
      name: MARKER,
      schema: [
        { name: "schluessel", type: "text", required: true },
        { name: "wert", type: "text" },
      ],
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
    });
    console.log(`${MARKER}: angelegt (kennzeichnet diese Datenbank als Werkboq)`);
  }
}

async function benutzerErgaenzen() {
  const users = await pb.collections.getOne("users");
  await benutzerRegelnSetzen(users);
  const vorhanden = new Set(users.schema.map((f) => f.name));
  const neu = [];
  if (!vorhanden.has("name")) neu.push({ name: "name", type: "text" });
  if (!vorhanden.has("bereiche")) neu.push({ name: "bereiche", type: "json", options: { maxSize: 2000000 } });
  // Bereiche, die nur gelesen werden dürfen — der Monteur auf den Aufträgen.
  if (!vorhanden.has("lesebereiche")) neu.push({ name: "lesebereiche", type: "json", options: { maxSize: 2000000 } });
  if (!vorhanden.has("admin")) neu.push({ name: "admin", type: "bool" });
  // Kennzeichnet Konten, die nur zum Entwickeln existieren und später
  // mit "npm run entwicklung-weg" restlos entfernt werden.
  if (!vorhanden.has("entwicklung")) neu.push({ name: "entwicklung", type: "bool" });
  if (neu.length === 0) return;
  await pb.collections.update(users.id, { schema: [...users.schema, ...neu] });
  console.log(`users: ${neu.map((f) => f.name).join(", ")} ergänzt`);
}

/**
 * Regeln der users-Collection.
 *
 * Zugänge werden in Werkboq unter Einstellungen → Mitarbeiter verwaltet, also
 * über die API und nicht im Admin-UI. Dafür müssen Betriebsadministratoren
 * (users.admin = true) Benutzer anlegen und ändern dürfen. Offene
 * Selbstregistrierung bleibt gesperrt — ein Handwerksbetrieb hat keine
 * Anmeldeseite für Fremde.
 */
async function benutzerRegelnSetzen(users) {
  const istAdmin = "@request.auth.admin = true";
  const selbst = "id = @request.auth.id";
  const gewuenscht = {
    listRule: `@request.auth.id != '' && (${istAdmin} || ${selbst})`,
    viewRule: `@request.auth.id != '' && (${istAdmin} || ${selbst})`,
    createRule: istAdmin,
    updateRule: `${istAdmin} || ${selbst}`,
    deleteRule: istAdmin,
  };
  const gleich = Object.entries(gewuenscht).every(([k, v]) => users[k] === v);
  if (gleich) return;
  await pb.collections.update(users.id, gewuenscht);
  console.log("users: Zugriffsregeln gesetzt (Verwaltung über die Anwendung)");
}

/**
 * Legt den bequemen Entwicklungszugang adm/adm an.
 *
 * Nur aktiv mit WB_ENTWICKLUNG=ja und nur gegen eine PocketBase auf dem
 * eigenen Rechner. Das Konto trägt entwicklung=true und lässt sich damit
 * später eindeutig wiederfinden und löschen.
 *
 * Damit ein dreistelliges Passwort überhaupt zulässig ist, wird die
 * Mindestlänge der users-Collection vorübergehend auf 3 gesetzt.
 * "npm run entwicklung-weg" stellt sie wieder auf 8 und löscht die Konten.
 */
async function entwicklungszugangAnlegen() {
  if (process.env.WB_ENTWICKLUNG !== "ja") return;

  if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(PB_URL)) {
    console.error(
      `Abbruch: WB_ENTWICKLUNG=ja ist nur gegen eine lokale PocketBase erlaubt, ` +
        `nicht gegen ${PB_URL}. Es wurde kein Entwicklungszugang angelegt.`,
    );
    process.exit(1);
  }

  // PocketBase lässt die Mindestlänge nicht unter 5 sinken – deshalb "admadm".
  const passwort = process.env.WB_ENTWICKLUNG_PASSWORT ?? "admadm";
  if (passwort.length < 5) {
    console.error(
      `WB_ENTWICKLUNG_PASSWORT muss mindestens 5 Zeichen haben – ` +
        `PocketBase erlaubt keine kürzeren. Kein Entwicklungszugang angelegt.`,
    );
    return;
  }

  const users = await pb.collections.getOne("users");
  if ((users.options?.minPasswordLength ?? 8) > 5) {
    await pb.collections.update(users.id, {
      options: { ...users.options, minPasswordLength: 5 },
    });
  }

  const schon = await pb
    .collection("users")
    .getFirstListItem('username = "adm"')
    .catch(() => null);
  if (schon) {
    console.log("users: Entwicklungszugang adm besteht bereits");
    return;
  }

  await pb.collection("users").create({
    username: "adm",
    email: "adm@werkboq.invalid",
    password: passwort,
    passwordConfirm: passwort,
    name: "Entwicklung",
    admin: true,
    entwicklung: true,
    bereiche: KERN_BEREICHE_UND_MODULE,
    emailVisibility: false,
    verified: true,
  });

  console.log(
    `\n*** Entwicklungszugang angelegt: Benutzer adm, Passwort ${passwort} ***\n` +
      "    Nur für die Entwicklung. Vor jedem echten Einsatz entfernen mit:\n" +
      "    npm run entwicklung-weg\n",
  );
}

/**
 * Legt den ersten Anwendungsbenutzer an, falls WB_BENUTZER_EMAIL gesetzt ist
 * und noch kein Benutzer existiert. Der PocketBase-Admin aus dem Admin-UI ist
 * NICHT derselbe wie ein Anwendungsbenutzer – in Werkboq meldet man sich mit
 * einem Datensatz aus der users-Collection an.
 */
async function erstenBenutzerAnlegen() {
  const email = process.env.WB_BENUTZER_EMAIL;
  const passwort = process.env.WB_BENUTZER_PASSWORT;
  if (!email || !passwort) return;

  const vorhanden = await pb.collection("users").getList(1, 1);
  if (vorhanden.totalItems > 0) {
    console.log("users: Benutzer vorhanden, kein neuer angelegt");
    return;
  }
  if (passwort.length < 8) {
    console.error("WB_BENUTZER_PASSWORT muss mindestens 8 Zeichen haben.");
    return;
  }

  await pb.collection("users").create({
    email,
    password: passwort,
    passwordConfirm: passwort,
    name: process.env.WB_BENUTZER_NAME ?? "Verwalter",
    admin: true,
    bereiche: KERN_BEREICHE_UND_MODULE,
    emailVisibility: true,
    verified: true,
  });
  console.log(`users: ${email} als Verwalter angelegt`);
}

/**
 * Legt den einen Betriebsdatensatz an, falls noch keiner da ist. Die Werte
 * sind Platzhalter — ausgefüllt wird in der Oberfläche unter Einstellungen.
 */
async function betriebVorbereiten() {
  const vorhanden = await pb.collection("betrieb").getList(1, 1);
  if (vorhanden.totalItems > 0) return;
  await pb.collection("betrieb").create({
    name: process.env.WB_BETRIEB_NAME ?? "Mein Betrieb",
    land: "Österreich",
  });
  console.log("betrieb: Stammdatensatz angelegt (bitte in den Einstellungen ausfüllen)");
}

/**
 * Sorgt dafür, dass jeder Anwendungsbenutzer auch als Mitarbeiter existiert.
 * Sonst kann man sich anmelden, aber niemand kann einen einplanen.
 */
async function mitarbeiterNachziehen() {
  const benutzer = await pb.collection("users").getFullList();
  const mitarbeiter = await pb.collection("mitarbeiter").getFullList();
  const schonVerknuepft = new Set(mitarbeiter.map((m) => m.benutzer).filter(Boolean));

  for (const b of benutzer) {
    if (schonVerknuepft.has(b.id)) continue;
    const name = b.name || b.username || b.email;
    await pb.collection("mitarbeiter").create({
      name,
      kurzzeichen: kuerzel(name),
      funktion: b.admin ? "meister" : "monteur",
      benutzer: b.id,
      email: b.email,
      farbe: farbeFuer(name),
      aktiv: true,
    });
    console.log(`mitarbeiter: ${name} angelegt`);
  }
}

function kuerzel(name) {
  return name
    .split(/[\s.@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

/** Feste Farbe je Name, damit dieselbe Person immer gleich eingefärbt ist. */
function farbeFuer(name) {
  const palette = ["#0058a8", "#1f7a4c", "#9a6a00", "#7a3fa0", "#b0472b", "#2e7d8f", "#5a6b2f"];
  let summe = 0;
  for (const zeichen of name) summe = (summe + zeichen.charCodeAt(0)) % 9973;
  return palette[summe % palette.length];
}

async function collectionAbgleichen(def, still = false) {
  let vorhanden = null;
  try {
    vorhanden = await pb.collections.getOne(def.name);
  } catch {
    /* gibt es noch nicht */
  }
  if (!vorhanden) {
    const c = await pb.collections.create({ type: "base", ...def });
    console.log(`${def.name}: angelegt`);
    return c.id;
  }
  // Bestehende Felder behalten (IDs!), neue anhängen, Regeln setzen
  const alteFelder = new Map(vorhanden.schema.map((f) => [f.name, f]));

  // Felder, deren Typ sich geändert hat, müssen neu angelegt werden —
  // PocketBase lehnt einen Typwechsel ab ("Field type cannot be changed").
  const getauscht = await typwechselBehandeln(def, vorhanden, alteFelder);

  const schema = def.schema.map((f) =>
    alteFelder.has(f.name) && !getauscht.has(f.name)
      ? { ...alteFelder.get(f.name), ...f, id: alteFelder.get(f.name).id }
      : f,
  );
  for (const [name, f] of alteFelder) {
    if (!def.schema.some((d) => d.name === name)) schema.push(f);
  }
  await pb.collections.update(vorhanden.id, {
    schema,
    indexes: def.indexes ?? vorhanden.indexes,
    listRule: def.listRule,
    viewRule: def.viewRule,
    createRule: def.createRule,
    updateRule: def.updateRule,
    deleteRule: def.deleteRule,
  });

  // Welche Felder sind dazugekommen? Das interessiert beim Nachziehen einer
  // bestehenden Installation — "abgeglichen" allein sagt nicht, ob etwas
  // geschehen ist, und eine Meldung, die immer gleich lautet, liest niemand.
  const neueFelder = def.schema.filter((f) => !alteFelder.has(f.name)).map((f) => f.name);
  if (neueFelder.length) geaendert.set(def.name, neueFelder);
  if (!still) {
    console.log(
      neueFelder.length
        ? `${def.name}: abgeglichen, neu: ${neueFelder.join(", ")}`
        : `${def.name}: abgeglichen`,
    );
  }
  return vorhanden.id;
}

/**
 * Behandelt Felder, deren Typ sich zwischen zwei Ständen geändert hat.
 *
 * PocketBase kann den Typ einer Spalte nicht ändern und antwortet mit
 * "Field type cannot be changed" — der Abgleich bliebe sonst für immer
 * stecken. Ein Typwechsel heißt immer: alte Spalte weg, neue anlegen. Der
 * Inhalt ist dabei verloren, das lässt sich nicht wegdiskutieren.
 *
 * Deshalb die Unterscheidung:
 *   - Collection leer  → wortlos tauschen, es geht nichts verloren.
 *   - Collection voll  → abbrechen und sagen, was passieren würde.
 *                        Mit WERKBOQ_FELDER_TAUSCHEN=ja wird trotzdem
 *                        getauscht.
 *
 * Gibt die Namen der getauschten Felder zurück; der Aufrufer setzt sie ohne
 * alte Kennung neu ins Schema, damit PocketBase sie als neue Spalte anlegt.
 */
async function typwechselBehandeln(def, vorhanden, alteFelder) {
  const konflikte = def.schema.filter((f) => {
    const alt = alteFelder.get(f.name);
    return alt && alt.type !== f.type;
  });
  if (konflikte.length === 0) return new Set();

  const liste = konflikte
    .map((f) => `${f.name}: ${alteFelder.get(f.name).type} → ${f.type}`)
    .join(", ");

  const anzahl = (await pb.collection(def.name).getList(1, 1)).totalItems;

  if (anzahl > 0 && process.env.WERKBOQ_FELDER_TAUSCHEN !== "ja") {
    console.error(
      `\nAbbruch bei "${def.name}": Der Typ dieser Felder hat sich geändert —\n` +
        `  ${liste}\n` +
        `PocketBase kann den Typ einer Spalte nicht ändern; die Spalte muss neu\n` +
        `angelegt werden und ihr bisheriger Inhalt geht dabei verloren. In\n` +
        `"${def.name}" stehen ${anzahl} Datensätze.\n\n` +
        `Wenn dieser Inhalt entbehrlich ist:\n` +
        `  WERKBOQ_FELDER_TAUSCHEN=ja npm run einrichten\n` +
        `Wenn nicht: vorher sichern (Admin-UI → Export) oder die Werte von Hand\n` +
        `in ein neues Feld übertragen.\n`,
    );
    process.exit(1);
  }

  // Erst entfernen, dann legt der Aufrufer sie als neue Felder wieder an.
  // In einem Zug ginge es nicht: derselbe Name, zwei Typen.
  const rest = vorhanden.schema.filter((f) => !konflikte.some((k) => k.name === f.name));
  // Ein Index auf einer Spalte, die gerade verschwindet, lässt das Entfernen
  // scheitern. Er wird unten ohnehin aus def.indexes neu gesetzt.
  const indexeOhne = (vorhanden.indexes ?? []).filter(
    (i) => !konflikte.some((k) => new RegExp(`[(,\\s\`"]${k.name}[)\\s,\`"]`).test(i)),
  );
  await pb.collections.update(vorhanden.id, { schema: rest, indexes: indexeOhne });

  console.log(
    anzahl > 0
      ? `${def.name}: Felder getauscht, Inhalt verworfen (${liste})`
      : `${def.name}: Felder getauscht, Collection war leer (${liste})`,
  );

  for (const k of konflikte) alteFelder.delete(k.name);
  return new Set(konflikte.map((f) => f.name));
}

function ladeEnv(pfad) {
  if (!existsSync(pfad)) return;
  for (const zeile of readFileSync(pfad, "utf8").split("\n")) {
    const m = zeile.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
