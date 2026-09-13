import { useEffect, useState } from "react";
import { KERN_COLLECTIONS, pb, type Kunde } from "@werkboq/core";

export function Kunden() {
  const [liste, setListe] = useState<Kunde[]>([]);

  useEffect(() => {
    pb()
      .collection(KERN_COLLECTIONS.kunden)
      .getFullList<Kunde>({ sort: "name" })
      .then(setListe)
      .catch(() => setListe([]));
  }, []);

  return (
    <section>
      <h1>Kunden</h1>
      {liste.length === 0 && <p>Noch keine Kunden angelegt.</p>}
      <ul>
        {liste.map((k) => (
          <li key={k.id}>
            {k.name}
            {k.intern && " (intern)"}
            {k.ort && ` – ${k.ort}`}
          </li>
        ))}
      </ul>
    </section>
  );
}
