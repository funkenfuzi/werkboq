import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Symbol,
  AUFTRAG_PHASEN,
  auftraegeSuchen,
  nachPhase,
  phaseSetzen,
  PHASENFARBE,
  AUFTRAGSART_TEXT,
  artVon,
  PHASENTEXT,
  type Auftrag,
  type AuftragPhase,
  type Kunde,
} from "@werkboq/core";

/**
 * Aufträge — als Liste oder als Phasenbrett.
 *
 * Das Brett ist keine zweite Datenhaltung, nur eine andere Sicht auf dasselbe
 * Feld `phase`. Ziehen einer Karte in eine andere Spalte ist exakt derselbe
 * Vorgang wie das Ändern der Phase im Formular, inklusive Verlaufseintrag.
 *
 * Die Ansicht merkt sich, welche Darstellung zuletzt gewählt war — wer mit dem
 * Brett arbeitet, will es beim nächsten Öffnen wieder sehen.
 */

type Ansicht = "brett" | "liste";
const SCHLUESSEL = "werkboq.auftraege.ansicht";

export function Auftraege() {
  const [ansicht, setAnsicht] = useState<Ansicht>(() => {
    try {
      return localStorage.getItem(SCHLUESSEL) === "liste" ? "liste" : "brett";
    } catch {
      return "brett";
    }
  });
  const [suche, setSuche] = useState("");
  const [liste, setListe] = useState<Auftrag[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(SCHLUESSEL, ansicht);
    } catch {
      /* egal */
    }
  }, [ansicht]);

  const laden = useCallback(() => {
    setLaedt(true);
    auftraegeSuchen(suche)
      .then((a) => {
        setListe(a);
        setFehler(null);
      })
      .catch((e: unknown) => setFehler(e instanceof Error ? e.message : String(e)))
      .finally(() => setLaedt(false));
  }, [suche]);

  useEffect(() => {
    const zeitgeber = setTimeout(laden, 200);
    return () => clearTimeout(zeitgeber);
  }, [laden]);

  return (
    <section>
      <div className="wb-kopf">
        <div>
          <h1>Aufträge</h1>
          <p className="wb-kopf__zahl">
            {laedt ? "…" : `${liste.length} ${liste.length === 1 ? "Auftrag" : "Aufträge"}`}
          </p>
        </div>
        <Link className="wb-button" to="/auftraege/neu">
          <Symbol name="plus" groesse={18} />
          Neuer Auftrag
        </Link>
      </div>

      <div className="wb-werkzeugleiste">
        <div className="wb-suchfeld">
          <Symbol name="suche" groesse={18} />
          <input
            type="search"
            placeholder="Nach Titel oder Nummer filtern"
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            autoCapitalize="none"
          />
        </div>
        <div className="wb-umschalter" role="group" aria-label="Ansicht">
          <button
            type="button"
            className={ansicht === "brett" ? "ist-aktiv" : ""}
            onClick={() => setAnsicht("brett")}
          >
            Phasenbrett
          </button>
          <button
            type="button"
            className={ansicht === "liste" ? "ist-aktiv" : ""}
            onClick={() => setAnsicht("liste")}
          >
            Liste
          </button>
        </div>
      </div>

      {fehler && (
        <p className="wb-fehler" role="alert">
          Aufträge konnten nicht geladen werden: {fehler}
        </p>
      )}

      {!laedt && liste.length === 0 && !fehler && (
        <div className="wb-nichts">
          <p>{suche ? `Kein Auftrag passt zu „${suche}".` : "Noch kein Auftrag angelegt."}</p>
          <p className="wb-leer">
            Ein Auftrag hängt immer an einem Kunden und wandert von der Anfrage bis zur Wartung
            durch die Phasen.
          </p>
          {!suche && (
            <Link className="wb-button" to="/auftraege/neu">
              <Symbol name="plus" groesse={18} />
              Ersten Auftrag anlegen
            </Link>
          )}
        </div>
      )}

      {liste.length > 0 &&
        (ansicht === "brett" ? (
          <Phasenbrett auftraege={liste} beiAenderung={laden} />
        ) : (
          <Auftragsliste auftraege={liste} />
        ))}
    </section>
  );
}

function Phasenbrett({
  auftraege,
  beiAenderung,
}: {
  auftraege: Auftrag[];
  beiAenderung: () => void;
}) {
  const brett = useMemo(() => nachPhase(auftraege), [auftraege]);
  const [gezogen, setGezogen] = useState<Auftrag | null>(null);
  const [ueber, setUeber] = useState<AuftragPhase | null>(null);

  async function ablegen(phase: AuftragPhase) {
    setUeber(null);
    const auftrag = gezogen;
    setGezogen(null);
    if (!auftrag || auftrag.phase === phase) return;
    await phaseSetzen(auftrag, phase);
    beiAenderung();
  }

  return (
    <div className="wb-brett">
      {AUFTRAG_PHASEN.map((phase) => (
        <div
          key={phase}
          className={`wb-spalte${ueber === phase ? " ist-ziel" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setUeber(phase);
          }}
          onDragLeave={() => setUeber((u) => (u === phase ? null : u))}
          onDrop={() => void ablegen(phase)}
        >
          <div className="wb-spalte__kopf">
            <span className={`wb-plakette wb-plakette--${PHASENFARBE[phase]}`}>
              {PHASENTEXT[phase]}
            </span>
            <span className="wb-spalte__zahl">{brett[phase].length}</span>
          </div>

          <div className="wb-spalte__karten">
            {brett[phase].map((a) => (
              <Karte
                key={a.id}
                auftrag={a}
                beiZiehstart={() => setGezogen(a)}
                beiZiehende={() => setGezogen(null)}
              />
            ))}
            {brett[phase].length === 0 && <p className="wb-spalte__leer">—</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

function Karte({
  auftrag,
  beiZiehstart,
  beiZiehende,
}: {
  auftrag: Auftrag;
  beiZiehstart: () => void;
  beiZiehende: () => void;
}) {
  const navigate = useNavigate();
  const kunde = (auftrag as Auftrag & { expand?: { kunde?: Kunde } }).expand?.kunde;

  return (
    <article
      className="wb-karte"
      draggable
      onDragStart={beiZiehstart}
      onDragEnd={beiZiehende}
      tabIndex={0}
      onClick={() => navigate(`/auftraege/${auftrag.id}`)}
      onKeyDown={(e) => e.key === "Enter" && navigate(`/auftraege/${auftrag.id}`)}
    >
      <span className="wb-karte__nummer">{auftrag.nummer}</span>
      <span className="wb-karte__titel">{auftrag.titel}</span>
      {kunde && <span className="wb-karte__kunde">{kunde.name}</span>}
      {auftrag.beginn && (
        <span className="wb-karte__datum">
          ab {new Date(auftrag.beginn).toLocaleDateString("de-AT")}
        </span>
      )}
    </article>
  );
}

function Auftragsliste({ auftraege }: { auftraege: Auftrag[] }) {
  const navigate = useNavigate();
  return (
    <div className="wb-tabelle-rahmen">
      <table className="wb-tabelle wb-tabelle--klickbar">
        <thead>
          <tr>
            <th scope="col">Nummer</th>
            <th scope="col">Titel</th>
            <th scope="col">Kunde</th>
            <th scope="col">Art</th>
            <th scope="col">Phase</th>
            <th scope="col">Beginn</th>
          </tr>
        </thead>
        <tbody>
          {auftraege.map((a) => {
            const kunde = (a as Auftrag & { expand?: { kunde?: Kunde } }).expand?.kunde;
            return (
              <tr
                key={a.id}
                tabIndex={0}
                onClick={() => navigate(`/auftraege/${a.id}`)}
                onKeyDown={(e) => e.key === "Enter" && navigate(`/auftraege/${a.id}`)}
              >
                <td className="wb-tabelle__kennung">{a.nummer}</td>
                <td>{a.titel}</td>
                <td>{kunde?.name ?? "—"}</td>
                <td className="wb-zelle--gedaempft">{AUFTRAGSART_TEXT[artVon(a)]}</td>
                <td>
                  <span className={`wb-plakette wb-plakette--${PHASENFARBE[a.phase]}`}>
                    {PHASENTEXT[a.phase]}
                  </span>
                </td>
                <td>{a.beginn ? new Date(a.beginn).toLocaleDateString("de-AT") : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
