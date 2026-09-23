import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  artVon,
  auftragLaden,
  auftragLoeschen,
  AUFTRAGSART_TEXT,
  AUFTRAGSREITER,
  AUFTRAGSREITER_TEXT,
  Auftragskachel,
  darf,
  darfAuftraegeAendern,
  dienst,
  dokumenteZuAuftrag,
  dokumentationsluecken,
  erweiterungen,
  fotosZuAuftrag,
  hatUnterschrift,
  naechstePhase,
  phasenFuer,
  phaseSetzen,
  PHASENSTUFE_FARBE,
  Symbol,
  unterschriftenZuAuftrag,
  verlauf,
  type Auftrag,
  type AuftragPhase,
  type Auftragsreiter,
  type Foto,
  type Kunde,
  type Protokollzeile,
  type Standort,
  type Unterschrift,
} from "@werkboq/core";
import { Verlaufsliste } from "../komponenten/Verlaufsliste";
import { Fotoblock } from "../komponenten/Fotoblock";
import { Dokumentenblock } from "../komponenten/Dokumentenblock";
import { Unterschriftsblock } from "../komponenten/Unterschriftsblock";

/**
 * Die Auftragsakte, in Reiter geteilt.
 *
 * WARUM REITER. Bis September 2026 standen zehn Blöcke untereinander: am
 * Rechner 4,2 Bildschirmhöhen, am Handy 6,9. Wer das Foto vom Verteiler
 * suchte, scrollte an 1.267 px Positionsliste vorbei. Jetzt gehört jeder
 * Block in den Reiter, in den er fachlich gehört, und der Überblick zeigt
 * je Bereich eine Kachel mit einer Zahl.
 *
 * Jeder Reiter hat eine eigene Adresse (/auftraege/:id/arbeit). Damit
 * funktioniert der Zurück-Knopf, und ein Link aus der Tagesansicht kann
 * direkt dorthin führen, wo der Monteur hinwill.
 *
 * WER LANDET WO. Wer Verwaltungsrecht hat, sitzt im Büro und will zuerst
 * den Überblick. Wer es nicht hat, steht auf der Baustelle und will Zeit
 * buchen oder Material erfassen — der landet gleich auf „Arbeit".
 */
export function AuftragAkte() {
  const { id, reiter: reiterRoh } = useParams<{ id: string; reiter?: string }>();
  const navigate = useNavigate();
  const [auftrag, setAuftrag] = useState<Auftrag | null>(null);
  const [zeilen, setZeilen] = useState<Protokollzeile[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(() => {
    if (!id) return;
    Promise.all([auftragLaden(id), verlauf(id).catch(() => [] as Protokollzeile[])])
      .then(([a, v]) => {
        setAuftrag(a);
        setZeilen(v);
        setFehler(null);
      })
      .catch((e: unknown) => setFehler(e instanceof Error ? e.message : String(e)))
      .finally(() => setLaedt(false));
  }, [id]);

  useEffect(laden, [laden]);

  const aendern = darfAuftraegeAendern();
  const standardReiter: Auftragsreiter = darf("verwaltung") ? "ueberblick" : "arbeit";
  const reiter = (AUFTRAGSREITER as readonly string[]).includes(reiterRoh ?? "")
    ? (reiterRoh as Auftragsreiter)
    : null;

  if (id && reiterRoh === undefined) {
    return <Navigate to={`/auftraege/${id}/${standardReiter}`} replace />;
  }
  if (id && reiterRoh !== undefined && !reiter) {
    return <Navigate to={`/auftraege/${id}/${standardReiter}`} replace />;
  }

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
  if (!auftrag || !reiter) return <p className="wb-leer">Auftrag nicht gefunden.</p>;

  const erweitert = auftrag as Auftrag & { expand?: { kunde?: Kunde; standort?: Standort } };
  const kunde = erweitert.expand?.kunde;
  const standort = erweitert.expand?.standort;
  const art = artVon(auftrag);

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
              {" · "}
              <span className="wb-plakette wb-plakette--neutral">{AUFTRAGSART_TEXT[art]}</span>
            </p>
            <h1>{auftrag.titel}</h1>
          </div>
        </div>

        <div className="wb-akte__aktionen">
          {aendern && (
            <Link className="wb-button wb-button--sekundaer" to={`/auftraege/${auftrag.id}/bearbeiten`}>
              <Symbol name="stift" groesse={18} />
              Bearbeiten
            </Link>
          )}
          {darf("verwaltung") && (
            <button type="button" className="wb-button wb-button--gefahr" onClick={loeschen}>
              Löschen
            </button>
          )}
        </div>

        <Phasenleiste auftrag={auftrag} beiWechsel={aendern ? (p) => void wechsle(p) : undefined} />
      </header>

      <nav className="wb-reiter" aria-label="Bereiche des Auftrags">
        {AUFTRAGSREITER.map((r) => (
          <Link
            key={r}
            to={`/auftraege/${auftrag.id}/${r}`}
            className={`wb-reiter__knopf${r === reiter ? " ist-aktiv" : ""}`}
            aria-current={r === reiter ? "page" : undefined}
            replace
          >
            {AUFTRAGSREITER_TEXT[r]}
          </Link>
        ))}
      </nav>

      {reiter === "ueberblick" && (
        <Ueberblick
          auftrag={auftrag}
          standort={standort}
          beiWechsel={(p) => void wechsle(p)}
        />
      )}

      {reiter === "arbeit" && (
        <Reiterinhalt leer="Hier erscheinen Zeiten, Fahrten und Material, sobald die Bausteine dafür freigegeben sind.">
          {[...erweiterungen("auftrag.arbeit"), ...erweiterungen("auftrag.abschnitt")].map(
            ({ modulId, Komponente }) => (
              <Komponente key={modulId} datensatzId={auftrag.id} />
            ),
          )}
        </Reiterinhalt>
      )}

      {reiter === "baustelle" && (
        <>
          <Fotoblock auftragId={auftrag.id} />
          <Unterschriftsblock auftragId={auftrag.id} />
          <Dokumentenblock auftragId={auftrag.id} />
          {erweiterungen("auftrag.baustelle").map(({ modulId, Komponente }) => (
            <Komponente key={modulId} datensatzId={auftrag.id} />
          ))}
        </>
      )}

      {reiter === "abrechnung" && (
        <Reiterinhalt leer="Positionen und Belege erscheinen hier, sobald die Bausteine Material und Verrechnung freigegeben sind.">
          {erweiterungen("auftrag.abrechnung").map(({ modulId, Komponente }) => (
            <Komponente key={modulId} datensatzId={auftrag.id} />
          ))}
        </Reiterinhalt>
      )}

      {reiter === "verlauf" && (
        <section className="wb-block">
          <h2>Verlauf</h2>
          <Verlaufsliste zeilen={zeilen} />
        </section>
      )}
    </article>
  );
}

/** Ein Reiter, der nur aus Modulblöcken besteht — mit Hinweis, wenn keiner da ist. */
function Reiterinhalt({ children, leer }: { children: ReactNode[]; leer: string }) {
  if (!children.length) return <p className="wb-leer">{leer}</p>;
  return <>{children}</>;
}

/**
 * Die Phasen als Fortschrittsleiste: was erledigt ist, wo der Auftrag
 * steht, was noch kommt.
 *
 * Vorher waren es gleich aussehende graue Knöpfe, und man musste den
 * blauen suchen, um zu wissen, wo man ist. Ein Tipp auf eine Phase setzt
 * sie, auch rückwärts — ein Auftrag, der nach der Abnahme noch einmal
 * aufgemacht werden muss, soll das dürfen.
 */
function Phasenleiste({
  auftrag,
  beiWechsel,
}: {
  auftrag: Auftrag;
  /** Fehlt, wenn dieser Zugang die Phase nicht ändern darf — dann nur Anzeige. */
  beiWechsel?: (p: AuftragPhase) => void;
}) {
  const liste = phasenFuer(auftrag);
  const jetzt = liste.findIndex((p) => p.stufe === auftrag.phase);
  const leiste = useRef<HTMLOListElement>(null);

  // Am Handy passt ein Projekt mit sieben Phasen nicht in die Breite, und
  // die aktuelle stünde rechts außerhalb. Die Leiste rollt sie in die Mitte
  // — nur waagrecht, die Seite selbst bleibt, wo sie ist.
  useEffect(() => {
    const ol = leiste.current;
    const li = ol?.children[jetzt] as HTMLElement | undefined;
    if (!ol || !li || ol.scrollWidth <= ol.clientWidth) return;
    const a = ol.getBoundingClientRect();
    const b = li.getBoundingClientRect();
    ol.scrollLeft += b.left + b.width / 2 - (a.left + a.width / 2);
  }, [jetzt, liste.length]);

  return (
    <ol className="wb-phasenleiste" aria-label="Phase" ref={leiste}>
      {liste.map((p, i) => {
        const zustand = i < jetzt ? "erledigt" : i === jetzt ? "jetzt" : "offen";
        return (
          <li key={p.stufe} className={`wb-phase wb-phase--${zustand}`}>
            <button
              type="button"
              onClick={beiWechsel ? () => beiWechsel(p.stufe) : undefined}
              disabled={!beiWechsel}
              aria-current={zustand === "jetzt" ? "step" : undefined}
              title={
                zustand === "jetzt" ? "Aktuelle Phase" : beiWechsel ? `Auf „${p.text}" setzen` : undefined
              }
            >
              <span
                className={`wb-phase__punkt${zustand === "jetzt" ? ` wb-punkt--${punktfarbe(p.stufe)}` : ""}`}
                aria-hidden="true"
              >
                {zustand === "erledigt" ? "✓" : ""}
              </span>
              <span className="wb-phase__text">{p.text}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** Grau heißt sonst „nicht dran" — die aktuelle Phase ist nie grau. */
function punktfarbe(stufe: AuftragPhase): string {
  const farbe = PHASENSTUFE_FARBE[stufe];
  return farbe === "neutral" ? "marke" : farbe;
}

interface Pruefpunkt {
  ok: boolean;
  text: string;
}

/**
 * Überblick: der nächste Schritt, dann die Kacheln, dann die Stammdaten.
 */
function Ueberblick({
  auftrag,
  standort,
  beiWechsel,
}: {
  auftrag: Auftrag;
  standort?: Standort;
  beiWechsel: (p: AuftragPhase) => void;
}) {
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [unterschriften, setUnterschriften] = useState<Unterschrift[]>([]);
  const [dokumente, setDokumente] = useState(0);
  const [stunden, setStunden] = useState<number | null>(null);
  const [offeneVorschlaege, setOffeneVorschlaege] = useState<number | null>(null);

  useEffect(() => {
    void fotosZuAuftrag(auftrag.id).then(setFotos).catch(() => setFotos([]));
    void unterschriftenZuAuftrag(auftrag.id)
      .then(setUnterschriften)
      .catch(() => setUnterschriften([]));
    void dokumenteZuAuftrag(auftrag.id)
      .then((d) => setDokumente(d.length))
      .catch(() => setDokumente(0));
    void dienst("auftragsstunden")?.(auftrag.id)
      .then((s) => setStunden(s.gesamt))
      .catch(() => setStunden(null));
    void dienst("auftragspositionen")?.(auftrag.id)
      .then((p) => setOffeneVorschlaege(p.offeneVorschlaege))
      .catch(() => setOffeneVorschlaege(null));
  }, [auftrag.id]);

  const art = artVon(auftrag);
  const naechste = naechstePhase(auftrag);

  /**
   * Was vor dem nächsten Schritt erledigt sein sollte.
   *
   * RATSCHLAG, KEINE SPERRE. Auf einer Baustelle gibt es immer einen
   * Grund, warum etwas fehlt — die Kundin war nicht da, das Foto ist auf
   * dem anderen Handy. Ein Programm, das dann den Knopf sperrt, wird
   * umgangen, und dann stimmt die Phase nicht mehr. Deshalb nur ein
   * Häkchen oder ein Kreuz, und der Knopf bleibt.
   *
   * Nur, was der Kern wirklich weiß: Fotos und Unterschriften sind seine,
   * Stunden und Material-Vorschläge fragt er über Dienste. Fehlt ein
   * Baustein, fehlt der Punkt — er wird nicht als offen gemeldet.
   */
  const punkte: Pruefpunkt[] = [];
  if (auftrag.phase === "in_arbeit") {
    if (stunden !== null) punkte.push({ ok: stunden > 0, text: "Zeiten gebucht" });
    if (art !== "materialverkauf") {
      const luecken = dokumentationsluecken(fotos);
      punkte.push({
        ok: luecken.length === 0,
        text: luecken.length ? "Fotos vorher und nachher" : "Fotos vorher und nachher vorhanden",
      });
    }
  }
  if (auftrag.phase === "fertig" && (art === "projekt" || art === "regie")) {
    punkte.push({
      ok: hatUnterschrift(unterschriften, "abnahme"),
      text: "Abnahme unterschrieben",
    });
  }
  if (
    (auftrag.phase === "in_arbeit" || auftrag.phase === "fertig" || auftrag.phase === "verrechnen") &&
    offeneVorschlaege !== null
  ) {
    punkte.push({
      ok: offeneVorschlaege === 0,
      text:
        offeneVorschlaege === 0
          ? "Material von der Baustelle freigegeben"
          : `${offeneVorschlaege} Material-Vorschlag${offeneVorschlaege === 1 ? "" : "e"} nicht freigegeben`,
    });
  }

  const kacheln = erweiterungen("auftrag.kachel");

  return (
    <>
      {naechste && (
        <section className="wb-block wb-naechster-schritt">
          <div className="wb-block__kopf">
            <h2>Nächster Schritt</h2>
          </div>
          {punkte.length > 0 && (
            <ul className="wb-pruefliste">
              {punkte.map((p) => (
                <li key={p.text} className={p.ok ? "ist-ok" : "ist-offen"}>
                  <Symbol name={p.ok ? "haken" : "kreuz"} groesse={16} />
                  {p.text}
                </li>
              ))}
            </ul>
          )}
          {darfAuftraegeAendern() && (
            <div className="wb-aktionen">
              <button className="wb-button" type="button" onClick={() => beiWechsel(naechste.stufe)}>
                Weiter: {naechste.text}
              </button>
            </div>
          )}
        </section>
      )}

      <section className="wb-auftragskacheln" aria-label="Bereiche">
        {kacheln.map(({ modulId, Komponente }) => (
          <Komponente key={modulId} datensatzId={auftrag.id} />
        ))}
        <Auftragskachel
          auftragId={auftrag.id}
          reiter="baustelle"
          titel="Fotos"
          wert={String(fotos.length)}
          zusatz={
            art !== "materialverkauf" && fotos.length && dokumentationsluecken(fotos).length
              ? "vorher oder nachher fehlt"
              : undefined
          }
          achtung={art !== "materialverkauf" && fotos.length > 0 && dokumentationsluecken(fotos).length > 0}
        />
        <Auftragskachel
          auftragId={auftrag.id}
          reiter="baustelle"
          titel="Unterschriften"
          wert={String(unterschriften.length)}
        />
        <Auftragskachel
          auftragId={auftrag.id}
          reiter="baustelle"
          titel="Dokumente"
          wert={String(dokumente)}
        />
      </section>

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
          <h2>Eckdaten</h2>
          <dl className="wb-daten">
            <Fakt begriff="Art" wert={AUFTRAGSART_TEXT[art]} />
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
        </section>
      </div>
    </>
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
