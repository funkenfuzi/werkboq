import { deepStrictEqual, ok } from "node:assert";
import { describe, it } from "node:test";
import { AUFTRAGSARTEN, FOTOARTEN } from "../src/daten/typen";
import { UNTERSCHRIFT_ZWECKE } from "../src/daten/unterschrift";
import { VERSANDWEGE } from "../src/daten/versand";
import { PHASENSTUFEN } from "../src/daten/phasen";
import { FAHRTKOSTENARTEN } from "../src/daten/betrieb";
// @ts-expect-error — reines JavaScript ohne Typen, siehe server/schema.mjs
import { ALLE } from "../../../server/schema.mjs";

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
 * Der eigentliche Mangel dahinter — die Definitionen standen doppelt, im
 * Modul und gespiegelt in `einrichten.mjs` — ist seit dem 23. September
 * 2026 behoben: jede Collection steht in genau einer schema.mjs. Der Test
 * bleibt, weil die Konstanten im Code und die Auswahlwerte im Schema
 * trotzdem zwei Stellen sind.
 */

interface Feld {
  name: string;
  type: string;
  required?: boolean;
  options?: { values?: string[] };
}
interface Collection {
  name: string;
  schema: Feld[];
  createRule?: string | null;
  updateRule?: string | null;
  deleteRule?: string | null;
}

/**
 * Seit September 2026 steht das Schema an einer Stelle (server/schema.mjs
 * und die schema.mjs der Pakete) und wird hier als Objekt geladen — kein
 * Suchen im Quelltext mehr, das an Kommentaren oder Einrückung hängen
 * bleiben konnte.
 */
function collection(name: string): Collection | undefined {
  return (ALLE as Collection[]).find((c) => c.name === name);
}

function feld(c: string, f: string): Feld | undefined {
  return collection(c)?.schema.find((x) => x.name === f);
}

/** Die `values` eines Auswahlfelds, oder null, wenn es das Feld nicht gibt. */
function auswahlwerte(c: string, f: string): string[] | null {
  return feld(c, f)?.options?.values ?? null;
}

const faelle: [string, string, readonly string[]][] = [
  ["auftraege", "art", AUFTRAGSARTEN],
  ["auftraege", "phase", PHASENSTUFEN],
  ["betrieb", "fahrtkostenArt", FAHRTKOSTENARTEN],
  ["fotos", "art", FOTOARTEN],
  ["unterschriften", "zweck", UNTERSCHRIFT_ZWECKE],
  ["versand", "weg", VERSANDWEGE],
  ["fahrzeuge", "art", FAHRZEUGARTEN_ERWARTET],
  ["fahrzeugfristen", "art", FRISTARTEN_ERWARTET],
];

describe("Das Schema kennt die Konstanten des Codes", () => {
  for (const [collection, feld, erwartet] of faelle) {
    it(`${collection}.${feld} gibt es überhaupt`, () => {
      ok(
        auswahlwerte(collection, feld) !== null,
        `${collection}.${feld} fehlt in server/schema.mjs bzw. der schema.mjs des Pakets. ` +
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
    const p = collection("positionen")!;
    ok(
      /@request\.data\.zustand = "vorschlag"/.test(p.createRule ?? ""),
      "Ohne diese Bedingung legt man die Position gleich als freigegeben an.",
    );
    ok(
      /@request\.data\.zustand = "vorschlag"/.test(p.updateRule ?? ""),
      "Ohne diese Bedingung setzt der Monteur den Zustand selbst auf freigegeben.",
    );
  });
});

describe("Unterschriften bleiben unveränderlich", () => {
  it("haben keine updateRule", () => {
    const u = collection("unterschriften");
    ok(u, "Collection unterschriften fehlt.");
    ok(
      u.updateRule === null,
      "Eine nachträglich änderbare Unterschrift beweist nichts.",
    );
  });
});

/**
 * Zahlenfelder, in denen Null ein gültiger Wert ist, dürfen nicht
 * `required` sein: PocketBase hält bei Zahlen die Null für „fehlt".
 *
 * Gefunden am 23. September 2026: keine Rechnung mit Übergang der
 * Steuerschuld (ust = 0) ließ sich speichern, kein leerer Angebotsentwurf,
 * keine Hinweiszeile ohne Preis. Die Unit-Tests rechneten richtig — der
 * Fehler lag im Schema, und dort sah niemand nach.
 */
function istPflicht(c: string, f: string): boolean | null {
  const x = feld(c, f);
  return x ? x.required === true : null;
}

describe("Null ist ein gültiger Betrag", () => {
  const nullErlaubt: [string, string][] = [
    ["belege", "netto"],
    ["belege", "ust"],
    ["belege", "brutto"],
    ["belegpositionen", "einzelpreis"],
    ["belegpositionen", "betrag"],
    ["belegpositionen", "ustsatz"],
    ["positionen", "einzelpreis"],
    ["positionen", "ustsatz"],
    ["artikel", "preis"],
    ["artikel", "ustsatz"],
  ];
  for (const [c, f] of nullErlaubt) {
    it(`${c}.${f} ist kein Pflichtfeld`, () => {
      deepStrictEqual(istPflicht(c, f), false);
    });
  }

  it("erkennt ein Pflichtfeld überhaupt (Gegenprobe)", () => {
    deepStrictEqual(istPflicht("belege", "nummer"), true);
    deepStrictEqual(istPflicht("belege", "gibtsnicht"), null);
  });
});
