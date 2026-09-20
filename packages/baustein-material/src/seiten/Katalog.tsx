import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  aktuellerRechtsraum,
  alsEuro,
  alsGeld,
  ausGeld,
  fehlersatz,
  satzText,
  schreibweiseVon,
  Symbol,
  zahlText,
  type UstSatz,
} from "@werkboq/core";
import {
  ARTIKELART_TEXT,
  ARTIKELARTEN,
  alleArtikel,
  artikelAendern,
  artikelAnlegen,
  artikelStilllegen,
  EINHEITEN,
  LEERER_ARTIKEL,
  naechsteArtikelnummer,
  type Artikel,
  type Artikelart,
  type ArtikelEingabe,
} from "../daten/artikel";

/**
 * Leistungs- und Materialkatalog.
 *
 * Kein Lager, keine Bestände — nur Preise und Bezeichnungen, die man beim
 * Schreiben einer Position auswählen statt tippen will. Lagerführung wäre
 * ein eigener Baustein und für die meisten Elektrobetriebe Aufwand ohne
 * Ertrag: der Kleinkram kommt vom Großhändler auf die Baustelle.
 */
export function Katalog() {
  const raum = aktuellerRechtsraum();
  const geld = schreibweiseVon(raum.id);
  const [liste, setListe] = useState<Artikel[]>([]);
  const [suche, setSuche] = useState("");
  const [nurArt, setNurArt] = useState<Artikelart | "alle">("alle");
  const [bearbeitet, setBearbeitet] = useState<Artikel | "neu" | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  function laden() {
    setLaedt(true);
    alleArtikel()
      .then(setListe)
      .catch((e: unknown) => setFehler(e instanceof Error ? e.message : String(e)))
      .finally(() => setLaedt(false));
  }

  useEffect(laden, []);

  const gefiltert = useMemo(() => {
    const t = suche.trim().toLowerCase();
    return liste.filter(
      (a) =>
        (nurArt === "alle" || a.art === nurArt) &&
        (t === "" ||
          a.bezeichnung.toLowerCase().includes(t) ||
          a.nummer.toLowerCase().includes(t)),
    );
  }, [liste, suche, nurArt]);

  async function stilllegen(a: Artikel) {
    if (!confirm(`${a.bezeichnung} stilllegen? Bestehende Positionen bleiben unberührt.`)) return;
    await artikelStilllegen(a);
    laden();
  }

  return (
    <section>
      <div className="wb-kopf">
        <div>
          <h1>Katalog</h1>
          <p className="wb-kopf__zahl">
            {gefiltert.length} von {liste.length} Einträgen
          </p>
        </div>
        {!bearbeitet && (
          <button className="wb-button" type="button" onClick={() => setBearbeitet("neu")}>
            <Symbol name="plus" groesse={18} />
            Neuer Eintrag
          </button>
        )}
      </div>

      <div className="wb-werkzeugleiste">
        <label className="wb-suchfeld">
          <Symbol name="suche" groesse={18} />
          <input
            type="search"
            placeholder="Nach Bezeichnung oder Nummer filtern"
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
          />
        </label>
        <div className="wb-umschalter">
          <button
            type="button"
            className={nurArt === "alle" ? "ist-aktiv" : ""}
            onClick={() => setNurArt("alle")}
          >
            Alle
          </button>
          {ARTIKELARTEN.map((a) => (
            <button
              key={a}
              type="button"
              className={nurArt === a ? "ist-aktiv" : ""}
              onClick={() => setNurArt(a)}
            >
              {ARTIKELART_TEXT[a]}
            </button>
          ))}
        </div>
      </div>

      {fehler && (
        <p className="wb-fehler" role="alert">
          {fehler}
        </p>
      )}

      {bearbeitet && (
        <Artikelmaske
          key={bearbeitet === "neu" ? "neu" : bearbeitet.id}
          vorhanden={bearbeitet === "neu" ? null : bearbeitet}
          beiGespeichert={() => {
            setBearbeitet(null);
            laden();
          }}
          beiAbbruch={() => setBearbeitet(null)}
        />
      )}

      {laedt && liste.length === 0 && <p className="wb-leer">Wird geladen …</p>}

      {!laedt && liste.length === 0 && (
        <div className="wb-nichts">
          <p>Der Katalog ist leer.</p>
          <p className="wb-leer">
            Was du oft verrechnest, legst du hier einmal an — beim Schreiben einer Position
            wählst du es dann aus, statt Preis und Einheit jedes Mal zu tippen.
          </p>
        </div>
      )}

      {gefiltert.length > 0 && (
        <div className="wb-tabelle-rahmen">
          <table className="wb-tabelle">
            <thead>
              <tr>
                <th scope="col">Nummer</th>
                <th scope="col">Bezeichnung</th>
                <th scope="col">Art</th>
                <th scope="col">Einheit</th>
                <th scope="col" className="wb-zelle--rechts">Verkauf</th>
                <th scope="col" className="wb-zelle--rechts">Einkauf</th>
                <th scope="col" className="wb-zelle--rechts">Spanne</th>
                <th scope="col" className="wb-zelle--rechts">{raum.steuerKurz}</th>
                <th scope="col" aria-label="Aktionen" />
              </tr>
            </thead>
            <tbody>
              {gefiltert.map((a) => (
                <tr key={a.id} className={a.aktiv === false ? "ist-stillgelegt" : ""}>
                  <td className="wb-tabelle__kennung">{a.nummer}</td>
                  <td>
                    <span className="wb-zellname">
                      <span className={`wb-punkt wb-punkt--${a.art}`} aria-hidden="true" />
                      <span>
                        {a.bezeichnung}
                        {a.beschreibung && <small>{a.beschreibung}</small>}
                      </span>
                    </span>
                  </td>
                  <td>{ARTIKELART_TEXT[a.art]}</td>
                  <td className="wb-zelle--gedaempft">{a.einheit}</td>
                  <td className="wb-zelle--rechts wb-tabelle__kennung">{alsGeld(a.preis, geld)}</td>
                  <td className="wb-zelle--rechts wb-tabelle__kennung wb-zelle--gedaempft">
                    {a.einkauf ? alsGeld(a.einkauf, geld) : "—"}
                  </td>
                  <td className="wb-zelle--rechts wb-tabelle__kennung">{spanne(a)}</td>
                  <td className="wb-zelle--rechts wb-tabelle__kennung">{zahlText(raum, a.ustsatz)} %</td>
                  <td className="wb-zelle--rechts">
                    <button
                      type="button"
                      className="wb-zeilenknopf wb-zeilenknopf--neutral"
                      onClick={() => setBearbeitet(a)}
                      title={`${a.bezeichnung} bearbeiten`}
                    >
                      <Symbol name="stift" groesse={16} />
                    </button>
                    {a.aktiv !== false && (
                      <button
                        type="button"
                        className="wb-zeilenknopf"
                        onClick={() => void stilllegen(a)}
                        title={`${a.bezeichnung} stilllegen`}
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
    </section>
  );
}

/** Aufschlag auf den Einkauf in Prozent — leer, wenn kein Einkaufspreis steht. */
function spanne(a: Artikel): string {
  if (!a.einkauf || a.einkauf <= 0) return "—";
  return `${Math.round(((a.preis - a.einkauf) / a.einkauf) * 100)} %`;
}

function Artikelmaske({
  vorhanden,
  beiGespeichert,
  beiAbbruch,
}: {
  vorhanden: Artikel | null;
  beiGespeichert: () => void;
  beiAbbruch: () => void;
}) {
  const raum = aktuellerRechtsraum();
  const geld = schreibweiseVon(raum.id);
  const [werte, setWerte] = useState<ArtikelEingabe>(
    vorhanden
      ? { ...LEERER_ARTIKEL, ...vorhanden }
      : { ...LEERER_ARTIKEL, ustsatz: raum.normalsatz },
  );
  const [verkauf, setVerkauf] = useState(
    vorhanden ? (vorhanden.preis / 100).toFixed(2).replace(".", ",") : "0,00",
  );
  const [einkauf, setEinkauf] = useState(
    vorhanden?.einkauf ? (vorhanden.einkauf / 100).toFixed(2).replace(".", ",") : "",
  );
  const [fehler, setFehler] = useState<string | null>(null);

  // Nummer erst vorschlagen, wenn die Art feststeht — sie steckt im Präfix.
  useEffect(() => {
    if (vorhanden || werte.nummer) return;
    let weg = false;
    naechsteArtikelnummer(werte.art)
      .then((n) => !weg && setWerte((v) => (v.nummer ? v : { ...v, nummer: n })))
      .catch(() => undefined);
    return () => {
      weg = true;
    };
  }, [werte.art, werte.nummer, vorhanden]);

  async function absenden(e: FormEvent) {
    e.preventDefault();
    const vk = ausGeld(verkauf);
    const ek = einkauf.trim() === "" ? 0 : ausGeld(einkauf);
    if (Number.isNaN(vk) || Number.isNaN(ek)) {
      setFehler("Preis bitte als Zahl angeben, etwa 12,50.");
      return;
    }
    try {
      const fertig = { ...werte, preis: vk, einkauf: ek };
      if (vorhanden) await artikelAendern(vorhanden.id, fertig);
      else await artikelAnlegen(fertig);
      beiGespeichert();
    } catch (e: unknown) {
      setFehler(
        fehlersatz(e, { nummer: "Diese Artikelnummer gibt es schon — bitte eine andere wählen." }),
      );
    }
  }

  return (
    <form className="wb-maske" onSubmit={absenden}>
      <label className="wb-feld wb-feld--schmal">
        <span>Nummer *</span>
        <input
          type="text"
          value={werte.nummer}
          onChange={(e) => setWerte({ ...werte, nummer: e.target.value })}
          required
        />
      </label>

      <label className="wb-feld">
        <span>Art</span>
        <select
          value={werte.art}
          onChange={(e) =>
            setWerte({ ...werte, art: e.target.value as Artikelart, nummer: vorhanden ? werte.nummer : "" })
          }
        >
          {ARTIKELARTEN.map((a) => (
            <option key={a} value={a}>
              {ARTIKELART_TEXT[a]}
            </option>
          ))}
        </select>
      </label>

      <label className="wb-feld wb-feld--breit">
        <span>Bezeichnung *</span>
        <input
          type="text"
          value={werte.bezeichnung}
          onChange={(e) => setWerte({ ...werte, bezeichnung: e.target.value })}
          required
          autoFocus
        />
      </label>

      <label className="wb-feld wb-feld--breit">
        <span>Beschreibung</span>
        <input
          type="text"
          value={werte.beschreibung ?? ""}
          onChange={(e) => setWerte({ ...werte, beschreibung: e.target.value })}
        />
      </label>

      <label className="wb-feld wb-feld--schmal">
        <span>Einheit</span>
        <input
          type="text"
          list="wb-einheiten-katalog"
          value={werte.einheit}
          onChange={(e) => setWerte({ ...werte, einheit: e.target.value })}
        />
        <datalist id="wb-einheiten-katalog">
          {EINHEITEN.map((e) => (
            <option key={e} value={e} />
          ))}
        </datalist>
      </label>

      <label className="wb-feld wb-feld--schmal">
        <span>Verkauf netto *</span>
        <input
          type="text"
          inputMode="decimal"
          value={verkauf}
          onChange={(e) => setVerkauf(e.target.value)}
          required
        />
      </label>

      <label className="wb-feld wb-feld--schmal">
        <span>Einkauf netto</span>
        <input
          type="text"
          inputMode="decimal"
          placeholder="optional"
          value={einkauf}
          onChange={(e) => setEinkauf(e.target.value)}
        />
        <small className="wb-notiz">Bleibt im Haus, steht auf keinem Kundenbeleg.</small>
      </label>

      <label className="wb-feld">
        <span>{raum.steuerName}</span>
        <select
          value={werte.ustsatz}
          onChange={(e) => setWerte({ ...werte, ustsatz: Number(e.target.value) as UstSatz })}
        >
          {raum.steuersaetze.map((s) => (
            <option key={s.satz} value={s.satz}>
              {satzText(raum, s.satz)}
            </option>
          ))}
        </select>
      </label>

      <div className="wb-feld">
        <span>Brutto</span>
        <output className="wb-dauer">
          {alsEuro(Math.round((ausGeld(verkauf) || 0) * (1 + werte.ustsatz / 100)), geld)}
        </output>
      </div>

      <label className="wb-schalter wb-feld--breit">
        <input
          type="checkbox"
          checked={werte.aktiv !== false}
          onChange={(e) => setWerte({ ...werte, aktiv: e.target.checked })}
        />
        <span>
          Aktiv
          <small>Nur aktive Einträge erscheinen bei der Artikelsuche in einer Position.</small>
        </span>
      </label>

      {fehler && (
        <p className="wb-fehler wb-feld--breit" role="alert">
          {fehler}
        </p>
      )}

      <div className="wb-aktionen wb-feld--breit">
        <button className="wb-button" type="submit">
          {vorhanden ? "Speichern" : "Anlegen"}
        </button>
        <button className="wb-button wb-button--sekundaer" type="button" onClick={beiAbbruch}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}
