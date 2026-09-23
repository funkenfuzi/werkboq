import { deepStrictEqual, ok, strictEqual } from "node:assert";
import { describe, it } from "node:test";
import {
  alsWindows1252,
  betragCsv,
  bmdCsv,
  bmdSteuercode,
  csv,
  datumCsv,
  fehlendeKonten,
  journal,
  journalCsv,
  umsatzbelege,
  zahlungenCsv,
} from "../src/daten/export";
import type { Beleg } from "../src/daten/belege";

/**
 * Export für den Steuerberater.
 *
 * Hier zählt jeder Cent zweimal: einmal auf der Rechnung, einmal in der
 * Buchhaltung. Weichen die beiden ab, sucht jemand in der Kanzlei einen
 * Fehler, den es in Werkboq gibt.
 */

const beleg = (x: Partial<Beleg>): Beleg =>
  ({
    id: "b1",
    belegart: "rechnung",
    nummer: "RE-2026-0001",
    kunde: "k1",
    status: "offen",
    datum: "2026-09-10 00:00:00.000Z",
    festgeschrieben: "2026-09-10 08:00:00.000Z",
    empfaengerName: "Familie Gruber",
    empfaengerAnschrift: "",
    steuerfrei: "keiner",
    zahlungszielTage: 14,
    netto: 110000,
    ust: 21000,
    brutto: 131000,
    nettoJeSatz: { "20": 100000, "10": 10000 },
    ...x,
  }) as Beleg;

describe("umsatzbelege", () => {
  it("nimmt nur festgeschriebene Rechnungen und Gutschriften im Zeitraum", () => {
    const liste = [
      beleg({ id: "a", nummer: "RE-1" }),
      beleg({ id: "b", nummer: "AN-1", belegart: "angebot" }),
      beleg({ id: "c", nummer: "AB-1", belegart: "auftragsbestaetigung" }),
      beleg({ id: "d", nummer: "RE-2", festgeschrieben: "" }),
      beleg({ id: "e", nummer: "GS-1", belegart: "gutschrift" }),
      beleg({ id: "f", nummer: "RE-3", datum: "2026-10-01 00:00:00.000Z" }),
      beleg({ id: "g", nummer: "RE-0", datum: "2026-08-31 00:00:00.000Z" }),
    ];
    deepStrictEqual(
      umsatzbelege(liste, "2026-09-01", "2026-09-30").map((b) => b.nummer),
      ["GS-1", "RE-1"],
    );
  });

  it("zählt den letzten Tag des Zeitraums mit", () => {
    strictEqual(umsatzbelege([beleg({ datum: "2026-09-30 00:00:00.000Z" })], "2026-09-01", "2026-09-30").length, 1);
  });
});

describe("journal", () => {
  it("macht eine Zeile je Steuersatz, und die Steuer stimmt mit dem Beleg überein", () => {
    const z = journal([beleg({})]);
    strictEqual(z.length, 2);
    strictEqual(z.reduce((s, x) => s + x.steuer, 0), 21000);
    strictEqual(z.reduce((s, x) => s + x.brutto, 0), 131000);
  });

  it("rundet je Satz wie belegsummen", () => {
    // 333 Cent × 20 % = 66,6 → 67
    const z = journal([beleg({ nettoJeSatz: { "20": 333 }, netto: 333 })]);
    strictEqual(z[0]!.steuer, 67);
  });

  it("weist bei Übergang der Steuerschuld keine Steuer aus", () => {
    const z = journal([beleg({ steuerfrei: "bauleistung", nettoJeSatz: { "0": 50000 }, netto: 50000, ust: 0 })]);
    strictEqual(z[0]!.steuer, 0);
    strictEqual(z[0]!.steuersatz, 0);
  });

  it("führt eine Gutschrift negativ und nennt die stornierte Rechnung", () => {
    const z = journal(
      [beleg({ id: "g", belegart: "gutschrift", nummer: "GS-1", storniert: "r", nettoJeSatz: { "20": -100000 } })],
      new Map([["r", "RE-9"]]),
    );
    strictEqual(z[0]!.netto, -100000);
    strictEqual(z[0]!.steuer, -20000);
    strictEqual(z[0]!.bezug, "RE-9");
  });
});

describe("CSV", () => {
  it("schreibt Beträge mit Komma und ohne Tausenderpunkt", () => {
    strictEqual(betragCsv(123456789), "1234567,89");
    strictEqual(betragCsv(-5), "-0,05");
    strictEqual(betragCsv(0), "0,00");
  });

  it("schreibt das Datum österreichisch", () => {
    strictEqual(datumCsv("2026-09-03 00:00:00.000Z"), "03.09.2026");
  });

  it("setzt Felder mit Semikolon oder Anführungszeichen in Anführungszeichen", () => {
    strictEqual(csv(["a"], [["Müller; Söhne"]]), 'a\r\n"Müller; Söhne"\r\n');
    strictEqual(csv(["a"], [['Firma "Blitz"']]), 'a\r\n"Firma ""Blitz"""\r\n');
    // Gegenprobe: ein harmloses Feld bleibt, wie es ist.
    strictEqual(csv(["a"], [["Gruber"]]), "a\r\nGruber\r\n");
  });

  it("baut das Rechnungsausgangsbuch", () => {
    const text = journalCsv(journal([beleg({})]));
    const zeilen = text.trim().split("\r\n");
    strictEqual(zeilen.length, 3);
    ok(zeilen.includes("10.09.2026;RE-2026-0001;Rechnung;Familie Gruber;;20;1000,00;200,00;1200,00;;"));
    ok(zeilen.includes("10.09.2026;RE-2026-0001;Rechnung;Familie Gruber;;10;100,00;10,00;110,00;;"));
  });

  it("listet Zahlungen im Zeitraum mit Belegnummer", () => {
    const text = zahlungenCsv(
      [
        { id: "z1", beleg: "b1", datum: "2026-09-12 00:00:00.000Z", betrag: 131000, art: "ueberweisung" } as never,
        { id: "z2", beleg: "b1", datum: "2026-10-12 00:00:00.000Z", betrag: 1, art: "bar" } as never,
      ],
      new Map([["b1", { nummer: "RE-1", empfaengerName: "Gruber" }]]),
      "2026-09-01",
      "2026-09-30",
    );
    deepStrictEqual(text.trim().split("\r\n").slice(1), ["12.09.2026;RE-1;Gruber;1310,00;Überweisung;"]);
  });
});

describe("BMD", () => {
  const konten = { debitor: "200000", erloese: { "20": "4000", "10": "4010" }, bauleistung: "4030", steuerfrei: "4050" };

  it("sagt, welche Konten fehlen — nur die, die gebraucht werden", () => {
    const z = journal([beleg({})]);
    deepStrictEqual(fehlendeKonten({}, z), ["Debitorenkonto", "Erlöskonto 10 %", "Erlöskonto 20 %"]);
    deepStrictEqual(fehlendeKonten(konten, z), []);
    const bau = journal([beleg({ steuerfrei: "bauleistung", nettoJeSatz: { "0": 1 } })]);
    deepStrictEqual(fehlendeKonten({ debitor: "1" }, bau), ["Erlöskonto Bauleistung"]);
  });

  it("vergibt die Steuercodes laut BMD", () => {
    const [a] = journal([beleg({ nettoJeSatz: { "20": 1 } })]);
    const [b] = journal([beleg({ steuerfrei: "bauleistung", nettoJeSatz: { "0": 1 } })]);
    const [c] = journal([beleg({ steuerfrei: "ausfuhr", nettoJeSatz: { "0": 1 } })]);
    deepStrictEqual([bmdSteuercode(a!), bmdSteuercode(b!), bmdSteuercode(c!)], [3, 17, 0]);
  });

  it("bucht den Erlös im Haben: Rechnung negativ, Gutschrift positiv", () => {
    const text = bmdCsv(journal([beleg({ nettoJeSatz: { "20": 100000 } })]), konten);
    const [kopf, zeile] = text.trim().split("\r\n");
    strictEqual(kopf, "satzart;konto;gkto;belegnr;belegdat;buchdat;symbol;bucod;mwst;steucod;betrag;steuer;text");
    strictEqual(zeile, "0;4000;200000;RE-2026-0001;20260910;20260910;AR;2;20;3;-1000,00;-200,00;Familie Gruber RE-2026-0001");
    const gs = bmdCsv(journal([beleg({ nummer: "GS-1", nettoJeSatz: { "20": -100000 } })]), konten).trim().split("\r\n")[1];
    ok(gs!.includes(";1;20;3;1000,00;200,00;"), gs);
  });

  it("nimmt für die Bauleistung das eigene Konto", () => {
    const text = bmdCsv(journal([beleg({ steuerfrei: "bauleistung", nettoJeSatz: { "0": 5000 } })]), konten);
    ok(text.includes("0;4030;200000;"));
    ok(text.includes(";0;17;-50,00;0,00;"));
  });
});

describe("Windows-1252", () => {
  it("schreibt Umlaute und das Eurozeichen so, wie ältere Programme sie lesen", () => {
    deepStrictEqual([...alsWindows1252("Ä€ü–")], [0xc4, 0x80, 0xfc, 0x96]);
  });

  it("macht aus Unbekanntem ein Fragezeichen statt Datenmüll", () => {
    deepStrictEqual([...alsWindows1252("a✓b")], [0x61, 0x3f, 0x62]);
  });
});
