import { deepStrictEqual, strictEqual } from "node:assert";
import { describe, it } from "node:test";
import {
  artVon,
  AUFTRAGSARTEN,
  AUFTRAG_PHASEN,
  PHASEN_JE_ART,
  phasenFuer,
  type Auftrag,
} from "../src/daten/typen";

const auftrag = (art: unknown, phase: string) =>
  ({ art, phase }) as unknown as Auftrag;

/**
 * Die Auftragsart entscheidet, was ein Anwender zu sehen bekommt. Ein
 * Fehler hier heißt entweder eine Phasenleiste voller Lärm oder — schlimmer
 * — eine, in der der aktuelle Zustand fehlt.
 */

describe("artVon", () => {
  it("nimmt die gesetzte Art", () => {
    strictEqual(artVon(auftrag("stoerung", "anfrage")), "stoerung");
  });

  it("hält alte Aufträge ohne Art für Projekte", () => {
    strictEqual(artVon(auftrag(undefined, "anfrage")), "projekt");
    strictEqual(artVon(auftrag("", "anfrage")), "projekt");
  });

  it("fällt bei Unbekanntem auf Projekt zurück, statt zu werfen", () => {
    strictEqual(artVon(auftrag("gartenzaun", "anfrage")), "projekt");
  });
});

describe("Phasen je Art", () => {
  it("gibt der Störung drei Phasen — mehr klickt niemand durch", () => {
    deepStrictEqual(PHASEN_JE_ART.stoerung, ["anfrage", "errichtung", "abgeschlossen"]);
  });

  it("gibt dem Projekt alle bis auf den Materialverkauf und die Wartung", () => {
    strictEqual(PHASEN_JE_ART.projekt.includes("materialverkauf"), false);
    strictEqual(PHASEN_JE_ART.projekt.includes("wartung"), false);
    strictEqual(PHASEN_JE_ART.projekt.length, 8);
  });

  it("kennt nur der Materialverkauf seine eigene Phase", () => {
    for (const art of AUFTRAGSARTEN) {
      strictEqual(
        PHASEN_JE_ART[art].includes("materialverkauf"),
        art === "materialverkauf",
        `${art} sollte den Materialverkauf ${art === "materialverkauf" ? "" : "nicht "}führen`,
      );
    }
  });

  it("führt nur die Wartung die Wartungsphase", () => {
    for (const art of AUFTRAGSARTEN) {
      strictEqual(PHASEN_JE_ART[art].includes("wartung"), art === "wartung");
    }
  });

  it("beginnt jede Art mit der Anfrage und endet mit Abgeschlossen", () => {
    for (const art of AUFTRAGSARTEN) {
      strictEqual(PHASEN_JE_ART[art][0], "anfrage", `${art} beginnt falsch`);
      strictEqual(PHASEN_JE_ART[art].at(-1), "abgeschlossen", `${art} endet falsch`);
    }
  });

  it("verwendet nur Phasen, die es wirklich gibt", () => {
    for (const art of AUFTRAGSARTEN) {
      for (const p of PHASEN_JE_ART[art]) {
        strictEqual(
          (AUFTRAG_PHASEN as readonly string[]).includes(p),
          true,
          `${art}: ${p} ist keine bekannte Phase`,
        );
      }
    }
  });

  it("hält die Reihenfolge der Gesamtliste ein", () => {
    // Sonst steht die Leiste bei einer Art anders herum als bei der nächsten.
    for (const art of AUFTRAGSARTEN) {
      const stellen = PHASEN_JE_ART[art].map((p) => AUFTRAG_PHASEN.indexOf(p));
      const sortiert = [...stellen].sort((a, b) => a - b);
      deepStrictEqual(stellen, sortiert, `${art} ist nicht in der Grundreihenfolge`);
    }
  });
});

describe("phasenFuer", () => {
  it("liefert die Phasen der Art", () => {
    deepStrictEqual(phasenFuer(auftrag("stoerung", "errichtung")), [
      "anfrage",
      "errichtung",
      "abgeschlossen",
    ]);
  });

  it("behält eine fremde Phase, statt sie verschwinden zu lassen", () => {
    // Ein Projekt, das nachträglich auf Störung umgestellt wird, steht
    // vielleicht in "angebot". Fiele die Phase aus der Leiste, wüsste
    // niemand mehr, wo der Auftrag steht.
    const p = phasenFuer(auftrag("stoerung", "angebot"));
    strictEqual(p.includes("angebot"), true);
    strictEqual(p.length, 4);
  });

  it("hängt die fremde Phase hinten an und verdrängt nichts", () => {
    const p = phasenFuer(auftrag("stoerung", "angebot"));
    deepStrictEqual(p.slice(0, 3), ["anfrage", "errichtung", "abgeschlossen"]);
    strictEqual(p.at(-1), "angebot");
  });

  it("zeigt einem alten Auftrag ohne Art die volle Projektleiste", () => {
    strictEqual(phasenFuer(auftrag(undefined, "spezifikation")).length, 8);
  });
});
