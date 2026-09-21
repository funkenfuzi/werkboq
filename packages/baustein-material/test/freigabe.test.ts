import { deepStrictEqual, strictEqual } from "node:assert";
import { describe, it } from "node:test";
import {
  istFreigegeben,
  nurFreigegebene,
  nurVorschlaege,
  summieren,
} from "../src/daten/positionen";

/**
 * Die eine Frage, die hier zählt: kann ein ungeprüfter Vorschlag auf eine
 * Rechnung geraten? Wenn ja, steht ein Betrag auf einem Beleg, den niemand
 * angesehen hat — und der Beleg ist festgeschrieben, bevor es auffällt.
 */

const zeile = (menge: number, preis: number, zustand?: "vorschlag" | "freigegeben") => ({
  menge,
  einzelpreis: preis,
  rabatt: 0,
  ustsatz: 20,
  zustand,
});

describe("istFreigegeben", () => {
  it("gilt für ausdrücklich Freigegebenes", () => {
    strictEqual(istFreigegeben({ zustand: "freigegeben" }), true);
  });

  it("hält einen Vorschlag zurück", () => {
    strictEqual(istFreigegeben({ zustand: "vorschlag" }), false);
  });

  it("behandelt Positionen ohne Zustand als freigegeben", () => {
    // Das ist die wichtigste Zeile dieser Datei. Es gibt Positionen aus
    // der Zeit vor dieser Unterscheidung; würden sie plötzlich als
    // ungeprüft gelten, verschwänden sie von den Rechnungen bestehender
    // Aufträge, ohne dass jemand etwas geändert hätte.
    strictEqual(istFreigegeben({}), true);
    strictEqual(istFreigegeben({ zustand: undefined }), true);
  });
});

describe("Trennung der beiden Listen", () => {
  const liste = [
    zeile(1, 1000, "freigegeben"),
    zeile(2, 500, "vorschlag"),
    zeile(3, 100),
  ];

  it("liefert nur, was zählt", () => {
    strictEqual(nurFreigegebene(liste).length, 2);
  });

  it("liefert nur, was wartet", () => {
    strictEqual(nurVorschlaege(liste).length, 1);
  });

  it("lässt nichts unter den Tisch fallen", () => {
    // Jede Position ist in genau einer der beiden Listen. Eine, die in
    // keiner steht, wäre für immer unsichtbar.
    strictEqual(nurFreigegebene(liste).length + nurVorschlaege(liste).length, liste.length);
  });
});

describe("Summen", () => {
  it("zählen einen Vorschlag nicht mit", () => {
    const alle = [zeile(1, 10000, "freigegeben"), zeile(1, 5000, "vorschlag")];
    const summen = summieren(nurFreigegebene(alle));
    strictEqual(summen.netto, 10000);
    strictEqual(summen.ust, 2000);
    strictEqual(summen.brutto, 12000);
  });

  it("zählen alte Positionen ohne Zustand mit", () => {
    const summen = summieren(nurFreigegebene([zeile(2, 2500)]));
    strictEqual(summen.netto, 5000);
  });

  it("ergeben null, wenn alles noch wartet", () => {
    const summen = summieren(nurFreigegebene([zeile(1, 9999, "vorschlag")]));
    strictEqual(summen.netto, 0);
    strictEqual(summen.brutto, 0);
    deepStrictEqual([...summen.nettoJeSatz.keys()], []);
  });
});
