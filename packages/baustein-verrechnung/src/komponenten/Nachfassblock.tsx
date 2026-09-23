import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  aktuellerBenutzer,
  betriebLaden,
  darfSchreiben,
  fehlersatz,
  nachfassRhythmus,
  Symbol,
} from "@werkboq/core";
import { folgebelegErstellen, heute, type Beleg } from "../daten/belege";
import {
  ABSAGEGRUENDE,
  ABSAGEGRUND_TEXT,
  abgesagt,
  angenommen,
  KONTAKTART_TEXT,
  KONTAKTARTEN,
  kontakteZu,
  nachfassstand,
  nachgefasst,
  NACHFASSZUSTAND_FARBE,
  NACHFASSZUSTAND_TEXT,
  plusTage,
  termintext,
  wiedervorlageSetzen,
  type Absagegrund,
  type Angebotskontakt,
  type Kontaktart,
} from "../daten/nachfassen";

/**
 * Alles, was man mit einem offenen Angebot tut: nachfassen, eine
 * Wiedervorlage setzen, Zusage, Absage.
 *
 * Steht in der Belegakte und — aufgeklappt — auf der Seite Angebote. An
 * beiden Stellen dieselbe Komponente, damit „nachgefasst" nicht an der
 * einen Stelle etwas anderes bedeutet als an der anderen.
 */

type Maske = "kontakt" | "wiedervorlage" | "absage" | "annahme" | null;

export function Nachfassblock({
  angebot,
  beiAenderung,
  kompakt = false,
}: {
  angebot: Beleg;
  beiAenderung: () => void;
  /** Auf der Angebotsseite: ohne Überschrift, der Kopf steht schon in der Zeile. */
  kompakt?: boolean;
}) {
  const navigate = useNavigate();
  const [kontakte, setKontakte] = useState<Angebotskontakt[]>([]);
  const [rhythmus, setRhythmus] = useState<number[]>(nachfassRhythmus(null));
  const [maske, setMaske] = useState<Maske>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [ergebnis, setErgebnis] = useState<{ auftragId: string; neu: boolean } | null>(null);
  const darf = darfSchreiben("buchhaltung");

  const laden = useCallback(() => {
    kontakteZu([angebot.id])
      .then(setKontakte)
      .catch((e: unknown) => setFehler(fehlersatz(e)));
    betriebLaden()
      .then((b) => setRhythmus(nachfassRhythmus(b?.nachfassTage)))
      .catch(() => undefined);
  }, [angebot.id]);

  useEffect(laden, [laden]);

  const stand = nachfassstand(angebot, kontakte, rhythmus);

  async function tu(was: () => Promise<void>) {
    setLaeuft(true);
    try {
      await was();
      setFehler(null);
      setMaske(null);
      laden();
      beiAenderung();
    } catch (e: unknown) {
      setFehler(fehlersatz(e));
    } finally {
      setLaeuft(false);
    }
  }

  // Nach der Zusage: nicht einfach verschwinden, sondern sagen, was mit
  // dem Auftrag passiert ist, und den nächsten Schritt anbieten.
  if (ergebnis) {
    return (
      <section className={kompakt ? "wb-nachfass wb-nachfass--kompakt" : "wb-block wb-nachfass"}>
        <p className="wb-hinweis" role="status">
          <Symbol name="haken" groesse={16} /> Angenommen.{" "}
          {ergebnis.neu ? "Ein neuer Auftrag ist angelegt." : "Der Auftrag ist weitergerückt."}
        </p>
        <div className="wb-aktionen">
          <button
            type="button"
            className="wb-button"
            disabled={laeuft}
            onClick={() =>
              void (async () => {
                setLaeuft(true);
                try {
                  const ab = await folgebelegErstellen(angebot, "auftragsbestaetigung");
                  navigate(`/belege/${ab.id}`);
                } catch (e: unknown) {
                  setFehler(fehlersatz(e));
                  setLaeuft(false);
                }
              })()
            }
          >
            Auftragsbestätigung erstellen
          </button>
          <Link className="wb-button wb-button--sekundaer" to={`/auftraege/${ergebnis.auftragId}`}>
            Zum Auftrag
          </Link>
          <button type="button" className="wb-button wb-button--sekundaer" onClick={beiAenderung}>
            Fertig
          </button>
        </div>
        {fehler && <p className="wb-fehler" role="alert">{fehler}</p>}
      </section>
    );
  }

  if (angebot.status !== "offen") return null;

  return (
    <section className={kompakt ? "wb-nachfass wb-nachfass--kompakt" : "wb-block wb-nachfass"}>
      {!kompakt && (
        <div className="wb-block__kopf">
          <h2>Nachfassen</h2>
          <span className={`wb-plakette wb-plakette--${NACHFASSZUSTAND_FARBE[stand.zustand]}`}>
            {NACHFASSZUSTAND_TEXT[stand.zustand]}
          </span>
        </div>
      )}

      <p className="wb-nachfass__stand">
        {stand.zustand === "kalt" ? (
          <>
            {termintext(stand)}. Noch einmal anrufen — oder mit „Keine Rückmeldung" schließen,
            damit es aus der Liste geht.
          </>
        ) : (
          <>
            {stand.zustand === "faellig"
              ? stand.tage === 0
                ? "Heute nachfassen"
                : `Fällig ${termintext(stand)}`
              : `Nächstes Mal ${termintext(stand)}`}
            {stand.termin && stand.tage !== 0 && ` (${new Date(`${stand.termin}T00:00:00`).toLocaleDateString("de-AT")})`}
            {stand.quelle === "wiedervorlage"
              ? " — so vereinbart"
              : ` — ${stand.kontakte + 1}. Mal laut Rhythmus`}
            .
          </>
        )}
      </p>

      {kontakte.length > 0 && (
        <ol className="wb-kontaktliste">
          {kontakte.map((k) => (
            <li key={k.id}>
              <span className="wb-kontaktliste__datum">
                {new Date(`${k.datum.slice(0, 10)}T00:00:00`).toLocaleDateString("de-AT")}
              </span>
              <span className="wb-kontaktliste__art">{KONTAKTART_TEXT[k.art]}</span>
              <span className="wb-kontaktliste__notiz">
                {k.notiz || "—"}
                {k.wer && <small> · {k.wer}</small>}
              </span>
            </li>
          ))}
        </ol>
      )}

      {fehler && <p className="wb-fehler" role="alert">{fehler}</p>}

      {darf && maske === null && (
        <div className="wb-aktionen">
          <button type="button" className="wb-button" onClick={() => setMaske("kontakt")}>
            <Symbol name="telefon" groesse={16} />
            Nachgefasst
          </button>
          <button type="button" className="wb-button wb-button--sekundaer" onClick={() => setMaske("wiedervorlage")}>
            <Symbol name="kalender" groesse={16} />
            Wiedervorlage
          </button>
          <button type="button" className="wb-button wb-button--sekundaer" onClick={() => setMaske("annahme")}>
            <Symbol name="haken" groesse={16} />
            Angenommen
          </button>
          <button type="button" className="wb-button wb-button--sekundaer" onClick={() => setMaske("absage")}>
            <Symbol name="kreuz" groesse={16} />
            Abgelehnt
          </button>
        </div>
      )}

      {maske === "kontakt" && (
        <Kontaktmaske
          laeuft={laeuft}
          beiAbbruch={() => setMaske(null)}
          beiAbsenden={(e) =>
            void tu(() => nachgefasst(angebot, { ...e, wer: aktuellerBenutzer()?.name ?? "" }))
          }
        />
      )}

      {maske === "wiedervorlage" && (
        <Wiedervorlagemaske
          vorher={angebot.wiedervorlage?.slice(0, 10) ?? ""}
          laeuft={laeuft}
          beiAbbruch={() => setMaske(null)}
          beiAbsenden={(d) => void tu(() => wiedervorlageSetzen(angebot, d))}
        />
      )}

      {maske === "absage" && (
        <Absagemaske
          vorschlag={stand.zustand === "kalt" ? "keine_rueckmeldung" : undefined}
          laeuft={laeuft}
          beiAbbruch={() => setMaske(null)}
          beiAbsenden={(g, n) => void tu(() => abgesagt(angebot, g, n))}
        />
      )}

      {maske === "annahme" && (
        <Annahmemaske
          mitAuftrag={Boolean(angebot.auftrag)}
          vorschlag={angebot.kopftext ?? ""}
          laeuft={laeuft}
          beiAbbruch={() => setMaske(null)}
          beiAbsenden={(titel) =>
            void (async () => {
              setLaeuft(true);
              try {
                setErgebnis(await angenommen(angebot, titel));
                setFehler(null);
              } catch (e: unknown) {
                setFehler(fehlersatz(e));
              } finally {
                setLaeuft(false);
              }
            })()
          }
        />
      )}
    </section>
  );
}

function Kontaktmaske({
  laeuft,
  beiAbbruch,
  beiAbsenden,
}: {
  laeuft: boolean;
  beiAbbruch: () => void;
  beiAbsenden: (e: { datum: string; art: Kontaktart; notiz: string; wiedervorlage: string }) => void;
}) {
  const [datum, setDatum] = useState(heute());
  const [art, setArt] = useState<Kontaktart>("telefon");
  const [notiz, setNotiz] = useState("");
  const [wiedervorlage, setWiedervorlage] = useState("");

  return (
    <form
      className="wb-maske wb-maske--eng"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        beiAbsenden({ datum, art, notiz, wiedervorlage });
      }}
    >
      <label className="wb-feld">
        <span>Wann</span>
        <input type="date" value={datum} max={heute()} onChange={(e) => setDatum(e.target.value)} required />
      </label>
      <label className="wb-feld">
        <span>Wie</span>
        <select value={art} onChange={(e) => setArt(e.target.value as Kontaktart)}>
          {KONTAKTARTEN.map((a) => (
            <option key={a} value={a}>
              {KONTAKTART_TEXT[a]}
            </option>
          ))}
        </select>
      </label>
      <label className="wb-feld wb-feld--breit">
        <span>Was kam heraus</span>
        <input
          type="text"
          value={notiz}
          onChange={(e) => setNotiz(e.target.value)}
          placeholder="z. B. will noch mit der Hausverwaltung reden"
        />
      </label>
      <label className="wb-feld wb-feld--breit">
        <span>Neuer Termin (freiwillig)</span>
        <input type="date" value={wiedervorlage} min={heute()} onChange={(e) => setWiedervorlage(e.target.value)} />
        <small className="wb-notiz">Leer lassen: der nächste Termin kommt aus dem Rhythmus.</small>
      </label>
      <div className="wb-aktionen wb-feld--breit">
        <button className="wb-button" type="submit" disabled={laeuft}>
          Festhalten
        </button>
        <button className="wb-button wb-button--sekundaer" type="button" onClick={beiAbbruch}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}

function Wiedervorlagemaske({
  vorher,
  laeuft,
  beiAbbruch,
  beiAbsenden,
}: {
  vorher: string;
  laeuft: boolean;
  beiAbbruch: () => void;
  beiAbsenden: (datum: string) => void;
}) {
  const [datum, setDatum] = useState(vorher || plusTage(heute(), 14));
  return (
    <form
      className="wb-maske wb-maske--eng"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        beiAbsenden(datum);
      }}
    >
      <label className="wb-feld">
        <span>Wiedervorlage am</span>
        <input type="date" value={datum} min={heute()} onChange={(e) => setDatum(e.target.value)} required />
      </label>
      <div className="wb-aktionen wb-feld--breit">
        <button className="wb-button" type="submit" disabled={laeuft}>
          Setzen
        </button>
        {vorher && (
          <button className="wb-button wb-button--sekundaer" type="button" disabled={laeuft} onClick={() => beiAbsenden("")}>
            Entfernen
          </button>
        )}
        <button className="wb-button wb-button--sekundaer" type="button" onClick={beiAbbruch}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}

function Absagemaske({
  vorschlag,
  laeuft,
  beiAbbruch,
  beiAbsenden,
}: {
  vorschlag?: Absagegrund;
  laeuft: boolean;
  beiAbbruch: () => void;
  beiAbsenden: (grund: Absagegrund, notiz: string) => void;
}) {
  const [grund, setGrund] = useState<Absagegrund | "">(vorschlag ?? "");
  const [notiz, setNotiz] = useState("");
  return (
    <form
      className="wb-maske wb-maske--eng"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        if (grund) beiAbsenden(grund, notiz);
      }}
    >
      <label className="wb-feld">
        <span>Warum</span>
        <select value={grund} onChange={(e) => setGrund(e.target.value as Absagegrund)} required>
          <option value="">bitte wählen</option>
          {ABSAGEGRUENDE.map((g) => (
            <option key={g} value={g}>
              {ABSAGEGRUND_TEXT[g]}
            </option>
          ))}
        </select>
      </label>
      <label className="wb-feld wb-feld--breit">
        <span>Notiz</span>
        <input
          type="text"
          value={notiz}
          onChange={(e) => setNotiz(e.target.value)}
          placeholder={grund === "konkurrenz" ? "an wen, um wie viel billiger?" : ""}
        />
      </label>
      <div className="wb-aktionen wb-feld--breit">
        <button className="wb-button" type="submit" disabled={laeuft || !grund}>
          Als abgelehnt schließen
        </button>
        <button className="wb-button wb-button--sekundaer" type="button" onClick={beiAbbruch}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}

function Annahmemaske({
  mitAuftrag,
  vorschlag,
  laeuft,
  beiAbbruch,
  beiAbsenden,
}: {
  mitAuftrag: boolean;
  vorschlag: string;
  laeuft: boolean;
  beiAbbruch: () => void;
  beiAbsenden: (titel?: string) => void;
}) {
  const [titel, setTitel] = useState(vorschlag.slice(0, 80));
  return (
    <form
      className="wb-maske wb-maske--eng"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        beiAbsenden(mitAuftrag ? undefined : titel);
      }}
    >
      {mitAuftrag ? (
        <p className="wb-leer wb-feld--breit">
          Der Auftrag dahinter rückt auf „Beauftragt" vor, sofern er nicht schon weiter ist.
        </p>
      ) : (
        <label className="wb-feld wb-feld--breit">
          <span>Titel des neuen Auftrags</span>
          <input
            type="text"
            value={titel}
            onChange={(e) => setTitel(e.target.value)}
            placeholder="z. B. Elektroinstallation Dachgeschoß"
          />
          <small className="wb-notiz">
            Das Angebot hängt an keinem Auftrag — bei der Zusage wird einer angelegt.
          </small>
        </label>
      )}
      <div className="wb-aktionen wb-feld--breit">
        <button className="wb-button" type="submit" disabled={laeuft}>
          Zusage festhalten
        </button>
        <button className="wb-button wb-button--sekundaer" type="button" onClick={beiAbbruch}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}
