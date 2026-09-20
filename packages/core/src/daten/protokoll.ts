import { pb } from "./client";
import { aktuellerBenutzer } from "../benutzer/rechte";

/**
 * Änderungsverlauf.
 *
 * Jeder Schreibvorgang hinterlässt eine Zeile: wer, wann, was. Die Collection
 * ist gegen Ändern und Löschen gesperrt — ein Verlauf, den man nachträglich
 * frisieren kann, ist als Nachweis wertlos.
 *
 * Bewusst nicht in schreiben() eingebaut: nicht jeder Schreibvorgang gehört
 * protokolliert (ein Foto-Upload etwa nicht), und die Zusammenfassung soll
 * fachlich lesbar sein statt ein Feld-Abgleich. Die Repositories rufen das
 * hier also selbst auf.
 *
 * Fehler beim Protokollieren dürfen den eigentlichen Vorgang nie scheitern
 * lassen — ein fehlender Verlaufseintrag ist ärgerlich, ein verlorener
 * Auftrag wäre schlimmer.
 */

export interface Protokollzeile {
  id: string;
  created: string;
  bereich: string;
  datensatz: string;
  aktion: "anlegen" | "aendern" | "loeschen";
  zusammenfassung: string;
  benutzername?: string;
}

export async function protokollieren(
  bereich: string,
  datensatz: string,
  aktion: Protokollzeile["aktion"],
  zusammenfassung: string,
): Promise<void> {
  try {
    const b = aktuellerBenutzer();
    await pb().collection("protokoll").create({
      bereich,
      datensatz,
      aktion,
      zusammenfassung,
      benutzer: b?.id,
      benutzername: b?.name || b?.email || "unbekannt",
    });
  } catch (e) {
    console.warn("Verlaufseintrag nicht geschrieben", e);
  }
}

/** Verlauf zu einem Datensatz, neueste zuerst. */
export async function verlauf(datensatz: string, grenze = 100): Promise<Protokollzeile[]> {
  const ergebnis = await pb()
    .collection("protokoll")
    .getList<Protokollzeile>(1, grenze, {
      filter: `datensatz = "${datensatz.replace(/["\\]/g, "")}"`,
      sort: "-created",
    });
  return ergebnis.items;
}

/**
 * Beschreibt in einem Satz, was sich geändert hat.
 * Vergleicht nur Felder, die in `neu` vorkommen — weggelassene bleiben unberührt.
 */
export function unterschiede(
  alt: Record<string, unknown>,
  neu: Record<string, unknown>,
  beschriftung: Record<string, string> = {},
): string {
  const geaendert: string[] = [];
  for (const [feld, wert] of Object.entries(neu)) {
    const vorher = alt[feld];
    if (String(vorher ?? "") === String(wert ?? "")) continue;
    geaendert.push(beschriftung[feld] ?? feld);
  }
  if (geaendert.length === 0) return "ohne inhaltliche Änderung gespeichert";
  if (geaendert.length <= 4) return `geändert: ${geaendert.join(", ")}`;
  return `geändert: ${geaendert.slice(0, 4).join(", ")} und ${geaendert.length - 4} weitere`;
}
