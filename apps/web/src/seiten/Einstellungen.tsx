import { useEffect, useState, type FormEvent } from "react";
import {
  aktuellerRechtsraum,
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
  LEERER_BETRIEB,
  type Betrieb,
  type BetriebEingabe,
} from "@werkboq/core";
import { Bausteinverwaltung } from "../komponenten/Bausteinverwaltung";

/**
 * Stammdaten des Betriebs und freigeschaltete Bausteine.
 *
 * Die Mitarbeiter standen hier einmal und sind in den Baustein Personalwesen
 * gewandert. Einstellungen sind das, was man einmal einrichtet; Personal ist
 * das, womit man arbeitet — wer einen Urlaub genehmigt, tut nichts, was in
 * ein Einstellungsmenü gehört.
 */
export function Einstellungen() {
  const [reiter, setReiter] = useState<"betrieb" | "bausteine">("betrieb");

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
          aria-selected={reiter === "bausteine"}
          className={`wb-reiter__knopf${reiter === "bausteine" ? " ist-aktiv" : ""}`}
          onClick={() => setReiter("bausteine")}
        >
          Bausteine
        </button>
      </nav>

      {reiter === "betrieb" && <Betriebsdaten />}
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
