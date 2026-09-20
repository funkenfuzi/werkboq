import { pb } from "./client";
import { protokollieren } from "./protokoll";
import { sicher } from "../werkzeug/zeitrechnung";
import type { Dokument, Foto } from "./typen";

/**
 * Baustellendokumentation: Fotos und Dokumente am Auftrag.
 *
 * DAS IST DER NAMENSGEBENDE TEIL DES PROGRAMMS.
 *
 * Für einen Elektriker ist das Foto der offenen Wand vor dem Verputzen der
 * wertvollste Datensatz überhaupt — es sagt, wo die Leitung liegt. Im
 * Streitfall zählt es mehr als jede Stundenaufzeichnung, und es kostet fünf
 * Sekunden. Genau deshalb muss das Aufnehmen mit einem Griff gehen und darf
 * nicht hinter einem Formular liegen.
 *
 * Fotos und Dokumente sind bewusst getrennt. Ein Foto will man sehen, ein
 * Dokument öffnen; ein Foto entsteht am Handy, ein Dokument kommt per Mail.
 * In einer gemeinsamen Liste wäre beides schlechter.
 *
 * Beides bleibt im Kern und wird kein Baustein: ein Betrieb, der Werkboq
 * kauft und keine Fotos machen kann, hat nicht das gekauft, was auf der
 * Packung steht.
 */

// Die Typen Foto und Dokument stehen seit Scheibe 0 in daten/typen.ts und
// werden hier nur benutzt — zwei Fassungen desselben Datensatzes laufen
// früher oder später auseinander.
export type { Dokument, Foto };

/** Was in einem Elektrobetrieb tatsächlich am Auftrag hängt. */
export const DOKUMENTARTEN_AUFTRAG = [
  "Plan",
  "Datenblatt",
  "Lieferschein",
  "Abnahmeprotokoll",
  "Schriftverkehr",
  "Sonstiges",
] as const;

export function heute(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ------------------------------------------------------------------------
// Fotos
// ------------------------------------------------------------------------

export async function fotosZuAuftrag(auftragId: string): Promise<Foto[]> {
  return await pb()
    .collection("fotos")
    .getFullList<Foto>({
      filter: `auftrag = "${sicher(auftragId)}"`,
      sort: "-aufgenommen,-created",
    });
}

/**
 * Lädt ein Foto hoch.
 *
 * Ohne Offline-Warteschlange: die puffert Felder, keine Dateien. Ein Foto,
 * das im Funkloch scheinbar gespeichert wurde und dann doch nie ankommt,
 * wäre schlimmer als eine ehrliche Fehlermeldung — der Monteur würde die
 * Wand zumachen im Glauben, das Bild sei da.
 */
export async function fotoHochladen(
  auftragId: string,
  datei: File,
  beschreibung = "",
  aufgenommen = heute(),
): Promise<Foto> {
  const formular = new FormData();
  formular.append("auftrag", auftragId);
  formular.append("datei", datei);
  formular.append("beschreibung", beschreibung);
  formular.append("aufgenommen", aufgenommen);

  const neu = await pb().collection("fotos").create<Foto>(formular);
  await protokollieren(
    "auftraege",
    auftragId,
    "anlegen",
    beschreibung ? `Foto abgelegt: ${beschreibung}` : "Foto abgelegt",
  );
  return neu;
}

export async function fotoBeschriften(f: Foto, beschreibung: string): Promise<void> {
  await pb().collection("fotos").update(f.id, { beschreibung });
  await protokollieren("auftraege", f.auftrag, "aendern", `Foto beschriftet: ${beschreibung}`);
}

export async function fotoLoeschen(f: Foto): Promise<void> {
  await pb().collection("fotos").delete(f.id);
  await protokollieren(
    "auftraege",
    f.auftrag,
    "loeschen",
    f.beschreibung ? `Foto gelöscht: ${f.beschreibung}` : "Foto gelöscht",
  );
}

// ------------------------------------------------------------------------
// Dokumente
// ------------------------------------------------------------------------

export async function dokumenteZuAuftrag(auftragId: string): Promise<Dokument[]> {
  return await pb()
    .collection("dokumente")
    .getFullList<Dokument>({ filter: `auftrag = "${sicher(auftragId)}"`, sort: "-created" });
}

export async function dokumentHochladen(
  auftragId: string,
  datei: File,
  titel: string,
  art = "",
  modul = "",
): Promise<Dokument> {
  const formular = new FormData();
  formular.append("auftrag", auftragId);
  formular.append("datei", datei);
  formular.append("titel", titel.trim() || datei.name);
  if (art) formular.append("art", art);
  if (modul) formular.append("modul", modul);

  const neu = await pb().collection("dokumente").create<Dokument>(formular);
  await protokollieren("auftraege", auftragId, "anlegen", `Dokument abgelegt: ${neu.titel}`);
  return neu;
}

export async function dokumentLoeschen(d: Dokument): Promise<void> {
  await pb().collection("dokumente").delete(d.id);
  await protokollieren("auftraege", d.auftrag, "loeschen", `Dokument gelöscht: ${d.titel}`);
}

// ------------------------------------------------------------------------
// Adressen
// ------------------------------------------------------------------------

/** Adresse der Datei. */
export function dateiAdresse(datensatz: Foto | Dokument): string {
  return pb().files.getUrl(datensatz as unknown as Record<string, never>, datensatz.datei);
}

/**
 * Verkleinerte Fassung eines Fotos.
 *
 * PocketBase erzeugt Vorschaubilder auf Zuruf und legt sie ab. Wichtig auf
 * der Baustelle: eine Galerie mit dreißig Handyfotos in Originalgröße sind
 * hundert Megabyte über eine Mobilverbindung, die ohnehin schwach ist.
 */
export function vorschauAdresse(f: Foto, groesse = "400x0"): string {
  return pb().files.getUrl(f as unknown as Record<string, never>, f.datei, { thumb: groesse });
}

/**
 * Dateigröße lesbar. Handyfotos sind zwei bis acht Megabyte; die Zahl steht
 * am Dokument, damit niemand im Funkloch auf ein 40-MB-PDF tippt.
 */
export function alsGroesse(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
