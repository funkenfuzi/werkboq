import { pb } from "./client";
import { schreiben } from "./offline";
import { protokollieren } from "./protokoll";
import { aktuellerBenutzer } from "../benutzer/rechte";
import type { Basisdatensatz } from "./typen";

/**
 * Zeiterfassung.
 *
 * Ein Eintrag ohne `auftrag` ist allgemeine Arbeitszeit, einer mit `auftrag`
 * ist auf diesen Auftrag gebuchte Zeit. Dieselbe Stunde zählt damit nie
 * doppelt: die Wochensumme eines Mitarbeiters ist die Summe aller seiner
 * Einträge, die Auftragssumme nur die derjenigen mit diesem Auftrag.
 *
 * Beginn und Ende stehen als "HH:MM" in der Datenbank. Das ist absichtlich
 * simpel: Zeitzonen und Sommerzeit spielen bei einer Arbeitszeitaufzeichnung
 * keine Rolle — was zählt, ist was auf der Uhr stand.
 *
 * Arbeitszeitaufzeichnungen nach § 26 AZG verlangen Beginn, Ende und Pausen.
 * Diese drei Felder sind deshalb nicht optional wegdenkbar.
 */

export const ZEITARTEN = [
  "arbeit",
  "fahrt",
  "urlaub",
  "zeitausgleich",
  "krankenstand",
  "feiertag",
] as const;
export type Zeitart = (typeof ZEITARTEN)[number];

export const ZEITART_TEXT: Record<Zeitart, string> = {
  arbeit: "Arbeit",
  fahrt: "Fahrt",
  urlaub: "Urlaub",
  zeitausgleich: "Zeitausgleich",
  krankenstand: "Krankenstand",
  feiertag: "Feiertag",
};

/** Stunden, ab denen die Anwendung auf die Tagesgrenze hinweist. */
export const TAGESWARNUNG_STUNDEN = 10;

export interface Zeit extends Basisdatensatz {
  benutzer: string;
  benutzername: string;
  /** Wer gearbeitet hat. Meist derselbe wie der Erfasser — aber das Büro
   *  bucht auch für Monteure ohne eigenen Zugang. */
  mitarbeiter?: string;
  datum: string;
  beginn: string;
  ende?: string;
  pause?: number;
  auftrag?: string;
  art: Zeitart;
  taetigkeit?: string;
  verrechenbar?: boolean;
}

export type ZeitEingabe = Omit<Zeit, keyof Basisdatensatz | "benutzer" | "benutzername">;

export const LEERE_ZEIT: ZeitEingabe = {
  mitarbeiter: "",
  datum: "",
  beginn: "",
  ende: "",
  pause: 0,
  auftrag: "",
  art: "arbeit",
  taetigkeit: "",
  verrechenbar: true,
};

/** Minuten seit Mitternacht; -1 wenn die Angabe nicht lesbar ist. */
export function minuten(uhrzeit?: string): number {
  const treffer = /^(\d{1,2}):(\d{2})$/.exec((uhrzeit ?? "").trim());
  if (!treffer) return -1;
  const stunde = Number(treffer[1]);
  const minute = Number(treffer[2]);
  if (stunde > 23 || minute > 59) return -1;
  return stunde * 60 + minute;
}

/**
 * Dauer eines Eintrags in Minuten, Pause bereits abgezogen.
 * Ein Ende vor dem Beginn gilt als über Mitternacht hinaus — Nachtarbeit im
 * Störungsdienst ist der Normalfall, nicht der Sonderfall.
 */
export function dauer(z: Pick<Zeit, "beginn" | "ende" | "pause">): number {
  const von = minuten(z.beginn);
  const bis = minuten(z.ende);
  if (von < 0 || bis < 0) return 0;
  const roh = bis >= von ? bis - von : 24 * 60 - von + bis;
  return Math.max(0, roh - (z.pause ?? 0));
}

/** "7:45" aus Minuten. */
export function alsStunden(gesamtMinuten: number): string {
  const stunden = Math.floor(gesamtMinuten / 60);
  const rest = gesamtMinuten % 60;
  return `${stunden}:${String(rest).padStart(2, "0")}`;
}

export function summe(zeiten: Zeit[]): number {
  return zeiten.reduce((s, z) => s + dauer(z), 0);
}

/** Einträge eines Benutzers in einem Zeitraum, aufsteigend nach Datum. */
export async function zeitenVonBis(
  benutzer: string,
  von: string,
  bis: string,
): Promise<Zeit[]> {
  return await pb()
    .collection("zeiten")
    .getFullList<Zeit>({
      filter: `benutzer = "${sicher(benutzer)}" && datum >= "${sicher(von)}" && datum <= "${sicher(bis)} 23:59:59"`,
      sort: "datum,beginn",
      expand: "auftrag",
    });
}

/**
 * Alle Einträge eines Zeitraums über alle Mitarbeiter — Grundlage für die
 * Gegenüberstellung von Planung und Ist im Dispo-Kalender.
 */
export async function zeitenVonBisAlle(von: string, bis: string): Promise<Zeit[]> {
  return await pb()
    .collection("zeiten")
    .getFullList<Zeit>({
      filter: `datum >= "${sicher(von)}" && datum <= "${sicher(bis)} 23:59:59"`,
      sort: "datum,beginn",
    });
}

/** Alle Einträge zu einem Auftrag, über alle Mitarbeiter. */
export async function zeitenZuAuftrag(auftrag: string): Promise<Zeit[]> {
  return await pb()
    .collection("zeiten")
    .getFullList<Zeit>({
      filter: `auftrag = "${sicher(auftrag)}"`,
      sort: "-datum,beginn",
    });
}

export async function zeitAnlegen(eingabe: ZeitEingabe): Promise<Zeit | undefined> {
  const b = aktuellerBenutzer();
  if (!b) throw new Error("Nicht angemeldet.");

  const ergebnis = await schreiben({
    art: "anlegen",
    collection: "zeiten",
    daten: {
      ...eingabe,
      auftrag: eingabe.auftrag || null,
      mitarbeiter: eingabe.mitarbeiter || null,
      benutzer: b.id,
      benutzername: b.name || b.email,
    },
    lokaleId: `zeit-${Date.now()}`,
  });
  if (ergebnis.status !== "sofort") return undefined;

  const neu = ergebnis.datensatz as unknown as Zeit;
  if (eingabe.auftrag) {
    await protokollieren(
      "zeiten",
      eingabe.auftrag,
      "anlegen",
      `${alsStunden(dauer(eingabe))} h gebucht (${ZEITART_TEXT[eingabe.art]}) von ${b.name || b.email}`,
    );
  }
  return neu;
}

export async function zeitAendern(id: string, eingabe: ZeitEingabe): Promise<void> {
  await schreiben({
    art: "aendern",
    collection: "zeiten",
    id,
    daten: {
      ...eingabe,
      auftrag: eingabe.auftrag || null,
      mitarbeiter: eingabe.mitarbeiter || null,
    },
  });
}

export async function zeitLoeschen(z: Zeit): Promise<void> {
  await schreiben({ art: "loeschen", collection: "zeiten", id: z.id });
  if (z.auftrag) {
    await protokollieren(
      "zeiten",
      z.auftrag,
      "loeschen",
      `Zeiteintrag vom ${z.datum.slice(0, 10)} entfernt`,
    );
  }
}

/** Montag der Woche, in der `tag` liegt — als "JJJJ-MM-TT". */
export function wochenbeginn(tag = new Date()): string {
  const d = new Date(tag);
  const versatz = (d.getDay() + 6) % 7; // Montag = 0
  d.setDate(d.getDate() - versatz);
  return alsDatum(d);
}

export function alsDatum(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function tagePlus(datum: string, tage: number): string {
  const d = new Date(`${datum}T00:00:00`);
  d.setDate(d.getDate() + tage);
  return alsDatum(d);
}

/** Einträge nach Tag gruppiert. */
export function nachTag(zeiten: Zeit[]): Map<string, Zeit[]> {
  const karte = new Map<string, Zeit[]>();
  for (const z of zeiten) {
    const tag = z.datum.slice(0, 10);
    const bisher = karte.get(tag) ?? [];
    bisher.push(z);
    karte.set(tag, bisher);
  }
  return karte;
}

function sicher(text: string): string {
  return text.replace(/["\\]/g, "");
}
