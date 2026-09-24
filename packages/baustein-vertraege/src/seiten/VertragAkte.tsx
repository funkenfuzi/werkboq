import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { aktuellerRechtsraum, alsEuro, darfSchreiben, fehlersatz, schreibweiseVon } from "@werkboq/core";
import {
  istEigener,
  KATEGORIE_TEXT,
  kuendigungWirktZum,
  laufzeit,
  RHYTHMUS_MONATE,
  RHYTHMUS_TEXT,
  VERRECHNUNGSART_TEXT,
  VERTRAGSSTATUS_TEXT,
} from "../daten/rechnen";
import {
  beenden,
  ereignisse,
  heute,
  kuendigen,
  leererVertrag,
  naechsteVertragsnummer,
  partnerName,
  partnerPfad,
  terminErledigt,
  vertragLaden,
  vertragSpeichern,
  type Vertrag,
  type Vertragsereignis,
} from "../daten/vertraege";
import { Hinweisliste } from "../komponenten/Hinweisliste";
import { Vertragsmaske } from "../komponenten/Vertragsmaske";

function datum(t?: string | null): string {
  return t ? new Date(`${t.slice(0, 10)}T00:00:00`).toLocaleDateString("de-AT") : "—";
}

export function VertragAkte() {
  const { id } = useParams<{ id: string }>();
  const [parameter] = useSearchParams();
  const navigate = useNavigate();
  const neu = id === "neu";
  // Eigener Vertrag, wenn aus einer Lieferantenakte heraus angelegt oder so verlangt.
  const neuEigen = parameter.get("richtung") === "lieferant" || parameter.has("lieferant");
  const [v, setV] = useState<Vertrag | null>(null);
  const [liste, setListe] = useState<Vertragsereignis[]>([]);
  const [bearbeiten, setBearbeiten] = useState(neu);
  const [nummer, setNummer] = useState("");
  const [kuendigung, setKuendigung] = useState(false);
  const [erledigen, setErledigen] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const darf = darfSchreiben("buchhaltung");
  const sw = schreibweiseVon(aktuellerRechtsraum().id);

  const laden = useCallback(() => {
    if (!id || neu) {
      void naechsteVertragsnummer(undefined, neuEigen ? "lieferant" : "kunde").then(setNummer);
      return;
    }
    vertragLaden(id)
      .then(async (x) => {
        setV(x);
        setListe(await ereignisse(x.id).catch(() => []));
      })
      .catch((e: unknown) => setFehler(fehlersatz(e)));
  }, [id, neu, neuEigen]);
  useEffect(laden, [laden]);
  // Nach dem Anlegen wechselt die Adresse von /vertraege/neu auf die neue
  // Kennung, die Seite bleibt aber dieselbe — ohne das stünde danach
  // wieder die Maske da statt des Vertrags.
  useEffect(() => setBearbeiten(neu), [id, neu]);

  if (neu) {
    if (!nummer) return <p className="wb-leer">Wird vorbereitet …</p>;
    return (
      <section>
        <div className="wb-kopf">
          <h1>{neuEigen ? "Neuer eigener Vertrag" : "Neuer Wartungsvertrag"}</h1>
        </div>
        <Vertragsmaske
          vorher={{
            ...leererVertrag(neuEigen ? "lieferant" : "kunde"),
            nummer,
            kunde: parameter.get("kunde") ?? "",
            lieferant: parameter.get("lieferant") ?? "",
          }}
          beiAbbruch={() => navigate("/vertraege")}
          beiSpeichern={async (e) => {
            const x = await vertragSpeichern(null, e);
            navigate(`/vertraege/${x.id}`, { replace: true });
          }}
        />
      </section>
    );
  }

  if (fehler && !v) return <p className="wb-fehler" role="alert">{fehler}</p>;
  if (!v) return <p className="wb-leer">Wird geladen …</p>;
  const l = laufzeit(v, heute());
  const eigen = istEigener(v);
  const pfad = partnerPfad(v);
  const jahreskosten = v.pauschale && v.rhythmus ? v.pauschale * (12 / RHYTHMUS_MONATE[v.rhythmus]) : 0;

  return (
    <article className="wb-akte">
      <header className="wb-akte__kopf">
        <div>
          <p className="wb-akte__kennung">
            {eigen ? `Eigener Vertrag${v.kategorie ? ` (${KATEGORIE_TEXT[v.kategorie]})` : ""}` : "Wartungsvertrag"} · {v.nummer}
            {pfad && (
              <>
                {" · "}
                <Link to={pfad}>{partnerName(v)}</Link>
              </>
            )}
          </p>
          <h1>{v.titel}</h1>
          <p className="wb-akte__unterzeile">
            <span className={`wb-plakette wb-plakette--${v.status === "aktiv" ? "ok" : v.status === "gekuendigt" ? "warn" : "neutral"}`}>
              {VERTRAGSSTATUS_TEXT[v.status]}
            </span>
            {v.status === "gekuendigt" && <span>zum {datum(v.gekuendigtZum)}</span>}
          </p>
        </div>
        {darf && !bearbeiten && (
          <div className="wb-akte__aktionen">
            <button type="button" className="wb-button wb-button--sekundaer" onClick={() => setBearbeiten(true)}>
              Bearbeiten
            </button>
            {eigen && v.status !== "beendet" && v.naechsteWartung && (
              <button type="button" className="wb-button" onClick={() => setErledigen(true)}>
                Termin erledigt
              </button>
            )}
            {v.status === "aktiv" && (
              <button type="button" className="wb-button wb-button--sekundaer" onClick={() => setKuendigung(true)}>
                Kündigung erfassen
              </button>
            )}
            {v.status === "gekuendigt" && l.abgelaufen && (
              <button type="button" className="wb-button wb-button--sekundaer" onClick={() => void beenden(v).then(laden)}>
                Als beendet markieren
              </button>
            )}
          </div>
        )}
      </header>

      {fehler && <p className="wb-fehler" role="alert">{fehler}</p>}

      {erledigen && (
        <Erledigtmaske
          vertrag={v}
          beiFertig={() => {
            setErledigen(false);
            laden();
          }}
          beiAbbruch={() => setErledigen(false)}
        />
      )}

      {kuendigung && <Kuendigungsmaske eigen={eigen} vertrag={v} beiFertig={() => { setKuendigung(false); laden(); }} beiAbbruch={() => setKuendigung(false)} />}

      {bearbeiten ? (
        <Vertragsmaske
          vorher={v}
          beiAbbruch={() => setBearbeiten(false)}
          beiSpeichern={async (e) => {
            await vertragSpeichern(v, e);
            setBearbeiten(false);
            laden();
          }}
        />
      ) : (
        <>
          <section className="wb-block">
            <h2>Was ansteht</h2>
            <Hinweisliste vertraege={[v]} mitName={false} beiAenderung={laden} />
          </section>

          <div className="wb-spalten">
            {eigen ? (
              <>
                {/* Ohne Termin und ohne Vereinbartes gibt es hier nichts zu zeigen — Versicherung, Leasing. */}
                {(v.intervallMonate || v.naechsteWartung || v.leistungen) ? (
                <section className="wb-block">
                  <h2>Termin</h2>
                  <dl className="wb-daten">
                    {v.intervallMonate ? (
                      <>
                        <div><dt>Intervall</dt><dd>alle {v.intervallMonate} Monate</dd></div>
                        <div><dt>Nächster</dt><dd>{datum(v.naechsteWartung)}</dd></div>
                        <div><dt>Erinnerung</dt><dd>{v.vorlaufTage ?? 30} Tage vorher</dd></div>
                      </>
                    ) : (
                      <div><dt>Intervall</dt><dd>kein wiederkehrender Termin</dd></div>
                    )}
                  </dl>
                  {v.leistungen && <p className="wb-notiz" style={{ whiteSpace: "pre-line" }}>{v.leistungen}</p>}
                </section>
                ) : null}
                <section className="wb-block">
                  <h2>Kosten</h2>
                  <dl className="wb-daten">
                    <div><dt>Betrag</dt><dd>{v.pauschale ? `${alsEuro(v.pauschale, sw)} netto ${RHYTHMUS_TEXT[v.rhythmus ?? "jahr"]}` : "—"}</dd></div>
                    {jahreskosten > 0 && <div><dt>Im Jahr</dt><dd>{alsEuro(jahreskosten, sw)} netto</dd></div>}
                    {v.fremdnummer && <div><dt>Nummer beim Partner</dt><dd>{v.fremdnummer}</dd></div>}
                  </dl>
                </section>
              </>
            ) : (
              <>
            <section className="wb-block">
              <h2>Wartung</h2>
              <dl className="wb-daten">
                <div><dt>Intervall</dt><dd>alle {v.intervallMonate} Monate</dd></div>
                <div><dt>Nächste</dt><dd>{datum(v.naechsteWartung)}</dd></div>
                <div><dt>Erinnerung</dt><dd>{v.vorlaufTage ?? 30} Tage vorher</dd></div>
              </dl>
              {v.leistungen && <p className="wb-notiz" style={{ whiteSpace: "pre-line" }}>{v.leistungen}</p>}
            </section>
            <section className="wb-block">
              <h2>Verrechnung</h2>
              <dl className="wb-daten">
                <div><dt>Art</dt><dd>{VERRECHNUNGSART_TEXT[v.verrechnung || "aufwand"]}</dd></div>
                {v.verrechnung === "pauschale" && (
                  <>
                    <div><dt>Pauschale</dt><dd>{alsEuro(v.pauschale ?? 0, sw)} netto {RHYTHMUS_TEXT[v.rhythmus ?? "jahr"]}</dd></div>
                    <div><dt>Nächste Rechnung</dt><dd>{datum(v.naechsteRechnung)}</dd></div>
                    <div><dt>Preis zuletzt geprüft</dt><dd>{datum(v.preisStand || v.beginn)}</dd></div>
                  </>
                )}
              </dl>
            </section>
              </>
            )}
            <section className="wb-block">
              <h2>Laufzeit</h2>
              <dl className="wb-daten">
                <div><dt>Beginn</dt><dd>{datum(v.beginn)}</dd></div>
                <div><dt>Läuft bis</dt><dd>{l.ende ? datum(l.ende) : "unbefristet"}{l.verlaengertSich && v.status === "aktiv" ? `, verlängert sich um ${v.verlaengerungMonate} Monate` : ""}</dd></div>
                <div><dt>Kündigungsfrist</dt><dd>{v.kuendigungsfristMonate ? `${v.kuendigungsfristMonate} Monate` : "keine"}</dd></div>
                {v.status === "aktiv" && l.letzterKuendigungstag && (
                  <div><dt>Kündigung spätestens</dt><dd>{datum(l.letzterKuendigungstag)}</dd></div>
                )}
              </dl>
            </section>
          </div>

          <section className="wb-block">
            <h2>Verlauf</h2>
            {liste.length === 0 ? (
              <p className="wb-leer">Noch nichts aus diesem Vertrag entstanden.</p>
            ) : (
              <ul className="wb-kontaktliste">
                {liste.map((e) => (
                  <li key={e.id}>
                    <span className="wb-kontaktliste__datum">{datum(e.created)}</span>
                    <span className="wb-kontaktliste__art">
                      {{ wartung: "Wartung", rechnung: "Rechnung", kuendigung: "Kündigung", preis: eigen ? "Kosten" : "Preis", termin: "Termin" }[e.art]}
                    </span>
                    <span className="wb-kontaktliste__notiz">
                      {e.auftrag ? <Link to={`/auftraege/${e.auftrag}`}>{e.text}</Link> : e.text}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </article>
  );
}

/** Eigener Vertrag: der Dienstleister war da. Der nächste Termin rückt weiter. */
function Erledigtmaske({ vertrag, beiFertig, beiAbbruch }: { vertrag: Vertrag; beiFertig: () => void; beiAbbruch: () => void }) {
  const [notiz, setNotiz] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);

  async function absenden(e: FormEvent) {
    e.preventDefault();
    try {
      await terminErledigt(vertrag, notiz);
      beiFertig();
    } catch (x: unknown) {
      setFehler(fehlersatz(x));
    }
  }

  return (
    <form className="wb-maske wb-block" onSubmit={absenden}>
      <h2 className="wb-feld--breit">Termin vom {datum(vertrag.naechsteWartung)} erledigt</h2>
      <label className="wb-feld wb-feld--breit">
        <span>Anmerkung</span>
        <input type="text" value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="z. B. 12 Löscher geprüft, einer getauscht" autoFocus />
      </label>
      <p className="wb-feld--breit">
        {vertrag.intervallMonate
          ? `Der nächste Termin rückt um ${vertrag.intervallMonate} Monate weiter — gerechnet vom Fälligkeitstag, nicht von heute.`
          : "Danach ist kein weiterer Termin eingetragen."}
      </p>
      {fehler && <p className="wb-fehler wb-feld--breit" role="alert">{fehler}</p>}
      <div className="wb-aktionen wb-feld--breit">
        <button className="wb-button" type="submit">Festhalten</button>
        <button className="wb-button wb-button--sekundaer" type="button" onClick={beiAbbruch}>Abbrechen</button>
      </div>
    </form>
  );
}

function Kuendigungsmaske({
  vertrag,
  eigen,
  beiFertig,
  beiAbbruch,
}: {
  vertrag: Vertrag;
  eigen: boolean;
  beiFertig: () => void;
  beiAbbruch: () => void;
}) {
  const [eingang, setEingang] = useState(heute());
  const [notiz, setNotiz] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const zum = eingang ? kuendigungWirktZum(vertrag, eingang) : "";

  async function absenden(e: FormEvent) {
    e.preventDefault();
    try {
      await kuendigen(vertrag, eingang, notiz);
      beiFertig();
    } catch (x: unknown) {
      setFehler(fehlersatz(x));
    }
  }

  return (
    <form className="wb-maske wb-block" onSubmit={absenden}>
      <h2 className="wb-feld--breit">Kündigung erfassen</h2>
      <label className="wb-feld">
        <span>{eigen ? "Beim Partner eingegangen am" : "Eingegangen am"}</span>
        <input type="date" value={eingang} max={heute()} onChange={(e) => setEingang(e.target.value)} required />
      </label>
      <label className="wb-feld">
        <span>Von wem, warum</span>
        <input type="text" value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder={eigen ? "z. B. eingeschrieben gekündigt, günstigeres Angebot" : "z. B. Kunde, Hausverwaltung wechselt"} />
      </label>
      <p className="wb-feld--breit">
        Wirkt zum <strong>{zum ? new Date(`${zum}T00:00:00`).toLocaleDateString("de-AT") : "—"}</strong> — so ergibt es sich aus
        Laufzeit und Kündigungsfrist. Bis dahin erinnert der Vertrag weiter an {eigen ? "Termine" : "Wartungen und Pauschalen"}, danach nicht mehr.
      </p>
      {fehler && <p className="wb-fehler wb-feld--breit" role="alert">{fehler}</p>}
      <div className="wb-aktionen wb-feld--breit">
        <button className="wb-button" type="submit">Kündigung festhalten</button>
        <button className="wb-button wb-button--sekundaer" type="button" onClick={beiAbbruch}>Abbrechen</button>
      </div>
    </form>
  );
}
