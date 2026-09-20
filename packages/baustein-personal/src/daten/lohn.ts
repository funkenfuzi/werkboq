import { aktuellerRechtsraum, type Mitarbeiter } from "@werkboq/core";
import type { Abwesenheit } from "./abwesenheiten";
import { ART_TEXT, type Abwesenheitsart } from "./abwesenheiten";
import type { Personaldaten } from "./personaldaten";

/**
 * Lohnvorbereitung — nicht Lohnverrechnung.
 *
 * Werkboq rechnet keinen Lohn. Es sagt, wie viele Stunden ein Mitarbeiter in
 * einem Monat gearbeitet hat, wie viele davon über der Normalarbeitszeit
 * lagen und an welchen Tagen er nicht da war. Aus diesen Zahlen macht die
 * Lohnverrechnung einen Lohnzettel — mit Kollektivvertrag, Zuschlagsstufen,
 * Sozialversicherung und allem, was daran hängt.
 *
 * Das ist keine Bescheidenheit, sondern eine Haftungsfrage. Ein falsch
 * gerechneter Zuschlag ist ein Fehler, den der Betrieb nachzahlt und
 * verantwortet. Diese Software liefert die Grundlage und sagt, wie sie
 * zustande kam.
 *
 * ÜBERSTUNDEN SIND HIER EINE ROHZAHL.
 *
 * Gerechnet wird gegen die vereinbarte Wochenarbeitszeit, auf den Monat
 * heruntergebrochen. Ob eine Stunde als Überstunde mit 50 % oder als
 * Mehrarbeit mit 25 % gilt, ob Gleitzeit vereinbart ist, ob ein
 * Durchrechnungszeitraum läuft — das steht im Kollektivvertrag und in der
 * Vereinbarung, nicht in diesem Modul.
 */

export interface Monatsauswertung {
  mitarbeiter: Mitarbeiter;
  jahr: number;
  monat: number;
  /** Gearbeitete Minuten laut Zeiterfassung. */
  minuten: number;
  /** Davon auf Aufträge gebucht und verrechenbar. */
  verrechenbareMinuten: number;
  /** Sollstunden des Monats aus der Wochenarbeitszeit. */
  sollstunden: number;
  iststunden: number;
  /** Differenz Ist minus Soll. Negativ heißt Minusstunden. */
  mehrstunden: number;
  abwesenheitstage: Record<Abwesenheitsart, number>;
  /** Lohnart und Satz aus der Personalakte, falls hinterlegt. */
  lohnart?: string;
  lohn?: number;
}

/**
 * Wie viele Werktage hat dieser Monat?
 * Ohne Feiertage — die kennt Werkboq bewusst nicht, weil sie sich je
 * Bundesland unterscheiden und ein falsch geratener Feiertag die Sollzeit
 * still verfälscht. Wer Feiertage braucht, korrigiert die Sollstunden.
 */
export function werktageImMonat(jahr: number, monat: number): number {
  const letzter = new Date(jahr, monat, 0).getDate();
  let tage = 0;
  for (let t = 1; t <= letzter; t += 1) {
    const wochentag = new Date(jahr, monat - 1, t).getDay();
    if (wochentag !== 0 && wochentag !== 6) tage += 1;
  }
  return tage;
}

/**
 * Sollstunden eines Monats aus der Wochenarbeitszeit.
 * Fünftagewoche unterstellt: die Wochenstunden durch fünf, mal Werktage.
 */
export function sollstunden(wochenstunden: number, jahr: number, monat: number): number {
  if (!wochenstunden || wochenstunden <= 0) return 0;
  return Math.round((wochenstunden / 5) * werktageImMonat(jahr, monat) * 100) / 100;
}

/**
 * Baut die Auswertung eines Monats zusammen.
 *
 * Die Stunden kommen von außen — aus dem Dienst `tagesstunden`, den die
 * Zeiterfassung anbietet. Ist sie nicht gekauft, bleiben sie null und die
 * Auswertung zeigt nur Abwesenheiten. Das ist ehrlicher als eine erfundene
 * Zahl und genau der Punkt, an dem man sieht, was ein Baustein wert ist.
 */
export function monatsauswertung(
  mitarbeiter: Mitarbeiter,
  jahr: number,
  monat: number,
  minuten: number,
  verrechenbareMinuten: number,
  abwesenheiten: Pick<Abwesenheit, "art" | "status" | "tage" | "von">[],
  daten?: Personaldaten | null,
): Monatsauswertung {
  const soll = sollstunden(mitarbeiter.wochenstunden ?? 0, jahr, monat);
  const ist = Math.round((minuten / 60) * 100) / 100;

  const tage = {} as Record<Abwesenheitsart, number>;
  for (const a of abwesenheiten) {
    if (a.status !== "genehmigt") continue;
    const d = new Date(`${a.von.slice(0, 10)}T00:00:00`);
    if (d.getFullYear() !== jahr || d.getMonth() + 1 !== monat) continue;
    tage[a.art] = (tage[a.art] ?? 0) + (a.tage ?? 0);
  }

  return {
    mitarbeiter,
    jahr,
    monat,
    minuten,
    verrechenbareMinuten,
    sollstunden: soll,
    iststunden: ist,
    mehrstunden: Math.round((ist - soll) * 100) / 100,
    abwesenheitstage: tage,
    lohnart: daten?.lohnart,
    lohn: daten?.lohn,
  };
}

export const MONATSNAMEN = [
  "Jänner",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

/** In der Schweiz und in Deutschland heißt der erste Monat Januar. */
export function monatsname(monat: number, land = aktuellerRechtsraum().id): string {
  const name = MONATSNAMEN[monat - 1] ?? "";
  return land === "at" ? name : name.replace("Jänner", "Januar");
}

/**
 * CSV für die Lohnverrechnung.
 *
 * Semikolon als Trennzeichen und Komma als Dezimalzeichen, weil das jedes
 * Excel im deutschsprachigen Raum ohne Rückfrage richtig öffnet — ein
 * Punkt-getrenntes CSV landet dort als Text in einer einzigen Spalte. Mit
 * BOM, sonst zeigt Excel aus Umlauten Buchstabensalat.
 */
export function alsCsv(zeilen: Monatsauswertung[]): string {
  const kopf = [
    "Mitarbeiter",
    "Kurzzeichen",
    "Jahr",
    "Monat",
    "Sollstunden",
    "Iststunden",
    "Mehrstunden",
    "davon verrechenbar",
    "Urlaubstage",
    "Krankenstandstage",
    "Zeitausgleichstage",
    "sonstige Abwesenheit",
  ];

  const zahl = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");
  const feld = (t: string) => (/[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t);

  const sonstige = (a: Record<string, number>) =>
    Object.entries(a)
      .filter(([art]) => !["urlaub", "krankenstand", "zeitausgleich"].includes(art))
      .reduce((s, [, tage]) => s + tage, 0);

  const zeilenText = zeilen.map((z) =>
    [
      feld(z.mitarbeiter.name),
      feld(z.mitarbeiter.kurzzeichen ?? ""),
      String(z.jahr),
      String(z.monat),
      zahl(z.sollstunden),
      zahl(z.iststunden),
      zahl(z.mehrstunden),
      zahl(z.verrechenbareMinuten / 60),
      zahl(z.abwesenheitstage.urlaub ?? 0),
      zahl(z.abwesenheitstage.krankenstand ?? 0),
      zahl(z.abwesenheitstage.zeitausgleich ?? 0),
      zahl(sonstige(z.abwesenheitstage)),
    ].join(";"),
  );

  return `﻿${[kopf.join(";"), ...zeilenText].join("\r\n")}\r\n`;
}

/** Lesbare Zusammenfassung der Abwesenheiten einer Zeile. */
export function abwesenheitstext(tage: Record<Abwesenheitsart, number>): string {
  const teile = Object.entries(tage)
    .filter(([, t]) => t > 0)
    .map(([art, t]) => `${String(t).replace(".", ",")} ${ART_TEXT[art as Abwesenheitsart]}`);
  return teile.join(" · ") || "—";
}
