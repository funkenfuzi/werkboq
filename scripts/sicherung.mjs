#!/usr/bin/env node
/**
 * Datensicherung auf Knopfdruck — und an einen anderen Ort.
 *
 *   npm run sicherung                 Sicherung erstellen und herunterladen
 *   npm run sicherung -- liste        vorhandene Sicherungen zeigen
 *
 * PocketBase sichert jede Nacht selbst (eingeschaltet von einrichten.mjs),
 * aber nach pb_data/backups — auf demselben Rechner wie die Datenbank.
 * Stirbt die Festplatte, sind beide weg. Dieses Skript erstellt eine
 * frische Sicherung und legt eine Kopie dorthin, wo SICHERUNG_ZIEL in der
 * .env zeigt: ein USB-Stick, ein Netzlaufwerk, ein Cloud-Ordner. Ohne
 * Angabe landet sie in ./sicherungen neben dem Projekt.
 *
 * Die ZIP enthält die ganze Datenbank samt hochgeladener Dateien, erstellt
 * von PocketBase im laufenden Betrieb und in sich stimmig — anders als eine
 * Kopie von data.db, der die WAL-Datei daneben fehlt. Wiederherstellen:
 * docs/sicherung.md.
 */
import PocketBase from "pocketbase";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const hier = dirname(fileURLToPath(import.meta.url));
ladeEnv(join(hier, "..", ".env"));

const PB_URL = process.env.PB_URL ?? process.env.VITE_PB_URL ?? "http://127.0.0.1:8095";
const EMAIL = process.env.PB_ADMIN_EMAIL;
const PASSWORT = process.env.PB_ADMIN_PASSWORD;
const ZIEL = resolve(join(hier, ".."), process.env.SICHERUNG_ZIEL || "sicherungen");

if (!EMAIL || !PASSWORT) {
  console.error("PB_ADMIN_EMAIL und PB_ADMIN_PASSWORD setzen (siehe .env.example).");
  process.exit(1);
}

const pb = new PocketBase(PB_URL);
try {
  await pb.admins.authWithPassword(EMAIL, PASSWORT);
} catch (e) {
  console.error(`Anmeldung an ${PB_URL} fehlgeschlagen: ${e?.message ?? e}. Läuft der Server (npm start)?`);
  process.exit(1);
}

const groesse = (bytes) =>
  bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.ceil(bytes / 1024)} kB`;

if (process.argv.includes("liste")) {
  const liste = (await pb.backups.getFullList()).sort((a, b) => b.modified.localeCompare(a.modified));
  if (!liste.length) console.log("Noch keine Sicherung auf dem Server.");
  for (const b of liste) console.log(`${b.modified.slice(0, 16).replace("T", " ")}  ${groesse(b.size).padStart(9)}  ${b.key}`);
  const s = await pb.settings.getAll();
  console.log(
    s.backups?.cron
      ? `\nNächtlich: ${s.backups.cron}, es bleiben die letzten ${s.backups.cronMaxKeep}.`
      : "\nKeine nächtliche Sicherung eingestellt — npm run einrichten schaltet sie ein.",
  );
  process.exit(0);
}

const jetzt = new Date();
const zwei = (n) => String(n).padStart(2, "0");
// PocketBase erlaubt im Namen nur Kleinbuchstaben, Ziffern, _ und -.
const name = `werkboq_${jetzt.getFullYear()}${zwei(jetzt.getMonth() + 1)}${zwei(jetzt.getDate())}_${zwei(jetzt.getHours())}${zwei(jetzt.getMinutes())}.zip`;

console.log(`Sicherung ${name} wird erstellt …`);
await pb.backups.create(name);

const token = await pb.files.getToken();
const url = pb.backups.getDownloadUrl(token, name);
const antwort = await fetch(url);
if (!antwort.ok) {
  console.error(`Herunterladen fehlgeschlagen (${antwort.status}). Die Sicherung liegt trotzdem auf dem Server in pb_data/backups.`);
  process.exit(1);
}
const inhalt = Buffer.from(await antwort.arrayBuffer());

// Eine ZIP fängt mit „PK" an. Eine Fehlerseite, als .zip gespeichert,
// sähe aus wie eine Sicherung — bis man sie braucht.
if (inhalt.length < 100 || inhalt[0] !== 0x50 || inhalt[1] !== 0x4b) {
  console.error("Was heruntergeladen wurde, ist keine ZIP-Datei. Nichts gespeichert.");
  process.exit(1);
}

if (!existsSync(ZIEL)) mkdirSync(ZIEL, { recursive: true });
const pfad = join(ZIEL, name);
writeFileSync(pfad, inhalt);
console.log(`Gespeichert: ${pfad} (${groesse(statSync(pfad).size)})`);
if (!process.env.SICHERUNG_ZIEL) {
  console.log(
    "Hinweis: das ist noch derselbe Rechner. SICHERUNG_ZIEL in der .env auf einen Stick,\n" +
      "ein Netzlaufwerk oder einen Cloud-Ordner zeigen lassen — sonst hilft die Sicherung\n" +
      "nicht, wenn der Rechner ausfällt.",
  );
}

function ladeEnv(pfad) {
  if (!existsSync(pfad)) return;
  for (const zeile of readFileSync(pfad, "utf8").split("\n")) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/.exec(zeile);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
