import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { fehlersatz, Symbol, type Mitarbeiter } from "@werkboq/core";
import {
  dateiAdresse,
  dokumentAendern,
  dokumentAnlegen,
  dokumenteZuMitarbeiter,
  dokumentLoeschen,
  DOKUMENTART_TEXT,
  DOKUMENTARTEN,
  FRIST_FARBE,
  FRIST_TEXT,
  fristzustand,
  LEERES_DOKUMENT,
  tageBis,
  VORWARNUNG,
  type Dokumentart,
  type Personaldokument,
} from "../daten/dokumente";
import { heute } from "../daten/abwesenheiten";

/**
 * Dokumente zu einem Mitarbeiter.
 *
 * Der Nutzen liegt nicht in der Ablage — Verträge liegen ohnehin im Ordner —,
 * sondern in der Spalte "Frist". Eine abgelaufene Unterweisung oder ein
 * abgelaufener Befähigungsnachweis fällt sonst niemandem auf, bis etwas
 * passiert oder die Arbeitsinspektion danach fragt.
 */
export function Dokumentenblock({
  mitarbeiter,
  darfAendern,
}: {
  mitarbeiter: Mitarbeiter;
  darfAendern: boolean;
}) {
  const [liste, setListe] = useState<Personaldokument[]>([]);
  const [maske, setMaske] = useState<Personaldokument | "neu" | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(() => {
    setLaedt(true);
    dokumenteZuMitarbeiter(mitarbeiter.id)
      .then(setListe)
      .catch((e: unknown) => setFehler(fehlersatz(e)))
      .finally(() => setLaedt(false));
  }, [mitarbeiter.id]);

  useEffect(laden, [laden]);

  return (
    <section className="wb-block">
      <div className="wb-block__kopf">
        <h2>Dokumente</h2>
        <span className="wb-block__summe">{liste.length}</span>
        {darfAendern && !maske && (
          <button className="wb-button" type="button" onClick={() => setMaske("neu")}>
            <Symbol name="plus" groesse={18} />
            Dokument ablegen
          </button>
        )}
      </div>

      {fehler && (
        <p className="wb-fehler" role="alert">
          {fehler}
        </p>
      )}

      {maske && (
        <Dokumentmaske
          key={maske === "neu" ? "neu" : maske.id}
          mitarbeiter={mitarbeiter}
          vorhanden={maske === "neu" ? null : maske}
          beiGespeichert={() => {
            setMaske(null);
            laden();
          }}
          beiAbbruch={() => setMaske(null)}
        />
      )}

      {laedt && liste.length === 0 && <p className="wb-leer">Wird geladen …</p>}
      {!laedt && liste.length === 0 && (
        <p className="wb-leer">Noch nichts abgelegt.</p>
      )}

      {liste.length > 0 && (
        <div className="wb-tabelle-rahmen">
          <table className="wb-tabelle">
            <thead>
              <tr>
                <th scope="col">Art</th>
                <th scope="col">Titel</th>
                <th scope="col">Ausgestellt</th>
                <th scope="col">Läuft ab</th>
                <th scope="col">Frist</th>
                <th scope="col" aria-label="Aktionen" />
              </tr>
            </thead>
            <tbody>
              {liste.map((d) => {
                const zustand = fristzustand(d);
                const adresse = dateiAdresse(d);
                return (
                  <tr key={d.id} className={d.erledigt ? "ist-stillgelegt" : ""}>
                    <td>{DOKUMENTART_TEXT[d.art]}</td>
                    <td>
                      {adresse ? (
                        <a href={adresse} target="_blank" rel="noreferrer">
                          {d.titel}
                        </a>
                      ) : (
                        d.titel
                      )}
                      {d.notiz && <small className="wb-unterzeile">{d.notiz}</small>}
                    </td>
                    <td className="wb-tabelle__kennung">{datum(d.ausgestelltAm)}</td>
                    <td className="wb-tabelle__kennung">{datum(d.laeuftAb)}</td>
                    <td>
                      <span className={`wb-plakette wb-plakette--${FRIST_FARBE[zustand]}`}>
                        {FRIST_TEXT[zustand]}
                      </span>
                      {d.laeuftAb && !d.erledigt && (
                        <small className="wb-unterzeile">{restText(d.laeuftAb)}</small>
                      )}
                    </td>
                    <td className="wb-zelle--rechts">
                      {darfAendern && (
                        <>
                          <button
                            type="button"
                            className="wb-zeilenknopf wb-zeilenknopf--neutral"
                            title="Bearbeiten"
                            onClick={() => setMaske(d)}
                          >
                            <Symbol name="stift" groesse={16} />
                          </button>
                          <button
                            type="button"
                            className="wb-zeilenknopf"
                            title="Löschen"
                            onClick={() => {
                              if (!confirm(`"${d.titel}" endgültig löschen?`)) return;
                              void dokumentLoeschen(d)
                                .then(laden)
                                .catch((e: unknown) => setFehler(fehlersatz(e)));
                            }}
                          >
                            <Symbol name="muell" groesse={16} />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Dokumentmaske({
  mitarbeiter,
  vorhanden,
  beiGespeichert,
  beiAbbruch,
}: {
  mitarbeiter: Mitarbeiter;
  vorhanden: Personaldokument | null;
  beiGespeichert: () => void;
  beiAbbruch: () => void;
}) {
  const [werte, setWerte] = useState(
    vorhanden
      ? {
          ...LEERES_DOKUMENT,
          ...vorhanden,
          ausgestelltAm: (vorhanden.ausgestelltAm ?? "").slice(0, 10),
          laeuftAb: (vorhanden.laeuftAb ?? "").slice(0, 10),
        }
      : LEERES_DOKUMENT,
  );
  const [datei, setDatei] = useState<File | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const dateifeld = useRef<HTMLInputElement>(null);

  /** Die Vorwarnzeit folgt der Art, solange niemand sie von Hand gesetzt hat. */
  function artWaehlen(art: Dokumentart) {
    setWerte((v) => ({ ...v, art, erinnerungTage: VORWARNUNG[art] }));
  }

  async function absenden(e: FormEvent) {
    e.preventDefault();
    if (!werte.titel.trim()) {
      setFehler("Ein Titel ist Pflicht.");
      return;
    }
    setLaeuft(true);
    try {
      const eingabe = { ...werte, mitarbeiter: mitarbeiter.id };
      if (vorhanden) await dokumentAendern(vorhanden.id, eingabe, datei);
      else await dokumentAnlegen(eingabe, datei);
      beiGespeichert();
    } catch (e: unknown) {
      setFehler(fehlersatz(e));
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <form className="wb-maske" onSubmit={absenden}>
      <label className="wb-feld">
        <span>Art</span>
        <select value={werte.art} onChange={(e) => artWaehlen(e.target.value as Dokumentart)}>
          {DOKUMENTARTEN.map((a) => (
            <option key={a} value={a}>
              {DOKUMENTART_TEXT[a]}
            </option>
          ))}
        </select>
      </label>

      <label className="wb-feld wb-feld--breit">
        <span>Titel *</span>
        <input
          type="text"
          value={werte.titel}
          onChange={(e) => setWerte({ ...werte, titel: e.target.value })}
          placeholder="Unterweisung Elektrofachkraft"
          required
        />
      </label>

      <label className="wb-feld wb-feld--schmal">
        <span>Ausgestellt am</span>
        <input
          type="date"
          value={werte.ausgestelltAm ?? ""}
          onChange={(e) => setWerte({ ...werte, ausgestelltAm: e.target.value })}
        />
      </label>

      <label className="wb-feld wb-feld--schmal">
        <span>Läuft ab</span>
        <input
          type="date"
          value={werte.laeuftAb ?? ""}
          onChange={(e) => setWerte({ ...werte, laeuftAb: e.target.value })}
        />
        <small className="wb-notiz">Ohne Ablaufdatum wird nichts überwacht.</small>
      </label>

      <label className="wb-feld wb-feld--schmal">
        <span>Vorwarnung (Tage)</span>
        <input
          type="number"
          min={0}
          value={werte.erinnerungTage ?? 0}
          onChange={(e) => setWerte({ ...werte, erinnerungTage: Number(e.target.value) })}
        />
      </label>

      <label className="wb-feld wb-feld--breit">
        <span>Datei</span>
        <input
          ref={dateifeld}
          type="file"
          onChange={(e) => setDatei(e.target.files?.[0] ?? null)}
        />
        {vorhanden?.datei && !datei && (
          <small className="wb-notiz">
            Hinterlegt: {vorhanden.datei}. Eine neue Datei ersetzt sie.
          </small>
        )}
      </label>

      <label className="wb-feld wb-feld--breit">
        <span>Notiz</span>
        <input
          type="text"
          value={werte.notiz ?? ""}
          onChange={(e) => setWerte({ ...werte, notiz: e.target.value })}
        />
      </label>

      <label className="wb-schalter wb-feld--breit">
        <input
          type="checkbox"
          checked={werte.erledigt ?? false}
          onChange={(e) => setWerte({ ...werte, erledigt: e.target.checked })}
        />
        <span>
          Erledigt
          <small>Fällt aus der Fristenüberwachung, bleibt aber in der Akte.</small>
        </span>
      </label>

      {fehler && (
        <p className="wb-fehler wb-feld--breit" role="alert">
          {fehler}
        </p>
      )}

      <div className="wb-aktionen wb-feld--breit">
        <button className="wb-button" type="submit" disabled={laeuft}>
          {vorhanden ? "Speichern" : "Ablegen"}
        </button>
        <button className="wb-button wb-button--sekundaer" type="button" onClick={beiAbbruch}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}

function datum(t?: string): string {
  if (!t) return "—";
  return new Date(`${t.slice(0, 10)}T00:00:00`).toLocaleDateString("de-AT");
}

function restText(laeuftAb: string): string {
  const tage = tageBis(heute(), laeuftAb);
  if (tage < 0) return `seit ${Math.abs(tage)} Tagen`;
  if (tage === 0) return "heute";
  return `in ${tage} Tagen`;
}
