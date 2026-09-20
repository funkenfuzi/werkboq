import { pb } from "../daten/client";
import { alleModule } from "./registry";

/**
 * Welche Bausteine dieser Betrieb gekauft hat.
 *
 * Werkboq besteht aus einem Kern — Kunde, Auftrag, Mitarbeiter, Zugänge,
 * Dokumente, Verlauf — und aus Bausteinen, die einzeln verkauft werden:
 * Zeiterfassung, Planung, später Material und Verrechnung. Dazu kommen
 * Fachmodule für das jeweilige Gewerk.
 *
 * DIES IST KEIN KOPIERSCHUTZ, und es soll auch keiner werden.
 *
 * Werkboq läuft auf der PocketBase des Kunden. Wer dort Hand anlegt, schaltet
 * jeden Schalter um — eine Sperre im Browser wäre in fünf Minuten ausgehebelt
 * und würde nur ehrliche Anwender behindern. Was hier steht, sagt also:
 * "diese Bausteine gehören zu diesem Betrieb", nicht: "alles andere ist
 * verboten". Verkauft wird über den Vertrag, nicht über Verschlüsselung.
 *
 * Eine leere Liste heißt bewusst "alles an": ein Bestand, der noch nie einen
 * Schalter gesehen hat, soll nicht plötzlich dunkel werden.
 */

let freigegeben: string[] | null = null;

/**
 * Liest die Freigaben aus den Betriebsstammdaten. Einmal beim Start; danach
 * steht die Liste im Speicher, weil sie sich im Betrieb nicht ändert.
 */
export async function bausteineLaden(): Promise<string[]> {
  try {
    const liste = await pb().collection("betrieb").getList(1, 1);
    const roh = (liste.items[0] as unknown as { bausteine?: unknown })?.bausteine;
    freigegeben = Array.isArray(roh) ? roh.map(String) : [];
  } catch {
    // Kein Betriebsdatensatz, kein Netz, keine Rechte: nichts ausblenden.
    // Eine Fehlersituation darf keine Funktionen wegnehmen.
    freigegeben = [];
  }
  return freigegeben;
}

/** Ist dieser Baustein für den Betrieb freigegeben? */
export function bausteinAktiv(id: string): boolean {
  if (!freigegeben || freigegeben.length === 0) return true;
  return freigegeben.includes(id);
}

/** Die freigegebenen Bausteine, wie sie gespeichert sind (leer = alle). */
export function freigegebeneBausteine(): string[] {
  return freigegeben ?? [];
}

/**
 * Setzt die Freigaben. Speichert eine leere Liste als "alle", damit der
 * Betrieb nicht versehentlich alles abschaltet und sich aussperrt.
 */
export async function bausteineSetzen(betriebId: string, ids: string[]): Promise<void> {
  const alle = alleModule().map((m) => m.id);
  const sauber = ids.filter((i) => alle.includes(i));
  await pb()
    .collection("betrieb")
    .update(betriebId, { bausteine: sauber.length === alle.length ? [] : sauber });
  freigegeben = sauber.length === alle.length ? [] : sauber;
}

/** Nur für Tests. */
export function _bausteineSetzenOhneSpeichern(ids: string[] | null): void {
  freigegeben = ids;
}
