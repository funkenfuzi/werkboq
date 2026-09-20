import {
  alsStunden,
  minuten,
  pb,
  protokollieren,
  schreiben,
  sicher,
  spanne,
  type Basisdatensatz,
} from "@werkboq/core";

/**
 * Termine — die Planung.
 *
 * Ein Termin sagt, wer wann wo sein soll. Was daraus wurde, steht in den
 * Zeiten. Beides nebeneinander ergibt die Aussage, auf die es bei der
 * Ressourcenplanung ankommt: geplant acht Stunden, gebucht elf — da ist
 * etwas aus dem Ruder gelaufen.
 *
 * Ein Termin ohne Auftrag ist innerbetrieblich: Urlaub, Schulung, Werkstatt.
 * Deshalb ist der Auftrag nicht Pflicht, der Titel schon.
 */

export const TERMINARTEN = [
  "baustelle",
  "kundentermin",
  "werkstatt",
  "urlaub",
  "schulung",
  "sonstiges",
] as const;
export type Terminart = (typeof TERMINARTEN)[number];

export const TERMINART_TEXT: Record<Terminart, string> = {
  baustelle: "Baustelle",
  kundentermin: "Kundentermin",
  werkstatt: "Werkstatt",
  urlaub: "Urlaub",
  schulung: "Schulung",
  sonstiges: "Sonstiges",
};

export interface Termin extends Basisdatensatz {
  auftrag?: string;
  mitarbeiter?: string[];
  titel: string;
  datum: string;
  beginn?: string;
  ende?: string;
  ganztags?: boolean;
  art?: Terminart;
  ort?: string;
  notizen?: string;
}

export type TerminEingabe = Omit<Termin, keyof Basisdatensatz>;

export const LEERER_TERMIN: TerminEingabe = {
  auftrag: "",
  mitarbeiter: [],
  titel: "",
  datum: "",
  beginn: "07:00",
  ende: "16:00",
  ganztags: false,
  art: "baustelle",
  ort: "",
  notizen: "",
};

/** Geplante Dauer in Minuten. Ganztags zählt als acht Stunden. */
export function geplanteDauer(t: Pick<Termin, "beginn" | "ende" | "ganztags">): number {
  if (t.ganztags) return 8 * 60;
  if (!t.beginn || !t.ende) return 0;
  if (minuten(t.beginn) < 0 || minuten(t.ende) < 0) return 0;
  return spanne(t.beginn, t.ende);
}

export function geplantAlsStunden(t: Pick<Termin, "beginn" | "ende" | "ganztags">): string {
  return alsStunden(geplanteDauer(t));
}

export async function termineVonBis(von: string, bis: string): Promise<Termin[]> {
  return await pb()
    .collection("termine")
    .getFullList<Termin>({
      filter: `datum >= "${sicher(von)}" && datum <= "${sicher(bis)} 23:59:59"`,
      sort: "datum,beginn",
      expand: "auftrag,mitarbeiter",
    });
}

export async function termineZuAuftrag(auftrag: string): Promise<Termin[]> {
  return await pb()
    .collection("termine")
    .getFullList<Termin>({
      filter: `auftrag = "${sicher(auftrag)}"`,
      sort: "datum",
      expand: "mitarbeiter",
    });
}

export async function terminAnlegen(eingabe: TerminEingabe): Promise<Termin | undefined> {
  const ergebnis = await schreiben({
    art: "anlegen",
    collection: "termine",
    daten: aufbereiten(eingabe),
    lokaleId: `termin-${Date.now()}`,
  });
  if (ergebnis.status !== "sofort") return undefined;
  const neu = ergebnis.datensatz as unknown as Termin;
  if (eingabe.auftrag) {
    await protokollieren(
      "termine",
      eingabe.auftrag,
      "anlegen",
      `Termin „${eingabe.titel}" am ${eingabe.datum} eingeplant`,
    );
  }
  return neu;
}

export async function terminAendern(id: string, eingabe: TerminEingabe): Promise<void> {
  await schreiben({ art: "aendern", collection: "termine", id, daten: aufbereiten(eingabe) });
}

/** Verschiebt einen Termin auf einen anderen Tag — das Ziehen im Kalender. */
export async function terminVerschieben(t: Termin, datum: string): Promise<void> {
  if (t.datum.slice(0, 10) === datum) return;
  await schreiben({ art: "aendern", collection: "termine", id: t.id, daten: { datum } });
  if (t.auftrag) {
    await protokollieren(
      "termine",
      t.auftrag,
      "aendern",
      `Termin „${t.titel}" von ${t.datum.slice(0, 10)} auf ${datum} verschoben`,
    );
  }
}

export async function terminLoeschen(t: Termin): Promise<void> {
  await schreiben({ art: "loeschen", collection: "termine", id: t.id });
  if (t.auftrag) {
    await protokollieren("termine", t.auftrag, "loeschen", `Termin „${t.titel}" entfernt`);
  }
}

function aufbereiten(eingabe: TerminEingabe): Record<string, unknown> {
  return {
    ...eingabe,
    auftrag: eingabe.auftrag || null,
    mitarbeiter: eingabe.mitarbeiter ?? [],
    titel: eingabe.titel.trim(),
    beginn: eingabe.ganztags ? "" : eingabe.beginn,
    ende: eingabe.ganztags ? "" : eingabe.ende,
  };
}
