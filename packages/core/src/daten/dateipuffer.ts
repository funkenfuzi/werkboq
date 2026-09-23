import { pb } from "./client";
import { protokollieren } from "./protokoll";

/**
 * Puffer für Dateien, die ohne Netz aufgenommen wurden — Fotos im Keller.
 *
 * DIE FRÜHERE ENTSCHEIDUNG UND WARUM SIE JETZT ANDERS FÄLLT. Bis September
 * 2026 wurde ein Foto ohne Netz gar nicht angenommen: lieber eine ehrliche
 * Fehlermeldung als ein Bild, das scheinbar gespeichert ist und nie
 * ankommt — der Monteur machte sonst die Wand zu im Glauben, es sei da.
 * Das Argument bleibt richtig. Nur: im Keller gibt es kein Netz, und
 * genau dort wird fotografiert. Die Fehlermeldung hieß in der Praxis
 * „kein Foto".
 *
 * Also wird gepuffert, aber SICHTBAR: das Bild steht im Fotoblock mit dem
 * Vermerk „noch nicht auf dem Server", die Leiste oben zählt es mit, und
 * erst wenn der Server es angenommen hat, verschwindet der Vermerk. Lehnt
 * der Server es ab (etwa zu groß), wird es nicht still verworfen, sondern
 * bleibt mit der Begründung stehen, bis jemand es selbst entfernt.
 *
 * WARUM INDEXEDDB. Die übrige Warteschlange steht in localStorage — das
 * fasst ein paar Megabyte Text, aber keine zwanzig Handyfotos. IndexedDB
 * speichert Blobs direkt und ist groß genug.
 *
 * Was man wissen muss: Safari auf dem iPhone darf den Speicher einer
 * Webseite räumen, wenn sie sieben Tage nicht geöffnet wurde. Wer im
 * Keller fotografiert, ist aber meist am selben Tag wieder im Netz.
 */

export interface GepufferteDatei {
  id: string;
  collection: string;
  /** Die übrigen Felder des Datensatzes, als Text (FormData). */
  felder: Record<string, string>;
  /** Name des Dateifelds in der Collection, z. B. "datei". */
  dateifeld: string;
  datei: Blob;
  dateiname: string;
  angelegt: string;
  /** Hat der Server sie fachlich abgelehnt, steht hier warum. */
  fehler?: string;
  /** Verlaufseintrag, der nach dem Hochladen geschrieben wird. */
  protokoll?: { bereich: string; datensatz: string; text: string };
}

const DB = "werkboq";
const STORE = "dateien";
const zuhoerer = new Set<(anzahl: number) => void>();
let laeuft = false;

function oeffnen(): Promise<IDBDatabase> {
  return new Promise((ok, nein) => {
    if (!globalThis.indexedDB) return nein(new Error("Dieser Browser kann keine Dateien zwischenspeichern."));
    const anfrage = indexedDB.open(DB, 1);
    anfrage.onupgradeneeded = () => {
      if (!anfrage.result.objectStoreNames.contains(STORE)) anfrage.result.createObjectStore(STORE, { keyPath: "id" });
    };
    anfrage.onsuccess = () => ok(anfrage.result);
    anfrage.onerror = () => nein(anfrage.error);
  });
}

async function mitStore<T>(modus: IDBTransactionMode, tu: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await oeffnen();
  return await new Promise<T>((ok, nein) => {
    const t = db.transaction(STORE, modus);
    const anfrage = tu(t.objectStore(STORE));
    t.oncomplete = () => {
      db.close();
      ok(anfrage.result);
    };
    t.onerror = () => {
      db.close();
      nein(t.error);
    };
  });
}

async function melden(): Promise<void> {
  const n = (await gepufferteDateien().catch(() => [])).length;
  for (const z of zuhoerer) z(n);
}

/** Alle gepufferten Dateien, älteste zuerst. Mit `filter` nur die passenden. */
export async function gepufferteDateien(
  filter?: (d: GepufferteDatei) => boolean,
): Promise<GepufferteDatei[]> {
  const alle = await mitStore<GepufferteDatei[]>("readonly", (s) => s.getAll() as IDBRequest<GepufferteDatei[]>);
  return alle.filter(filter ?? (() => true)).sort((a, b) => a.angelegt.localeCompare(b.angelegt));
}

export function beiDateiAenderung(fn: (anzahl: number) => void): () => void {
  zuhoerer.add(fn);
  void melden();
  return () => zuhoerer.delete(fn);
}

export async function dateiPuffern(
  eintrag: Omit<GepufferteDatei, "id" | "angelegt">,
): Promise<GepufferteDatei> {
  const voll: GepufferteDatei = {
    ...eintrag,
    id: `datei-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    angelegt: new Date().toISOString(),
  };
  await mitStore("readwrite", (s) => s.put(voll));
  await melden();
  return voll;
}

/** Eine gepufferte Datei selbst entfernen — nur auf ausdrücklichen Wunsch. */
export async function gepufferteEntfernen(id: string): Promise<void> {
  await mitStore("readwrite", (s) => s.delete(id));
  await melden();
}

export function istNetzfehler(e: unknown): boolean {
  const status = (e as { status?: number })?.status;
  return status === 0 || status === undefined;
}

/** Das Formular für den Server aus einem Eintrag. */
export function formularAus(d: GepufferteDatei, ergaenzen: Record<string, string> = {}): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries({ ...d.felder, ...ergaenzen })) f.append(k, v);
  f.append(d.dateifeld, d.datei, d.dateiname);
  return f;
}

/**
 * Lädt hoch, was liegt. Hält beim ersten Netzfehler an (später erneut).
 * Eine fachliche Ablehnung wird am Eintrag vermerkt, nicht verworfen.
 *
 * `ergaenzen` darf Felder nachliefern, die offline nicht zu haben waren —
 * etwa der Mitarbeiterdatensatz, der eine Serverabfrage braucht.
 */
export async function dateienNachspielen(
  ergaenzen: (d: GepufferteDatei) => Promise<Record<string, string>> = async () => ({}),
): Promise<number> {
  if (laeuft) return 0;
  laeuft = true;
  try {
    // Zwei offene Fenster teilen sich denselben Speicher. Ohne Sperre
    // laden beide dasselbe Foto hoch — so gesehen im ersten Test. Die
    // Web-Locks-Sperre gilt über alle Fenster; wer sie bekommt, liest den
    // Speicher frisch und findet, was das andere schon erledigt hat, nicht
    // mehr vor.
    const sperre = (globalThis.navigator as Navigator | undefined)?.locks;
    return sperre
      ? await sperre.request("werkboq-dateipuffer", () => nachspielenOhneSperre(ergaenzen))
      : await nachspielenOhneSperre(ergaenzen);
  } finally {
    laeuft = false;
    await melden();
  }
}

async function nachspielenOhneSperre(
  ergaenzen: (d: GepufferteDatei) => Promise<Record<string, string>>,
): Promise<number> {
  let hochgeladen = 0;
  for (const d of await gepufferteDateien((x) => !x.fehler)) {
    try {
      const zusatz = await ergaenzen(d).catch(() => ({}));
      // lokaleId: der Server hat darauf einen eindeutigen Index. Kam das
      // Foto schon einmal an (Absturz zwischen Hochladen und Aufräumen),
      // lehnt er die zweite Kopie ab — siehe unten.
      await pb().collection(d.collection).create(formularAus(d, { lokaleId: d.id, ...zusatz }));
    } catch (e) {
      if (istNetzfehler(e)) break;
      if (!(await schonDa(d))) {
        const grund = (e as { message?: string })?.message ?? String(e);
        await mitStore("readwrite", (s) => s.put({ ...d, fehler: grund }));
        continue;
      }
    }
    await mitStore("readwrite", (s) => s.delete(d.id));
    hochgeladen += 1;
    if (d.protokoll) {
      await protokollieren(
        d.protokoll.bereich,
        d.protokoll.datensatz,
        "anlegen",
        `${d.protokoll.text} (ohne Netz aufgenommen am ${new Date(d.angelegt).toLocaleString("de-AT")}, nachgereicht)`,
      );
    }
  }
  return hochgeladen;
}

/** Liegt ein Datensatz mit dieser lokalen Kennung schon auf dem Server? */
async function schonDa(d: GepufferteDatei): Promise<boolean> {
  try {
    await pb().collection(d.collection).getFirstListItem(`lokaleId = "${d.id.replace(/"/g, "")}"`);
    return true;
  } catch {
    return false;
  }
}
