import {
  eigenerMitarbeiter,
  pb,
  protokollieren,
  schreiben,
  sicher,
  type Basisdatensatz,
} from "@werkboq/core";

/**
 * Fahrten zu einem Auftrag.
 *
 * WARUM IN DER ZEITERFASSUNG und nicht im Fuhrpark: eine Fahrt gehört zum
 * Arbeitstag des Monteurs, genau wie seine Stunden. Ein Betrieb ohne
 * Fuhrpark-Baustein fährt trotzdem zu Kunden. Das Fahrzeug ist deshalb
 * freiwillig und kommt, wenn es den Fuhrpark gibt, über dessen Dienst.
 *
 * WARUM EINE EIGENE LISTE und nicht ein Feld an der Zeitbuchung: eine
 * Fahrt ohne Arbeitszeit gibt es — Material holen, Schlüssel abgeben —,
 * und eine Zeitbuchung ohne Fahrt auch. Zwei Dinge, zwei Zeilen.
 *
 * Gespeichert wird die einfache Strecke und ob hin und retour. So steht
 * in der Liste „2 × 42 km" statt „84 km", und wer nachrechnet, sieht, wie
 * die Zahl zustande kam.
 */

export interface Fahrt extends Basisdatensatz {
  auftrag: string;
  mitarbeiter?: string;
  datum: string;
  /** Einfache Strecke in ganzen Kilometern. */
  kmEinfach: number;
  hinRetour: boolean;
  /** Kennung aus dem Fuhrpark, sofern es ihn gibt. */
  fahrzeug?: string;
  /** Kennzeichen zum Zeitpunkt der Fahrt — lesbar auch ohne Fuhrpark. */
  kennzeichen?: string;
  notiz?: string;
}

export type FahrtEingabe = Omit<Fahrt, keyof Basisdatensatz>;

/** Gefahrene Kilometer einer Fahrt. */
export function kmGesamt(f: Pick<Fahrt, "kmEinfach" | "hinRetour">): number {
  const einfach = Math.max(0, Math.round(f.kmEinfach || 0));
  return f.hinRetour ? einfach * 2 : einfach;
}

/** Summe über mehrere Fahrten. */
export function summeKm(liste: Pick<Fahrt, "kmEinfach" | "hinRetour">[]): number {
  return liste.reduce((s, f) => s + kmGesamt(f), 0);
}

export async function fahrtenZuAuftrag(auftragId: string): Promise<Fahrt[]> {
  return await pb()
    .collection("fahrten")
    .getFullList<Fahrt>({ filter: `auftrag = "${sicher(auftragId)}"`, sort: "-datum,-created" });
}

/**
 * Eine Fahrt festhalten.
 *
 * Ohne Mitarbeiter wird der eigene genommen — der Monteur erfasst seine
 * eigene Fahrt, das Büro trägt für jemanden nach.
 */
export async function fahrtAnlegen(eingabe: FahrtEingabe): Promise<void> {
  if (!eingabe.kmEinfach || eingabe.kmEinfach <= 0) {
    throw new Error("Ohne Kilometer gibt es nichts festzuhalten.");
  }
  const mitarbeiter = eingabe.mitarbeiter || (await eigenerMitarbeiter().catch(() => null))?.id || null;
  await schreiben({
    art: "anlegen",
    collection: "fahrten",
    daten: {
      ...eingabe,
      kmEinfach: Math.round(eingabe.kmEinfach),
      mitarbeiter,
      fahrzeug: eingabe.fahrzeug || "",
      kennzeichen: eingabe.kennzeichen || "",
      notiz: (eingabe.notiz ?? "").trim(),
    },
    lokaleId: `fahrt-${Date.now()}`,
  });
  await protokollieren(
    "auftraege",
    eingabe.auftrag,
    "aendern",
    `Fahrt ${kmGesamt(eingabe)} km${eingabe.kennzeichen ? ` mit ${eingabe.kennzeichen}` : ""} erfasst`,
  );
}

export async function fahrtLoeschen(f: Fahrt): Promise<void> {
  await schreiben({ art: "loeschen", collection: "fahrten", id: f.id });
  await protokollieren("auftraege", f.auftrag, "aendern", `Fahrt ${kmGesamt(f)} km entfernt`);
}
