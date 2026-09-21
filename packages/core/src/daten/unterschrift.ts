import { pb } from "./client";
import { protokollieren } from "./protokoll";
import { sicher } from "../werkzeug/zeitrechnung";
import { eigenerMitarbeiter } from "./mitarbeiter";
import { heute } from "./baustelle";
import type { Betrieb } from "./betrieb";
import type { Basisdatensatz } from "./typen";

/**
 * Die Unterschrift des Kunden, am Tablet auf der Baustelle.
 *
 * EINE UNTERSCHRIFT OHNE IHREN TEXT IST WERTLOS.
 *
 * Im Streit zählt nicht der Strich, sondern wozu er gesetzt wurde. Deshalb
 * wird der volle Wortlaut der Erklärung mitgespeichert und eingefroren —
 * nicht ein Verweis auf eine Vorlage, die sich nächstes Jahr ändert. Wer
 * 2029 fragt, was der Kunde 2026 unterschrieben hat, bekommt den Satz, der
 * damals am Bildschirm stand.
 *
 * Aus demselben Grund ist der Datensatz unveränderlich: die Collection hat
 * keine updateRule, gelöscht werden darf nur von einem Administrator. Eine
 * nachträglich änderbare Unterschrift beweist nichts.
 *
 * WAS SIE IST UND WAS NICHT.
 *
 * Das ist eine einfache elektronische Signatur im Sinne der eIDAS-
 * Verordnung: ein Bild, ein Zeitpunkt, ein Name, ein Text. Sie ist vor
 * Gericht nicht unwirksam — Artikel 25 verbietet ausdrücklich, ihr die
 * Wirkung allein wegen der elektronischen Form abzusprechen —, aber sie
 * hat nicht die Beweiskraft einer qualifizierten Signatur mit Zertifikat.
 * Für einen Abnahmeschein auf der Baustelle ist sie genau das Richtige;
 * für einen Vertrag, der Schriftform verlangt, ist sie es nicht.
 */

export const UNTERSCHRIFT_ZWECKE = [
  "abnahme",
  "stundennachweis",
  "zustand_vorher",
  "uebergabe",
] as const;
export type Unterschriftzweck = (typeof UNTERSCHRIFT_ZWECKE)[number];

export const ZWECK_TEXT: Record<Unterschriftzweck, string> = {
  abnahme: "Abnahme der Leistung",
  stundennachweis: "Stunden- und Materialnachweis",
  zustand_vorher: "Zustand vor Arbeitsbeginn",
  uebergabe: "Übergabe",
};

export const ZWECK_HINWEIS: Record<Unterschriftzweck, string> = {
  abnahme: "Ab hier läuft die Gewährleistungsfrist",
  stundennachweis: "Der klassische Regieschein",
  zustand_vorher: "Schützt vor „das war vorher nicht kaputt“",
  uebergabe: "Schlüssel, Unterlagen, Geräte",
};

/**
 * Der Wortlaut, den der Kunde bestätigt.
 *
 * Bewusst kurz und in normalem Deutsch. Ein Absatz Juristendeutsch auf
 * einem Tablet liest niemand, und eine Zustimmung, die niemand gelesen
 * hat, ist im Zweifel keine. Der Text lässt sich vor dem Unterschreiben
 * ändern — was dann dasteht, wird gespeichert.
 */
export function erklaerungsvorschlag(
  zweck: Unterschriftzweck,
  betrieb: Betrieb | null,
  einzelheiten = "",
): string {
  const firma = betrieb?.name?.trim() || "dem Auftragnehmer";
  const zusatz = einzelheiten.trim() ? ` ${einzelheiten.trim()}` : "";

  switch (zweck) {
    case "abnahme":
      return (
        `Ich habe die von ${firma} erbrachte Leistung geprüft und nehme sie ab.${zusatz} ` +
        `Mir ist bekannt, dass mit der Abnahme die Gewährleistungsfrist beginnt. ` +
        `Mängel, die ich jetzt nicht festhalte, kann ich später nur noch geltend machen, ` +
        `wenn sie zu diesem Zeitpunkt nicht erkennbar waren.`
      );
    case "stundennachweis":
      return (
        `Ich bestätige die auf diesem Auftrag festgehaltenen Arbeitsstunden und das ` +
        `verwendete Material als richtig.${zusatz} Die Bestätigung betrifft den Aufwand, ` +
        `nicht die Abnahme der Leistung.`
      );
    case "zustand_vorher":
      return (
        `Ich bestätige, dass die Fotos den Zustand vor Beginn der Arbeiten zeigen, ` +
        `einschließlich der darauf erkennbaren vorhandenen Schäden.${zusatz}`
      );
    case "uebergabe":
      return `Ich habe die übergebenen Gegenstände und Unterlagen vollständig erhalten.${zusatz}`;
  }
}

export interface Unterschrift extends Basisdatensatz {
  auftrag: string;
  zweck: Unterschriftzweck;
  name: string;
  funktion?: string;
  datum: string;
  ort?: string;
  /** Der Wortlaut, dem zugestimmt wurde — eingefroren. */
  erklaerung: string;
  bild: string;
  mitarbeiter?: string;
  /** Vorbehalte oder festgehaltene Mängel. Gehört zur Abnahme dazu. */
  vorbehalt?: string;
}

export async function unterschriftenZuAuftrag(auftragId: string): Promise<Unterschrift[]> {
  return await pb()
    .collection("unterschriften")
    .getFullList<Unterschrift>({ filter: `auftrag = "${sicher(auftragId)}"`, sort: "datum,created" });
}

/**
 * Hält die Unterschrift fest.
 *
 * Ab hier ist der Datensatz unveränderlich — die Collection lässt kein
 * Ändern zu. Deshalb wird alles, was dazugehört, in einem Zug geschrieben:
 * Bild, Name, Erklärung, Vorbehalt, Zeitpunkt.
 */
export async function unterschreiben(
  auftragId: string,
  eingabe: {
    zweck: Unterschriftzweck;
    name: string;
    funktion?: string;
    ort?: string;
    erklaerung: string;
    vorbehalt?: string;
  },
  bild: Blob,
): Promise<Unterschrift> {
  const formular = new FormData();
  formular.append("auftrag", auftragId);
  formular.append("zweck", eingabe.zweck);
  formular.append("name", eingabe.name.trim());
  formular.append("datum", heute());
  formular.append("erklaerung", eingabe.erklaerung);
  if (eingabe.funktion) formular.append("funktion", eingabe.funktion.trim());
  if (eingabe.ort) formular.append("ort", eingabe.ort.trim());
  if (eingabe.vorbehalt) formular.append("vorbehalt", eingabe.vorbehalt.trim());
  formular.append("bild", bild, "unterschrift.png");

  const ich = await eigenerMitarbeiter().catch(() => null);
  if (ich) formular.append("mitarbeiter", ich.id);

  const neu = await pb().collection("unterschriften").create<Unterschrift>(formular);
  await protokollieren(
    "auftraege",
    auftragId,
    "anlegen",
    `${ZWECK_TEXT[eingabe.zweck]} von ${eingabe.name.trim()} unterschrieben` +
      (eingabe.vorbehalt?.trim() ? " — mit Vorbehalt" : ""),
  );
  return neu;
}

/** Adresse des Unterschriftsbilds. */
export function unterschriftAdresse(u: Unterschrift, vorschau = false): string {
  return pb().files.getUrl(
    u as unknown as Record<string, never>,
    u.bild,
    vorschau ? { thumb: "400x0" } : {},
  );
}

/** Gibt es für diesen Zweck schon eine Unterschrift? */
export function hatUnterschrift(liste: Unterschrift[], zweck: Unterschriftzweck): boolean {
  return liste.some((u) => u.zweck === zweck);
}
