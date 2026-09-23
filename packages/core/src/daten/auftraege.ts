import {
  KERN_COLLECTIONS,
  artVon,
  type Auftrag,
  type AuftragPhase,
  type Auftragsart,
} from "./typen";
import { AUFTRAG_PHASEN, phasenText, PHASENSTUFE_FARBE, PHASENSTUFE_TEXT } from "./phasen";
import { pb } from "./client";
import { darfSchreiben } from "../benutzer/rechte";
import { schreiben } from "./offline";
import { protokollieren, unterschiede } from "./protokoll";

/**
 * Zugriff auf Aufträge.
 *
 * Wie bei den Kunden: Lesen direkt, Schreiben über die Offline-Warteschlange.
 * Zusätzlich schreibt jeder Vorgang eine Zeile in den Änderungsverlauf — bei
 * Aufträgen ist "wer hat die Phase verschoben" die Frage, die im Streitfall
 * zuerst gestellt wird.
 */

export type AuftragEingabe = {
  kunde: string;
  standort?: string;
  nummer: string;
  titel: string;
  art?: Auftragsart;
  phase: AuftragPhase;
  modul?: string;
  beschreibung?: string;
  beginn?: string;
  ende?: string;
};

/**
 * Namen und Farben der Stufen ohne Bezug auf eine Art — für Stellen, die
 * über alle Aufträge gehen. Wo eine Art bekannt ist, gehört phasenText()
 * aus ./phasen.ts hin, damit eine Störung „Gemeldet" heißt und nicht
 * „Eingang".
 */
export const PHASENTEXT: Record<AuftragPhase, string> = PHASENSTUFE_TEXT;
export const PHASENFARBE: Record<AuftragPhase, string> = PHASENSTUFE_FARBE;

const FELDNAMEN: Record<string, string> = {
  kunde: "Kunde",
  standort: "Standort",
  nummer: "Nummer",
  titel: "Titel",
  art: "Auftragsart",
  phase: "Phase",
  modul: "Modul",
  beschreibung: "Beschreibung",
  beginn: "Beginn",
  ende: "Ende",
};

export const LEERER_AUFTRAG: AuftragEingabe = {
  kunde: "",
  standort: "",
  nummer: "",
  titel: "",
  art: "projekt",
  phase: "eingang",
  modul: "",
  beschreibung: "",
  beginn: "",
  ende: "",
};

/**
 * Darf dieser Zugang Aufträge anlegen und ändern, auch die Phase?
 *
 * Dieselbe Bedingung wie die Regel in packages/core/schema/kern.mjs:
 * Schreibrecht Technik oder Buchhaltung. Die Oberfläche fragt hier, damit
 * sie keine Knöpfe zeigt, deren Klick der Server ablehnt.
 */
export function darfAuftraegeAendern(): boolean {
  return darfSchreiben("technik") || darfSchreiben("buchhaltung");
}

export async function auftraegeSuchen(suche = "", grenze = 300): Promise<Auftrag[]> {
  const sauber = suche.trim().replace(/["\\]/g, "");
  const filter = sauber ? `titel ~ "${sauber}" || nummer ~ "${sauber}"` : "";
  const ergebnis = await pb()
    .collection(KERN_COLLECTIONS.auftraege)
    .getList<Auftrag>(1, grenze, {
      sort: "-created",
      expand: "kunde",
      ...(filter ? { filter } : {}),
    });
  return ergebnis.items;
}

export async function auftragLaden(id: string): Promise<Auftrag> {
  return await pb()
    .collection(KERN_COLLECTIONS.auftraege)
    .getOne<Auftrag>(id, { expand: "kunde,standort" });
}

/**
 * Schlägt die nächste freie Auftragsnummer im Schema JJJJ-NNN vor.
 * Nur ein Vorschlag — die Nummer bleibt frei änderbar, weil Betriebe eigene
 * Systeme haben. Die Eindeutigkeit erzwingt der Index in der Datenbank.
 */
export async function naechsteNummer(): Promise<string> {
  const jahr = new Date().getFullYear();
  try {
    const letzte = await pb()
      .collection(KERN_COLLECTIONS.auftraege)
      .getList<Auftrag>(1, 1, { filter: `nummer ~ "${jahr}-"`, sort: "-nummer" });
    const bisher = letzte.items[0]?.nummer ?? "";
    const zahl = Number(bisher.split("-")[1] ?? 0);
    return `${jahr}-${String(zahl + 1).padStart(3, "0")}`;
  } catch {
    return `${jahr}-001`;
  }
}

export async function auftragAnlegen(eingabe: AuftragEingabe): Promise<Auftrag | undefined> {
  const ergebnis = await schreiben({
    art: "anlegen",
    collection: KERN_COLLECTIONS.auftraege,
    daten: bereinigen(eingabe),
    lokaleId: `auftrag-${Date.now()}`,
  });
  if (ergebnis.status !== "sofort") return undefined;
  const angelegt = ergebnis.datensatz as unknown as Auftrag;
  await protokollieren(
    "auftraege",
    angelegt.id,
    "anlegen",
    `Auftrag ${angelegt.nummer} „${angelegt.titel}" angelegt`,
  );
  return angelegt;
}

export async function auftragAendern(
  vorher: Auftrag,
  eingabe: Partial<AuftragEingabe>,
): Promise<void> {
  await schreiben({
    art: "aendern",
    collection: KERN_COLLECTIONS.auftraege,
    id: vorher.id,
    daten: bereinigen(eingabe),
  });
  await protokollieren(
    "auftraege",
    vorher.id,
    "aendern",
    unterschiede(vorher as unknown as Record<string, unknown>, eingabe, FELDNAMEN),
  );
}

/** Phasenwechsel — der häufigste Vorgang, deshalb mit eigenem Verlaufstext. */
export async function phaseSetzen(auftrag: Auftrag, neu: AuftragPhase): Promise<void> {
  if (auftrag.phase === neu) return;
  await schreiben({
    art: "aendern",
    collection: KERN_COLLECTIONS.auftraege,
    id: auftrag.id,
    daten: { phase: neu },
  });
  await protokollieren(
    "auftraege",
    auftrag.id,
    "aendern",
    // Mit den Namen der Art, so wie der Anwender sie sieht — und so, wie
    // sie zum Zeitpunkt des Wechsels hießen. Benennt der Betrieb eine Phase
    // später um, bleibt der Verlauf, wie er war.
    `Phase von ${phasenText(auftrag.phase, artVon(auftrag))} auf ${phasenText(neu, artVon(auftrag))} gesetzt`,
  );
}

export async function auftragLoeschen(auftrag: Auftrag): Promise<void> {
  await schreiben({ art: "loeschen", collection: KERN_COLLECTIONS.auftraege, id: auftrag.id });
  await protokollieren(
    "auftraege",
    auftrag.id,
    "loeschen",
    `Auftrag ${auftrag.nummer} „${auftrag.titel}" gelöscht`,
  );
}

/** Aufträge nach Phase gruppiert — Grundlage für das Phasenbrett. */
export function nachPhase(auftraege: Auftrag[]): Record<AuftragPhase, Auftrag[]> {
  const brett = Object.fromEntries(AUFTRAG_PHASEN.map((p) => [p, [] as Auftrag[]])) as Record<
    AuftragPhase,
    Auftrag[]
  >;
  for (const a of auftraege) brett[a.phase]?.push(a);
  return brett;
}

function bereinigen(eingabe: Partial<AuftragEingabe>): Record<string, unknown> {
  const daten: Record<string, unknown> = {};
  for (const [schluessel, wert] of Object.entries(eingabe)) {
    if (wert === undefined) continue;
    daten[schluessel] = typeof wert === "string" ? wert.trim() : wert;
  }
  return daten;
}
