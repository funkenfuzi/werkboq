#!/usr/bin/env node
/**
 * Richtet PocketBase für Werkboq ein – idempotent.
 *
 * Legt alle Kern-Collections und alle Modul-Collections an bzw. gleicht sie ab.
 * Mehrfach ausführbar; ersetzt jede Form von Migrationen.
 *
 * Voraussetzung: PocketBase läuft (npm run server) und es gibt einen Admin.
 *   PB_URL, PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD aus .env oder Umgebung.
 */
import PocketBase from "pocketbase";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const hier = dirname(fileURLToPath(import.meta.url));
ladeEnv(join(hier, "..", ".env"));

const PB_URL = process.env.PB_URL ?? process.env.VITE_PB_URL ?? "http://127.0.0.1:8090";
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

console.log("Einrichtung abgeschlossen.");

// ---------------------------------------------------------------------------

async function benutzerErgaenzen() {
  const users = await pb.collections.getOne("users");
  const vorhanden = new Set(users.schema.map((f) => f.name));
  const neu = [];
  if (!vorhanden.has("name")) neu.push({ name: "name", type: "text" });
  if (!vorhanden.has("bereiche")) neu.push({ name: "bereiche", type: "json" });
  if (!vorhanden.has("admin")) neu.push({ name: "admin", type: "bool" });
  if (neu.length === 0) return;
  await pb.collections.update(users.id, { schema: [...users.schema, ...neu] });
  console.log(`users: ${neu.map((f) => f.name).join(", ")} ergänzt`);
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
