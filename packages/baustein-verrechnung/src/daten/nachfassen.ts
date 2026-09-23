import {
  auftragAnlegen,
  auftragLaden,
  LEERER_AUFTRAG,
  NACHFASS_RHYTHMUS_VORGABE,
  naechsteNummer,
  pb,
  phaseSetzen,
  protokollieren,
  sicher,
  vorruecken,
  type Basisdatensatz,
} from "@werkboq/core";
import { heute, type Beleg } from "./belege";

/**
 * Angebotsverfolgung.
 *
 * Ein Angebot, an das sich niemand erinnert, ist ein verlorener Auftrag.
 * Die meisten gehen nicht an die Konkurrenz verloren, sondern an die
 * Stille: der Kunde hat es bekommen, wollte es sich überlegen, und dann
 * hat keiner mehr angerufen.
 *
 * Darum hat jedes offene Angebot einen nächsten Termin, und zwar immer:
 *
 *   1. Hat jemand eine WIEDERVORLAGE gesetzt („Kunde ist bis 15. auf
 *      Urlaub"), gilt die.
 *   2. Sonst der RHYTHMUS des Betriebs, voreingestellt 7, 14, 30 Tage:
 *      sieben Tage nach dem Versand das erste Mal, vierzehn Tage nach
 *      diesem Kontakt das zweite, dreißig danach das dritte.
 *   3. Ist der Rhythmus aufgebraucht und keine Wiedervorlage gesetzt, ist
 *      das Angebot KALT. Es erinnert nicht mehr, steht aber sichtbar in
 *      einer eigenen Spalte — dort entscheidet das Büro: noch einmal
 *      anrufen oder mit „keine Rückmeldung" schließen.
 *
 * Die Rechnung darüber ist rein und steht unter Test; die Datenbank kommt
 * erst in den Funktionen weiter unten.
 */

export type Nachfasszustand = "faellig" | "wartet" | "kalt" | "erledigt";

export const NACHFASSZUSTAND_TEXT: Record<Nachfasszustand, string> = {
  faellig: "Nachfassen",
  wartet: "Wartet",
  kalt: "Kalt",
  erledigt: "Erledigt",
};

export const NACHFASSZUSTAND_FARBE: Record<Nachfasszustand, string> = {
  faellig: "fehler",
  wartet: "info",
  kalt: "neutral",
  erledigt: "ok",
};

export const KONTAKTARTEN = ["telefon", "mail", "persoenlich", "sonstiges"] as const;
export type Kontaktart = (typeof KONTAKTARTEN)[number];
export const KONTAKTART_TEXT: Record<Kontaktart, string> = {
  telefon: "Telefon",
  mail: "E-Mail",
  persoenlich: "Persönlich",
  sonstiges: "Sonstiges",
};

/**
 * Warum ein Angebot verloren ging.
 *
 * Eine feste Liste und kein Freitext, weil daraus eine Auswertung werden
 * soll: verliert der Betrieb am Preis, ist das eine andere Nachricht als
 * „keine Rückmeldung" — das eine ist Kalkulation, das andere Nachfassen.
 */
export const ABSAGEGRUENDE = [
  "preis",
  "konkurrenz",
  "zeitpunkt",
  "kein_bedarf",
  "keine_rueckmeldung",
  "sonstiges",
] as const;
export type Absagegrund = (typeof ABSAGEGRUENDE)[number];
export const ABSAGEGRUND_TEXT: Record<Absagegrund, string> = {
  preis: "Zu teuer",
  konkurrenz: "An die Konkurrenz",
  zeitpunkt: "Zeitpunkt passt nicht",
  kein_bedarf: "Kein Bedarf mehr",
  keine_rueckmeldung: "Keine Rückmeldung",
  sonstiges: "Sonstiges",
};

export interface Angebotskontakt extends Basisdatensatz {
  beleg: string;
  datum: string;
  art: Kontaktart;
  notiz?: string;
  /** Wer nachgefasst hat — Anzeigename zum Zeitpunkt, lesbar ohne Personal. */
  wer?: string;
}

/** JJJJ-MM-TT plus Tage, ohne Zeitzonenwackeln. */
export function plusTage(tag: string, tage: number): string {
  const [j, m, t] = tag.slice(0, 10).split("-").map(Number);
  const d = new Date(Date.UTC(j!, m! - 1, t! + tage));
  return d.toISOString().slice(0, 10);
}

/** Tage von a bis b, beide JJJJ-MM-TT. Positiv, wenn b später ist. */
export function tageZwischen(a: string, b: string): number {
  const ms = (s: string) => {
    const [j, m, t] = s.slice(0, 10).split("-").map(Number);
    return Date.UTC(j!, m! - 1, t!);
  };
  return Math.round((ms(b) - ms(a)) / 86400000);
}

export interface Nachfassstand {
  zustand: Nachfasszustand;
  /** Nächster Termin, oder null bei kalt und erledigt. */
  termin: string | null;
  /** Woher der Termin kommt — für die Zeile „laut Rhythmus" oder „vereinbart". */
  quelle: "wiedervorlage" | "rhythmus" | null;
  /** Wie oft schon nachgefasst wurde. */
  kontakte: number;
  /** Tage bis zum Termin; negativ heißt überfällig. */
  tage: number | null;
  /** Letzter Kontakt oder Versand — seit wann Ruhe ist. */
  seit: string;
}

/**
 * Wo ein Angebot steht.
 *
 * `versandt` ist der Tag, an dem das Angebot aus dem Haus ging — das
 * Festschreibedatum, ersatzweise das Belegdatum.
 */
export function nachfassstand(
  angebot: Pick<Beleg, "status" | "datum" | "festgeschrieben"> & { wiedervorlage?: string },
  kontakte: Pick<Angebotskontakt, "datum">[],
  rhythmus: readonly number[] = NACHFASS_RHYTHMUS_VORGABE,
  stichtag = heute(),
): Nachfassstand {
  const versandt = (angebot.festgeschrieben || angebot.datum).slice(0, 10);
  const daten = kontakte.map((k) => k.datum.slice(0, 10)).sort();
  const seit = daten.length ? daten[daten.length - 1]! : versandt;
  const n = daten.length;

  if (angebot.status !== "offen") {
    return { zustand: "erledigt", termin: null, quelle: null, kontakte: n, tage: null, seit };
  }

  const wv = angebot.wiedervorlage?.slice(0, 10);
  let termin: string | null = null;
  let quelle: Nachfassstand["quelle"] = null;
  if (wv) {
    termin = wv;
    quelle = "wiedervorlage";
  } else if (n < rhythmus.length) {
    termin = plusTage(seit, rhythmus[n]!);
    quelle = "rhythmus";
  }

  if (!termin) {
    return { zustand: "kalt", termin: null, quelle: null, kontakte: n, tage: null, seit };
  }
  const tage = tageZwischen(stichtag, termin);
  return { zustand: tage <= 0 ? "faellig" : "wartet", termin, quelle, kontakte: n, tage, seit };
}

/** Überfällige zuerst, dann nach Termin; Kalte nach Alter. */
export function nachDringlichkeit<T extends { stand: Nachfassstand }>(liste: T[]): T[] {
  const rang: Record<Nachfasszustand, number> = { faellig: 0, wartet: 1, kalt: 2, erledigt: 3 };
  return [...liste].sort((a, b) => {
    const r = rang[a.stand.zustand] - rang[b.stand.zustand];
    if (r) return r;
    if (a.stand.termin && b.stand.termin) return a.stand.termin.localeCompare(b.stand.termin);
    return a.stand.seit.localeCompare(b.stand.seit);
  });
}

/** „heute", „seit 3 Tagen", „in 5 Tagen", „am 15.10." */
export function termintext(s: Nachfassstand): string {
  if (s.zustand === "kalt") {
    return s.kontakte
      ? `${s.kontakte}× nachgefasst, keine Antwort`
      : "kein Termin mehr";
  }
  if (s.tage === null || !s.termin) return "";
  if (s.tage === 0) return "heute";
  if (s.tage < 0) return s.tage === -1 ? "seit gestern" : `seit ${-s.tage} Tagen`;
  if (s.tage === 1) return "morgen";
  if (s.tage <= 14) return `in ${s.tage} Tagen`;
  const [, m, t] = s.termin.split("-");
  return `am ${Number(t)}.${Number(m)}.`;
}

// ------------------------------------------------------------------------
// Datenbank
// ------------------------------------------------------------------------

/** Alle festgeschriebenen Angebote, die noch offen sind. */
export async function offeneAngebote(): Promise<Beleg[]> {
  return await pb()
    .collection("belege")
    .getFullList<Beleg>({
      filter: 'belegart = "angebot" && status = "offen" && festgeschrieben != ""',
      sort: "datum",
    });
}

/** Angebote, die in den letzten Tagen entschieden wurden — für die Auswertung. */
export async function entschiedeneAngebote(seitTagen = 365): Promise<Beleg[]> {
  const ab = plusTage(heute(), -seitTagen);
  return await pb()
    .collection("belege")
    .getFullList<Beleg>({
      filter: `belegart = "angebot" && (status = "angenommen" || status = "abgelehnt") && datum >= "${ab}"`,
      sort: "-datum",
    });
}

export async function kontakteZu(belegIds: string[]): Promise<Angebotskontakt[]> {
  if (!belegIds.length) return [];
  // In Häppchen, damit der Filter nicht zu lang wird.
  const heraus: Angebotskontakt[] = [];
  for (let i = 0; i < belegIds.length; i += 40) {
    const teil = belegIds.slice(i, i + 40).map((id) => `beleg = "${sicher(id)}"`).join(" || ");
    heraus.push(
      ...(await pb().collection("angebotskontakte").getFullList<Angebotskontakt>({ filter: teil, sort: "-datum,-created" })),
    );
  }
  return heraus;
}

/**
 * Einen Kontakt festhalten und die Wiedervorlage neu setzen.
 *
 * Nach einem Kontakt ist die alte Wiedervorlage erledigt — sie wird
 * geleert, außer es wurde gleich eine neue vereinbart. Sonst stünde das
 * Angebot nach dem Anruf weiter auf dem alten Datum.
 */
export async function nachgefasst(
  angebot: Beleg,
  eingabe: { datum: string; art: Kontaktart; notiz: string; wer: string; wiedervorlage: string },
): Promise<void> {
  await pb().collection("angebotskontakte").create({
    beleg: angebot.id,
    datum: eingabe.datum,
    art: eingabe.art,
    notiz: eingabe.notiz.trim(),
    wer: eingabe.wer,
  });
  await pb().collection("belege").update(angebot.id, { wiedervorlage: eingabe.wiedervorlage || null });
  await protokollieren(
    "belege",
    angebot.id,
    "aendern",
    `Angebot ${angebot.nummer}: nachgefasst (${KONTAKTART_TEXT[eingabe.art]})` +
      (eingabe.wiedervorlage ? `, Wiedervorlage ${eingabe.wiedervorlage}` : ""),
  );
}

/** Nur die Wiedervorlage verschieben, ohne Kontakt. */
export async function wiedervorlageSetzen(angebot: Beleg, datum: string): Promise<void> {
  await pb().collection("belege").update(angebot.id, { wiedervorlage: datum || null });
  await protokollieren(
    "belege",
    angebot.id,
    "aendern",
    datum ? `Angebot ${angebot.nummer}: Wiedervorlage ${datum}` : `Angebot ${angebot.nummer}: Wiedervorlage entfernt`,
  );
}

export async function abgesagt(angebot: Beleg, grund: Absagegrund, notiz: string): Promise<void> {
  await pb().collection("belege").update(angebot.id, {
    status: "abgelehnt",
    absagegrund: grund,
    absagenotiz: notiz.trim(),
    wiedervorlage: null,
  });
  await protokollieren(
    "belege",
    angebot.id,
    "aendern",
    `Angebot ${angebot.nummer}: abgelehnt — ${ABSAGEGRUND_TEXT[grund]}`,
  );
  if (angebot.auftrag) {
    await protokollieren("auftraege", angebot.auftrag, "aendern", `Angebot ${angebot.nummer} abgelehnt — ${ABSAGEGRUND_TEXT[grund]}`);
  }
}

/** Absagen nach Grund — die Auswertung „woran verlieren wir". */
export function absagenNachGrund(
  liste: (Pick<Beleg, "status" | "netto"> & { absagegrund?: string })[],
): { grund: Absagegrund; anzahl: number; netto: number }[] {
  const summe = new Map<Absagegrund, { anzahl: number; netto: number }>();
  for (const b of liste) {
    if (b.status !== "abgelehnt") continue;
    const g = (ABSAGEGRUENDE as readonly string[]).includes(b.absagegrund ?? "")
      ? (b.absagegrund as Absagegrund)
      : "sonstiges";
    const s = summe.get(g) ?? { anzahl: 0, netto: 0 };
    s.anzahl++;
    s.netto += b.netto;
    summe.set(g, s);
  }
  return [...summe].map(([grund, s]) => ({ grund, ...s })).sort((a, b) => b.netto - a.netto);
}

/**
 * Der Kunde hat zugesagt.
 *
 * Hängt das Angebot an einem Auftrag, rückt der auf „Beauftragt" vor (nie
 * zurück, nie über das Ziel hinaus — siehe vorruecken()). Hängt es an
 * keinem, entsteht einer: ein angenommenes Angebot ohne Auftrag ist Arbeit,
 * die niemand eingeplant hat.
 *
 * Die Auftragsbestätigung wird hier bewusst NICHT erzeugt, nur angeboten —
 * nicht jeder Betrieb schickt eine, und ein Beleg mit fortlaufender Nummer,
 * den keiner wollte, lässt sich nicht mehr spurlos entfernen.
 */
export async function angenommen(
  angebot: Beleg,
  titelFuerNeuenAuftrag?: string,
): Promise<{ auftragId: string; neu: boolean }> {
  await pb().collection("belege").update(angebot.id, { status: "angenommen", wiedervorlage: null });
  await protokollieren("belege", angebot.id, "aendern", `Angebot ${angebot.nummer}: angenommen`);

  if (angebot.auftrag) {
    const auftrag = await auftragLaden(angebot.auftrag);
    const ziel = vorruecken(auftrag, "beauftragt");
    if (ziel) await phaseSetzen(auftrag, ziel);
    await protokollieren("auftraege", auftrag.id, "aendern", `Angebot ${angebot.nummer} angenommen`);
    return { auftragId: auftrag.id, neu: false };
  }

  const auftrag = await auftragAnlegen({
    ...LEERER_AUFTRAG,
    kunde: angebot.kunde,
    nummer: await naechsteNummer(),
    titel: (titelFuerNeuenAuftrag ?? "").trim() || `Laut Angebot ${angebot.nummer}`,
    art: "projekt",
    phase: vorruecken({ art: "projekt", phase: "eingang" }, "beauftragt") ?? "eingang",
    beschreibung: `Aus Angebot ${angebot.nummer} vom ${new Date(angebot.datum).toLocaleDateString("de-AT")}.`,
  });
  if (!auftrag) {
    throw new Error("Der Auftrag konnte nicht angelegt werden — ohne Verbindung wird er nachgereicht. Bitte später in der Auftragsliste nachsehen.");
  }
  await pb().collection("belege").update(angebot.id, { auftrag: auftrag.id });
  return { auftragId: auftrag.id, neu: true };
}
