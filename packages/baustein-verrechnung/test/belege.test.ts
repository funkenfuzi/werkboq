import { deepStrictEqual, strictEqual } from "node:assert";
import { describe, it } from "node:test";
import {
  belegsummen,
  faelligAm,
  grundText,
  moeglicheGruende,
  pflichtangaben,
  steuerfreiHinweis,
  ueberfaelligSeit,
  zeilenwert,
} from "../src/daten/belege";
import { RECHTSRAEUME, type Betrieb, type UstSatz } from "@werkboq/core";

const AT = RECHTSRAEUME.at;
const DE = RECHTSRAEUME.de;
const CH = RECHTSRAEUME.ch;

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

describe("pflichtangaben", () => {
  it("findet an einer vollständigen Rechnung nichts zu beanstanden", () => {
    deepStrictEqual(pflichtangaben(rechnung, betrieb, 3, AT), []);
  });

  it("verlangt den Leistungszeitraum", () => {
    const fehlt = pflichtangaben({ ...rechnung, leistungVon: "" }, betrieb, 3, AT);
    strictEqual(fehlt.some((f) => f.includes("Leistungszeitraum")), true);
  });

  it("verlangt die Steuernummer des Betriebs, und nennt sie beim Namen des Landes", () => {
    const ohne = { ...betrieb, uid: "" } as Betrieb;
    strictEqual(
      pflichtangaben(rechnung, ohne, 3, AT).some((f) => f.includes("UID-Nummer des Betriebs")),
      true,
    );
    strictEqual(
      pflichtangaben(rechnung, ohne, 3, DE).some((f) =>
        f.includes("Umsatzsteuer-Identifikationsnummer des Betriebs"),
      ),
      true,
    );
    strictEqual(
      pflichtangaben(rechnung, ohne, 3, CH).some((f) => f.includes("UID / MWST-Nummer")),
      true,
    );
  });

  it("beanstandet einen Beleg ohne Positionen", () => {
    strictEqual(
      pflichtangaben(rechnung, betrieb, 0, AT).some((f) => f.includes("keine Positionen")),
      true,
    );
  });

  it("misst ein Angebot nicht an den Rechnungsvorschriften", () => {
    const angebot = { ...rechnung, belegart: "angebot" as const, leistungVon: "", nummer: "" };
    deepStrictEqual(pflichtangaben(angebot, betrieb, 2, AT), []);
  });
});

describe("Kleinbetragsrechnung je Land", () => {
  const ohneEmpfaenger = { empfaengerName: "", empfaengerAnschrift: "" };

  it("lässt in Österreich bis 400 € brutto die vereinfachten Angaben genügen", () => {
    strictEqual(AT.kleinbetragGrenze, 40000);
    const klein = { ...rechnung, ...ohneEmpfaenger, brutto: 40000 };
    deepStrictEqual(pflichtangaben(klein, betrieb, 1, AT), []);
  });

  it("zieht in Deutschland die Grenze schon bei 250 € (§ 33 UStDV)", () => {
    strictEqual(DE.kleinbetragGrenze, 25000);
    deepStrictEqual(pflichtangaben({ ...rechnung, ...ohneEmpfaenger, brutto: 25000 }, betrieb, 1, DE), []);
    // Der österreichische Betrag ist in Deutschland schon zu hoch.
    strictEqual(
      pflichtangaben({ ...rechnung, ...ohneEmpfaenger, brutto: 40000 }, betrieb, 1, DE).some((f) =>
        f.includes("Name des Leistungsempfängers"),
      ),
      true,
    );
  });

  it("kennt die Schweiz gar keine Erleichterung", () => {
    strictEqual(CH.kleinbetragGrenze, 0);
    strictEqual(
      pflichtangaben({ ...rechnung, ...ohneEmpfaenger, brutto: 1000 }, betrieb, 1, CH).some((f) =>
        f.includes("Name des Leistungsempfängers"),
      ),
      true,
    );
  });

  it("verlangt einen Cent über der Grenze wieder alles", () => {
    const knapp = { ...rechnung, ...ohneEmpfaenger, brutto: AT.kleinbetragGrenze + 1 };
    strictEqual(
      pflichtangaben(knapp, betrieb, 1, AT).some((f) => f.includes("Name des Leistungsempfängers")),
      true,
    );
  });
});

describe("Bauleistung und Steuernummer des Empfängers", () => {
  it("verlangt bei Bauleistung die Steuernummer des Empfängers", () => {
    const bau = { ...rechnung, steuerfrei: "bauleistung" as const, brutto: 50000 };
    strictEqual(
      pflichtangaben(bau, betrieb, 2, AT).some((f) => f.includes("des Empfängers")),
      true,
    );
    deepStrictEqual(pflichtangaben({ ...bau, empfaengerUid: "ATU87654321" }, betrieb, 2, AT), []);
  });

  it("verlangt in Österreich ab 10.000 € brutto die UID des Empfängers", () => {
    strictEqual(AT.uidEmpfaengerAb, 1000000);
    strictEqual(
      pflichtangaben({ ...rechnung, brutto: 1000001 }, betrieb, 2, AT).some((f) =>
        f.includes("des Empfängers"),
      ),
      true,
    );
    strictEqual(pflichtangaben({ ...rechnung, brutto: 1000000 }, betrieb, 2, AT).length, 0);
  });

  it("kennt Deutschland keine betragsabhängige Grenze", () => {
    strictEqual(DE.uidEmpfaengerAb, 0);
    deepStrictEqual(pflichtangaben({ ...rechnung, brutto: 5000000 }, betrieb, 2, DE), []);
  });

  it("gibt es den Übergang der Steuerschuld in der Schweiz nicht", () => {
    strictEqual(CH.bauleistung.moeglich, false);
    strictEqual(moeglicheGruende(CH).includes("bauleistung"), false);
    strictEqual(moeglicheGruende(AT).includes("bauleistung"), true);
    strictEqual(moeglicheGruende(DE).includes("bauleistung"), true);
  });

  it("nennt die innergemeinschaftliche Lieferung nur im EU-Raum", () => {
    strictEqual(moeglicheGruende(CH).includes("innergemeinschaftlich"), false);
    strictEqual(moeglicheGruende(DE).includes("innergemeinschaftlich"), true);
  });
});

describe("Pflichthinweise je Land", () => {
  it("nennt für die Bauleistung die Fundstelle des jeweiligen Landes", () => {
    strictEqual(steuerfreiHinweis("bauleistung", AT).includes("§ 19 Abs 1a UStG"), true);
    strictEqual(steuerfreiHinweis("bauleistung", DE).includes("§ 13b Abs 2 Nr 4 UStG"), true);
  });

  it("nennt für den Kleinunternehmer die Fundstelle des jeweiligen Landes", () => {
    strictEqual(steuerfreiHinweis("kleinunternehmer", AT).includes("§ 6 Abs 1 Z 27 UStG"), true);
    strictEqual(steuerfreiHinweis("kleinunternehmer", DE).includes("§ 19 UStG"), true);
    strictEqual(steuerfreiHinweis("kleinunternehmer", CH).includes("Art. 10 Abs 2 MWSTG"), true);
  });

  it("lässt bei ausgewiesener Steuer keinen Hinweis stehen", () => {
    strictEqual(steuerfreiHinweis("keiner", AT), "");
  });

  it("beschriftet die Auswahl mit der Steuer des Landes", () => {
    strictEqual(grundText("keiner", AT), "Umsatzsteuer ausweisen");
    strictEqual(grundText("keiner", CH), "Mehrwertsteuer ausweisen");
  });
});

describe("Steuersätze je Land", () => {
  it("rechnet mit dem Schweizer Normalsatz von 8,1 %", () => {
    // 1.000,00 CHF netto · 8,1 % = 81,00
    const s = belegsummen([z(1, 100000, CH.normalsatz)]);
    strictEqual(CH.normalsatz, 8.1);
    strictEqual(s.netto, 100000);
    strictEqual(s.ust, 8100);
    strictEqual(s.brutto, 108100);
  });

  it("rechnet mit dem deutschen Regelsatz von 19 %", () => {
    const s = belegsummen([z(1, 100000, DE.normalsatz)]);
    strictEqual(DE.normalsatz, 19);
    strictEqual(s.ust, 19000);
  });

  it("rundet auch bei krummen Sätzen kaufmännisch", () => {
    // 123,45 CHF · 8,1 % = 9,99945 → 10,00
    const s = belegsummen([z(1, 12345, 8.1)]);
    strictEqual(s.ust, 1000);
  });
});
