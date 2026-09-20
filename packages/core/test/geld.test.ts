import { strictEqual } from "node:assert";
import { describe, it } from "node:test";
import { alsGeld, alsMenge, ausGeld, runden } from "../src/werkzeug/geld";

/**
 * Geldrechnung ist der Teil, bei dem ein stiller Fehler Geld kostet und
 * niemand ihn bemerkt, bis ein Prüfer fragt. Deshalb steht er als Test hier
 * und nicht nur im Browsertest: er läuft in einer Sekunde und deckt die
 * Fälle ab, die man in der Oberfläche nur mühsam erzeugt.
 */

describe("alsGeld", () => {
  it("schreibt österreichisch: Punkt für Tausender, Komma für Cent", () => {
    strictEqual(alsGeld(0), "0,00");
    strictEqual(alsGeld(5), "0,05");
    strictEqual(alsGeld(99), "0,99");
    strictEqual(alsGeld(100), "1,00");
    strictEqual(alsGeld(107400), "1.074,00");
    strictEqual(alsGeld(139880), "1.398,80");
    strictEqual(alsGeld(100000000), "1.000.000,00");
  });

  it("stellt negative Beträge mit Vorzeichen dar (Gutschriften)", () => {
    strictEqual(alsGeld(-2550), "-25,50");
    strictEqual(alsGeld(-100000), "-1.000,00");
  });
});

describe("ausGeld", () => {
  it("nimmt die österreichische Schreibweise", () => {
    strictEqual(ausGeld("12,50"), 1250);
    strictEqual(ausGeld("1.234,56"), 123456);
    strictEqual(ausGeld("12"), 1200);
    strictEqual(ausGeld("0,05"), 5);
  });

  it("nimmt auch den Punkt als Dezimaltrenner, wenn kein Komma da ist", () => {
    // Kommt vom Ziffernblock und aus kopierten Lieferantenlisten.
    strictEqual(ausGeld("12.50"), 1250);
    strictEqual(ausGeld("12.5"), 1250);
    strictEqual(ausGeld("1234.56"), 123456);
  });

  it("liest den Punkt vor drei Ziffern als Tausendertrenner", () => {
    strictEqual(ausGeld("1.500"), 150000);
    strictEqual(ausGeld("1.500,00"), 150000);
  });

  it("rundet auf Cent und verträgt Leerzeichen und Eurozeichen", () => {
    strictEqual(ausGeld("99,999"), 10000);
    strictEqual(ausGeld(" 12,50 €"), 1250);
    strictEqual(ausGeld(""), 0);
  });

  it("meldet Unsinn als NaN statt still eine Null zu liefern", () => {
    strictEqual(Number.isNaN(ausGeld("abc")), true);
  });
});

describe("runden", () => {
  it("rundet kaufmännisch, auch bei negativen Beträgen", () => {
    strictEqual(runden(0.5), 1);
    strictEqual(runden(1.5), 2);
    strictEqual(runden(-0.5), -1);
    strictEqual(runden(-1.5), -2);
  });
});

describe("alsMenge", () => {
  it("lässt überflüssige Nullen weg", () => {
    strictEqual(alsMenge(1), "1");
    strictEqual(alsMenge(1.5), "1,5");
    strictEqual(alsMenge(0.125), "0,125");
    strictEqual(alsMenge(1200), "1.200");
  });

  it("rundet auf drei Nachkommastellen", () => {
    strictEqual(alsMenge(12.3456), "12,346");
  });
});
