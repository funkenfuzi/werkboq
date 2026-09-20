import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { aktuellerRechtsraum, alsEuro, fehlersatz, schreibweiseVon, Symbol } from "@werkboq/core";
import {
  BELEGART_TEXT,
  BELEGARTEN,
  belegeSuchen,
  faelligAm,
  STATUS_FARBE,
  STATUS_TEXT,
  ueberfaelligSeit,
  type Beleg,
  type Belegart,
} from "../daten/belege";
import { offenePosten, type OffenerPosten } from "../daten/zahlungen";

/**
 * Belege und offene Posten.
 *
 * Zwei Ansichten auf dieselben Daten: die Liste zeigt alles, die offenen
 * Posten zeigen, wo Geld fehlt. Letzteres ist der Grund, warum ein Betrieb
 * so ein Programm überhaupt öffnet.
 */
export function Belege() {
  const navigate = useNavigate();
  const sw = schreibweiseVon(aktuellerRechtsraum().id);
  const [ansicht, setAnsicht] = useState<"liste" | "offen">(
    () => (localStorage.getItem("wb-belege-ansicht") as "liste" | "offen") ?? "liste",
  );
  const [belege, setBelege] = useState<Beleg[]>([]);
  const [posten, setPosten] = useState<OffenerPosten[]>([]);
  const [art, setArt] = useState<Belegart | "alle">("alle");
  const [text, setText] = useState("");
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem("wb-belege-ansicht", ansicht);
  }, [ansicht]);

  const laden = useCallback(() => {
    setLaedt(true);
    Promise.all([belegeSuchen({}), offenePosten()])
      .then(([b, p]) => {
        setBelege(b);
        setPosten(p);
        setFehler(null);
      })
      .catch((e: unknown) => setFehler(fehlersatz(e)))
      .finally(() => setLaedt(false));
  }, []);

  useEffect(laden, [laden]);

  const gefiltert = useMemo(() => {
    const t = text.trim().toLowerCase();
    return belege.filter(
      (b) =>
        (art === "alle" || b.belegart === art) &&
        (t === "" ||
          b.nummer.toLowerCase().includes(t) ||
          b.empfaengerName.toLowerCase().includes(t)),
    );
  }, [belege, art, text]);

  const summeOffen = posten.reduce((s, p) => s + p.offen, 0);
  const summeUeberfaellig = posten
    .filter((p) => p.ueberfaellig > 0)
    .reduce((s, p) => s + p.offen, 0);

  return (
    <section>
      <div className="wb-kopf">
        <div>
          <h1>Belege</h1>
          <p className="wb-kopf__zahl">
            {alsEuro(summeOffen, sw)} offen
            {summeUeberfaellig > 0 && (
              <>
                {" · "}
                <strong className="wb-verzug">{alsEuro(summeUeberfaellig, sw)} überfällig</strong>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="wb-werkzeugleiste">
        <div className="wb-umschalter">
          <button
            type="button"
            className={ansicht === "liste" ? "ist-aktiv" : ""}
            onClick={() => setAnsicht("liste")}
          >
            Alle Belege
          </button>
          <button
            type="button"
            className={ansicht === "offen" ? "ist-aktiv" : ""}
            onClick={() => setAnsicht("offen")}
          >
            Offene Posten ({posten.length})
          </button>
        </div>

        {ansicht === "liste" && (
          <>
            <label className="wb-suchfeld">
              <Symbol name="suche" groesse={18} />
              <input
                type="search"
                placeholder="Nummer oder Empfänger"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </label>
            <div className="wb-umschalter">
              <button
                type="button"
                className={art === "alle" ? "ist-aktiv" : ""}
                onClick={() => setArt("alle")}
              >
                Alle
              </button>
              {BELEGARTEN.map((a) => (
                <button
                  key={a}
                  type="button"
                  className={art === a ? "ist-aktiv" : ""}
                  onClick={() => setArt(a)}
                >
                  {BELEGART_TEXT[a]}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {fehler && (
        <p className="wb-fehler" role="alert">
          {fehler}
        </p>
      )}

      {laedt && belege.length === 0 && <p className="wb-leer">Wird geladen …</p>}

      {!laedt && belege.length === 0 && (
        <div className="wb-nichts">
          <p>Noch keine Belege.</p>
          <p className="wb-leer">
            Ein Beleg entsteht am Auftrag: dort stehen die Positionen und die Stunden, aus denen
            er gemacht wird.
          </p>
        </div>
      )}

      {ansicht === "liste" && gefiltert.length > 0 && (
        <div className="wb-tabelle-rahmen">
          <table className="wb-tabelle">
            <thead>
              <tr>
                <th scope="col">Nummer</th>
                <th scope="col">Art</th>
                <th scope="col">Empfänger</th>
                <th scope="col">Datum</th>
                <th scope="col">Status</th>
                <th scope="col" className="wb-zelle--rechts">Netto</th>
                <th scope="col" className="wb-zelle--rechts">Brutto</th>
              </tr>
            </thead>
            <tbody>
              {gefiltert.map((b) => (
                <tr
                  key={b.id}
                  className="ist-klickbar"
                  tabIndex={0}
                  onClick={() => navigate(`/belege/${b.id}`)}
                  onKeyDown={(e) => e.key === "Enter" && navigate(`/belege/${b.id}`)}
                >
                  <td className="wb-tabelle__kennung">{b.nummer}</td>
                  <td>{BELEGART_TEXT[b.belegart]}</td>
                  <td>{b.empfaengerName}</td>
                  <td className="wb-tabelle__kennung">
                    {new Date(b.datum).toLocaleDateString("de-AT")}
                  </td>
                  <td>
                    <span className={`wb-plakette wb-plakette--${STATUS_FARBE[b.status]}`}>
                      {STATUS_TEXT[b.status]}
                    </span>
                  </td>
                  <td className="wb-zelle--rechts wb-tabelle__kennung">{alsEuro(b.netto, sw)}</td>
                  <td className="wb-zelle--rechts wb-tabelle__kennung wb-zelle--betont">
                    {alsEuro(b.brutto, sw)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ansicht === "offen" &&
        (posten.length === 0 ? (
          <div className="wb-nichts">
            <p>Nichts offen.</p>
            <p className="wb-leer">Alle gestellten Rechnungen sind bezahlt.</p>
          </div>
        ) : (
          <div className="wb-tabelle-rahmen">
            <table className="wb-tabelle">
              <thead>
                <tr>
                  <th scope="col">Nummer</th>
                  <th scope="col">Empfänger</th>
                  <th scope="col">Fällig</th>
                  <th scope="col" className="wb-zelle--rechts">Verzug</th>
                  <th scope="col" className="wb-zelle--rechts">Brutto</th>
                  <th scope="col" className="wb-zelle--rechts">Bezahlt</th>
                  <th scope="col" className="wb-zelle--rechts">Offen</th>
                </tr>
              </thead>
              <tbody>
                {posten.map((p) => (
                  <tr
                    key={p.beleg.id}
                    className={`ist-klickbar${p.ueberfaellig > 0 ? " ist-ueberfaellig" : ""}`}
                    tabIndex={0}
                    onClick={() => navigate(`/belege/${p.beleg.id}`)}
                    onKeyDown={(e) => e.key === "Enter" && navigate(`/belege/${p.beleg.id}`)}
                  >
                    <td className="wb-tabelle__kennung">{p.beleg.nummer}</td>
                    <td>{p.beleg.empfaengerName}</td>
                    <td className="wb-tabelle__kennung">
                      {new Date(faelligAm(p.beleg)).toLocaleDateString("de-AT")}
                    </td>
                    <td className="wb-zelle--rechts wb-tabelle__kennung">
                      {p.ueberfaellig > 0 ? (
                        <strong className="wb-verzug">{p.ueberfaellig} Tage</strong>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="wb-zelle--rechts wb-tabelle__kennung">
                      {alsEuro(p.beleg.brutto, sw)}
                    </td>
                    <td className="wb-zelle--rechts wb-tabelle__kennung wb-zelle--gedaempft">
                      {p.bezahlt ? alsEuro(p.bezahlt, sw) : "—"}
                    </td>
                    <td className="wb-zelle--rechts wb-tabelle__kennung wb-zelle--betont">
                      {alsEuro(p.offen, sw)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </section>
  );
}

/** Für die Startseite: wie viel steht aus, wie viel davon überfällig. */
export function offeneSumme(posten: OffenerPosten[]): { offen: number; ueberfaellig: number } {
  return {
    offen: posten.reduce((s, p) => s + p.offen, 0),
    ueberfaellig: posten.filter((p) => p.ueberfaellig > 0).reduce((s, p) => s + p.offen, 0),
  };
}

export { ueberfaelligSeit };
