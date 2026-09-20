/**
 * Rechnen mit Geld.
 *
 * Alle Beträge stehen als Cent in ganzen Zahlen. Das ist keine Pedanterie:
 * 0.1 + 0.2 ergibt in JavaScript 0.30000000000000004, und auf einer Rechnung
 * mit dreißig Positionen wird daraus ein Cent Differenz zwischen Summe und
 * Einzelwerten — genau die Sorte Fehler, die ein Steuerprüfer findet und ein
 * Entwickler nie.
 *
 * Gerundet wird kaufmännisch und erst am Ende jeder Stufe: Positionswert,
 * dann Summe je Steuersatz, dann Steuer. So kommt dasselbe heraus wie auf
 * einem Rechnungsformular aus Papier.
 */

/** Kaufmännisch runden — 0,5 immer auf, auch bei negativen Beträgen. */
export function runden(cent: number): number {
  return cent < 0 ? -Math.round(-cent) : Math.round(cent);
}

/**
 * "1.234,56" aus Cent.
 *
 * Von Hand statt mit toLocaleString: die ICU-Daten liefern für de-AT je nach
 * Browser und Betriebssystem ein schmales Leerzeichen als Tausendertrenner.
 * Auf einer Rechnung hat nichts zu suchen, was auf zwei Rechnern anders
 * aussieht — schon gar nicht ein Zeichen, das beim Kopieren in eine
 * Buchhaltung zu Unsinn wird. Österreichische Schreibweise: Punkt für
 * Tausender, Komma für Cent.
 */
export function alsGeld(cent: number, schreibweise: Schreibweise = OESTERREICH): string {
  const negativ = cent < 0;
  const ganz = Math.floor(Math.abs(cent) / 100);
  const rest = Math.abs(cent) % 100;
  const mitTrenner = String(ganz).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    schreibweise.tausender,
  );
  return `${negativ ? "-" : ""}${mitTrenner}${schreibweise.komma}${String(rest).padStart(2, "0")}`;
}

/**
 * Wie ein Land Zahlen und Geld schreibt.
 *
 * Österreich und Deutschland: 1.234,56 €. Die Schweiz: 1’234.56 CHF — mit
 * Hochkomma als Tausendertrenner und Punkt vor den Rappen. Wer das
 * verwechselt, schreibt Rechnungen, die im falschen Land befremdlich
 * aussehen; beim Betrag selbst ist es zum Glück eindeutig.
 */
export interface Schreibweise {
  tausender: string;
  komma: string;
  zeichen: string;
  /** Steht das Währungszeichen vor oder nach dem Betrag? */
  voran: boolean;
}

export const OESTERREICH: Schreibweise = { tausender: ".", komma: ",", zeichen: "€", voran: false };
export const SCHWEIZ: Schreibweise = { tausender: "’", komma: ".", zeichen: "CHF", voran: true };

/**
 * Betrag mit Währung: "1.234,56 €" oder "CHF 1’234.56".
 *
 * Heißt weiterhin alsEuro, weil der Name überall im Code steht und ein
 * Umbenennen nur Lärm wäre — gemeint ist "Betrag mit Währungszeichen".
 */
export function alsEuro(cent: number, schreibweise: Schreibweise = OESTERREICH): string {
  const betrag = alsGeld(cent, schreibweise);
  return schreibweise.voran
    ? `${schreibweise.zeichen} ${betrag}`
    : `${betrag} ${schreibweise.zeichen}`;
}

/** Die Schreibweise zu einem Land. */
export function schreibweiseVon(land: string | undefined | null): Schreibweise {
  return String(land ?? "").toLowerCase() === "ch" ? SCHWEIZ : OESTERREICH;
}

/**
 * Eingetippten Betrag in Cent.
 *
 * Der Punkt ist mehrdeutig: in "1.500" trennt er Tausender, in "12.50" die
 * Cent. Beides kommt vor — das eine von einem österreichischen Anwender, das
 * andere aus einer kopierten Lieferantenliste oder vom Ziffernblock. Die
 * Regel, die beide Fälle richtig trifft:
 *
 *   - Steht ein Komma im Text, ist es das Dezimaltrennzeichen und jeder
 *     Punkt trennt Tausender. "1.234,56" → 123456
 *   - Ohne Komma: ein letzter Punkt mit ein oder zwei Ziffern dahinter
 *     trennt die Cent ("12.50" → 1250), mit drei Ziffern dahinter trennt er
 *     Tausender ("1.500" → 150000).
 *
 * Gibt NaN zurück, wenn daraus keine Zahl wird — der Aufrufer entscheidet,
 * was das bedeutet.
 */
export function ausGeld(text: string): number {
  // Hochkomma ist in der Schweiz Tausendertrenner und fliegt immer raus.
  const roh = text.trim().replace(/\s/g, "").replace(/€/gi, "").replace(/CHF/gi, "").replace(/[’']/g, "");
  if (roh === "") return 0;

  let sauber: string;
  if (roh.includes(",")) {
    sauber = roh.replace(/\./g, "").replace(",", ".");
  } else {
    const letzter = roh.lastIndexOf(".");
    const nachkomma = letzter === -1 ? -1 : roh.length - letzter - 1;
    sauber =
      nachkomma === 1 || nachkomma === 2
        ? roh.slice(0, letzter).replace(/\./g, "") + "." + roh.slice(letzter + 1)
        : roh.replace(/\./g, "");
  }

  const zahl = Number(sauber);
  return Number.isFinite(zahl) ? runden(zahl * 100) : NaN;
}

/**
 * Betrag für ein Eingabefeld: "1234,56" bzw. "1234.56".
 *
 * Ohne Tausendertrenner, damit ein Anwender die Zahl weitertippen kann, ohne
 * gegen eine Formatierung anzuarbeiten. Das Dezimaltrennzeichen richtet sich
 * nach dem Land, weil `ausGeld` es so wieder einliest.
 */
export function alsEingabe(cent: number, schreibweise: Schreibweise = OESTERREICH): string {
  return (cent / 100).toFixed(2).replace(".", schreibweise.komma);
}

/** Menge mit bis zu drei Nachkommastellen, wie sie Handwerker schreiben. */
export function alsMenge(menge: number, schreibweise: Schreibweise = OESTERREICH): string {
  const gerundet = Math.round(menge * 1000) / 1000;
  const [ganz, nach] = Math.abs(gerundet).toFixed(3).split(".");
  const mitTrenner = String(ganz).replace(/\B(?=(\d{3})+(?!\d))/g, schreibweise.tausender);
  const kurz = (nach ?? "").replace(/0+$/, "");
  return `${gerundet < 0 ? "-" : ""}${mitTrenner}${kurz ? `${schreibweise.komma}${kurz}` : ""}`;
}

/**
 * Ein Steuersatz in Prozent.
 *
 * Bewusst eine Zahl und keine feste Auswahl: welche Sätze gelten, hängt vom
 * Land ab und steht in werkzeug/laender.ts. Die Schweiz kennt 8.1 %, also
 * sind auch Nachkommastellen möglich.
 */
export type UstSatz = number;
