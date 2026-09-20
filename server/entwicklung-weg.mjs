#!/usr/bin/env node
/**
 * Entfernt alle Entwicklungszugänge und stellt die Passwortregeln wieder her.
 *
 * Löscht jeden Benutzer mit entwicklung=true (also den Zugang adm/adm und
 * alles, was sonst noch so gekennzeichnet wurde) und setzt die Mindestlänge
 * für Passwörter in der users-Collection zurück auf 8 Zeichen.
 *
 * Vor jeder echten Inbetriebnahme ausführen:
 *   npm run entwicklung-weg
 *
 * Die normalen Benutzer bleiben unangetastet. Läuft auch dann sauber durch,
 * wenn gar kein Entwicklungszugang existiert.
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

const pb = new PocketBase(PB_URL);
await pb.admins.authWithPassword(EMAIL, PASSWORT);
console.log(`Verbunden mit ${PB_URL}`);

// 1. Entwicklungskonten löschen
const konten = await pb.collection("users").getFullList({ filter: "entwicklung = true" });
if (konten.length === 0) {
  console.log("Keine Entwicklungszugänge gefunden.");
} else {
  for (const k of konten) {
    await pb.collection("users").delete(k.id);
    console.log(`gelöscht: ${k.username || k.email}`);
  }
}

// 2. Passwort-Mindestlänge zurücksetzen
const users = await pb.collections.getOne("users");
if ((users.options?.minPasswordLength ?? 8) < 8) {
  await pb.collections.update(users.id, {
    options: { ...users.options, minPasswordLength: 8 },
  });
  console.log("users: Mindestlänge für Passwörter wieder auf 8 gesetzt");
}

// 3. Warnen, falls überhaupt kein Benutzer übrig ist
const rest = await pb.collection("users").getList(1, 1);
if (rest.totalItems === 0) {
  console.warn(
    "\nAchtung: Es existiert jetzt kein einziger Anwendungsbenutzer mehr.\n" +
      "Lege einen an, bevor du dich anmelden willst — z. B. über WB_BENUTZER_*\n" +
      "in der .env und 'npm run einrichten'.\n",
  );
}

console.log("Fertig.");

function ladeEnv(pfad) {
  if (!existsSync(pfad)) return;
  for (const zeile of readFileSync(pfad, "utf8").split("\n")) {
    const m = zeile.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
