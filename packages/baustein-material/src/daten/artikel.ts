import {
  pb,
  protokollieren,
  schreiben,
  sicher,
  type Basisdatensatz,
  type UstSatz,
} from "@werkboq/core";

/**
 * Leistungs- und Materialkatalog.
 *
 * Der Katalog ist eine Bequemlichkeit, keine Pflicht: jede Position lässt
 * sich frei eintippen. Wer denselben Kabeltyp aber dreimal pro Woche
 * verrechnet, will ihn einmal anlegen und dann auswählen — und beim
 * Preiswechsel eine Stelle ändern statt dreißig.
 *
 * Preise stehen als Netto in Cent. Der Einkaufspreis bleibt im Haus; er
 * dient der Deckungsbeitragsrechnung und steht auf keinem Kundenbeleg.
 */

export const ARTIKELARTEN = ["leistung", "material", "fremdleistung", "sonstiges"] as const;
export type Artikelart = (typeof ARTIKELARTEN)[number];

export const ARTIKELART_TEXT: Record<Artikelart, string> = {
  leistung: "Leistung",
  material: "Material",
  fremdleistung: "Fremdleistung",
  sonstiges: "Sonstiges",
};

/** Einheiten, die im Elektrohandwerk tatsächlich vorkommen. */
export const EINHEITEN = ["Stk", "m", "lfm", "m²", "kg", "h", "Pauschale", "Satz"] as const;

export interface Artikel extends Basisdatensatz {
  nummer: string;
  bezeichnung: string;
  art: Artikelart;
  einheit: string;
  /** Verkaufspreis netto in Cent. */
  preis: number;
  /** Einkaufspreis netto in Cent. Nur intern. */
  einkauf?: number;
  ustsatz: UstSatz;
  beschreibung?: string;
  aktiv?: boolean;
  /** EAN/GTIN für den Strichcode. Freiwillig. */
  ean?: string;
  /** In der Schnellauswahl auf der Baustelle ganz oben. */
  favorit?: boolean;
}

export type ArtikelEingabe = Omit<Artikel, keyof Basisdatensatz>;

export const LEERER_ARTIKEL: ArtikelEingabe = {
  nummer: "",
  bezeichnung: "",
  art: "material",
  einheit: "Stk",
  preis: 0,
  einkauf: 0,
  ustsatz: 20,
  beschreibung: "",
  aktiv: true,
  ean: "",
  favorit: false,
};

export async function alleArtikel(nurAktive = false): Promise<Artikel[]> {
  return await pb()
    .collection("artikel")
    .getFullList<Artikel>({
      sort: "art,bezeichnung",
      ...(nurAktive ? { filter: "aktiv = true" } : {}),
    });
}

/**
 * Artikel suchen.
 *
 * MEHRERE WÖRTER WERDEN EINZELN GESUCHT UND MÜSSEN ALLE VORKOMMEN.
 * Niemand tippt "NYM-J 3x1,5 mm²" so, wie es im Katalog steht; getippt
 * wird "nym 1,5". Ein einziges `~` über die ganze Eingabe findet das
 * nicht, weil dazwischen "3x" steht — und dann sucht man zweimal, gibt
 * auf und trägt das Material gar nicht ein.
 *
 * Reihenfolge spielt keine Rolle: "1,5 nym" findet dasselbe.
 */
export async function artikelSuchen(text: string, grenze = 50): Promise<Artikel[]> {
  const worte = text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6) // mehr als sechs Wörter ist keine Suche mehr, sondern ein Satz
    .map((w) => sicher(w));

  const bedingung = worte.length
    ? worte
        .map((w) => `(bezeichnung ~ "${w}" || nummer ~ "${w}" || ean ~ "${w}")`)
        .join(" && ")
    : "";

  return await pb()
    .collection("artikel")
    .getList<Artikel>(1, grenze, {
      filter: bedingung ? `aktiv = true && ${bedingung}` : "aktiv = true",
      sort: "bezeichnung",
    })
    .then((l) => l.items);
}

export async function artikelAnlegen(eingabe: ArtikelEingabe): Promise<Artikel | undefined> {
  const ergebnis = await schreiben({
    art: "anlegen",
    collection: "artikel",
    daten: aufbereiten(eingabe),
    lokaleId: `art-${Date.now()}`,
  });
  if (ergebnis.status !== "sofort") return undefined;
  const neu = ergebnis.datensatz as unknown as Artikel;
  await protokollieren("artikel", neu.id, "anlegen", `Artikel ${eingabe.bezeichnung} angelegt`);
  return neu;
}

export async function artikelAendern(id: string, eingabe: ArtikelEingabe): Promise<void> {
  await schreiben({ art: "aendern", collection: "artikel", id, daten: aufbereiten(eingabe) });
  await protokollieren("artikel", id, "aendern", `Artikel ${eingabe.bezeichnung} geändert`);
}

/**
 * Artikel werden stillgelegt, nicht gelöscht: an ihnen hängen Positionen
 * alter Aufträge, und eine Rechnung von vorletztem Jahr soll nicht ins
 * Leere zeigen.
 */
export async function artikelStilllegen(a: Artikel): Promise<void> {
  await schreiben({ art: "aendern", collection: "artikel", id: a.id, daten: { aktiv: false } });
  await protokollieren("artikel", a.id, "aendern", `${a.bezeichnung} stillgelegt`);
}

/**
 * Artikel in die Schnellauswahl der Baustelle nehmen oder herausnehmen.
 *
 * Betriebsweit: was hier steht, sehen alle. Eine Liste, die jeder für sich
 * pflegen müsste, pflegt niemand.
 */
export async function favoritSetzen(a: Artikel, ja: boolean): Promise<void> {
  await schreiben({ art: "aendern", collection: "artikel", id: a.id, daten: { favorit: ja } });
  await protokollieren(
    "artikel",
    a.id,
    "aendern",
    ja ? `${a.bezeichnung} in die Schnellauswahl genommen` : `${a.bezeichnung} aus der Schnellauswahl genommen`,
  );
}

/** Nächste freie Artikelnummer in der gewählten Art, etwa "M-0042". */
export async function naechsteArtikelnummer(art: Artikelart): Promise<string> {
  const praefix = { leistung: "L", material: "M", fremdleistung: "F", sonstiges: "S" }[art];
  const liste = await pb()
    .collection("artikel")
    .getList<Artikel>(1, 1, { filter: `nummer ~ "${praefix}-"`, sort: "-nummer" })
    .catch(() => null);
  const letzte = liste?.items[0]?.nummer ?? "";
  const zahl = Number(letzte.split("-")[1] ?? 0);
  return `${praefix}-${String((Number.isFinite(zahl) ? zahl : 0) + 1).padStart(4, "0")}`;
}

function aufbereiten(eingabe: ArtikelEingabe): Record<string, unknown> {
  const daten: Record<string, unknown> = {};
  for (const [schluessel, wert] of Object.entries(eingabe)) {
    daten[schluessel] = typeof wert === "string" ? wert.trim() : wert;
  }
  return daten;
}
