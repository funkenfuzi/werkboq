#!/usr/bin/env node
/**
 * Werkboq starten — ein Befehl für alles.
 *
 * Bisher waren es drei Handgriffe in zwei Fenstern: Abhängigkeiten
 * installieren, PocketBase starten, Schema abgleichen, Oberfläche starten.
 * Jeder davon lässt sich vergessen, und dann steht da "PocketBase ist nicht
 * erreichbar" oder eine Seite, die eine Collection sucht, die es noch nicht
 * gibt. Dieses Skript macht die Reihenfolge selbst:
 *
 *   1. npm install, wenn sich die Paketliste geändert hat
 *   2. PocketBase starten und warten, bis sie antwortet
 *   3. npm run einrichten — idempotent, kostet bei gleichem Stand nichts
 *   4. Vite starten
 *
 * Strg+C beendet beide Prozesse.
 *
 * Für den Alltag heißt das: nach jeder Lieferung einmal `npm start`, und
 * alles Weitere macht Vite von selbst — geänderte Dateien landen ohne
 * Neuladen im Browser.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const hier = dirname(fileURLToPath(import.meta.url));
const wurzel = join(hier, "..");
const win = process.platform === "win32";
const npm = win ? "npm.cmd" : "npm";

const port = process.env.PB_PORT ?? "8095";
const gesundheit = `http://127.0.0.1:${port}/api/health`;

/** Farbige Vorspann-Zeile, damit man sieht, wer gerade spricht. */
function sag(wer, text) {
  const farbe = { werkboq: "\x1b[36m", pocketbase: "\x1b[35m", web: "\x1b[32m" }[wer] ?? "";
  process.stdout.write(`${farbe}${wer.padEnd(10)}\x1b[0m ${text}\n`);
}

const kinder = [];
function aufraeumen() {
  for (const k of kinder) {
    if (!k.killed) k.kill("SIGTERM");
  }
}
process.on("SIGINT", () => {
  sag("werkboq", "wird beendet …");
  aufraeumen();
  process.exit(0);
});
process.on("SIGTERM", () => {
  aufraeumen();
  process.exit(0);
});

// ---------------------------------------------------------------- 1. Pakete

function paketeFehlen() {
  const module = join(wurzel, "node_modules");
  if (!existsSync(module)) return true;
  // package-lock.json neuer als node_modules heißt: es kam etwas dazu.
  const sperre = join(wurzel, "package-lock.json");
  if (!existsSync(sperre)) return false;
  try {
    return statSync(sperre).mtimeMs > statSync(module).mtimeMs;
  } catch {
    return false;
  }
}

if (paketeFehlen()) {
  sag("werkboq", "Abhängigkeiten haben sich geändert — npm install läuft …");
  const ergebnis = spawnSync(npm, ["install"], { cwd: wurzel, stdio: "inherit" });
  if (ergebnis.status !== 0) {
    sag("werkboq", "npm install ist fehlgeschlagen. Abbruch.");
    process.exit(1);
  }
} else {
  sag("werkboq", "Abhängigkeiten sind aktuell.");
}

// ----------------------------------------------------------- 2. PocketBase

sag("werkboq", `PocketBase wird gestartet (Port ${port}) …`);
const server = spawn(process.execPath, [join(wurzel, "server", "start.mjs")], {
  cwd: wurzel,
  stdio: ["ignore", "pipe", "pipe"],
});
kinder.push(server);
anhaengen(server, "pocketbase");

const bereit = await warteAufServer(60);
if (!bereit) {
  sag("werkboq", `PocketBase antwortet nicht unter ${gesundheit}. Abbruch.`);
  aufraeumen();
  process.exit(1);
}
sag("werkboq", "PocketBase läuft.");

// ------------------------------------------------------------ 3. Einrichten

sag("werkboq", "Schema wird abgeglichen …");
const einrichten = spawnSync(process.execPath, [join(wurzel, "server", "einrichten.mjs")], {
  cwd: wurzel,
  stdio: "inherit",
});
if (einrichten.status !== 0) {
  sag("werkboq", "Das Einrichten ist fehlgeschlagen — die Meldung darüber sagt warum.");
  aufraeumen();
  process.exit(1);
}

// ------------------------------------------------------------------ 4. Web

sag("werkboq", "Oberfläche wird gestartet …");
const web = spawn(npm, ["run", "dev", "--workspace", "apps/web"], {
  cwd: wurzel,
  stdio: ["ignore", "pipe", "pipe"],
});
kinder.push(web);
anhaengen(web, "web");

web.on("exit", (code) => {
  sag("werkboq", `Die Oberfläche hat sich beendet (${code}).`);
  aufraeumen();
  process.exit(code ?? 0);
});
server.on("exit", (code) => {
  sag("werkboq", `PocketBase hat sich beendet (${code}).`);
  aufraeumen();
  process.exit(code ?? 0);
});

// ------------------------------------------------------------------ Helfer

function anhaengen(kind, name) {
  for (const strom of [kind.stdout, kind.stderr]) {
    let rest = "";
    strom?.on("data", (stueck) => {
      const zeilen = (rest + stueck.toString()).split("\n");
      rest = zeilen.pop() ?? "";
      for (const z of zeilen) if (z.trim()) sag(name, z);
    });
  }
}

async function warteAufServer(sekunden) {
  for (let i = 0; i < sekunden * 2; i++) {
    try {
      const antwort = await fetch(gesundheit, { signal: AbortSignal.timeout(1000) });
      if (antwort.ok) return true;
    } catch {
      /* noch nicht da */
    }
    await new Promise((f) => setTimeout(f, 500));
  }
  return false;
}
