import { useState, type FormEvent } from "react";
import { aktuellerRechtsraum, darfSchreiben, fehlersatz, Symbol } from "@werkboq/core";
import {
  fristAendern,
  fristAnlegen,
  fristErledigen,
  fristLoeschen,
  type Fahrzeug,
  type Fahrzeugfrist,
  type FristEingabe,
} from "../daten/fahrzeuge";
import {
  faelligkeitstext,
  FRIST_FARBE,
  FRIST_TEXT,
  FRISTART_TEXT,
  FRISTARTEN,
  heute,
  INTERVALL_VORSCHLAG,
  nachDringlichkeit,
  naechsteFaelligkeit,
  naechsterKm,
  VORWARNUNG,
} from "../daten/fristen";

/**
 * Die Fristen eines Fahrzeugs.
 *
 * Erledigte bleiben stehen und lassen sich einblenden: „wann war das
 * Fahrzeug zuletzt beim Service" ist genau die Frage, die im Streit mit
 * der Werkstatt oder beim Verkauf gestellt wird.
 */
export function Fristenblock({
  fahrzeug,
  fristen,
  beiAenderung,
}: {
  fahrzeug: Fahrzeug;
  fristen: Fahrzeugfrist[];
  beiAenderung: () => void;
}) {
  const raum = aktuellerRechtsraum();
  const [maske, setMaske] = useState<Fahrzeugfrist | "neu" | null>(null);
  const [erledigen, setErledigen] = useState<Fahrzeugfrist | null>(null);
  const [zeigeErledigte, setZeigeErledigte] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const darfAendern = darfSchreiben("fuhrpark");
  const offen = fristen.filter((f) => !f.erledigtAm);
  const erledigt = fristen.filter((f) => f.erledigtAm);
  const sortiert = nachDringlichkeit(offen, heute(), fahrzeug.kmStand);

  async function entfernen(f: Fahrzeugfrist) {
    if (!confirm(`Frist „${f.titel || FRISTART_TEXT[f.art]}" entfernen?`)) return;
    try {
      await fristLoeschen(f);
      beiAenderung();
    } catch (e: unknown) {
      setFehler(fehlersatz(e));
    }
  }

  return (
    <section className="wb-block">
      <div className="wb-block__kopf">
        <h2>Fristen</h2>
        <span className="wb-block__summe">{offen.length} offen</span>
        {darfAendern && !maske && (
          <button className="wb-button" type="button" onClick={() => setMaske("neu")}>
            <Symbol name="plus" groesse={18} />
            Frist
          </button>
        )}
      </div>

      {fehler && (
        <p className="wb-fehler" role="alert">
          {fehler}
        </p>
      )}

      {maske && (
        <Fristmaske
          key={maske === "neu" ? "neu" : maske.id}
          fahrzeug={fahrzeug}
          vorhanden={maske === "neu" ? null : maske}
          beiGespeichert={() => {
            setMaske(null);
            beiAenderung();
          }}
          beiAbbruch={() => setMaske(null)}
        />
      )}

      {erledigen && (
        <Erledigungsmaske
          frist={erledigen}
          fahrzeug={fahrzeug}
          beiFertig={() => {
            setErledigen(null);
            beiAenderung();
          }}
          beiAbbruch={() => setErledigen(null)}
        />
      )}

      {offen.length === 0 ? (
        <p className="wb-leer">
          Keine offene Frist. Die {raum.fahrzeugpruefungKurz}-Fälligkeit steht im Zulassungsschein
          oder auf der Plakette — eintragen, und das Fahrzeug meldet sich rechtzeitig selbst.
        </p>
      ) : (
        <ul className="wb-fristenliste">
          {sortiert.map(({ frist, zustand }) => (
            <li key={frist.id}>
              <span className={`wb-plakette wb-plakette--${FRIST_FARBE[zustand]}`}>
                {FRIST_TEXT[zustand]}
              </span>
              <span className="wb-fristenliste__was">
                <strong>{frist.titel || FRISTART_TEXT[frist.art]}</strong>
                <span>
                  {frist.faellig
                    ? new Date(`${frist.faellig.slice(0, 10)}T00:00:00`).toLocaleDateString("de-AT")
                    : "ohne Datum"}
                  {frist.kmFaellig ? ` · ab ${frist.kmFaellig.toLocaleString("de-AT")} km` : ""}
                  {frist.intervallMonate ? ` · alle ${frist.intervallMonate} Monate` : ""}
                </span>
              </span>
              <span className="wb-fristenliste__wann">
                {faelligkeitstext(frist, zustand, heute(), fahrzeug.kmStand)}
              </span>
              {darfAendern && (
                <span className="wb-aktionen wb-aktionen--eng">
                  <button
                    type="button"
                    className="wb-button wb-button--klein"
                    onClick={() => setErledigen(frist)}
                  >
                    <Symbol name="haken" groesse={16} />
                    Erledigt
                  </button>
                  <button
                    type="button"
                    className="wb-zeilenknopf wb-zeilenknopf--neutral"
                    onClick={() => setMaske(frist)}
                    title="ändern"
                  >
                    <Symbol name="stift" groesse={16} />
                  </button>
                  <button
                    type="button"
                    className="wb-zeilenknopf"
                    onClick={() => void entfernen(frist)}
                    title="entfernen"
                  >
                    <Symbol name="muell" groesse={16} />
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {erledigt.length > 0 && (
        <>
          <button
            type="button"
            className="wb-button wb-button--sekundaer wb-button--klein"
            onClick={() => setZeigeErledigte(!zeigeErledigte)}
            aria-expanded={zeigeErledigte}
          >
            {zeigeErledigte ? "Erledigte ausblenden" : `${erledigt.length} Erledigte zeigen`}
          </button>
          {zeigeErledigte && (
            <ul className="wb-fristenliste wb-fristenliste--erledigt">
              {erledigt
                .slice()
                .sort((a, b) => (b.erledigtAm ?? "").localeCompare(a.erledigtAm ?? ""))
                .map((f) => (
                  <li key={f.id}>
                    <Symbol name="haken" groesse={16} />
                    <span className="wb-fristenliste__was">
                      <strong>{f.titel || FRISTART_TEXT[f.art]}</strong>
                      <span>
                        erledigt am{" "}
                        {new Date(`${f.erledigtAm!.slice(0, 10)}T00:00:00`).toLocaleDateString("de-AT")}
                        {f.erledigtKm ? ` bei ${f.erledigtKm.toLocaleString("de-AT")} km` : ""}
                      </span>
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function Fristmaske({
  fahrzeug,
  vorhanden,
  beiGespeichert,
  beiAbbruch,
}: {
  fahrzeug: Fahrzeug;
  vorhanden: Fahrzeugfrist | null;
  beiGespeichert: () => void;
  beiAbbruch: () => void;
}) {
  const raum = aktuellerRechtsraum();
  const [werte, setWerte] = useState<FristEingabe>(
    vorhanden
      ? { ...vorhanden }
      : {
          fahrzeug: fahrzeug.id,
          art: "begutachtung",
          titel: "",
          faellig: "",
          kmFaellig: 0,
          erinnerungTage: VORWARNUNG.begutachtung,
          intervallMonate: INTERVALL_VORSCHLAG.begutachtung,
          intervallKm: 0,
          erledigtAm: "",
          notiz: "",
        },
  );
  const [fehler, setFehler] = useState<string | null>(null);
  const [speichert, setSpeichert] = useState(false);

  function feld<K extends keyof FristEingabe>(k: K, v: FristEingabe[K]) {
    setWerte((alt) => ({ ...alt, [k]: v }));
  }

  /** Art gewechselt: Vorwarnzeit und Intervall folgen dem Vorschlag. */
  function artWaehlen(a: FristEingabe["art"]) {
    setWerte((alt) => ({
      ...alt,
      art: a,
      erinnerungTage: VORWARNUNG[a],
      intervallMonate: INTERVALL_VORSCHLAG[a],
    }));
  }

  async function absenden(e: FormEvent) {
    e.preventDefault();
    if (!werte.faellig && !werte.kmFaellig) {
      setFehler("Ohne Datum und ohne Kilometerstand gibt es nichts zu überwachen.");
      return;
    }
    setSpeichert(true);
    setFehler(null);
    try {
      if (vorhanden) await fristAendern(vorhanden, werte);
      else await fristAnlegen(werte);
      beiGespeichert();
    } catch (e: unknown) {
      setFehler(fehlersatz(e));
    } finally {
      setSpeichert(false);
    }
  }

  return (
    <form className="wb-maske" onSubmit={absenden}>
      <label className="wb-feld">
        <span>Art</span>
        <select value={werte.art} onChange={(e) => artWaehlen(e.target.value as FristEingabe["art"])}>
          {FRISTARTEN.map((a) => (
            <option key={a} value={a}>
              {FRISTART_TEXT[a]}
            </option>
          ))}
        </select>
        {werte.art === "begutachtung" && (
          <small className="wb-notiz">
            {raum.fahrzeugpruefung} nach {raum.fahrzeugpruefungParagraf}. Wie oft, hängt von
            Fahrzeugklasse und Alter ab — Werkboq rechnet das bewusst nicht aus, sondern erinnert
            an das Datum, das hier steht.
          </small>
        )}
      </label>

      <label className="wb-feld">
        <span>Bezeichnung</span>
        <input
          type="text"
          value={werte.titel ?? ""}
          onChange={(e) => feld("titel", e.target.value)}
          placeholder={FRISTART_TEXT[werte.art]}
        />
      </label>

      <label className="wb-feld">
        <span>Fällig am</span>
        <input
          type="date"
          value={werte.faellig?.slice(0, 10) ?? ""}
          onChange={(e) => feld("faellig", e.target.value)}
        />
      </label>

      <label className="wb-feld">
        <span>Oder ab Kilometerstand</span>
        <input
          type="number"
          min={0}
          value={werte.kmFaellig ?? 0}
          onChange={(e) => feld("kmFaellig", Number(e.target.value))}
        />
        <small className="wb-notiz">0 = nur nach Datum</small>
      </label>

      <label className="wb-feld">
        <span>Erinnern ab (Tage vorher)</span>
        <input
          type="number"
          min={0}
          value={werte.erinnerungTage ?? 0}
          onChange={(e) => feld("erinnerungTage", Number(e.target.value))}
        />
      </label>

      <label className="wb-feld">
        <span>Wiederholt sich alle (Monate)</span>
        <input
          type="number"
          min={0}
          value={werte.intervallMonate ?? 0}
          onChange={(e) => feld("intervallMonate", Number(e.target.value))}
        />
        <small className="wb-notiz">0 = einmalig, kein Nachfolger</small>
      </label>

      <label className="wb-feld">
        <span>oder alle (Kilometer)</span>
        <input
          type="number"
          min={0}
          value={werte.intervallKm ?? 0}
          onChange={(e) => feld("intervallKm", Number(e.target.value))}
        />
      </label>

      {fehler && (
        <p className="wb-fehler wb-feld--breit" role="alert">
          {fehler}
        </p>
      )}

      <div className="wb-aktionen wb-feld--breit">
        <button className="wb-button" type="submit" disabled={speichert}>
          {vorhanden ? "Speichern" : "Anlegen"}
        </button>
        <button className="wb-button wb-button--sekundaer" type="button" onClick={beiAbbruch}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}

/**
 * Abhaken — und gleich die nächste stellen.
 *
 * Das vorgeschlagene Datum steht sichtbar da und lässt sich ändern. Wer es
 * leert, beendet die Reihe: manche Fristen laufen wirklich aus, etwa ein
 * Leasingvertrag.
 */
function Erledigungsmaske({
  frist,
  fahrzeug,
  beiFertig,
  beiAbbruch,
}: {
  frist: Fahrzeugfrist;
  fahrzeug: Fahrzeug;
  beiFertig: () => void;
  beiAbbruch: () => void;
}) {
  const [am, setAm] = useState(heute());
  const [km, setKm] = useState(fahrzeug.kmStand ?? 0);
  const [naechste, setNaechste] = useState(
    naechsteFaelligkeit(frist.faellig ?? "", frist.intervallMonate ?? 0),
  );
  const [naechsteKm, setNaechsteKm] = useState(naechsterKm(frist.kmFaellig, frist.intervallKm));
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  async function absenden(e: FormEvent) {
    e.preventDefault();
    setLaeuft(true);
    setFehler(null);
    try {
      await fristErledigen(frist, { am, km, naechste, naechsteKm });
      beiFertig();
    } catch (e: unknown) {
      setFehler(fehlersatz(e));
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <form className="wb-maske" onSubmit={absenden}>
      <p className="wb-hinweis wb-feld--breit">
        <strong>{frist.titel || FRISTART_TEXT[frist.art]}</strong> abhaken.
      </p>

      <label className="wb-feld">
        <span>Erledigt am</span>
        <input type="date" value={am} onChange={(e) => setAm(e.target.value)} required />
      </label>

      <label className="wb-feld">
        <span>Bei Kilometerstand</span>
        <input type="number" min={0} value={km} onChange={(e) => setKm(Number(e.target.value))} />
      </label>

      <label className="wb-feld">
        <span>Nächste Fälligkeit</span>
        <input type="date" value={naechste} onChange={(e) => setNaechste(e.target.value)} />
        <small className="wb-notiz">
          Gerechnet vom Fälligkeitsdatum, nicht vom heutigen Tag — sonst wandert der Termin mit
          jeder Erledigung nach vorne. Leer lassen beendet die Reihe.
        </small>
      </label>

      <label className="wb-feld">
        <span>Nächster Kilometerstand</span>
        <input
          type="number"
          min={0}
          value={naechsteKm}
          onChange={(e) => setNaechsteKm(Number(e.target.value))}
        />
      </label>

      {fehler && (
        <p className="wb-fehler wb-feld--breit" role="alert">
          {fehler}
        </p>
      )}

      <div className="wb-aktionen wb-feld--breit">
        <button className="wb-button" type="submit" disabled={laeuft}>
          {laeuft ? "Wird gespeichert …" : "Erledigt und nächste stellen"}
        </button>
        <button className="wb-button wb-button--sekundaer" type="button" onClick={beiAbbruch}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}
