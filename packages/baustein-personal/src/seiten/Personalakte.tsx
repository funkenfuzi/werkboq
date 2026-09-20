import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  darfSchreiben,
  fehlersatz,
  FUNKTION_TEXT,
  kurz,
  mitarbeiterLaden,
  mitarbeiterStilllegen,
  Symbol,
  Zugangsblock,
  type Mitarbeiter,
} from "@werkboq/core";
import { Mitarbeitermaske } from "../komponenten/Mitarbeitermaske";
import { Aktenblatt } from "../komponenten/Aktenblatt";
import { Abwesenheitsblock } from "../komponenten/Abwesenheitsblock";
import { Dokumentenblock } from "../komponenten/Dokumentenblock";
import { Stundenblock } from "../komponenten/Stundenblock";

const REITER = [
  { id: "stammdaten", titel: "Stammdaten" },
  { id: "akte", titel: "Personalakte" },
  { id: "abwesenheiten", titel: "Abwesenheiten" },
  { id: "dokumente", titel: "Dokumente" },
  { id: "stunden", titel: "Stunden" },
  { id: "zugang", titel: "Zugang" },
] as const;

type Reiter = (typeof REITER)[number]["id"];

/**
 * Die Akte eines Mitarbeiters.
 *
 * Reiter statt einer langen Seite, weil die Teile unterschiedlich oft
 * gebraucht werden und unterschiedlich heikel sind: Stammdaten ändert man
 * einmal im Jahr, Abwesenheiten jede Woche, und die Personalakte öffnet man
 * am besten selten. Der Reiter steht in der Adresse, damit ein Hinweis von
 * der Übersicht direkt dorthin führen kann, wo etwas zu tun ist.
 */
export function Personalakte() {
  const { id } = useParams<{ id: string }>();
  const [suchparameter, setzeSuchparameter] = useSearchParams();
  const [mitarbeiter, setMitarbeiter] = useState<Mitarbeiter | null>(null);
  const [bearbeitet, setBearbeitet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(true);

  const darfAendern = darfSchreiben("personal");
  const gewaehlt = (suchparameter.get("reiter") ?? "stammdaten") as Reiter;

  const laden = useCallback(() => {
    if (!id) return;
    setLaedt(true);
    mitarbeiterLaden(id)
      .then(setMitarbeiter)
      .catch((e: unknown) => setFehler(fehlersatz(e)))
      .finally(() => setLaedt(false));
  }, [id]);

  useEffect(laden, [laden]);

  function reiterWaehlen(r: Reiter) {
    const neu = new URLSearchParams(suchparameter);
    neu.set("reiter", r);
    setzeSuchparameter(neu, { replace: true });
  }

  if (laedt && !mitarbeiter) return <p className="wb-leer">Wird geladen …</p>;

  if (!mitarbeiter) {
    return (
      <div className="wb-nichts">
        <p>{fehler ?? "Dieser Mitarbeiter existiert nicht."}</p>
        <Link className="wb-button wb-button--sekundaer" to="/personal">
          Zurück zur Liste
        </Link>
      </div>
    );
  }

  return (
    <article className="wb-akte">
      <header className="wb-akte__kopf">
        <div>
          <p className="wb-akte__kennung">
            <Link to="/personal">Personalwesen</Link> · {FUNKTION_TEXT[mitarbeiter.funktion]}
          </p>
          <h1>
            <span
              className="wb-initialen"
              style={{ background: mitarbeiter.farbe || undefined }}
              aria-hidden="true"
            >
              {kurz(mitarbeiter)}
            </span>
            {mitarbeiter.name}
          </h1>
          <p className="wb-akte__unterzeile">
            {mitarbeiter.aktiv === false ? (
              <span className="wb-plakette">stillgelegt</span>
            ) : (
              <span className="wb-plakette wb-plakette--ok">aktiv</span>
            )}
            {mitarbeiter.telefon && <span>{mitarbeiter.telefon}</span>}
            {mitarbeiter.email && <span>{mitarbeiter.email}</span>}
          </p>
        </div>

        {darfAendern && mitarbeiter.aktiv !== false && (
          <button
            className="wb-button wb-button--sekundaer"
            type="button"
            onClick={() => {
              if (
                !confirm(
                  `${mitarbeiter.name} stilllegen? Zeiten, Termine und die Akte bleiben erhalten.`,
                )
              )
                return;
              void mitarbeiterStilllegen(mitarbeiter).then(laden);
            }}
          >
            Stilllegen
          </button>
        )}
      </header>

      {fehler && (
        <p className="wb-fehler" role="alert">
          {fehler}
        </p>
      )}

      <nav className="wb-reiter" aria-label="Bereiche der Personalakte">
        {REITER.map((r) => (
          <button
            key={r.id}
            type="button"
            className={`wb-reiter__knopf ${gewaehlt === r.id ? "ist-aktiv" : ""}`}
            aria-current={gewaehlt === r.id ? "page" : undefined}
            onClick={() => reiterWaehlen(r.id)}
          >
            {r.titel}
          </button>
        ))}
      </nav>

      {gewaehlt === "stammdaten" && (
        <section className="wb-block">
          {bearbeitet ? (
            <Mitarbeitermaske
              vorhanden={mitarbeiter}
              beiGespeichert={() => {
                setBearbeitet(false);
                laden();
              }}
              beiAbbruch={() => setBearbeitet(false)}
            />
          ) : (
            <>
              <div className="wb-block__kopf">
                <h2>Stammdaten</h2>
                {darfAendern && (
                  <button
                    className="wb-button wb-button--sekundaer"
                    type="button"
                    onClick={() => setBearbeitet(true)}
                  >
                    <Symbol name="stift" groesse={16} />
                    Bearbeiten
                  </button>
                )}
              </div>
              <dl className="wb-daten">
                <Fakt begriff="Funktion" wert={FUNKTION_TEXT[mitarbeiter.funktion]} />
                <Fakt begriff="Kurzzeichen" wert={mitarbeiter.kurzzeichen} />
                <Fakt begriff="Telefon" wert={mitarbeiter.telefon} />
                <Fakt begriff="E-Mail" wert={mitarbeiter.email} />
                <Fakt
                  begriff="Wochenstunden"
                  wert={
                    mitarbeiter.wochenstunden
                      ? String(mitarbeiter.wochenstunden).replace(".", ",")
                      : undefined
                  }
                />
                <Fakt begriff="Notizen" wert={mitarbeiter.notizen} />
              </dl>
            </>
          )}
        </section>
      )}

      {gewaehlt === "akte" && <Aktenblatt mitarbeiter={mitarbeiter} darfAendern={darfAendern} />}

      {gewaehlt === "abwesenheiten" && (
        <Abwesenheitsblock mitarbeiter={mitarbeiter} darfAendern={darfAendern} />
      )}

      {gewaehlt === "dokumente" && (
        <Dokumentenblock mitarbeiter={mitarbeiter} darfAendern={darfAendern} />
      )}

      {gewaehlt === "stunden" && <Stundenblock mitarbeiter={mitarbeiter} />}

      {gewaehlt === "zugang" && <Zugangsblock mitarbeiter={mitarbeiter} beiAenderung={laden} />}
    </article>
  );
}

function Fakt({ begriff, wert }: { begriff: string; wert?: string }) {
  if (!wert) return null;
  return (
    <div>
      <dt>{begriff}</dt>
      <dd>{wert}</dd>
    </div>
  );
}
