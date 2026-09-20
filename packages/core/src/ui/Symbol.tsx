/**
 * Symbolsatz.
 *
 * Bewusst als eigene Datei statt als Abhängigkeit: es sind eine Handvoll
 * Zeichen, sie müssen zur Strichstärke der Oberfläche passen, und ein Paket
 * dafür brächte hunderte ungenutzte Symbole in das Bündel.
 *
 * Alle Pfade auf 24×24 mit Strichstärke 1.75 — kräftig genug, dass sie neben
 * Barlow Semibold nicht dünn wirken.
 */

export type SymbolName =
  | "start"
  | "kunden"
  | "auftraege"
  | "pruefung"
  | "suche"
  | "plus"
  | "stift"
  | "muell"
  | "zurueck"
  | "telefon"
  | "mail"
  | "ort"
  | "abmelden"
  | "sortierung"
  | "uhr"
  | "kalender"
  | "einstellungen"
  | "warnung";

const PFADE: Record<SymbolName, string> = {
  start: "M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5M9.5 20v-6h5v6",
  kunden: "M16 19v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V19M9.5 9.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM21 19v-1.5a4 4 0 0 0-3-3.87M16 3.63a4 4 0 0 1 0 7.75",
  auftraege: "M5 3.5h9l5 5V20a.5.5 0 0 1-.5.5h-13A.5.5 0 0 1 5 20V4a.5.5 0 0 1 .5-.5ZM14 3.5V9h5M8.5 13h7M8.5 16.5h4",
  pruefung: "M12 3.5 4.5 6.5v5c0 4.5 3 8 7.5 9.5 4.5-1.5 7.5-5 7.5-9.5v-5L12 3.5ZM9 12l2.2 2.2L15.5 10",
  suche: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4",
  plus: "M12 5v14M5 12h14",
  stift: "M4 20h4l10-10a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5 4 20Z",
  muell: "M4 6.5h16M9.5 6.5V4.5h5v2M6.5 6.5 7.5 20h9l1-13.5M10 10v6.5M14 10v6.5",
  zurueck: "M15 5 8 12l7 7",
  telefon: "M7 3.5 9.5 8 7.5 10a12 12 0 0 0 6 6l2-2 4.5 2.5V20a1 1 0 0 1-1.1 1C10.2 20.3 3.7 13.8 3 5.6A1 1 0 0 1 4 4.5h3Z",
  mail: "M3.5 6.5h17v11h-17v-11ZM3.5 7l8.5 6 8.5-6",
  ort: "M12 21s6.5-6 6.5-11a6.5 6.5 0 1 0-13 0C5.5 15 12 21 12 21ZM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  abmelden: "M14.5 3.5h4a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1h-4M13 12H3.5M7 8l-3.5 4 3.5 4",
  sortierung: "M8 5v14M8 19l-3-3M16 19V5M16 5l3 3",
  uhr: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5.2l3.3 2",
  kalender: "M4 6.5h16v13H4v-13ZM8 3.5v4M16 3.5v4M4 10.5h16",
  einstellungen: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 14.5a1.5 1.5 0 0 0 .3 1.7l.1.1a1.8 1.8 0 1 1-2.6 2.6l-.1-.1a1.5 1.5 0 0 0-2.5 1v.3a1.8 1.8 0 1 1-3.6 0v-.2a1.5 1.5 0 0 0-2.6-1l-.1.1a1.8 1.8 0 1 1-2.6-2.6l.1-.1a1.5 1.5 0 0 0-1-2.5h-.3a1.8 1.8 0 1 1 0-3.6h.2a1.5 1.5 0 0 0 1-2.6l-.1-.1a1.8 1.8 0 1 1 2.6-2.6l.1.1a1.5 1.5 0 0 0 2.5-1v-.3a1.8 1.8 0 1 1 3.6 0v.2a1.5 1.5 0 0 0 2.6 1l.1-.1a1.8 1.8 0 1 1 2.6 2.6l-.1.1a1.5 1.5 0 0 0 1 2.5h.3a1.8 1.8 0 1 1 0 3.6h-.2a1.5 1.5 0 0 0-1.3.9Z",
  warnung: "M12 4 2.5 20.5h19L12 4ZM12 10v5M12 17.8v.2",
};

export function Symbol({
  name,
  groesse = 20,
  className,
}: {
  name: SymbolName;
  groesse?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={groesse}
      height={groesse}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PFADE[name]} />
    </svg>
  );
}
