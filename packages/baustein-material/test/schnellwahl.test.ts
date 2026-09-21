import { deepStrictEqual, strictEqual } from "node:assert";
import { describe, it } from "node:test";
import { eanNormalisieren, ohneWiederholung, passtZuSuche } from "../src/daten/schnellwahl";

/**
 * Was hier getestet wird, entscheidet darüber, ob ein Monteur den Artikel
 * findet oder aufgibt. Beides passiert in fünf Sekunden im Keller.
 */

describe("eanNormalisieren", () => {
  it("macht aus zwölf Stellen dreizehn", () => {
    // UPC-A wird zu EAN-13 durch eine führende Null. Ohne das findet der
    // Scanner einen Artikel nicht, der im Katalog steht.
    strictEqual(eanNormalisieren("012345678905"), "0012345678905");
  });

  it("lässt dreizehn Stellen, wie sie sind", () => {
    strictEqual(eanNormalisieren("4001234567890"), "4001234567890");
  });

  it("wirft weg, was kein Scanner mitmeint", () => {
    strictEqual(eanNormalisieren(" 4001-234 567890 "), "4001234567890");
  });

  it("verträgt Unsinn, ohne zu stolpern", () => {
    strictEqual(eanNormalisieren(""), "");
    strictEqual(eanNormalisieren("keine Zahl"), "");
  });
});

describe("ohneWiederholung", () => {
  it("behält das Neueste und streicht Wiederholungen", () => {
    deepStrictEqual(ohneWiederholung(["a", "b", "a", "c", "b"]), ["a", "b", "c"]);
  });

  it("überspringt leere Einträge", () => {
    // Positionen ohne Katalogartikel haben ein leeres Feld; die dürfen
    // nicht als eigener Eintrag in der Schnellwahl landen.
    deepStrictEqual(ohneWiederholung(["", "a", "", "b"]), ["a", "b"]);
  });
});

describe("passtZuSuche", () => {
  const kabel = { bezeichnung: "NYM-J 3x1,5 mm²", nummer: "M-0042", ean: "4001234567890" };

  it("findet über einen Teil der Bezeichnung", () => {
    strictEqual(passtZuSuche(kabel, "nym"), true);
  });

  it("findet über die Artikelnummer", () => {
    strictEqual(passtZuSuche(kabel, "0042"), true);
  });

  it("nimmt mehrere Wörter in beliebiger Reihenfolge", () => {
    // Niemand tippt "NYM-J 3x1,5" genau so, wie es im Katalog steht.
    strictEqual(passtZuSuche(kabel, "nym 1,5"), true);
    strictEqual(passtZuSuche(kabel, "1,5 nym"), true);
  });

  it("verlangt, dass alle Wörter vorkommen", () => {
    strictEqual(passtZuSuche(kabel, "nym 2,5"), false);
  });

  it("findet über die EAN, auch in der Zwölfstellenform", () => {
    strictEqual(passtZuSuche(kabel, "4001234567890"), true);
    strictEqual(passtZuSuche({ ...kabel, ean: "012345678905" }, "0012345678905"), true);
  });

  it("gibt bei leerem Suchtext alles zurück", () => {
    strictEqual(passtZuSuche(kabel, ""), true);
    strictEqual(passtZuSuche(kabel, "   "), true);
  });

  it("stolpert nicht über Artikel ohne EAN", () => {
    strictEqual(passtZuSuche({ bezeichnung: "Dose", nummer: "M-1" }, "dose"), true);
    strictEqual(passtZuSuche({ bezeichnung: "Dose", nummer: "M-1" }, "4001234567890"), false);
  });
});
