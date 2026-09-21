import { strictEqual } from "node:assert";
import { describe, it } from "node:test";
import {
  landesvorwahl,
  mailAdresse,
  waNummer,
  whatsappAdresse,
} from "../src/daten/versand";

/**
 * Telefonnummern stehen in Kundendatensätzen so, wie sie jemand eingetippt
 * hat: mit Schrägstrichen, Leerzeichen, Klammern, führender Null. WhatsApp
 * versteht davon nichts. Wird hier falsch umgeformt, landet die Nachricht
 * bei einem Fremden — deshalb steht jede Schreibweise unter Test, die in
 * einem österreichischen Adressbuch wirklich vorkommt.
 */

describe("waNummer", () => {
  it("ersetzt die führende Null durch die Landesvorwahl", () => {
    strictEqual(waNummer("0664 1234567"), "436641234567");
  });

  it("verträgt Schrägstriche, Leerzeichen und Klammern", () => {
    strictEqual(waNummer("0664 / 123 45 67"), "436641234567");
    strictEqual(waNummer("(0664) 1234567"), "436641234567");
    strictEqual(waNummer("0664-123 45 67"), "436641234567");
  });

  it("nimmt eine Nummer mit Plus, wie sie ist", () => {
    strictEqual(waNummer("+43 664 1234567"), "436641234567");
  });

  it("versteht die Amtsschreibweise mit doppelter Null", () => {
    strictEqual(waNummer("0043 664 1234567"), "436641234567");
  });

  it("lässt eine schon vollständige Nummer ohne Plus unangetastet", () => {
    strictEqual(waNummer("436641234567"), "436641234567");
  });

  it("nimmt für Deutschland und die Schweiz die richtige Vorwahl", () => {
    strictEqual(waNummer("0171 1234567", "49"), "491711234567");
    strictEqual(waNummer("079 123 45 67", "41"), "41791234567");
  });

  it("weist zu kurze Nummern ab, statt Unsinn zu wählen", () => {
    strictEqual(waNummer("12345"), null);
    strictEqual(waNummer(""), null);
    strictEqual(waNummer("—"), null);
  });

  it("baut aus einer Nummer ohne Vorwahl keine falsche Auslandsnummer", () => {
    // Eine Festnetznummer ohne Vorwahl ist nicht eindeutig; sie bekommt die
    // Landesvorwahl und bleibt damit wenigstens nachvollziehbar falsch,
    // statt nach Übersee zu gehen.
    strictEqual(waNummer("2622 12345")?.startsWith("43"), true);
  });
});

describe("whatsappAdresse", () => {
  it("baut eine wa.me-Adresse mit kodiertem Text", () => {
    const a = whatsappAdresse("0664 1234567", "Rechnung RE-2026-0001");
    strictEqual(a?.startsWith("https://wa.me/436641234567?text="), true);
    strictEqual(a?.includes("RE-2026-0001"), true);
  });

  it("kodiert Umlaute und Zeilenumbrüche", () => {
    const a = whatsappAdresse("0664 1234567", "Grüße\nvom Bau") ?? "";
    strictEqual(a.includes("Gr%C3%BC%C3%9Fe"), true);
    strictEqual(a.includes("%0A"), true);
    strictEqual(a.includes("\n"), false);
  });

  it("gibt null zurück, wenn die Nummer nichts taugt", () => {
    strictEqual(whatsappAdresse("keine Nummer", "Text"), null);
  });
});

describe("mailAdresse", () => {
  it("setzt Empfänger, Betreff und Text", () => {
    const a = mailAdresse("kunde@example.at", "Rechnung", "Guten Tag");
    strictEqual(a.startsWith("mailto:kunde%40example.at?"), true);
    strictEqual(a.includes("subject=Rechnung"), true);
    strictEqual(a.includes("body=Guten%20Tag"), true);
  });

  it("kodiert, was die Adresse sonst zerlegen würde", () => {
    // Ein & im Betreff würde ohne Kodierung als nächster Parameter gelesen
    // und der Rest des Betreffs verschwände wortlos.
    const a = mailAdresse("k@example.at", "Angebot & Rechnung", "Zeile 1\nZeile 2");
    strictEqual(a.includes("Angebot%20%26%20Rechnung"), true);
    strictEqual(a.includes("%0A"), true);
  });

  it("verträgt Umlaute im Betreff", () => {
    strictEqual(mailAdresse("k@example.at", "Prüfbefund", "").includes("Pr%C3%BCfbefund"), true);
  });
});

describe("landesvorwahl", () => {
  it("kennt die drei Rechtsräume", () => {
    strictEqual(landesvorwahl("at"), "43");
    strictEqual(landesvorwahl("de"), "49");
    strictEqual(landesvorwahl("ch"), "41");
  });

  it("fällt auf Österreich zurück", () => {
    strictEqual(landesvorwahl(undefined), "43");
    strictEqual(landesvorwahl("xx"), "43");
  });
});
