/**
 * Fristen am Fahrzeug.
 *
 * WARUM DAS EIN EIGENER DATENSATZ IST und kein Feld am Fahrzeug: an einem
 * Kastenwagen hängen fünf bis acht Termine gleichzeitig — Begutachtung,
 * Service, Reifenwechsel, Versicherung, Leasingende, bei Hebebühnen noch
 * die wiederkehrende Prüfung. Als Felder am Fahrzeug wären das zwanzig
 * Spalten, und die neunte Fristart bräuchte eine Schemaänderung.
 *
 * WAS WERKBOQ HIER NICHT TUT: es rechnet keine gesetzliche Frist aus.
 * Wie oft ein Fahrzeug vorzuführen ist, hängt von Klasse, Alter und
 * Nutzung ab, in jedem der drei Länder anders. Eine Frist, die das
 * Programm falsch ausrechnet, ist schlimmer als gar keine — der Betrieb
 * verlässt sich darauf und steht ohne gültige Plakette da. Eingetragen
 * wird das Datum vom Papier; Werkboq erinnert daran und nichts weiter.
 */

export const FRISTARTEN = [
  "begutachtung",
  "service",
  "reifen",
  "versicherung",
  "leasing",
  "pruefung",
  "sonstiges",
] as const;
export type Fristart = (typeof FRISTARTEN)[number];

export const FRISTART_TEXT: Record<Fristart, string> = {
  begutachtung: "Wiederkehrende Begutachtung",
  service: "Service",
  reifen: "Reifenwechsel",
  versicherung: "Versicherung",
  leasing: "Leasing oder Finanzierung",
  pruefung: "Wiederkehrende Prüfung (Hebebühne, Kran)",
  sonstiges: "Sonstiges",
};

/** Übliches Intervall in Monaten — Vorschlag, kein Gesetz. 0 = einmalig. */
export const INTERVALL_VORSCHLAG: Record<Fristart, number> = {
  begutachtung: 12,
  service: 12,
  reifen: 6,
  versicherung: 12,
  leasing: 0,
  pruefung: 12,
  sonstiges: 0,
};

/** Tage vor Ablauf, ab denen erinnert wird. */
export const VORWARNUNG: Record<Fristart, number> = {
  begutachtung: 30,
  service: 14,
  reifen: 21,
  versicherung: 30,
  leasing: 90,
  pruefung: 30,
  sonstiges: 14,
};

export type Fristzustand = "ohne" | "offen" | "faellig" | "abgelaufen";

export const FRIST_TEXT: Record<Fristzustand, string> = {
  ohne: "ohne Frist",
  offen: "in Ordnung",
  faellig: "wird fällig",
  abgelaufen: "überfällig",
};

export const FRIST_FARBE: Record<Fristzustand, string> = {
  ohne: "neutral",
  offen: "ok",
  faellig: "warn",
  abgelaufen: "fehler",
};

export interface Fristeingabe {
  faellig?: string;
  kmFaellig?: number;
  erinnerungTage?: number;
  erledigtAm?: string;
}

export function heute(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Tage von a bis b. Negativ, wenn b vor a liegt. */
export function tageBis(a: string, b: string): number {
  const x = new Date(`${a.slice(0, 10)}T00:00:00`).getTime();
  const y = new Date(`${b.slice(0, 10)}T00:00:00`).getTime();
  return Math.round((y - x) / 86400000);
}

/**
 * In welchem Zustand ist diese Frist?
 *
 * Eine Frist kann an einem Datum hängen, an einem Kilometerstand oder an
 * beidem — ein Service ist fällig „in zwölf Monaten oder nach 30.000 km,
 * je nachdem was zuerst eintritt". Deshalb wird beides geprüft und der
 * schlimmere Zustand gewinnt: wer nach Kilometern überfällig ist, ist
 * überfällig, auch wenn das Datum noch Luft hat.
 */
export function fristzustand(
  f: Fristeingabe,
  stichtag = heute(),
  kmStand?: number,
): Fristzustand {
  if (f.erledigtAm) return "ohne";

  const zustaende: Fristzustand[] = [];

  if (f.faellig) {
    const ab = f.faellig.slice(0, 10);
    if (ab < stichtag) zustaende.push("abgelaufen");
    else {
      const vorwarnung = f.erinnerungTage ?? 0;
      zustaende.push(vorwarnung > 0 && tageBis(stichtag, ab) <= vorwarnung ? "faellig" : "offen");
    }
  }

  if (f.kmFaellig && typeof kmStand === "number") {
    if (kmStand >= f.kmFaellig) zustaende.push("abgelaufen");
    // Tausend Kilometer vorher anklopfen — das ist etwa eine Woche
    // Baustellenfahrten und reicht, um einen Werkstatttermin zu bekommen.
    else zustaende.push(f.kmFaellig - kmStand <= 1000 ? "faellig" : "offen");
  }

  if (!zustaende.length) return "ohne";
  const rang: Fristzustand[] = ["abgelaufen", "faellig", "offen", "ohne"];
  return rang.find((z) => zustaende.includes(z))!;
}

/**
 * Das nächste Fälligkeitsdatum nach dem Erledigen.
 *
 * GERECHNET WIRD VOM FÄLLIGKEITSDATUM, NICHT VOM TAG DER ERLEDIGUNG.
 * Sonst wandert der Termin jedes Jahr nach hinten weg: wer immer zwei
 * Wochen vorher zum Service fährt, hätte nach fünf Jahren um zehn Wochen
 * verschobene Intervalle — und beim Pickerl verliert er dadurch Zeit, die
 * ihm zusteht. Wer das nicht will, kann das vorgeschlagene Datum in der
 * Maske überschreiben.
 *
 * Monatsenden werden gekappt: der 31. Jänner plus einen Monat ist der
 * 28. Februar, nicht der 3. März.
 */
export function naechsteFaelligkeit(faellig: string, intervallMonate: number): string {
  if (!faellig || intervallMonate <= 0) return "";
  const [jahr, monat, tag] = faellig.slice(0, 10).split("-").map(Number) as [number, number, number];

  const gesamt = (monat - 1) + intervallMonate;
  const neuesJahr = jahr + Math.floor(gesamt / 12);
  const neuerMonat = (gesamt % 12) + 1;

  // Wie viele Tage hat der Zielmonat? Tag 0 des Folgemonats ist dessen
  // letzter Tag — Date rechnet das selbst aus, inklusive Schaltjahr.
  const letzter = new Date(Date.UTC(neuesJahr, neuerMonat, 0)).getUTCDate();
  const neuerTag = Math.min(tag, letzter);

  return `${neuesJahr}-${String(neuerMonat).padStart(2, "0")}-${String(neuerTag).padStart(2, "0")}`;
}

/** Der nächste Kilometerstand, bei dem es wieder soweit ist. */
export function naechsterKm(kmFaellig: number | undefined, intervallKm: number | undefined): number {
  if (!kmFaellig || !intervallKm || intervallKm <= 0) return 0;
  return kmFaellig + intervallKm;
}

/**
 * Was Aufmerksamkeit braucht — Überfälliges zuerst, dann das Dringendste.
 *
 * Nach Datum sortiert stünde das Älteste oben; hier soll oben stehen, was
 * brennt.
 */
export function nachDringlichkeit<T extends Fristeingabe>(
  fristen: T[],
  stichtag = heute(),
  kmStand?: number,
): { frist: T; zustand: Fristzustand; tage: number }[] {
  const rang: Record<Fristzustand, number> = { abgelaufen: 0, faellig: 1, offen: 2, ohne: 3 };
  return fristen
    .map((frist) => ({
      frist,
      zustand: fristzustand(frist, stichtag, kmStand),
      tage: frist.faellig ? tageBis(stichtag, frist.faellig) : Number.POSITIVE_INFINITY,
    }))
    .sort((a, b) => rang[a.zustand] - rang[b.zustand] || a.tage - b.tage);
}

/** Der schlimmste Zustand einer Fahrzeugliste — für die Ampel in der Übersicht. */
export function schlimmster(
  fristen: Fristeingabe[],
  stichtag = heute(),
  kmStand?: number,
): Fristzustand {
  const rang: Fristzustand[] = ["abgelaufen", "faellig", "offen", "ohne"];
  const alle = fristen.map((f) => fristzustand(f, stichtag, kmStand));
  return rang.find((z) => alle.includes(z)) ?? "ohne";
}

/**
 * Der Satz, der neben einer Frist steht: wann oder ab wie vielen
 * Kilometern.
 *
 * WICHTIG IST DER FALL, IN DEM BEIDES NICHT ZUSAMMENPASST. Ein Service
 * kann nach Kilometern überfällig und nach Datum noch lange hin sein.
 * Stünde dann „in 190 Tagen" neben „überfällig", widerspricht sich die
 * Zeile selbst — und wer das einmal liest, glaubt der Ampel nicht mehr.
 */
export function faelligkeitstext(
  f: Fristeingabe,
  zustand: Fristzustand,
  stichtag = heute(),
  kmStand?: number,
): string {
  const ueberKm =
    f.kmFaellig && typeof kmStand === "number" && kmStand >= f.kmFaellig;
  const kmNah =
    f.kmFaellig && typeof kmStand === "number" && f.kmFaellig - kmStand <= 1000 && !ueberKm;

  if (ueberKm) {
    return `${(kmStand! - f.kmFaellig!).toLocaleString("de-AT")} km über ${f.kmFaellig!.toLocaleString("de-AT")}`;
  }
  if (kmNah && zustand === "faellig") {
    return `noch ${(f.kmFaellig! - kmStand!).toLocaleString("de-AT")} km`;
  }
  if (f.faellig) {
    const tage = tageBis(stichtag, f.faellig);
    return tage < 0 ? `${Math.abs(tage)} Tage überfällig` : `in ${tage} Tagen`;
  }
  if (f.kmFaellig) return `ab ${f.kmFaellig.toLocaleString("de-AT")} km`;
  return "—";
}

/**
 * Fristen mehrerer Fahrzeuge sortieren — jede mit dem Kilometerstand
 * IHRES Fahrzeugs.
 *
 * `nachDringlichkeit` nimmt einen Kilometerstand für die ganze Liste; das
 * stimmt in der Fahrzeugakte, aber nicht in einer Übersicht über alle
 * Fahrzeuge. Dort muss je Zeile nachgeschlagen werden, und sortiert wird
 * nach Zustand zuerst: sonst steht „wird fällig in 18 Tagen" über
 * „überfällig", weil letzteres nach Datum noch Luft hat.
 */
export function ueberFahrzeuge<T extends Fristeingabe & { fahrzeug: string }>(
  fristen: T[],
  kmJeFahrzeug: Map<string, number | undefined>,
  stichtag = heute(),
): { frist: T; zustand: Fristzustand; tage: number }[] {
  const rang: Record<Fristzustand, number> = { abgelaufen: 0, faellig: 1, offen: 2, ohne: 3 };
  return fristen
    .map((frist) => ({
      frist,
      zustand: fristzustand(frist, stichtag, kmJeFahrzeug.get(frist.fahrzeug)),
      tage: frist.faellig ? tageBis(stichtag, frist.faellig) : Number.POSITIVE_INFINITY,
    }))
    .sort((a, b) => rang[a.zustand] - rang[b.zustand] || a.tage - b.tage);
}
