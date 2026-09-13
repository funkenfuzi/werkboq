/**
 * Datenmodell Werkboq Basic.
 *
 * Grundsatz: Der Kunde ist immer die Wurzel. Eigene Vorhaben des Betriebs
 * werden als interner Kunde (kunde.intern = true) mit einem Auftrag angelegt.
 *
 * Ablauf eines Auftrags (Phasen):
 *   Anfrage → Spezifikation → Angebot → Termine → Projekt →
 *   Errichtung/Erweiterung → Abnahme → Wartung
 * oder verkürzt: nur Materialverkauf.
 *
 * Begriff: "Auftrag" (nicht "Projekt") – Arbeitsstand, kann noch geändert werden.
 */

export interface Basisdatensatz {
  id: string;
  created: string;
  updated: string;
}

export interface Kunde extends Basisdatensatz {
  name: string;
  /** Eigener Betrieb / eigene Vorhaben. */
  intern: boolean;
  strasse?: string;
  plz?: string;
  ort?: string;
  land?: string;
  telefon?: string;
  email?: string;
  uid?: string;
  notizen?: string;
}

export interface Standort extends Basisdatensatz {
  kunde: string;
  bezeichnung: string;
  strasse?: string;
  plz?: string;
  ort?: string;
}

export const AUFTRAG_PHASEN = [
  "anfrage",
  "spezifikation",
  "angebot",
  "termine",
  "projekt",
  "errichtung",
  "abnahme",
  "wartung",
  "materialverkauf",
  "abgeschlossen",
] as const;
export type AuftragPhase = (typeof AUFTRAG_PHASEN)[number];

export interface Auftrag extends Basisdatensatz {
  kunde: string;
  standort?: string;
  nummer: string;
  titel: string;
  phase: AuftragPhase;
  /** Welches Fachmodul den Auftrag fachlich führt, z. B. "elektro". */
  modul?: string;
  beschreibung?: string;
  beginn?: string;
  ende?: string;
}

export interface Termin extends Basisdatensatz {
  auftrag: string;
  titel: string;
  beginn: string;
  ende?: string;
  ort?: string;
  notizen?: string;
}

export interface Dokument extends Basisdatensatz {
  auftrag: string;
  titel: string;
  datei: string;
  /** Vom Modul gesetzt, z. B. "pruefbericht". */
  art?: string;
  modul?: string;
}

export interface Foto extends Basisdatensatz {
  auftrag: string;
  datei: string;
  beschreibung?: string;
  aufgenommen?: string;
}

/** Namen der Kern-Collections in PocketBase. */
export const KERN_COLLECTIONS = {
  benutzer: "users",
  kunden: "kunden",
  standorte: "standorte",
  auftraege: "auftraege",
  termine: "termine",
  dokumente: "dokumente",
  fotos: "fotos",
} as const;
