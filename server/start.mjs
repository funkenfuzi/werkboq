#!/usr/bin/env node
/**
 * Startet PocketBase aus server/. Lädt das Binary beim ersten Mal herunter.
 * Plattformen: macOS (arm64/amd64), Windows (amd64), Linux (amd64/arm64).
 */
import { existsSync, mkdirSync, chmodSync, createWriteStream, unlinkSync } from "node:fs";
import { spawn, execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";

const PB_VERSION = "0.22.21";
const hier = dirname(fileURLToPath(import.meta.url));
const win = process.platform === "win32";
const binary = join(hier, win ? "pocketbase.exe" : "pocketbase");

if (!existsSync(binary)) {
  await herunterladen();
}

const port = process.env.PB_PORT ?? "8090";
const kind = spawn(binary, ["serve", "--http", `0.0.0.0:${port}`, "--dir", join(hier, "pb_data")], {
  stdio: "inherit",
  cwd: hier,
});
kind.on("exit", (code) => process.exit(code ?? 0));

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
