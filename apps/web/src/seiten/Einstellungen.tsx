import { useEffect, useState, type FormEvent } from "react";
import {
  aktuellerRechtsraum,
  alleMitarbeiter,
  dienst,
  LAENDER,
  RECHTSRAEUME,
  rechtsraum,
  rechtsraumSetzen,
  satzText,
  Symbol,
  betriebLaden,
  betriebSpeichern,
  darf,
  fehlendeRechnungsangaben,
  FUNKTION_TEXT,
  FUNKTIONEN,
  kurz,
  LEERER_BETRIEB,
  LEERER_MITARBEITER,
  mitarbeiterAendern,
  mitarbeiterAnlegen,
  mitarbeiterStilllegen,
  type Betrieb,
  type BetriebEingabe,
  type Funktion,
  type Mitarbeiter,
  type MitarbeiterEingabe,
} from "@werkboq/core";
import { Zugangsblock } from "../komponenten/Zugangsblock";
import { Bausteinverwaltung } from "../komponenten/Bausteinverwaltung";

/** Stammdaten des Betriebs und der Mitarbeiter. */
export function Einstellungen() {
  const [reiter, setReiter] = useState<"betrieb" | "mitarbeiter" | "bausteine">("betrieb");

  if (!darf("verwaltung")) {
    return (
      <div className="wb-nichts">
        <p>Für die Einstellungen fehlt dir der Bereich „verwaltung".</p>
        <p className="wb-leer">
          Wer Stammdaten ändern darf, entscheidet die Benutzerverwaltung — sprich mit dem
          Betriebsinhaber.
        </p>
      </div>
    );
  }

  return (
    <section>
      <div className="wb-kopf">
        <h1>Einstellungen</h1>
      </div>

      <nav className="wb-reiter" role="tablist">
        <button
          role="tab"
          aria-selected={reiter === "betrieb"}
          className={`wb-reiter__knopf${reiter === "betrieb" ? " ist-aktiv" : ""}`}
          onClick={() => setReiter("betrieb")}
        >
          Betrieb
        </button>
        <button
          role="tab"
          aria-selected={reiter === "mitarbeiter"}
          className={`wb-reiter__knopf${reiter === "mitarbeiter" ? " ist-aktiv" : ""}`}
          onClick={() => setReiter("mitarbeiter")}
        >
          Mitarbeiter
        </button>
        <button
          role="tab"
          aria-selected={reiter === "bausteine"}
          className={`wb-reiter__knopf${reiter === "bausteine" ? " ist-aktiv" : ""}`}
          onClick={() => setReiter("bausteine")}
        >
          Bausteine
        </button>
      </nav>

      {reiter === "betrieb" && <Betriebsdaten />}
      {reiter === "mitarbeiter" && <Mitarbeiterverwaltung />}
      {reiter === "bausteine" && <Bausteinverwaltung />}
    </section>
  );
}

function Betriebsdaten() {
  const [datensatz, setDatensatz] = useState<Betrieb | null>(null);
  const [werte, setWerte] = useState<BetriebEingabe>(LEERER_BETRIEB);
  const [laedt, setLaedt] = useState(true);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [sperre, setSperre] = useState<{ gesperrt: boolean; grund: string }>({
    gesperrt: false,
    grund: "",
  });

  useEffect(() => {
    betriebLaden()
      .then((b) => {
        setDatensatz(b);
        if (b) setWerte({ ...LEERER_BETRIEB, ...b });
      })
      .catch((e: unknown) => setFehler(e instanceof Error ? e.message : String(e)))
      .finally(() => setLaedt(false));

    // Fragt die Bausteine, ob schon etwas am Recht dieses Landes hängt.
    // Antwortet niemand, ist noch nichts entstanden und das Land frei.
    const frage = dienst("rechtsraumSperre");
    if (frage) frage().then(setSperre).catch(() => undefined);
  }, []);

  function feld<K extends keyof BetriebEingabe>(name: K, wert: BetriebEingabe[K]) {
    setWerte((v) => ({ ...v, [name]: wert }));
  }

  async function speichern(e: FormEvent) {
    e.preventDefault();
    if (!datensatz) return;
    try {
      await betriebSpeichern(datensatz.id, werte);
      setDatensatz({ ...datensatz, ...werte });
      // Damit die Masken sofort mit den richtigen Sätzen arbeiten und nicht
      // erst nach einem Neuladen.
      if (werte.rechtsraum) rechtsraumSetzen(werte.rechtsraum);
      setHinweis("Gespeichert.");
      setFehler(null);
    } catch (e: unknown) {
      setFehler(e instanceof Error ? e.message : String(e));
    }
  }

  if (laedt) return <p className="wb-leer">Wird geladen …</p>;
  if (!datensatz) {
    return (
      <div className="wb-nichts">
        <p>Es gibt noch keinen Betriebsdatensatz.</p>
        <p className="wb-leer">
          Einmal <code>npm run einrichten</code> laufen lassen — das legt ihn an.
        </p>
      </div>
    );
  }

  const fehlend = fehlendeRechnungsangaben({ ...datensatz, ...werte } as Betrieb);
  const raum = rechtsraum(werte.rechtsraum ?? aktuellerRechtsraum().id);

  return (
    <>
      {fehlend.length > 0 && (
        <p className="wb-warnkasten">
          <Symbol name="warnung" groesse={18} />
          <span>
            Für Rechnungen fehlt noch: {fehlend.join(", ")}. Nach {raum.rechnungParagraf} müssen
            Name, Anschrift und {raum.uidName} auf jeder Rechnung stehen.
          </span>
        </p>
      )}

      <form className="wb-maske" onSubmit={speichern}>
        <label className="wb-feld wb-feld--breit">
          <span>Rechtsraum *</span>
          <select
            value={werte.rechtsraum ?? "at"}
            disabled={sperre.gesperrt}
            onChange={(e) => feld("rechtsraum", e.target.value)}
          >
            {LAENDER.map((l) => (
              <option key={l} value={l}>
                {RECHTSRAEUME[l].name}
              </option>
            ))}
          </select>
          <small className="wb-notiz">
            {sperre.gesperrt ? (
              <>
                Festgeschrieben. {sperre.grund} Für einen anderen Rechtsraum braucht es einen
                eigenen Mandanten.
              </>
            ) : (
              <>
                Bestimmt Währung, Steuersätze, Pflichtangaben auf der Rechnung, Verzugszinsen und
                die Normen im Prüfbericht. <strong>Lässt sich später nicht mehr ändern</strong> —
                sobald die erste Rechnung festgeschrieben ist, hängt sie an diesem Recht.
              </>
            )}
          </small>
        </label>

        <dl className="wb-daten wb-feld--breit">
          <div>
            <dt>Währung</dt>
            <dd>{raum.waehrungszeichen}</dd>
          </div>
          <div>
            <dt>{raum.steuerName}</dt>
            <dd>{raum.steuersaetze.map((x) => satzText(raum, x.satz)).join(" · ")}</dd>
          </div>
          <div>
            <dt>Rechnungspflichtangaben</dt>
            <dd>{raum.rechnungParagraf}</dd>
          </div>
          <div>
            <dt>Aufbewahrung</dt>
            <dd>{raum.aufbewahrung}</dd>
          </div>
          <div>
            <dt>Elektrotechnische Norm</dt>
            <dd>{raum.elektroNorm}</dd>
          </div>
          <div>
            <dt>Kasse</dt>
            <dd>{raum.kasse}</dd>
          </div>
        </dl>

        <label className="wb-feld wb-feld--breit">
          <span>Firmenname *</span>
          <input type="text" value={werte.name} onChange={(e) => feld("name", e.target.value)} required />
        </label>

        <label className="wb-feld wb-feld--breit">
          <span>Inhaber</span>
          <input type="text" value={werte.inhaber ?? ""} onChange={(e) => feld("inhaber", e.target.value)} />
        </label>

        <label className="wb-feld wb-feld--breit">
          <span>Straße</span>
          <input type="text" value={werte.strasse ?? ""} onChange={(e) => feld("strasse", e.target.value)} />
        </label>

        <label className="wb-feld wb-feld--schmal">
          <span>PLZ</span>
          <input type="text" value={werte.plz ?? ""} onChange={(e) => feld("plz", e.target.value)} />
        </label>

        <label className="wb-feld">
          <span>Ort</span>
          <input type="text" value={werte.ort ?? ""} onChange={(e) => feld("ort", e.target.value)} />
        </label>

        <label className="wb-feld">
          <span>Land</span>
          <input type="text" value={werte.land ?? ""} onChange={(e) => feld("land", e.target.value)} />
        </label>

        <label className="wb-feld">
          <span>Telefon</span>
          <input type="tel" value={werte.telefon ?? ""} onChange={(e) => feld("telefon", e.target.value)} />
        </label>

        <label className="wb-feld">
          <span>E-Mail</span>
          <input type="email" value={werte.email ?? ""} onChange={(e) => feld("email", e.target.value)} />
        </label>

        <label className="wb-feld">
          <span>Webseite</span>
          <input type="url" placeholder="https://" value={werte.web ?? ""} onChange={(e) => feld("web", e.target.value)} />
        </label>

        <label className="wb-feld">
          <span>{raum.uidName}</span>
          <input
            type="text"
            placeholder={raum.uidPlatzhalter}
            value={werte.uid ?? ""}
            onChange={(e) => feld("uid", e.target.value)}
          />
        </label>

        <label className="wb-feld">
          <span>{raum.registerName}nummer</span>
          <input type="text" value={werte.firmenbuch ?? ""} onChange={(e) => feld("firmenbuch", e.target.value)} />
        </label>

        <label className="wb-feld">
          <span>{raum.registerName}gericht</span>
          <input type="text" value={werte.gericht ?? ""} onChange={(e) => feld("gericht", e.target.value)} />
        </label>

        <label className="wb-feld wb-feld--breit">
          <span>IBAN</span>
          <input type="text" value={werte.iban ?? ""} onChange={(e) => feld("iban", e.target.value)} />
        </label>

        <label className="wb-feld">
          <span>BIC</span>
          <input type="text" value={werte.bic ?? ""} onChange={(e) => feld("bic", e.target.value)} />
        </label>

        <label className="wb-feld">
          <span>Bank</span>
          <input type="text" value={werte.bank ?? ""} onChange={(e) => feld("bank", e.target.value)} />
        </label>

        {fehler && <p className="wb-fehler wb-feld--breit" role="alert">{fehler}</p>}
        {hinweis && <p className="wb-hinweis wb-feld--breit" role="status">{hinweis}</p>}

        <div className="wb-aktionen wb-feld--breit">
          <button className="wb-button" type="submit">
            Speichern
          </button>
        </div>
      </form>
    </>
  );
}

function Mitarbeiterverwaltung() {
  const [liste, setListe] = useState<Mitarbeiter[]>([]);
  const [bearbeitet, setBearbeitet] = useState<Mitarbeiter | "neu" | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  function laden() {
    setLaedt(true);
    alleMitarbeiter()
      .then(setListe)
      .catch((e: unknown) => setFehler(e instanceof Error ? e.message : String(e)))
      .finally(() => setLaedt(false));
  }

  useEffect(laden, []);

  async function stilllegen(m: Mitarbeiter) {
    if (!confirm(`${m.name} stilllegen? Zeiten und Termine bleiben erhalten.`)) return;
    await mitarbeiterStilllegen(m);
    laden();
  }

  return (
    <>
      <div className="wb-werkzeugleiste">
        <p className="wb-leer wb-legende">
          Mitarbeiter werden nicht gelöscht, sondern stillgelegt — an ihnen hängen Zeiten und
          Termine, die als Nachweis erhalten bleiben.
        </p>
        {!bearbeitet && (
          <button className="wb-button" type="button" onClick={() => setBearbeitet("neu")}>
            <Symbol name="plus" groesse={18} />
            Neuer Mitarbeiter
          </button>
        )}
      </div>

      {fehler && <p className="wb-fehler" role="alert">{fehler}</p>}

      {bearbeitet && (
        <Mitarbeitermaske
          key={bearbeitet === "neu" ? "neu" : bearbeitet.id}
          vorhanden={bearbeitet === "neu" ? null : bearbeitet}
          beiGespeichert={() => {
            setBearbeitet(null);
            laden();
          }}
          beiAbbruch={() => setBearbeitet(null)}
          beiZugangsaenderung={laden}
        />
      )}

      {laedt && liste.length === 0 && <p className="wb-leer">Wird geladen …</p>}

      {liste.length > 0 && (
        <div className="wb-tabelle-rahmen">
          <table className="wb-tabelle">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Funktion</th>
                <th scope="col">Telefon</th>
                <th scope="col">Zugang</th>
                <th scope="col">Status</th>
                <th scope="col" aria-label="Aktionen" />
              </tr>
            </thead>
            <tbody>
              {liste.map((m) => (
                <tr key={m.id} className={m.aktiv === false ? "ist-stillgelegt" : ""}>
                  <td>
                    <span className="wb-zellname">
                      <span
                        className="wb-initialen wb-initialen--klein"
                        style={{ background: m.farbe || undefined }}
                        aria-hidden="true"
                      >
                        {kurz(m)}
                      </span>
                      {m.name}
                    </span>
                  </td>
                  <td>{FUNKTION_TEXT[m.funktion]}</td>
                  <td>{m.telefon || "—"}</td>
                  <td>{m.benutzer ? "ja" : "—"}</td>
                  <td>
                    {m.aktiv === false ? (
                      <span className="wb-plakette">stillgelegt</span>
                    ) : (
                      <span className="wb-plakette wb-plakette--ok">aktiv</span>
                    )}
                  </td>
                  <td className="wb-zelle--rechts">
                    <button
                      type="button"
                      className="wb-zeilenknopf wb-zeilenknopf--neutral"
                      onClick={() => setBearbeitet(m)}
                      title={`${m.name} bearbeiten`}
                    >
                      <Symbol name="stift" groesse={16} />
                    </button>
                    {m.aktiv !== false && (
                      <button
                        type="button"
                        className="wb-zeilenknopf"
                        onClick={() => void stilllegen(m)}
                        title={`${m.name} stilllegen`}
                      >
                        <Symbol name="muell" groesse={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Mitarbeitermaske({
  vorhanden,
  beiGespeichert,
  beiAbbruch,
  beiZugangsaenderung,
}: {
  vorhanden: Mitarbeiter | null;
  beiGespeichert: () => void;
  beiAbbruch: () => void;
  beiZugangsaenderung?: () => void;
}) {
  const [werte, setWerte] = useState<MitarbeiterEingabe>(
    vorhanden ? { ...LEERER_MITARBEITER, ...vorhanden } : LEERER_MITARBEITER,
  );
  const [fehler, setFehler] = useState<string | null>(null);

  async function absenden(e: FormEvent) {
    e.preventDefault();
    if (!werte.name.trim()) {
      setFehler("Ein Name ist Pflicht.");
      return;
    }
    try {
      if (vorhanden) await mitarbeiterAendern(vorhanden.id, werte);
      else await mitarbeiterAnlegen(werte);
      beiGespeichert();
    } catch (e: unknown) {
      setFehler(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <>
    <form className="wb-maske" onSubmit={absenden}>
      <label className="wb-feld wb-feld--breit">
        <span>Name *</span>
        <input
          type="text"
          value={werte.name}
          onChange={(e) => setWerte({ ...werte, name: e.target.value })}
          required
          autoFocus
        />
      </label>

      <label className="wb-feld wb-feld--schmal">
        <span>Kurzzeichen</span>
        <input
          type="text"
          maxLength={4}
          placeholder="wird berechnet"
          value={werte.kurzzeichen ?? ""}
          onChange={(e) => setWerte({ ...werte, kurzzeichen: e.target.value })}
        />
      </label>

      <label className="wb-feld">
        <span>Funktion</span>
        <select
          value={werte.funktion}
          onChange={(e) => setWerte({ ...werte, funktion: e.target.value as Funktion })}
        >
          {FUNKTIONEN.map((f) => (
            <option key={f} value={f}>
              {FUNKTION_TEXT[f]}
            </option>
          ))}
        </select>
      </label>

      <label className="wb-feld wb-feld--schmal">
        <span>Farbe im Plan</span>
        <input
          type="color"
          value={werte.farbe || "#0058a8"}
          onChange={(e) => setWerte({ ...werte, farbe: e.target.value })}
        />
      </label>

      <label className="wb-feld">
        <span>Telefon</span>
        <input
          type="tel"
          value={werte.telefon ?? ""}
          onChange={(e) => setWerte({ ...werte, telefon: e.target.value })}
        />
      </label>

      <label className="wb-feld">
        <span>E-Mail</span>
        <input
          type="email"
          value={werte.email ?? ""}
          onChange={(e) => setWerte({ ...werte, email: e.target.value })}
        />
      </label>

      <label className="wb-feld wb-feld--schmal">
        <span>Wochenstunden</span>
        <input
          type="number"
          min={0}
          step={0.5}
          value={werte.wochenstunden ?? 0}
          onChange={(e) => setWerte({ ...werte, wochenstunden: Number(e.target.value) })}
        />
      </label>

      <label className="wb-schalter wb-feld--breit">
        <input
          type="checkbox"
          checked={werte.aktiv !== false}
          onChange={(e) => setWerte({ ...werte, aktiv: e.target.checked })}
        />
        <span>
          Aktiv
          <small>Nur aktive Mitarbeiter erscheinen im Plan.</small>
        </span>
      </label>

      {fehler && <p className="wb-fehler wb-feld--breit" role="alert">{fehler}</p>}

      <div className="wb-aktionen wb-feld--breit">
        <button className="wb-button" type="submit">
          {vorhanden ? "Speichern" : "Anlegen"}
        </button>
        <button className="wb-button wb-button--sekundaer" type="button" onClick={beiAbbruch}>
          Abbrechen
        </button>
      </div>
    </form>

    {vorhanden ? (
      <Zugangsblock mitarbeiter={vorhanden} beiAenderung={beiZugangsaenderung} />
    ) : (
      <p className="wb-leer wb-zugang__spaeter">
        Einen Zugang vergibst du, nachdem der Mitarbeiter angelegt ist.
      </p>
    )}
    </>
  );
}
