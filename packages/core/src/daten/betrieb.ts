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
}

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
};

export async function betriebLaden(): Promise<Betrieb | null> {
  const liste = await pb().collection("betrieb").getList<Betrieb>(1, 1);
  return liste.items[0] ?? null;
}

export async function betriebSpeichern(id: string, eingabe: BetriebEingabe): Promise<void> {
  const daten: Record<string, unknown> = {};
  for (const [schluessel, wert] of Object.entries(eingabe)) {
    daten[schluessel] = typeof wert === "string" ? wert.trim() : wert;
  }
  await schreiben({ art: "aendern", collection: "betrieb", id, daten });
  await protokollieren("betrieb", id, "aendern", "Betriebsstammdaten geändert");
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
