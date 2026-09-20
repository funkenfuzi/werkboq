import { pb } from "./client";
import { schreiben } from "./offline";
import { protokollieren } from "./protokoll";
import { aktuellerBenutzer } from "../benutzer/rechte";
import type { Basisdatensatz } from "./typen";

/**
 * Mitarbeiter — die planbaren Personen des Betriebs.
 *
 * Bewusst getrennt von `users`: wer sich anmelden kann und wer eingeplant
 * wird, ist nicht dasselbe. Ein Lehrling steht im Dienstplan, hat aber
 * vielleicht nie einen Zugang; umgekehrt kann ein Zugang für die Buchhaltung
 * existieren, der nie auf eine Baustelle fährt.
 *
 * Wer beides ist, hat in `benutzer` die Verknüpfung.
 */

export const FUNKTIONEN = ["meister", "monteur", "lehrling", "buero", "lager", "extern"] as const;
export type Funktion = (typeof FUNKTIONEN)[number];

export const FUNKTION_TEXT: Record<Funktion, string> = {
  meister: "Meister",
  monteur: "Monteur",
  lehrling: "Lehrling",
  buero: "Büro",
  lager: "Lager",
  extern: "Fremdfirma",
};

/** Funktionen, die üblicherweise auf Baustellen eingeplant werden. */
export const PLANBARE_FUNKTIONEN: Funktion[] = ["meister", "monteur", "lehrling", "extern"];

export interface Mitarbeiter extends Basisdatensatz {
  name: string;
  kurzzeichen?: string;
  funktion: Funktion;
  benutzer?: string;
  telefon?: string;
  email?: string;
  farbe?: string;
  wochenstunden?: number;
  aktiv?: boolean;
  notizen?: string;
}

export type MitarbeiterEingabe = Omit<Mitarbeiter, keyof Basisdatensatz>;

export const LEERER_MITARBEITER: MitarbeiterEingabe = {
  name: "",
  kurzzeichen: "",
  funktion: "monteur",
  benutzer: "",
  telefon: "",
  email: "",
  farbe: "#0058a8",
  wochenstunden: 38.5,
  aktiv: true,
  notizen: "",
};

export async function alleMitarbeiter(nurAktive = false): Promise<Mitarbeiter[]> {
  return await pb()
    .collection("mitarbeiter")
    .getFullList<Mitarbeiter>({
      sort: "name",
      ...(nurAktive ? { filter: "aktiv = true" } : {}),
    });
}

export async function mitarbeiterLaden(id: string): Promise<Mitarbeiter> {
  return await pb().collection("mitarbeiter").getOne<Mitarbeiter>(id);
}

/** Der Mitarbeiterdatensatz zum angemeldeten Benutzer, sofern verknüpft. */
export async function eigenerMitarbeiter(): Promise<Mitarbeiter | null> {
  const b = aktuellerBenutzer();
  if (!b) return null;
  return await pb()
    .collection("mitarbeiter")
    .getFirstListItem<Mitarbeiter>(`benutzer = "${b.id.replace(/["\\]/g, "")}"`)
    .catch(() => null);
}

export async function mitarbeiterAnlegen(
  eingabe: MitarbeiterEingabe,
): Promise<Mitarbeiter | undefined> {
  const ergebnis = await schreiben({
    art: "anlegen",
    collection: "mitarbeiter",
    daten: aufbereiten(eingabe),
    lokaleId: `ma-${Date.now()}`,
  });
  if (ergebnis.status !== "sofort") return undefined;
  const neu = ergebnis.datensatz as unknown as Mitarbeiter;
  await protokollieren("mitarbeiter", neu.id, "anlegen", `Mitarbeiter ${eingabe.name} angelegt`);
  return neu;
}

export async function mitarbeiterAendern(
  id: string,
  eingabe: MitarbeiterEingabe,
): Promise<void> {
  await schreiben({
    art: "aendern",
    collection: "mitarbeiter",
    id,
    daten: aufbereiten(eingabe),
  });
  await protokollieren("mitarbeiter", id, "aendern", `Stammdaten von ${eingabe.name} geändert`);
}

/**
 * Mitarbeiter werden nicht gelöscht, sondern stillgelegt — an ihnen hängen
 * Zeiten und Termine, die als Nachweis erhalten bleiben müssen.
 */
export async function mitarbeiterStilllegen(m: Mitarbeiter): Promise<void> {
  await schreiben({
    art: "aendern",
    collection: "mitarbeiter",
    id: m.id,
    daten: { aktiv: false },
  });
  await protokollieren("mitarbeiter", m.id, "aendern", `${m.name} stillgelegt`);
}

export function kurz(m: Mitarbeiter): string {
  if (m.kurzzeichen) return m.kurzzeichen;
  return m.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function aufbereiten(eingabe: MitarbeiterEingabe): Record<string, unknown> {
  const daten: Record<string, unknown> = {};
  for (const [schluessel, wert] of Object.entries(eingabe)) {
    daten[schluessel] = typeof wert === "string" ? wert.trim() : wert;
  }
  // Leere Verknüpfung muss null sein, sonst lehnt PocketBase sie ab.
  if (!daten.benutzer) daten.benutzer = null;
  if (!daten.kurzzeichen) daten.kurzzeichen = kurz({ name: String(daten.name ?? "") } as Mitarbeiter);
  return daten;
}
