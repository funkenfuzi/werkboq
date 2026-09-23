import { deepStrictEqual, ok, strictEqual } from "node:assert";
import { describe, it } from "node:test";
import { nachfassRhythmus } from "@werkboq/core";
import {
  ABSAGEGRUENDE,
  absagenNachGrund,
  KONTAKTARTEN,
  nachDringlichkeit,
  nachfassstand,
  plusTage,
  tageZwischen,
  termintext,
} from "../src/daten/nachfassen";
// @ts-expect-error — reines JavaScript, siehe ../schema.mjs
import SCHEMA from "../schema.mjs";
// @ts-expect-error — dito
import { KERN } from "../../../server/schema.mjs";

/**
 * Angebotsverfolgung.
 *
 * Was hier schiefgeht, merkt niemand: ein Angebot, das nie fällig wird,
 * erinnert nicht — und das Fehlen einer Erinnerung fällt nicht auf. Darum
 * jeder Weg zum Termin einzeln, und jeweils die Gegenprobe.
 */

const angebot = (x: Partial<{ status: string; datum: string; festgeschrieben: string; wiedervorlage: string }> = {}) => ({
  status: "offen" as const,
  datum: "2026-09-01",
  festgeschrieben: "2026-09-02 08:15:00.000Z",
  ...x,
}) as Parameters<typeof nachfassstand>[0];

const R = [7, 14, 30];

describe("Datumsrechnung", () => {
  it("rechnet über Monatsgrenzen", () => {
    strictEqual(plusTage("2026-09-28", 7), "2026-10-05");
    strictEqual(plusTage("2026-12-30", 3), "2027-01-02");
  });

  it("zählt Tage über die Zeitumstellung ohne Rest", () => {
    // 25. Oktober 2026: Umstellung auf Winterzeit. Ein Tag hat 25 Stunden.
    strictEqual(tageZwischen("2026-10-24", "2026-10-26"), 2);
  });
});

describe("nachfassstand", () => {
  it("wird sieben Tage nach dem Versand fällig, nicht nach dem Belegdatum", () => {
    const s = nachfassstand(angebot(), [], R, "2026-09-09");
    strictEqual(s.termin, "2026-09-09");
    strictEqual(s.zustand, "faellig");
    strictEqual(s.quelle, "rhythmus");
  });

  it("wartet am Tag davor", () => {
    const s = nachfassstand(angebot(), [], R, "2026-09-08");
    strictEqual(s.zustand, "wartet");
    strictEqual(s.tage, 1);
  });

  it("nimmt nach dem ersten Kontakt die zweite Stufe, gerechnet vom Kontakt", () => {
    const s = nachfassstand(angebot(), [{ datum: "2026-09-10" }], R, "2026-09-11");
    strictEqual(s.termin, "2026-09-24");
    strictEqual(s.kontakte, 1);
  });

  it("zählt Kontakte in beliebiger Reihenfolge richtig", () => {
    const s = nachfassstand(angebot(), [{ datum: "2026-09-24" }, { datum: "2026-09-10" }], R, "2026-09-25");
    strictEqual(s.seit, "2026-09-24");
    strictEqual(s.termin, "2026-10-24");
  });

  it("wird kalt, wenn der Rhythmus aufgebraucht ist", () => {
    const k = [{ datum: "2026-09-10" }, { datum: "2026-09-24" }, { datum: "2026-10-24" }];
    const s = nachfassstand(angebot(), k, R, "2026-12-01");
    strictEqual(s.zustand, "kalt");
    strictEqual(s.termin, null);
    strictEqual(termintext(s), "3× nachgefasst, keine Antwort");
  });

  it("lässt die Wiedervorlage vor dem Rhythmus gelten — auch später als dieser", () => {
    const s = nachfassstand(angebot({ wiedervorlage: "2026-10-15" }), [], R, "2026-09-09");
    strictEqual(s.termin, "2026-10-15");
    strictEqual(s.quelle, "wiedervorlage");
    strictEqual(s.zustand, "wartet");
  });

  it("hält ein kaltes Angebot mit Wiedervorlage warm", () => {
    const k = [{ datum: "2026-09-10" }, { datum: "2026-09-24" }, { datum: "2026-10-24" }];
    const s = nachfassstand(angebot({ wiedervorlage: "2026-11-02" }), k, R, "2026-11-02");
    strictEqual(s.zustand, "faellig");
  });

  it("erinnert bei angenommenen und abgelehnten Angeboten nicht mehr", () => {
    for (const status of ["angenommen", "abgelehnt"]) {
      const s = nachfassstand(angebot({ status }), [], R, "2027-01-01");
      strictEqual(s.zustand, "erledigt");
      strictEqual(s.termin, null);
    }
  });

  it("nimmt das Belegdatum, wenn kein Festschreibedatum da ist", () => {
    const s = nachfassstand(angebot({ festgeschrieben: "" }), [], R, "2026-09-08");
    strictEqual(s.termin, "2026-09-08");
  });

  it("folgt einem eigenen Rhythmus", () => {
    strictEqual(nachfassstand(angebot(), [], [3], "2026-09-05").zustand, "faellig");
    strictEqual(nachfassstand(angebot(), [{ datum: "2026-09-05" }], [3], "2026-09-20").zustand, "kalt");
  });
});

describe("nachfassRhythmus", () => {
  it("liest getippte und gespeicherte Formen", () => {
    deepStrictEqual(nachfassRhythmus("5, 10;20  40"), [5, 10, 20, 40]);
    deepStrictEqual(nachfassRhythmus([3, 9]), [3, 9]);
  });

  it("fällt bei Leerem und Unsinn auf die Vorgabe zurück — nie auf keinen Rhythmus", () => {
    deepStrictEqual(nachfassRhythmus(""), [7, 14, 30]);
    deepStrictEqual(nachfassRhythmus(null), [7, 14, 30]);
    deepStrictEqual(nachfassRhythmus("nie, -3, 0, 2.5"), [7, 14, 30]);
  });
});

describe("Reihenfolge und Text", () => {
  it("stellt Überfälliges vor Wartendes vor Kaltes", () => {
    const z = (zustand: string, termin: string | null, seit = "2026-09-01") => ({
      stand: { zustand, termin, seit } as ReturnType<typeof nachfassstand>,
    });
    const r = nachDringlichkeit([z("kalt", null), z("wartet", "2026-10-01"), z("faellig", "2026-09-20"), z("faellig", "2026-09-10")]);
    deepStrictEqual(
      r.map((x) => `${x.stand.zustand} ${x.stand.termin}`),
      ["faellig 2026-09-10", "faellig 2026-09-20", "wartet 2026-10-01", "kalt null"],
    );
  });

  it("spricht wie ein Mensch", () => {
    const t = (tage: number, termin = "2026-10-15") =>
      termintext({ zustand: tage <= 0 ? "faellig" : "wartet", termin, quelle: "rhythmus", kontakte: 0, tage, seit: "" });
    strictEqual(t(0), "heute");
    strictEqual(t(-1), "seit gestern");
    strictEqual(t(-4), "seit 4 Tagen");
    strictEqual(t(1), "morgen");
    strictEqual(t(6), "in 6 Tagen");
    strictEqual(t(40), "am 15.10.");
  });
});

describe("absagenNachGrund", () => {
  it("summiert je Grund und sortiert nach verlorenem Betrag", () => {
    const r = absagenNachGrund([
      { status: "abgelehnt", netto: 100000, absagegrund: "preis" },
      { status: "abgelehnt", netto: 50000, absagegrund: "preis" },
      { status: "abgelehnt", netto: 400000, absagegrund: "keine_rueckmeldung" },
      { status: "angenommen", netto: 999999, absagegrund: "preis" },
      { status: "abgelehnt", netto: 1000 },
    ]);
    deepStrictEqual(r, [
      { grund: "keine_rueckmeldung", anzahl: 1, netto: 400000 },
      { grund: "preis", anzahl: 2, netto: 150000 },
      { grund: "sonstiges", anzahl: 1, netto: 1000 },
    ]);
  });
});

describe("Schema", () => {
  type F = { name: string; options?: { values?: string[] } };
  type C = { name: string; schema: F[]; updateRule?: string | null; deleteRule?: string | null };
  const c = (liste: C[], name: string) => {
    const x = liste.find((y) => y.name === name);
    ok(x, `${name} fehlt`);
    return x;
  };
  const werte = (col: C, feld: string) => col.schema.find((f) => f.name === feld)?.options?.values;

  it("kennt dieselben Absagegründe und Kontaktarten wie der Code", () => {
    deepStrictEqual(werte(c(SCHEMA, "belege"), "absagegrund"), [...ABSAGEGRUENDE]);
    deepStrictEqual(werte(c(SCHEMA, "angebotskontakte"), "art"), [...KONTAKTARTEN]);
  });

  it("hat die Felder der Angebotsverfolgung", () => {
    const felder = c(SCHEMA, "belege").schema.map((f) => f.name);
    for (const f of ["wiedervorlage", "absagegrund", "absagenotiz"]) ok(felder.includes(f), f);
    ok(c(KERN, "betrieb").schema.some((f) => f.name === "nachfassTage"));
  });

  it("hält Nachfasseinträge unveränderlich", () => {
    const k = c(SCHEMA, "angebotskontakte");
    strictEqual(k.updateRule, null);
    strictEqual(k.deleteRule, null);
  });
});
