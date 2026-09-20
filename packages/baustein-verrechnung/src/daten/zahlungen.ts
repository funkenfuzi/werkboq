import { pb, protokollieren, runden, sicher, type Basisdatensatz } from "@werkboq/core";
import { heute, statusSetzen, type Beleg } from "./belege";

/**
 * Zahlungseingänge.
 *
 * Werkboq bucht nicht — es hält fest, was hereingekommen ist, damit die
 * offenen Posten stimmen und das Mahnwesen weiß, wen es anschreiben darf.
 * Gebucht wird beim Steuerberater; dafür gibt es den Export.
 *
 * Teilzahlungen sind der Normalfall im Handwerk (Anzahlung, Teilrechnung,
 * Restzahlung), deshalb sind mehrere Zahlungen je Beleg vorgesehen und der
 * Beleg gilt erst als bezahlt, wenn die Summe reicht.
 */

export const ZAHLUNGSARTEN = ["ueberweisung", "bar", "karte", "verrechnung"] as const;
export type Zahlungsart = (typeof ZAHLUNGSARTEN)[number];

export const ZAHLUNGSART_TEXT: Record<Zahlungsart, string> = {
  ueberweisung: "Überweisung",
  bar: "Bar",
  karte: "Karte",
  verrechnung: "Gegenverrechnung",
};

export interface Zahlung extends Basisdatensatz {
  beleg: string;
  datum: string;
  /** Betrag in Cent. Negativ bei einer Rückzahlung. */
  betrag: number;
  art: Zahlungsart;
  notiz?: string;
}

export async function zahlungenZuBeleg(beleg: string): Promise<Zahlung[]> {
  return await pb()
    .collection("zahlungen")
    .getFullList<Zahlung>({ filter: `beleg = "${sicher(beleg)}"`, sort: "datum" });
}

export function bezahlt(zahlungen: Zahlung[]): number {
  return zahlungen.reduce((s, z) => s + z.betrag, 0);
}

/** Was noch aussteht. Negativ heißt: überzahlt. */
export function offen(beleg: Pick<Beleg, "brutto">, zahlungen: Zahlung[]): number {
  return beleg.brutto - bezahlt(zahlungen);
}

/**
 * Skontobetrag, wenn innerhalb der Frist gezahlt wird.
 * Skonto rechnet vom Bruttobetrag — so steht es üblicherweise auf dem Beleg,
 * und so erwartet es der Kunde beim Überweisen.
 */
export function skontobetrag(
  b: Pick<Beleg, "brutto" | "skontoProzent">,
): number {
  if (!b.skontoProzent) return 0;
  return runden((b.brutto * b.skontoProzent) / 100);
}

/** Letzter Tag, an dem Skonto gezogen werden darf. */
export function skontoBis(b: Pick<Beleg, "datum" | "skontoTage">): string | null {
  if (!b.skontoTage) return null;
  const d = new Date(`${b.datum.slice(0, 10)}T00:00:00`);
  d.setDate(d.getDate() + b.skontoTage);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Bucht eine Zahlung und setzt den Beleg auf bezahlt, sobald nichts mehr
 * offen ist. Ein Cent Toleranz nach unten: Kunden runden beim Überweisen.
 */
export async function zahlungBuchen(
  beleg: Beleg,
  eingabe: { datum: string; betrag: number; art: Zahlungsart; notiz?: string },
): Promise<void> {
  await pb().collection("zahlungen").create({ ...eingabe, beleg: beleg.id });
  await protokollieren(
    "belege",
    beleg.id,
    "aendern",
    `Zahlung ${(eingabe.betrag / 100).toFixed(2)} € am ${eingabe.datum} gebucht`,
  );

  const alle = await zahlungenZuBeleg(beleg.id);
  if (offen(beleg, alle) <= 1 && beleg.status !== "bezahlt") {
    await statusSetzen(beleg, "bezahlt");
  }
}

export async function zahlungLoeschen(z: Zahlung, beleg: Beleg): Promise<void> {
  await pb().collection("zahlungen").delete(z.id);
  await protokollieren("belege", beleg.id, "aendern", `Zahlung vom ${z.datum} entfernt`);
  const alle = await zahlungenZuBeleg(beleg.id);
  if (offen(beleg, alle) > 1 && beleg.status === "bezahlt") {
    await statusSetzen(beleg, "offen");
  }
}

/** Offene Posten: alles, was offen ist und nicht storniert. */
export interface OffenerPosten {
  beleg: Beleg;
  bezahlt: number;
  offen: number;
  ueberfaellig: number;
}

export async function offenePosten(stichtag = heute()): Promise<OffenerPosten[]> {
  const belege = await pb()
    .collection("belege")
    .getFullList<Beleg>({
      filter: `(belegart = "rechnung" || belegart = "gutschrift") && status != "entwurf" && status != "storniert" && status != "bezahlt"`,
      sort: "datum",
    });

  const posten: OffenerPosten[] = [];
  for (const b of belege) {
    const zahlungen = await zahlungenZuBeleg(b.id);
    const rest = offen(b, zahlungen);
    if (Math.abs(rest) <= 1) continue;
    const faellig = new Date(`${b.datum.slice(0, 10)}T00:00:00`);
    faellig.setDate(faellig.getDate() + (b.zahlungszielTage ?? 0));
    const tage = Math.max(
      0,
      Math.round((new Date(`${stichtag}T00:00:00`).getTime() - faellig.getTime()) / 86400000),
    );
    posten.push({ beleg: b, bezahlt: bezahlt(zahlungen), offen: rest, ueberfaellig: tage });
  }
  return posten;
}
