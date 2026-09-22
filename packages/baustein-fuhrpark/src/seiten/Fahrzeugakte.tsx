import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  alleMitarbeiter,
  darfSchreiben,
  fehlersatz,
  Symbol,
  type Mitarbeiter,
} from "@werkboq/core";
import {
  FAHRZEUGART_TEXT,
  fahrzeugLaden,
  fahrzeugStilllegen,
  fristenZuFahrzeug,
  kmNachtragen,
  type Fahrzeug,
  type Fahrzeugfrist,
} from "../daten/fahrzeuge";
import { Fahrzeugmaske } from "../komponenten/Fahrzeugmaske";
import { Fristenblock } from "../komponenten/Fristenblock";

export function Fahrzeugakte() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [fahrzeug, setFahrzeug] = useState<Fahrzeug | null>(null);
  const [fristen, setFristen] = useState<Fahrzeugfrist[]>([]);
  const [leute, setLeute] = useState<Mitarbeiter[]>([]);
  const [bearbeiten, setBearbeiten] = useState(false);
  const [kmMaske, setKmMaske] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const darfAendern = darfSchreiben("fuhrpark");

  const laden = useCallback(() => {
    if (!id) return;
    Promise.all([fahrzeugLaden(id), fristenZuFahrzeug(id), alleMitarbeiter().catch(() => [])])
      .then(([f, fr, m]) => {
        setFahrzeug(f);
        setFristen(fr);
        setLeute(m);
      })
      .catch((e: unknown) => setFehler(fehlersatz(e)));
  }, [id]);

  useEffect(laden, [laden]);

  if (fehler && !fahrzeug) {
    return (
      <article className="wb-seite">
        <p className="wb-fehler" role="alert">
          {fehler}
        </p>
      </article>
    );
  }
  if (!fahrzeug) return <p className="wb-leer">Wird geladen …</p>;

  const fahrer = fahrzeug.mitarbeiter
    ? (leute.find((m) => m.id === fahrzeug.mitarbeiter)?.name ?? "—")
    : "Poolfahrzeug";

  async function stilllegen() {
    if (!fahrzeug) return;
    if (!confirm(`${fahrzeug.kennzeichen} stilllegen? Die Fristenhistorie bleibt erhalten.`)) return;
    try {
      await fahrzeugStilllegen(fahrzeug);
      navigate("/fuhrpark");
    } catch (e: unknown) {
      setFehler(fehlersatz(e));
    }
  }

  return (
    <article className="wb-seite">
      <header className="wb-seite__kopf">
        <div>
          <button
            type="button"
            className="wb-button wb-button--sekundaer wb-button--klein"
            onClick={() => navigate("/fuhrpark")}
          >
            <Symbol name="zurueck" groesse={16} />
            Fuhrpark
          </button>
          <h1>
            {fahrzeug.kennzeichen}
            {fahrzeug.aktiv === false && <span className="wb-plakette"> stillgelegt</span>}
          </h1>
          <p className="wb-seite__unterzeile">
            {fahrzeug.bezeichnung} · {FAHRZEUGART_TEXT[fahrzeug.art]}
            {fahrzeug.marke ? ` · ${fahrzeug.marke} ${fahrzeug.modell ?? ""}` : ""}
          </p>
        </div>
        {darfAendern && !bearbeiten && (
          <div className="wb-aktionen">
            <button
              className="wb-button wb-button--sekundaer"
              type="button"
              onClick={() => setBearbeiten(true)}
            >
              <Symbol name="stift" groesse={18} />
              Bearbeiten
            </button>
            {fahrzeug.aktiv !== false && (
              <button
                className="wb-button wb-button--sekundaer"
                type="button"
                onClick={() => void stilllegen()}
              >
                Stilllegen
              </button>
            )}
          </div>
        )}
      </header>

      {fehler && (
        <p className="wb-fehler" role="alert">
          {fehler}
        </p>
      )}

      {bearbeiten ? (
        <Fahrzeugmaske
          vorhanden={fahrzeug}
          mitarbeiter={leute}
          beiGespeichert={() => {
            setBearbeiten(false);
            laden();
          }}
          beiAbbruch={() => setBearbeiten(false)}
        />
      ) : (
        <section className="wb-block">
          <div className="wb-block__kopf">
            <h2>Stammdaten</h2>
            {darfAendern && !kmMaske && (
              <button
                className="wb-button wb-button--sekundaer wb-button--klein"
                type="button"
                onClick={() => setKmMaske(true)}
              >
                Kilometer nachtragen
              </button>
            )}
          </div>

          {kmMaske && (
            <KmMaske
              fahrzeug={fahrzeug}
              beiFertig={() => {
                setKmMaske(false);
                laden();
              }}
              beiAbbruch={() => setKmMaske(false)}
              beiFehler={setFehler}
            />
          )}

          <dl className="wb-daten">
            <div>
              <dt>Zugeordnet</dt>
              <dd>{fahrer}</dd>
            </div>
            <div>
              <dt>Kilometerstand</dt>
              <dd>
                {fahrzeug.kmStand ? `${fahrzeug.kmStand.toLocaleString("de-AT")} km` : "—"}
                {fahrzeug.kmStandAm && (
                  <small className="wb-nebentext">
                    {" "}
                    vom{" "}
                    {new Date(`${fahrzeug.kmStandAm.slice(0, 10)}T00:00:00`).toLocaleDateString(
                      "de-AT",
                    )}
                  </small>
                )}
              </dd>
            </div>
            {fahrzeug.erstzulassung && (
              <div>
                <dt>Erstzulassung</dt>
                <dd>
                  {new Date(`${fahrzeug.erstzulassung.slice(0, 10)}T00:00:00`).toLocaleDateString(
                    "de-AT",
                  )}
                </dd>
              </div>
            )}
            {fahrzeug.notiz && (
              <div>
                <dt>Notiz</dt>
                <dd>{fahrzeug.notiz}</dd>
              </div>
            )}
          </dl>
        </section>
      )}

      <Fristenblock fahrzeug={fahrzeug} fristen={fristen} beiAenderung={laden} />
    </article>
  );
}

function KmMaske({
  fahrzeug,
  beiFertig,
  beiAbbruch,
  beiFehler,
}: {
  fahrzeug: Fahrzeug;
  beiFertig: () => void;
  beiAbbruch: () => void;
  beiFehler: (f: string) => void;
}) {
  const [stand, setStand] = useState(fahrzeug.kmStand ?? 0);
  const [laeuft, setLaeuft] = useState(false);

  return (
    <div className="wb-maske">
      <label className="wb-feld">
        <span>Kilometerstand</span>
        <input
          type="number"
          min={0}
          value={stand}
          onChange={(e) => setStand(Number(e.target.value))}
        />
        <small className="wb-notiz">
          Bisher {(fahrzeug.kmStand ?? 0).toLocaleString("de-AT")} km. Rückwärts geht nicht — ein
          Tacho zählt nicht zurück.
        </small>
      </label>
      <div className="wb-aktionen wb-feld--breit">
        <button
          className="wb-button"
          type="button"
          disabled={laeuft}
          onClick={() => {
            setLaeuft(true);
            kmNachtragen(fahrzeug, stand)
              .then(beiFertig)
              .catch((e: unknown) => beiFehler(e instanceof Error ? e.message : String(e)))
              .finally(() => setLaeuft(false));
          }}
        >
          Eintragen
        </button>
        <button className="wb-button wb-button--sekundaer" type="button" onClick={beiAbbruch}>
          Abbrechen
        </button>
      </div>
    </div>
  );
}
