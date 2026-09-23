import { deepStrictEqual, strictEqual } from "node:assert";
import { afterEach, describe, it } from "node:test";
import { AUFTRAGSARTEN, artVon } from "../src/daten/typen";
import {
  ALTE_PHASEN,
  brettspalten,
  vorruecken,
  fortschritt,
  naechstePhase,
  PFLICHTSTUFEN,
  PHASEN_VORGABE,
  phasenDerArt,
  phasenEinstellen,
  phasenFuer,
  phasenText,
  PHASENSTUFEN,
  umschluesseln,
} from "../src/daten/phasen";

/**
 * Phasen: ein festes Gerüst, darüber Namen je Auftragsart, die der Betrieb
 * ändern darf.
 *
 * Was hier schiefgeht, sieht man nicht sofort: ein Auftrag, dessen Phase
 * in der Leiste fehlt, eine umbenannte Phase, die die Rechnungswarnung
 * verliert, ein alter Auftrag, der beim Update in „Eingang" zurückfällt.
 */

afterEach(() => phasenEinstellen(null));

describe("artVon", () => {
  it("nimmt die gesetzte Art", () => {
    strictEqual(artVon({ art: "stoerung" }), "stoerung");
  });

  it("hält alte Aufträge ohne Art für Projekte", () => {
    strictEqual(artVon({}), "projekt");
  });

  it("fällt bei Unbekanntem auf Projekt zurück, statt zu werfen", () => {
    strictEqual(artVon({ art: "unfug" as never }), "projekt");
  });
});

describe("Voreinstellung je Art", () => {
  const stufen = (art: (typeof AUFTRAGSARTEN)[number]) => PHASEN_VORGABE[art].map((p) => p.stufe);

  it("gibt der Störung vier Phasen und nennt den Anfang „Gemeldet“", () => {
    deepStrictEqual(stufen("stoerung"), ["eingang", "in_arbeit", "verrechnen", "abgeschlossen"]);
    strictEqual(phasenText("eingang", "stoerung"), "Gemeldet");
  });

  it("gibt dem Projekt alle sieben Stufen", () => {
    deepStrictEqual(stufen("projekt"), [...PHASENSTUFEN]);
  });

  it("nennt die fertige Wartung „Durchgeführt“ und die fertige Lieferung „Geliefert“", () => {
    strictEqual(phasenText("fertig", "wartung"), "Durchgeführt");
    strictEqual(phasenText("fertig", "materialverkauf"), "Geliefert");
    strictEqual(phasenText("fertig", "projekt"), "Abnahme");
  });

  it("hat in jeder Art die Pflichtstufen", () => {
    for (const art of AUFTRAGSARTEN) {
      for (const pflicht of PFLICHTSTUFEN) {
        strictEqual(stufen(art).includes(pflicht), true, `${art} ohne ${pflicht}`);
      }
    }
  });

  it("hält in jeder Art die Reihenfolge des Gerüsts", () => {
    for (const art of AUFTRAGSARTEN) {
      const idx = stufen(art).map((s) => PHASENSTUFEN.indexOf(s));
      deepStrictEqual(idx, [...idx].sort((a, b) => a - b), art);
    }
  });

  it("nennt „Verrechnen“ überall gleich", () => {
    // Der Teil, an dem Geld hängt, soll überall dasselbe Wort tragen.
    for (const art of AUFTRAGSARTEN) strictEqual(phasenText("verrechnen", art), "Verrechnen");
  });
});

describe("Einstellung des Betriebs", () => {
  it("übernimmt umbenannte Phasen", () => {
    phasenEinstellen({
      stoerung: [
        { stufe: "eingang", text: "Anruf" },
        { stufe: "in_arbeit", text: "Vor Ort" },
        { stufe: "verrechnen", text: "Verrechnen" },
        { stufe: "abgeschlossen", text: "Erledigt" },
      ],
    });
    strictEqual(phasenText("eingang", "stoerung"), "Anruf");
    strictEqual(phasenText("abgeschlossen", "stoerung"), "Erledigt");
    // Andere Arten bleiben bei der Voreinstellung.
    strictEqual(phasenText("eingang", "projekt"), "Anfrage");
  });

  it("lässt eine Phasenstufe ausblenden", () => {
    phasenEinstellen({
      projekt: [
        { stufe: "eingang", text: "Anfrage" },
        { stufe: "in_arbeit", text: "In Arbeit" },
        { stufe: "verrechnen", text: "Verrechnen" },
        { stufe: "abgeschlossen", text: "Abgeschlossen" },
      ],
    });
    deepStrictEqual(
      phasenDerArt("projekt").map((p) => p.stufe),
      ["eingang", "in_arbeit", "verrechnen", "abgeschlossen"],
    );
  });

  it("ergänzt Pflichtstufen, die jemand weggelassen hat", () => {
    // Sonst gäbe es keinen Ort, an dem ein fertiger, aber nicht
    // verrechneter Auftrag auffällt.
    phasenEinstellen({ regie: [{ stufe: "in_arbeit", text: "Läuft" }] });
    deepStrictEqual(
      phasenDerArt("regie").map((p) => p.stufe),
      ["in_arbeit", "verrechnen", "abgeschlossen"],
    );
    strictEqual(phasenText("verrechnen", "regie"), "Verrechnen");
  });

  it("verwirft erfundene und doppelte Stufen", () => {
    phasenEinstellen({
      projekt: [
        { stufe: "eingang", text: "Anfrage" },
        { stufe: "kaffeepause", text: "Kaffee" },
        { stufe: "eingang", text: "Nochmal" },
        { stufe: "verrechnen", text: "Verrechnen" },
        { stufe: "abgeschlossen", text: "Abgeschlossen" },
      ],
    });
    deepStrictEqual(
      phasenDerArt("projekt").map((p) => `${p.stufe}:${p.text}`),
      ["eingang:Anfrage", "verrechnen:Verrechnen", "abgeschlossen:Abgeschlossen"],
    );
  });

  it("stellt die Reihenfolge des Gerüsts wieder her", () => {
    phasenEinstellen({
      wartung: [
        { stufe: "abgeschlossen", text: "Ende" },
        { stufe: "beauftragt", text: "Geplant" },
        { stufe: "verrechnen", text: "Verrechnen" },
      ],
    });
    deepStrictEqual(
      phasenDerArt("wartung").map((p) => p.stufe),
      ["beauftragt", "verrechnen", "abgeschlossen"],
    );
  });

  it("füllt leere Namen aus der Voreinstellung", () => {
    phasenEinstellen({ stoerung: [{ stufe: "eingang", text: "   " }] });
    strictEqual(phasenText("eingang", "stoerung"), "Gemeldet");
  });

  it("verträgt Unsinn ohne zu werfen", () => {
    for (const roh of [null, undefined, "text", 42, [], { projekt: "keine Liste" }, { projekt: [] }]) {
      phasenEinstellen(roh);
      strictEqual(phasenDerArt("projekt").length, 7);
    }
  });
});

describe("phasenFuer", () => {
  it("liefert die Phasen der Art", () => {
    deepStrictEqual(
      phasenFuer({ art: "stoerung", phase: "in_arbeit" }).map((p) => p.stufe),
      ["eingang", "in_arbeit", "verrechnen", "abgeschlossen"],
    );
  });

  it("behält eine fremde Phase an ihrer Stelle im Gerüst", () => {
    // Ein Projekt im Angebot, umgestellt auf Störung: „Angebot" kennt die
    // Störung nicht, der Auftrag steht aber dort. Die Leiste muss ihn
    // zeigen — und zwar zwischen Eingang und In Arbeit, nicht am Ende.
    deepStrictEqual(
      phasenFuer({ art: "stoerung", phase: "angebot" }).map((p) => p.stufe),
      ["eingang", "angebot", "in_arbeit", "verrechnen", "abgeschlossen"],
    );
  });

  it("zeigt eine vom Betrieb ausgeblendete Phasenstufe, solange ein Auftrag darin steht", () => {
    phasenEinstellen({
      projekt: [
        { stufe: "eingang", text: "Anfrage" },
        { stufe: "verrechnen", text: "Verrechnen" },
        { stufe: "abgeschlossen", text: "Abgeschlossen" },
      ],
    });
    strictEqual(
      phasenFuer({ art: "projekt", phase: "in_arbeit" }).some((p) => p.stufe === "in_arbeit"),
      true,
    );
  });

  it("zeigt einem alten Auftrag ohne Art die volle Projektleiste", () => {
    strictEqual(phasenFuer({ phase: "eingang" }).length, 7);
  });
});

describe("Fortschritt und nächste Phase", () => {
  it("zählt die Stelle in der eigenen Leiste", () => {
    deepStrictEqual(fortschritt({ art: "stoerung", phase: "in_arbeit" }), { index: 1, von: 4 });
  });

  it("nennt die nächste Phase mit dem Namen der Art", () => {
    strictEqual(naechstePhase({ art: "wartung", phase: "beauftragt" })?.text, "Durchgeführt");
  });

  it("überspringt, was die Art nicht kennt", () => {
    // Nach „Gemeldet" kommt bei der Störung „In Arbeit", nicht „Angebot".
    strictEqual(naechstePhase({ art: "stoerung", phase: "eingang" })?.stufe, "in_arbeit");
  });

  it("hat am Ende keine nächste", () => {
    strictEqual(naechstePhase({ art: "projekt", phase: "abgeschlossen" }), null);
  });
});

describe("Spalten des Phasenbretts", () => {
  const stufen = (l: { stufe: string }[]) => l.map((p) => p.stufe);
  const texte = (l: { text: string }[]) => l.map((p) => p.text);

  it("zeigt bei einer Art deren Phasen mit deren Namen", () => {
    deepStrictEqual(texte(brettspalten([], "stoerung")), [
      "Gemeldet",
      "In Arbeit",
      "Verrechnen",
      "Abgeschlossen",
    ]);
  });

  it("zeigt ohne Art das Gerüst mit neutralen Namen", () => {
    deepStrictEqual(stufen(brettspalten([], null)), [...PHASENSTUFEN]);
    strictEqual(brettspalten([], null)[0]!.text, "Eingang");
  });

  it("nimmt eine ausgeblendete Stufe dazu, solange ein Auftrag darin liegt", () => {
    // Gegenprobe zuerst: ohne Auftrag darin bleibt sie weg.
    phasenEinstellen({ projekt: [{ stufe: "in_arbeit", text: "Montage" }] });
    strictEqual(stufen(brettspalten([], "projekt")).includes("angebot"), false);
    deepStrictEqual(stufen(brettspalten(["angebot"], "projekt")), [
      "angebot",
      "in_arbeit",
      "verrechnen",
      "abgeschlossen",
    ]);
  });

  it("lässt ohne Art Stufen weg, die keine Art benutzt und die leer sind", () => {
    const nurKurz = Object.fromEntries(
      AUFTRAGSARTEN.map((a) => [a, [{ stufe: "in_arbeit", text: "Dran" }]]),
    );
    phasenEinstellen(nurKurz);
    deepStrictEqual(stufen(brettspalten([], null)), ["in_arbeit", "verrechnen", "abgeschlossen"]);
    // Gegenprobe: liegt doch einer im Eingang, ist die Spalte da.
    deepStrictEqual(stufen(brettspalten(["eingang"], null)), [
      "eingang",
      "in_arbeit",
      "verrechnen",
      "abgeschlossen",
    ]);
  });

  it("ordnet alte Phasennamen ihrer Stufe zu", () => {
    phasenEinstellen({ wartung: [{ stufe: "beauftragt", text: "Geplant" }] });
    // "errichtung" hieß früher In Arbeit — die Wartung kennt das nicht, zeigt es aber.
    strictEqual(stufen(brettspalten(["errichtung"], "wartung")).includes("in_arbeit"), true);
  });
});

describe("vorruecken", () => {
  it("rückt ein Projekt von der Anfrage ins Angebot", () => {
    strictEqual(vorruecken({ art: "projekt", phase: "eingang" }, "angebot"), "angebot");
  });

  it("rückt nie zurück", () => {
    strictEqual(vorruecken({ art: "projekt", phase: "in_arbeit" }, "beauftragt"), null);
    strictEqual(vorruecken({ art: "projekt", phase: "beauftragt" }, "beauftragt"), null);
  });

  it("geht nie über das Ziel hinaus, wenn die Art die Stufe nicht kennt", () => {
    // Eine Störung hat weder Angebot noch Beauftragt — sie bleibt „Gemeldet".
    strictEqual(vorruecken({ art: "stoerung", phase: "eingang" }, "beauftragt"), null);
    // Eine Wartung hat kein Angebot, aber „Geplant" (beauftragt) — für eine Annahme passt das.
    strictEqual(vorruecken({ art: "wartung", phase: "eingang" }, "beauftragt"), "beauftragt");
  });

  it("setzt nicht auf In Arbeit, nur weil der Betrieb Angebot ausgeblendet hat", () => {
    phasenEinstellen({ projekt: [{ stufe: "eingang", text: "Anfrage" }, { stufe: "in_arbeit", text: "Montage" }] });
    strictEqual(vorruecken({ art: "projekt", phase: "eingang" }, "angebot"), null);
    strictEqual(vorruecken({ art: "projekt", phase: "eingang" }, "beauftragt"), null);
  });

  it("versteht alte Phasennamen", () => {
    strictEqual(vorruecken({ art: "projekt", phase: "anfrage" }, "angebot"), "angebot");
  });
});

describe("Umschlüsselung der alten Phasen", () => {
  it("bildet jede der zehn alten Phasen auf eine Phasenstufe ab", () => {
    const alt = [
      "anfrage",
      "spezifikation",
      "angebot",
      "termine",
      "projekt",
      "errichtung",
      "abnahme",
      "wartung",
      "materialverkauf",
      "abgeschlossen",
    ];
    for (const p of alt) strictEqual((PHASENSTUFEN as readonly string[]).includes(umschluesseln(p)), true, p);
  });

  it("lässt neue Stufen unverändert", () => {
    for (const s of PHASENSTUFEN) strictEqual(umschluesseln(s), s);
  });

  it("schickt Unbekanntes in den Eingang statt zu werfen", () => {
    strictEqual(umschluesseln("gibtsnicht"), "eingang");
    strictEqual(umschluesseln(undefined), "eingang");
  });

  it("stimmt mit der Umschlüsselung in einrichten.mjs überein", async () => {
    // Die Tabelle steht zweimal: hier für die Oberfläche, dort für das
    // Update der Datenbank. Laufen sie auseinander, zeigt die Oberfläche
    // einen Auftrag in einer anderen Phase, als die Datenbank sagt.
    const { readFileSync } = await import("node:fs");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const wurzel = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
    const quelle = readFileSync(join(wurzel, "server", "einrichten.mjs"), "utf8");
    const block = /const ALTE_PHASEN = \{([\s\S]*?)\};/.exec(quelle)?.[1] ?? "";
    const dort = Object.fromEntries(
      [...block.matchAll(/(\w+):\s*"(\w+)"/g)].map((m) => [m[1], m[2]]),
    );
    deepStrictEqual(dort, ALTE_PHASEN);
  });
});
