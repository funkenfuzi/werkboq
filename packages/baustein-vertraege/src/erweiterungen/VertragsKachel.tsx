import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { darf } from "@werkboq/core";
import { hinweise } from "../daten/rechnen";
import { alleVertraege, heute, type Vertrag } from "../daten/vertraege";
import { Hinweisliste } from "../komponenten/Hinweisliste";

/**
 * Was an Verträgen ansteht — auf der Startseite fürs Büro.
 *
 * Nur wenn etwas ansteht, und ohne die Preisprüfung: die ist wichtig,
 * aber nicht heute. Sie steht auf der Vertragsseite.
 */
export function VertragsKachel() {
  const [liste, setListe] = useState<Vertrag[]>([]);
  const sichtbar = darf("buchhaltung");
  const laden = useCallback(() => {
    if (!sichtbar) return;
    alleVertraege()
      .then((l) => setListe(l.filter((v) => v.status !== "beendet")))
      .catch(() => setListe([]));
  }, [sichtbar]);
  useEffect(laden, [laden]);

  const stichtag = heute();
  const betroffen = liste.filter((v) => hinweise(v, stichtag).some((h) => h.art !== "preis"));
  if (!sichtbar || !betroffen.length) return null;

  return (
    <section className="wb-block">
      <div className="wb-block__kopf">
        <h2>Wartungsverträge</h2>
        <Link className="wb-button wb-button--sekundaer wb-button--klein" to="/vertraege">
          Alle ansehen
        </Link>
      </div>
      <Hinweisliste vertraege={betroffen.slice(0, 5)} ohnePreis beiAenderung={laden} />
    </section>
  );
}
