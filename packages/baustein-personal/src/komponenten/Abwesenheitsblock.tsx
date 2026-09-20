import { useCallback, useEffect, useState, type FormEvent } from "react";
import { fehlersatz, Symbol, type Mitarbeiter } from "@werkboq/core";
import {
  ABWESENHEITSARTEN,
  abwesenheitAendern,
  abwesenheitAnlegen,
  abwesenheitenZuMitarbeiter,
  ART_TEXT,
  entscheiden,
  heute,
  LEERE_ABWESENHEIT,
  resturlaub,
  STATUS_FARBE,
  STATUS_TEXT,
  stornieren,
  ueberschneidet,
  werktage,
  type Abwesenheit,
  type Abwesenheitsart,
} from "../daten/abwesenheiten";
import { personaldatenLaden, type Personaldaten } from "../daten/personaldaten";

/**
 * Urlaub, Zeitausgleich, Krankenstand eines Mitarbeiters.
 *
 * Oben der Resturlaub, darunter die Liste. Der Resturlaub ist die eine Zahl,
 * die im Gespräch mit dem Mitarbeiter gebraucht wird — und die auf Papier am
 * häufigsten falsch gerechnet wird, weil halbe Tage und der Übertrag aus dem
 * Vorjahr untergehen.
 */
export function Abwesenheitsblock({
  mitarbeiter,
  darfAendern,
}: {
  mitarbeiter: Mitarbeiter;
  darfAendern: boolean;
}) {
  const [jahr, setJahr] = useState(new Date().getFullYear());
  const [liste, setListe] = useState<Abwesenheit[]>([]);
  const [daten, setDaten] = useState<Personaldaten | null>(null);
  const [maske, setMaske] = useState<Abwesenheit | "neu" | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(() => {
    setLaedt(true);
    Promise.all([
      abwesenheitenZuMitarbeiter(mitarbeiter.id, jahr),
      personaldatenLaden(mitarbeiter.id).catch(() => null),
    ])
      .then(([a, d]) => {
        setListe(a);
        setDaten(d);
      })
      .catch((e: unknown) => setFehler(fehlersatz(e)))
      .finally(() => setLaedt(false));
  }, [mitarbeiter.id, jahr]);

  useEffect(laden, [laden]);

  const konto = resturlaub(
    daten?.urlaubsanspruch ?? 0,
    daten?.urlaubUebertrag ?? 0,
    liste,
    jahr,
  );

  async function tu(was: () => Promise<void>) {
    try {
      await was();
      setFehler(null);
      laden();
    } catch (e: unknown) {
      setFehler(fehlersatz(e));
    }
  }

  return (
    <>
      <section className="wb-block">
        <div className="wb-block__kopf">
          <h2>Urlaubskonto {jahr}</h2>
          <label className="wb-feld wb-feld--schmal wb-feld--inline">
            <span className="wb-verborgen">Jahr</span>
            <select value={jahr} onChange={(e) => setJahr(Number(e.target.value))}>
              {jahre().map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
          </label>
          {darfAendern && !maske && (
            <button className="wb-button" type="button" onClick={() => setMaske("neu")}>
              <Symbol name="plus" groesse={18} />
              Eintragen
            </button>
          )}
        </div>

        {!daten && (
          <p className="wb-leer wb-notiz">
            Ohne Personalakte ist kein Anspruch hinterlegt — der Resturlaub bleibt deshalb bei
            null. Unter „Personalakte“ eintragen.
          </p>
        )}

        <dl className="wb-aufstellung">
          <div>
            <dt>Anspruch inkl. Übertrag</dt>
            <dd>{tage(konto.anspruch)}</dd>
          </div>
          <div>
            <dt>Genehmigt</dt>
            <dd>{tage(konto.verbraucht)}</dd>
          </div>
          <div>
            <dt>Beantragt</dt>
            <dd>{tage(konto.beantragt)}</dd>
          </div>
          <div className="wb-aufstellung__gesamt">
            <dt>Rest</dt>
            <dd className={konto.rest < 0 ? "wb-verzug" : undefined}>{tage(konto.rest)}</dd>
          </div>
        </dl>

        {konto.rest < 0 && (
          <p className="wb-hinweis">
            Mehr Urlaub geplant als offen. Das kann stimmen — etwa bei Vorgriff auf das nächste
            Jahr —, ist aber selten Absicht.
          </p>
        )}
      </section>

      {fehler && (
        <p className="wb-fehler" role="alert">
          {fehler}
        </p>
      )}

      {maske && (
        <Abwesenheitsmaske
          key={maske === "neu" ? "neu" : maske.id}
          mitarbeiter={mitarbeiter}
          vorhanden={maske === "neu" ? null : maske}
          andere={liste.filter((a) => (maske === "neu" ? true : a.id !== maske.id))}
          beiGespeichert={() => {
            setMaske(null);
            laden();
          }}
          beiAbbruch={() => setMaske(null)}
        />
      )}

      <section className="wb-block">
        <h2>Einträge {jahr}</h2>

        {laedt && liste.length === 0 && <p className="wb-leer">Wird geladen …</p>}
        {!laedt && liste.length === 0 && (
          <p className="wb-leer">Für {jahr} ist nichts eingetragen.</p>
        )}

        {liste.length > 0 && (
          <div className="wb-tabelle-rahmen">
            <table className="wb-tabelle">
              <thead>
                <tr>
                  <th scope="col">Art</th>
                  <th scope="col">Von</th>
                  <th scope="col">Bis</th>
                  <th scope="col" className="wb-zelle--rechts">Tage</th>
                  <th scope="col">Status</th>
                  <th scope="col" aria-label="Aktionen" />
                </tr>
              </thead>
              <tbody>
                {liste.map((a) => (
                  <tr key={a.id} className={a.status === "storniert" ? "ist-stillgelegt" : ""}>
                    <td>{ART_TEXT[a.art]}</td>
                    <td className="wb-tabelle__kennung">
                      {datum(a.von)}
                      {a.halberTagBeginn && <small className="wb-unterzeile">halber Tag</small>}
                    </td>
                    <td className="wb-tabelle__kennung">
                      {datum(a.bis)}
                      {a.halberTagEnde && <small className="wb-unterzeile">halber Tag</small>}
                    </td>
                    <td className="wb-zelle--rechts wb-tabelle__kennung">{tage(a.tage ?? 0)}</td>
                    <td>
                      <span className={`wb-plakette wb-plakette--${STATUS_FARBE[a.status]}`}>
                        {STATUS_TEXT[a.status]}
                      </span>
                    </td>
                    <td className="wb-zelle--rechts">
                      {darfAendern && a.status === "beantragt" && (
                        <>
                          <button
                            type="button"
                            className="wb-zeilenknopf wb-zeilenknopf--neutral"
                            title="Genehmigen"
                            onClick={() => void tu(() => entscheiden(a, "genehmigt"))}
                          >
                            <Symbol name="haken" groesse={16} />
                          </button>
                          <button
                            type="button"
                            className="wb-zeilenknopf"
                            title="Ablehnen"
                            onClick={() => void tu(() => entscheiden(a, "abgelehnt"))}
                          >
                            <Symbol name="kreuz" groesse={16} />
                          </button>
                        </>
                      )}
                      {darfAendern && a.status !== "storniert" && (
                        <>
                          <button
                            type="button"
                            className="wb-zeilenknopf wb-zeilenknopf--neutral"
                            title="Bearbeiten"
                            onClick={() => setMaske(a)}
                          >
                            <Symbol name="stift" groesse={16} />
                          </button>
                          <button
                            type="button"
                            className="wb-zeilenknopf"
                            title="Stornieren"
                            onClick={() => {
                              if (!confirm(`${ART_TEXT[a.art]} stornieren?`)) return;
                              void tu(() => stornieren(a));
                            }}
                          >
                            <Symbol name="muell" groesse={16} />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

function Abwesenheitsmaske({
  mitarbeiter,
  vorhanden,
  andere,
  beiGespeichert,
  beiAbbruch,
}: {
  mitarbeiter: Mitarbeiter;
  vorhanden: Abwesenheit | null;
  andere: Abwesenheit[];
  beiGespeichert: () => void;
  beiAbbruch: () => void;
}) {
  const [werte, setWerte] = useState(
    vorhanden
      ? { ...LEERE_ABWESENHEIT, ...vorhanden, von: vorhanden.von.slice(0, 10), bis: vorhanden.bis.slice(0, 10) }
      : LEERE_ABWESENHEIT,
  );
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  const gerechnet = werktage(werte.von, werte.bis, werte.halberTagBeginn, werte.halberTagEnde);
  const kollision = andere.filter(
    (a) => a.status !== "storniert" && a.status !== "abgelehnt" && ueberschneidet(a, werte),
  );

  async function absenden(e: FormEvent) {
    e.preventDefault();
    if (werte.bis < werte.von) {
      setFehler("Das Ende liegt vor dem Beginn.");
      return;
    }
    setLaeuft(true);
    try {
      const eingabe = { ...werte, mitarbeiter: mitarbeiter.id };
      if (vorhanden) await abwesenheitAendern(vorhanden.id, eingabe);
      else await abwesenheitAnlegen(eingabe);
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
        <select
          value={werte.art}
          onChange={(e) => setWerte({ ...werte, art: e.target.value as Abwesenheitsart })}
        >
          {ABWESENHEITSARTEN.map((a) => (
            <option key={a} value={a}>
              {ART_TEXT[a]}
            </option>
          ))}
        </select>
        {werte.art !== "urlaub" && (
          <small className="wb-notiz">Nur Urlaub zählt gegen den Urlaubsanspruch.</small>
        )}
      </label>

      <label className="wb-feld wb-feld--schmal">
        <span>Von</span>
        <input
          type="date"
          value={werte.von}
          onChange={(e) => setWerte({ ...werte, von: e.target.value })}
          required
        />
      </label>

      <label className="wb-feld wb-feld--schmal">
        <span>Bis</span>
        <input
          type="date"
          value={werte.bis}
          onChange={(e) => setWerte({ ...werte, bis: e.target.value })}
          required
        />
      </label>

      <label className="wb-schalter wb-schalter--eng">
        <input
          type="checkbox"
          checked={werte.halberTagBeginn ?? false}
          onChange={(e) => setWerte({ ...werte, halberTagBeginn: e.target.checked })}
        />
        <span>Erster Tag nur halb</span>
      </label>

      <label className="wb-schalter wb-schalter--eng">
        <input
          type="checkbox"
          checked={werte.halberTagEnde ?? false}
          onChange={(e) => setWerte({ ...werte, halberTagEnde: e.target.checked })}
        />
        <span>Letzter Tag nur halb</span>
      </label>

      <div className="wb-feld wb-feld--breit">
        <span>Werktage</span>
        <output className="wb-dauer">{tage(gerechnet)}</output>
        <small className="wb-notiz">
          Samstag und Sonntag sind abgezogen, Feiertage nicht — die kennt Werkboq nicht, weil sie
          sich je Bundesland unterscheiden. Bei Bedarf hinterher von Hand korrigieren.
        </small>
      </div>

      {kollision.length > 0 && (
        <p className="wb-hinweis wb-feld--breit">
          Überschneidet sich mit: {kollision.map((k) => `${ART_TEXT[k.art]} ${datum(k.von)}`).join(", ")}.
        </p>
      )}

      <label className="wb-feld wb-feld--breit">
        <span>Grund oder Notiz</span>
        <input
          type="text"
          value={werte.grund ?? ""}
          onChange={(e) => setWerte({ ...werte, grund: e.target.value })}
        />
      </label>

      {fehler && (
        <p className="wb-fehler wb-feld--breit" role="alert">
          {fehler}
        </p>
      )}

      <div className="wb-aktionen wb-feld--breit">
        <button className="wb-button" type="submit" disabled={laeuft}>
          {vorhanden ? "Speichern" : "Eintragen"}
        </button>
        <button className="wb-button wb-button--sekundaer" type="button" onClick={beiAbbruch}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}

function jahre(): number[] {
  const jetzt = new Date(`${heute()}T00:00:00`).getFullYear();
  return [jetzt + 1, jetzt, jetzt - 1, jetzt - 2];
}

function tage(n: number): string {
  return `${String(Math.round(n * 100) / 100).replace(".", ",")} ${n === 1 ? "Tag" : "Tage"}`;
}

function datum(t: string): string {
  return new Date(`${t.slice(0, 10)}T00:00:00`).toLocaleDateString("de-AT");
}
