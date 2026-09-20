import { strictEqual } from "node:assert";
import { describe, it } from "node:test";
import {
  BASISZINSSATZ,
  BETREIBUNGSKOSTEN_B2B,
  mahnvorschlag,
  naechsteStufe,
  VERZUGSZINSEN_B2B,
  VERZUGSZINSEN_B2C,
  verzugszinsen,
  type Mahnung,
} from "../src/daten/mahnwesen";

/**
 * Zinsen und Spesen sind Beträge, die ein Kunde nachrechnet — und im Streit
 * ein Gericht. Sie gehören deshalb unter Test und nicht nur unter Augenmaß.
 */

describe("Zinssätze", () => {
  it("setzt sich im B2B aus Basiszinssatz plus 9,2 Punkten zusammen (§ 456 UGB)", () => {
    strictEqual(BASISZINSSATZ, 1.53);
    strictEqual(Math.round(VERZUGSZINSEN_B2B * 100) / 100, 10.73);
  });

  it("beträgt gegenüber Verbrauchern 4 % (§ 1000 ABGB)", () => {
    strictEqual(VERZUGSZINSEN_B2C, 4);
  });
});

describe("verzugszinsen", () => {
  it("rechnet taggenau mit 365 Tagen", () => {
    // 1.000,00 € · 10,73 % · 30/365 = 8,82 €
    strictEqual(verzugszinsen(100000, 30, true), 882);
  });

  it("rechnet für Verbraucher mit dem niedrigeren Satz", () => {
    // 1.000,00 € · 4 % · 30/365 = 3,29 €
    strictEqual(verzugszinsen(100000, 30, false), 329);
  });

  it("rechnet auf den offenen Betrag, nicht auf den Rechnungsbetrag", () => {
    strictEqual(verzugszinsen(50000, 30, true), 441);
  });

  it("gibt null zurück, solange kein Verzug vorliegt", () => {
    strictEqual(verzugszinsen(100000, 0, true), 0);
    strictEqual(verzugszinsen(100000, -5, true), 0);
  });

  it("gibt null zurück, wenn nichts offen ist", () => {
    strictEqual(verzugszinsen(0, 90, true), 0);
    strictEqual(verzugszinsen(-500, 90, true), 0);
  });

  it("wächst über ein Jahr auf den vollen Satz", () => {
    // 1.000,00 € · 10,73 % · 365/365 = 107,30 €
    strictEqual(verzugszinsen(100000, 365, true), 10730);
  });
});

describe("mahnvorschlag", () => {
  const beleg = { datum: "2026-06-01", zahlungszielTage: 14 }; // fällig 15.6.

  it("zählt die Tage ab Fälligkeit, nicht ab Rechnungsdatum", () => {
    strictEqual(mahnvorschlag(beleg, 100000, true, 1, 0, "2026-07-15").tage, 30);
  });

  it("verlangt bei der Zahlungserinnerung noch keine Spesen", () => {
    strictEqual(mahnvorschlag(beleg, 100000, true, 1, 0, "2026-07-15").spesen, 0);
  });

  it("setzt die Pauschale nach § 458 UGB erst ab der ersten echten Mahnung", () => {
    strictEqual(
      mahnvorschlag(beleg, 100000, true, 2, 0, "2026-07-15").spesen,
      BETREIBUNGSKOSTEN_B2B,
    );
  });

  it("setzt die Pauschale nur einmal je Forderung", () => {
    strictEqual(mahnvorschlag(beleg, 100000, true, 3, BETREIBUNGSKOSTEN_B2B, "2026-07-15").spesen, 0);
  });

  it("gibt Verbrauchern keine Pauschale — die wäre nicht durchsetzbar", () => {
    strictEqual(mahnvorschlag(beleg, 100000, false, 2, 0, "2026-07-15").spesen, 0);
  });

  it("setzt je Stufe die übliche Frist", () => {
    strictEqual(mahnvorschlag(beleg, 100000, true, 1, 0, "2026-07-15").frist, "2026-07-25");
    strictEqual(mahnvorschlag(beleg, 100000, true, 2, 0, "2026-07-15").frist, "2026-07-22");
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
