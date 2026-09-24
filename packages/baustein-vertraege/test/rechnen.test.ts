import { deepStrictEqual, ok, strictEqual } from "node:assert";
import { describe, it } from "node:test";
import {
  folgewartung,
  hinweise,
  kuendigungWirktZum,
  laufzeit,
  pauschalzeitraum,
  plusMonate,
  type Vertragsdaten,
} from "../src/daten/rechnen";

/**
 * Wartungsverträge.
 *
 * Jeder Fehler hier ist einer, der erst Monate später auffällt: eine
 * Wartung, die nie aufschien, eine Pauschale, die nie verrechnet wurde,
 * eine Kündigungsfrist, die still verstrich.
 */

const v = (x: Partial<Vertragsdaten> = {}): Vertragsdaten => ({
  status: "aktiv",
  intervallMonate: 12,
  naechsteWartung: "2026-10-15",
  vorlaufTage: 30,
  verrechnung: "pauschale",
  pauschale: 48000,
  rhythmus: "quartal",
  naechsteRechnung: "2026-10-01",
  beginn: "2024-01-01",
  laufzeitMonate: 24,
  verlaengerungMonate: 12,
  kuendigungsfristMonate: 3,
  preisStand: "2026-01-01",
  ...x,
});

describe("plusMonate", () => {
  it("kappt Monatsenden, auch rückwärts und im Schaltjahr", () => {
    strictEqual(plusMonate("2026-01-31", 1), "2026-02-28");
    strictEqual(plusMonate("2028-01-31", 1), "2028-02-29");
    strictEqual(plusMonate("2026-01-31", -3), "2025-10-31");
    strictEqual(plusMonate("2026-03-15", -15), "2024-12-15");
  });
});

describe("laufzeit", () => {
  it("zählt die Verlängerungen bis in die laufende Periode", () => {
    // Beginn 1.1.2024, 24 Monate, dann jährlich: Ende 31.12.2024+1 = 2025-12-31, dann 2026-12-31.
    const l = laufzeit(v(), "2026-09-24");
    strictEqual(l.ende, "2026-12-31");
    strictEqual(l.letzterKuendigungstag, "2026-09-30");
    strictEqual(l.verlaengertSich, true);
    strictEqual(l.abgelaufen, false);
  });

  it("steht am letzten Tag noch in der Periode", () => {
    strictEqual(laufzeit(v(), "2025-12-31").ende, "2025-12-31");
    strictEqual(laufzeit(v(), "2026-01-01").ende, "2026-12-31");
  });

  it("läuft ohne Verlängerung ab", () => {
    const l = laufzeit(v({ verlaengerungMonate: 0 }), "2026-09-24");
    strictEqual(l.ende, "2025-12-31");
    strictEqual(l.abgelaufen, true);
  });

  it("ist ohne Laufzeit unbefristet", () => {
    deepStrictEqual(laufzeit(v({ laufzeitMonate: 0 }), "2026-09-24"), {
      ende: null,
      letzterKuendigungstag: null,
      verlaengertSich: false,
      abgelaufen: false,
    });
  });

  it("endet nach einer Kündigung zum vereinbarten Tag", () => {
    const l = laufzeit(v({ status: "gekuendigt", gekuendigtZum: "2026-12-31" }), "2027-01-02");
    strictEqual(l.ende, "2026-12-31");
    strictEqual(l.abgelaufen, true);
  });
});

describe("hinweise", () => {
  const arten = (h: ReturnType<typeof hinweise>) => h.map((x) => x.art);

  it("meldet die Wartung erst im Vorlauf", () => {
    strictEqual(arten(hinweise(v({ naechsteRechnung: "2027-01-01" }), "2026-09-14")).includes("wartung"), false);
    ok(arten(hinweise(v(), "2026-09-15")).includes("wartung"));
  });

  it("meldet eine überfällige Wartung als dringend", () => {
    const h = hinweise(v(), "2026-10-20").find((x) => x.art === "wartung")!;
    strictEqual(h.dringend, true);
    strictEqual(h.tage, -5);
  });

  it("meldet die Pauschale ab dem Fälligkeitstag, und nur bei Pauschale", () => {
    ok(!arten(hinweise(v(), "2026-09-30")).includes("rechnung"));
    ok(arten(hinweise(v(), "2026-10-01")).includes("rechnung"));
    ok(!arten(hinweise(v({ verrechnung: "aufwand" }), "2026-10-01")).includes("rechnung"));
  });

  it("erinnert 60 Tage vor dem letzten Kündigungstag, nicht früher", () => {
    // letzter Kündigungstag 2026-09-30
    ok(!arten(hinweise(v(), "2026-07-31")).includes("kuendigung"));
    ok(arten(hinweise(v(), "2026-08-01")).includes("kuendigung"));
    ok(arten(hinweise(v(), "2026-09-30")).includes("kuendigung"));
    ok(!arten(hinweise(v(), "2026-10-01")).includes("kuendigung"));
  });

  it("erinnert an die Preisprüfung nach einem Jahr ohne Änderung", () => {
    ok(!arten(hinweise(v(), "2026-12-31")).includes("preis"));
    ok(arten(hinweise(v(), "2027-01-01")).includes("preis"));
  });

  it("meldet nach der Kündigung nichts mehr, was nach dem Ende liegt", () => {
    const g = v({ status: "gekuendigt", gekuendigtZum: "2026-10-10" });
    // Wartung am 15.10. liegt nach dem Ende: keine Pflicht mehr.
    ok(!arten(hinweise(g, "2026-10-01")).includes("wartung"));
    // Die Pauschale ab 1.10. liegt vor dem Ende: noch zu verrechnen.
    ok(arten(hinweise(g, "2026-10-01")).includes("rechnung"));
  });

  it("sagt, wenn ein befristeter Vertrag abgelaufen ist", () => {
    deepStrictEqual(arten(hinweise(v({ verlaengerungMonate: 0 }), "2026-09-24")), ["ablauf"]);
  });
});

describe("folgewartung", () => {
  it("rechnet vom Fälligkeitstag, nicht vom Klick", () => {
    strictEqual(folgewartung(v()), "2027-10-15");
    strictEqual(folgewartung(v({ intervallMonate: 6, naechsteWartung: "2026-08-31" })), "2027-02-28");
  });
});

describe("pauschalzeitraum", () => {
  it("verrechnet ein volles Quartal und nennt die nächste Fälligkeit", () => {
    deepStrictEqual(pauschalzeitraum(v(), "2026-10-01"), {
      von: "2026-10-01",
      bis: "2026-12-31",
      betrag: 48000,
      folgeRechnung: "2027-01-01",
    });
  });

  it("verrechnet nach einer Kündigung nur anteilig bis zum Ende", () => {
    const z = pauschalzeitraum(v({ status: "gekuendigt", gekuendigtZum: "2026-11-15" }), "2026-10-01")!;
    strictEqual(z.bis, "2026-11-15");
    // 46 von 92 Tagen
    strictEqual(z.betrag, Math.round((48000 * 46) / 92));
  });

  it("verrechnet nichts mehr nach dem Ende", () => {
    strictEqual(pauschalzeitraum(v({ status: "gekuendigt", gekuendigtZum: "2026-09-30" }), "2026-10-01"), null);
  });

  it("gibt es bei Aufwand nicht", () => {
    strictEqual(pauschalzeitraum(v({ verrechnung: "aufwand" }), "2026-10-01"), null);
  });
});

describe("kuendigungWirktZum", () => {
  it("wirkt zum Periodenende, wenn sie am letzten Tag eingeht", () => {
    // Drei Monate zum 31.12.: Zugang am 30.9., Frist läuft ab 1.10.
    strictEqual(kuendigungWirktZum(v(), "2026-09-30"), "2026-12-31");
  });

  it("wirkt ein Jahr später, wenn sie einen Tag zu spät kommt", () => {
    strictEqual(kuendigungWirktZum(v(), "2026-10-01"), "2027-12-31");
  });

  it("wirkt bei unbefristeten Verträgen zum Monatsende nach der Frist", () => {
    strictEqual(kuendigungWirktZum(v({ laufzeitMonate: 0 }), "2026-09-24"), "2026-12-31");
  });

  it("wirkt ohne Frist sofort", () => {
    strictEqual(kuendigungWirktZum(v({ laufzeitMonate: 0, kuendigungsfristMonate: 0 }), "2026-09-24"), "2026-09-24");
  });
});
