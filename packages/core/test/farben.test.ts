import { deepStrictEqual, ok } from "node:assert";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

/**
 * Jede Farbe, die ein Baustein vergibt, braucht eine Regel im Stylesheet.
 *
 * Anlass: die Daten sagten "fehler", das Stylesheet kannte nur "error".
 * Abgelaufene Fristen, Schadensfotos und die Phase „Verrechnen" waren
 * deshalb grau statt rot — kein Fehler, keine Warnung, nur die falsche
 * Farbe genau dort, wo Rot die ganze Aussage ist.
 *
 * Gelesen wird der Quelltext, nicht importiert: der Kern darf die Bausteine
 * nicht kennen, und die Tabellen stehen in den Bausteinen.
 */

const wurzel = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

function dateien(ordner: string, endung: string): string[] {
  const heraus: string[] = [];
  for (const name of readdirSync(ordner)) {
    if (name === "node_modules" || name === "dist" || name === "test") continue;
    const pfad = join(ordner, name);
    if (statSync(pfad).isDirectory()) heraus.push(...dateien(pfad, endung));
    else if (name.endsWith(endung)) heraus.push(pfad);
  }
  return heraus;
}

/** Alle Werte aus `…_FARBE: Record<…> = { … }` in allen Bausteinen. */
function farbenAusDaten(): Map<string, string[]> {
  const gefunden = new Map<string, string[]>();
  for (const datei of dateien(join(wurzel, "packages"), ".ts")) {
    const text = readFileSync(datei, "utf8");
    for (const m of text.matchAll(/export const (\w*FARBE): Record<[^>]+> = \{([^}]*)\}/g)) {
      const werte = [...m[2]!.matchAll(/:\s*"([a-z]+)"/g)].map((w) => w[1]!);
      for (const w of werte) {
        const wo = gefunden.get(w) ?? [];
        wo.push(`${m[1]} in ${datei.slice(wurzel.length + 1)}`);
        gefunden.set(w, wo);
      }
    }
  }
  return gefunden;
}

const css = dateien(join(wurzel, "apps", "web", "src"), ".css")
  .map((d) => readFileSync(d, "utf8"))
  .join("\n");

/** Neutral ist die Grundfarbe der Plakette und braucht keine eigene Regel. */
function hatRegel(klasse: string, farbe: string): boolean {
  if (farbe === "neutral" && klasse === "wb-plakette") return true;
  return new RegExp(`\\.${klasse}--${farbe}\\b`).test(css);
}

describe("Farben aus den Daten", () => {
  const farben = farbenAusDaten();

  it("findet die Farbtabellen überhaupt", () => {
    // Gegenprobe gegen einen stummen Test: findet der Suchausdruck nichts,
    // wäre „alle haben eine Regel" wahr und wertlos.
    ok(farben.size >= 4, `nur ${farben.size} Farben gefunden`);
    ok(farben.has("fehler"), "die Farbe „fehler“ sollte in den Daten vorkommen");
  });

  it("hat für jede Farbe eine Plakettenregel", () => {
    const ohne = [...farben].filter(([f]) => !hatRegel("wb-plakette", f));
    deepStrictEqual(ohne, []);
  });

  it("hat für jede Farbe eine Punktregel", () => {
    // Die Phasenleiste und der Verlauf färben Punkte mit denselben Namen.
    const ohne = [...farben].filter(([f]) => !hatRegel("wb-punkt", f));
    deepStrictEqual(ohne, []);
  });

  it("erkennt eine fehlende Regel", () => {
    ok(!hatRegel("wb-plakette", "gibtsnicht"));
  });
});
