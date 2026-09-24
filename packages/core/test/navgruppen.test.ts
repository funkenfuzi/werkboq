import { deepStrictEqual, strictEqual } from "node:assert";
import { describe, it } from "node:test";
import { aktiveGruppe, navGruppieren } from "../src/modul/navgruppen";
import type { NavEintrag } from "../src/modul/typen";

const leer = () => null;
const e = (pfad: string, gruppe?: NavEintrag["gruppe"], fachmodul = false) => ({
  pfad,
  titel: pfad,
  komponente: leer,
  gruppe,
  fachmodul,
});

describe("navGruppieren", () => {
  it("ordnet in fester Reihenfolge und lässt leere Gruppen weg", () => {
    const b = navGruppieren([e("/belege", "verkauf"), e("/kunden", "kunden"), e("/vertraege", "kunden")]);
    deepStrictEqual(
      b.map((x) => [x.id, x.eintraege.map((y) => y.pfad)]),
      [
        ["kunden", ["/kunden", "/vertraege"]],
        ["verkauf", ["/belege"]],
      ],
    );
  });

  it("steckt Einträge ohne Gruppe unter Betrieb und Fachmodule immer unter Fachmodule", () => {
    const b = navGruppieren([e("/irgendwas"), e("/pruefberichte", "kunden", true)]);
    deepStrictEqual(b.map((x) => x.id), ["betrieb", "fachmodule"]);
  });
});

describe("aktiveGruppe", () => {
  const b = navGruppieren([e("/kunden", "kunden"), e("/belege", "verkauf"), e("/belege-export", "betrieb")]);
  it("findet die Gruppe auch auf Unterseiten", () => {
    strictEqual(aktiveGruppe(b, "/belege/abc"), "verkauf");
    strictEqual(aktiveGruppe(b, "/kunden"), "kunden");
  });
  it("verwechselt keine Pfade mit gleichem Anfang", () => {
    strictEqual(aktiveGruppe(b, "/belege-export"), "betrieb");
  });
  it("gibt nichts zurück, wenn keine Gruppe passt", () => {
    strictEqual(aktiveGruppe(b, "/"), null);
  });
});
