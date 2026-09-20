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
    name: "termine",
    schema: [
      { name: "auftrag", type: "relation", required: true, options: { collectionId: "auftraege", maxSelect: 1, cascadeDelete: true } },
      { name: "titel", type: "text", required: true },
      { name: "beginn", type: "date", required: true },
      { name: "ende", type: "date" },
      { name: "ort", type: "text" },
      { name: "notizen", type: "text" },
    ],
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
      { name: "daten", type: "json" },
      { name: "pdf", type: "file", options: { maxSelect: 1, maxSize: 20971520, mimeTypes: ["application/pdf"] } },
    ],
  },
];

const pb = new PocketBase(PB_URL);
await pb.admins.authWithPassword(EMAIL, PASSWORT);
console.log(`Verbunden mit ${PB_URL}`);

// Sicherstellen, dass dies wirklich die Werkboq-Datenbank ist
await datenbankPruefen();

// users-Collection um Werkboq-Felder ergänzen
await benutzerErgaenzen();

const ids = new Map();
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

console.log("Einrichtung abgeschlossen.");

// ---------------------------------------------------------------------------

const MARKER = "werkboq_meta";

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
  const vorhanden = new Set(users.schema.map((f) => f.name));
  const neu = [];
  if (!vorhanden.has("name")) neu.push({ name: "name", type: "text" });
  if (!vorhanden.has("bereiche")) neu.push({ name: "bereiche", type: "json" });
  if (!vorhanden.has("admin")) neu.push({ name: "admin", type: "bool" });
  // Kennzeichnet Konten, die nur zum Entwickeln existieren und später
  // mit "npm run entwicklung-weg" restlos entfernt werden.
  if (!vorhanden.has("entwicklung")) neu.push({ name: "entwicklung", type: "bool" });
  if (neu.length === 0) return;
  await pb.collections.update(users.id, { schema: [...users.schema, ...neu] });
  console.log(`users: ${neu.map((f) => f.name).join(", ")} ergänzt`);
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

  const users = await pb.collections.getOne("users");
  if ((users.options?.minPasswordLength ?? 8) > 3) {
    await pb.collections.update(users.id, {
      options: { ...users.options, minPasswordLength: 3 },
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
    password: "adm",
    passwordConfirm: "adm",
    name: "Entwicklung",
    admin: true,
    entwicklung: true,
    bereiche: KERN_BEREICHE_UND_MODULE,
    emailVisibility: false,
    verified: true,
  });

  console.log(
    "\n*** Entwicklungszugang angelegt: Benutzer adm, Passwort adm ***\n" +
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

/** Alle Bereiche, die der erste Benutzer bekommt. */
const KERN_BEREICHE_UND_MODULE = [
  "verwaltung",
  "buchhaltung",
  "technik",
  "lager",
  "entwickler",
  "elektro",
];

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
