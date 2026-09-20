import { useState, type FormEvent } from "react";
import {
  fehlersatz,
  FUNKTION_TEXT,
  FUNKTIONEN,
  LEERER_MITARBEITER,
  mitarbeiterAendern,
  mitarbeiterAnlegen,
  type Funktion,
  type Mitarbeiter,
  type MitarbeiterEingabe,
} from "@werkboq/core";

/**
 * Die Stammdaten eines Mitarbeiters.
 *
 * Kam aus Einstellungen → Mitarbeiter hierher. Das ist kein Umräumen um des
 * Umräumens willen: Einstellungen sind das, was man einmal einrichtet, und
 * Personal ist das, womit man arbeitet. Wer einen Lehrling anlegt oder einen
 * Urlaub genehmigt, tut nichts, was in ein Einstellungsmenü gehört.
 *
 * Was hier steht, ist der unkritische Teil — Name, Funktion, Telefon, Farbe
 * im Plan. Diese Felder liest auch die Planung und der Auftrag. Alles
 * Heikle liegt in der Personalakte nebenan, in einer eigenen Tabelle mit
 * eigener Regel.
 */
export function Mitarbeitermaske({
  vorhanden,
  beiGespeichert,
  beiAbbruch,
}: {
  vorhanden: Mitarbeiter | null;
  beiGespeichert: (angelegt?: Mitarbeiter) => void;
  beiAbbruch: () => void;
}) {
  const [werte, setWerte] = useState<MitarbeiterEingabe>(
    vorhanden ? { ...LEERER_MITARBEITER, ...vorhanden } : LEERER_MITARBEITER,
  );
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  async function absenden(e: FormEvent) {
    e.preventDefault();
    if (!werte.name.trim()) {
      setFehler("Ein Name ist Pflicht.");
      return;
    }
    setLaeuft(true);
    try {
      if (vorhanden) {
        await mitarbeiterAendern(vorhanden.id, werte);
        beiGespeichert();
      } else {
        const neu = await mitarbeiterAnlegen(werte);
        beiGespeichert(neu);
      }
      setFehler(null);
    } catch (e: unknown) {
      setFehler(fehlersatz(e));
    } finally {
      setLaeuft(false);
    }
  }

  return (
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
        <small className="wb-notiz">Grundlage der Sollstunden in der Lohnvorbereitung.</small>
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

      {fehler && (
        <p className="wb-fehler wb-feld--breit" role="alert">
          {fehler}
        </p>
      )}

      <div className="wb-aktionen wb-feld--breit">
        <button className="wb-button" type="submit" disabled={laeuft}>
          {vorhanden ? "Speichern" : "Anlegen"}
        </button>
        <button className="wb-button wb-button--sekundaer" type="button" onClick={beiAbbruch}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}
