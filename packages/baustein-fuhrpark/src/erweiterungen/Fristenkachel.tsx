import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fehlersatz, Symbol } from "@werkboq/core";
import { alleFahrzeuge, offeneFristen, type Fahrzeug, type Fahrzeugfrist } from "../daten/fahrzeuge";
import {
  faelligkeitstext,
  FRIST_FARBE,
  FRIST_TEXT,
  FRISTART_TEXT,
  heute,
  ueberFahrzeuge,
} from "../daten/fristen";

/**
 * Was am Fuhrpark abläuft — auf der Startseite.
 *
 * Hängt an "dashboard.kachel". Eine Frist, die nur im Fuhrparkmenü steht,
 * sieht der Betrieb an dem Tag, an dem er ins Fuhrparkmenü schaut — und
 * das ist meist der Tag, an dem schon etwas passiert ist. Die Startseite
 * ist die Seite, die täglich offen ist.
 *
 * Steht nichts an, erscheint die Kachel gar nicht. Eine Kachel, die
 * dauernd „alles in Ordnung" meldet, wird nach einer Woche überlesen —
 * und dann auch an dem Tag, an dem sie etwas anderes sagt.
 */
export function Fristenkachel() {
  const [fristen, setFristen] = useState<Fahrzeugfrist[]>([]);
  const [fahrzeuge, setFahrzeuge] = useState<Fahrzeug[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([offeneFristen(), alleFahrzeuge(true)])
      .then(([fr, fz]) => {
        setFristen(fr);
        setFahrzeuge(fz);
      })
      .catch((e: unknown) => setFehler(fehlersatz(e)));
  }, []);

  if (fehler) return null;

  const kmJeFahrzeug = new Map(fahrzeuge.map((f) => [f.id, f.kmStand]));
  const dringend = ueberFahrzeuge(fristen, kmJeFahrzeug).filter(
    (e) => e.zustand === "abgelaufen" || e.zustand === "faellig",
  );

  if (!dringend.length) return null;

  return (
    <section className="wb-block">
      <div className="wb-block__kopf">
        <h2>Fuhrpark</h2>
        <span className="wb-block__summe">{dringend.length}</span>
        <Link className="wb-button wb-button--sekundaer wb-button--klein" to="/fuhrpark">
          Alle ansehen
        </Link>
      </div>
      <ul className="wb-fristenliste">
        {dringend.slice(0, 5).map(({ frist, zustand }) => {
          const fz = fahrzeuge.find((f) => f.id === frist.fahrzeug);
          return (
            <li key={frist.id}>
              <span className={`wb-plakette wb-plakette--${FRIST_FARBE[zustand]}`}>
                {FRIST_TEXT[zustand]}
              </span>
              <Link className="wb-fristenliste__was" to={`/fuhrpark/${frist.fahrzeug}`}>
                <strong>{fz?.kennzeichen ?? "Fahrzeug"}</strong>
                <span>{frist.titel || FRISTART_TEXT[frist.art]}</span>
              </Link>
              <span className="wb-fristenliste__wann">
                {faelligkeitstext(frist, zustand, heute(), kmJeFahrzeug.get(frist.fahrzeug))}
              </span>
            </li>
          );
        })}
      </ul>
      {dringend.length > 5 && (
        <p className="wb-notiz">
          <Symbol name="warnung" groesse={14} /> und {dringend.length - 5} weitere.
        </p>
      )}
    </section>
  );
}
