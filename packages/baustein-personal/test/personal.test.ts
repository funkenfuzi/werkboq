import { deepStrictEqual, strictEqual } from "node:assert";
import { describe, it } from "node:test";
import { dienstjahre, svnrPlausibel } from "../src/daten/personaldaten";
import { fristzustand, tageBis, zuErledigen, type Personaldokument } from "../src/daten/dokumente";
import { alsCsv, sollstunden, werktageImMonat, monatsauswertung } from "../src/daten/lohn";
import type { Mitarbeiter } from "@werkboq/core";

describe("svnrPlausibel", () => {
  /**
   * Gewichte 3,7,9 auf die laufende Nummer, 5,8,4,2,1,6 auf das
   * Geburtsdatum; die Summe modulo 11 ist die Prüfziffer an vierter Stelle.
   * 123 + Geburtsdatum 010180 ergibt 62, 62 mod 11 = 7.
   */
  it("erkennt eine gültige Nummer", () => {
    strictEqual(svnrPlausibel("1237010180"), true);
  });

  it("erkennt einen Zahlendreher", () => {
    strictEqual(svnrPlausibel("1234010180"), false);
  });

  it("verlangt genau zehn Ziffern", () => {
    strictEqual(svnrPlausibel("123701018"), false);
    strictEqual(svnrPlausibel("12370101800"), false);
    strictEqual(svnrPlausibel("1237-010180"), false);
  });

  it("lässt ein leeres Feld durch — nicht jede Akte ist am ersten Tag fertig", () => {
    strictEqual(svnrPlausibel(""), true);
    strictEqual(svnrPlausibel("   "), true);
  });

  it("ignoriert Leerzeichen in der Eingabe", () => {
    strictEqual(svnrPlausibel("1237 010180"), true);
  });
});

describe("dienstjahre", () => {
  it("zählt volle Jahre", () => {
    strictEqual(dienstjahre("2020-03-01", new Date("2026-09-20T00:00:00")), 6);
  });

  it("zählt das laufende Jahr erst ab dem Jahrestag", () => {
    strictEqual(dienstjahre("2020-12-01", new Date("2026-09-20T00:00:00")), 5);
    strictEqual(dienstjahre("2020-09-20", new Date("2026-09-20T00:00:00")), 6);
    strictEqual(dienstjahre("2020-09-21", new Date("2026-09-20T00:00:00")), 5);
  });

  it("gibt null zurück, wenn kein Eintritt hinterlegt ist", () => {
    strictEqual(dienstjahre(undefined), null);
    strictEqual(dienstjahre(""), null);
  });
});

describe("Fristen", () => {
  const dok = (werte: Partial<Personaldokument>) => werte as Personaldokument;

  it("meldet ohne Ablaufdatum nichts", () => {
    strictEqual(fristzustand(dok({}), "2026-09-20"), "ohne");
  });

  it("erkennt ein abgelaufenes Dokument", () => {
    strictEqual(
      fristzustand(dok({ laeuftAb: "2026-09-19", erinnerungTage: 30 }), "2026-09-20"),
      "abgelaufen",
    );
  });

  it("gilt am Ablauftag selbst noch als gültig", () => {
    strictEqual(
      fristzustand(dok({ laeuftAb: "2026-09-20", erinnerungTage: 30 }), "2026-09-20"),
      "faellig",
    );
  });

  it("schlägt innerhalb der Vorwarnzeit an", () => {
    strictEqual(
      fristzustand(dok({ laeuftAb: "2026-10-10", erinnerungTage: 30 }), "2026-09-20"),
      "faellig",
    );
    strictEqual(
      fristzustand(dok({ laeuftAb: "2026-12-10", erinnerungTage: 30 }), "2026-09-20"),
      "offen",
    );
  });

  it("schweigt ohne Vorwarnzeit, bis das Datum überschritten ist", () => {
    strictEqual(
      fristzustand(dok({ laeuftAb: "2026-09-21", erinnerungTage: 0 }), "2026-09-20"),
      "offen",
    );
  });

  it("nimmt Erledigtes aus der Überwachung", () => {
    strictEqual(
      fristzustand(dok({ laeuftAb: "2020-01-01", erinnerungTage: 30, erledigt: true }), "2026-09-20"),
      "ohne",
    );
  });

  it("zählt Tage vorzeichenrichtig", () => {
    strictEqual(tageBis("2026-09-20", "2026-09-30"), 10);
    strictEqual(tageBis("2026-09-30", "2026-09-20"), -10);
    strictEqual(tageBis("2026-09-20", "2026-09-20"), 0);
  });

  it("stellt das Dringendste nach oben, Abgelaufenes zuerst", () => {
    const liste = [
      dok({ id: "a", titel: "in 10 Tagen", laeuftAb: "2026-09-30", erinnerungTage: 30 }),
      dok({ id: "b", titel: "abgelaufen", laeuftAb: "2026-08-01", erinnerungTage: 30 }),
      dok({ id: "c", titel: "weit weg", laeuftAb: "2027-09-30", erinnerungTage: 30 }),
      dok({ id: "d", titel: "in 3 Tagen", laeuftAb: "2026-09-23", erinnerungTage: 30 }),
    ];
    deepStrictEqual(
      zuErledigen(liste, "2026-09-20").map((x) => x.dokument.id),
      ["b", "d", "a"],
    );
  });
});

describe("Sollstunden", () => {
  it("zählt die Werktage eines Monats", () => {
    // September 2026: 1.9. ist ein Dienstag, der Monat hat 22 Werktage.
    strictEqual(werktageImMonat(2026, 9), 22);
    // Februar 2026 hat 28 Tage, 1.2. ist ein Sonntag → 20 Werktage.
    strictEqual(werktageImMonat(2026, 2), 20);
  });

  it("kennt den Schalttag", () => {
    strictEqual(werktageImMonat(2028, 2), 21);
  });

  it("rechnet die Wochenstunden auf den Monat herunter", () => {
    // 38,5 / 5 = 7,7 Stunden am Tag, mal 22 Werktage.
    strictEqual(sollstunden(38.5, 2026, 9), 169.4);
  });

  it("gibt null zurück, wenn keine Wochenstunden hinterlegt sind", () => {
    strictEqual(sollstunden(0, 2026, 9), 0);
  });
});

describe("Monatsauswertung", () => {
  const mitarbeiter = {
    id: "m1",
    name: "Franz Bauer",
    kurzzeichen: "FB",
    funktion: "monteur",
    wochenstunden: 38.5,
  } as Mitarbeiter;

  it("rechnet Ist gegen Soll", () => {
    const a = monatsauswertung(mitarbeiter, 2026, 9, 10440, 9000, []);
    strictEqual(a.iststunden, 174);
    strictEqual(a.sollstunden, 169.4);
    strictEqual(a.mehrstunden, 4.6);
  });

  it("weist Minusstunden aus, statt sie zu verschlucken", () => {
    const a = monatsauswertung(mitarbeiter, 2026, 9, 9000, 0, []);
    strictEqual(a.mehrstunden, -19.4);
  });

  it("zählt nur genehmigte Abwesenheiten des Monats", () => {
    const a = monatsauswertung(mitarbeiter, 2026, 9, 0, 0, [
      { art: "urlaub", status: "genehmigt", tage: 5, von: "2026-09-07" },
      { art: "urlaub", status: "beantragt", tage: 3, von: "2026-09-21" },
      { art: "urlaub", status: "genehmigt", tage: 2, von: "2026-08-10" },
      { art: "krankenstand", status: "genehmigt", tage: 1, von: "2026-09-02" },
    ]);
    strictEqual(a.abwesenheitstage.urlaub, 5);
    strictEqual(a.abwesenheitstage.krankenstand, 1);
  });
});

describe("CSV für die Lohnverrechnung", () => {
  const mitarbeiter = {
    id: "m1",
    name: "Franz Bauer",
    kurzzeichen: "FB",
    funktion: "monteur",
    wochenstunden: 38.5,
  } as Mitarbeiter;

  it("trennt mit Semikolon und schreibt Kommazahlen mit Komma", () => {
    const csv = alsCsv([monatsauswertung(mitarbeiter, 2026, 9, 10440, 9000, [])]);
    const zeile = csv.split("\r\n")[1] ?? "";
    strictEqual(zeile.startsWith("Franz Bauer;FB;2026;9;169,4;174;4,6;150"), true);
  });

  it("beginnt mit dem BOM, sonst zeigt Excel Buchstabensalat", () => {
    strictEqual(alsCsv([]).startsWith("﻿"), true);
  });

  it("schützt ein Semikolon im Namen", () => {
    const heikel = { ...mitarbeiter, name: "Bauer; Franz" } as Mitarbeiter;
    const csv = alsCsv([monatsauswertung(heikel, 2026, 9, 0, 0, [])]);
    strictEqual(csv.includes('"Bauer; Franz"'), true);
  });

  it("fasst alles Übrige unter sonstige Abwesenheit", () => {
    const csv = alsCsv([
      monatsauswertung(mitarbeiter, 2026, 9, 0, 0, [
        { art: "schulung", status: "genehmigt", tage: 2, von: "2026-09-07" },
        { art: "sonderurlaub", status: "genehmigt", tage: 1, von: "2026-09-09" },
      ]),
    ]);
    strictEqual((csv.split("\r\n")[1] ?? "").endsWith(";0;0;0;3"), true);
  });
});
