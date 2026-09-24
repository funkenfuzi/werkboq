import { pb } from "./client";
import { protokollieren } from "./protokoll";
import { KERN_COLLECTIONS, type Basisdatensatz, type Kunde, type Standort } from "./typen";

/**
 * Standorte eines Kunden und was an ihnen liegt.
 *
 * Jeder Kunde hat mindestens einen Standort (außer er kauft nur Ware) —
 * den ersten legt der Server beim Anlegen des Kunden an, siehe
 * server/pb_hooks/kunden.pb.js. Unter einem Standort hängt ein Baum aus
 * Gebäuden, Geschoßen, Räumen, Bereichen, Verteilern; die Tiefe ist frei.
 *
 * Geschrieben wird direkt, nicht über die Offline-Warteschlange: ein Raum
 * verweist auf sein Geschoß, und ohne Netz gäbe es dessen Kennung noch
 * nicht. Standorte legt man ohnehin meist im Büro an.
 */

export const STANDORTTEIL_ARTEN = [
  "gebaeude",
  "geschoss",
  "raum",
  "bereich",
  "verteiler",
  "anlage",
  "aussen",
  "sonstiges",
] as const;
export type Standortteilart = (typeof STANDORTTEIL_ARTEN)[number];

export const STANDORTTEIL_TEXT: Record<Standortteilart, string> = {
  gebaeude: "Gebäude",
  geschoss: "Geschoß",
  raum: "Raum",
  bereich: "Bereich",
  verteiler: "Verteiler",
  anlage: "Anlage",
  aussen: "Außenbereich",
  sonstiges: "Sonstiges",
};

/** Was unter einer Art üblicherweise als Nächstes kommt — nur Vorschlag. */
export const NAECHSTE_ART: Record<Standortteilart, Standortteilart> = {
  gebaeude: "geschoss",
  geschoss: "raum",
  raum: "bereich",
  bereich: "bereich",
  verteiler: "anlage",
  anlage: "anlage",
  aussen: "bereich",
  sonstiges: "sonstiges",
};

export interface Standortteil extends Basisdatensatz {
  standort: string;
  eltern?: string;
  art: Standortteilart;
  bezeichnung: string;
  notiz?: string;
  reihenfolge?: number;
}

export interface Teilknoten extends Standortteil {
  kinder: Teilknoten[];
}

export type StandortEingabe = Omit<Standort, keyof Basisdatensatz>;

/** Der erste Standort aus der Anschrift des Kunden — dieselbe Regel wie im Hook. */
export function standortAusKunde(k: Pick<Kunde, "id" | "strasse" | "plz" | "ort" | "land">): StandortEingabe {
  return {
    kunde: k.id,
    bezeichnung: k.strasse?.trim() || k.ort?.trim() || "Hauptstandort",
    strasse: k.strasse ?? "",
    plz: k.plz ?? "",
    ort: k.ort ?? "",
    land: k.land ?? "",
    notiz: "",
  };
}

export function anschriftZeile(s: Pick<Standort, "strasse" | "plz" | "ort">): string {
  return [s.strasse, [s.plz, s.ort].filter(Boolean).join(" ")].filter((x) => x && x.trim()).join(", ");
}

/**
 * Baut aus der flachen Liste den Baum. Geschwister nach `reihenfolge`,
 * dann nach Bezeichnung. Ein Teil, dessen Elternteil fehlt, steht oben —
 * lieber sichtbar an falscher Stelle als verschwunden. Ringe (A unter B
 * unter A) kann die Oberfläche nicht erzeugen, würden hier aber auch nicht
 * endlos laufen: jeder Teil erscheint höchstens einmal.
 */
export function teilbaum(teile: Standortteil[]): Teilknoten[] {
  const knoten = new Map<string, Teilknoten>(teile.map((t) => [t.id, { ...t, kinder: [] }]));
  const wurzeln: Teilknoten[] = [];
  for (const k of knoten.values()) {
    const eltern = k.eltern ? knoten.get(k.eltern) : undefined;
    if (eltern && eltern !== k) eltern.kinder.push(k);
    else wurzeln.push(k);
  }
  const ordnen = (liste: Teilknoten[], gesehen: Set<string>): Teilknoten[] =>
    liste
      .filter((k) => !gesehen.has(k.id) && gesehen.add(k.id))
      .sort(
        (a, b) =>
          (a.reihenfolge ?? 0) - (b.reihenfolge ?? 0) || a.bezeichnung.localeCompare(b.bezeichnung, "de"),
      )
      .map((k) => ({ ...k, kinder: ordnen(k.kinder, gesehen) }));
  const gesehen = new Set<string>();
  const baum = ordnen(wurzeln, gesehen);
  // Was in einem Ring hing, hat keine Wurzel erreicht: oben anhängen.
  const verwaist = [...knoten.values()].filter((k) => !gesehen.has(k.id));
  return [...baum, ...ordnen(verwaist.map((k) => ({ ...k, kinder: [] })), gesehen)];
}

/** Alle Teile unter einem Teil, ohne ihn selbst — für die Rückfrage beim Löschen. */
export function unterteile(baum: Teilknoten[], id: string): number {
  const suchen = (liste: Teilknoten[]): Teilknoten | undefined => {
    for (const k of liste) {
      if (k.id === id) return k;
      const t = suchen(k.kinder);
      if (t) return t;
    }
    return undefined;
  };
  const zaehlen = (k: Teilknoten): number => k.kinder.reduce((n, c) => n + 1 + zaehlen(c), 0);
  const k = suchen(baum);
  return k ? zaehlen(k) : 0;
}

const sicher = (x: string) => x.replace(/["\\]/g, "");

export async function standorteZuKunde(kunde: string): Promise<Standort[]> {
  return await pb()
    .collection(KERN_COLLECTIONS.standorte)
    .getFullList<Standort>({ filter: `kunde = "${sicher(kunde)}"`, sort: "bezeichnung" });
}

export async function standortSpeichern(vorher: Standort | null, e: StandortEingabe): Promise<Standort> {
  const daten = Object.fromEntries(Object.entries(e).map(([k, w]) => [k, typeof w === "string" ? w.trim() : w]));
  if (vorher) {
    const neu = await pb().collection(KERN_COLLECTIONS.standorte).update<Standort>(vorher.id, daten);
    await protokollieren("standorte", e.kunde, "aendern", `Standort ${e.bezeichnung} geändert`);
    return neu;
  }
  const neu = await pb().collection(KERN_COLLECTIONS.standorte).create<Standort>(daten);
  await protokollieren("standorte", e.kunde, "anlegen", `Standort ${e.bezeichnung} angelegt`);
  return neu;
}

export async function standortLoeschen(s: Standort): Promise<void> {
  await pb().collection(KERN_COLLECTIONS.standorte).delete(s.id);
  await protokollieren("standorte", s.kunde, "loeschen", `Standort ${s.bezeichnung} entfernt`);
}

export async function standortteile(standort: string): Promise<Standortteil[]> {
  return await pb()
    .collection(KERN_COLLECTIONS.standortteile)
    .getFullList<Standortteil>({ filter: `standort = "${sicher(standort)}"` });
}

/** Teile mehrerer Standorte auf einmal — für den Reiter mit allen Standorten. */
export async function standortteileZuKunde(kunde: string): Promise<Standortteil[]> {
  return await pb()
    .collection(KERN_COLLECTIONS.standortteile)
    .getFullList<Standortteil>({ filter: `standort.kunde = "${sicher(kunde)}"` });
}

export async function teilSpeichern(
  vorher: Standortteil | null,
  e: Pick<Standortteil, "standort" | "eltern" | "art" | "bezeichnung" | "notiz" | "reihenfolge">,
  kunde: string,
): Promise<Standortteil> {
  const daten = { ...e, bezeichnung: e.bezeichnung.trim(), eltern: e.eltern || "" };
  const text = `${STANDORTTEIL_TEXT[e.art]} ${daten.bezeichnung}`;
  if (vorher) {
    const neu = await pb().collection(KERN_COLLECTIONS.standortteile).update<Standortteil>(vorher.id, daten);
    await protokollieren("standorte", kunde, "aendern", `${text} geändert`);
    return neu;
  }
  const neu = await pb().collection(KERN_COLLECTIONS.standortteile).create<Standortteil>(daten);
  await protokollieren("standorte", kunde, "anlegen", `${text} angelegt`);
  return neu;
}

/** Löscht den Teil samt allem darunter (der Server räumt die Kinder mit ab). */
export async function teilLoeschen(t: Standortteil, kunde: string): Promise<void> {
  await pb().collection(KERN_COLLECTIONS.standortteile).delete(t.id);
  await protokollieren("standorte", kunde, "loeschen", `${STANDORTTEIL_TEXT[t.art]} ${t.bezeichnung} entfernt`);
}
