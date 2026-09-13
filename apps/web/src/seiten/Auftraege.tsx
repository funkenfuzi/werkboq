import { useEffect, useState } from "react";
import { KERN_COLLECTIONS, pb, type Auftrag } from "@werkboq/core";

export function Auftraege() {
  const [liste, setListe] = useState<Auftrag[]>([]);

  useEffect(() => {
    pb()
      .collection(KERN_COLLECTIONS.auftraege)
      .getFullList<Auftrag>({ sort: "-created", expand: "kunde" })
      .then(setListe)
      .catch(() => setListe([]));
  }, []);

  return (
    <section>
      <h1>Aufträge</h1>
      {liste.length === 0 && <p>Noch keine Aufträge angelegt.</p>}
      <ul>
        {liste.map((a) => (
          <li key={a.id}>
            {a.nummer} – {a.titel} – <em>{a.phase}</em>
            {a.modul && ` [${a.modul}]`}
          </li>
        ))}
      </ul>
    </section>
  );
}
