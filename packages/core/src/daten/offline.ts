import { pb } from "./client";

/**
 * Offline-Warteschlange.
 *
 * Schreibzugriffe laufen immer über `schreiben()`. Ist der Server nicht
 * erreichbar (z. B. im Keller), landet der Vorgang in einer lokalen
 * Warteschlange (IndexedDB über localStorage-Fallback in dieser ersten
 * Scheibe) und wird beim nächsten Netzkontakt in Reihenfolge nachgespielt.
 *
 * Bewusst einfach: keine Konfliktauflösung (der letzte Stand gewinnt).
 * Dateien — Fotos im Keller — puffert ./dateipuffer.ts in IndexedDB;
 * localStorage fasst dafür nicht genug.
 */

export type Vorgang =
  | { art: "anlegen"; collection: string; daten: Record<string, unknown>; lokaleId: string }
  | { art: "aendern"; collection: string; id: string; daten: Record<string, unknown> }
  | { art: "loeschen"; collection: string; id: string };

const SCHLUESSEL = "werkboq.offline.warteschlange";
let laeuft = false;
const zuhoerer = new Set<(anzahl: number) => void>();

function lesen(): Vorgang[] {
  try {
    const roh = globalThis.localStorage?.getItem(SCHLUESSEL);
    return roh ? (JSON.parse(roh) as Vorgang[]) : [];
  } catch {
    return [];
  }
}

function speichern(liste: Vorgang[]): void {
  try {
    globalThis.localStorage?.setItem(SCHLUESSEL, JSON.stringify(liste));
  } catch {
    /* Speicher nicht verfügbar – dann eben nur im RAM */
  }
  for (const z of zuhoerer) z(liste.length);
}

export function offeneVorgaenge(): number {
  return lesen().length;
}

export function beiAenderung(fn: (anzahl: number) => void): () => void {
  zuhoerer.add(fn);
  return () => zuhoerer.delete(fn);
}

function istNetzfehler(e: unknown): boolean {
  const status = (e as { status?: number })?.status;
  return status === 0 || status === undefined;
}

async function ausfuehren(v: Vorgang): Promise<Record<string, unknown> | undefined> {
  const c = pb().collection(v.collection);
  switch (v.art) {
    case "anlegen":
      return (await c.create(v.daten)) as unknown as Record<string, unknown>;
    case "aendern":
      return (await c.update(v.id, v.daten)) as unknown as Record<string, unknown>;
    case "loeschen":
      await c.delete(v.id);
      return undefined;
  }
}

/**
 * Ergebnis eines Schreibvorgangs.
 *
 * "sofort" heißt: der Server hat den Vorgang angenommen, `datensatz` enthält
 * den gespeicherten Stand samt vergebener id. "gepuffert" heißt: kein Netz,
 * der Vorgang liegt in der Warteschlange — es gibt dann noch keine id, und die
 * Oberfläche darf nicht auf einen Datensatz warten.
 */
export type SchreibErgebnis =
  | { status: "sofort"; datensatz?: Record<string, unknown> }
  | { status: "gepuffert" };

/** Führt einen Schreibvorgang aus oder stellt ihn bei Netzausfall zurück. */
export async function schreiben(v: Vorgang): Promise<SchreibErgebnis> {
  if (lesen().length > 0) {
    // Reihenfolge wahren: solange etwas offen ist, wird angehängt.
    speichern([...lesen(), v]);
    void nachspielen();
    return { status: "gepuffert" };
  }
  try {
    const datensatz = await ausfuehren(v);
    return { status: "sofort", datensatz };
  } catch (e) {
    if (!istNetzfehler(e)) throw e;
    speichern([...lesen(), v]);
    return { status: "gepuffert" };
  }
}

/** Spielt die Warteschlange nach, solange der Server erreichbar ist. */
export async function nachspielen(): Promise<void> {
  if (laeuft) return;
  laeuft = true;
  try {
    let liste = lesen();
    while (liste.length > 0) {
      const [erster, ...rest] = liste;
      if (!erster) break;
      try {
        await ausfuehren(erster);
      } catch (e) {
        if (istNetzfehler(e)) break; // später erneut
        // Fachlicher Fehler: Vorgang verwerfen, nicht ewig blockieren.
        console.error("Offline-Vorgang verworfen", erster, e);
      }
      liste = rest;
      speichern(liste);
    }
  } finally {
    laeuft = false;
  }
}

/** Beim Start aufrufen: nachspielen, sobald der Browser wieder online ist. */
export function offlineStarten(): void {
  const alles = () => void nachspielen().then(() => nachreicher?.());
  globalThis.addEventListener?.("online", alles);
  alles();
}

/**
 * Wer gepufferte Dateien nachreicht — gesetzt von baustelle.ts, damit
 * diese Datei nicht an IndexedDB hängt (sie läuft auch in Tests).
 */
let nachreicher: (() => Promise<unknown>) | null = null;
export function dateiNachreicherSetzen(fn: () => Promise<unknown>): void {
  nachreicher = fn;
}
