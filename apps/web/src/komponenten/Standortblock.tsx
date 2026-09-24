import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  anschriftZeile,
  darfAuftraegeAendern,
  fehlersatz,
  NAECHSTE_ART,
  standortAusKunde,
  standortLoeschen,
  standortSpeichern,
  standortteileZuKunde,
  STANDORTTEIL_ARTEN,
  STANDORTTEIL_TEXT,
  Symbol,
  teilbaum,
  teilLoeschen,
  teilSpeichern,
  unterteile,
  type Kunde,
  type Standort,
  type StandortEingabe,
  type Standortteil,
  type Standortteilart,
  type Teilknoten,
} from "@werkboq/core";

/**
 * Reiter „Standorte" in der Kundenakte.
 *
 * Jeder Standort mit seinem Baum darunter: Gebäude, Geschoße, Räume,
 * Bereiche, Verteiler. Angelegt wird direkt an der Stelle, an die etwas
 * gehört — „+" neben dem Geschoß legt einen Raum darin an —, statt in
 * einem Formular erst den Eltern-Teil auszuwählen.
 */
export function Standortblock({
  kunde,
  standorte,
  beiAenderung,
}: {
  kunde: Kunde;
  standorte: Standort[];
  beiAenderung: () => void;
}) {
  const [teile, setTeile] = useState<Standortteil[]>([]);
  const [neuerStandort, setNeuerStandort] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const schreiben = darfAuftraegeAendern();

  const teileLaden = () => void standortteileZuKunde(kunde.id).then(setTeile).catch(() => setTeile([]));
  useEffect(teileLaden, [kunde.id, standorte.length]);

  const nachAenderung = () => {
    teileLaden();
    beiAenderung();
  };

  async function entfernen(s: Standort) {
    const anzahl = teile.filter((t) => t.standort === s.id).length;
    const zusatz = anzahl ? ` samt ${anzahl} Gebäude, Räume und Bereiche darunter` : "";
    if (!confirm(`Standort „${s.bezeichnung}“${zusatz} entfernen?`)) return;
    try {
      await standortLoeschen(s);
      setFehler(null);
      nachAenderung();
    } catch (e) {
      setFehler(fehlersatz(e));
    }
  }

  return (
    <div className="wb-abschnitt">
      {standorte.length === 0 && !neuerStandort && (
        <div className="wb-nichts">
          {kunde.nurWare ? (
            <p>Dieser Kunde kauft nur Ware — ein Standort ist nicht nötig.</p>
          ) : (
            <p>Noch kein Standort. Jeder Kunde, bei dem gearbeitet wird, braucht mindestens einen.</p>
          )}
        </div>
      )}

      {fehler && (
        <p className="wb-fehler" role="alert">
          {fehler}
        </p>
      )}

      {standorte.map((s) => (
        <StandortKarte
          key={s.id}
          kunde={kunde}
          standort={s}
          teile={teile.filter((t) => t.standort === s.id)}
          schreiben={schreiben}
          beiAenderung={nachAenderung}
          entfernen={() => void entfernen(s)}
        />
      ))}

      {neuerStandort ? (
        <Standortmaske
          vorher={null}
          start={{ ...standortAusKunde(kunde), bezeichnung: "", strasse: "", plz: "", ort: "" }}
          fertig={(gespeichert) => {
            setNeuerStandort(false);
            if (gespeichert) nachAenderung();
          }}
        />
      ) : (
        schreiben && (
          <button className="wb-button wb-button--sekundaer" type="button" onClick={() => setNeuerStandort(true)}>
            <Symbol name="plus" groesse={18} />
            Standort hinzufügen
          </button>
        )
      )}
    </div>
  );
}

function StandortKarte({
  kunde,
  standort,
  teile,
  schreiben,
  beiAenderung,
  entfernen,
}: {
  kunde: Kunde;
  standort: Standort;
  teile: Standortteil[];
  schreiben: boolean;
  beiAenderung: () => void;
  entfernen: () => void;
}) {
  const [bearbeiten, setBearbeiten] = useState(false);
  const [neuOben, setNeuOben] = useState(false);
  const baum = useMemo(() => teilbaum(teile), [teile]);

  if (bearbeiten) {
    return (
      <Standortmaske
        vorher={standort}
        start={standort}
        fertig={(gespeichert) => {
          setBearbeiten(false);
          if (gespeichert) beiAenderung();
        }}
      />
    );
  }

  return (
    <section className="wb-block wb-standort">
      <header className="wb-standort__kopf">
        <span className="wb-standort__symbol" aria-hidden="true">
          <Symbol name="gebaeude" />
        </span>
        <div>
          <h2>{standort.bezeichnung}</h2>
          <p className="wb-leer">{anschriftZeile(standort) || "ohne Anschrift"}</p>
          {standort.notiz && <p>{standort.notiz}</p>}
        </div>
        {schreiben && (
          <div className="wb-standort__aktionen">
            <button type="button" className="wb-zeilenknopf" title="Standort bearbeiten" onClick={() => setBearbeiten(true)}>
              <Symbol name="stift" groesse={16} />
            </button>
            <button type="button" className="wb-zeilenknopf" title="Standort entfernen" onClick={entfernen}>
              <Symbol name="muell" groesse={16} />
            </button>
          </div>
        )}
      </header>

      {baum.length > 0 && (
        <Teilliste
          knoten={baum}
          baum={baum}
          kunde={kunde.id}
          standort={standort.id}
          schreiben={schreiben}
          beiAenderung={beiAenderung}
        />
      )}
      {baum.length === 0 && !neuOben && (
        <p className="wb-leer">Noch keine Gebäude, Räume oder Bereiche erfasst.</p>
      )}

      {neuOben ? (
        <Teilmaske
          standort={standort.id}
          eltern=""
          art="gebaeude"
          kunde={kunde.id}
          fertig={(gespeichert) => {
            setNeuOben(false);
            if (gespeichert) beiAenderung();
          }}
        />
      ) : (
        schreiben && (
          <button type="button" className="wb-textknopf" onClick={() => setNeuOben(true)}>
            <Symbol name="plus" groesse={16} />
            Gebäude oder Bereich hinzufügen
          </button>
        )
      )}
    </section>
  );
}

function Teilliste({
  knoten,
  baum,
  kunde,
  standort,
  schreiben,
  beiAenderung,
}: {
  knoten: Teilknoten[];
  baum: Teilknoten[];
  kunde: string;
  standort: string;
  schreiben: boolean;
  beiAenderung: () => void;
}) {
  return (
    <ul className="wb-teilbaum">
      {knoten.map((k) => (
        <Teilzeile
          key={k.id}
          knoten={k}
          baum={baum}
          kunde={kunde}
          standort={standort}
          schreiben={schreiben}
          beiAenderung={beiAenderung}
        />
      ))}
    </ul>
  );
}

function Teilzeile({
  knoten,
  baum,
  kunde,
  standort,
  schreiben,
  beiAenderung,
}: {
  knoten: Teilknoten;
  baum: Teilknoten[];
  kunde: string;
  standort: string;
  schreiben: boolean;
  beiAenderung: () => void;
}) {
  const [modus, setModus] = useState<"ansehen" | "kind" | "umbenennen">("ansehen");
  const [fehler, setFehler] = useState<string | null>(null);

  async function entfernen() {
    const n = unterteile(baum, knoten.id);
    const zusatz = n ? ` und ${n === 1 ? "den Teil" : `${n} Teile`} darunter` : "";
    if (!confirm(`${STANDORTTEIL_TEXT[knoten.art]} „${knoten.bezeichnung}“${zusatz} entfernen?`)) return;
    try {
      await teilLoeschen(knoten, kunde);
      beiAenderung();
    } catch (e) {
      setFehler(fehlersatz(e));
    }
  }

  return (
    <li>
      {modus === "umbenennen" ? (
        <Teilmaske
          vorher={knoten}
          standort={standort}
          eltern={knoten.eltern ?? ""}
          art={knoten.art}
          kunde={kunde}
          fertig={(gespeichert) => {
            setModus("ansehen");
            if (gespeichert) beiAenderung();
          }}
        />
      ) : (
        <div className="wb-teilbaum__zeile">
          <span className="wb-teilbaum__text">
            <span className={`wb-teilbaum__art wb-teilbaum__art--${knoten.art}`}>{STANDORTTEIL_TEXT[knoten.art]}</span>
            <span className="wb-teilbaum__name">
              {knoten.bezeichnung}
              {knoten.notiz && <small>{knoten.notiz}</small>}
            </span>
          </span>
          {schreiben && (
            <span className="wb-teilbaum__aktionen">
              <button type="button" className="wb-zeilenknopf" title={`In „${knoten.bezeichnung}“ etwas anlegen`} onClick={() => setModus("kind")}>
                <Symbol name="plus" groesse={16} />
              </button>
              <button type="button" className="wb-zeilenknopf" title="Umbenennen" onClick={() => setModus("umbenennen")}>
                <Symbol name="stift" groesse={16} />
              </button>
              <button type="button" className="wb-zeilenknopf" title="Entfernen" onClick={() => void entfernen()}>
                <Symbol name="muell" groesse={16} />
              </button>
            </span>
          )}
        </div>
      )}
      {fehler && (
        <p className="wb-fehler" role="alert">
          {fehler}
        </p>
      )}
      {(knoten.kinder.length > 0 || modus === "kind") && (
        <div className="wb-teilbaum__kinder">
          {knoten.kinder.length > 0 && (
            <Teilliste
              knoten={knoten.kinder}
              baum={baum}
              kunde={kunde}
              standort={standort}
              schreiben={schreiben}
              beiAenderung={beiAenderung}
            />
          )}
          {modus === "kind" && (
            <Teilmaske
              standort={standort}
              eltern={knoten.id}
              art={NAECHSTE_ART[knoten.art]}
              kunde={kunde}
              reihenfolge={knoten.kinder.length + 1}
              fertig={(gespeichert) => {
                setModus("ansehen");
                if (gespeichert) beiAenderung();
              }}
            />
          )}
        </div>
      )}
    </li>
  );
}

function Teilmaske({
  vorher,
  standort,
  eltern,
  art,
  kunde,
  reihenfolge,
  fertig,
}: {
  vorher?: Standortteil;
  standort: string;
  eltern: string;
  art: Standortteilart;
  kunde: string;
  reihenfolge?: number;
  fertig: (gespeichert: boolean) => void;
}) {
  const [werte, setWerte] = useState({
    art: vorher?.art ?? art,
    bezeichnung: vorher?.bezeichnung ?? "",
    notiz: vorher?.notiz ?? "",
  });
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  async function speichern(e: FormEvent) {
    e.preventDefault();
    if (!werte.bezeichnung.trim()) {
      setFehler("Eine Bezeichnung braucht es.");
      return;
    }
    setLaeuft(true);
    try {
      await teilSpeichern(
        vorher ?? null,
        { standort, eltern, ...werte, reihenfolge: vorher?.reihenfolge ?? reihenfolge ?? 0 },
        kunde,
      );
      fertig(true);
    } catch (e) {
      setFehler(fehlersatz(e));
      setLaeuft(false);
    }
  }

  return (
    <form className="wb-teilmaske" onSubmit={speichern}>
      <select
        aria-label="Art"
        value={werte.art}
        onChange={(e) => setWerte({ ...werte, art: e.target.value as Standortteilart })}
      >
        {STANDORTTEIL_ARTEN.map((a) => (
          <option key={a} value={a}>
            {STANDORTTEIL_TEXT[a]}
          </option>
        ))}
      </select>
      <input
        type="text"
        aria-label="Bezeichnung"
        placeholder={werte.art === "geschoss" ? "z. B. Erdgeschoß" : werte.art === "verteiler" ? "z. B. UV-EG" : "Bezeichnung"}
        value={werte.bezeichnung}
        onChange={(e) => setWerte({ ...werte, bezeichnung: e.target.value })}
        autoFocus
      />
      <input
        type="text"
        aria-label="Notiz"
        placeholder="Notiz (optional)"
        value={werte.notiz}
        onChange={(e) => setWerte({ ...werte, notiz: e.target.value })}
      />
      <span className="wb-teilmaske__knoepfe">
        <button className="wb-button" type="submit" disabled={laeuft}>
          {vorher ? "Speichern" : "Anlegen"}
        </button>
        <button className="wb-button wb-button--sekundaer" type="button" onClick={() => fertig(false)}>
          Abbrechen
        </button>
      </span>
      {fehler && (
        <p className="wb-fehler" role="alert">
          {fehler}
        </p>
      )}
    </form>
  );
}

function Standortmaske({
  vorher,
  start,
  fertig,
}: {
  vorher: Standort | null;
  start: StandortEingabe;
  fertig: (gespeichert: boolean) => void;
}) {
  const [werte, setWerte] = useState<StandortEingabe>({
    kunde: start.kunde,
    bezeichnung: start.bezeichnung,
    strasse: start.strasse ?? "",
    plz: start.plz ?? "",
    ort: start.ort ?? "",
    land: start.land ?? "",
    notiz: start.notiz ?? "",
  });
  const [fehler, setFehler] = useState<string | null>(null);
  const feld = (k: keyof StandortEingabe) => ({
    value: String(werte[k] ?? ""),
    onChange: (e: { target: { value: string } }) => setWerte({ ...werte, [k]: e.target.value }),
  });

  async function speichern(e: FormEvent) {
    e.preventDefault();
    if (!werte.bezeichnung.trim()) {
      setFehler("Eine Bezeichnung braucht es — etwa „Amtshaus“ oder die Straße.");
      return;
    }
    try {
      await standortSpeichern(vorher, werte);
      fertig(true);
    } catch (e) {
      setFehler(fehlersatz(e));
    }
  }

  return (
    <form className="wb-maske wb-block" onSubmit={speichern}>
      <h2 className="wb-feld--breit">{vorher ? "Standort bearbeiten" : "Neuer Standort"}</h2>
      <label className="wb-feld wb-feld--breit">
        <span>Bezeichnung *</span>
        <input type="text" placeholder="z. B. Bauhof" {...feld("bezeichnung")} autoFocus />
      </label>
      <label className="wb-feld wb-feld--breit">
        <span>Straße</span>
        <input type="text" {...feld("strasse")} />
      </label>
      <label className="wb-feld">
        <span>PLZ</span>
        <input type="text" inputMode="numeric" {...feld("plz")} />
      </label>
      <label className="wb-feld">
        <span>Ort</span>
        <input type="text" {...feld("ort")} />
      </label>
      <label className="wb-feld wb-feld--breit">
        <span>Notiz</span>
        <input type="text" placeholder="z. B. Schlüssel beim Hausmeister" {...feld("notiz")} />
      </label>
      {fehler && (
        <p className="wb-fehler wb-feld--breit" role="alert">
          {fehler}
        </p>
      )}
      <div className="wb-aktionen wb-feld--breit">
        <button className="wb-button" type="submit">
          Speichern
        </button>
        <button className="wb-button wb-button--sekundaer" type="button" onClick={() => fertig(false)}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}
