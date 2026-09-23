import { angemeldet, nurAdmin } from "./regeln.mjs";

/** Kern-Collections. Reihenfolge beachten: Relationen zeigen nur nach oben. */
export default [
  {
    // Stammdaten des eigenen Betriebs. Genau ein Datensatz; die Angaben
    // landen später auf Angebot und Rechnung, wo UID und Firmenbuchnummer
    // nach § 11 UStG Pflicht sind.
    name: "betrieb",
    schema: [
      { name: "name", type: "text", required: true },
      // Phasen je Auftragsart, wie dieser Betrieb sie nennt. Leer heißt
      // Voreinstellung. JSON, weil es je Art eine geordnete Liste ist.
      { name: "phasen", type: "json", options: { maxSize: 20000 } },
      { name: "fahrtkostenArt", type: "select", options: { maxSelect: 1, values: ["km", "pauschale", "keine"] } },
      { name: "kmSatz", type: "number", options: { min: 0, noDecimal: true } },
      { name: "anfahrtPauschale", type: "number", options: { min: 0, noDecimal: true } },
      // Nachfassrhythmus für Angebote in Tagen, etwa [7, 14, 30]. Leer heißt
      // Voreinstellung.
      { name: "nachfassTage", type: "json", options: { maxSize: 2000 } },
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
        // Das feste Gerüst — siehe packages/core/src/daten/phasen.ts. Wie
        // eine Stufe je Auftragsart heißt, steht am Betrieb, nicht hier.
        // Bestandsdaten mit den alten zehn Phasen schlüsselt
        // phasenUmschluesseln() weiter unten um, bevor dieses Feld
        // eingeschränkt wird.
        name: "phase",
        type: "select",
        required: true,
        options: {
          maxSelect: 1,
          values: ["eingang", "angebot", "beauftragt", "in_arbeit", "fertig", "verrechnen", "abgeschlossen"],
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
