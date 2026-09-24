import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { aktuellerRechtsraum, alsEuro, darfSchreiben, fehlersatz, schreibweiseVon } from "@werkboq/core";
import {
  kuendigungWirktZum,
  laufzeit,
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
  const [v, setV] = useState<Vertrag | null>(null);
  const [liste, setListe] = useState<Vertragsereignis[]>([]);
  const [bearbeiten, setBearbeiten] = useState(neu);
  const [nummer, setNummer] = useState("");
  const [kuendigung, setKuendigung] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const darf = darfSchreiben("buchhaltung");
  const sw = schreibweiseVon(aktuellerRechtsraum().id);

  const laden = useCallback(() => {
    if (!id || neu) {
      void naechsteVertragsnummer().then(setNummer);
      return;
    }
    vertragLaden(id)
      .then(async (x) => {
        setV(x);
        setListe(await ereignisse(x.id).catch(() => []));
      })
      .catch((e: unknown) => setFehler(fehlersatz(e)));
  }, [id, neu]);
  useEffect(laden, [laden]);

  if (neu) {
    if (!nummer) return <p className="wb-leer">Wird vorbereitet …</p>;
    return (
      <section>
        <div className="wb-kopf">
          <h1>Neuer Wartungsvertrag</h1>
        </div>
        <Vertragsmaske
          vorher={{ ...leererVertrag(), nummer, kunde: parameter.get("kunde") ?? "" }}
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

  return (
    <article className="wb-akte">
      <header className="wb-akte__kopf">
        <div>
          <p className="wb-akte__kennung">
            Wartungsvertrag · {v.nummer}
            {v.expand?.kunde && (
              <>
                {" · "}
                <Link to={`/kunden/${v.kunde}`}>{v.expand.kunde.name}</Link>
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

      {kuendigung && <Kuendigungsmaske vertrag={v} beiFertig={() => { setKuendigung(false); laden(); }} beiAbbruch={() => setKuendigung(false)} />}

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
                <div><dt>Art</dt><dd>{VERRECHNUNGSART_TEXT[v.verrechnung]}</dd></div>
                {v.verrechnung === "pauschale" && (
                  <>
                    <div><dt>Pauschale</dt><dd>{alsEuro(v.pauschale ?? 0, sw)} netto {RHYTHMUS_TEXT[v.rhythmus ?? "jahr"]}</dd></div>
                    <div><dt>Nächste Rechnung</dt><dd>{datum(v.naechsteRechnung)}</dd></div>
                    <div><dt>Preis zuletzt geprüft</dt><dd>{datum(v.preisStand || v.beginn)}</dd></div>
                  </>
                )}
              </dl>
            </section>
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
                      {{ wartung: "Wartung", rechnung: "Rechnung", kuendigung: "Kündigung", preis: "Preis" }[e.art]}
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

function Kuendigungsmaske({ vertrag, beiFertig, beiAbbruch }: { vertrag: Vertrag; beiFertig: () => void; beiAbbruch: () => void }) {
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
        <span>Eingegangen am</span>
        <input type="date" value={eingang} max={heute()} onChange={(e) => setEingang(e.target.value)} required />
      </label>
      <label className="wb-feld">
        <span>Von wem, warum</span>
        <input type="text" value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="z. B. Kunde, Hausverwaltung wechselt" />
      </label>
      <p className="wb-feld--breit">
        Wirkt zum <strong>{zum ? new Date(`${zum}T00:00:00`).toLocaleDateString("de-AT") : "—"}</strong> — so ergibt es sich aus
        Laufzeit und Kündigungsfrist. Bis dahin erinnert der Vertrag weiter an Wartungen und Pauschalen, danach nicht mehr.
      </p>
      {fehler && <p className="wb-fehler wb-feld--breit" role="alert">{fehler}</p>}
      <div className="wb-aktionen wb-feld--breit">
        <button className="wb-button" type="submit">Kündigung festhalten</button>
        <button className="wb-button wb-button--sekundaer" type="button" onClick={beiAbbruch}>Abbrechen</button>
      </div>
    </form>
  );
}
