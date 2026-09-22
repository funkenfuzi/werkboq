import { deepStrictEqual, ok } from "node:assert";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { AUFTRAGSARTEN, FOTOARTEN } from "../src/daten/typen";
import { UNTERSCHRIFT_ZWECKE } from "../src/daten/unterschrift";
import { VERSANDWEGE } from "../src/daten/versand";

/**
 * Die Konstanten der Bausteine liegen absichtlich hier als Kopie und
 * nicht als Import: der Kern darf kein Modul kennen (siehe
 * docs/bausteine.md, Regel 2). Weicht ein Baustein davon ab, schlägt der
 * Test fehl — und genau das soll er, denn dann stimmt auch die
 * Spiegelung in einrichten.mjs nicht mehr.
 */
const FAHRZEUGARTEN_ERWARTET = ["pkw", "kastenwagen", "lkw", "anhaenger", "maschine"];
const FRISTARTEN_ERWARTET = [
  "begutachtung",
  "service",
  "reifen",
  "versicherung",
  "leasing",
  "pruefung",
  "sonstiges",
];

/**
 * Die Auswahlfelder in `einrichten.mjs` müssen zu den Konstanten im Code
 * passen.
 *
 * WARUM ES DIESEN TEST GIBT. Am 21. September 2026 fehlte `auftraege.art`
 * in `einrichten.mjs`, obwohl die Oberfläche die Auftragsart längst
 * anbot. PocketBase nimmt ein unbekanntes Feld beim Speichern
 * WIDERSPRUCHSLOS AN und wirft es weg: der Anwender wählt „Störung", es
 * wird gespeichert, und nach dem Neuladen steht wieder „Projekt" da. Kein
 * Fehler, keine Meldung, nichts im Protokoll.
 *
 * Gefunden hat das kein Test, sondern ein Blick in die Datenbank. Die
 * Browserprüfung lief an dem Fehler vorbei, weil `artVon()` auf „projekt"
 * zurückfällt und genau ein Projekt geprüft wurde — der Rückfall sah aus
 * wie ein Ergebnis.
 *
 * Der eigentliche Mangel dahinter steht in docs/fahrplan.md: die
 * Collection-Definitionen liegen doppelt, im Modul und gespiegelt in
 * `einrichten.mjs`. Solange das so ist, wacht dieser Test darüber, dass
 * die beiden Stände nicht auseinanderlaufen.
 */

const wurzel = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const quelle = readFileSync(join(wurzel, "server", "einrichten.mjs"), "utf8");

/**
 * Holt die `values` eines Auswahlfelds aus dem Quelltext.
 *
 * Gelesen wird als Text und nicht durch Import: `einrichten.mjs` verbindet
 * sich beim Laden mit PocketBase. Ein Test, der dafür einen Server
 * braucht, läuft in der Fließbandprüfung nicht.
 */
function auswahlwerte(collection: string, feld: string): string[] | null {
  const ab = quelle.indexOf(`name: "${collection}"`);
  if (ab < 0) return null;
  // Bis zur nächsten Collection-Definition suchen, damit ein gleichnamiges
  // Feld einer anderen Collection nicht fälschlich trifft.
  const bis = quelle.indexOf('\n    name: "', ab + 1);
  const abschnitt = quelle.slice(ab, bis < 0 ? undefined : bis);

  const feldAb = abschnitt.indexOf(`name: "${feld}"`);
  if (feldAb < 0) return null;
  const werte = /values:\s*\[([^\]]*)\]/.exec(abschnitt.slice(feldAb));
  if (!werte) return null;
  return [...werte[1]!.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
}

const faelle: [string, string, readonly string[]][] = [
  ["auftraege", "art", AUFTRAGSARTEN],
  ["fotos", "art", FOTOARTEN],
  ["unterschriften", "zweck", UNTERSCHRIFT_ZWECKE],
  ["versand", "weg", VERSANDWEGE],
  ["fahrzeuge", "art", FAHRZEUGARTEN_ERWARTET],
  ["fahrzeugfristen", "art", FRISTARTEN_ERWARTET],
];

describe("einrichten.mjs spiegelt die Konstanten", () => {
  for (const [collection, feld, erwartet] of faelle) {
    it(`${collection}.${feld} gibt es überhaupt`, () => {
      ok(
        auswahlwerte(collection, feld) !== null,
        `${collection}.${feld} fehlt in server/einrichten.mjs. ` +
          `PocketBase nimmt das Feld beim Speichern trotzdem an und wirft es weg — ` +
          `die Oberfläche sieht dann richtig aus und speichert nichts.`,
      );
    });

    it(`${collection}.${feld} kennt dieselben Werte wie der Code`, () => {
      deepStrictEqual(auswahlwerte(collection, feld), [...erwartet]);
    });
  }
});

describe("Positionen: Zustand", () => {
  it("kennt vorschlag und freigegeben", () => {
    // Fehlt hier ein Wert, lehnt PocketBase die Freigabe ab — oder,
    // schlimmer, die Regel greift ins Leere und jeder darf freigeben.
    deepStrictEqual(auswahlwerte("positionen", "zustand"), ["vorschlag", "freigegeben"]);
  });

  it("hat eine Regel, die die Freigabe an das Lagerrecht bindet", () => {
    ok(
      /createRule:.*@request\.data\.zustand = "vorschlag"/.test(quelle),
      "Ohne diese Bedingung legt man die Position gleich als freigegeben an.",
    );
    ok(
      /updateRule:[\s\S]{0,200}@request\.data\.zustand = "vorschlag"/.test(quelle),
      "Ohne diese Bedingung setzt der Monteur den Zustand selbst auf freigegeben.",
    );
  });
});

describe("Unterschriften bleiben unveränderlich", () => {
  it("haben keine updateRule", () => {
    const ab = quelle.indexOf('name: "unterschriften"');
    ok(ab > 0, "Collection unterschriften fehlt.");
    const abschnitt = quelle.slice(ab, ab + 900);
    ok(
      /updateRule:\s*null/.test(abschnitt),
      "Eine nachträglich änderbare Unterschrift beweist nichts.",
    );
  });
});
