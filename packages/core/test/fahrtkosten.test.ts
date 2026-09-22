import { deepStrictEqual, ok, strictEqual } from "node:assert";
import { describe, it } from "node:test";
import { fahrtkostenZeile } from "../src/daten/betrieb";

/**
 * Wie Fahrten auf die Rechnung kommen.
 *
 * Drei Wege, keiner falsch — der Betrieb stellt ein. Geprüft wird jeder
 * Weg, und jeweils die Gegenprobe: was NICHT auf die Rechnung kommen darf.
 */
const zwei = { fahrten: 2, km: 168 };

describe("fahrtkostenZeile", () => {
  it("rechnet Kilometer mal Satz", () => {
    deepStrictEqual(fahrtkostenZeile({ fahrtkostenArt: "km", kmSatz: 50 }, zwei), {
      bezeichnung: "Fahrtkosten laut Aufzeichnung",
      beschreibung: "2 Fahrten",
      menge: 168,
      einheit: "km",
      einzelpreis: 50,
    });
  });

  it("rechnet eine Pauschale je Fahrt, nicht je Kilometer", () => {
    const z = fahrtkostenZeile({ fahrtkostenArt: "pauschale", anfahrtPauschale: 3500 }, zwei);
    strictEqual(z?.menge, 2);
    strictEqual(z?.einheit, "Pauschale");
    strictEqual(z?.einzelpreis, 3500);
    ok(z?.beschreibung.includes((168).toLocaleString("de-AT")));
  });

  it("verrechnet nichts, wenn der Betrieb es so eingestellt hat", () => {
    strictEqual(fahrtkostenZeile({ fahrtkostenArt: "keine", kmSatz: 50 }, zwei), null);
  });

  it("verrechnet nichts, wenn gar nichts eingestellt ist", () => {
    strictEqual(fahrtkostenZeile(null, zwei), null);
    strictEqual(fahrtkostenZeile({}, zwei), null);
  });

  it("macht ohne Fahrten keine Zeile", () => {
    strictEqual(fahrtkostenZeile({ fahrtkostenArt: "km", kmSatz: 50 }, { fahrten: 0, km: 0 }), null);
    strictEqual(
      fahrtkostenZeile({ fahrtkostenArt: "pauschale", anfahrtPauschale: 3500 }, { fahrten: 0, km: 0 }),
      null,
    );
  });

  it("schreibt bei fehlendem Satz die Zeile trotzdem, mit Hinweis statt Betrag", () => {
    const km = fahrtkostenZeile({ fahrtkostenArt: "km" }, zwei);
    strictEqual(km?.einzelpreis, 0);
    ok(km?.beschreibung.includes("Einstellungen"));
    const p = fahrtkostenZeile({ fahrtkostenArt: "pauschale" }, zwei);
    strictEqual(p?.einzelpreis, 0);
    ok(p?.beschreibung.includes("Einstellungen"));
  });
});
