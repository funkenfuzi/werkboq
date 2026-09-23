import { AUFTRAGSARTEN, type Auftragsart } from "./typen";

/**
 * Phasen eines Auftrags.
 *
 * ZWEI EBENEN, UND DAS IST DER KERN DER SACHE.
 *
 * Darunter liegt ein festes GERÜST aus sieben Stufen. An diesen Stufen
 * hängt Verhalten: das Phasenbrett ordnet danach, „Verrechnen" heißt für
 * die Rechnungswarnung „hier fehlt Geld", „Abgeschlossen" wird im Brett
 * eingeklappt. Diese Stufen kann niemand umbenennen oder erfinden — sonst
 * wüsste das Programm nicht mehr, wann ein Auftrag zu verrechnen ist.
 *
 * Darüber liegen die PHASEN JE AUFTRAGSART: welche Stufen eine Art
 * überhaupt durchläuft und wie sie dort heißen. Eine Störung wird
 * „gemeldet", ein Projekt beginnt als „Anfrage"; eine Wartung ist
 * „geplant" und dann „durchgeführt". Diese Ebene ist eine Voreinstellung, die jeder
 * Betrieb unter Einstellungen umbenennen und ausdünnen kann.
 *
 * Warum so und nicht völlig frei: ein Betrieb soll seine eigenen Wörter
 * verwenden können, ohne dass dabei die Rechnungswarnung stumm wird.
 *
 * WARUM DAS ÜBERHAUPT UMGEBAUT WURDE. Bis September 2026 gab es zehn
 * Phasen für alles, und sie mischten drei Dinge: Zustände (Anfrage,
 * Abnahme), Tätigkeiten (Spezifikation, Termine) und Auftragsarten
 * (Wartung, Materialverkauf). „Projekt" war zugleich Art und Phase. Das
 * Phasenbrett war 2.608 px breit bei 984 px Platz.
 */

export const PHASENSTUFEN = [
  "eingang",
  "angebot",
  "beauftragt",
  "in_arbeit",
  "fertig",
  "verrechnen",
  "abgeschlossen",
] as const;
export type Phasenstufe = (typeof PHASENSTUFEN)[number];

/**
 * Die Namen der Stufen, wenn keine Art gewählt ist — etwa im Phasenbrett
 * über alle Aufträge. Neutral gehalten, weil dieselbe Spalte eine
 * gemeldete Störung und eine Projektanfrage enthält.
 */
export const PHASENSTUFE_TEXT: Record<Phasenstufe, string> = {
  eingang: "Eingang",
  angebot: "Angebot",
  beauftragt: "Beauftragt",
  in_arbeit: "In Arbeit",
  fertig: "Fertig",
  verrechnen: "Verrechnen",
  abgeschlossen: "Abgeschlossen",
};

/** Farbrolle je Phasenstufe — Leiterfarben-Metapher aus den Tokens. */
export const PHASENSTUFE_FARBE: Record<Phasenstufe, string> = {
  eingang: "neutral",
  angebot: "info",
  beauftragt: "info",
  in_arbeit: "warn",
  fertig: "ok",
  // Rot mit Absicht: ein fertiger, nicht verrechneter Auftrag ist der
  // Ort, an dem ein Handwerksbetrieb Geld liegen lässt.
  verrechnen: "fehler",
  abgeschlossen: "neutral",
};

export interface Phase {
  stufe: Phasenstufe;
  text: string;
}

/** Welche Stufen eine Art durchläuft, und wie sie dort heißen. */
export type Phaseneinstellung = Partial<Record<Auftragsart, Phase[]>>;

/**
 * Die Voreinstellung.
 *
 * „Verrechnen" und „Abgeschlossen" hat jede Art, mit demselben Namen: das
 * ist der Teil, an dem Geld hängt, und der soll überall gleich heißen.
 */
export const PHASEN_VORGABE: Record<Auftragsart, Phase[]> = {
  projekt: [
    { stufe: "eingang", text: "Anfrage" },
    { stufe: "angebot", text: "Angebot" },
    { stufe: "beauftragt", text: "Beauftragt" },
    { stufe: "in_arbeit", text: "In Arbeit" },
    { stufe: "fertig", text: "Abnahme" },
    { stufe: "verrechnen", text: "Verrechnen" },
    { stufe: "abgeschlossen", text: "Abgeschlossen" },
  ],
  // Eine Störung kennt kein Angebot und keine Abnahme. Wer beides
  // bräuchte, hat keine Störung, sondern ein Projekt.
  stoerung: [
    { stufe: "eingang", text: "Gemeldet" },
    { stufe: "in_arbeit", text: "In Arbeit" },
    { stufe: "verrechnen", text: "Verrechnen" },
    { stufe: "abgeschlossen", text: "Abgeschlossen" },
  ],
  regie: [
    { stufe: "beauftragt", text: "Beauftragt" },
    { stufe: "in_arbeit", text: "In Arbeit" },
    { stufe: "fertig", text: "Abnahme" },
    { stufe: "verrechnen", text: "Verrechnen" },
    { stufe: "abgeschlossen", text: "Abgeschlossen" },
  ],
  wartung: [
    { stufe: "beauftragt", text: "Geplant" },
    { stufe: "fertig", text: "Durchgeführt" },
    { stufe: "verrechnen", text: "Verrechnen" },
    { stufe: "abgeschlossen", text: "Abgeschlossen" },
  ],
  materialverkauf: [
    { stufe: "eingang", text: "Anfrage" },
    { stufe: "beauftragt", text: "Bestellt" },
    { stufe: "fertig", text: "Geliefert" },
    { stufe: "verrechnen", text: "Verrechnen" },
    { stufe: "abgeschlossen", text: "Abgeschlossen" },
  ],
};

/**
 * Stufen, die kein Betrieb ausblenden darf.
 *
 * Ohne „Verrechnen" gäbe es keinen Ort, an dem ein fertiger, aber nicht
 * verrechneter Auftrag auffällt — und genau dort verliert ein
 * Handwerksbetrieb Geld. Ohne „Abgeschlossen" hätte kein Auftrag ein Ende.
 */
export const PFLICHTSTUFEN: readonly Phasenstufe[] = ["verrechnen", "abgeschlossen"];

// ------------------------------------------------------------------------
// Einstellung des Betriebs
// ------------------------------------------------------------------------

let eingestellt: Phaseneinstellung = {};

/**
 * Die Einstellung des Betriebs übernehmen.
 *
 * Was nicht passt, wird verworfen statt übernommen: eine Phasenstufe, die es
 * nicht gibt, eine doppelte, eine leere Liste. Fehlt danach eine
 * Pflichtstufe, wird sie aus der Vorgabe ergänzt. Eine kaputte Einstellung
 * darf keinen Auftrag ohne Phasenleiste zurücklassen.
 */
export function phasenEinstellen(roh: unknown): Phaseneinstellung {
  const sauber: Phaseneinstellung = {};
  if (roh && typeof roh === "object") {
    for (const art of AUFTRAGSARTEN) {
      const liste = (roh as Record<string, unknown>)[art];
      const geprueft = pruefen(liste, art);
      if (geprueft) sauber[art] = geprueft;
    }
  }
  eingestellt = sauber;
  return sauber;
}

function pruefen(liste: unknown, art: Auftragsart): Phase[] | null {
  if (!Array.isArray(liste) || !liste.length) return null;
  const gesehen = new Set<Phasenstufe>();
  const heraus: Phase[] = [];
  for (const eintrag of liste) {
    if (!eintrag || typeof eintrag !== "object") continue;
    const stufe = (eintrag as { stufe?: unknown }).stufe;
    const text = String((eintrag as { text?: unknown }).text ?? "").trim();
    if (!(PHASENSTUFEN as readonly unknown[]).includes(stufe)) continue;
    if (gesehen.has(stufe as Phasenstufe)) continue;
    gesehen.add(stufe as Phasenstufe);
    heraus.push({ stufe: stufe as Phasenstufe, text: text || standardText(stufe as Phasenstufe, art) });
  }
  for (const pflicht of PFLICHTSTUFEN) {
    if (!gesehen.has(pflicht)) heraus.push({ stufe: pflicht, text: standardText(pflicht, art) });
  }
  // Immer in der Reihenfolge des Gerüsts — ein Betrieb soll Namen ändern
  // können, aber nicht „Abgeschlossen" vor „In Arbeit" schieben.
  return heraus.sort((a, b) => PHASENSTUFEN.indexOf(a.stufe) - PHASENSTUFEN.indexOf(b.stufe));
}

function standardText(stufe: Phasenstufe, art: Auftragsart): string {
  return PHASEN_VORGABE[art].find((p) => p.stufe === stufe)?.text ?? PHASENSTUFE_TEXT[stufe];
}

/** Lädt die Einstellung aus den Betriebsstammdaten. */
export async function phasenLaden(
  laden: () => Promise<{ phasen?: unknown } | null>,
): Promise<Phaseneinstellung> {
  try {
    const betrieb = await laden();
    return phasenEinstellen(betrieb?.phasen);
  } catch {
    return phasenEinstellen(null);
  }
}

/** Die Phasen einer Art, wie dieser Betrieb sie eingestellt hat. */
export function phasenDerArt(art: Auftragsart): Phase[] {
  return eingestellt[art] ?? PHASEN_VORGABE[art];
}

/** Wie heißt diese Phasenstufe bei dieser Art? */
export function phasenText(stufe: string, art?: Auftragsart): string {
  if (!(PHASENSTUFEN as readonly string[]).includes(stufe)) return ALT_TEXT[stufe] ?? stufe;
  if (!art) return PHASENSTUFE_TEXT[stufe as Phasenstufe];
  return (
    phasenDerArt(art).find((p) => p.stufe === stufe)?.text ?? standardText(stufe as Phasenstufe, art)
  );
}

/**
 * Die Phasen, die ein bestimmter Auftrag anbieten soll.
 *
 * Steht er in einer Phasenstufe, die seine Art nicht (mehr) kennt — nach einer
 * Umstellung der Art, oder weil der Betrieb die Phasenstufe ausgeblendet hat —,
 * wird sie trotzdem angezeigt, an ihrer Stelle im Gerüst. Eine
 * Phasenleiste, in der der aktuelle Zustand fehlt, ist schlimmer als eine
 * mit einem Eintrag zu viel.
 */
export function phasenFuer(a: { art?: Auftragsart | string; phase: string }): Phase[] {
  const art = artAus(a.art);
  const vorgesehen = phasenDerArt(art);
  if (vorgesehen.some((p) => p.stufe === a.phase)) return vorgesehen;
  if (!(PHASENSTUFEN as readonly string[]).includes(a.phase)) return vorgesehen;
  const fremd: Phase = { stufe: a.phase as Phasenstufe, text: phasenText(a.phase, art) };
  return [...vorgesehen, fremd].sort((x, y) => PHASENSTUFEN.indexOf(x.stufe) - PHASENSTUFEN.indexOf(y.stufe));
}

/** Wo steht der Auftrag in seiner eigenen Leiste — für die Fortschrittsanzeige. */
export function fortschritt(a: { art?: Auftragsart | string; phase: string }): {
  index: number;
  von: number;
} {
  const liste = phasenFuer(a);
  return { index: liste.findIndex((p) => p.stufe === a.phase), von: liste.length };
}

/** Die nächste Phase dieses Auftrags, oder null am Ende. */
export function naechstePhase(a: { art?: Auftragsart | string; phase: string }): Phase | null {
  const liste = phasenFuer(a);
  const i = liste.findIndex((p) => p.stufe === a.phase);
  return i >= 0 && i < liste.length - 1 ? liste[i + 1]! : null;
}

/**
 * Welche Spalten das Phasenbrett zeigt.
 *
 * Mit Art: deren Phasen, mit deren Namen. Steht trotzdem ein Auftrag
 * dieser Art in einer Stufe, die sie nicht (mehr) kennt — der Betrieb hat
 * sie ausgeblendet —, kommt diese Spalte dazu. Ein Auftrag, der vom Brett
 * verschwindet, ist schlimmer als eine Spalte zu viel.
 *
 * Ohne Art: das Gerüst mit neutralen Namen, aber ohne Stufen, die keine
 * Art dieses Betriebs benutzt und in denen nichts liegt.
 *
 * `belegt` sind die Phasen der gezeigten Aufträge, alte Namen erlaubt.
 */
export function brettspalten(belegt: Iterable<string>, art: Auftragsart | null): Phase[] {
  const stufen = new Set<Phasenstufe>();
  for (const p of belegt) stufen.add(umschluesseln(p));
  if (art) {
    const eigene = phasenDerArt(art);
    const extra = PHASENSTUFEN.filter(
      (s) => stufen.has(s) && !eigene.some((p) => p.stufe === s),
    ).map((s) => ({ stufe: s, text: phasenText(s, art) }));
    return [...eigene, ...extra].sort(
      (a, b) => PHASENSTUFEN.indexOf(a.stufe) - PHASENSTUFEN.indexOf(b.stufe),
    );
  }
  const benutzt = new Set(AUFTRAGSARTEN.flatMap((a) => phasenDerArt(a).map((p) => p.stufe)));
  return PHASENSTUFEN.filter((s) => benutzt.has(s) || stufen.has(s)).map((s) => ({
    stufe: s,
    text: PHASENSTUFE_TEXT[s],
  }));
}

/**
 * Rückt einen Auftrag bis zu einer Stufe vor — oder gar nicht.
 *
 * Für Ereignisse aus anderen Bausteinen: ein Angebot geht hinaus (→
 * „angebot"), der Kunde nimmt an (→ „beauftragt"). Dabei gilt:
 *
 *   - Nie zurück. Steht der Auftrag schon weiter, bleibt er, wo er ist —
 *     ein nachgereichtes Angebot holt eine laufende Baustelle nicht in die
 *     Angebotsphase zurück.
 *   - Nie zu weit. Kennt die Art die Stufe nicht (eine Störung hat kein
 *     „Beauftragt"), bleibt es bei der letzten Phase davor, die sie kennt.
 *     Ein Angebot, das hinausgeht, darf einen Auftrag nicht auf „In
 *     Arbeit" setzen, nur weil der Betrieb „Angebot" ausgeblendet hat.
 *
 * Gibt die Zielstufe zurück, oder null, wenn nichts zu tun ist.
 */
export function vorruecken(
  a: { art?: Auftragsart | string; phase: string },
  bis: Phasenstufe,
): Phasenstufe | null {
  const jetzt = PHASENSTUFEN.indexOf(umschluesseln(a.phase));
  const ziel = PHASENSTUFEN.indexOf(bis);
  const moeglich = phasenDerArt(artAus(a.art)).filter((p) => PHASENSTUFEN.indexOf(p.stufe) <= ziel);
  const letzte = moeglich[moeglich.length - 1];
  if (!letzte || PHASENSTUFEN.indexOf(letzte.stufe) <= jetzt) return null;
  return letzte.stufe;
}

function artAus(art: unknown): Auftragsart {
  return (AUFTRAGSARTEN as readonly unknown[]).includes(art) ? (art as Auftragsart) : "projekt";
}

// ------------------------------------------------------------------------
// Umschlüsselung der alten zehn Phasen
// ------------------------------------------------------------------------

/**
 * Wie die alten Phasen auf das Gerüst abgebildet werden.
 *
 * Nicht jede Zuordnung ist eindeutig, und das sollte man wissen:
 *
 *   spezifikation → eingang    Klärung vor dem Angebot ist noch Anfrage.
 *   termine, projekt → beauftragt
 *                              Beides hieß: zugesagt, noch nicht vor Ort.
 *   wartung → fertig           Kam nach der Abnahme und hieß „läuft in
 *                              der Wartung". Eine Wartung ist seit
 *                              September 2026 eine eigene Auftragsart; der
 *                              Auftrag steht danach auf „fertig", und der
 *                              Betrieb entscheidet, ob er ihn verrechnet
 *                              oder abschließt. Lieber einmal zu viel in
 *                              „Fertig" als stillschweigend „Abgeschlossen".
 *   materialverkauf → beauftragt
 *                              Die Phase hieß: Ware wird verkauft, ist
 *                              aber noch nicht draußen.
 */
export const ALTE_PHASEN: Record<string, Phasenstufe> = {
  anfrage: "eingang",
  spezifikation: "eingang",
  angebot: "angebot",
  termine: "beauftragt",
  projekt: "beauftragt",
  errichtung: "in_arbeit",
  abnahme: "fertig",
  wartung: "fertig",
  materialverkauf: "beauftragt",
  abgeschlossen: "abgeschlossen",
};

/** Texte der alten Phasen — für Verlaufszeilen, die vor dem Umbau entstanden. */
const ALT_TEXT: Record<string, string> = {
  anfrage: "Anfrage",
  spezifikation: "Spezifikation",
  termine: "Termine",
  projekt: "Projekt",
  errichtung: "Errichtung",
  abnahme: "Abnahme",
  wartung: "Wartung",
  materialverkauf: "Materialverkauf",
};

/** Alte oder neue Phase → Phasenstufe des Gerüsts. Unbekanntes wird zum Eingang. */
export function umschluesseln(phase: string | undefined | null): Phasenstufe {
  if (phase && (PHASENSTUFEN as readonly string[]).includes(phase)) return phase as Phasenstufe;
  return (phase && ALTE_PHASEN[phase]) || "eingang";
}

/** Alter Name, aus Rücksicht auf bestehende Aufrufer. */
export const AUFTRAG_PHASEN = PHASENSTUFEN;
