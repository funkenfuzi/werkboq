/**
 * Dienste zwischen Bausteinen.
 *
 * Erweiterungspunkte reichen Oberfläche durch, Dienste reichen Daten durch.
 * Beides folgt derselben Regel: kein Baustein kennt einen anderen. Die
 * Planung fragt "gibt es jemanden, der mir gebuchte Stunden liefert?" — wer
 * antwortet, ist ihr gleichgültig. Ist die Zeiterfassung nicht gekauft,
 * antwortet niemand, und die Spalte mit den gebuchten Stunden fällt weg.
 * Nichts bricht.
 *
 * Der Kern kennt die *Namen* und *Formen* der Dienste, so wie er die Namen
 * der Erweiterungspunkte kennt — aber keinen einzigen Anbieter.
 */

/**
 * Gebuchte Minuten je Mitarbeiter und Tag in einem Zeitraum.
 * Schlüssel: `mitarbeiterId|JJJJ-MM-TT`.
 */
export type TagesstundenDienst = (
  von: string,
  bis: string,
) => Promise<Record<string, number>>;

/** Gebuchte Minuten auf einem Auftrag, aufgeteilt in verrechenbar und gesamt. */
export type AuftragsstundenDienst = (
  auftragId: string,
) => Promise<{ gesamt: number; verrechenbar: number }>;

/**
 * Eine Position, wie sie ein Baustein an einen anderen weiterreicht.
 * Beträge in Cent, netto. `quelle` ist die Kennung beim liefernden Baustein
 * — der Empfänger merkt sich damit, woher eine übernommene Zeile stammt,
 * ohne den Datensatz selbst zu kennen.
 */
export interface Fremdposition {
  pos: number;
  art: string;
  bezeichnung: string;
  beschreibung: string;
  menge: number;
  einheit: string;
  einzelpreis: number;
  rabatt: number;
  ustsatz: number;
  betrag: number;
  quelle: string;
}

/** Positionen eines Auftrags mit Summen, aus dem Baustein Material. */
export type AuftragspositionenDienst = (auftragId: string) => Promise<{
  positionen: Fremdposition[];
  netto: number;
  ust: number;
  brutto: number;
}>;

export interface Dienste {
  tagesstunden: TagesstundenDienst;
  auftragsstunden: AuftragsstundenDienst;
  auftragspositionen: AuftragspositionenDienst;
}

const angeboten = new Map<keyof Dienste, unknown>();

/** Ein Baustein bietet einen Dienst an. Der letzte Anbieter gewinnt. */
export function dienstAnbieten<K extends keyof Dienste>(name: K, umsetzung: Dienste[K]): void {
  angeboten.set(name, umsetzung);
}

/** Holt einen Dienst — oder undefined, wenn ihn niemand anbietet. */
export function dienst<K extends keyof Dienste>(name: K): Dienste[K] | undefined {
  return angeboten.get(name) as Dienste[K] | undefined;
}

/** Nur für Tests. */
export function _diensteZuruecksetzen(): void {
  angeboten.clear();
}
