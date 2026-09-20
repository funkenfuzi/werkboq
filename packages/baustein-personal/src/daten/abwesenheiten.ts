import { pb, protokollieren, sicher, aktuellerBenutzer, type Basisdatensatz } from "@werkboq/core";

/**
 * Abwesenheiten: Urlaub, Zeitausgleich, Krankenstand.
 *
 * Getrennt von der Zeiterfassung, obwohl dort dieselben Wörter vorkommen.
 * Eine Zeitbuchung sagt, was an einem Tag war; eine Abwesenheit ist ein
 * Zeitraum mit einem Status — beantragt, genehmigt, abgelehnt. Wer beides in
 * eine Tabelle legt, bekommt entweder Urlaubsanträge ohne Entscheidung oder
 * Arbeitszeiten mit Genehmigungsworkflow. Beides ist falsch.
 *
 * DER GRUND IST VERTRAULICH.
 *
 * Dass jemand nicht da ist, muss die Disposition wissen. Warum, geht sie
 * nichts an. Trennen lässt sich das in PocketBase nicht sauber — Regeln
 * gelten je Datensatz, nicht je Feld —, deshalb liest diese Collection nur,
 * wer Personalwesen lesen darf, plus der Betroffene selbst. Steht in
 * server/einrichten.mjs mit derselben Begründung.
 */

export const ABWESENHEITSARTEN = [
  "urlaub",
  "zeitausgleich",
  "krankenstand",
  "pflegefreistellung",
  "sonderurlaub",
  "unbezahlt",
  "schulung",
  "praesenzdienst",
] as const;
export type Abwesenheitsart = (typeof ABWESENHEITSARTEN)[number];

export const ART_TEXT: Record<Abwesenheitsart, string> = {
  urlaub: "Urlaub",
  zeitausgleich: "Zeitausgleich",
  krankenstand: "Krankenstand",
  pflegefreistellung: "Pflegefreistellung",
  sonderurlaub: "Sonderurlaub",
  unbezahlt: "Unbezahlt",
  schulung: "Schulung",
  praesenzdienst: "Präsenz-/Zivildienst",
};

/**
 * Welche Arten vom Urlaubsanspruch abgezogen werden.
 *
 * Nur der Urlaub selbst. Krankenstand verbraucht keinen Urlaub — das ist
 * nicht Geschmackssache, sondern steht so im Gesetz; wer im Urlaub länger
 * als drei Tage krank wird, bekommt die Tage sogar zurück. Zeitausgleich
 * geht gegen das Stundenkonto, nicht gegen den Urlaubsanspruch.
 */
export const ZAEHLT_ALS_URLAUB: Abwesenheitsart[] = ["urlaub"];

export const ABWESENHEITSSTATUS = ["beantragt", "genehmigt", "abgelehnt", "storniert"] as const;
export type Abwesenheitsstatus = (typeof ABWESENHEITSSTATUS)[number];

export const STATUS_TEXT: Record<Abwesenheitsstatus, string> = {
  beantragt: "Beantragt",
  genehmigt: "Genehmigt",
  abgelehnt: "Abgelehnt",
  storniert: "Storniert",
};

export const STATUS_FARBE: Record<Abwesenheitsstatus, string> = {
  beantragt: "warn",
  genehmigt: "ok",
  abgelehnt: "neutral",
  storniert: "neutral",
};

export interface Abwesenheit extends Basisdatensatz {
  mitarbeiter: string;
  art: Abwesenheitsart;
  von: string;
  bis: string;
  halberTagBeginn?: boolean;
  halberTagEnde?: boolean;
  status: Abwesenheitsstatus;
  /** Werktage, beim Speichern gerechnet und mitgeschrieben. */
  tage: number;
  entschiedenVon?: string;
  entschiedenAm?: string;
  grund?: string;
  notiz?: string;
}

export type AbwesenheitEingabe = Omit<Abwesenheit, keyof Basisdatensatz | "tage">;

export const LEERE_ABWESENHEIT: Omit<AbwesenheitEingabe, "mitarbeiter"> = {
  art: "urlaub",
  von: heute(),
  bis: heute(),
  halberTagBeginn: false,
  halberTagEnde: false,
  status: "beantragt",
  grund: "",
  notiz: "",
};

export function heute(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Werktage zwischen zwei Tagen, beide eingeschlossen.
 *
 * Samstag und Sonntag zählen nicht. Feiertage schon — die kennt Werkboq
 * nicht, weil sie sich je Bundesland unterscheiden und ein falsch geratener
 * Feiertag schlimmer ist als ein fehlender. Wer will, korrigiert die Zahl von
 * Hand; das Feld ist änderbar.
 *
 * Halbe Tage am Anfang und am Ende werden abgezogen — der häufigste
 * Rechenfehler auf Papier.
 */
export function werktage(
  von: string,
  bis: string,
  halberTagBeginn = false,
  halberTagEnde = false,
): number {
  const a = new Date(`${von.slice(0, 10)}T00:00:00`);
  const b = new Date(`${bis.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return 0;

  let tage = 0;
  for (const d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
    const wochentag = d.getDay();
    if (wochentag !== 0 && wochentag !== 6) tage += 1;
  }
  if (tage === 0) return 0;

  // Ein einzelner halber Tag ist ein halber Tag, kein zweimal halber.
  if (von === bis) return halberTagBeginn || halberTagEnde ? 0.5 : tage;

  if (halberTagBeginn && istWerktag(a)) tage -= 0.5;
  if (halberTagEnde && istWerktag(b)) tage -= 0.5;
  return Math.max(0, tage);
}

function istWerktag(d: Date): boolean {
  const t = d.getDay();
  return t !== 0 && t !== 6;
}

/** Überschneiden sich zwei Zeiträume? Für die Warnung bei Doppelbuchung. */
export function ueberschneidet(
  a: Pick<Abwesenheit, "von" | "bis">,
  b: Pick<Abwesenheit, "von" | "bis">,
): boolean {
  return a.von.slice(0, 10) <= b.bis.slice(0, 10) && b.von.slice(0, 10) <= a.bis.slice(0, 10);
}

/**
 * Resturlaub: Anspruch plus Übertrag minus genehmigter und beantragter Urlaub.
 *
 * Beantragte Tage zählen mit. Wer sie ausblendet, verspricht einen Resturlaub,
 * den es nach der nächsten Genehmigung nicht mehr gibt.
 */
export function resturlaub(
  anspruch: number,
  uebertrag: number,
  abwesenheiten: Pick<Abwesenheit, "art" | "status" | "tage" | "von">[],
  jahr = new Date().getFullYear(),
): { anspruch: number; verbraucht: number; beantragt: number; rest: number } {
  let verbraucht = 0;
  let beantragt = 0;
  for (const a of abwesenheiten) {
    if (!ZAEHLT_ALS_URLAUB.includes(a.art)) continue;
    if (new Date(`${a.von.slice(0, 10)}T00:00:00`).getFullYear() !== jahr) continue;
    if (a.status === "genehmigt") verbraucht += a.tage ?? 0;
    else if (a.status === "beantragt") beantragt += a.tage ?? 0;
  }
  const gesamt = (anspruch ?? 0) + (uebertrag ?? 0);
  return { anspruch: gesamt, verbraucht, beantragt, rest: gesamt - verbraucht - beantragt };
}

// ------------------------------------------------------------------------
// Datenzugriff
// ------------------------------------------------------------------------

export async function abwesenheitenZuMitarbeiter(
  mitarbeiterId: string,
  jahr?: number,
): Promise<Abwesenheit[]> {
  const teile = [`mitarbeiter = "${sicher(mitarbeiterId)}"`];
  if (jahr) teile.push(`von >= "${jahr}-01-01" && von <= "${jahr}-12-31"`);
  return await pb()
    .collection("abwesenheiten")
    .getFullList<Abwesenheit>({ filter: teile.join(" && "), sort: "-von" });
}

/** Alle Abwesenheiten in einem Zeitraum — für Kalender und Planung. */
export async function abwesenheitenImZeitraum(
  von: string,
  bis: string,
  nurGenehmigte = false,
): Promise<Abwesenheit[]> {
  const teile = [`von <= "${sicher(bis)}" && bis >= "${sicher(von)}"`];
  if (nurGenehmigte) teile.push('status = "genehmigt"');
  else teile.push('(status = "genehmigt" || status = "beantragt")');
  return await pb()
    .collection("abwesenheiten")
    .getFullList<Abwesenheit>({ filter: teile.join(" && "), sort: "von" });
}

export async function offeneAntraege(): Promise<Abwesenheit[]> {
  return await pb()
    .collection("abwesenheiten")
    .getFullList<Abwesenheit>({ filter: 'status = "beantragt"', sort: "von", expand: "mitarbeiter" });
}

export async function abwesenheitAnlegen(e: AbwesenheitEingabe): Promise<Abwesenheit> {
  const tage = werktage(e.von, e.bis, e.halberTagBeginn, e.halberTagEnde);
  const neu = await pb().collection("abwesenheiten").create<Abwesenheit>({ ...e, tage });
  await protokollieren(
    "mitarbeiter",
    e.mitarbeiter,
    "anlegen",
    `${ART_TEXT[e.art]} ${e.von} bis ${e.bis} (${tage} Tage) eingetragen`,
  );
  return neu;
}

export async function abwesenheitAendern(id: string, e: AbwesenheitEingabe): Promise<void> {
  const tage = werktage(e.von, e.bis, e.halberTagBeginn, e.halberTagEnde);
  await pb().collection("abwesenheiten").update(id, { ...e, tage });
  await protokollieren(
    "mitarbeiter",
    e.mitarbeiter,
    "aendern",
    `${ART_TEXT[e.art]} ${e.von} bis ${e.bis} geändert`,
  );
}

/**
 * Genehmigen oder ablehnen.
 *
 * Wer entschieden hat und wann, wird mitgeschrieben. Ein Urlaubsantrag, bei
 * dem hinterher niemand mehr weiß, wer ihn bewilligt hat, ist im Streitfall
 * wertlos.
 */
export async function entscheiden(
  a: Abwesenheit,
  status: Extract<Abwesenheitsstatus, "genehmigt" | "abgelehnt">,
  notiz = "",
): Promise<void> {
  const benutzer = aktuellerBenutzer();
  await pb().collection("abwesenheiten").update(a.id, {
    status,
    entschiedenVon: benutzer?.id ?? null,
    entschiedenAm: heute(),
    ...(notiz ? { notiz } : {}),
  });
  await protokollieren(
    "mitarbeiter",
    a.mitarbeiter,
    "aendern",
    `${ART_TEXT[a.art]} ${a.von} bis ${a.bis} ${status === "genehmigt" ? "genehmigt" : "abgelehnt"}`,
  );
}

/**
 * Stornieren statt löschen.
 *
 * Ein genehmigter und dann gelöschter Urlaub hinterlässt keine Spur. Wer
 * später fragt, warum der Resturlaub anders aussieht als im Frühjahr, soll
 * eine Antwort finden.
 */
export async function stornieren(a: Abwesenheit, grund = ""): Promise<void> {
  await pb().collection("abwesenheiten").update(a.id, {
    status: "storniert",
    ...(grund ? { notiz: grund } : {}),
  });
  await protokollieren(
    "mitarbeiter",
    a.mitarbeiter,
    "aendern",
    `${ART_TEXT[a.art]} ${a.von} bis ${a.bis} storniert`,
  );
}
