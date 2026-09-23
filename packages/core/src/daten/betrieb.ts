import { pb } from "./client";
import { schreiben } from "./offline";
import { protokollieren } from "./protokoll";
import type { Basisdatensatz } from "./typen";

/**
 * Stammdaten des eigenen Betriebs — genau ein Datensatz.
 *
 * Die Angaben landen später auf Angebot und Rechnung. UID und
 * Firmenbuchnummer sind dort nach § 11 UStG Pflicht, deshalb stehen sie hier
 * und nicht verstreut in einer Konfigurationsdatei.
 */

export interface Betrieb extends Basisdatensatz {
  name: string;
  inhaber?: string;
  strasse?: string;
  plz?: string;
  ort?: string;
  land?: string;
  telefon?: string;
  email?: string;
  web?: string;
  uid?: string;
  firmenbuch?: string;
  gericht?: string;
  iban?: string;
  bic?: string;
  bank?: string;
  logo?: string;
  /**
   * Verrechnungssatz für eine Arbeitsstunde, netto in Cent.
   * Steht bei den Betriebsstammdaten und nicht im Baustein Verrechnung: ein
   * Handwerksbetrieb hat einen Stundensatz, gleich welche Bausteine er
   * gekauft hat — wie die IBAN oder die UID.
   */
  stundensatz?: number;
  /**
   * Rechtsraum: "at", "de" oder "ch".
   *
   * Wird beim Einrichten gewählt und danach festgeschrieben — daran hängen
   * Steuersätze, Währung, Pflichtangaben auf der Rechnung, Verzugszinsen
   * und die Normen im Prüfbericht. Ein nachträglicher Wechsel würde
   * bestehende Belege mit falscher Rechtsgrundlage zurücklassen.
   */
  rechtsraum?: string;
  /**
   * Phasen je Auftragsart, wie dieser Betrieb sie nennt — siehe
   * ./phasen.ts. Leer heißt: die Voreinstellung.
   */
  phasen?: unknown;
  /**
   * Wie Fahrten auf die Rechnung kommen.
   *
   * Einstellbar, weil Betriebe das verschieden handhaben und keiner der
   * Wege falsch ist: der eine verrechnet Kilometer, der andere eine
   * Anfahrtspauschale je Einsatz, der dritte schreibt nur auf und
   * verrechnet pauschal im Stundensatz.
   */
  fahrtkostenArt?: Fahrtkostenart;
  /** Netto je Kilometer, in Cent. */
  kmSatz?: number;
  /** Netto je Fahrt, in Cent. */
  anfahrtPauschale?: number;
  /**
   * Nach wie vielen Tagen bei einem offenen Angebot nachgefasst wird, als
   * Folge: [7, 14, 30] heißt sieben Tage nach dem Versand, vierzehn nach
   * dem ersten Anruf, dreißig nach dem zweiten. Leer: Voreinstellung.
   */
  nachfassTage?: number[] | null;
  /** Konten für den BMD-Export, siehe baustein-verrechnung/src/daten/export.ts. */
  exportKonten?: unknown;
}

export const NACHFASS_RHYTHMUS_VORGABE: readonly number[] = [7, 14, 30];

/**
 * Den Rhythmus aus dem, was gespeichert oder getippt wurde: [7, 14, 30]
 * oder „7, 14, 30". Unsinn fällt weg; bleibt nichts übrig, gilt die
 * Vorgabe — ein leerer Rhythmus hieße, es erinnert nie jemand.
 */
export function nachfassRhythmus(roh: unknown): number[] {
  const teile = Array.isArray(roh) ? roh : String(roh ?? "").split(/[\s,;]+/);
  const zahlen = teile
    .map((t) => Number(t))
    .filter((n) => Number.isInteger(n) && n > 0 && n <= 365);
  return zahlen.length ? zahlen : [...NACHFASS_RHYTHMUS_VORGABE];
}

export const FAHRTKOSTENARTEN = ["km", "pauschale", "keine"] as const;
export type Fahrtkostenart = (typeof FAHRTKOSTENARTEN)[number];

export const FAHRTKOSTENART_TEXT: Record<Fahrtkostenart, string> = {
  km: "Kilometer × Satz",
  pauschale: "Anfahrtspauschale je Fahrt",
  keine: "Nur erfassen, nicht verrechnen",
};

export type BetriebEingabe = Omit<Betrieb, keyof Basisdatensatz>;

export const LEERER_BETRIEB: BetriebEingabe = {
  name: "",
  inhaber: "",
  strasse: "",
  plz: "",
  ort: "",
  land: "Österreich",
  telefon: "",
  email: "",
  web: "",
  uid: "",
  firmenbuch: "",
  gericht: "",
  iban: "",
  bic: "",
  bank: "",
  stundensatz: 0,
  rechtsraum: "at",
  fahrtkostenArt: "keine",
  kmSatz: 0,
  anfahrtPauschale: 0,
};

export async function betriebLaden(): Promise<Betrieb | null> {
  const liste = await pb().collection("betrieb").getList<Betrieb>(1, 1);
  return liste.items[0] ?? null;
}

/**
 * Speichert, was übergeben wird — auch nur einen Teil. Die Phasen- und die
 * Verrechnungseinstellung schicken nur ihre Felder; alles mitzuschicken
 * hieße, einen Stand zu überschreiben, den ein anderer Reiter vielleicht
 * gerade geändert hat.
 */
export async function betriebSpeichern(
  id: string,
  eingabe: Partial<BetriebEingabe>,
  was = "Betriebsstammdaten geändert",
): Promise<void> {
  const daten: Record<string, unknown> = {};
  for (const [schluessel, wert] of Object.entries(eingabe)) {
    daten[schluessel] = typeof wert === "string" ? wert.trim() : wert;
  }
  await schreiben({ art: "aendern", collection: "betrieb", id, daten });
  await protokollieren("betrieb", id, "aendern", was);
}

/**
 * Was auf einer Rechnung nach § 11 UStG nicht fehlen darf. Gibt die Namen der
 * leeren Pflichtfelder zurück — die Einstellungsseite weist darauf hin,
 * solange etwas fehlt.
 */
export function fehlendeRechnungsangaben(b: Betrieb | null): string[] {
  if (!b) return ["Betriebsstammdaten"];
  const pflicht: [keyof Betrieb, string][] = [
    ["name", "Firmenname"],
    ["strasse", "Straße"],
    ["plz", "PLZ"],
    ["ort", "Ort"],
    ["uid", "UID-Nummer"],
  ];
  return pflicht.filter(([feld]) => !String(b[feld] ?? "").trim()).map(([, text]) => text);
}

/**
 * Die Fahrtkostenzeile für einen Beleg — oder null, wenn keine hingehört.
 *
 * Reine Rechnung ohne Datenbank, damit sie unter Test steht: hier wird
 * entschieden, ob ein Kunde Kilometer oder eine Pauschale bezahlt.
 *
 * Steht der Satz auf null, entsteht die Zeile trotzdem, mit einem Hinweis
 * statt eines Betrags. Sie still wegzulassen hieße, dass Fahrten nie auf
 * einer Rechnung auftauchen, bis jemand merkt, dass der Satz fehlt — und
 * das merkt man an der Rechnung nicht.
 */
export function fahrtkostenZeile(
  betrieb: Pick<Betrieb, "fahrtkostenArt" | "kmSatz" | "anfahrtPauschale"> | null,
  fahrten: { fahrten: number; km: number },
): { bezeichnung: string; beschreibung: string; menge: number; einheit: string; einzelpreis: number } | null {
  const art = betrieb?.fahrtkostenArt ?? "keine";
  if (art === "keine") return null;
  if (fahrten.fahrten <= 0) return null;

  if (art === "km") {
    if (fahrten.km <= 0) return null;
    const satz = betrieb?.kmSatz ?? 0;
    return {
      bezeichnung: "Fahrtkosten laut Aufzeichnung",
      beschreibung:
        satz > 0
          ? `${fahrten.fahrten} ${fahrten.fahrten === 1 ? "Fahrt" : "Fahrten"}`
          : "Kilometersatz unter Einstellungen → Betrieb hinterlegen",
      menge: fahrten.km,
      einheit: "km",
      einzelpreis: satz,
    };
  }

  const pauschale = betrieb?.anfahrtPauschale ?? 0;
  return {
    bezeichnung: "Anfahrt",
    beschreibung:
      pauschale > 0
        ? `${fahrten.km.toLocaleString("de-AT")} km laut Aufzeichnung`
        : "Anfahrtspauschale unter Einstellungen → Betrieb hinterlegen",
    menge: fahrten.fahrten,
    einheit: "Pauschale",
    einzelpreis: pauschale,
  };
}
