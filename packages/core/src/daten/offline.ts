import { pb } from "./client";

/**
 * Offline-Warteschlange.
 *
 * Schreibzugriffe laufen immer über `schreiben()`. Ist der Server nicht
 * erreichbar (z. B. im Keller), landet der Vorgang in einer lokalen
 * Warteschlange (IndexedDB über localStorage-Fallback in dieser ersten
 * Scheibe) und wird beim nächsten Netzkontakt in Reihenfolge nachgespielt.
 *
 * Diese erste Fassung ist bewusst einfach: keine Konfliktauflösung,
 * Datei-Uploads werden noch nicht gepuffert. Das kommt in einer späteren Scheibe.
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

async function ausfuehren(v: Vorgang): Promise<void> {
  const c = pb().collection(v.collection);
  switch (v.art) {
    case "anlegen":
      await c.create(v.daten);
      return;
    case "aendern":
      await c.update(v.id, v.daten);
      return;
    case "loeschen":
      await c.delete(v.id);
      return;
  }
}

/** Führt einen Schreibvorgang aus oder stellt ihn bei Netzausfall zurück. */
export async function schreiben(v: Vorgang): Promise<"sofort" | "gepuffert"> {
  if (lesen().length > 0) {
    // Reihenfolge wahren: solange etwas offen ist, wird angehängt.
    speichern([...lesen(), v]);
    void nachspielen();
    return "gepuffert";
  }
  try {
    await ausfuehren(v);
    return "sofort";
  } catch (e) {
    if (!istNetzfehler(e)) throw e;
    speichern([...lesen(), v]);
    return "gepuffert";
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
  globalThis.addEventListener?.("online", () => void nachspielen());
  void nachspielen();
}
