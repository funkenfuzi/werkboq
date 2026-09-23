/**
 * Alle Collections von Werkboq, in der Reihenfolge, in der sie angelegt
 * werden: Verknüpfungen zeigen nur auf Collections, die vorher stehen.
 *
 * DIE EINZIGE STELLE. Bis September 2026 standen die Definitionen doppelt,
 * im Modul (collections.ts) und gespiegelt hier in einrichten.mjs — und
 * liefen zweimal auseinander, beide Male still: `auftraege.art` fehlte, und
 * ein `required`, das in der einen Kopie längst weg war, blockierte in der
 * anderen Rechnungen ohne Umsatzsteuer. Jetzt liegt jede Collection in
 * genau einer Datei, beim Kern oder beim Baustein, dem sie gehört, und
 * diese Liste sammelt sie nur ein.
 */
import kern from "@werkboq/core/schema/kern.mjs";
import zeiterfassung from "@werkboq/baustein-zeiterfassung/schema.mjs";
import planung from "@werkboq/baustein-planung/schema.mjs";
import material from "@werkboq/baustein-material/schema.mjs";
import verrechnung from "@werkboq/baustein-verrechnung/schema.mjs";
import personal from "@werkboq/baustein-personal/schema.mjs";
import fuhrpark from "@werkboq/baustein-fuhrpark/schema.mjs";
import elektro from "@werkboq/modul-elektro/schema.mjs";

export const KERN = kern;

/**
 * Collections der Bausteine — der Grundfunktionen, die einzeln verkauft
 * werden. Angelegt werden sie immer: ob ein Betrieb den Baustein gekauft hat,
 * entscheidet betrieb.bausteine in der Oberfläche, nicht das Schema. Eine
 * leere Tabelle kostet nichts, ein nachträglich fehlendes Schema dagegen
 * einen Ausfall, sobald jemand den Baustein dazukauft.
 */
export const BAUSTEINE = [
  ...zeiterfassung,
  ...planung,
  ...material,
  ...verrechnung,
  ...personal,
  ...fuhrpark,
];

/** Collections der Fachmodule. */
export const MODULE = [...elektro];

export const ALLE = [...KERN, ...BAUSTEINE, ...MODULE];
