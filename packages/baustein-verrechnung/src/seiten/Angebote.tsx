import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  aktuellerRechtsraum,
  alsEuro,
  betriebLaden,
  fehlersatz,
  nachfassRhythmus,
  schreibweiseVon,
  type Schreibweise,
} from "@werkboq/core";
import { type Beleg } from "../daten/belege";
import {
  ABSAGEGRUND_TEXT,
  absagenNachGrund,
  entschiedeneAngebote,
  kontakteZu,
  nachDringlichkeit,
  nachfassstand,
  NACHFASSZUSTAND_FARBE,
  NACHFASSZUSTAND_TEXT,
  offeneAngebote,
  termintext,
  type Angebotskontakt,
  type Nachfassstand,
  type Nachfasszustand,
} from "../daten/nachfassen";
import { Nachfassblock } from "../komponenten/Nachfassblock";

/**
 * Offene Angebote — nach dem, was heute zu tun ist.
 *
 * Drei Gruppen statt einer Liste nach Datum: „Nachfassen" ist die Arbeit
 * von heute, „Wartet" ist erledigt bis zum Termin, „Kalt" braucht eine
 * Entscheidung. Eine Liste nach Datum zeigt oben das älteste Angebot, und
 * das ist meistens das, um das man sich am wenigsten kümmern muss.
 *
 * Darunter die Auswertung des letzten Jahres: wie viel angenommen, wie
 * viel verloren, und woran.
 */

interface Zeile {
  angebot: Beleg;
  stand: Nachfassstand;
  letzter?: Angebotskontakt;
}

const GRUPPEN: { zustand: Nachfasszustand; titel: string; leer: string }[] = [
  { zustand: "faellig", titel: "Heute nachfassen", leer: "Heute ist niemand anzurufen." },
  { zustand: "wartet", titel: "Wartet", leer: "Nichts in Warteschleife." },
  { zustand: "kalt", titel: "Kalt", leer: "Kein Angebot ist eingeschlafen." },
];

export function Angebote() {
  const [zeilen, setZeilen] = useState<Zeile[] | null>(null);
  const [entschieden, setEntschieden] = useState<Beleg[]>([]);
  const [offen, setOffen] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const sw = schreibweiseVon(aktuellerRechtsraum().id);

  const laden = useCallback(() => {
    Promise.all([offeneAngebote(), betriebLaden().catch(() => null), entschiedeneAngebote(365)])
      .then(async ([angebote, betrieb, fertig]) => {
        const rhythmus = nachfassRhythmus(betrieb?.nachfassTage);
        const kontakte = await kontakteZu(angebote.map((a) => a.id));
        setZeilen(
          nachDringlichkeit(
            angebote.map((a) => {
              const eigene = kontakte.filter((k) => k.beleg === a.id);
              return { angebot: a, stand: nachfassstand(a, eigene, rhythmus), letzter: eigene[0] };
            }),
          ),
        );
        setEntschieden(fertig);
        setFehler(null);
      })
      .catch((e: unknown) => setFehler(fehlersatz(e)));
  }, []);

  useEffect(laden, [laden]);

  const summeOffen = useMemo(() => (zeilen ?? []).reduce((s, z) => s + z.angebot.netto, 0), [zeilen]);

  if (fehler && !zeilen) return <p className="wb-fehler" role="alert">{fehler}</p>;
  if (!zeilen) return <p className="wb-leer">Wird geladen …</p>;

  const faellig = zeilen.filter((z) => z.stand.zustand === "faellig").length;

  return (
    <section>
      <div className="wb-kopf">
        <div>
          <h1>Angebote</h1>
          <p className="wb-kopf__zahl">
            {zeilen.length} offen · {alsEuro(summeOffen, sw)} netto
            {faellig > 0 && <> · <strong>{faellig} heute nachfassen</strong></>}
          </p>
        </div>
      </div>

      {fehler && <p className="wb-fehler" role="alert">{fehler}</p>}

      {zeilen.length === 0 ? (
        <div className="wb-nichts">
          <p>Kein offenes Angebot.</p>
          <p className="wb-leer">
            Ein Angebot erscheint hier, sobald es festgeschrieben ist — dann ist es beim Kunden,
            und ab da zählt die Zeit.
          </p>
        </div>
      ) : (
        GRUPPEN.map((g) => {
          const liste = zeilen.filter((z) => z.stand.zustand === g.zustand);
          if (!liste.length && g.zustand !== "faellig") return null;
          return (
            <section key={g.zustand} className="wb-angebotsgruppe">
              <h2>
                {g.titel} <span className="wb-zaehler">{liste.length}</span>
              </h2>
              {liste.length === 0 ? (
                <p className="wb-leer">{g.leer}</p>
              ) : (
                <ul className="wb-angebotsliste">
                  {liste.map((z) => (
                    <li key={z.angebot.id} className={offen === z.angebot.id ? "ist-offen" : ""}>
                      <button
                        type="button"
                        className="wb-angebotsliste__kopf"
                        aria-expanded={offen === z.angebot.id}
                        onClick={() => setOffen((o) => (o === z.angebot.id ? null : z.angebot.id))}
                      >
                        <span className="wb-angebotsliste__wer">
                          <strong>{z.angebot.empfaengerName}</strong>
                          <small>
                            {z.angebot.nummer} · vom{" "}
                            {new Date(`${(z.angebot.festgeschrieben || z.angebot.datum).slice(0, 10)}T00:00:00`).toLocaleDateString("de-AT")}
                          </small>
                        </span>
                        <span className="wb-angebotsliste__betrag">{alsEuro(z.angebot.netto, sw)}</span>
                        <span className="wb-angebotsliste__wann">
                          <span className={`wb-plakette wb-plakette--${NACHFASSZUSTAND_FARBE[z.stand.zustand]}`}>
                            {NACHFASSZUSTAND_TEXT[z.stand.zustand]}
                          </span>
                          <small>{termintext(z.stand)}</small>
                        </span>
                        {z.letzter?.notiz && (
                          <span className="wb-angebotsliste__notiz">„{z.letzter.notiz}"</span>
                        )}
                      </button>
                      {offen === z.angebot.id && (
                        <div className="wb-angebotsliste__innen">
                          <Nachfassblock angebot={z.angebot} beiAenderung={laden} kompakt />
                          <Link className="wb-textlink" to={`/belege/${z.angebot.id}`}>
                            Angebot öffnen
                          </Link>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })
      )}

      <Auswertung entschieden={entschieden} sw={sw} />
    </section>
  );
}

/** Zusagequote und Absagegründe — woran der Betrieb Angebote verliert. */
function Auswertung({ entschieden, sw }: { entschieden: Beleg[]; sw: Schreibweise }) {
  if (!entschieden.length) return null;
  const an = entschieden.filter((b) => b.status === "angenommen");
  const ab = entschieden.filter((b) => b.status === "abgelehnt");
  const summe = (l: Beleg[]) => l.reduce((s, b) => s + b.netto, 0);
  const quote = Math.round((an.length / entschieden.length) * 100);
  const gruende = absagenNachGrund(ab);
  return (
    <section className="wb-block wb-angebotsauswertung">
      <h2>Die letzten zwölf Monate</h2>
      <dl className="wb-schnellzahlen">
        <div>
          <dt>Angenommen</dt>
          <dd>
            {an.length} · {alsEuro(summe(an), sw)}
          </dd>
        </div>
        <div>
          <dt>Verloren</dt>
          <dd>
            {ab.length} · {alsEuro(summe(ab), sw)}
          </dd>
        </div>
        <div>
          <dt>Zusagequote</dt>
          <dd>{quote} %</dd>
        </div>
      </dl>
      {gruende.length > 0 && (
        <>
          <h3>Woran Angebote verloren gingen</h3>
          <ul className="wb-gruende">
            {gruende.map((g) => (
              <li key={g.grund}>
                <span>{ABSAGEGRUND_TEXT[g.grund]}</span>
                <span>{g.anzahl}×</span>
                <span>{alsEuro(g.netto, sw)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
