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
  "entwickler",   // Diagnose, Rohdaten
] as const;

export interface Benutzer {
  id: string;
  email: string;
  name: string;
  /** Freigegebene Bereiche, z. B. ["technik", "elektro"]. Leer = nichts außer Anmeldung. */
  bereiche: Bereich[];
  /** Admin darf alles, unabhängig von bereiche. */
  admin: boolean;
}

export function aktuellerBenutzer(): Benutzer | null {
  const m = pb().authStore.model as Record<string, unknown> | null;
  if (!m) return null;
  return {
    id: String(m.id),
    email: String(m.email ?? ""),
    name: String(m.name ?? ""),
    bereiche: Array.isArray(m.bereiche) ? (m.bereiche as Bereich[]) : [],
    admin: Boolean(m.admin),
  };
}

export function darf(bereich: Bereich, benutzer = aktuellerBenutzer()): boolean {
  if (!benutzer) return false;
  return benutzer.admin || benutzer.bereiche.includes(bereich);
}
