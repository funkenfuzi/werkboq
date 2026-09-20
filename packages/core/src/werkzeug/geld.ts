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
export function alsGeld(cent: number): string {
  const negativ = cent < 0;
  const ganz = Math.floor(Math.abs(cent) / 100);
  const rest = Math.abs(cent) % 100;
  const mitPunkten = String(ganz).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negativ ? "-" : ""}${mitPunkten},${String(rest).padStart(2, "0")}`;
}

/** "1.234,56 €" aus Cent. */
export function alsEuro(cent: number): string {
  return `${alsGeld(cent)} €`;
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
  const roh = text.trim().replace(/\s/g, "").replace(/€/g, "");
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

/** Menge mit bis zu drei Nachkommastellen, wie sie Handwerker schreiben. */
export function alsMenge(menge: number): string {
  const gerundet = Math.round(menge * 1000) / 1000;
  const [ganz, nach] = Math.abs(gerundet).toFixed(3).split(".");
  const mitPunkten = String(ganz).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const kurz = (nach ?? "").replace(/0+$/, "");
  return `${gerundet < 0 ? "-" : ""}${mitPunkten}${kurz ? `,${kurz}` : ""}`;
}

/**
 * Österreichische Umsatzsteuersätze.
 * 20 % ist der Normalsatz; 13 % und 10 % gelten für eigene Listen von
 * Leistungen. 0 % steht für steuerfreie Fälle — Kleinunternehmer,
 * Ausfuhr, innergemeinschaftliche Lieferung, Übergang der Steuerschuld.
 */
export const UST_SAETZE = [20, 13, 10, 0] as const;
export type UstSatz = (typeof UST_SAETZE)[number];

export const UST_TEXT: Record<UstSatz, string> = {
  20: "20 % Normalsatz",
  13: "13 % ermäßigt",
  10: "10 % ermäßigt",
  0: "0 % steuerfrei",
};
