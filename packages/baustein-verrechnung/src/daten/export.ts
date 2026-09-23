import { pb, runden } from "@werkboq/core";
import { BELEGART_TEXT, type Beleg, type SteuerfreiGrund } from "./belege";
import { ZAHLUNGSART_TEXT, type Zahlung } from "./zahlungen";

/**
 * Export für den Steuerberater.
 *
 * WAS WERKBOQ LIEFERT UND WAS NICHT. Gebucht wird beim Steuerberater —
 * Werkboq ist keine Buchhaltung (siehe docs/produkt.md). Es liefert, was
 * er zum Buchen braucht, in drei Dateien:
 *
 *   1. RECHNUNGSAUSGANGSBUCH — eine Zeile je Beleg und Steuersatz, lesbar
 *      in jeder Tabellenkalkulation und in jedem Buchhaltungsprogramm über
 *      eine eigene Importvorlage. Das ist die Datei, die immer geht.
 *   2. ZAHLUNGSEINGÄNGE — was an welchem Tag auf welche Rechnung einging.
 *   3. BMD-BUCHUNGSIMPORT — dieselben Belege als Buchungszeilen im
 *      Feldaufbau, den BMD für den Buchungsimport dokumentiert (Feldnamen
 *      konto, gkto, belegnr, belegdat, symbol, bucod, mwst, steucod,
 *      betrag, steuer, text). Braucht die Konten des Betriebs.
 *
 * Ehrlich dazu: die BMD-Datei folgt der öffentlichen Beschreibung, ist
 * aber nicht gegen eine echte BMD-Installation geprüft. Importdefinitionen
 * sind bei BMD je Kanzlei einstellbar. Vor dem ersten echten Einsatz eine
 * Testdatei mit dem Steuerberater abstimmen — das steht auch so auf der
 * Seite. RZL und DATEV haben eigene, deutlich längere Formate und kommen
 * später; bis dahin nimmt jede Kanzlei das Rechnungsausgangsbuch.
 *
 * Alles hier ist reine Rechnung ohne Datenbank und steht unter Test.
 */

/** Welche Belege Umsatz sind: Rechnungen und Gutschriften, festgeschrieben. */
export function umsatzbelege(belege: Beleg[], von: string, bis: string): Beleg[] {
  return belege
    .filter((b) => (b.belegart === "rechnung" || b.belegart === "gutschrift") && Boolean(b.festgeschrieben))
    .filter((b) => {
      const d = b.datum.slice(0, 10);
      return d >= von && d <= bis;
    })
    .sort((a, b) => a.datum.localeCompare(b.datum) || a.nummer.localeCompare(b.nummer));
}

export interface Journalzeile {
  datum: string;
  nummer: string;
  art: string;
  kunde: string;
  uid: string;
  steuersatz: number;
  netto: number;
  steuer: number;
  brutto: number;
  steuerfrei: SteuerfreiGrund;
  bezug: string;
}

/**
 * Eine Zeile je Beleg und Steuersatz.
 *
 * Die Steuer je Satz wird aus dem Netto je Satz gerechnet — genau wie
 * belegsummen() es für den Beleg tut. Die Summe der Zeilen ergibt damit
 * die Steuer auf dem Beleg, auf den Cent. `nummerVon` (Kennung →
 * Nummer) löst bei Gutschriften die Nummer der stornierten Rechnung auf.
 * Gutschriften haben negative
 * Mengen und damit negative Beträge; so bucht sie jede Buchhaltung.
 */
export function journal(belege: Beleg[], nummerVon: Map<string, string> = new Map()): Journalzeile[] {
  const zeilen: Journalzeile[] = [];
  for (const b of belege) {
    const jeSatz = b.nettoJeSatz && Object.keys(b.nettoJeSatz).length ? b.nettoJeSatz : { "0": b.netto };
    for (const [satzText, netto] of Object.entries(jeSatz)) {
      const satz = b.steuerfrei === "keiner" ? Number(satzText) : 0;
      const steuer = runden((netto * satz) / 100);
      zeilen.push({
        datum: b.datum.slice(0, 10),
        nummer: b.nummer,
        art: BELEGART_TEXT[b.belegart],
        kunde: b.empfaengerName,
        uid: b.empfaengerUid ?? "",
        steuersatz: satz,
        netto,
        steuer,
        brutto: netto + steuer,
        steuerfrei: b.steuerfrei,
        bezug: b.storniert ? (nummerVon.get(b.storniert) ?? "") : "",
      });
    }
  }
  return zeilen;
}

// ------------------------------------------------------------------------
// CSV
// ------------------------------------------------------------------------

/** 1234567 Cent → "12345,67" — so liest Excel in Österreich und Deutschland eine Zahl. */
export function betragCsv(cent: number): string {
  const negativ = cent < 0;
  const b = Math.abs(Math.round(cent));
  return `${negativ ? "-" : ""}${Math.floor(b / 100)},${String(b % 100).padStart(2, "0")}`;
}

/** 2026-09-23 → 23.09.2026 */
export function datumCsv(tag: string): string {
  const [j, m, t] = tag.slice(0, 10).split("-");
  return `${t}.${m}.${j}`;
}

/**
 * Ein Feld für eine Semikolon-Datei. In Anführungszeichen, sobald es
 * Trenner, Anführungszeichen oder Zeilenumbrüche enthält — sonst zerfällt
 * „Müller; Söhne GmbH" in zwei Spalten.
 */
export function feld(wert: string | number): string {
  const s = String(wert);
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csv(kopf: string[], zeilen: (string | number)[][]): string {
  return [kopf, ...zeilen].map((z) => z.map(feld).join(";")).join("\r\n") + "\r\n";
}

const STEUERFREI_TEXT: Record<SteuerfreiGrund, string> = {
  keiner: "",
  bauleistung: "Übergang der Steuerschuld (Bauleistung)",
  kleinunternehmer: "Kleinunternehmer",
  innergemeinschaftlich: "innergemeinschaftliche Lieferung",
  ausfuhr: "Ausfuhr",
};

export function journalCsv(zeilen: Journalzeile[]): string {
  return csv(
    ["Belegdatum", "Belegnummer", "Belegart", "Kunde", "UID Kunde", "Steuersatz %", "Netto", "Steuer", "Brutto", "Steuerbefreiung", "Storno zu"],
    zeilen.map((z) => [
      datumCsv(z.datum),
      z.nummer,
      z.art,
      z.kunde,
      z.uid,
      z.steuersatz,
      betragCsv(z.netto),
      betragCsv(z.steuer),
      betragCsv(z.brutto),
      STEUERFREI_TEXT[z.steuerfrei],
      z.bezug,
    ]),
  );
}

export function zahlungenCsv(
  zahlungen: Zahlung[],
  belege: Map<string, Pick<Beleg, "nummer" | "empfaengerName">>,
  von: string,
  bis: string,
): string {
  const liste = zahlungen
    .filter((z) => z.datum.slice(0, 10) >= von && z.datum.slice(0, 10) <= bis)
    .sort((a, b) => a.datum.localeCompare(b.datum));
  return csv(
    ["Zahlungsdatum", "Belegnummer", "Kunde", "Betrag", "Zahlungsart", "Notiz"],
    liste.map((z) => [
      datumCsv(z.datum),
      belege.get(z.beleg)?.nummer ?? "",
      belege.get(z.beleg)?.empfaengerName ?? "",
      betragCsv(z.betrag),
      ZAHLUNGSART_TEXT[z.art],
      z.notiz ?? "",
    ]),
  );
}

// ------------------------------------------------------------------------
// BMD
// ------------------------------------------------------------------------

/**
 * Konten für den BMD-Export — vom Steuerberater, nicht erraten.
 *
 * `debitor` ist das Sammelkonto oder Kundenkonto, auf das die Kanzlei
 * Ausgangsrechnungen bucht. `erloese` je Steuersatz ("20", "10", "13"),
 * dazu eigene Konten für die Steuerbefreiungen, weil die in der
 * Umsatzsteuervoranmeldung an verschiedenen Stellen stehen.
 */
export interface Exportkonten {
  debitor?: string;
  erloese?: Record<string, string>;
  bauleistung?: string;
  steuerfrei?: string;
}

/** Was für den BMD-Export fehlt — leer heißt: kann los. */
export function fehlendeKonten(k: Exportkonten | null | undefined, zeilen: Journalzeile[]): string[] {
  const fehlt: string[] = [];
  if (!k?.debitor?.trim()) fehlt.push("Debitorenkonto");
  const saetze = new Set(zeilen.filter((z) => z.steuerfrei === "keiner").map((z) => String(z.steuersatz)));
  for (const s of [...saetze].sort()) if (!k?.erloese?.[s]?.trim()) fehlt.push(`Erlöskonto ${s} %`);
  if (zeilen.some((z) => z.steuerfrei === "bauleistung") && !k?.bauleistung?.trim()) fehlt.push("Erlöskonto Bauleistung");
  if (zeilen.some((z) => z.steuerfrei !== "keiner" && z.steuerfrei !== "bauleistung") && !k?.steuerfrei?.trim()) {
    fehlt.push("Erlöskonto steuerfrei");
  }
  return fehlt;
}

/**
 * Steuercode nach BMD: 3 = Umsatzsteuer, 17 = steuerfreie Bauleistung
 * nach § 19 Abs 1a UStG, 0 = keine Steuer.
 */
export function bmdSteuercode(z: Journalzeile): number {
  if (z.steuerfrei === "bauleistung") return 17;
  if (z.steuerfrei !== "keiner" || z.steuersatz === 0) return 0;
  return 3;
}

/**
 * Buchungszeilen im BMD-Importaufbau.
 *
 * Nach der BMD-Beschreibung: `konto` ist das Erlöskonto, `gkto` das
 * Kundenkonto, `betrag` der Nettobetrag, `steuer` die Steuer — bei
 * normalen Erlösen beide negativ (Haben), bei Gutschriften positiv. Der
 * Buchungscode `bucod` (1 Soll, 2 Haben) ist laut BMD kosmetisch; das
 * Vorzeichen entscheidet. Datum als JJJJMMTT, Beträge mit Komma.
 */
export function bmdCsv(zeilen: Journalzeile[], k: Exportkonten): string {
  const kopf = ["satzart", "konto", "gkto", "belegnr", "belegdat", "buchdat", "symbol", "bucod", "mwst", "steucod", "betrag", "steuer", "text"];
  return csv(
    kopf,
    zeilen.map((z) => {
      const konto =
        z.steuerfrei === "bauleistung"
          ? (k.bauleistung ?? "")
          : z.steuerfrei !== "keiner"
            ? (k.steuerfrei ?? "")
            : (k.erloese?.[String(z.steuersatz)] ?? "");
      const datum = z.datum.replace(/-/g, "");
      const gutschrift = z.netto < 0;
      return [
        0,
        konto,
        k.debitor ?? "",
        z.nummer,
        datum,
        datum,
        "AR",
        gutschrift ? 1 : 2,
        z.steuersatz,
        bmdSteuercode(z),
        // Erlös steht im Haben: Rechnung negativ, Gutschrift positiv.
        betragCsv(-z.netto),
        betragCsv(-z.steuer),
        `${z.kunde} ${z.nummer}`.slice(0, 60),
      ];
    }),
  );
}

/**
 * Text als Windows-1252 — so erwarten ältere Buchhaltungsprogramme
 * Umlaute. Was es dort nicht gibt, wird zu „?". Für das
 * Rechnungsausgangsbuch nimmt die Seite UTF-8 mit BOM, das Excel sicher
 * erkennt; für BMD dieses hier.
 */
const CP1252: Record<string, number> = {
  "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85, "†": 0x86, "‡": 0x87, "ˆ": 0x88, "‰": 0x89,
  "Š": 0x8a, "‹": 0x8b, "Œ": 0x8c, "Ž": 0x8e, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95,
  "–": 0x96, "—": 0x97, "˜": 0x98, "™": 0x99, "š": 0x9a, "›": 0x9b, "œ": 0x9c, "ž": 0x9e, "Ÿ": 0x9f,
};

export function alsWindows1252(text: string): Uint8Array<ArrayBuffer> {
  const heraus = new Uint8Array(text.length);
  let i = 0;
  for (const zeichen of text) {
    const c = zeichen.codePointAt(0)!;
    if (c < 0x80 || (c >= 0xa0 && c <= 0xff)) heraus[i++] = c;
    else heraus[i++] = CP1252[zeichen] ?? 0x3f;
  }
  return heraus.slice(0, i);
}

// ------------------------------------------------------------------------
// Datenbank
// ------------------------------------------------------------------------

/** Alles, was ein Export für einen Zeitraum braucht, in einem Zug. */
export async function exportdatenLaden(
  von: string,
  bis: string,
): Promise<{ belege: Beleg[]; alleBelege: Map<string, Beleg>; zahlungen: Zahlung[] }> {
  // Belege etwas großzügiger holen: eine Gutschrift im Zeitraum kann auf
  // eine Rechnung davor zeigen, deren Nummer in die Spalte „Storno zu" soll.
  const alle = await pb()
    .collection("belege")
    .getFullList<Beleg>({ filter: 'belegart = "rechnung" || belegart = "gutschrift"', sort: "datum" });
  const zahlungen = await pb()
    .collection("zahlungen")
    .getFullList<Zahlung>({ filter: `datum >= "${von} 00:00:00" && datum <= "${bis} 23:59:59"`, sort: "datum" });
  return {
    belege: umsatzbelege(alle, von, bis),
    alleBelege: new Map(alle.map((b) => [b.id, b])),
    zahlungen,
  };
}

/** Die Konten aus den Betriebsstammdaten, geprüft statt blind übernommen. */
export function exportkontenAus(roh: unknown): Exportkonten {
  if (!roh || typeof roh !== "object") return {};
  const o = roh as Record<string, unknown>;
  const text = (x: unknown) => (typeof x === "string" ? x.trim() : typeof x === "number" ? String(x) : "");
  const erloese: Record<string, string> = {};
  if (o.erloese && typeof o.erloese === "object") {
    for (const [satz, konto] of Object.entries(o.erloese as Record<string, unknown>)) {
      if (text(konto)) erloese[satz] = text(konto);
    }
  }
  return { debitor: text(o.debitor), erloese, bauleistung: text(o.bauleistung), steuerfrei: text(o.steuerfrei) };
}
