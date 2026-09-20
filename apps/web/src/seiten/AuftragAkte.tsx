import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AUFTRAG_PHASEN,
  auftragLaden,
  auftragLoeschen,
  darf,
  erweiterungen,
  phaseSetzen,
  PHASENFARBE,
  PHASENTEXT,
  Symbol,
  verlauf,
  type Auftrag,
  type AuftragPhase,
  type Kunde,
  type Protokollzeile,
  type Standort,
} from "@werkboq/core";
import { Verlaufsliste } from "../komponenten/Verlaufsliste";
import { Fotoblock } from "../komponenten/Fotoblock";
import { Dokumentenblock } from "../komponenten/Dokumentenblock";

/** Auftragsakte mit Phasenleiste, Stammdaten und Verlauf. */
export function AuftragAkte() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [auftrag, setAuftrag] = useState<Auftrag | null>(null);
  const [zeilen, setZeilen] = useState<Protokollzeile[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  // Blöcke, die Bausteine beisteuern — Zeiten, später Positionen, Rechnungen.
  // Die Akte weiß nicht, was kommt; sie hält nur den Platz frei.
  const abschnitte = erweiterungen("auftrag.abschnitt");

  function laden() {
    if (!id) return;
    Promise.all([auftragLaden(id), verlauf(id).catch(() => [] as Protokollzeile[])])
      .then(([a, v]) => {
        setAuftrag(a);
        setZeilen(v);
        setFehler(null);
      })
      .catch((e: unknown) => setFehler(e instanceof Error ? e.message : String(e)))
      .finally(() => setLaedt(false));
  }

  useEffect(laden, [id]);

  async function wechsle(phase: AuftragPhase) {
    if (!auftrag) return;
    await phaseSetzen(auftrag, phase);
    laden();
  }

  async function loeschen() {
    if (!auftrag) return;
    if (!confirm(`Auftrag ${auftrag.nummer} wirklich löschen?`)) return;
    await auftragLoeschen(auftrag);
    navigate("/auftraege");
  }

  if (laedt) return <p className="wb-leer">Wird geladen …</p>;
  if (fehler) return <p className="wb-fehler" role="alert">{fehler}</p>;
  if (!auftrag) return <p className="wb-leer">Auftrag nicht gefunden.</p>;

  const erweitert = auftrag as Auftrag & { expand?: { kunde?: Kunde; standort?: Standort } };
  const kunde = erweitert.expand?.kunde;
  const standort = erweitert.expand?.standort;

  return (
    <article className="wb-akte">
      <header className="wb-akte__kopf">
        <div className="wb-akte__kennung">
          <div>
            <p className="wb-akte__ueberzeile">
              Auftrag {auftrag.nummer}
              {kunde && (
                <>
                  {" · "}
                  <Link to={`/kunden/${kunde.id}`}>{kunde.name}</Link>
                </>
              )}
            </p>
            <h1>{auftrag.titel}</h1>
          </div>
        </div>

        <div className="wb-akte__aktionen">
          <Link className="wb-button wb-button--sekundaer" to={`/auftraege/${auftrag.id}/bearbeiten`}>
            <Symbol name="stift" groesse={18} />
            Bearbeiten
          </Link>
          {darf("verwaltung") && (
            <button type="button" className="wb-button wb-button--gefahr" onClick={loeschen}>
              Löschen
            </button>
          )}
        </div>

        <dl className="wb-schnellfakten">
          <Fakt begriff="Standort" wert={standort?.bezeichnung} />
          <Fakt
            begriff="Beginn"
            wert={auftrag.beginn ? new Date(auftrag.beginn).toLocaleDateString("de-AT") : undefined}
          />
          <Fakt
            begriff="Ende"
            wert={auftrag.ende ? new Date(auftrag.ende).toLocaleDateString("de-AT") : undefined}
          />
          <Fakt begriff="Modul" wert={auftrag.modul} />
        </dl>
      </header>

      <section className="wb-block">
        <h2>Phase</h2>
        <p className="wb-leer">
          Ein Klick setzt die Phase und schreibt den Wechsel in den Verlauf.
        </p>
        <div className="wb-phasenleiste">
          {AUFTRAG_PHASEN.map((p) => (
            <button
              key={p}
              type="button"
              className={`wb-phasenknopf${p === auftrag.phase ? " ist-aktiv" : ""}`}
              onClick={() => void wechsle(p)}
              aria-pressed={p === auftrag.phase}
            >
              <span className={`wb-punkt wb-punkt--${PHASENFARBE[p]}`} aria-hidden="true" />
              {PHASENTEXT[p]}
            </button>
          ))}
        </div>
      </section>

      {abschnitte.map(({ modulId, Komponente }) => (
        <Komponente key={modulId} datensatzId={auftrag.id} />
      ))}

      {/* Baustellendokumentation. Steht bewusst nach den Modulabschnitten:
          wer die Akte im Büro öffnet, will zuerst Zeiten und Positionen
          sehen — wer sie auf der Baustelle öffnet, scrollt ohnehin. */}
      <Fotoblock auftragId={auftrag.id} />
      <Dokumentenblock auftragId={auftrag.id} />

      <div className="wb-spalten">
        <section className="wb-block">
          <h2>Beschreibung</h2>
          {auftrag.beschreibung ? (
            <div className="wb-notiz" dangerouslySetInnerHTML={{ __html: auftrag.beschreibung }} />
          ) : (
            <p className="wb-leer">Keine Beschreibung hinterlegt.</p>
          )}
        </section>

        <section className="wb-block">
          <h2>Verlauf</h2>
          <Verlaufsliste zeilen={zeilen} />
        </section>
      </div>
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
