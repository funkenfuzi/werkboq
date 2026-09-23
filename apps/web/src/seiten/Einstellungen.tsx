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
  alsEingabe,
  ausGeld,
  FAHRTKOSTENARTEN,
  FAHRTKOSTENART_TEXT,
  fehlendeRechnungsangaben,
  nachfassRhythmus,
  NACHFASS_RHYTHMUS_VORGABE,
  schreibweiseVon,
  type Fahrtkostenart,
  LEERER_BETRIEB,
  type Betrieb,
  type BetriebEingabe,
} from "@werkboq/core";
import { Bausteinverwaltung } from "../komponenten/Bausteinverwaltung";
import { Phaseneinstellung } from "../komponenten/Phaseneinstellung";

/**
 * Stammdaten des Betriebs und freigeschaltete Bausteine.
 *
 * Die Mitarbeiter standen hier einmal und sind in den Baustein Personalwesen
 * gewandert. Einstellungen sind das, was man einmal einrichtet; Personal ist
 * das, womit man arbeitet — wer einen Urlaub genehmigt, tut nichts, was in
 * ein Einstellungsmenü gehört.
 */
export function Einstellungen() {
  const [reiter, setReiter] = useState<"betrieb" | "phasen" | "bausteine">("betrieb");

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
          aria-selected={reiter === "phasen"}
          className={`wb-reiter__knopf${reiter === "phasen" ? " ist-aktiv" : ""}`}
          onClick={() => setReiter("phasen")}
        >
          Phasen
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
      {reiter === "phasen" && <Phaseneinstellung />}
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

        <h2 className="wb-feld--breit wb-maske__abschnitt">Verrechnung</h2>

        <Geldfeld
          titel={`Stundensatz netto (${raum.waehrungszeichen}/h)`}
          cent={werte.stundensatz ?? 0}
          land={werte.rechtsraum}
          beiAenderung={(c) => feld("stundensatz", c)}
          hinweis="Kommt mit den verrechenbaren Stunden auf die Rechnung."
        />

        <label className="wb-feld">
          <span>Fahrtkosten</span>
          <select
            value={werte.fahrtkostenArt ?? "keine"}
            onChange={(e) => feld("fahrtkostenArt", e.target.value as Fahrtkostenart)}
          >
            {FAHRTKOSTENARTEN.map((a) => (
              <option key={a} value={a}>
                {FAHRTKOSTENART_TEXT[a]}
              </option>
            ))}
          </select>
          <small className="wb-notiz">
            {werte.fahrtkostenArt === "km"
              ? "Die Kilometer aller Fahrten am Auftrag kommen als eine Zeile auf die Rechnung."
              : werte.fahrtkostenArt === "pauschale"
                ? "Je erfasster Fahrt eine Anfahrtspauschale."
                : "Fahrten werden aufgezeichnet, aber nicht verrechnet — etwa wenn sie im Stundensatz stecken."}
          </small>
        </label>

        {werte.fahrtkostenArt === "km" && (
          <Geldfeld
            titel={`Satz je Kilometer (${raum.waehrungszeichen})`}
            cent={werte.kmSatz ?? 0}
            land={werte.rechtsraum}
            beiAenderung={(c) => feld("kmSatz", c)}
          />
        )}
        {werte.fahrtkostenArt === "pauschale" && (
          <Geldfeld
            titel={`Anfahrtspauschale (${raum.waehrungszeichen})`}
            cent={werte.anfahrtPauschale ?? 0}
            land={werte.rechtsraum}
            beiAenderung={(c) => feld("anfahrtPauschale", c)}
          />
        )}

        <Rhythmusfeld
          wert={werte.nachfassTage ?? null}
          beiAenderung={(r) => feld("nachfassTage", r)}
        />

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

/**
 * Ein Betrag in einem Textfeld. Getippt wird, wie man es schreibt
 * („85", „0,42", „1.250,00"); gespeichert werden Cent. Solange die Eingabe
 * keine Zahl ergibt, bleibt der letzte gültige Betrag stehen und das Feld
 * sagt es.
 */
function Geldfeld({
  titel,
  cent,
  land,
  beiAenderung,
  hinweis,
}: {
  titel: string;
  cent: number;
  land?: string;
  beiAenderung: (cent: number) => void;
  hinweis?: string;
}) {
  const sw = schreibweiseVon(land);
  const [text, setText] = useState(() => (cent ? alsEingabe(cent, sw) : ""));
  const wert = ausGeld(text);
  const ungueltig = !Number.isFinite(wert) || wert < 0;

  return (
    <label className="wb-feld">
      <span>{titel}</span>
      <input
        type="text"
        inputMode="decimal"
        value={text}
        placeholder="0"
        aria-invalid={ungueltig || undefined}
        onChange={(e) => {
          setText(e.target.value);
          const c = ausGeld(e.target.value);
          if (Number.isFinite(c) && c >= 0) beiAenderung(c);
        }}
      />
      {ungueltig ? (
        <small className="wb-fehler">Das ist kein Betrag.</small>
      ) : (
        hinweis && <small className="wb-notiz">{hinweis}</small>
      )}
    </label>
  );
}

/**
 * Nachfassrhythmus für Angebote: „7, 14, 30". Gespeichert wird die Liste;
 * darunter steht in Worten, was sie bedeutet, damit niemand raten muss,
 * ob 14 „ab Versand" oder „ab dem letzten Anruf" heißt.
 */
function Rhythmusfeld({
  wert,
  beiAenderung,
}: {
  wert: number[] | null;
  beiAenderung: (r: number[] | null) => void;
}) {
  const [text, setText] = useState(() => (wert?.length ? wert.join(", ") : ""));
  const r = nachfassRhythmus(text);
  const vorgabe = !text.trim();
  const erklaert =
    `Erstes Nachfassen ${r[0]} Tage nach dem Versand` +
    r.slice(1).map((t, i) => `, ${i === 0 ? "dann" : "danach"} ${t} Tage nach dem letzten Kontakt`).join("") +
    ". Danach gilt ein Angebot als kalt.";
  return (
    <label className="wb-feld wb-feld--breit">
      <span>Angebote nachfassen nach (Tage)</span>
      <input
        type="text"
        inputMode="numeric"
        value={text}
        placeholder={NACHFASS_RHYTHMUS_VORGABE.join(", ")}
        onChange={(e) => {
          setText(e.target.value);
          beiAenderung(e.target.value.trim() ? nachfassRhythmus(e.target.value) : null);
        }}
      />
      <small className="wb-notiz">
        {vorgabe ? "Voreinstellung. " : ""}
        {erklaert}
      </small>
    </label>
  );
}
