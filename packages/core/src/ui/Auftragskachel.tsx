import { Link } from "react-router-dom";

/** Die Reiter der Auftragsakte — Teil der Adresse, also fest. */
export const AUFTRAGSREITER = ["ueberblick", "arbeit", "baustelle", "abrechnung", "verlauf"] as const;
export type Auftragsreiter = (typeof AUFTRAGSREITER)[number];

export const AUFTRAGSREITER_TEXT: Record<Auftragsreiter, string> = {
  ueberblick: "Überblick",
  arbeit: "Arbeit",
  baustelle: "Baustelle",
  abrechnung: "Abrechnung",
  verlauf: "Verlauf",
};

/**
 * Eine Kachel im Überblick der Auftragsakte.
 *
 * EINE ZAHL, EIN ZIEL. Die Kachel sagt, wie viel da ist, und ob etwas
 * wartet — mehr nicht. Wer mehr wissen will, tippt drauf und landet im
 * Reiter. Eine Kachel, die versucht, den Inhalt des Reiters zu zeigen,
 * wird zu dem Block, den sie ersetzen soll.
 *
 * Liegt im Kern, damit jede Kachel gleich aussieht, egal welcher Baustein
 * sie beisteuert.
 */
export function Auftragskachel({
  auftragId,
  reiter,
  titel,
  wert,
  zusatz,
  achtung = false,
}: {
  auftragId: string;
  reiter: Auftragsreiter;
  titel: string;
  /** Die eine Zahl, etwa „15 h" oder „4.302 €". */
  wert: string;
  /** Eine kurze Zeile darunter, etwa „1 offen". */
  zusatz?: string;
  /** Wartet hier etwas? Dann bekommt die Kachel einen Punkt. */
  achtung?: boolean;
}) {
  return (
    <Link
      className={`wb-auftragskachel${achtung ? " wb-auftragskachel--achtung" : ""}`}
      to={`/auftraege/${auftragId}/${reiter}`}
    >
      <span className="wb-auftragskachel__titel">{titel}</span>
      <span className="wb-auftragskachel__wert">{wert}</span>
      {zusatz && <span className="wb-auftragskachel__zusatz">{zusatz}</span>}
      {achtung && <span className="wb-auftragskachel__punkt" aria-label="wartet" />}
    </Link>
  );
}
