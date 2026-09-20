import { pb } from "./client";
import { schreiben } from "./offline";
import { protokollieren } from "./protokoll";
import type { Basisdatensatz } from "./typen";

/**
 * Ansprechpartner eines Kunden.
 *
 * Bei Gemeinden und größeren Betrieben ruft man nicht "den Kunden" an, sondern
 * den Bauhofleiter. Deshalb eigene Datensätze statt eines Feldes am Kunden.
 */

export interface Ansprechpartner extends Basisdatensatz {
  kunde: string;
  name: string;
  funktion?: string;
  telefon?: string;
  email?: string;
  notizen?: string;
}

export type AnsprechpartnerEingabe = Omit<Ansprechpartner, keyof Basisdatensatz>;

export const LEERER_ANSPRECHPARTNER: Omit<AnsprechpartnerEingabe, "kunde"> = {
  name: "",
  funktion: "",
  telefon: "",
  email: "",
  notizen: "",
};

export async function ansprechpartnerZuKunde(kunde: string): Promise<Ansprechpartner[]> {
  return await pb()
    .collection("ansprechpartner")
    .getFullList<Ansprechpartner>({
      filter: `kunde = "${kunde.replace(/["\\]/g, "")}"`,
      sort: "name",
    });
}

export async function ansprechpartnerAnlegen(
  eingabe: AnsprechpartnerEingabe,
): Promise<Ansprechpartner | undefined> {
  const ergebnis = await schreiben({
    art: "anlegen",
    collection: "ansprechpartner",
    daten: { ...eingabe },
    lokaleId: `ap-${Date.now()}`,
  });
  if (ergebnis.status !== "sofort") return undefined;
  const neu = ergebnis.datensatz as unknown as Ansprechpartner;
  await protokollieren("ansprechpartner", eingabe.kunde, "anlegen", `Ansprechpartner ${eingabe.name} angelegt`);
  return neu;
}

export async function ansprechpartnerLoeschen(p: Ansprechpartner): Promise<void> {
  await schreiben({ art: "loeschen", collection: "ansprechpartner", id: p.id });
  await protokollieren("ansprechpartner", p.kunde, "loeschen", `Ansprechpartner ${p.name} entfernt`);
}
