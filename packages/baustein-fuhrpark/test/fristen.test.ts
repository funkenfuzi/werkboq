import { strictEqual } from "node:assert";
import { describe, it } from "node:test";
import {
  faelligkeitstext,
  fristzustand,
  naechsteFaelligkeit,
  naechsterKm,
  nachDringlichkeit,
  ueberFahrzeuge,
  schlimmster,
  tageBis,
} from "../src/daten/fristen";

/**
 * Was hier schiefgeht, merkt niemand — bis die Polizei das Pickerl sehen
 * will. Eine Erinnerung, die einen Tag zu spät kommt, ist keine.
 */

describe("naechsteFaelligkeit", () => {
  it("zählt Monate dazu", () => {
    strictEqual(naechsteFaelligkeit("2026-03-15", 12), "2027-03-15");
    strictEqual(naechsteFaelligkeit("2026-03-15", 6), "2026-09-15");
  });

  it("läuft über den Jahreswechsel", () => {
    strictEqual(naechsteFaelligkeit("2026-11-20", 6), "2027-05-20");
    strictEqual(naechsteFaelligkeit("2026-12-31", 1), "2027-01-31");
  });

  it("kappt am Monatsende, statt in den Folgemonat zu rutschen", () => {
    // Der 31. Jänner plus einen Monat ist der 28. Februar. Wer hier naiv
    // rechnet, bekommt den 3. März — und die Erinnerung kommt zu spät.
    strictEqual(naechsteFaelligkeit("2026-01-31", 1), "2026-02-28");
    strictEqual(naechsteFaelligkeit("2026-03-31", 1), "2026-04-30");
  });

  it("kennt das Schaltjahr", () => {
    strictEqual(naechsteFaelligkeit("2028-01-31", 1), "2028-02-29");
    strictEqual(naechsteFaelligkeit("2028-02-29", 12), "2029-02-28");
  });

  it("gibt nichts zurück, wo es nichts zu wiederholen gibt", () => {
    strictEqual(naechsteFaelligkeit("2026-03-15", 0), "");
    strictEqual(naechsteFaelligkeit("", 12), "");
  });

  it("rechnet vom Fälligkeitsdatum, nicht vom Tag der Erledigung", () => {
    // Zwei Wochen früher zum Service heißt nicht, dass das Intervall
    // zwei Wochen nach vorne wandert. Sonst verliert der Betrieb über
    // Jahre Zeit, die ihm zusteht.
    strictEqual(naechsteFaelligkeit("2026-06-30", 12), "2027-06-30");
  });
});

describe("fristzustand nach Datum", () => {
  const stichtag = "2026-06-01";

  it("ist offen, wenn noch Luft ist", () => {
    strictEqual(fristzustand({ faellig: "2026-12-01", erinnerungTage: 30 }, stichtag), "offen");
  });

  it("wird fällig, sobald die Vorwarnzeit beginnt", () => {
    strictEqual(fristzustand({ faellig: "2026-06-25", erinnerungTage: 30 }, stichtag), "faellig");
  });

  it("ist am letzten Tag noch nicht überfällig", () => {
    strictEqual(fristzustand({ faellig: "2026-06-01", erinnerungTage: 30 }, stichtag), "faellig");
  });

  it("ist am Tag danach überfällig", () => {
    strictEqual(fristzustand({ faellig: "2026-05-31", erinnerungTage: 30 }, stichtag), "abgelaufen");
  });

  it("ohne Vorwarnzeit gibt es kein Vorher", () => {
    strictEqual(fristzustand({ faellig: "2026-06-02", erinnerungTage: 0 }, stichtag), "offen");
  });

  it("erledigt ist erledigt", () => {
    strictEqual(
      fristzustand({ faellig: "2020-01-01", erinnerungTage: 30, erledigtAm: "2020-01-01" }, stichtag),
      "ohne",
    );
  });

  it("ohne Datum und ohne Kilometer gibt es nichts zu überwachen", () => {
    strictEqual(fristzustand({}, stichtag), "ohne");
  });
});

describe("fristzustand nach Kilometern", () => {
  const stichtag = "2026-06-01";

  it("ist offen, solange genug Kilometer fehlen", () => {
    strictEqual(fristzustand({ kmFaellig: 120000 }, stichtag, 90000), "offen");
  });

  it("klopft tausend Kilometer vorher an", () => {
    strictEqual(fristzustand({ kmFaellig: 120000 }, stichtag, 119500), "faellig");
  });

  it("ist überfällig, sobald der Stand erreicht ist", () => {
    strictEqual(fristzustand({ kmFaellig: 120000 }, stichtag, 120000), "abgelaufen");
  });

  it("ohne bekannten Kilometerstand zählt nur das Datum", () => {
    strictEqual(fristzustand({ kmFaellig: 120000 }, stichtag), "ohne");
  });
});

describe("Datum und Kilometer zusammen", () => {
  const stichtag = "2026-06-01";

  it("der schlimmere Zustand gewinnt", () => {
    // Beim Datum wäre noch Luft, bei den Kilometern nicht. Ein Service,
    // der nach Kilometern überfällig ist, ist überfällig.
    strictEqual(
      fristzustand({ faellig: "2026-12-01", erinnerungTage: 30, kmFaellig: 120000 }, stichtag, 125000),
      "abgelaufen",
    );
  });

  it("und umgekehrt genauso", () => {
    strictEqual(
      fristzustand({ faellig: "2026-05-01", erinnerungTage: 30, kmFaellig: 200000 }, stichtag, 90000),
      "abgelaufen",
    );
  });
});

describe("naechsterKm", () => {
  it("schreibt das Kilometerintervall fort", () => {
    strictEqual(naechsterKm(120000, 30000), 150000);
  });

  it("gibt null zurück, wo es kein Intervall gibt", () => {
    strictEqual(naechsterKm(120000, 0), 0);
    strictEqual(naechsterKm(undefined, 30000), 0);
  });
});

describe("Reihenfolge und Ampel", () => {
  const stichtag = "2026-06-01";
  const liste = [
    { faellig: "2026-12-01", erinnerungTage: 30 }, // offen
    { faellig: "2026-05-01", erinnerungTage: 30 }, // abgelaufen
    { faellig: "2026-06-10", erinnerungTage: 30 }, // fällig
    { faellig: "2026-04-01", erinnerungTage: 30 }, // länger abgelaufen
  ];

  it("stellt das Brennende nach oben", () => {
    const sortiert = nachDringlichkeit(liste, stichtag);
    strictEqual(sortiert[0]!.frist.faellig, "2026-04-01");
    strictEqual(sortiert[1]!.frist.faellig, "2026-05-01");
    strictEqual(sortiert[2]!.frist.faellig, "2026-06-10");
    strictEqual(sortiert[3]!.frist.faellig, "2026-12-01");
  });

  it("die Ampel zeigt den schlimmsten Zustand", () => {
    strictEqual(schlimmster(liste, stichtag), "abgelaufen");
    strictEqual(schlimmster([liste[0]!, liste[2]!], stichtag), "faellig");
    strictEqual(schlimmster([liste[0]!], stichtag), "offen");
    strictEqual(schlimmster([], stichtag), "ohne");
  });
});

describe("tageBis", () => {
  it("zählt vorwärts und rückwärts", () => {
    strictEqual(tageBis("2026-06-01", "2026-06-11"), 10);
    strictEqual(tageBis("2026-06-11", "2026-06-01"), -10);
    strictEqual(tageBis("2026-06-01", "2026-06-01"), 0);
  });

  it("stolpert nicht über die Sommerzeit", () => {
    // In Mitteleuropa wird Ende März umgestellt; wer mit Millisekunden
    // rechnet und nicht rundet, bekommt hier 29,958 Tage.
    strictEqual(tageBis("2026-03-15", "2026-04-14"), 30);
  });
});

describe("faelligkeitstext", () => {
  const stichtag = "2026-06-01";

  it("nennt die Tage, wenn es am Datum hängt", () => {
    strictEqual(faelligkeitstext({ faellig: "2026-06-11" }, "offen", stichtag), "in 10 Tagen");
    strictEqual(
      faelligkeitstext({ faellig: "2026-05-22" }, "abgelaufen", stichtag),
      "10 Tage überfällig",
    );
  });

  it("nennt die Kilometer, wenn es daran hängt", () => {
    // DER FALL, DER DIE ZEILE SONST ZUM WIDERSPRUCH MACHT: nach Datum ist
    // noch ein halbes Jahr Zeit, nach Kilometern ist es längst vorbei.
    // Stünde hier "in 190 Tagen" neben "überfällig", glaubt niemand mehr
    // der Ampel.
    // Das Tausendertrennzeichen kommt aus der Laufzeitumgebung — de-AT
    // setzt je nach ICU-Fassung einen Punkt oder ein schmales Leerzeichen.
    // Geprüft wird, welcher Zweig gewählt wird, nicht wie eine Zahl
    // formatiert aussieht; sonst schlägt der Test irgendwann fehl, ohne
    // dass sich am Verhalten etwas geändert hätte.
    strictEqual(
      faelligkeitstext(
        { faellig: "2026-12-08", kmFaellig: 120000 },
        "abgelaufen",
        stichtag,
        121000,
      ),
      `${(1000).toLocaleString("de-AT")} km über ${(120000).toLocaleString("de-AT")}`,
    );
  });

  it("zählt herunter, wenn die Kilometergrenze naht", () => {
    strictEqual(
      faelligkeitstext({ faellig: "2026-12-08", kmFaellig: 120000 }, "faellig", stichtag, 119400),
      "noch 600 km",
    );
  });

  it("kommt ohne beides aus", () => {
    strictEqual(faelligkeitstext({}, "ohne", stichtag), "—");
  });
});

describe("ueberFahrzeuge", () => {
  const stichtag = "2026-06-01";
  const kmJeFahrzeug = new Map<string, number | undefined>([
    ["bus", 121000],
    ["anhaenger", undefined],
  ]);

  const fristen = [
    // Nach Datum noch lange hin, nach Kilometern überfällig.
    { fahrzeug: "bus", faellig: "2026-12-08", kmFaellig: 120000, erinnerungTage: 14 },
    // Nach Datum in der Vorwarnzeit.
    { fahrzeug: "anhaenger", faellig: "2026-06-10", erinnerungTage: 30 },
  ];

  it("sortiert nach Zustand, nicht nach Datum", () => {
    // Genau hier lag der Fehler: nach Tagen sortiert stünde der Anhänger
    // (in 9 Tagen) über dem Bus (in 190 Tagen) — obwohl der Bus
    // überfällig ist. Der Kasten "Was ansteht" hätte das Dringendste
    // unten gezeigt.
    const sortiert = ueberFahrzeuge(fristen, kmJeFahrzeug, stichtag);
    strictEqual(sortiert[0]!.frist.fahrzeug, "bus");
    strictEqual(sortiert[0]!.zustand, "abgelaufen");
    strictEqual(sortiert[1]!.frist.fahrzeug, "anhaenger");
    strictEqual(sortiert[1]!.zustand, "faellig");
  });

  it("nimmt je Frist den Kilometerstand ihres eigenen Fahrzeugs", () => {
    // Mit einem gemeinsamen Kilometerstand für alle wäre der Anhänger
    // plötzlich auch überfällig.
    const sortiert = ueberFahrzeuge(fristen, kmJeFahrzeug, stichtag);
    strictEqual(sortiert.filter((e) => e.zustand === "abgelaufen").length, 1);
  });

  it("verträgt ein Fahrzeug ohne bekannten Kilometerstand", () => {
    const sortiert = ueberFahrzeuge(
      [{ fahrzeug: "anhaenger", kmFaellig: 5000 }],
      kmJeFahrzeug,
      stichtag,
    );
    strictEqual(sortiert[0]!.zustand, "ohne");
  });
});
