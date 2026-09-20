import { useEffect, useState } from "react";
import {
  alleModule,
  bausteineSetzen,
  betriebLaden,
  freigegebeneBausteine,
  Symbol,
  type Betrieb,
  type WerkboqModul,
} from "@werkboq/core";

/**
 * Welche Bausteine dieser Betrieb hat.
 *
 * Bewusst offen und ohne Sperre: Werkboq läuft auf der PocketBase des
 * Kunden, jede Verriegelung im Browser wäre dort in fünf Minuten umgangen
 * und würde nur ehrliche Anwender behindern. Diese Liste sagt also "das
 * gehört zu diesem Betrieb" und räumt auf, was nicht gebraucht wird — sie
 * verkauft nichts.
 */
export function Bausteinverwaltung() {
  const [betrieb, setBetrieb] = useState<Betrieb | null>(null);
  const [gewaehlt, setGewaehlt] = useState<string[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);

  const module = alleModule();
  const bausteine = module.filter((m) => (m.art ?? "fachmodul") === "baustein");
  const fachmodule = module.filter((m) => (m.art ?? "fachmodul") !== "baustein");

  useEffect(() => {
    betriebLaden()
      .then((b) => {
        setBetrieb(b);
        const gespeichert = freigegebeneBausteine();
        setGewaehlt(gespeichert.length === 0 ? module.map((m) => m.id) : gespeichert);
      })
      .catch((e: unknown) => setFehler(e instanceof Error ? e.message : String(e)))
      .finally(() => setLaedt(false));
    // module ändert sich zur Laufzeit nicht — sie werden beim Start registriert.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function umschalten(id: string) {
    setGewaehlt((v) => (v.includes(id) ? v.filter((x) => x !== id) : [...v, id]));
  }

  async function speichern() {
    if (!betrieb) return;
    try {
      await bausteineSetzen(betrieb.id, gewaehlt);
      setHinweis("Gespeichert. Die Seite einmal neu laden, damit die Navigation stimmt.");
      setFehler(null);
    } catch (e: unknown) {
      setFehler(e instanceof Error ? e.message : String(e));
      setHinweis(null);
    }
  }

  if (laedt) return <p className="wb-leer">Wird geladen …</p>;
  if (!betrieb) {
    return (
      <div className="wb-nichts">
        <p>Es gibt noch keinen Betriebsdatensatz.</p>
        <p className="wb-leer">
          Einmal <code>npm run einrichten</code> laufen lassen — das legt ihn an.
        </p>
      </div>
    );
  }

  return (
    <>
      <p className="wb-warnkasten wb-warnkasten--ruhig">
        <Symbol name="warnung" groesse={18} />
        <span>
          Was hier abgeschaltet ist, verschwindet aus der Oberfläche — die Daten bleiben
          erhalten und sind nach dem Wiedereinschalten wieder da. Das ist ein Aufräumschalter,
          keine Sperre: wer Zugriff auf die Datenbank hat, schaltet ihn ohnehin um.
        </span>
      </p>

      <div className="wb-bausteine">
        <Gruppe titel="Bausteine" module={bausteine} gewaehlt={gewaehlt} beiKlick={umschalten} />
        <Gruppe
          titel="Fachmodule"
          module={fachmodule}
          gewaehlt={gewaehlt}
          beiKlick={umschalten}
        />
      </div>

      {fehler && (
        <p className="wb-fehler" role="alert">
          {fehler}
        </p>
      )}
      {hinweis && (
        <p className="wb-hinweis" role="status">
          {hinweis}
        </p>
      )}

      <div className="wb-aktionen">
        <button className="wb-button" type="button" onClick={() => void speichern()}>
          Speichern
        </button>
      </div>
    </>
  );
}

/** Modulkennung als Name, wie ihn der Betrieb kennt. */
function anzeigename(id: string): string {
  return alleModule().find((m) => m.id === id)?.name ?? id;
}

function Gruppe({
  titel,
  module,
  gewaehlt,
  beiKlick,
}: {
  titel: string;
  module: WerkboqModul[];
  gewaehlt: string[];
  beiKlick: (id: string) => void;
}) {
  if (module.length === 0) return null;
  return (
    <section>
      <h2 className="wb-bausteine__titel">{titel}</h2>
      <div className="wb-bausteine__liste">
        {module.map((m) => (
          <label
            key={m.id}
            className={`wb-baustein${gewaehlt.includes(m.id) ? " ist-aktiv" : ""}`}
          >
            <input
              type="checkbox"
              checked={gewaehlt.includes(m.id)}
              onChange={() => beiKlick(m.id)}
            />
            <span>
              <strong>{m.name}</strong>
              <small>{m.beschreibung ?? "—"}</small>
              {m.ergaenzt && m.ergaenzt.length > 0 && (
                <small className="wb-baustein__ergaenzt">
                  Zeigt mehr, wenn dabei: {m.ergaenzt.map(anzeigename).join(", ")}
                </small>
              )}
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}
