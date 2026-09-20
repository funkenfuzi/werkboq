import { useCallback, useEffect, useState } from "react";
import {
  alsStunden,
  Symbol,
  type ErweiterungsProps,
} from "@werkboq/core";
import { dauer, summe, zeitenZuAuftrag, ZEITART_TEXT, type Zeit } from "../daten/zeiten";
import { Zeitmaske } from "./Zeitmaske";

/**
 * Der Zeiten-Block in der Auftragsakte.
 *
 * Hängt am Erweiterungspunkt "auftrag.abschnitt". Die Akte im Kern weiß
 * nichts davon — ist die Zeiterfassung nicht gekauft, fehlt der Block, und
 * die Akte sieht deswegen nicht kaputt aus, sondern nur kürzer.
 */
export function AuftragZeiten({ datensatzId }: ErweiterungsProps) {
  const [zeiten, setZeiten] = useState<Zeit[]>([]);
  const [zeitmaske, setZeitmaske] = useState(false);

  const laden = useCallback(() => {
    if (!datensatzId) return;
    zeitenZuAuftrag(datensatzId)
      .then(setZeiten)
      .catch(() => setZeiten([]));
  }, [datensatzId]);

  useEffect(laden, [laden]);

  if (!datensatzId) return null;

  return (
    <section className="wb-block">
      <div className="wb-block__kopf">
        <h2>Zeiten</h2>
        <span className="wb-block__summe">
          {alsStunden(summe(zeiten))} h gesamt · {alsStunden(summe(zeiten.filter((z) => z.verrechenbar)))} h
          verrechenbar
        </span>
        {!zeitmaske && (
          <button className="wb-button" type="button" onClick={() => setZeitmaske(true)}>
            <Symbol name="plus" groesse={18} />
            Zeit buchen
          </button>
        )}
      </div>

      {zeitmaske && (
        <Zeitmaske
          festerAuftrag={datensatzId}
          beiGespeichert={() => {
            setZeitmaske(false);
            laden();
          }}
          beiAbbruch={() => setZeitmaske(false)}
        />
      )}

      {zeiten.length === 0 ? (
        <p className="wb-leer">Noch keine Zeit auf diesen Auftrag gebucht.</p>
      ) : (
        <div className="wb-tabelle-rahmen">
          <table className="wb-tabelle">
            <thead>
              <tr>
                <th scope="col">Datum</th>
                <th scope="col">Mitarbeiter</th>
                <th scope="col">Von–Bis</th>
                <th scope="col">Dauer</th>
                <th scope="col">Art</th>
                <th scope="col">Tätigkeit</th>
              </tr>
            </thead>
            <tbody>
              {zeiten.map((z) => (
                <tr key={z.id}>
                  <td className="wb-tabelle__kennung">
                    {new Date(z.datum).toLocaleDateString("de-AT")}
                  </td>
                  <td>{z.benutzername}</td>
                  <td className="wb-tabelle__kennung">
                    {z.beginn}–{z.ende ?? "offen"}
                  </td>
                  <td className="wb-tabelle__kennung">
                    {alsStunden(dauer(z))} h
                    {!z.verrechenbar && <span className="wb-plakette">n. v.</span>}
                  </td>
                  <td>{ZEITART_TEXT[z.art]}</td>
                  <td className="wb-zelle--gedaempft">{z.taetigkeit || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
