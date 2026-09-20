import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  alleMitarbeiter,
  darfSchreiben,
  fehlersatz,
  FUNKTION_TEXT,
  kurz,
  Symbol,
  type Mitarbeiter,
} from "@werkboq/core";
import { offeneAntraege, ART_TEXT, type Abwesenheit } from "../daten/abwesenheiten";
import { dokumenteMitFrist, zuErledigen, FRIST_FARBE, FRIST_TEXT } from "../daten/dokumente";
import { Mitarbeitermaske } from "../komponenten/Mitarbeitermaske";

/**
 * Das Personalwesen beginnt nicht mit einer Liste, sondern mit dem, was
 * liegen geblieben ist: offene Urlaubsanträge und abgelaufene
 * Unterweisungen. Wer diesen Menüpunkt öffnet, will meist genau das wissen
 * — die Liste steht darunter und läuft ohnehin nicht weg.
 */
export function Personal() {
  const navigate = useNavigate();
  const [liste, setListe] = useState<Mitarbeiter[]>([]);
  const [antraege, setAntraege] = useState<Abwesenheit[]>([]);
  const [fristen, setFristen] = useState<ReturnType<typeof zuErledigen>>([]);
  const [zeigeStillgelegte, setZeigeStillgelegte] = useState(false);
  const [suche, setSuche] = useState("");
  const [neu, setNeu] = useState(false);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  const darfAendern = darfSchreiben("personal");

  const laden = useCallback(() => {
    setLaedt(true);
    Promise.all([
      alleMitarbeiter(),
      offeneAntraege().catch(() => []),
      dokumenteMitFrist().catch(() => []),
    ])
      .then(([m, a, d]) => {
        setListe(m);
        setAntraege(a);
        setFristen(zuErledigen(d));
      })
      .catch((e: unknown) => setFehler(fehlersatz(e)))
      .finally(() => setLaedt(false));
  }, []);

  useEffect(laden, [laden]);

  const namen = useMemo(
    () => Object.fromEntries(liste.map((m) => [m.id, m.name])),
    [liste],
  );

  const gefiltert = liste
    .filter((m) => zeigeStillgelegte || m.aktiv !== false)
    .filter((m) =>
      suche.trim() === ""
        ? true
        : `${m.name} ${m.kurzzeichen ?? ""} ${FUNKTION_TEXT[m.funktion]}`
            .toLowerCase()
            .includes(suche.trim().toLowerCase()),
    );

  return (
    <article className="wb-seite">
      <header className="wb-seite__kopf">
        <h1>Personalwesen</h1>
        {darfAendern && !neu && (
          <button className="wb-button" type="button" onClick={() => setNeu(true)}>
            <Symbol name="plus" groesse={18} />
            Neuer Mitarbeiter
          </button>
        )}
      </header>

      {fehler && (
        <p className="wb-fehler" role="alert">
          {fehler}
        </p>
      )}

      {(antraege.length > 0 || fristen.length > 0) && (
        <div className="wb-personal__aufmerksam">
          {antraege.length > 0 && (
            <section className="wb-block">
              <div className="wb-block__kopf">
                <h2>Offene Anträge</h2>
                <span className="wb-block__summe">{antraege.length}</span>
              </div>
              <ul className="wb-merkliste">
                {antraege.slice(0, 6).map((a) => (
                  <li key={a.id}>
                    <Link to={`/personal/${a.mitarbeiter}?reiter=abwesenheiten`}>
                      {namen[a.mitarbeiter] ?? "Mitarbeiter"}
                    </Link>{" "}
                    — {ART_TEXT[a.art]}, {datum(a.von)} bis {datum(a.bis)} (
                    {String(a.tage ?? 0).replace(".", ",")} Tage)
                  </li>
                ))}
              </ul>
            </section>
          )}

          {fristen.length > 0 && (
            <section className="wb-block">
              <div className="wb-block__kopf">
                <h2>Fristen</h2>
                <span className="wb-block__summe">{fristen.length}</span>
              </div>
              <ul className="wb-merkliste">
                {fristen.slice(0, 6).map(({ dokument, zustand, tage }) => (
                  <li key={dokument.id}>
                    <span className={`wb-plakette wb-plakette--${FRIST_FARBE[zustand]}`}>
                      {FRIST_TEXT[zustand]}
                    </span>{" "}
                    <Link to={`/personal/${dokument.mitarbeiter}?reiter=dokumente`}>
                      {namen[dokument.mitarbeiter] ?? "Mitarbeiter"}
                    </Link>{" "}
                    — {dokument.titel},{" "}
                    {tage < 0 ? `seit ${Math.abs(tage)} Tagen abgelaufen` : `in ${tage} Tagen`}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {neu && (
        <section className="wb-block">
          <h2>Neuer Mitarbeiter</h2>
          <Mitarbeitermaske
            vorhanden={null}
            beiGespeichert={(angelegt) => {
              setNeu(false);
              laden();
              if (angelegt) navigate(`/personal/${angelegt.id}`);
            }}
            beiAbbruch={() => setNeu(false)}
          />
        </section>
      )}

      <div className="wb-werkzeugleiste">
        <label className="wb-suchfeld">
          <Symbol name="suche" groesse={18} />
          <input
            type="search"
            value={suche}
            placeholder="Name oder Funktion"
            onChange={(e) => setSuche(e.target.value)}
          />
        </label>
        <label className="wb-schalter wb-schalter--eng">
          <input
            type="checkbox"
            checked={zeigeStillgelegte}
            onChange={(e) => setZeigeStillgelegte(e.target.checked)}
          />
          <span>Stillgelegte zeigen</span>
        </label>
      </div>

      {laedt && liste.length === 0 && <p className="wb-leer">Wird geladen …</p>}

      {!laedt && gefiltert.length === 0 && (
        <p className="wb-leer">Niemand gefunden.</p>
      )}

      {gefiltert.length > 0 && (
        <div className="wb-tabelle-rahmen">
          <table className="wb-tabelle">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Funktion</th>
                <th scope="col">Telefon</th>
                <th scope="col" className="wb-zelle--rechts">Wochenstunden</th>
                <th scope="col">Zugang</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {gefiltert.map((m) => (
                <tr
                  key={m.id}
                  className={`wb-zeile--klickbar ${m.aktiv === false ? "ist-stillgelegt" : ""}`}
                  onClick={() => navigate(`/personal/${m.id}`)}
                >
                  <td>
                    <span className="wb-zellname">
                      <span
                        className="wb-initialen wb-initialen--klein"
                        style={{ background: m.farbe || undefined }}
                        aria-hidden="true"
                      >
                        {kurz(m)}
                      </span>
                      {m.name}
                    </span>
                  </td>
                  <td>{FUNKTION_TEXT[m.funktion]}</td>
                  <td>{m.telefon || "—"}</td>
                  <td className="wb-zelle--rechts wb-tabelle__kennung">
                    {m.wochenstunden ? String(m.wochenstunden).replace(".", ",") : "—"}
                  </td>
                  <td>{m.benutzer ? "ja" : "—"}</td>
                  <td>
                    {m.aktiv === false ? (
                      <span className="wb-plakette">stillgelegt</span>
                    ) : (
                      <span className="wb-plakette wb-plakette--ok">aktiv</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!darfAendern && (
        <p className="wb-leer wb-notiz">
          Du hast auf das Personalwesen nur Leserecht. Ändern darf, wer dafür freigeschaltet ist.
        </p>
      )}
    </article>
  );
}

function datum(t: string): string {
  return new Date(`${t.slice(0, 10)}T00:00:00`).toLocaleDateString("de-AT");
}
