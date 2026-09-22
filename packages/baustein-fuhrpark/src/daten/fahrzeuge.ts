import {
  pb,
  protokollieren,
  schreiben,
  sicher,
  type Basisdatensatz,
} from "@werkboq/core";
import { heute, naechsteFaelligkeit, naechsterKm, type Fristart } from "./fristen";

/**
 * Fahrzeuge des Betriebs.
 *
 * Kein Fuhrparkmanagement — das wäre Tankkarten, Spritverbrauch,
 * Leasingabrechnung und Restwertprognose, und dafür gibt es eigene
 * Programme. Hier geht es um die eine Frage, an der ein Handwerksbetrieb
 * regelmäßig Geld verliert: WAS LÄUFT AB, OHNE DASS ES JEMANDEM AUFFÄLLT.
 *
 * Das ist dasselbe Muster wie bei den Personaldokumenten und bewusst
 * ebenso schmal gehalten.
 */

export const FAHRZEUGARTEN = ["pkw", "kastenwagen", "lkw", "anhaenger", "maschine"] as const;
export type Fahrzeugart = (typeof FAHRZEUGARTEN)[number];

export const FAHRZEUGART_TEXT: Record<Fahrzeugart, string> = {
  pkw: "Pkw",
  kastenwagen: "Kastenwagen",
  lkw: "Lkw",
  anhaenger: "Anhänger",
  maschine: "Maschine oder Gerät",
};

export interface Fahrzeug extends Basisdatensatz {
  kennzeichen: string;
  bezeichnung: string;
  art: Fahrzeugart;
  marke?: string;
  modell?: string;
  erstzulassung?: string;
  /** Wer damit unterwegs ist. Nicht Pflicht — Poolfahrzeuge gibt es auch. */
  mitarbeiter?: string;
  kmStand?: number;
  /** Wann der Kilometerstand zuletzt eingetragen wurde. */
  kmStandAm?: string;
  notiz?: string;
  aktiv?: boolean;
}

export type FahrzeugEingabe = Omit<Fahrzeug, keyof Basisdatensatz>;

export const LEERES_FAHRZEUG: FahrzeugEingabe = {
  kennzeichen: "",
  bezeichnung: "",
  art: "kastenwagen",
  marke: "",
  modell: "",
  erstzulassung: "",
  mitarbeiter: "",
  kmStand: 0,
  kmStandAm: "",
  notiz: "",
  aktiv: true,
};

export interface Fahrzeugfrist extends Basisdatensatz {
  fahrzeug: string;
  art: Fristart;
  titel?: string;
  faellig?: string;
  kmFaellig?: number;
  erinnerungTage?: number;
  /** In Monaten. 0 = einmalig, kein Nachfolger. */
  intervallMonate?: number;
  intervallKm?: number;
  erledigtAm?: string;
  erledigtKm?: number;
  notiz?: string;
  datei?: string;
}

export type FristEingabe = Omit<Fahrzeugfrist, keyof Basisdatensatz | "datei">;

export async function alleFahrzeuge(nurAktive = true): Promise<Fahrzeug[]> {
  return await pb()
    .collection("fahrzeuge")
    .getFullList<Fahrzeug>({
      sort: "kennzeichen",
      ...(nurAktive ? { filter: "aktiv = true" } : {}),
    });
}

export async function fahrzeugLaden(id: string): Promise<Fahrzeug> {
  return await pb().collection("fahrzeuge").getOne<Fahrzeug>(id);
}

export async function fahrzeugAnlegen(eingabe: FahrzeugEingabe): Promise<Fahrzeug | undefined> {
  const ergebnis = await schreiben({
    art: "anlegen",
    collection: "fahrzeuge",
    daten: aufbereiten(eingabe),
    lokaleId: `fz-${Date.now()}`,
  });
  if (ergebnis.status !== "sofort") return undefined;
  const neu = ergebnis.datensatz as unknown as Fahrzeug;
  await protokollieren("fahrzeuge", neu.id, "anlegen", `Fahrzeug ${eingabe.kennzeichen} angelegt`);
  return neu;
}

export async function fahrzeugAendern(id: string, eingabe: FahrzeugEingabe): Promise<void> {
  await schreiben({ art: "aendern", collection: "fahrzeuge", id, daten: aufbereiten(eingabe) });
  await protokollieren("fahrzeuge", id, "aendern", `Fahrzeug ${eingabe.kennzeichen} geändert`);
}

/**
 * Fahrzeuge werden stillgelegt, nicht gelöscht: an ihnen hängen erledigte
 * Fristen, und ein verkaufter Bus soll seine Begutachtungshistorie nicht
 * mitnehmen.
 */
export async function fahrzeugStilllegen(f: Fahrzeug): Promise<void> {
  await schreiben({ art: "aendern", collection: "fahrzeuge", id: f.id, daten: { aktiv: false } });
  await protokollieren("fahrzeuge", f.id, "aendern", `${f.kennzeichen} stillgelegt`);
}

/**
 * Kilometerstand nachtragen.
 *
 * Eigene Funktion, weil das der einzige Wert ist, den jemand im
 * Vorbeigehen ändert — und weil ein Kilometerstand ohne Datum nichts wert
 * ist. Rückwärts geht es nicht: ein Tacho zählt nicht zurück, und wer sich
 * vertippt, soll es merken, statt eine Servicefrist zu verschieben.
 */
export async function kmNachtragen(f: Fahrzeug, stand: number): Promise<void> {
  if (stand < (f.kmStand ?? 0)) {
    throw new Error(
      `Der neue Stand (${stand.toLocaleString("de-AT")} km) liegt unter dem bisherigen ` +
        `(${(f.kmStand ?? 0).toLocaleString("de-AT")} km). Bitte prüfen.`,
    );
  }
  await schreiben({
    art: "aendern",
    collection: "fahrzeuge",
    id: f.id,
    daten: { kmStand: stand, kmStandAm: heute() },
  });
  await protokollieren(
    "fahrzeuge",
    f.id,
    "aendern",
    `Kilometerstand ${stand.toLocaleString("de-AT")} km eingetragen`,
  );
}

export async function fristenZuFahrzeug(fahrzeugId: string): Promise<Fahrzeugfrist[]> {
  return await pb()
    .collection("fahrzeugfristen")
    .getFullList<Fahrzeugfrist>({ filter: `fahrzeug = "${sicher(fahrzeugId)}"`, sort: "faellig" });
}

/** Alle offenen Fristen aller Fahrzeuge — für die Startseite. */
export async function offeneFristen(): Promise<Fahrzeugfrist[]> {
  return await pb()
    .collection("fahrzeugfristen")
    .getFullList<Fahrzeugfrist>({ filter: 'erledigtAm = "" || erledigtAm = null', sort: "faellig" });
}

export async function fristAnlegen(eingabe: FristEingabe): Promise<Fahrzeugfrist | undefined> {
  const ergebnis = await schreiben({
    art: "anlegen",
    collection: "fahrzeugfristen",
    daten: aufbereiten(eingabe),
    lokaleId: `frist-${Date.now()}`,
  });
  if (ergebnis.status !== "sofort") return undefined;
  const neu = ergebnis.datensatz as unknown as Fahrzeugfrist;
  await protokollieren("fahrzeuge", eingabe.fahrzeug, "aendern", `Frist angelegt: ${eingabe.titel || eingabe.art}`);
  return neu;
}

export async function fristAendern(f: Fahrzeugfrist, eingabe: FristEingabe): Promise<void> {
  await schreiben({
    art: "aendern",
    collection: "fahrzeugfristen",
    id: f.id,
    daten: aufbereiten(eingabe),
  });
  await protokollieren("fahrzeuge", f.fahrzeug, "aendern", `Frist geändert: ${eingabe.titel || eingabe.art}`);
}

export async function fristLoeschen(f: Fahrzeugfrist): Promise<void> {
  await schreiben({ art: "loeschen", collection: "fahrzeugfristen", id: f.id });
  await protokollieren("fahrzeuge", f.fahrzeug, "aendern", `Frist entfernt: ${f.titel || f.art}`);
}

/**
 * Eine Frist abhaken — und gleich die nächste stellen.
 *
 * Der zweite Teil ist der Punkt. Eine erledigte Frist ohne Nachfolger ist
 * eine Frist, an die im nächsten Jahr niemand denkt: der Zettel von der
 * Werkstatt wandert ins Handschuhfach, und elf Monate später fällt es
 * keinem auf. Deshalb entsteht der Nachfolger im selben Zug — mit einem
 * Datum, das vorher in der Maske steht und das man ändern kann.
 */
export async function fristErledigen(
  f: Fahrzeugfrist,
  erledigt: { am: string; km?: number; naechste?: string; naechsteKm?: number; notiz?: string },
): Promise<void> {
  await schreiben({
    art: "aendern",
    collection: "fahrzeugfristen",
    id: f.id,
    daten: {
      erledigtAm: erledigt.am,
      erledigtKm: erledigt.km ?? null,
      ...(erledigt.notiz ? { notiz: erledigt.notiz } : {}),
    },
  });
  await protokollieren(
    "fahrzeuge",
    f.fahrzeug,
    "aendern",
    `${f.titel || f.art} erledigt am ${erledigt.am}`,
  );

  const faellig = erledigt.naechste ?? naechsteFaelligkeit(f.faellig ?? "", f.intervallMonate ?? 0);
  const kmFaellig = erledigt.naechsteKm ?? naechsterKm(f.kmFaellig, f.intervallKm);
  if (!faellig && !kmFaellig) return;

  await fristAnlegen({
    fahrzeug: f.fahrzeug,
    art: f.art,
    titel: f.titel ?? "",
    faellig,
    kmFaellig,
    erinnerungTage: f.erinnerungTage ?? 30,
    intervallMonate: f.intervallMonate ?? 0,
    intervallKm: f.intervallKm ?? 0,
    erledigtAm: "",
    notiz: "",
  });
}

function aufbereiten(eingabe: Record<string, unknown>): Record<string, unknown> {
  const daten: Record<string, unknown> = {};
  for (const [schluessel, wert] of Object.entries(eingabe)) {
    daten[schluessel] = typeof wert === "string" ? wert.trim() : wert;
  }
  // Leere Beziehungen müssen null sein, sonst lehnt PocketBase sie ab.
  for (const feld of ["mitarbeiter"]) if (!daten[feld]) daten[feld] = null;
  return daten;
}
