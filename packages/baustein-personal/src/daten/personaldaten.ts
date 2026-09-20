import { pb, protokollieren, sicher, type Basisdatensatz } from "@werkboq/core";

/**
 * Die Personalakte — eine Zeile je Mitarbeiter.
 *
 * Bewusst eine eigene Collection und nicht ein paar Felder mehr am
 * Mitarbeiter. Der Mitarbeiterdatensatz wird überall gelesen: die Planung
 * braucht den Namen, der Auftrag die Farbe, die Zeiterfassung das
 * Kurzzeichen. Stünde die Sozialversicherungsnummer daneben, käme sie bei
 * jedem dieser Zugriffe mit — PocketBase kennt keine Regeln je Feld.
 *
 * Getrennte Tabelle, getrennte Regel: lesen darf das Personalwesen und der
 * Betroffene selbst. Letzteres ist kein Entgegenkommen, sondern sein
 * Auskunftsrecht.
 */

export const BESCHAEFTIGUNGSARTEN = [
  "vollzeit",
  "teilzeit",
  "geringfuegig",
  "lehre",
  "ferialarbeit",
  "leihpersonal",
] as const;
export type Beschaeftigungsart = (typeof BESCHAEFTIGUNGSARTEN)[number];

export const BESCHAEFTIGUNG_TEXT: Record<Beschaeftigungsart, string> = {
  vollzeit: "Vollzeit",
  teilzeit: "Teilzeit",
  geringfuegig: "Geringfügig",
  lehre: "Lehrverhältnis",
  ferialarbeit: "Ferialarbeit",
  leihpersonal: "Überlassene Arbeitskraft",
};

export type Lohnart = "monat" | "stunde";

export const LOHNART_TEXT: Record<Lohnart, string> = {
  monat: "Monatslohn brutto",
  stunde: "Stundenlohn brutto",
};

export interface Personaldaten extends Basisdatensatz {
  mitarbeiter: string;
  geburtsdatum?: string;
  geburtsort?: string;
  svnr?: string;
  staatsbuergerschaft?: string;
  anschrift?: string;
  plz?: string;
  ort?: string;
  iban?: string;
  notfallkontakt?: string;
  notfalltelefon?: string;
  eintritt?: string;
  austritt?: string;
  austrittsgrund?: string;
  beschaeftigung?: Beschaeftigungsart;
  kollektivvertrag?: string;
  verwendungsgruppe?: string;
  lohnart?: Lohnart;
  /** Lohn in Cent — wie jeder Geldbetrag in Werkboq ganzzahlig. */
  lohn?: number;
  urlaubsanspruch?: number;
  /** Resturlaub aus dem Vorjahr, kann auch negativ sein. */
  urlaubUebertrag?: number;
  notizen?: string;
}

export type PersonaldatenEingabe = Omit<Personaldaten, keyof Basisdatensatz>;

/**
 * 25 Werktage entsprechen fünf Wochen — dem gesetzlichen Mindesturlaub in
 * Österreich bei Fünftagewoche. Ab 25 Dienstjahren sind es sechs Wochen; das
 * rechnet Werkboq nicht automatisch, weil die Anrechnung von Vordienstzeiten
 * davon abhängt, was im Vertrag steht.
 */
export const LEERE_PERSONALDATEN: Omit<PersonaldatenEingabe, "mitarbeiter"> = {
  geburtsdatum: "",
  geburtsort: "",
  svnr: "",
  staatsbuergerschaft: "",
  anschrift: "",
  plz: "",
  ort: "",
  iban: "",
  notfallkontakt: "",
  notfalltelefon: "",
  eintritt: "",
  austritt: "",
  austrittsgrund: "",
  beschaeftigung: "vollzeit",
  kollektivvertrag: "",
  verwendungsgruppe: "",
  lohnart: "monat",
  lohn: 0,
  urlaubsanspruch: 25,
  urlaubUebertrag: 0,
  notizen: "",
};

/**
 * Prüft eine österreichische Sozialversicherungsnummer auf ihre Prüfziffer.
 *
 * Zehn Stellen: drei laufende, eine Prüfziffer, sechs Ziffern Geburtsdatum.
 * Die Prüfziffer ergibt sich aus einer gewichteten Summe modulo 11. Das
 * findet Tippfehler, nicht erfundene Nummern — mehr kann eine Software nicht,
 * und mehr soll sie hier auch nicht behaupten.
 *
 * Leere Eingabe gilt als in Ordnung: nicht jeder Datensatz ist am ersten Tag
 * vollständig, und ein Formular, das Unfertiges verweigert, wird umgangen.
 */
export function svnrPlausibel(svnr: string): boolean {
  const ziffern = svnr.replace(/\s/g, "");
  if (ziffern === "") return true;
  if (!/^\d{10}$/.test(ziffern)) return false;

  const gewichte = [3, 7, 9, 0, 5, 8, 4, 2, 1, 6];
  let summe = 0;
  for (let i = 0; i < 10; i += 1) summe += Number(ziffern[i]) * (gewichte[i] ?? 0);
  // Ergibt der Rest 10, wurde die Nummer nie vergeben — sie kann nicht stimmen.
  return summe % 11 === Number(ziffern[3]);
}

/** Dienstjahre zum Stichtag — für Jubiläen und die Urlaubsstufe. */
export function dienstjahre(eintritt: string | undefined, stichtag = new Date()): number | null {
  if (!eintritt) return null;
  const a = new Date(`${eintritt.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(a.getTime())) return null;
  let jahre = stichtag.getFullYear() - a.getFullYear();
  const vorGeburtstag =
    stichtag.getMonth() < a.getMonth() ||
    (stichtag.getMonth() === a.getMonth() && stichtag.getDate() < a.getDate());
  if (vorGeburtstag) jahre -= 1;
  return Math.max(0, jahre);
}

export async function personaldatenLaden(mitarbeiterId: string): Promise<Personaldaten | null> {
  return await pb()
    .collection("personaldaten")
    .getFirstListItem<Personaldaten>(`mitarbeiter = "${sicher(mitarbeiterId)}"`)
    .catch(() => null);
}

/**
 * Anlegen oder ändern in einem Aufruf.
 *
 * Die Akte entsteht erst, wenn jemand das erste Mal etwas hineinschreibt —
 * ein leerer Datensatz je Mitarbeiter wäre Ballast, und eine Akte, die es
 * gibt, ohne dass jemand sie angelegt hat, ist verwirrend.
 */
export async function personaldatenSpeichern(
  mitarbeiterId: string,
  eingabe: Omit<PersonaldatenEingabe, "mitarbeiter">,
  vorhanden: Personaldaten | null,
): Promise<Personaldaten> {
  const daten = { ...bereinigen(eingabe), mitarbeiter: mitarbeiterId };
  const gespeichert = vorhanden
    ? await pb().collection("personaldaten").update<Personaldaten>(vorhanden.id, daten)
    : await pb().collection("personaldaten").create<Personaldaten>(daten);
  await protokollieren(
    "mitarbeiter",
    mitarbeiterId,
    vorhanden ? "aendern" : "anlegen",
    vorhanden ? "Personaldaten geändert" : "Personalakte angelegt",
  );
  return gespeichert;
}

/**
 * Leere Datumsfelder müssen null sein, nicht "".
 * PocketBase lehnt einen leeren String für ein date-Feld ab, und die
 * Fehlermeldung nennt nur den Feldnamen — das hat schon einmal eine halbe
 * Stunde gekostet.
 */
function bereinigen(eingabe: Record<string, unknown>): Record<string, unknown> {
  const datumsfelder = ["geburtsdatum", "eintritt", "austritt"];
  const daten: Record<string, unknown> = {};
  for (const [schluessel, wert] of Object.entries(eingabe)) {
    if (datumsfelder.includes(schluessel) && !wert) daten[schluessel] = null;
    else daten[schluessel] = typeof wert === "string" ? wert.trim() : wert;
  }
  return daten;
}
