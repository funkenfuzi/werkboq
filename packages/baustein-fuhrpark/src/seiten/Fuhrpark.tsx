import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  aktuellerRechtsraum,
  alleMitarbeiter,
  darfSchreiben,
  fehlersatz,
  Symbol,
  type Mitarbeiter,
} from "@werkboq/core";
import {
  alleFahrzeuge,
  FAHRZEUGART_TEXT,
  offeneFristen,
  type Fahrzeug,
  type Fahrzeugfrist,
} from "../daten/fahrzeuge";
import {
  faelligkeitstext,
  FRIST_FARBE,
  FRIST_TEXT,
  FRISTART_TEXT,
  heute,
  nachDringlichkeit,
  schlimmster,
  ueberFahrzeuge,
} from "../daten/fristen";
import { Fahrzeugmaske } from "../komponenten/Fahrzeugmaske";

/**
 * Der Fuhrpark beginnt nicht mit der Fahrzeugliste, sondern mit dem, was
 * abläuft. Wer diesen Menüpunkt öffnet, will meist genau das wissen — die
 * Liste steht darunter und läuft nicht weg.
 *
 * Dasselbe Muster wie im Personalwesen, und aus demselben Grund: das
 * Problem ist nie „welche Fahrzeuge haben wir", sondern „bei welchem
 * läuft etwas ab, ohne dass es jemandem auffällt".
 */
export function Fuhrpark() {
  const navigate = useNavigate();
  const raum = aktuellerRechtsraum();
  const [fahrzeuge, setFahrzeuge] = useState<Fahrzeug[]>([]);
  const [fristen, setFristen] = useState<Fahrzeugfrist[]>([]);
  const [leute, setLeute] = useState<Mitarbeiter[]>([]);
  const [zeigeStillgelegte, setZeigeStillgelegte] = useState(false);
  const [neu, setNeu] = useState(false);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  const darfAendern = darfSchreiben("fuhrpark");

  const laden = useCallback(() => {
    setLaedt(true);
    Promise.all([
      alleFahrzeuge(false),
      offeneFristen().catch(() => []),
      alleMitarbeiter().catch(() => []),
    ])
      .then(([f, fr, m]) => {
        setFahrzeuge(f);
        setFristen(fr);
        setLeute(m);
      })
      .catch((e: unknown) => setFehler(fehlersatz(e)))
      .finally(() => setLaedt(false));
  }, []);

  useEffect(laden, [laden]);

  const nachFahrzeug = new Map<string, Fahrzeugfrist[]>();
  for (const f of fristen) {
    if (!nachFahrzeug.has(f.fahrzeug)) nachFahrzeug.set(f.fahrzeug, []);
    nachFahrzeug.get(f.fahrzeug)!.push(f);
  }
  const namen = Object.fromEntries(leute.map((m) => [m.id, m.name]));
  const sichtbar = fahrzeuge.filter((f) => zeigeStillgelegte || f.aktiv !== false);

  /**
   * Alles, was brennt — über alle Fahrzeuge hinweg.
   *
   * JE FRIST EINZELN GERECHNET, mit dem Kilometerstand IHRES Fahrzeugs.
   * Über die ganze Liste auf einmal ginge es nicht: jede Frist hängt an
   * einem anderen Fahrzeug, und ein Service, der nach Kilometern
   * überfällig ist, fehlte hier sonst genau in dem Kasten, der zeigen
   * soll, was drängt.
   */
  const kmJeFahrzeug = new Map(fahrzeuge.map((f) => [f.id, f.kmStand]));
  const dringend = ueberFahrzeuge(fristen, kmJeFahrzeug).filter(
    (e) => e.zustand === "abgelaufen" || e.zustand === "faellig",
  );

  return (
    <article className="wb-seite">
      <header className="wb-seite__kopf">
        <div>
          <h1>Fuhrpark</h1>
          <p className="wb-seite__unterzeile">
            {raum.fahrzeugpruefung} nach {raum.fahrzeugpruefungParagraf}, Service, Reifen und was
            sonst abläuft.
          </p>
        </div>
        {darfAendern && !neu && (
          <button className="wb-button" type="button" onClick={() => setNeu(true)}>
            <Symbol name="plus" groesse={18} />
            Fahrzeug
          </button>
        )}
      </header>

      {fehler && (
        <p className="wb-fehler" role="alert">
          {fehler}
        </p>
      )}

      {neu && (
        <Fahrzeugmaske
          vorhanden={null}
          mitarbeiter={leute}
          beiGespeichert={() => {
            setNeu(false);
            laden();
          }}
          beiAbbruch={() => setNeu(false)}
        />
      )}

      {dringend.length > 0 && (
        <section className="wb-block">
          <div className="wb-block__kopf">
            <h2>Was ansteht</h2>
            <span className="wb-block__summe">{dringend.length}</span>
          </div>
          <ul className="wb-fristenliste">
            {dringend.map(({ frist, zustand }) => {
              const fz = fahrzeuge.find((f) => f.id === frist.fahrzeug);
              return (
                <li key={frist.id}>
                  <span className={`wb-plakette wb-plakette--${FRIST_FARBE[zustand]}`}>
                    {FRIST_TEXT[zustand]}
                  </span>
                  <button
                    type="button"
                    className="wb-fristenliste__was"
                    onClick={() => navigate(`/fuhrpark/${frist.fahrzeug}`)}
                  >
                    <strong>{fz?.kennzeichen ?? "Fahrzeug"}</strong>
                    <span>
                      {frist.titel || FRISTART_TEXT[frist.art]}
                      {fz?.bezeichnung ? ` · ${fz.bezeichnung}` : ""}
                    </span>
                  </button>
                  <span className="wb-fristenliste__wann">
                    {faelligkeitstext(frist, zustand, heute(), kmJeFahrzeug.get(frist.fahrzeug))}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="wb-block">
        <div className="wb-block__kopf">
          <h2>Fahrzeuge</h2>
          <span className="wb-block__summe">{sichtbar.length}</span>
          <label className="wb-schalter">
            <input
              type="checkbox"
              checked={zeigeStillgelegte}
              onChange={(e) => setZeigeStillgelegte(e.target.checked)}
            />
            Stillgelegte zeigen
          </label>
        </div>

        {laedt && sichtbar.length === 0 && <p className="wb-leer">Wird geladen …</p>}

        {!laedt && sichtbar.length === 0 ? (
          <p className="wb-leer">
            Noch kein Fahrzeug erfasst. Kennzeichen, Kilometerstand und die nächste{" "}
            {raum.fahrzeugpruefungKurz}-Fälligkeit reichen für den Anfang.
          </p>
        ) : (
          <div className="wb-tabelle-rahmen">
            <table className="wb-tabelle">
              <thead>
                <tr>
                  <th scope="col">Kennzeichen</th>
                  <th scope="col">Fahrzeug</th>
                  <th scope="col">Zugeordnet</th>
                  <th scope="col" className="wb-zelle--rechts">km</th>
                  <th scope="col">Nächste Frist</th>
                </tr>
              </thead>
              <tbody>
                {sichtbar.map((f) => {
                  const meine = nachFahrzeug.get(f.id) ?? [];
                  const zustand = schlimmster(meine, heute(), f.kmStand);
                  const naechste = nachDringlichkeit(meine, heute(), f.kmStand)[0];
                  return (
                    <tr
                      key={f.id}
                      className={`ist-klickbar${f.aktiv === false ? " ist-stillgelegt" : ""}`}
                      onClick={() => navigate(`/fuhrpark/${f.id}`)}
                    >
                      <td className="wb-tabelle__kennung">{f.kennzeichen}</td>
                      <td>
                        <span className="wb-zellname">
                          <span>
                            {f.bezeichnung}
                            <small>
                              {FAHRZEUGART_TEXT[f.art]}
                              {f.marke ? ` · ${f.marke} ${f.modell ?? ""}` : ""}
                            </small>
                          </span>
                        </span>
                      </td>
                      <td className="wb-zelle--gedaempft">
                        {f.mitarbeiter ? (namen[f.mitarbeiter] ?? "—") : "Pool"}
                      </td>
                      <td className="wb-zelle--rechts wb-tabelle__kennung">
                        {f.kmStand ? f.kmStand.toLocaleString("de-AT") : "—"}
                      </td>
                      <td>
                        <span className={`wb-plakette wb-plakette--${FRIST_FARBE[zustand]}`}>
                          {FRIST_TEXT[zustand]}
                        </span>
                        {naechste?.frist.faellig && (
                          <small className="wb-nebentext">
                            {" "}
                            {naechste.frist.titel || FRISTART_TEXT[naechste.frist.art]} ·{" "}
                            {new Date(
                              `${naechste.frist.faellig.slice(0, 10)}T00:00:00`,
                            ).toLocaleDateString("de-AT")}
                          </small>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </article>
  );
}
