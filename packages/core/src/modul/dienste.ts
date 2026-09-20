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

/**
 * Gibt es schon Daten, die den Rechtsraum festnageln?
 *
 * Der Kern muss beim Einrichten wissen, ob das Land noch wählbar ist. Er
 * darf dafür aber nicht in die Tabellen eines Bausteins schauen — also
 * fragt er. Wer keinen Beleg kennt, antwortet nicht, und das Land bleibt
 * änderbar; wer schon eine festgeschriebene Rechnung hat, sagt Nein.
 */
export type RechtsraumSperreDienst = () => Promise<{ gesperrt: boolean; grund: string }>;

/**
 * Wer ist an welchem Tag nicht da?
 * Schlüssel: `mitarbeiterId|JJJJ-MM-TT`. Bewusst ohne den Grund — die
 * Planung muss wissen, dass jemand fehlt, nicht ob es Urlaub oder
 * Krankenstand war.
 */
export type AbwesendDienst = (von: string, bis: string) => Promise<Record<string, true>>;

/**
 * Ein Termin, so viel davon, wie die Startseite braucht.
 *
 * Bewusst nicht der ganze Datensatz: der Kern soll nicht wissen, welche
 * Felder ein Termin im Baustein Planung hat. Er will anzeigen, wo jemand
 * heute hin muss — mehr nicht.
 */
export interface Tagestermin {
  id: string;
  titel: string;
  /** "07:00", leer bei ganztägigen Terminen. */
  beginn: string;
  ende: string;
  ganztags: boolean;
  ort: string;
  /** Auftragskennung, sofern der Termin an einem hängt. */
  auftrag?: string;
  /** Mitarbeiterkennungen — wer sonst noch eingeteilt ist. */
  mitarbeiter: string[];
}

/**
 * Die Termine eines Mitarbeiters an einem Tag, nach Beginn sortiert.
 * Ohne Mitarbeiterkennung: alle Termine des Tages, für das Büro.
 */
export type TagestermineDienst = (
  tag: string,
  mitarbeiterId?: string,
) => Promise<Tagestermin[]>;

export interface Dienste {
  tagesstunden: TagesstundenDienst;
  auftragsstunden: AuftragsstundenDienst;
  auftragspositionen: AuftragspositionenDienst;
  rechtsraumSperre: RechtsraumSperreDienst;
  abwesend: AbwesendDienst;
  tagestermine: TagestermineDienst;
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
