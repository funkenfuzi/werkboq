/**
 * Rechnen mit Uhrzeiten und Tagen.
 *
 * Steht im Kern und nicht in einem Baustein: sowohl die Zeiterfassung als
 * auch die Planung rechnen damit, und ein Baustein darf den anderen nicht
 * kennen. Uhrzeiten sind durchgehend "HH:MM", Tage "JJJJ-MM-TT" — bewusst als
 * Text. Zeitzonen und Sommerzeit spielen bei einer Arbeitszeitaufzeichnung
 * keine Rolle: was zählt, ist was auf der Uhr stand.
 */

/** Minuten seit Mitternacht, oder -1 wenn das keine Uhrzeit ist. */
export function minuten(uhrzeit?: string): number {
  const treffer = /^(\d{1,2}):(\d{2})$/.exec((uhrzeit ?? "").trim());
  if (!treffer) return -1;
  const stunde = Number(treffer[1]);
  const minute = Number(treffer[2]);
  if (stunde > 23 || minute > 59) return -1;
  return stunde * 60 + minute;
}

/**
 * Spanne zwischen zwei Uhrzeiten in Minuten.
 * Ein Ende vor dem Beginn gilt als über Mitternacht hinaus — Nachtarbeit im
 * Störungsdienst ist der Normalfall, nicht der Sonderfall.
 */
export function spanne(beginn?: string, ende?: string): number {
  const von = minuten(beginn);
  const bis = minuten(ende);
  if (von < 0 || bis < 0) return 0;
  return bis >= von ? bis - von : 24 * 60 - von + bis;
}

/** "7:45" aus Minuten. */
export function alsStunden(gesamtMinuten: number): string {
  const stunden = Math.floor(gesamtMinuten / 60);
  const rest = gesamtMinuten % 60;
  return `${stunden}:${String(rest).padStart(2, "0")}`;
}

/** Montag der Woche, in der `tag` liegt — als "JJJJ-MM-TT". */
export function wochenbeginn(tag = new Date()): string {
  const d = new Date(tag);
  const versatz = (d.getDay() + 6) % 7; // Montag = 0
  d.setDate(d.getDate() - versatz);
  return alsDatum(d);
}

export function alsDatum(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function tagePlus(datum: string, tage: number): string {
  const d = new Date(`${datum}T00:00:00`);
  d.setDate(d.getDate() + tage);
  return alsDatum(d);
}

/** Text für Filter, in dem Anführungszeichen nichts zu suchen haben. */
export function sicher(text: string): string {
  return text.replace(/["\\]/g, "");
}
