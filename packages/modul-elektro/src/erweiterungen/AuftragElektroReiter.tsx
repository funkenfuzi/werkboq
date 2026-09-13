import type { ErweiterungsProps } from "@werkboq/core";

/** Reiter "Elektro" in der Auftragsansicht des Kerns. */
export function AuftragElektroReiter({ datensatzId }: ErweiterungsProps) {
  return (
    <div>
      <h2>Elektro</h2>
      <p>Anlagendaten und Prüfberichte zu Auftrag {datensatzId ?? "?"} – folgt in der nächsten Scheibe.</p>
    </div>
  );
}
