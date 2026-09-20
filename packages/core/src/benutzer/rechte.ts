import { pb } from "../daten/client";

/**
 * Bereiche, auf die ein Benutzer Zugriff haben kann.
 * Kernbereiche sind fix; Module fügen ihre eigene ID als Bereich hinzu
 * (siehe alleBereiche() im Registry).
 */
export type Bereich = string;

export const KERN_BEREICHE = [
  "verwaltung",   // Benutzer und Einstellungen
  "buchhaltung",  // Angebote, Rechnungen
  "technik",      // Aufträge, Dokumentation
  "lager",        // Material
  "personal",     // Personalakte, Abwesenheiten, Lohnvorbereitung
  "entwickler",   // Diagnose, Rohdaten
] as const;

/**
 * ZWEI STUFEN: LESEN UND SCHREIBEN.
 *
 * Ein Monteur soll die Aufträge sehen, auf die er fährt, aber keinen Preis
 * ändern. Ein Büro soll Rechnungen schreiben, aber nicht in der Personalakte
 * blättern. Dafür genügt eine Liste nicht: sie kennt nur dabei und nicht
 * dabei.
 *
 * `bereiche` ist die Schreibliste, `lesebereiche` die Leseliste. Wer in der
 * Schreibliste steht, darf auch lesen — alles andere wäre sinnlos. Die
 * Aufteilung ist rückwärtsverträglich: bestehende Zugänge haben nur
 * `bereiche` und behalten damit genau das, was sie vorher hatten.
 *
 * UND DIE RECHTE STEHEN NICHT NUR HIER.
 *
 * Was diese Datei entscheidet, betrifft die Oberfläche: welcher Menüpunkt
 * erscheint, welcher Knopf. Das ist Bequemlichkeit, kein Schutz. Wer die
 * Entwicklerkonsole öffnet, spricht die API direkt an und sieht alles, was
 * die Collection-Regeln hergeben. Für alles, was wirklich vertraulich ist —
 * Personaldaten voran — müssen die Regeln in PocketBase stehen. Siehe
 * server/einrichten.mjs, Abschnitt Personalwesen.
 */
export interface Benutzer {
  id: string;
  email: string;
  name: string;
  /** Bereiche mit Schreibrecht, z. B. ["technik", "elektro"]. */
  bereiche: Bereich[];
  /** Bereiche, die nur gelesen werden dürfen. */
  lesebereiche: Bereich[];
  /** Admin darf alles, unabhängig von den beiden Listen. */
  admin: boolean;
}

export type Stufe = "keine" | "lesen" | "schreiben";

export const STUFE_TEXT: Record<Stufe, string> = {
  keine: "kein Zugriff",
  lesen: "nur lesen",
  schreiben: "lesen und ändern",
};

export function aktuellerBenutzer(): Benutzer | null {
  const m = pb().authStore.model as Record<string, unknown> | null;
  if (!m) return null;
  return {
    id: String(m.id),
    email: String(m.email ?? ""),
    name: String(m.name ?? ""),
    bereiche: liste(m.bereiche),
    lesebereiche: liste(m.lesebereiche),
    admin: Boolean(m.admin),
  };
}

/** Darf der Benutzer diesen Bereich überhaupt sehen? */
export function darf(bereich: Bereich, benutzer = aktuellerBenutzer()): boolean {
  return stufe(bereich, benutzer) !== "keine";
}

/** Darf der Benutzer in diesem Bereich etwas ändern? */
export function darfSchreiben(bereich: Bereich, benutzer = aktuellerBenutzer()): boolean {
  return stufe(bereich, benutzer) === "schreiben";
}

/** Welche Stufe hat der Benutzer in diesem Bereich? */
export function stufe(bereich: Bereich, benutzer = aktuellerBenutzer()): Stufe {
  if (!benutzer) return "keine";
  if (benutzer.admin) return "schreiben";
  if (benutzer.bereiche.includes(bereich)) return "schreiben";
  if (benutzer.lesebereiche.includes(bereich)) return "lesen";
  return "keine";
}

/**
 * Setzt die Stufe eines Bereichs in den beiden Listen.
 * Gibt die neuen Listen zurück; gespeichert wird woanders.
 */
export function stufeSetzen(
  bereiche: Bereich[],
  lesebereiche: Bereich[],
  bereich: Bereich,
  neu: Stufe,
): { bereiche: Bereich[]; lesebereiche: Bereich[] } {
  const ohne = (l: Bereich[]) => l.filter((b) => b !== bereich);
  return {
    bereiche: neu === "schreiben" ? [...ohne(bereiche), bereich] : ohne(bereiche),
    lesebereiche: neu === "lesen" ? [...ohne(lesebereiche), bereich] : ohne(lesebereiche),
  };
}

function liste(wert: unknown): Bereich[] {
  return Array.isArray(wert) ? wert.map(String) : [];
}
