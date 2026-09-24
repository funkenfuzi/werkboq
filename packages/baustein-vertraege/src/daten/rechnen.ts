/**
 * Die Rechnung hinter einem Wartungsvertrag — ohne Datenbank, unter Test.
 *
 * Drei Uhren laufen an einem Vertrag, und jede vergisst man anders:
 *
 *   WARTUNG      alle n Monate. Vergessen heißt: der Kunde ruft an, warum
 *                niemand kam — oder die Anlage ist ungeprüft, und das
 *                haftet.
 *   PAUSCHALE    je Monat, Quartal, Halbjahr oder Jahr im Voraus.
 *                Vergessen heißt: Geld liegt liegen, und nach einem Jahr
 *                fragt man ungern nach.
 *   LAUFZEIT     mit Verlängerung und Kündigungsfrist. Vergessen heißt: der
 *                Vertrag verlängert sich zu einem Preis, den man selbst
 *                anpassen wollte — oder der Kunde ist weg, und man merkt es
 *                bei der nächsten Wartung.
 */

export const VERRECHNUNGSARTEN = ["pauschale", "aufwand"] as const;
export type Verrechnungsart = (typeof VERRECHNUNGSARTEN)[number];
export const VERRECHNUNGSART_TEXT: Record<Verrechnungsart, string> = {
  pauschale: "Pauschale im Voraus",
  aufwand: "Nach Aufwand je Wartung",
};

export const RHYTHMEN = ["monat", "quartal", "halbjahr", "jahr"] as const;
export type Rhythmus = (typeof RHYTHMEN)[number];
export const RHYTHMUS_MONATE: Record<Rhythmus, number> = { monat: 1, quartal: 3, halbjahr: 6, jahr: 12 };
export const RHYTHMUS_TEXT: Record<Rhythmus, string> = {
  monat: "monatlich",
  quartal: "vierteljährlich",
  halbjahr: "halbjährlich",
  jahr: "jährlich",
};

export const VERTRAGSSTATUS = ["aktiv", "gekuendigt", "beendet"] as const;
export type Vertragsstatus = (typeof VERTRAGSSTATUS)[number];
export const VERTRAGSSTATUS_TEXT: Record<Vertragsstatus, string> = {
  aktiv: "Aktiv",
  gekuendigt: "Gekündigt",
  beendet: "Beendet",
};

/** Die Felder, mit denen gerechnet wird. */
export interface Vertragsdaten {
  status: Vertragsstatus;
  intervallMonate: number;
  naechsteWartung?: string;
  vorlaufTage?: number;
  verrechnung: Verrechnungsart;
  pauschale?: number;
  rhythmus?: Rhythmus;
  naechsteRechnung?: string;
  beginn: string;
  laufzeitMonate?: number;
  verlaengerungMonate?: number;
  kuendigungsfristMonate?: number;
  gekuendigtZum?: string;
  preisStand?: string;
}

/**
 * Monate addieren — auch negative. Monatsenden werden gekappt: der
 * 31. Jänner plus einen Monat ist der 28. Februar, minus drei Monate der
 * 31. Oktober.
 */
export function plusMonate(tag: string, monate: number): string {
  const [j, m, t] = tag.slice(0, 10).split("-").map(Number) as [number, number, number];
  const gesamt = m - 1 + monate;
  const jahr = j + Math.floor(gesamt / 12);
  const monat = (((gesamt % 12) + 12) % 12) + 1;
  const letzter = new Date(Date.UTC(jahr, monat, 0)).getUTCDate();
  return `${jahr}-${String(monat).padStart(2, "0")}-${String(Math.min(t, letzter)).padStart(2, "0")}`;
}

export function plusTage(tag: string, tage: number): string {
  const [j, m, t] = tag.slice(0, 10).split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(j, m - 1, t + tage)).toISOString().slice(0, 10);
}

export function tageBis(von: string, bis: string): number {
  const ms = (s: string) => {
    const [j, m, t] = s.slice(0, 10).split("-").map(Number) as [number, number, number];
    return Date.UTC(j, m - 1, t);
  };
  return Math.round((ms(bis) - ms(von)) / 86400000);
}

// ------------------------------------------------------------------------
// Laufzeit
// ------------------------------------------------------------------------

export interface Laufzeit {
  /** Ende der laufenden Periode; null bei unbefristet. */
  ende: string | null;
  /** Bis zu diesem Tag muss die Kündigung beim Vertragspartner sein. */
  letzterKuendigungstag: string | null;
  /** Verlängert er sich von selbst, wenn niemand kündigt? */
  verlaengertSich: boolean;
  /** Ist er vorbei (Ende überschritten und keine Verlängerung, oder gekündigt zu einem vergangenen Tag)? */
  abgelaufen: boolean;
}

/**
 * Wo der Vertrag in seiner Laufzeit steht.
 *
 * Ohne Laufzeit ist er unbefristet: kein Ende, kündbar jederzeit mit der
 * Frist. Mit Laufzeit und Verlängerung wird so lange um die Verlängerung
 * weitergezählt, bis das Ende nach dem Stichtag liegt — der Vertrag, der
 * 2019 für drei Jahre mit jährlicher Verlängerung geschlossen wurde,
 * endet also im laufenden Jahr, nicht 2022.
 */
export function laufzeit(v: Vertragsdaten, stichtag: string): Laufzeit {
  const frist = Math.max(0, v.kuendigungsfristMonate ?? 0);
  if (v.status !== "aktiv" && v.gekuendigtZum) {
    return {
      ende: v.gekuendigtZum,
      letzterKuendigungstag: null,
      verlaengertSich: false,
      abgelaufen: v.gekuendigtZum < stichtag,
    };
  }
  if (!v.laufzeitMonate || v.laufzeitMonate <= 0) {
    return { ende: null, letzterKuendigungstag: null, verlaengertSich: false, abgelaufen: false };
  }
  let ende = plusTage(plusMonate(v.beginn, v.laufzeitMonate), -1);
  const verl = Math.max(0, v.verlaengerungMonate ?? 0);
  if (verl > 0) {
    // Auf Tagesgenauigkeit: das Ende ist der letzte Tag der Periode. Wer
    // an genau diesem Tag schaut, steht noch in ihr.
    let schritte = 0;
    while (ende < stichtag && schritte < 1000) {
      ende = plusTage(plusMonate(plusTage(ende, 1), verl), -1);
      schritte++;
    }
  }
  return {
    ende,
    // Die Frist beginnt am Tag NACH dem Zugang (§ 902 ABGB, § 187 BGB).
    // Bei drei Monaten zum 31. Dezember muss die Kündigung also am
    // 30. September da sein — am 1. Oktober ist sie zu spät.
    letzterKuendigungstag: frist ? plusTage(plusMonate(plusTage(ende, 1), -frist), -1) : ende,
    verlaengertSich: verl > 0,
    abgelaufen: verl === 0 && ende < stichtag,
  };
}

// ------------------------------------------------------------------------
// Was ansteht
// ------------------------------------------------------------------------

export type Hinweisart = "wartung" | "rechnung" | "kuendigung" | "preis" | "ablauf";

export interface Hinweis {
  art: Hinweisart;
  text: string;
  /** Tag, um den es geht. */
  tag: string | null;
  /** Negativ: überfällig. */
  tage: number | null;
  dringend: boolean;
}

/** Wie lange eine Pauschale ohne Preisprüfung laufen darf, bevor erinnert wird. */
export const PREIS_PRUEFEN_NACH_MONATEN = 12;
/** So früh vor dem letzten Kündigungstag wird erinnert. */
export const KUENDIGUNG_VORLAUF_TAGE = 60;

/**
 * Alles, was an einem Vertrag gerade ansteht, dringendes zuerst.
 *
 * Nach einer Kündigung zählt nur noch, was vor dem Ende liegt: eine
 * Wartung nach dem Vertragsende ist keine Pflicht mehr, eine Pauschale für
 * die Zeit danach kein Anspruch.
 */
export function hinweise(v: Vertragsdaten, stichtag: string): Hinweis[] {
  const l = laufzeit(v, stichtag);
  const heraus: Hinweis[] = [];
  if (v.status === "beendet" || l.abgelaufen) {
    if (v.status === "aktiv") {
      heraus.push({ art: "ablauf", text: "Laufzeit vorbei — Vertrag beenden oder verlängern", tag: l.ende, tage: l.ende ? tageBis(stichtag, l.ende) : null, dringend: true });
    }
    return heraus;
  }
  const vorEnde = (tag: string) => !l.ende || v.status === "aktiv" || tag <= l.ende;

  if (v.naechsteWartung && vorEnde(v.naechsteWartung)) {
    const tage = tageBis(stichtag, v.naechsteWartung);
    const vorlauf = v.vorlaufTage ?? 30;
    if (tage <= vorlauf) {
      heraus.push({
        art: "wartung",
        text: tage < 0 ? "Wartung überfällig" : "Wartung fällig — Termin vereinbaren",
        tag: v.naechsteWartung,
        tage,
        dringend: tage < 0,
      });
    }
  }

  if (v.verrechnung === "pauschale" && v.naechsteRechnung && vorEnde(v.naechsteRechnung)) {
    const tage = tageBis(stichtag, v.naechsteRechnung);
    if (tage <= 0) {
      heraus.push({ art: "rechnung", text: "Pauschale verrechnen", tag: v.naechsteRechnung, tage, dringend: tage < -14 });
    }
  }

  if (v.status === "aktiv" && l.letzterKuendigungstag && l.verlaengertSich) {
    const tage = tageBis(stichtag, l.letzterKuendigungstag);
    if (tage >= 0 && tage <= KUENDIGUNG_VORLAUF_TAGE) {
      heraus.push({
        art: "kuendigung",
        text: "Letzter Tag für Kündigung oder Preisanpassung — sonst verlängert er sich",
        tag: l.letzterKuendigungstag,
        tage,
        dringend: tage <= 14,
      });
    }
  }

  if (v.status === "aktiv" && v.verrechnung === "pauschale") {
    const seit = v.preisStand || v.beginn;
    if (plusMonate(seit, PREIS_PRUEFEN_NACH_MONATEN) <= stichtag) {
      heraus.push({ art: "preis", text: "Pauschale seit über einem Jahr unverändert — Preis prüfen", tag: seit, tage: null, dringend: false });
    }
  }

  return heraus.sort((a, b) => Number(b.dringend) - Number(a.dringend) || (a.tage ?? 9999) - (b.tage ?? 9999));
}

// ------------------------------------------------------------------------
// Fortschreiben
// ------------------------------------------------------------------------

/**
 * Die nächste Wartung nach dieser — gerechnet vom FÄLLIGKEITSTAG, nicht
 * vom Tag, an dem jemand geklickt hat. Sonst wandert der Termin mit jeder
 * späten Wartung nach hinten, und aus „jährlich" wird „alle 13 Monate".
 */
export function folgewartung(v: Pick<Vertragsdaten, "naechsteWartung" | "intervallMonate">): string | null {
  if (!v.naechsteWartung || v.intervallMonate <= 0) return null;
  return plusMonate(v.naechsteWartung, v.intervallMonate);
}

export interface Pauschalzeitraum {
  von: string;
  bis: string;
  betrag: number;
  folgeRechnung: string;
}

/**
 * Welcher Zeitraum mit der fälligen Pauschale verrechnet wird.
 *
 * Die Rechnung am 1. Jänner „quartal" deckt 1. Jänner bis 31. März; die
 * nächste ist am 1. April fällig. Endet der Vertrag innerhalb des
 * Zeitraums, wird nur bis zum Ende verrechnet — anteilig nach Tagen.
 */
export function pauschalzeitraum(v: Vertragsdaten, stichtag: string): Pauschalzeitraum | null {
  if (v.verrechnung !== "pauschale" || !v.naechsteRechnung || !v.pauschale || !v.rhythmus) return null;
  const monate = RHYTHMUS_MONATE[v.rhythmus];
  const von = v.naechsteRechnung;
  const volleBis = plusTage(plusMonate(von, monate), -1);
  const l = laufzeit(v, stichtag);
  const ende = v.status !== "aktiv" ? l.ende : null;
  if (ende && ende < von) return null;
  if (ende && ende < volleBis) {
    const tageVoll = tageBis(von, volleBis) + 1;
    const tageAnteil = tageBis(von, ende) + 1;
    return { von, bis: ende, betrag: Math.round((v.pauschale * tageAnteil) / tageVoll), folgeRechnung: plusTage(ende, 1) };
  }
  return { von, bis: volleBis, betrag: v.pauschale, folgeRechnung: plusMonate(von, monate) };
}

/**
 * Zu welchem Tag eine Kündigung wirkt, die heute eingeht.
 *
 * Befristet mit Verlängerung: zum Ende der laufenden Periode, wenn die
 * Frist noch hält, sonst zum Ende der nächsten. Unbefristet: heute plus
 * Frist, zum Monatsende. Ohne Frist: sofort.
 */
export function kuendigungWirktZum(v: Vertragsdaten, eingang: string): string {
  const l = laufzeit(v, eingang);
  const frist = Math.max(0, v.kuendigungsfristMonate ?? 0);
  if (l.ende) {
    if (!l.letzterKuendigungstag || eingang <= l.letzterKuendigungstag) return l.ende;
    const verl = Math.max(0, v.verlaengerungMonate ?? 0);
    return verl ? plusTage(plusMonate(plusTage(l.ende, 1), verl), -1) : l.ende;
  }
  if (!frist) return eingang;
  const ziel = plusMonate(eingang, frist);
  const [j, m] = ziel.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(j, m, 0)).toISOString().slice(0, 10);
}
