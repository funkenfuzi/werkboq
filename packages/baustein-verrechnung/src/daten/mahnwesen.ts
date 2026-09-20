import {
  aktuellerRechtsraum,
  pb,
  protokollieren,
  runden,
  sicher,
  type Basisdatensatz,
  type Rechtsraum,
} from "@werkboq/core";
import { faelligAm, heute, type Beleg } from "./belege";

/**
 * Mahnwesen.
 *
 * Drei Stufen, wie sie im Handwerk üblich sind: erst erinnern, dann mahnen,
 * dann ankündigen, dass es aus der Hand gegeben wird. Wer bei der ersten
 * Erinnerung schon Zinsen verlangt, verliert Kunden an einen vergessenen
 * Beleg — wer nie mahnt, finanziert seine Auftraggeber.
 *
 * ZINSEN UND SPESEN STEHEN NICHT HIER.
 *
 * Sie hängen am Land und stehen deshalb im Rechtsraum (werkzeug/laender.ts):
 * Österreich rechnet zwischen Unternehmern nach § 456 UGB, Deutschland nach
 * § 288 Abs 2 BGB, die Schweiz kennt nur den einen Satz aus Art. 104 OR und
 * gar keine Betreibungskostenpauschale. Eine Konstante an dieser Stelle wäre
 * in zwei von drei Ländern schlicht falsch.
 *
 * Gegenüber Verbrauchern gibt es in Österreich und der Schweiz keine
 * Kostenpauschale; Mahnspesen müssten dort vereinbart und der Höhe nach
 * angemessen sein. Werkboq schlägt deshalb für Verbraucher keine vor.
 */

/** Verzugszinssatz im Jahr für diesen Kunden, in Prozent. */
export function zinssatz(unternehmer: boolean, raum: Rechtsraum = aktuellerRechtsraum()): number {
  return unternehmer ? raum.verzugB2B : raum.verzugB2C;
}

/** Fundstelle des Zinssatzes — steht im Mahntext und in der Oberfläche. */
export function zinsParagraf(
  unternehmer: boolean,
  raum: Rechtsraum = aktuellerRechtsraum(),
): string {
  return unternehmer ? raum.verzugB2BParagraf : raum.verzugB2CParagraf;
}

/** Kostenpauschale im B2B, in Cent. 0, wo es keine gibt. */
export function kostenpauschale(
  unternehmer: boolean,
  raum: Rechtsraum = aktuellerRechtsraum(),
): number {
  return unternehmer ? raum.betreibungskosten : 0;
}

export const MAHNSTUFEN = [1, 2, 3] as const;
export type Mahnstufe = (typeof MAHNSTUFEN)[number];

export const MAHNSTUFE_TEXT: Record<Mahnstufe, string> = {
  1: "Zahlungserinnerung",
  2: "1. Mahnung",
  3: "2. Mahnung",
};

/** Frist, die die jeweilige Stufe üblicherweise setzt. */
export const MAHNSTUFE_FRIST: Record<Mahnstufe, number> = { 1: 10, 2: 7, 3: 7 };

export interface Mahnung extends Basisdatensatz {
  beleg: string;
  stufe: Mahnstufe;
  datum: string;
  frist: string;
  /** Verzugszinsen in Cent zum Mahnungsdatum. */
  zinsen?: number;
  /** Spesen in Cent. */
  spesen?: number;
  text?: string;
}

/**
 * Verzugszinsen in Cent, taggenau gerechnet.
 *
 * Grundlage ist der offene Betrag, nicht der Rechnungsbetrag: wer die Hälfte
 * gezahlt hat, schuldet nur auf die andere Hälfte Zinsen. Gerechnet wird mit
 * 365 Tagen; das ist die übliche Methode und die, die ein Gericht erwartet.
 */
export function verzugszinsen(
  offenerBetrag: number,
  tageImVerzug: number,
  unternehmer: boolean,
  raum: Rechtsraum = aktuellerRechtsraum(),
): number {
  if (offenerBetrag <= 0 || tageImVerzug <= 0) return 0;
  return runden((offenerBetrag * zinssatz(unternehmer, raum) * tageImVerzug) / (100 * 365));
}

/**
 * Was die nächste Mahnung kosten würde.
 *
 * Die Kostenpauschale gibt es einmal je Forderung, nicht je Mahnung —
 * deshalb hängt sie an der ersten echten Mahnung (Stufe 2) und nicht an der
 * Erinnerung. Wo das Land keine vorsieht (Schweiz), ist sie null.
 */
export function mahnvorschlag(
  beleg: Pick<Beleg, "datum" | "zahlungszielTage">,
  offenerBetrag: number,
  unternehmer: boolean,
  stufe: Mahnstufe,
  bisherigeSpesen: number,
  stichtag = heute(),
  raum: Rechtsraum = aktuellerRechtsraum(),
): { tage: number; zinsen: number; spesen: number; frist: string } {
  const faellig = new Date(`${faelligAm(beleg)}T00:00:00`).getTime();
  const jetzt = new Date(`${stichtag}T00:00:00`).getTime();
  const tage = Math.max(0, Math.round((jetzt - faellig) / 86400000));

  const zinsen = verzugszinsen(offenerBetrag, tage, unternehmer, raum);
  const spesen = stufe >= 2 && bisherigeSpesen === 0 ? kostenpauschale(unternehmer, raum) : 0;

  const frist = new Date(`${stichtag}T00:00:00`);
  frist.setDate(frist.getDate() + MAHNSTUFE_FRIST[stufe]);

  return {
    tage,
    zinsen,
    spesen,
    frist: `${frist.getFullYear()}-${String(frist.getMonth() + 1).padStart(2, "0")}-${String(frist.getDate()).padStart(2, "0")}`,
  };
}

/** Vorgeschlagener Text, den man vor dem Versenden noch ändern kann. */
export function mahntext(stufe: Mahnstufe, nummer: string, datum: string, frist: string): string {
  const d = (t: string) => new Date(`${t}T00:00:00`).toLocaleDateString("de-AT");
  switch (stufe) {
    case 1:
      return (
        `unsere Rechnung ${nummer} vom ${d(datum)} ist noch offen. ` +
        `Vermutlich ist sie untergegangen — wir ersuchen um Überweisung bis ${d(frist)}. ` +
        `Sollte sich die Zahlung mit diesem Schreiben überschnitten haben, betrachten Sie es bitte als gegenstandslos.`
      );
    case 2:
      return (
        `trotz unserer Erinnerung ist die Rechnung ${nummer} vom ${d(datum)} noch nicht beglichen. ` +
        `Wir setzen eine letzte Frist bis ${d(frist)} und verrechnen ab Fälligkeit Verzugszinsen.`
      );
    case 3:
      return (
        `die Rechnung ${nummer} vom ${d(datum)} ist trotz zweimaliger Aufforderung offen. ` +
        `Wir fordern Sie letztmalig auf, den Betrag bis ${d(frist)} zu überweisen. ` +
        `Nach fruchtlosem Ablauf geben wir die Forderung ohne weitere Ankündigung zur Eintreibung ab.`
      );
  }
}

export async function mahnungenZuBeleg(beleg: string): Promise<Mahnung[]> {
  return await pb()
    .collection("mahnungen")
    .getFullList<Mahnung>({ filter: `beleg = "${sicher(beleg)}"`, sort: "stufe" });
}

export async function mahnungAnlegen(
  beleg: Beleg,
  eingabe: { stufe: Mahnstufe; datum: string; frist: string; zinsen: number; spesen: number; text: string },
): Promise<Mahnung> {
  const neu = await pb().collection("mahnungen").create<Mahnung>({ ...eingabe, beleg: beleg.id });
  await protokollieren(
    "belege",
    beleg.id,
    "aendern",
    `${MAHNSTUFE_TEXT[eingabe.stufe]} erstellt, Frist ${eingabe.frist}`,
  );
  return neu;
}

/** Nächste Stufe für diesen Beleg, oder null wenn Stufe 3 schon gesetzt ist. */
export function naechsteStufe(bisher: Mahnung[]): Mahnstufe | null {
  const hoechste = bisher.reduce((m, x) => Math.max(m, x.stufe), 0);
  return hoechste >= 3 ? null : ((hoechste + 1) as Mahnstufe);
}
