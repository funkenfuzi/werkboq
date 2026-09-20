import { strictEqual } from "node:assert";
import { describe, it } from "node:test";
import {
  resturlaub,
  ueberschneidet,
  werktage,
  type Abwesenheit,
} from "../src/daten/abwesenheiten";

/**
 * Urlaubstage sind Zahlen, über die ein Mitarbeiter mit seinem Chef streitet.
 * Sie gehören unter Test und nicht unter Augenmaß — vor allem die halben
 * Tage, die auf Papier am häufigsten falsch gezählt werden.
 */

describe("werktage", () => {
  it("zählt beide Randtage mit", () => {
    // Montag 6.7.2026 bis Freitag 10.7.2026
    strictEqual(werktage("2026-07-06", "2026-07-10"), 5);
  });

  it("lässt Samstag und Sonntag aus", () => {
    // Freitag bis Montag: nur zwei Werktage.
    strictEqual(werktage("2026-07-10", "2026-07-13"), 2);
  });

  it("zählt einen einzelnen Werktag als einen Tag", () => {
    strictEqual(werktage("2026-07-08", "2026-07-08"), 1);
  });

  it("zählt ein Wochenende als null", () => {
    strictEqual(werktage("2026-07-11", "2026-07-12"), 0);
  });

  it("zieht einen halben Tag am Anfang ab", () => {
    strictEqual(werktage("2026-07-06", "2026-07-10", true, false), 4.5);
  });

  it("zieht einen halben Tag am Ende ab", () => {
    strictEqual(werktage("2026-07-06", "2026-07-10", false, true), 4.5);
  });

  it("zieht beide halben Tage ab", () => {
    strictEqual(werktage("2026-07-06", "2026-07-10", true, true), 4);
  });

  it("macht aus einem einzelnen halben Tag nicht zweimal einen halben", () => {
    // Derselbe Tag ist Anfang und Ende — naiv gerechnet käme hier 0 heraus.
    strictEqual(werktage("2026-07-08", "2026-07-08", true, true), 0.5);
    strictEqual(werktage("2026-07-08", "2026-07-08", true, false), 0.5);
  });

  it("ignoriert einen halben Tag, der auf ein Wochenende fällt", () => {
    // Beginn Samstag: es gibt keinen halben Samstag abzuziehen.
    strictEqual(werktage("2026-07-11", "2026-07-15", true, false), 3);
  });

  it("gibt null zurück, wenn das Ende vor dem Beginn liegt", () => {
    strictEqual(werktage("2026-07-10", "2026-07-06"), 0);
  });

  it("rechnet über den Monats- und Jahreswechsel", () => {
    // 28.12.2026 (Mo) bis 5.1.2027 (Di): 28–31.12 sind 4, 1.1 Fr, 4.–5.1 sind 2.
    strictEqual(werktage("2026-12-28", "2027-01-05"), 7);
  });

  it("verträgt einen Zeitstempel statt eines reinen Datums", () => {
    strictEqual(werktage("2026-07-06 00:00:00.000Z", "2026-07-10 00:00:00.000Z"), 5);
  });
});

describe("ueberschneidet", () => {
  const a = { von: "2026-07-06", bis: "2026-07-10" };

  it("erkennt eine Überlappung am Rand", () => {
    strictEqual(ueberschneidet(a, { von: "2026-07-10", bis: "2026-07-15" }), true);
    strictEqual(ueberschneidet(a, { von: "2026-07-01", bis: "2026-07-06" }), true);
  });

  it("erkennt vollständige Enthaltung", () => {
    strictEqual(ueberschneidet(a, { von: "2026-07-07", bis: "2026-07-08" }), true);
  });

  it("meldet nichts bei lückenlosem Anschluss ohne Überlappung", () => {
    strictEqual(ueberschneidet(a, { von: "2026-07-11", bis: "2026-07-15" }), false);
    strictEqual(ueberschneidet(a, { von: "2026-07-01", bis: "2026-07-05" }), false);
  });
});

describe("resturlaub", () => {
  const eintrag = (
    art: string,
    status: string,
    tage: number,
    von = "2026-07-06",
  ) => ({ art, status, tage, von }) as unknown as Abwesenheit;

  it("zieht genehmigten Urlaub ab", () => {
    const k = resturlaub(25, 0, [eintrag("urlaub", "genehmigt", 5)], 2026);
    strictEqual(k.verbraucht, 5);
    strictEqual(k.rest, 20);
  });

  it("rechnet den Übertrag aus dem Vorjahr dazu", () => {
    const k = resturlaub(25, 3, [eintrag("urlaub", "genehmigt", 5)], 2026);
    strictEqual(k.anspruch, 28);
    strictEqual(k.rest, 23);
  });

  it("zieht auch beantragten Urlaub ab — sonst verspricht die Zahl zu viel", () => {
    const k = resturlaub(
      25,
      0,
      [eintrag("urlaub", "genehmigt", 5), eintrag("urlaub", "beantragt", 3)],
      2026,
    );
    strictEqual(k.verbraucht, 5);
    strictEqual(k.beantragt, 3);
    strictEqual(k.rest, 17);
  });

  it("rechnet Krankenstand nicht gegen den Urlaub", () => {
    const k = resturlaub(25, 0, [eintrag("krankenstand", "genehmigt", 10)], 2026);
    strictEqual(k.verbraucht, 0);
    strictEqual(k.rest, 25);
  });

  it("rechnet Zeitausgleich nicht gegen den Urlaub", () => {
    const k = resturlaub(25, 0, [eintrag("zeitausgleich", "genehmigt", 4)], 2026);
    strictEqual(k.rest, 25);
  });

  it("ignoriert Abgelehntes und Storniertes", () => {
    const k = resturlaub(
      25,
      0,
      [eintrag("urlaub", "abgelehnt", 5), eintrag("urlaub", "storniert", 5)],
      2026,
    );
    strictEqual(k.rest, 25);
  });

  it("zählt nur das gefragte Jahr", () => {
    const k = resturlaub(
      25,
      0,
      [eintrag("urlaub", "genehmigt", 5, "2025-07-06"), eintrag("urlaub", "genehmigt", 2)],
      2026,
    );
    strictEqual(k.verbraucht, 2);
  });

  it("darf negativ werden — Vorgriff aufs nächste Jahr kommt vor", () => {
    const k = resturlaub(25, 0, [eintrag("urlaub", "genehmigt", 30)], 2026);
    strictEqual(k.rest, -5);
  });

  it("verträgt halbe Tage", () => {
    const k = resturlaub(25, 0, [eintrag("urlaub", "genehmigt", 0.5)], 2026);
    strictEqual(k.rest, 24.5);
  });
});
