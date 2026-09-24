import { deepStrictEqual, strictEqual } from "node:assert";
import { describe, it } from "node:test";
import { standortAusKunde, teilbaum, unterteile, type Standortteil } from "../src/daten/standorte";

const t = (id: string, eltern: string | undefined, bezeichnung = id, reihenfolge = 0): Standortteil => ({
  id,
  created: "",
  updated: "",
  standort: "s1",
  eltern,
  art: "raum",
  bezeichnung,
  reihenfolge,
});

const form = (b: ReturnType<typeof teilbaum>): unknown => b.map((k) => [k.id, form(k.kinder)]);

describe("teilbaum", () => {
  it("hängt Teile unter ihre Eltern, beliebig tief", () => {
    deepStrictEqual(form(teilbaum([t("raum", "eg"), t("haus", undefined), t("eg", "haus")])), [
      ["haus", [["eg", [["raum", []]]]]],
    ]);
  });

  it("ordnet Geschwister nach Reihenfolge, dann nach Name", () => {
    const b = teilbaum([t("c", undefined, "Keller", 1), t("a", undefined, "Top 2", 2), t("b", undefined, "Top 10", 2)]);
    deepStrictEqual(b.map((k) => k.bezeichnung), ["Keller", "Top 10", "Top 2"]);
  });

  it("zeigt einen Teil ohne auffindbare Eltern oben, statt ihn zu verlieren", () => {
    deepStrictEqual(form(teilbaum([t("x", "gibtsnicht")])), [["x", []]]);
  });

  it("läuft bei einem Ring nicht endlos und verliert nichts", () => {
    const b = teilbaum([t("a", "b"), t("b", "a")]);
    const alle: string[] = [];
    const sammeln = (l: typeof b) => l.forEach((k) => (alle.push(k.id), sammeln(k.kinder)));
    sammeln(b);
    deepStrictEqual(alle.sort(), ["a", "b"]);
  });
});

describe("unterteile", () => {
  it("zählt alles darunter, ohne den Teil selbst", () => {
    const b = teilbaum([t("haus", undefined), t("eg", "haus"), t("r1", "eg"), t("r2", "eg"), t("og", "haus")]);
    strictEqual(unterteile(b, "haus"), 4);
    strictEqual(unterteile(b, "eg"), 2);
    strictEqual(unterteile(b, "r1"), 0);
  });
});

describe("standortAusKunde", () => {
  it("nimmt die Straße als Bezeichnung, sonst den Ort, sonst Hauptstandort", () => {
    strictEqual(standortAusKunde({ id: "k", strasse: "Ahornweg 8", ort: "Neunkirchen" }).bezeichnung, "Ahornweg 8");
    strictEqual(standortAusKunde({ id: "k", strasse: " ", ort: "Neunkirchen" }).bezeichnung, "Neunkirchen");
    strictEqual(standortAusKunde({ id: "k" }).bezeichnung, "Hauptstandort");
  });
});
