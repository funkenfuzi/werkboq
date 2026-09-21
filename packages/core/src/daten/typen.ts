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
  /**
   * Unternehmer oder Verbraucher.
   *
   * Entscheidet mehr als es aussieht: Verzugszinsen sind zwischen
   * Unternehmern gesetzlich viel höher als gegenüber Verbrauchern, die
   * Betreibungskostenpauschale nach § 458 UGB gibt es nur im B2B, und der
   * Übergang der Steuerschuld bei Bauleistungen setzt einen Unternehmer
   * voraus.
   */
  unternehmer?: boolean;
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

/**
 * Art des Auftrags — sie entscheidet, welche Phasen es überhaupt gibt.
 *
 * Vorher hatte jeder Auftrag dieselben zehn Phasen. Für eine
 * Störungsbehebung — anrufen, hinfahren, Sicherung tauschen, verrechnen —
 * waren sieben davon Lärm, durch den niemand klickt. Und "Materialverkauf"
 * stand als Phase neben "Abnahme", obwohl das eine ein Geschäftsvorfall ist
 * und das andere ein Zustand.
 *
 * Bestehende Aufträge ohne Art gelten als Projekt: das ist die Art mit
 * allen Phasen, also verschwindet bei keinem alten Datensatz etwas.
 */
export const AUFTRAGSARTEN = [
  "stoerung",
  "regie",
  "projekt",
  "wartung",
  "materialverkauf",
] as const;
export type Auftragsart = (typeof AUFTRAGSARTEN)[number];

export const AUFTRAGSART_TEXT: Record<Auftragsart, string> = {
  stoerung: "Störung",
  regie: "Regiearbeit",
  projekt: "Projekt",
  wartung: "Wartung",
  materialverkauf: "Materialverkauf",
};

export const AUFTRAGSART_HINWEIS: Record<Auftragsart, string> = {
  stoerung: "Hinfahren, beheben, verrechnen",
  regie: "Nach Aufwand, ohne Angebot",
  projekt: "Mit Angebot, Terminen und Abnahme",
  wartung: "Wiederkehrend, nach Vertrag",
  materialverkauf: "Nur Ware über die Budel",
};

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
  /** Fehlt sie, gilt "projekt" — siehe AUFTRAGSARTEN. */
  art?: Auftragsart;
  phase: AuftragPhase;
  /** Welches Fachmodul den Auftrag fachlich führt, z. B. "elektro". */
  modul?: string;
  beschreibung?: string;
  beginn?: string;
  ende?: string;
}

/**
 * Welche Phasen eine Auftragsart durchläuft, in dieser Reihenfolge.
 *
 * Bewusst dieselben Phasenkennungen für alle Arten: ein Auftrag, der von
 * Regie auf Projekt umgestellt wird, behält seine Phase, statt in einen
 * unbekannten Zustand zu fallen. Nur die Auswahl wird kürzer.
 */
export const PHASEN_JE_ART: Record<Auftragsart, AuftragPhase[]> = {
  // Eine Störung kennt kein Angebot und keine Spezifikation. Wer sie
  // trotzdem bräuchte, hat keine Störung, sondern einen Auftrag.
  stoerung: ["anfrage", "errichtung", "abgeschlossen"],
  regie: ["anfrage", "errichtung", "abnahme", "abgeschlossen"],
  projekt: [
    "anfrage",
    "spezifikation",
    "angebot",
    "termine",
    "projekt",
    "errichtung",
    "abnahme",
    "abgeschlossen",
  ],
  wartung: ["anfrage", "termine", "errichtung", "abnahme", "wartung", "abgeschlossen"],
  materialverkauf: ["anfrage", "materialverkauf", "abgeschlossen"],
};

/** Die Art eines Auftrags, mit der Voreinstellung für alte Datensätze. */
export function artVon(a: Pick<Auftrag, "art">): Auftragsart {
  return a.art && (AUFTRAGSARTEN as readonly string[]).includes(a.art) ? a.art : "projekt";
}

/**
 * Die Phasen, die dieser Auftrag anbieten soll.
 *
 * Steht der Auftrag in einer Phase, die seine Art nicht kennt — etwa nach
 * einer Umstellung von Projekt auf Störung —, wird sie trotzdem angezeigt.
 * Eine Phasenleiste, in der der aktuelle Zustand fehlt, ist schlimmer als
 * eine mit einem Eintrag zu viel.
 */
export function phasenFuer(a: Pick<Auftrag, "art" | "phase">): AuftragPhase[] {
  const vorgesehen = PHASEN_JE_ART[artVon(a)];
  if (vorgesehen.includes(a.phase)) return vorgesehen;
  return [...vorgesehen, a.phase];
}

// Termine stehen im Baustein Planung, Zeiten im Baustein Zeiterfassung.
// Der Kern kennt beide nicht.

export interface Dokument extends Basisdatensatz {
  auftrag: string;
  titel: string;
  datei: string;
  /** Vom Modul gesetzt, z. B. "pruefbericht". */
  art?: string;
  modul?: string;
}

/**
 * Wozu ein Foto gehört.
 *
 * Die Einordnung ist der eigentliche Wert. "Da war ein Loch in der Wand"
 * sagt nichts; "so war die Wand, bevor wir angefangen haben" sagt alles.
 * Vorher und Nachher sind das Paar, das im Streitfall zählt; "vorab" sind
 * die Bilder, die der Kunde schon mit der Anfrage schickt.
 */
export const FOTOARTEN = ["vorab", "vorher", "nachher", "schaden", "sonstiges"] as const;
export type Fotoart = (typeof FOTOARTEN)[number];

export interface Foto extends Basisdatensatz {
  auftrag: string;
  datei: string;
  art?: Fotoart;
  beschreibung?: string;
  aufgenommen?: string;
  mitarbeiter?: string;
}

/**
 * Namen der Kern-Collections in PocketBase.
 * Nur der Kern steht hier. Bausteine bringen ihre eigenen mit — "zeiten" und
 * "termine" gehören der Zeiterfassung bzw. der Planung, nicht dem Kern.
 */
export const KERN_COLLECTIONS = {
  benutzer: "users",
  kunden: "kunden",
  standorte: "standorte",
  auftraege: "auftraege",
  dokumente: "dokumente",
  fotos: "fotos",
  unterschriften: "unterschriften",
} as const;
