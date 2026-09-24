import { darfSchreiben } from "../benutzer/rechte";
import { pb } from "./client";
import { protokollieren } from "./protokoll";
import type { Basisdatensatz } from "./typen";

/**
 * Lieferanten und Dienstleister.
 *
 * Die Gegenseite der Kunden: bei wem der Betrieb kauft und wer für ihn
 * arbeitet — Großhandel, Hersteller, die Firma für die Feuerlöscher, der
 * Leasinggeber. Im Kern, weil mehrere Bausteine daran hängen (Verträge,
 * später Bestellwesen und Eingangsrechnungen).
 */

export const LIEFERANTENARTEN = ["grosshandel", "hersteller", "dienstleister", "sonstiges"] as const;
export type Lieferantenart = (typeof LIEFERANTENARTEN)[number];
export const LIEFERANTENART_TEXT: Record<Lieferantenart, string> = {
  grosshandel: "Großhandel",
  hersteller: "Hersteller",
  dienstleister: "Dienstleister",
  sonstiges: "Sonstiges",
};

export interface Lieferant extends Basisdatensatz {
  name: string;
  art?: Lieferantenart | "";
  strasse?: string;
  plz?: string;
  ort?: string;
  land?: string;
  telefon?: string;
  email?: string;
  web?: string;
  /** Unsere Kundennummer dort. */
  kundennummer?: string;
  ansprechpartner?: string;
  uid?: string;
  notizen?: string;
  aktiv?: boolean;
}

export type LieferantEingabe = Omit<Lieferant, keyof Basisdatensatz>;

export const LEERER_LIEFERANT: LieferantEingabe = {
  name: "",
  art: "dienstleister",
  strasse: "",
  plz: "",
  ort: "",
  land: "",
  telefon: "",
  email: "",
  web: "",
  kundennummer: "",
  ansprechpartner: "",
  uid: "",
  notizen: "",
  aktiv: true,
};

/** Anlegen und ändern: Buchhaltung oder Lager — wie die Regel am Server. */
export function darfLieferantenAendern(): boolean {
  return darfSchreiben("buchhaltung") || darfSchreiben("lager");
}

export async function alleLieferanten(): Promise<Lieferant[]> {
  return await pb().collection("lieferanten").getFullList<Lieferant>({ sort: "name" });
}

export async function lieferantLaden(id: string): Promise<Lieferant> {
  return await pb().collection("lieferanten").getOne<Lieferant>(id);
}

export async function lieferantSpeichern(vorher: Lieferant | null, e: LieferantEingabe): Promise<Lieferant> {
  const daten = Object.fromEntries(Object.entries(e).map(([k, w]) => [k, typeof w === "string" ? w.trim() : w]));
  if (vorher) {
    const neu = await pb().collection("lieferanten").update<Lieferant>(vorher.id, daten);
    await protokollieren("lieferanten", vorher.id, "aendern", `Lieferant ${e.name} geändert`);
    return neu;
  }
  const neu = await pb().collection("lieferanten").create<Lieferant>(daten);
  await protokollieren("lieferanten", neu.id, "anlegen", `Lieferant ${e.name} angelegt`);
  return neu;
}
