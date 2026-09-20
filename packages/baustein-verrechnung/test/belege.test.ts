import { deepStrictEqual, strictEqual } from "node:assert";
import { describe, it } from "node:test";
import {
  belegsummen,
  faelligAm,
  KLEINBETRAG_GRENZE,
  pflichtangaben,
  ueberfaelligSeit,
  zeilenwert,
} from "../src/daten/belege";
import type { Betrieb, UstSatz } from "@werkboq/core";

const z = (menge: number, einzelpreis: number, ustsatz: UstSatz = 20, rabatt = 0) => ({
  menge,
  einzelpreis,
  ustsatz,
  rabatt,
});

const betrieb = {
  id: "b1",
  created: "",
  updated: "",
  name: "Elektro Huber GmbH",
  strasse: "Hauptstraße 12",
  plz: "2700",
  ort: "Wiener Neustadt",
  uid: "ATU12345678",
} as Betrieb;

const rechnung = {
  belegart: "rechnung" as const,
  nummer: "RE-2026-0001",
  datum: "2026-09-01",
  leistungVon: "2026-08-01",
  empfaengerName: "Musterbau GmbH",
  empfaengerAnschrift: "Baugasse 1\n1010 Wien",
  empfaengerUid: "",
  steuerfrei: "keiner" as const,
  brutto: 120000,
};

describe("zeilenwert", () => {
  it("rechnet Menge mal Preis abzüglich Rabatt", () => {
    strictEqual(zeilenwert(z(120, 145)), 17400);
    strictEqual(zeilenwert(z(10, 10000, 20, 10)), 90000);
  });

  it("verträgt negative Mengen — das ist die Gutschrift", () => {
    strictEqual(zeilenwert(z(-10, 10000)), -100000);
  });
});

describe("belegsummen", () => {
  it("rechnet die Steuer je Satz aus der gerundeten Nettosumme", () => {
    const s = belegsummen([z(120, 145), z(10, 10000, 20, 10), z(2, 5000, 10)]);
    deepStrictEqual(s.nettoJeSatz, { "20": 107400, "10": 10000 });
    strictEqual(s.netto, 117400);
    strictEqual(s.ust, 22480);
    strictEqual(s.brutto, 139880);
  });

  it("weist bei Bauleistung keine Umsatzsteuer aus, egal was an der Zeile steht", () => {
    // Der Grund liegt am Beleg, nicht an der Position: § 19 Abs 1a UStG.
    const s = belegsummen([z(120, 145, 20), z(2, 5000, 10)], "bauleistung");
    deepStrictEqual(s.nettoJeSatz, { "0": 27400 });
    strictEqual(s.ust, 0);
    strictEqual(s.brutto, s.netto);
  });

  it("gilt genauso für Kleinunternehmer und Ausfuhr", () => {
    for (const grund of ["kleinunternehmer", "ausfuhr", "innergemeinschaftlich"] as const) {
      strictEqual(belegsummen([z(1, 10000, 20)], grund).ust, 0);
    }
  });

  it("spiegelt eine Gutschrift vorzeichenrichtig", () => {
    const s = belegsummen([z(-10, 10000, 20)]);
    strictEqual(s.netto, -100000);
    strictEqual(s.ust, -20000);
    strictEqual(s.brutto, -120000);
  });

  it("liefert bei leerem Beleg Nullen", () => {
    const s = belegsummen([]);
    strictEqual(s.netto, 0);
    strictEqual(s.ust, 0);
    strictEqual(s.brutto, 0);
  });
});

describe("Fälligkeit", () => {
  it("zählt das Zahlungsziel auf das Belegdatum", () => {
    strictEqual(faelligAm({ datum: "2026-09-01", zahlungszielTage: 14 }), "2026-09-15");
  });

  it("rechnet über den Monatswechsel", () => {
    strictEqual(faelligAm({ datum: "2026-08-25", zahlungszielTage: 14 }), "2026-09-08");
  });

  it("meldet erst ab dem Tag nach der Fälligkeit Überfälligkeit", () => {
    const b = { datum: "2026-09-01", zahlungszielTage: 14 };
    strictEqual(ueberfaelligSeit(b, "2026-09-15"), 0);
    strictEqual(ueberfaelligSeit(b, "2026-09-16"), 1);
    strictEqual(ueberfaelligSeit(b, "2026-10-15"), 30);
  });
});

describe("pflichtangaben nach § 11 UStG", () => {
  it("findet an einer vollständigen Rechnung nichts zu beanstanden", () => {
    deepStrictEqual(pflichtangaben(rechnung, betrieb, 3), []);
  });

  it("verlangt den Leistungszeitraum", () => {
    const fehlt = pflichtangaben({ ...rechnung, leistungVon: "" }, betrieb, 3);
    strictEqual(fehlt.some((f) => f.includes("Leistungszeitraum")), true);
  });

  it("verlangt die UID des Betriebs", () => {
    const fehlt = pflichtangaben(rechnung, { ...betrieb, uid: "" } as Betrieb, 3);
    strictEqual(fehlt.some((f) => f.includes("UID-Nummer des Betriebs")), true);
  });

  it("lässt bei der Kleinbetragsrechnung bis 400 € brutto mehr durchgehen", () => {
    const klein = { ...rechnung, brutto: KLEINBETRAG_GRENZE, empfaengerName: "", empfaengerAnschrift: "" };
    deepStrictEqual(pflichtangaben(klein, betrieb, 1), []);
  });

  it("verlangt einen Cent über der Grenze wieder alles", () => {
    const knapp = {
      ...rechnung,
      brutto: KLEINBETRAG_GRENZE + 1,
      empfaengerName: "",
      empfaengerAnschrift: "",
    };
    const fehlt = pflichtangaben(knapp, betrieb, 1);
    strictEqual(fehlt.some((f) => f.includes("Name des Leistungsempfängers")), true);
  });

  it("verlangt bei Bauleistung die UID des Empfängers", () => {
    const bau = { ...rechnung, steuerfrei: "bauleistung" as const, brutto: 50000 };
    const fehlt = pflichtangaben(bau, betrieb, 2);
    strictEqual(fehlt.some((f) => f.includes("UID des Empfängers")), true);
    deepStrictEqual(pflichtangaben({ ...bau, empfaengerUid: "ATU87654321" }, betrieb, 2), []);
  });

  it("verlangt ab 10.000 € brutto die UID des Empfängers", () => {
    const gross = { ...rechnung, brutto: 1000001 };
    strictEqual(
      pflichtangaben(gross, betrieb, 2).some((f) => f.includes("UID des Empfängers")),
      true,
    );
    strictEqual(pflichtangaben({ ...rechnung, brutto: 1000000 }, betrieb, 2).length, 0);
  });

  it("beanstandet einen Beleg ohne Positionen", () => {
    strictEqual(
      pflichtangaben(rechnung, betrieb, 0).some((f) => f.includes("keine Positionen")),
      true,
    );
  });

  it("misst ein Angebot nicht an den Rechnungsvorschriften", () => {
    const angebot = { ...rechnung, belegart: "angebot" as const, leistungVon: "", nummer: "" };
    deepStrictEqual(pflichtangaben(angebot, betrieb, 2), []);
  });
});
