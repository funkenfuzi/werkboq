import { deepStrictEqual, strictEqual } from "node:assert";
import { describe, it } from "node:test";
import {
  aktuellerRechtsraum,
  LAENDER,
  RECHTSRAEUME,
  rechtsraum,
  rechtsraumLaden,
  rechtsraumSetzen,
  satzText,
  saetzeVon,
  uidPlausibel,
  zahlText,
} from "../src/werkzeug/laender";
import { alsEuro, alsGeld, alsMenge, ausGeld, schreibweiseVon } from "../src/werkzeug/geld";

/**
 * Das Land entscheidet über Steuersatz, Währung, Pflichtangaben und Zinsen.
 * Eine falsche Zahl hier steht auf jeder Rechnung, die dieser Betrieb
 * schreibt — deshalb hängt jede von ihnen an einem Test.
 */

describe("rechtsraum", () => {
  it("kennt alle drei Länder", () => {
    deepStrictEqual([...LAENDER], ["at", "de", "ch"]);
    for (const l of LAENDER) strictEqual(RECHTSRAEUME[l].id, l);
  });

  it("verträgt Groß- und Kleinschreibung", () => {
    strictEqual(rechtsraum("CH").id, "ch");
    strictEqual(rechtsraum("de").id, "de");
  });

  it("fällt bei Unbekanntem auf Österreich zurück, statt zu werfen", () => {
    strictEqual(rechtsraum("xx").id, "at");
    strictEqual(rechtsraum(undefined).id, "at");
    strictEqual(rechtsraum(null).id, "at");
    strictEqual(rechtsraum("").id, "at");
  });
});

describe("Steuersätze", () => {
  it("führt die österreichischen Sätze absteigend", () => {
    deepStrictEqual(saetzeVon(RECHTSRAEUME.at), [20, 13, 10, 0]);
  });

  it("führt die deutschen Sätze", () => {
    deepStrictEqual(saetzeVon(RECHTSRAEUME.de), [19, 7, 0]);
  });

  it("führt die Schweizer Sätze mit Nachkommastelle", () => {
    deepStrictEqual(saetzeVon(RECHTSRAEUME.ch), [8.1, 3.8, 2.6, 0]);
  });

  it("schreibt die Zahl so, wie das Land sie schreibt", () => {
    strictEqual(zahlText(RECHTSRAEUME.at, 20), "20");
    strictEqual(zahlText(RECHTSRAEUME.ch, 8.1), "8.1");
    // Ein krummer Satz im Euroraum bekäme das Komma.
    strictEqual(zahlText(RECHTSRAEUME.de, 7.5), "7,5");
  });

  it("beschriftet einen Satz mit seinem Titel", () => {
    strictEqual(satzText(RECHTSRAEUME.at, 20), "20 % Normalsatz");
    strictEqual(satzText(RECHTSRAEUME.ch, 8.1), "8.1 % Normalsatz");
  });

  it("kommt auch mit einem Satz zurecht, den das Land nicht führt", () => {
    strictEqual(satzText(RECHTSRAEUME.de, 13), "13 %");
  });
});

describe("Steuernummern", () => {
  it("erkennt die österreichische UID", () => {
    strictEqual(uidPlausibel(RECHTSRAEUME.at, "ATU12345678"), true);
    strictEqual(uidPlausibel(RECHTSRAEUME.at, "DE123456789"), false);
  });

  it("erkennt die deutsche USt-IdNr", () => {
    strictEqual(uidPlausibel(RECHTSRAEUME.de, "DE123456789"), true);
    strictEqual(uidPlausibel(RECHTSRAEUME.de, "DE12345678"), false);
  });

  it("erkennt die Schweizer UID mit und ohne Zusatz", () => {
    strictEqual(uidPlausibel(RECHTSRAEUME.ch, "CHE-123.456.789 MWST"), true);
    strictEqual(uidPlausibel(RECHTSRAEUME.ch, "CHE123456789"), true);
  });

  it("lässt ein leeres Feld durch — dafür gibt es die Pflichtangaben", () => {
    for (const l of LAENDER) strictEqual(uidPlausibel(RECHTSRAEUME[l], "  "), true);
  });
});

describe("Währung und Schreibweise", () => {
  it("schreibt Euro nachgestellt, Franken vorangestellt", () => {
    strictEqual(alsEuro(123456, schreibweiseVon("at")), "1.234,56 €");
    strictEqual(alsEuro(123456, schreibweiseVon("de")), "1.234,56 €");
    strictEqual(alsEuro(123456, schreibweiseVon("ch")), "CHF 1’234.56");
  });

  it("trennt Tausender in der Schweiz mit dem Hochkomma", () => {
    strictEqual(alsGeld(123456789, schreibweiseVon("ch")), "1’234’567.89");
  });

  it("liest beide Schreibweisen wieder ein", () => {
    strictEqual(ausGeld("1.234,56"), 123456);
    strictEqual(ausGeld("1’234.56"), 123456);
    strictEqual(ausGeld("CHF 1’234.56"), 123456);
  });

  it("schreibt Mengen in der Schreibweise des Landes", () => {
    strictEqual(alsMenge(1234.5, schreibweiseVon("at")), "1.234,5");
    strictEqual(alsMenge(1234.5, schreibweiseVon("ch")), "1’234.5");
  });
});

describe("Der gewählte Rechtsraum", () => {
  it("steht ohne Betriebsdaten auf Österreich", () => {
    rechtsraumSetzen("at");
    strictEqual(aktuellerRechtsraum().id, "at");
  });

  it("nimmt an, was die Betriebsstammdaten sagen", async () => {
    await rechtsraumLaden(async () => ({ rechtsraum: "ch" }));
    strictEqual(aktuellerRechtsraum().id, "ch");
    strictEqual(aktuellerRechtsraum().waehrung, "CHF");
  });

  it("bleibt beim Bisherigen, wenn das Laden scheitert", async () => {
    rechtsraumSetzen("de");
    await rechtsraumLaden(async () => {
      throw new Error("kein Netz");
    });
    strictEqual(aktuellerRechtsraum().id, "de");
  });

  it("lässt sich beim Einrichten sofort umstellen", () => {
    strictEqual(rechtsraumSetzen("ch").id, "ch");
    strictEqual(aktuellerRechtsraum().steuerKurz, "MWST");
    rechtsraumSetzen("at");
  });
});

describe("Fundstellen sind gesetzt", () => {
  it("nennt für jedes Land Rechnungsvorschrift, Zinsen und Aufbewahrung", () => {
    for (const l of LAENDER) {
      const r = RECHTSRAEUME[l];
      strictEqual(r.rechnungParagraf.length > 0, true, `${l}: rechnungParagraf`);
      strictEqual(r.verzugB2BParagraf.length > 0, true, `${l}: verzugB2BParagraf`);
      strictEqual(r.verzugB2CParagraf.length > 0, true, `${l}: verzugB2CParagraf`);
      strictEqual(r.aufbewahrung.length > 0, true, `${l}: aufbewahrung`);
      strictEqual(r.elektroNorm.length > 0, true, `${l}: elektroNorm`);
    }
  });

  it("nennt eine Fundstelle, wo es eine Kostenpauschale gibt — und keine, wo nicht", () => {
    for (const l of LAENDER) {
      const r = RECHTSRAEUME[l];
      strictEqual(
        r.betreibungskosten > 0 ? r.betreibungskostenParagraf !== "" : r.betreibungskostenParagraf === "",
        true,
        `${l}: betreibungskostenParagraf`,
      );
    }
  });

  it("nennt eine Fundstelle für die Kleinbetragsrechnung, wo es eine gibt", () => {
    strictEqual(RECHTSRAEUME.at.kleinbetragParagraf, "§ 11 Abs 6 UStG");
    strictEqual(RECHTSRAEUME.de.kleinbetragParagraf, "§ 33 UStDV");
    strictEqual(RECHTSRAEUME.ch.kleinbetragGrenze, 0);
    strictEqual(RECHTSRAEUME.ch.kleinbetragParagraf, "");
  });
});
