import {
  pb,
  protokollieren,
  runden,
  schreiben,
  sicher,
  type Basisdatensatz,
  type UstSatz,
} from "@werkboq/core";
import type { Artikel, Artikelart } from "./artikel";

/**
 * Positionen an einem Auftrag.
 *
 * Was verbaut und was geleistet wurde — die eine Hälfte dessen, was später
 * auf der Rechnung steht. Die andere Hälfte sind die Stunden aus der
 * Zeiterfassung. Beide bleiben getrennt: eine Stunde ist keine Position,
 * und wer sie doppelt führt, verrechnet sie irgendwann doppelt.
 *
 * Eine Position kann aus dem Katalog stammen oder frei eingetippt sein.
 * Stammt sie aus dem Katalog, wird der Preis beim Einfügen KOPIERT, nicht
 * verknüpft: ändert sich der Katalogpreis, darf sich ein halbfertiger
 * Auftrag nicht rückwirkend verteuern.
 */

export interface Position extends Basisdatensatz {
  auftrag: string;
  /** Reihenfolge auf dem Beleg, beginnend bei 10 in Zehnerschritten. */
  pos: number;
  artikel?: string;
  art: Artikelart;
  bezeichnung: string;
  beschreibung?: string;
  menge: number;
  einheit: string;
  /** Netto-Einzelpreis in Cent. */
  einzelpreis: number;
  /** Rabatt in Prozent, 0 bis 100. */
  rabatt?: number;
  ustsatz: UstSatz;
  /** Schon verrechnet — gesetzt, sobald die Position auf einer Rechnung steht. */
  verrechnet?: boolean;
  /**
   * "vorschlag" = vom Monteur auf der Baustelle erfasst, vom Büro noch
   * nicht geprüft. Leer oder "freigegeben" = zählt.
   *
   * LEER BEDEUTET FREIGEGEBEN. Positionen aus der Zeit vor dieser
   * Unterscheidung dürfen nicht plötzlich in der Schwebe hängen, und was
   * das Büro selbst eintippt, braucht keine Freigabe von sich selbst.
   */
  zustand?: Zustand;
  /** Wer sie auf der Baustelle erfasst hat. */
  erfasstVon?: string;
  freigabeVon?: string;
  freigabeAm?: string;
}

export type Zustand = "vorschlag" | "freigegeben";

/** Zählt die Position mit — oder wartet sie noch auf das Büro? */
export function istFreigegeben(p: Pick<Position, "zustand">): boolean {
  return p.zustand !== "vorschlag";
}

export function nurFreigegebene<T extends Pick<Position, "zustand">>(liste: T[]): T[] {
  return liste.filter(istFreigegeben);
}

export function nurVorschlaege<T extends Pick<Position, "zustand">>(liste: T[]): T[] {
  return liste.filter((p) => !istFreigegeben(p));
}

export type PositionEingabe = Omit<Position, keyof Basisdatensatz>;

export const LEERE_POSITION: Omit<PositionEingabe, "auftrag" | "pos"> = {
  art: "material",
  bezeichnung: "",
  beschreibung: "",
  menge: 1,
  einheit: "Stk",
  einzelpreis: 0,
  rabatt: 0,
  ustsatz: 20,
  verrechnet: false,
  // Was im Büro eingetippt wird, braucht keine Freigabe von sich selbst.
  zustand: "freigegeben",
};

/**
 * Nettowert einer Position in Cent, Rabatt abgezogen.
 * Gerundet wird hier, auf Positionsebene — so steht auf dem Beleg neben
 * jeder Zeile derselbe Betrag, den die Summe verwendet.
 */
export function positionswert(p: Pick<Position, "menge" | "einzelpreis" | "rabatt">): number {
  const roh = p.menge * p.einzelpreis;
  const nachRabatt = roh * (1 - (p.rabatt ?? 0) / 100);
  return runden(nachRabatt);
}

export interface Summen {
  /** Nettosumme je Steuersatz, Schlüssel ist der Satz. */
  nettoJeSatz: Map<UstSatz, number>;
  netto: number;
  ust: number;
  brutto: number;
}

/**
 * Summiert Positionen.
 *
 * Die Steuer wird je Steuersatz aus der gerundeten Nettosumme berechnet,
 * nicht Position für Position. Das ist die Reihenfolge, die § 11 UStG
 * voraussetzt und die auf jedem Rechnungsformular steht — andersherum
 * entstehen Centdifferenzen zwischen Ausweis und Summe.
 */
export function summieren(
  positionen: Pick<Position, "menge" | "einzelpreis" | "rabatt" | "ustsatz">[],
): Summen {
  const nettoJeSatz = new Map<UstSatz, number>();
  for (const p of positionen) {
    const wert = positionswert(p);
    nettoJeSatz.set(p.ustsatz, (nettoJeSatz.get(p.ustsatz) ?? 0) + wert);
  }
  let netto = 0;
  let ust = 0;
  for (const [satz, betrag] of nettoJeSatz) {
    netto += betrag;
    ust += runden((betrag * satz) / 100);
  }
  return { nettoJeSatz, netto, ust, brutto: netto + ust };
}

export async function positionenZuAuftrag(auftrag: string): Promise<Position[]> {
  return await pb()
    .collection("positionen")
    .getFullList<Position>({ filter: `auftrag = "${sicher(auftrag)}"`, sort: "pos" });
}

/** Nächste Positionsnummer: Zehnerschritte, damit sich dazwischen einfügen lässt. */
export function naechstePos(vorhandene: Position[]): number {
  const hoechste = vorhandene.reduce((m, p) => Math.max(m, p.pos), 0);
  return hoechste + 10;
}

/** Aus einem Katalogartikel eine Position machen — Preis wird kopiert. */
export function ausArtikel(a: Artikel, auftrag: string, pos: number, menge = 1): PositionEingabe {
  return {
    auftrag,
    pos,
    artikel: a.id,
    art: a.art,
    bezeichnung: a.bezeichnung,
    beschreibung: a.beschreibung ?? "",
    menge,
    einheit: a.einheit,
    einzelpreis: a.preis,
    rabatt: 0,
    ustsatz: a.ustsatz,
    verrechnet: false,
    zustand: "freigegeben",
  };
}

export async function positionAnlegen(eingabe: PositionEingabe): Promise<Position | undefined> {
  const ergebnis = await schreiben({
    art: "anlegen",
    collection: "positionen",
    daten: aufbereiten(eingabe),
    lokaleId: `pos-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  });
  if (ergebnis.status !== "sofort") return undefined;
  const neu = ergebnis.datensatz as unknown as Position;
  await protokollieren(
    "auftraege",
    eingabe.auftrag,
    "aendern",
    `Position ${eingabe.pos} „${eingabe.bezeichnung}" hinzugefügt`,
  );
  return neu;
}

/**
 * Was der Monteur auf der Baustelle erfasst.
 *
 * Landet als Vorschlag in derselben Liste wie alles andere, zählt aber
 * noch nicht: erst die Freigabe macht daraus eine Position, die auf eine
 * Rechnung darf. Der Umweg kostet das Büro einen Klick und erspart ihm den
 * Anruf „was ist das für ein Posten auf Seite zwei".
 *
 * Absichtlich über denselben Weg wie jede andere Position — also auch
 * über die Offline-Warteschlange. Im Keller gibt es kein Netz, und genau
 * dort wird erfasst.
 */
export async function vorschlagAnlegen(
  eingabe: PositionEingabe,
  mitarbeiterId?: string,
): Promise<Position | undefined> {
  return await positionAnlegen({
    ...eingabe,
    zustand: "vorschlag",
    ...(mitarbeiterId ? { erfasstVon: mitarbeiterId } : {}),
  });
}

/**
 * Das Büro nimmt den Vorschlag an.
 *
 * Wer freigegeben hat und wann, bleibt am Datensatz stehen. Nicht aus
 * Misstrauen, sondern weil bei einer Rückfrage drei Monate später jemand
 * sagen können muss, wer das geprüft hat.
 */
export async function freigeben(p: Position, benutzerId?: string): Promise<void> {
  await schreiben({
    art: "aendern",
    collection: "positionen",
    id: p.id,
    daten: {
      zustand: "freigegeben",
      freigabeVon: benutzerId ?? null,
      freigabeAm: new Date().toISOString().slice(0, 10),
    },
  });
  await protokollieren(
    "auftraege",
    p.auftrag,
    "aendern",
    `Position ${p.pos} „${p.bezeichnung}" freigegeben`,
  );
}

/** Mehrere auf einmal — der Normalfall, wenn das Büro einen Tag durchsieht. */
export async function alleFreigeben(liste: Position[], benutzerId?: string): Promise<void> {
  for (const p of nurVorschlaege(liste)) await freigeben(p, benutzerId);
}

export async function positionAendern(p: Position, eingabe: PositionEingabe): Promise<void> {
  await schreiben({
    art: "aendern",
    collection: "positionen",
    id: p.id,
    daten: aufbereiten(eingabe),
  });
  await protokollieren(
    "auftraege",
    eingabe.auftrag,
    "aendern",
    `Position ${eingabe.pos} „${eingabe.bezeichnung}" geändert`,
  );
}

export async function positionLoeschen(p: Position): Promise<void> {
  await schreiben({ art: "loeschen", collection: "positionen", id: p.id });
  await protokollieren(
    "auftraege",
    p.auftrag,
    "aendern",
    `Position ${p.pos} „${p.bezeichnung}" entfernt`,
  );
}

/** Zwei Positionen tauschen die Reihenfolge. */
export async function positionVerschieben(p: Position, andere: Position): Promise<void> {
  await pb().collection("positionen").update(p.id, { pos: andere.pos });
  await pb().collection("positionen").update(andere.id, { pos: p.pos });
}

function aufbereiten(eingabe: PositionEingabe): Record<string, unknown> {
  const daten: Record<string, unknown> = {};
  for (const [schluessel, wert] of Object.entries(eingabe)) {
    daten[schluessel] = typeof wert === "string" ? wert.trim() : wert;
  }
  if (!daten.artikel) daten.artikel = null;
  return daten;
}
