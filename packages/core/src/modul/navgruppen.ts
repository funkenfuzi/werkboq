import type { Navgruppe, NavEintrag } from "./typen";

/**
 * Die Seitenleiste in Gruppen.
 *
 * Bis September 2026 stand jeder Eintrag untereinander — mit allen
 * Bausteinen waren es vierzehn, und niemand fand mehr etwas. Jetzt gibt es
 * fünf Überschriften, die sich aufklappen lassen. Ein Baustein sagt selbst,
 * wohin er gehört (`gruppe` am Navigationseintrag); die Seitenleiste kennt
 * keinen Baustein namentlich.
 *
 * Eine Gruppe mit nur einem Eintrag wird nicht zur Überschrift mit einem
 * einzigen Unterpunkt, sondern zum gewöhnlichen Eintrag: wer nur Kunden
 * hat, soll nicht erst „Kunden" aufklappen, um „Kunden" zu finden.
 */

export const NAVGRUPPEN: { id: Navgruppe; titel: string }[] = [
  { id: "kunden", titel: "Kunden" },
  { id: "auftraege", titel: "Aufträge" },
  { id: "verkauf", titel: "Verrechnung" },
  { id: "betrieb", titel: "Betrieb" },
  { id: "fachmodule", titel: "Fachmodule" },
];

export interface Navblock {
  id: Navgruppe;
  titel: string;
  eintraege: NavEintrag[];
}

/**
 * Ordnet sichtbare Einträge den Gruppen zu. Leere Gruppen fallen weg, die
 * Reihenfolge innerhalb einer Gruppe bleibt, wie sie hereinkam (Kern
 * zuerst, dann die Bausteine in Anmeldereihenfolge).
 */
export function navGruppieren(eintraege: (NavEintrag & { fachmodul?: boolean })[]): Navblock[] {
  return NAVGRUPPEN.map((g) => ({
    ...g,
    eintraege: eintraege.filter((e) => (e.fachmodul ? "fachmodule" : (e.gruppe ?? "betrieb")) === g.id),
  })).filter((g) => g.eintraege.length > 0);
}

/**
 * In welcher Gruppe liegt die geöffnete Seite? Die bleibt immer offen —
 * sonst ist der markierte Eintrag unsichtbar. Gesucht wird der längste
 * passende Pfad, damit /belege/abc zu „Belege" gehört und nicht zu „/".
 */
export function aktiveGruppe(bloecke: Navblock[], pfad: string): Navgruppe | null {
  let treffer: { gruppe: Navgruppe; laenge: number } | null = null;
  for (const b of bloecke) {
    for (const e of b.eintraege) {
      const passt = pfad === e.pfad || pfad.startsWith(`${e.pfad}/`);
      if (passt && (!treffer || e.pfad.length > treffer.laenge)) treffer = { gruppe: b.id, laenge: e.pfad.length };
    }
  }
  return treffer?.gruppe ?? null;
}
