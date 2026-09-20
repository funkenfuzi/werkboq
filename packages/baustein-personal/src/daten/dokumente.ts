import { pb, protokollieren, sicher, type Basisdatensatz } from "@werkboq/core";
import { heute } from "./abwesenheiten";

/**
 * Personaldokumente mit Ablaufdatum.
 *
 * Der eigentliche Zweck sind nicht die Dienstverträge — die liegen ohnehin
 * im Ordner. Es sind die Unterweisungen und Befähigungsnachweise, die
 * ablaufen, ohne dass es jemandem auffällt: die jährliche Unterweisung nach
 * ASchG, der Staplerschein, die arbeitsmedizinische Untersuchung. Dass eine
 * davon abgelaufen ist, merkt ein Betrieb sonst erst, wenn etwas passiert
 * ist oder die Arbeitsinspektion fragt.
 */

export const DOKUMENTARTEN = [
  "dienstvertrag",
  "zeugnis",
  "ausweis",
  "unterweisung",
  "befaehigung",
  "aerztlich",
  "sonstiges",
] as const;
export type Dokumentart = (typeof DOKUMENTARTEN)[number];

export const DOKUMENTART_TEXT: Record<Dokumentart, string> = {
  dienstvertrag: "Dienstvertrag",
  zeugnis: "Zeugnis",
  ausweis: "Ausweis",
  unterweisung: "Unterweisung",
  befaehigung: "Befähigungsnachweis",
  aerztlich: "Ärztliche Untersuchung",
  sonstiges: "Sonstiges",
};

/** Voreinstellung der Vorwarnzeit je Art, in Tagen. */
export const VORWARNUNG: Record<Dokumentart, number> = {
  dienstvertrag: 0,
  zeugnis: 0,
  ausweis: 60,
  unterweisung: 30,
  befaehigung: 90,
  aerztlich: 60,
  sonstiges: 0,
};

export interface Personaldokument extends Basisdatensatz {
  mitarbeiter: string;
  art: Dokumentart;
  titel: string;
  ausgestelltAm?: string;
  laeuftAb?: string;
  /** Tage vor Ablauf, ab denen erinnert wird. 0 = gar nicht. */
  erinnerungTage?: number;
  erledigt?: boolean;
  notiz?: string;
  datei?: string;
}

export type DokumentEingabe = Omit<Personaldokument, keyof Basisdatensatz | "datei">;

export const LEERES_DOKUMENT: Omit<DokumentEingabe, "mitarbeiter"> = {
  art: "unterweisung",
  titel: "",
  ausgestelltAm: heute(),
  laeuftAb: "",
  erinnerungTage: 30,
  erledigt: false,
  notiz: "",
};

export type Fristzustand = "ohne" | "offen" | "faellig" | "abgelaufen";

export const FRIST_TEXT: Record<Fristzustand, string> = {
  ohne: "ohne Frist",
  offen: "gültig",
  faellig: "läuft ab",
  abgelaufen: "abgelaufen",
};

export const FRIST_FARBE: Record<Fristzustand, string> = {
  ohne: "neutral",
  offen: "ok",
  faellig: "warn",
  abgelaufen: "fehler",
};

/**
 * In welchem Zustand ist die Frist dieses Dokuments?
 *
 * "faellig" heißt: die Vorwarnzeit hat begonnen. Ohne Ablaufdatum gibt es
 * nichts zu überwachen, und ein als erledigt markiertes Dokument — die
 * Unterweisung wurde nachgeholt, das Nachfolgedokument ist erfasst — fällt
 * ebenfalls heraus.
 */
export function fristzustand(
  d: Pick<Personaldokument, "laeuftAb" | "erinnerungTage" | "erledigt">,
  stichtag = heute(),
): Fristzustand {
  if (d.erledigt) return "ohne";
  if (!d.laeuftAb) return "ohne";
  const ab = d.laeuftAb.slice(0, 10);
  if (ab < stichtag) return "abgelaufen";
  const vorwarnung = d.erinnerungTage ?? 0;
  if (vorwarnung <= 0) return "offen";
  return tageBis(stichtag, ab) <= vorwarnung ? "faellig" : "offen";
}

/** Tage von a bis b. Negativ, wenn b vor a liegt. */
export function tageBis(a: string, b: string): number {
  const x = new Date(`${a.slice(0, 10)}T00:00:00`).getTime();
  const y = new Date(`${b.slice(0, 10)}T00:00:00`).getTime();
  return Math.round((y - x) / 86400000);
}

/**
 * Was gerade Aufmerksamkeit braucht — Abgelaufenes zuerst, dann das
 * Dringendste. Eine Liste, die nach Datum sortiert ist, beginnt mit dem
 * Ältesten; hier soll oben stehen, was brennt.
 */
export function zuErledigen(
  dokumente: Personaldokument[],
  stichtag = heute(),
): { dokument: Personaldokument; zustand: Fristzustand; tage: number }[] {
  return dokumente
    .map((dokument) => ({
      dokument,
      zustand: fristzustand(dokument, stichtag),
      tage: dokument.laeuftAb ? tageBis(stichtag, dokument.laeuftAb) : Number.POSITIVE_INFINITY,
    }))
    .filter((x) => x.zustand === "abgelaufen" || x.zustand === "faellig")
    .sort((a, b) => a.tage - b.tage);
}

export async function dokumenteZuMitarbeiter(mitarbeiterId: string): Promise<Personaldokument[]> {
  return await pb()
    .collection("personaldokumente")
    .getFullList<Personaldokument>({
      filter: `mitarbeiter = "${sicher(mitarbeiterId)}"`,
      sort: "-ausgestelltAm",
    });
}

/** Alle Dokumente mit Ablaufdatum — Grundlage der Fristenübersicht. */
export async function dokumenteMitFrist(): Promise<Personaldokument[]> {
  return await pb()
    .collection("personaldokumente")
    .getFullList<Personaldokument>({
      filter: 'laeuftAb != "" && erledigt != true',
      sort: "laeuftAb",
      expand: "mitarbeiter",
    });
}

export async function dokumentAnlegen(
  e: DokumentEingabe,
  datei?: File | null,
): Promise<Personaldokument> {
  const neu = await pb()
    .collection("personaldokumente")
    .create<Personaldokument>(formular(e, datei));
  await protokollieren("mitarbeiter", e.mitarbeiter, "anlegen", `Dokument "${e.titel}" abgelegt`);
  return neu;
}

export async function dokumentAendern(
  id: string,
  e: DokumentEingabe,
  datei?: File | null,
): Promise<void> {
  await pb().collection("personaldokumente").update(id, formular(e, datei));
  await protokollieren("mitarbeiter", e.mitarbeiter, "aendern", `Dokument "${e.titel}" geändert`);
}

export async function dokumentLoeschen(d: Personaldokument): Promise<void> {
  await pb().collection("personaldokumente").delete(d.id);
  await protokollieren("mitarbeiter", d.mitarbeiter, "loeschen", `Dokument "${d.titel}" gelöscht`);
}

/** Adresse der hinterlegten Datei, oder null. */
export function dateiAdresse(d: Personaldokument): string | null {
  if (!d.datei) return null;
  return pb().files.getUrl(d as unknown as Record<string, never>, d.datei);
}

/**
 * Baut das Formular für PocketBase.
 *
 * Mit Datei muss es FormData sein, ohne Datei geht ein einfaches Objekt —
 * und das ist wichtig, denn ein FormData ohne Dateifeld würde eine bereits
 * hinterlegte Datei löschen.
 */
function formular(e: DokumentEingabe, datei?: File | null): FormData | Record<string, unknown> {
  const werte: Record<string, unknown> = { ...e };
  for (const feld of ["ausgestelltAm", "laeuftAb"]) {
    if (!werte[feld]) werte[feld] = null;
  }
  if (!datei) return werte;

  const formData = new FormData();
  for (const [schluessel, wert] of Object.entries(werte)) {
    if (wert === null || wert === undefined) continue;
    formData.append(schluessel, typeof wert === "boolean" ? String(wert) : String(wert));
  }
  formData.append("datei", datei);
  return formData;
}
