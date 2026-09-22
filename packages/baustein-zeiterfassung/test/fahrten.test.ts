import { strictEqual } from "node:assert";
import { describe, it } from "node:test";
import { kmGesamt, summeKm } from "../src/daten/fahrten";

/**
 * Kilometer einer Fahrt.
 *
 * Gespeichert wird die einfache Strecke und ob hin und retour — daraus
 * entsteht die Zahl, die auf der Rechnung landet. Ein Fehler hier ist ein
 * Fehler auf jeder Rechnung mit Fahrtkosten.
 */
describe("kmGesamt", () => {
  it("verdoppelt bei hin und retour", () => {
    strictEqual(kmGesamt({ kmEinfach: 42, hinRetour: true }), 84);
  });

  it("nimmt die einfache Strecke, wenn nur eine Richtung", () => {
    strictEqual(kmGesamt({ kmEinfach: 42, hinRetour: false }), 42);
  });

  it("rundet auf ganze Kilometer, bevor verdoppelt wird", () => {
    // 12,4 → 12 → 24, nicht 24,8 → 25. So steht es auch in der Liste: „2 × 12 km".
    strictEqual(kmGesamt({ kmEinfach: 12.4, hinRetour: true }), 24);
  });

  it("macht aus Unsinn null statt einer negativen Zahl", () => {
    strictEqual(kmGesamt({ kmEinfach: -5, hinRetour: true }), 0);
    strictEqual(kmGesamt({ kmEinfach: Number.NaN, hinRetour: true }), 0);
  });
});

describe("summeKm", () => {
  it("zählt verschiedene Fahrten zusammen", () => {
    strictEqual(
      summeKm([
        { kmEinfach: 42, hinRetour: true },
        { kmEinfach: 10, hinRetour: false },
      ]),
      94,
    );
  });

  it("ist null ohne Fahrten", () => {
    strictEqual(summeKm([]), 0);
  });
});
