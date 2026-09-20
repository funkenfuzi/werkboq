import { strictEqual } from "node:assert";
import { describe, it } from "node:test";
import {
  kostenpauschale,
  mahnvorschlag,
  naechsteStufe,
  verzugszinsen,
  zinsParagraf,
  zinssatz,
  type Mahnung,
} from "../src/daten/mahnwesen";
import { RECHTSRAEUME } from "@werkboq/core";

const AT = RECHTSRAEUME.at;
const DE = RECHTSRAEUME.de;
const CH = RECHTSRAEUME.ch;

/**
 * Zinsen und Spesen sind Beträge, die ein Kunde nachrechnet — und im Streit
 * ein Gericht. Sie gehören deshalb unter Test und nicht nur unter Augenmaß.
 * Und sie sind in jedem der drei Länder andere.
 */

describe("Zinssätze je Land", () => {
  it("rechnet in Österreich im B2B mit Basiszinssatz plus 9,2 Punkten (§ 456 UGB)", () => {
    strictEqual(zinssatz(true, AT), 10.73);
    strictEqual(zinsParagraf(true, AT), "§ 456 UGB");
  });

  it("rechnet in Österreich gegenüber Verbrauchern mit 4 % (§ 1000 ABGB)", () => {
    strictEqual(zinssatz(false, AT), 4);
    strictEqual(zinsParagraf(false, AT), "§ 1000 ABGB");
  });

  it("rechnet in Deutschland mit Basiszinssatz plus 9 bzw. 5 Punkten (§ 288 BGB)", () => {
    strictEqual(zinssatz(true, DE), 10.52);
    strictEqual(zinssatz(false, DE), 6.52);
    strictEqual(zinsParagraf(true, DE), "§ 288 Abs 2 BGB");
  });

  it("kennt die Schweiz nur den einen Satz von 5 % (Art. 104 OR)", () => {
    strictEqual(zinssatz(true, CH), 5);
    strictEqual(zinssatz(false, CH), 5);
    strictEqual(zinsParagraf(false, CH), "Art. 104 OR");
  });
});

describe("Kostenpauschale je Land", () => {
  it("gibt Österreich 40 € nach § 458 UGB", () => {
    strictEqual(kostenpauschale(true, AT), 4000);
  });

  it("gibt Deutschland 40 € nach § 288 Abs 5 BGB", () => {
    strictEqual(kostenpauschale(true, DE), 4000);
  });

  it("kennt die Schweiz keine", () => {
    strictEqual(kostenpauschale(true, CH), 0);
  });

  it("gibt Verbrauchern nirgends eine — die wäre nicht durchsetzbar", () => {
    for (const raum of [AT, DE, CH]) strictEqual(kostenpauschale(false, raum), 0);
  });
});

describe("verzugszinsen", () => {
  it("rechnet taggenau mit 365 Tagen", () => {
    // 1.000,00 € · 10,73 % · 30/365 = 8,82 €
    strictEqual(verzugszinsen(100000, 30, true, AT), 882);
  });

  it("rechnet für Verbraucher mit dem niedrigeren Satz", () => {
    // 1.000,00 € · 4 % · 30/365 = 3,29 €
    strictEqual(verzugszinsen(100000, 30, false, AT), 329);
  });

  it("kommt in Deutschland auf einen anderen Betrag als in Österreich", () => {
    // 1.000,00 € · 10,52 % · 30/365 = 8,65 €
    strictEqual(verzugszinsen(100000, 30, true, DE), 865);
    // Verbraucher in Deutschland zahlen mehr als in Österreich: 6,52 statt 4 %.
    strictEqual(verzugszinsen(100000, 30, false, DE), 536);
  });

  it("rechnet in der Schweiz für beide gleich", () => {
    strictEqual(verzugszinsen(100000, 30, true, CH), verzugszinsen(100000, 30, false, CH));
    // 1.000,00 CHF · 5 % · 30/365 = 4,11
    strictEqual(verzugszinsen(100000, 30, true, CH), 411);
  });

  it("rechnet auf den offenen Betrag, nicht auf den Rechnungsbetrag", () => {
    strictEqual(verzugszinsen(50000, 30, true, AT), 441);
  });

  it("gibt null zurück, solange kein Verzug vorliegt", () => {
    strictEqual(verzugszinsen(100000, 0, true, AT), 0);
    strictEqual(verzugszinsen(100000, -5, true, AT), 0);
  });

  it("gibt null zurück, wenn nichts offen ist", () => {
    strictEqual(verzugszinsen(0, 90, true, AT), 0);
    strictEqual(verzugszinsen(-500, 90, true, AT), 0);
  });

  it("wächst über ein Jahr auf den vollen Satz", () => {
    // 1.000,00 € · 10,73 % · 365/365 = 107,30 €
    strictEqual(verzugszinsen(100000, 365, true, AT), 10730);
  });
});

describe("mahnvorschlag", () => {
  const beleg = { datum: "2026-06-01", zahlungszielTage: 14 }; // fällig 15.6.

  it("zählt die Tage ab Fälligkeit, nicht ab Rechnungsdatum", () => {
    strictEqual(mahnvorschlag(beleg, 100000, true, 1, 0, "2026-07-15", AT).tage, 30);
  });

  it("verlangt bei der Zahlungserinnerung noch keine Spesen", () => {
    strictEqual(mahnvorschlag(beleg, 100000, true, 1, 0, "2026-07-15", AT).spesen, 0);
  });

  it("setzt die Pauschale erst ab der ersten echten Mahnung", () => {
    strictEqual(mahnvorschlag(beleg, 100000, true, 2, 0, "2026-07-15", AT).spesen, 4000);
  });

  it("setzt die Pauschale nur einmal je Forderung", () => {
    strictEqual(mahnvorschlag(beleg, 100000, true, 3, 4000, "2026-07-15", AT).spesen, 0);
  });

  it("gibt Verbrauchern keine Pauschale — die wäre nicht durchsetzbar", () => {
    strictEqual(mahnvorschlag(beleg, 100000, false, 2, 0, "2026-07-15", AT).spesen, 0);
  });

  it("schlägt in der Schweiz auch Unternehmern keine Pauschale vor", () => {
    strictEqual(mahnvorschlag(beleg, 100000, true, 2, 0, "2026-07-15", CH).spesen, 0);
  });

  it("schlägt je Land andere Zinsen vor", () => {
    strictEqual(mahnvorschlag(beleg, 100000, true, 2, 0, "2026-07-15", AT).zinsen, 882);
    strictEqual(mahnvorschlag(beleg, 100000, true, 2, 0, "2026-07-15", DE).zinsen, 865);
    strictEqual(mahnvorschlag(beleg, 100000, true, 2, 0, "2026-07-15", CH).zinsen, 411);
  });

  it("setzt je Stufe die übliche Frist", () => {
    strictEqual(mahnvorschlag(beleg, 100000, true, 1, 0, "2026-07-15", AT).frist, "2026-07-25");
    strictEqual(mahnvorschlag(beleg, 100000, true, 2, 0, "2026-07-15", AT).frist, "2026-07-22");
  });
});

describe("naechsteStufe", () => {
  const m = (stufe: number) => ({ stufe } as Mahnung);

  it("beginnt bei der Erinnerung", () => {
    strictEqual(naechsteStufe([]), 1);
  });

  it("zählt hoch", () => {
    strictEqual(naechsteStufe([m(1)]), 2);
    strictEqual(naechsteStufe([m(1), m(2)]), 3);
  });

  it("endet nach der zweiten Mahnung — danach entscheidet ein Mensch", () => {
    strictEqual(naechsteStufe([m(1), m(2), m(3)]), null);
  });
});
