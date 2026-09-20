#!/usr/bin/env node
/**
 * Startet PocketBase aus server/. Lädt das Binary beim ersten Mal herunter und
 * legt beim ersten Start auch gleich den Admin aus der .env an — der Umweg über
 * das Admin-UI im Browser entfällt damit.
 *
 * Plattformen: macOS (arm64/amd64), Windows (amd64), Linux (amd64/arm64).
 */
import { existsSync, mkdirSync, chmodSync, createWriteStream, unlinkSync, readFileSync } from "node:fs";
import { spawn, execFileSync, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";

const PB_VERSION = "0.22.21";
const hier = dirname(fileURLToPath(import.meta.url));
const win = process.platform === "win32";
const binary = join(hier, win ? "pocketbase.exe" : "pocketbase");
const datenVerzeichnis = join(hier, "pb_data");

ladeEnv(join(hier, "..", ".env"));

if (!existsSync(binary)) {
  await herunterladen();
}

adminAnlegen();

// 8095 statt PocketBase-Standard 8090, damit Werkboq keiner anderen lokal
// laufenden PocketBase (z. B. FD-Book) in die Quere kommt.
const port = process.env.PB_PORT ?? "8095";
console.log(`PocketBase auf http://127.0.0.1:${port} (Admin-UI: /_/)`);
const kind = spawn(binary, ["serve", "--http", `0.0.0.0:${port}`, "--dir", datenVerzeichnis], {
  stdio: "inherit",
  cwd: hier,
});
kind.on("exit", (code) => process.exit(code ?? 0));

/**
 * Legt den Admin aus PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD an, sofern gesetzt.
 * Muss vor dem Serverstart laufen, weil die Kommandozeile direkt auf die
 * Datenbankdatei zugreift. Existiert der Admin schon, meldet PocketBase einen
 * Fehler — den schlucken wir, der Aufruf ist dadurch beliebig wiederholbar.
 */
function adminAnlegen() {
  const email = process.env.PB_ADMIN_EMAIL;
  const passwort = process.env.PB_ADMIN_PASSWORD;
  if (!email || !passwort) {
    console.log("PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD nicht gesetzt – Admin nicht angelegt.");
    return;
  }
  if (passwort.length < 8) {
    console.error("PB_ADMIN_PASSWORD muss mindestens 8 Zeichen haben – Admin nicht angelegt.");
    return;
  }

  // 0.22 kennt "admin create", ab 0.23 heißt es "superuser upsert".
  const varianten = [
    ["admin", "create", email, passwort],
    ["superuser", "upsert", email, passwort],
  ];
  for (const argumente of varianten) {
    try {
      execFileSync(binary, [...argumente, "--dir", datenVerzeichnis], { stdio: "pipe" });
      console.log(`Admin ${email} angelegt.`);
      return;
    } catch (e) {
      const meldung = String(e.stderr ?? "") + String(e.stdout ?? "");
      if (/already exists|unique|bereits/i.test(meldung)) {
        return; // alles gut, gibt es schon
      }
      // sonst: nächste Variante probieren
    }
  }
  console.warn(
    `Admin konnte nicht über die Kommandozeile angelegt werden.\n` +
      `Falls die Anmeldung scheitert, einmalig im Browser unter\n` +
      `http://127.0.0.1:${process.env.PB_PORT ?? "8095"}/_/ anlegen.`,
  );
}

async function herunterladen() {
  const os = { darwin: "darwin", win32: "windows", linux: "linux" }[process.platform];
  const arch = { arm64: "arm64", x64: "amd64" }[process.arch];
  if (!os || !arch) throw new Error(`Keine PocketBase-Version für ${process.platform}/${process.arch}`);
  const datei = `pocketbase_${PB_VERSION}_${os}_${arch}.zip`;
  const url = `https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/${datei}`;
  const zip = join(hier, datei);
  console.log(`Lade PocketBase ${PB_VERSION} …`);
  mkdirSync(hier, { recursive: true });
  const antwort = await fetch(url);
  if (!antwort.ok || !antwort.body) throw new Error(`Download fehlgeschlagen: ${antwort.status}`);
  await pipeline(antwort.body, createWriteStream(zip));
  if (win) {
    execSync(`powershell -Command "Expand-Archive -Force '${zip}' '${hier}'"`);
  } else {
    execSync(`unzip -o "${zip}" -d "${hier}"`);
    chmodSync(binary, 0o755);
  }
  unlinkSync(zip);
  console.log("PocketBase bereit.");
}

function ladeEnv(pfad) {
  if (!existsSync(pfad)) return;
  for (const zeile of readFileSync(pfad, "utf8").split("\n")) {
    const m = zeile.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
