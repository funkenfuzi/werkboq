import { pb } from "./client";
import { protokollieren } from "./protokoll";
import { sicher } from "../werkzeug/zeitrechnung";
import { eigenerMitarbeiter } from "./mitarbeiter";
import { dateiNachreicherSetzen } from "./offline";
import { dateienNachspielen, dateiPuffern, gepufferteDateien, istNetzfehler, type GepufferteDatei } from "./dateipuffer";
import { FOTOARTEN, type Dokument, type Foto, type Fotoart } from "./typen";

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
export type { Dokument, Foto, Fotoart };
export { FOTOARTEN };

export const FOTOART_TEXT: Record<Fotoart, string> = {
  vorab: "Vorab vom Kunden",
  vorher: "Vor der Arbeit",
  nachher: "Nach der Arbeit",
  schaden: "Schaden",
  sonstiges: "Sonstiges",
};

export const FOTOART_HINWEIS: Record<Fotoart, string> = {
  vorab: "Was der Kunde mit der Anfrage geschickt hat",
  vorher: "Der vorgefundene Zustand, bevor angefangen wurde",
  nachher: "Das Ergebnis — und was hinter Putz und Verkleidung verschwindet",
  schaden: "Beschädigung, die festgehalten gehört",
  sonstiges: "Alles Übrige",
};

export const FOTOART_FARBE: Record<Fotoart, string> = {
  vorab: "info",
  vorher: "warn",
  nachher: "ok",
  schaden: "fehler",
  sonstiges: "neutral",
};

/** In dieser Reihenfolge wird die Galerie gegliedert. */
export const FOTOART_REIHENFOLGE: Fotoart[] = [
  "vorab",
  "vorher",
  "nachher",
  "schaden",
  "sonstiges",
];

/** Die Art eines Fotos, mit der Voreinstellung für alte Datensätze. */
export function fotoartVon(f: Pick<Foto, "art">): Fotoart {
  return f.art && (FOTOARTEN as readonly string[]).includes(f.art) ? f.art : "sonstiges";
}

/** Fotos nach Art gruppiert, leere Gruppen fallen weg. */
export function nachArt(fotos: Foto[]): { art: Fotoart; fotos: Foto[] }[] {
  return FOTOART_REIHENFOLGE.map((art) => ({
    art,
    fotos: fotos.filter((f) => fotoartVon(f) === art),
  })).filter((g) => g.fotos.length > 0);
}

/**
 * Fehlt etwas an der Dokumentation?
 *
 * Kein Zwang, nur ein Hinweis. Ein Monteur, den die Software am Abschließen
 * hindert, macht irgendein Foto, damit die Meldung verschwindet — und dann
 * ist die Kontrolle nicht nur nutzlos, sondern schädlich, weil sie ein
 * Häkchen erzeugt, dem man nicht trauen kann.
 */
export function dokumentationsluecken(fotos: Foto[]): string[] {
  const hat = (a: Fotoart) => fotos.some((f) => fotoartVon(f) === a);
  const fehlt: string[] = [];
  if (!hat("vorher")) fehlt.push("Kein Bild vom Zustand vor der Arbeit.");
  if (!hat("nachher")) fehlt.push("Kein Bild vom Ergebnis.");
  return fehlt;
}

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
      sort: "aufgenommen,created",
    });
}

/**
 * Lädt ein Foto hoch — oder puffert es, wenn kein Netz da ist.
 *
 * Gibt den gespeicherten Datensatz zurück, oder `{ gepuffert }`, wenn das
 * Foto erst im Zwischenspeicher liegt. Der Fotoblock zeigt es dann mit dem
 * Vermerk „noch nicht auf dem Server" — siehe ./dateipuffer.ts, warum das
 * sichtbar sein muss.
 */
export async function fotoHochladen(
  auftragId: string,
  datei: File,
  art: Fotoart = "sonstiges",
  beschreibung = "",
  aufgenommen = heute(),
): Promise<Foto | { gepuffert: GepufferteDatei }> {
  const felder: Record<string, string> = { auftrag: auftragId, art, beschreibung, aufgenommen };
  const text = `${FOTOART_TEXT[art]}: Foto abgelegt${beschreibung ? ` — ${beschreibung}` : ""}`;

  // Wer das Bild gemacht hat, gehört dazu — für die Beweiskraft so wichtig
  // wie das Bild. Fehlt die Verknüpfung, bleibt das Feld leer statt zu
  // scheitern: ein Bürozugang ohne Mitarbeiterdatensatz darf Fotos ablegen.
  // Ohne Netz wird der Mitarbeiter beim Nachreichen ergänzt.
  const ich = await eigenerMitarbeiter().catch(() => null);
  if (ich) felder.mitarbeiter = ich.id;

  const formular = new FormData();
  for (const [k, v] of Object.entries(felder)) formular.append(k, v);
  formular.append("datei", datei);

  try {
    const neu = await pb().collection("fotos").create<Foto>(formular);
    await protokollieren("auftraege", auftragId, "anlegen", text);
    return neu;
  } catch (e) {
    if (!istNetzfehler(e)) throw e;
    const gepuffert = await dateiPuffern({
      collection: "fotos",
      felder,
      dateifeld: "datei",
      datei,
      dateiname: datei.name || `foto-${Date.now()}.jpg`,
      protokoll: { bereich: "auftraege", datensatz: auftragId, text },
    });
    return { gepuffert };
  }
}

/** Fotos, die für diesen Auftrag noch im Zwischenspeicher liegen. */
export async function gepufferteFotos(auftragId: string): Promise<GepufferteDatei[]> {
  return await gepufferteDateien((d) => d.collection === "fotos" && d.felder.auftrag === auftragId).catch(() => []);
}

// Beim Wiederverbinden mit nachreichen — offline.ts ruft das auf.
dateiNachreicherSetzen(() => fotosNachreichen());

/** Gepufferte Dateien hochladen; fehlende Mitarbeiterangabe wird ergänzt. */
export async function fotosNachreichen(): Promise<number> {
  return await dateienNachspielen(async (d): Promise<Record<string, string>> => {
    if (d.collection !== "fotos" || d.felder.mitarbeiter) return {};
    const ich = await eigenerMitarbeiter().catch(() => null);
    return ich ? { mitarbeiter: ich.id } : {};
  });
}

/** Die Einordnung nachträglich ändern. */
export async function fotoEinordnen(f: Foto, art: Fotoart): Promise<void> {
  await pb().collection("fotos").update(f.id, { art });
  await protokollieren("auftraege", f.auftrag, "aendern", `Foto eingeordnet als ${FOTOART_TEXT[art]}`);
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
