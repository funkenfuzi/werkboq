import { useEffect, useState } from "react";
import { pb } from "@werkboq/core";
import type { Pruefbericht } from "../daten/pruefbericht";

export function PruefberichteSeite() {
  const [liste, setListe] = useState<Pruefbericht[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    pb()
      .collection("elektro_pruefberichte")
      .getFullList<Pruefbericht>({ sort: "-pruefdatum" })
      .then(setListe)
      .catch((e: unknown) => setFehler(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <section>
      <h1>Prüfberichte</h1>
      {fehler && <p role="alert">Konnte Prüfberichte nicht laden: {fehler}</p>}
      {liste.length === 0 && !fehler && <p>Noch keine Prüfberichte vorhanden.</p>}
      <ul>
        {liste.map((p) => (
          <li key={p.id}>
            {p.pruefdatum ?? "ohne Datum"} – {p.art} – {p.ergebnis ?? "offen"}
          </li>
        ))}
      </ul>
    </section>
  );
}
