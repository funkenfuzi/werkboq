import { strictEqual } from "node:assert";
import { describe, it } from "node:test";
import { positionswert, summieren } from "../src/daten/positionen";
import type { UstSatz } from "@werkboq/core";

/**
 * Positionsrechnung.
 *
 * Der Grund für diese Tests steht in summieren(): die Steuer wird je
 * Steuersatz aus der gerundeten Nettosumme gerechnet, nicht Zeile für Zeile.
 * Macht man es andersherum, stimmt die ausgewiesene Steuer nicht mit der
 * Summe überein — ein Fehler, der auf einer einzelnen Rechnung ein Cent ist
 * und in einer Betriebsprüfung eine Diskussion.
 */

const p = (menge: number, einzelpreis: number, ustsatz: UstSatz = 20, rabatt = 0) => ({
  menge,
  einzelpreis,
  ustsatz,
  rabatt,
});

describe("positionswert", () => {
  it("rechnet Menge mal Einzelpreis", () => {
    strictEqual(positionswert(p(120, 145)), 17400);
    strictEqual(positionswert(p(1, 9999)), 9999);
  });

  it("zieht den Rabatt ab", () => {
    strictEqual(positionswert(p(10, 10000, 20, 10)), 90000);
    strictEqual(positionswert(p(1, 10000, 20, 33.33)), 6667);
  });

  it("rundet Bruchteile von Cent kaufmännisch", () => {
    // 3 × 0,335 € = 1,005 € → 1,01 €
    strictEqual(positionswert({ menge: 3, einzelpreis: 33.5, rabatt: 0 }), 101);
  });

  it("kommt mit Nachkommamengen zurecht", () => {
    // 2,5 m × 1,45 € = 3,625 € → 3,63 €
    strictEqual(positionswert(p(2.5, 145)), 363);
  });
});

describe("summieren", () => {
  it("trennt die Nettosummen nach Steuersatz", () => {
    const s = summieren([p(120, 145), p(10, 10000, 20, 10), p(2, 5000, 10)]);
    strictEqual(s.nettoJeSatz.get(20), 107400);
    strictEqual(s.nettoJeSatz.get(10), 10000);
    strictEqual(s.netto, 117400);
  });

  it("rechnet die Steuer je Satz und nicht auf die Gesamtsumme", () => {
    const s = summieren([p(120, 145), p(10, 10000, 20, 10), p(2, 5000, 10)]);
    // 20 % von 1.074,00 = 214,80 ; 10 % von 100,00 = 10,00
    strictEqual(s.ust, 22480);
    strictEqual(s.brutto, 139880);
  });

  it("behandelt den steuerfreien Satz als eigene Gruppe ohne Steuer", () => {
    const s = summieren([p(1, 10000, 0), p(1, 10000, 20)]);
    strictEqual(s.netto, 20000);
    strictEqual(s.ust, 2000);
    strictEqual(s.brutto, 22000);
  });

  it("liefert bei leerer Liste lauter Nullen statt NaN", () => {
    const s = summieren([]);
    strictEqual(s.netto, 0);
    strictEqual(s.ust, 0);
    strictEqual(s.brutto, 0);
    strictEqual(s.nettoJeSatz.size, 0);
  });

  it("summiert eine lange Liste ohne Centdrift", () => {
    // 100 × 0,01 € zu 20 % — naive Fließkommarechnung driftet hier.
    const s = summieren(Array.from({ length: 100 }, () => p(1, 1)));
    strictEqual(s.netto, 100);
    strictEqual(s.ust, 20);
    strictEqual(s.brutto, 120);
  });
});
