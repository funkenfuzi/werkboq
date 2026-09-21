import { eigenerMitarbeiter, pb, sicher } from "@werkboq/core";
import type { Artikel } from "./artikel";
import type { Position } from "./positionen";

/**
 * Den Artikel finden, ohne den Katalog zu durchblättern.
 *
 * DER MASSSTAB IST EIN TIPP. Ein Monteur steht im Keller, hat eine Hand
 * frei und will drei Meter Kabel festhalten. Scrollt er durch fünfhundert
 * Artikel, macht er es beim dritten Mal nicht mehr — und dann fehlt das
 * Material auf der Rechnung, was genau der Verlust ist, den dieser Baustein
 * verhindern soll.
 *
 * Deshalb drei Wege, in dieser Reihenfolge:
 *
 *   ZULETZT VERWENDET. Der beste Vorschlag ist fast immer das, was gerade
 *   eben schon verbaut wurde. Wer eine Steckdose setzt, setzt meistens
 *   mehrere. Diese Liste entsteht von selbst und muss von niemandem
 *   gepflegt werden.
 *
 *   FAVORITEN. Betriebsweit, nicht je Person: was ein Elektriker ständig
 *   braucht, braucht der nächste auch, und eine Liste, die jeder für sich
 *   pflegen muss, pflegt niemand.
 *
 *   SUCHE UND STRICHCODE. Für alles andere.
 */

/** Wie viele Artikel „zuletzt verwendet" höchstens zeigt. */
const ZULETZT_ANZAHL = 12;

/**
 * Hat jemand selbst so wenig erfasst, dass seine eigene Liste nichts
 * hergibt, wird auf die des Betriebs ausgewichen. Ein neuer Lehrling soll
 * nicht vor einer leeren Fläche stehen.
 */
const EIGENE_MINDESTENS = 4;

export interface Schnellwahl {
  favoriten: Artikel[];
  zuletzt: Artikel[];
  /** Stammt „zuletzt" aus den eigenen Positionen oder aus denen aller? */
  eigene: boolean;
}

/**
 * EAN auf eine vergleichbare Form bringen.
 *
 * Ein Strichcodeleser liefert mal zwölf, mal dreizehn Stellen für dieselbe
 * Ware: UPC-A aus den USA hat zwölf, EAN-13 dreizehn, und die dreizehnte
 * Form entsteht aus der zwölften durch eine führende Null. Wer das nicht
 * angleicht, findet den Artikel nicht, obwohl er im Katalog steht.
 */
export function eanNormalisieren(roh: string): string {
  const ziffern = String(roh ?? "").replace(/\D/g, "");
  if (ziffern.length === 12) return `0${ziffern}`;
  return ziffern;
}

/**
 * Reihenfolge behalten, Wiederholungen streichen.
 *
 * Die Positionsliste kommt nach Zeitpunkt sortiert; derselbe Artikel steht
 * oft mehrfach darin. Gewollt ist: das Neueste zuerst, jeder Artikel einmal.
 */
export function ohneWiederholung(ids: string[]): string[] {
  const gesehen = new Set<string>();
  const heraus: string[] = [];
  for (const id of ids) {
    if (!id || gesehen.has(id)) continue;
    gesehen.add(id);
    heraus.push(id);
  }
  return heraus;
}

/**
 * Passt der Artikel zum Suchtext?
 *
 * Für das Filtern einer schon geladenen Liste, ohne den Server zu fragen —
 * im Keller gibt es kein Netz, und eine Suche, die dort stehenbleibt, ist
 * schlimmer als keine.
 *
 * Mehrere Wörter müssen alle vorkommen, aber in beliebiger Reihenfolge:
 * „nym 1,5" findet „NYM-J 3x1,5 mm²", wonach sonst niemand suchen könnte.
 */
export function passtZuSuche(a: Pick<Artikel, "bezeichnung" | "nummer"> & { ean?: string }, text: string): boolean {
  const worte = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (!worte.length) return true;
  const heuhaufen = `${a.bezeichnung} ${a.nummer} ${a.ean ?? ""}`.toLowerCase();
  const ean = eanNormalisieren(text);
  if (ean.length >= 8 && eanNormalisieren(a.ean ?? "") === ean) return true;
  return worte.every((w) => heuhaufen.includes(w));
}

/** Die betriebsweite Schnellauswahl. */
export async function favoriten(): Promise<Artikel[]> {
  return await pb()
    .collection("artikel")
    .getFullList<Artikel>({ filter: "favorit = true && aktiv = true", sort: "art,bezeichnung" });
}

/**
 * Artikel zu einem gescannten oder eingetippten Strichcode.
 *
 * Mehrzahl, nicht Einzahl: derselbe Code klebt gelegentlich auf zwei
 * Katalogeinträgen. Dann soll die Oberfläche fragen, statt den erstbesten
 * zu nehmen und die falsche Position anzulegen.
 */
export async function artikelZuEan(roh: string): Promise<Artikel[]> {
  const ean = eanNormalisieren(roh);
  if (ean.length < 8) return [];
  const ohneNull = ean.replace(/^0+/, "");
  return await pb()
    .collection("artikel")
    .getFullList<Artikel>({
      filter: `aktiv = true && (ean = "${sicher(ean)}" || ean = "${sicher(ohneNull)}")`,
      sort: "bezeichnung",
    });
}

/**
 * Was zuletzt verbaut wurde — meines zuerst, sonst das des Betriebs.
 *
 * Gelesen wird aus den Positionen, nicht aus einer eigenen Liste: eine
 * zweite Datenhaltung müsste gepflegt werden und wäre nach dem ersten
 * Löschen falsch.
 */
export async function zuletztVerwendet(): Promise<{ artikel: Artikel[]; eigene: boolean }> {
  const ich = await eigenerMitarbeiter().catch(() => null);

  let eigene = false;
  let ids: string[] = [];

  if (ich) {
    ids = ohneWiederholung(await artikelIds(`erfasstVon = "${sicher(ich.id)}"`));
    eigene = ids.length >= EIGENE_MINDESTENS;
  }
  if (!eigene) ids = ohneWiederholung(await artikelIds(""));

  const artikel = await artikelZuIds(ids.slice(0, ZULETZT_ANZAHL));
  return { artikel, eigene };
}

/** Beides in einem Zug, damit die Erfassung nicht zweimal wartet. */
export async function schnellwahlLaden(): Promise<Schnellwahl> {
  const [f, z] = await Promise.all([favoriten(), zuletztVerwendet()]);
  return { favoriten: f, zuletzt: z.artikel, eigene: z.eigene };
}

async function artikelIds(zusatz: string): Promise<string[]> {
  const filter = ['artikel != ""', zusatz].filter(Boolean).join(" && ");
  const liste = await pb()
    .collection("positionen")
    .getList<Position>(1, 150, { filter, sort: "-created", fields: "artikel" })
    .catch(() => null);
  return (liste?.items ?? []).map((p) => p.artikel ?? "");
}

/**
 * Artikel zu einer Liste von Kennungen — in einer Abfrage, in der
 * Reihenfolge der Kennungen.
 *
 * Einzeln abzufragen wären zwölf Anfragen für zwölf Kacheln; über eine
 * Mobilverbindung merkt man das.
 */
async function artikelZuIds(ids: string[]): Promise<Artikel[]> {
  if (!ids.length) return [];
  const filter = `aktiv = true && (${ids.map((i) => `id = "${sicher(i)}"`).join(" || ")})`;
  const gefunden = await pb().collection("artikel").getFullList<Artikel>({ filter });
  const nachId = new Map(gefunden.map((a) => [a.id, a]));
  return ids.map((i) => nachId.get(i)).filter((a): a is Artikel => Boolean(a));
}
