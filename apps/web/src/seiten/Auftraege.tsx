import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Symbol,
  auftraegeSuchen,
  AUFTRAGSART_TEXT,
  AUFTRAGSARTEN,
  artVon,
  brettspalten,
  fehlersatz,
  phaseSetzen,
  phasenFuer,
  phasenText,
  PHASENSTUFE_FARBE,
  PHASENSTUFE_TEXT,
  PHASENSTUFEN,
  umschluesseln,
  type Auftrag,
  type Auftragsart,
  type Kunde,
  type Phasenstufe,
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
const SCHLUESSEL_ART = "werkboq.auftraege.art";

function gemerkteArt(): Auftragsart | null {
  try {
    const wert = localStorage.getItem(SCHLUESSEL_ART);
    return (AUFTRAGSARTEN as readonly (string | null)[]).includes(wert) ? (wert as Auftragsart) : null;
  } catch {
    return null;
  }
}

export function Auftraege() {
  const [ansicht, setAnsicht] = useState<Ansicht>(() => {
    try {
      return localStorage.getItem(SCHLUESSEL) === "liste" ? "liste" : "brett";
    } catch {
      return "brett";
    }
  });
  const [suche, setSuche] = useState("");
  const [art, setArt] = useState<Auftragsart | null>(gemerkteArt);
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

  useEffect(() => {
    try {
      if (art) localStorage.setItem(SCHLUESSEL_ART, art);
      else localStorage.removeItem(SCHLUESSEL_ART);
    } catch {
      /* egal */
    }
  }, [art]);

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

  const gezeigt = useMemo(
    () => (art ? liste.filter((a) => artVon(a) === art) : liste),
    [liste, art],
  );
  const jeArt = useMemo(() => {
    const zahl = Object.fromEntries(AUFTRAGSARTEN.map((x) => [x, 0])) as Record<Auftragsart, number>;
    for (const a of liste) zahl[artVon(a)]++;
    return zahl;
  }, [liste]);

  return (
    <section>
      <div className="wb-kopf">
        <div>
          <h1>Aufträge</h1>
          <p className="wb-kopf__zahl">
            {laedt
              ? "…"
              : `${gezeigt.length} ${gezeigt.length === 1 ? "Auftrag" : "Aufträge"}${
                  art ? ` · ${AUFTRAGSART_TEXT[art]}` : ""
                }`}
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
        <label className="wb-artwahl">
          <select
            aria-label="Auftragsart"
            value={art ?? ""}
            onChange={(e) => setArt((e.target.value || null) as Auftragsart | null)}
          >
            <option value="">Alle Arten ({liste.length})</option>
            {AUFTRAGSARTEN.map((x) => (
              <option key={x} value={x}>
                {AUFTRAGSART_TEXT[x]} ({jeArt[x]})
              </option>
            ))}
          </select>
        </label>
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
            Ein Auftrag hängt immer an einem Kunden. Je nach Art — Störung, Regie, Projekt,
            Wartung, Materialverkauf — durchläuft er seine eigenen Phasen bis zur Rechnung.
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
          <Phasenbrett auftraege={gezeigt} art={art} beiAenderung={laden} />
        ) : gezeigt.length ? (
          <Auftragsliste auftraege={gezeigt} />
        ) : (
          <p className="wb-leer">Kein Auftrag der Art „{art ? AUFTRAGSART_TEXT[art] : ""}".</p>
        ))}
    </section>
  );
}

/**
 * Das Phasenbrett.
 *
 * Über alle Aufträge zeigt es die Stufen des Gerüsts mit neutralen Namen —
 * dieselbe Spalte enthält dann eine gemeldete Störung und eine
 * Projektanfrage. Ist eine Art gewählt, zeigt es genau deren Phasen mit
 * deren Namen, und nur die. So bleibt eine Störung bei vier Spalten statt
 * sieben.
 *
 * „Abgeschlossen" ist eingeklappt: dort sammelt sich mit der Zeit fast
 * alles, und wer das Brett öffnet, will sehen, was noch zu tun ist. Ziehen
 * kann man trotzdem hinein.
 *
 * Ziehen geht nur in Phasen, die die Art des Auftrags kennt. Eine Störung
 * im Angebot gibt es nicht; die Spalte wird beim Ziehen gedimmt und nimmt
 * die Karte nicht an.
 */
function Phasenbrett({
  auftraege,
  art,
  beiAenderung,
}: {
  auftraege: Auftrag[];
  art: Auftragsart | null;
  beiAenderung: () => void;
}) {
  const [gezogen, setGezogen] = useState<Auftrag | null>(null);
  const [ueber, setUeber] = useState<Phasenstufe | null>(null);
  const [abgeschlossenOffen, setAbgeschlossenOffen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const spalten = useMemo(
    () => brettspalten(auftraege.map((a) => a.phase), art),
    [auftraege, art],
  );
  const brett = useMemo(() => {
    const b = Object.fromEntries(PHASENSTUFEN.map((s) => [s, [] as Auftrag[]])) as Record<
      Phasenstufe,
      Auftrag[]
    >;
    // umschluesseln: steht irgendwo noch eine alte Phase (Server noch nicht
    // neu gestartet), landet der Auftrag trotzdem in einer Spalte.
    for (const a of auftraege) b[umschluesseln(a.phase)].push(a);
    return b;
  }, [auftraege]);

  function erlaubt(a: Auftrag | null, stufe: Phasenstufe): boolean {
    if (!a) return true;
    return phasenFuer(a).some((p) => p.stufe === stufe);
  }

  async function ablegen(stufe: Phasenstufe) {
    setUeber(null);
    const auftrag = gezogen;
    setGezogen(null);
    if (!auftrag || auftrag.phase === stufe || !erlaubt(auftrag, stufe)) return;
    try {
      await phaseSetzen(auftrag, stufe);
      setFehler(null);
      beiAenderung();
    } catch (e: unknown) {
      setFehler(fehlersatz(e));
    }
  }

  function zielProps(stufe: Phasenstufe) {
    const geht = erlaubt(gezogen, stufe);
    return {
      onDragOver: (e: DragEvent) => {
        // Ohne preventDefault nimmt der Browser nichts an — genau das
        // wollen wir bei einer Phase, die die Art nicht kennt.
        if (!geht) return;
        e.preventDefault();
        setUeber(stufe);
      },
      onDragLeave: () => setUeber((u) => (u === stufe ? null : u)),
      onDrop: () => void ablegen(stufe),
      gesperrt: Boolean(gezogen) && !geht,
    };
  }

  const zu = zielProps("abgeschlossen");
  const offeneSpalten = spalten.filter((s) => s.stufe !== "abgeschlossen");
  const abgeschlossen = brett.abgeschlossen;

  return (
    <>
      {fehler && (
        <p className="wb-fehler" role="alert">
          {fehler}
        </p>
      )}
      <div
        className={`wb-brett${abgeschlossenOffen ? "" : " wb-brett--eingeklappt"}`}
        style={{ ["--wb-spalten" as string]: offeneSpalten.length }}
      >
        {offeneSpalten.map(({ stufe, text }) => {
          const z = zielProps(stufe);
          return (
            <div
              key={stufe}
              className={`wb-spalte${ueber === stufe ? " ist-ziel" : ""}${z.gesperrt ? " ist-gesperrt" : ""}`}
              onDragOver={z.onDragOver}
              onDragLeave={z.onDragLeave}
              onDrop={z.onDrop}
            >
              <div className="wb-spalte__kopf">
                <span className={`wb-plakette wb-plakette--${PHASENSTUFE_FARBE[stufe]}`}>{text}</span>
                <span className="wb-spalte__zahl">{brett[stufe].length}</span>
              </div>
              <div className="wb-spalte__karten">
                {brett[stufe].map((a) => (
                  <Karte
                    key={a.id}
                    auftrag={a}
                    spaltentext={text}
                    mitArt={!art}
                    beiZiehstart={() => setGezogen(a)}
                    beiZiehende={() => {
                      setGezogen(null);
                      setUeber(null);
                    }}
                  />
                ))}
                {brett[stufe].length === 0 && <p className="wb-spalte__leer">—</p>}
              </div>
            </div>
          );
        })}

        <div
          className={`wb-spalte wb-spalte--abgeschlossen${abgeschlossenOffen ? " ist-offen" : ""}${
            ueber === "abgeschlossen" ? " ist-ziel" : ""
          }${zu.gesperrt ? " ist-gesperrt" : ""}`}
          onDragOver={zu.onDragOver}
          onDragLeave={zu.onDragLeave}
          onDrop={zu.onDrop}
        >
          <button
            type="button"
            className="wb-spalte__klappe"
            aria-expanded={abgeschlossenOffen}
            onClick={() => setAbgeschlossenOffen((o) => !o)}
            title={abgeschlossenOffen ? "Abgeschlossene einklappen" : "Abgeschlossene zeigen"}
          >
            <span className="wb-spalte__klappentext">{PHASENSTUFE_TEXT.abgeschlossen}</span>
            <span className="wb-spalte__zahl">{abgeschlossen.length}</span>
          </button>
          {abgeschlossenOffen && (
            <div className="wb-spalte__karten">
              {abgeschlossen.map((a) => (
                <Karte
                  key={a.id}
                  auftrag={a}
                  spaltentext={PHASENSTUFE_TEXT.abgeschlossen}
                  mitArt={!art}
                  beiZiehstart={() => setGezogen(a)}
                  beiZiehende={() => {
                    setGezogen(null);
                    setUeber(null);
                  }}
                />
              ))}
              {abgeschlossen.length === 0 && <p className="wb-spalte__leer">—</p>}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Karte({
  auftrag,
  spaltentext,
  mitArt,
  beiZiehstart,
  beiZiehende,
}: {
  auftrag: Auftrag;
  spaltentext: string;
  mitArt: boolean;
  beiZiehstart: () => void;
  beiZiehende: () => void;
}) {
  const navigate = useNavigate();
  const kunde = (auftrag as Auftrag & { expand?: { kunde?: Kunde } }).expand?.kunde;
  const art = artVon(auftrag);
  // Heißt die Phase bei dieser Art anders als die Spalte (Wartung
  // „Durchgeführt" in „Fertig"), steht der eigene Name auf der Karte.
  const eigenerName = phasenText(umschluesseln(auftrag.phase), art);
  const anders = eigenerName !== spaltentext;

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
      {(mitArt || anders) && (
        <span className="wb-karte__art">
          {mitArt && <span className={`wb-artmarke wb-artmarke--${art}`}>{AUFTRAGSART_TEXT[art]}</span>}
          {anders && <span className="wb-karte__phase">{eigenerName}</span>}
        </span>
      )}
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
                  <span
                    className={`wb-plakette wb-plakette--${PHASENSTUFE_FARBE[umschluesseln(a.phase)]}`}
                  >
                    {phasenText(umschluesseln(a.phase), artVon(a))}
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
