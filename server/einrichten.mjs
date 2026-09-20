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
/** Marker-Collection, die diese Datenbank als Werkboq-Datenbank kennzeichnet. */
const MARKER = "werkboq_meta";

/** Alle Bereiche, die der erste Benutzer bekommt. */
const KERN_BEREICHE_UND_MODULE = [
  "verwaltung",
  "buchhaltung",
  "technik",
  "lager",
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
      { name: "modul", type: "text" },
      { name: "beschreibung", type: "editor" },
      { name: "beginn", type: "date" },
      { name: "ende", type: "date" },
    ],
    indexes: ["CREATE UNIQUE INDEX idx_auftraege_nummer ON auftraege (nummer)"],
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
      { name: "datei", type: "file", required: true, options: { maxSelect: 1, maxSize: 20971520, mimeTypes: ["image/jpeg", "image/png", "image/heic", "image/webp"] } },
      { name: "beschreibung", type: "text" },
      { name: "aufgenommen", type: "date" },
    ],
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
  ids.set("users", (await pb.collections.getOne("users")).id);

  for (const c of [...KERN, ...MODULE]) {
    const schema = c.schema.map((f) => {
      if (f.type === "relation" && f.options?.collectionId && ids.has(f.options.collectionId)) {
        return { ...f, options: { ...f.options, collectionId: ids.get(f.options.collectionId) } };
      }
      return f;
    });
    const id = await collectionAbgleichen({ ...standardRegeln, ...c, schema });
    ids.set(c.name, id);
  }

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
    const unsere = new Set([...KERN, ...MODULE].map((c) => c.name));
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

async function collectionAbgleichen(def) {
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
  const schema = def.schema.map((f) => (alteFelder.has(f.name) ? { ...alteFelder.get(f.name), ...f, id: alteFelder.get(f.name).id } : f));
  for (const [name, f] of alteFelder) if (!def.schema.some((d) => d.name === name)) schema.push(f);
  await pb.collections.update(vorhanden.id, {
    schema,
    indexes: def.indexes ?? vorhanden.indexes,
    listRule: def.listRule,
    viewRule: def.viewRule,
    createRule: def.createRule,
    updateRule: def.updateRule,
    deleteRule: def.deleteRule,
  });
  console.log(`${def.name}: abgeglichen`);
  return vorhanden.id;
}

function ladeEnv(pfad) {
  if (!existsSync(pfad)) return;
  for (const zeile of readFileSync(pfad, "utf8").split("\n")) {
    const m = zeile.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
