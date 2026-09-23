import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  aktuellerRechtsraum,
  alsEuro,
  betriebLaden,
  darf,
  nachfassRhythmus,
  schreibweiseVon,
  Symbol,
} from "@werkboq/core";
import type { Beleg } from "../daten/belege";
import {
  kontakteZu,
  nachDringlichkeit,
  nachfassstand,
  NACHFASSZUSTAND_FARBE,
  NACHFASSZUSTAND_TEXT,
  offeneAngebote,
  termintext,
  type Nachfassstand,
} from "../daten/nachfassen";

/**
 * Angebote, bei denen heute nachgefasst werden sollte — auf der Startseite.
 *
 * Nur fürs Büro (Bereich Buchhaltung), und nur, wenn etwas fällig ist.
 * Eine Kachel, die täglich „nichts zu tun" meldet, wird überlesen — auch
 * an dem Tag, an dem sie etwas anderes sagt.
 */
export function AngebotKachel() {
  const [faellig, setFaellig] = useState<{ angebot: Beleg; stand: Nachfassstand }[]>([]);
  const sichtbar = darf("buchhaltung");

  useEffect(() => {
    if (!sichtbar) return;
    Promise.all([offeneAngebote(), betriebLaden().catch(() => null)])
      .then(async ([angebote, betrieb]) => {
        const rhythmus = nachfassRhythmus(betrieb?.nachfassTage);
        const kontakte = await kontakteZu(angebote.map((a) => a.id));
        const alle = angebote.map((a) => ({
          angebot: a,
          stand: nachfassstand(a, kontakte.filter((k) => k.beleg === a.id), rhythmus),
        }));
        setFaellig(nachDringlichkeit(alle.filter((z) => z.stand.zustand === "faellig")));
      })
      .catch(() => setFaellig([]));
  }, [sichtbar]);

  if (!sichtbar || !faellig.length) return null;
  const sw = schreibweiseVon(aktuellerRechtsraum().id);

  return (
    <section className="wb-block">
      <div className="wb-block__kopf">
        <h2>Angebote nachfassen</h2>
        <span className="wb-block__summe">{faellig.length}</span>
        <Link className="wb-button wb-button--sekundaer wb-button--klein" to="/angebote">
          Alle ansehen
        </Link>
      </div>
      <ul className="wb-fristenliste">
        {faellig.slice(0, 5).map(({ angebot, stand }) => (
          <li key={angebot.id}>
            <span className={`wb-plakette wb-plakette--${NACHFASSZUSTAND_FARBE[stand.zustand]}`}>
              {NACHFASSZUSTAND_TEXT[stand.zustand]}
            </span>
            <Link className="wb-fristenliste__was" to={`/belege/${angebot.id}`}>
              <strong>{angebot.empfaengerName}</strong>
              <span>
                {angebot.nummer} · {alsEuro(angebot.netto, sw)}
              </span>
            </Link>
            <span className="wb-fristenliste__wann">{termintext(stand)}</span>
          </li>
        ))}
      </ul>
      {faellig.length > 5 && (
        <p className="wb-notiz">
          <Symbol name="warnung" groesse={14} /> und {faellig.length - 5} weitere.
        </p>
      )}
    </section>
  );
}
