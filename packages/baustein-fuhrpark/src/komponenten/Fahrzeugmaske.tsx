import { useState, type FormEvent } from "react";
import { fehlersatz, type Mitarbeiter } from "@werkboq/core";
import {
  FAHRZEUGART_TEXT,
  FAHRZEUGARTEN,
  fahrzeugAendern,
  fahrzeugAnlegen,
  LEERES_FAHRZEUG,
  type Fahrzeug,
  type FahrzeugEingabe,
} from "../daten/fahrzeuge";

/** Stammdaten eines Fahrzeugs. Wenig Felder — der Rest steht im Typenschein. */
export function Fahrzeugmaske({
  vorhanden,
  mitarbeiter,
  beiGespeichert,
  beiAbbruch,
}: {
  vorhanden: Fahrzeug | null;
  mitarbeiter: Mitarbeiter[];
  beiGespeichert: () => void;
  beiAbbruch: () => void;
}) {
  const [werte, setWerte] = useState<FahrzeugEingabe>(
    vorhanden ? { ...vorhanden } : { ...LEERES_FAHRZEUG },
  );
  const [fehler, setFehler] = useState<string | null>(null);
  const [speichert, setSpeichert] = useState(false);

  function feld<K extends keyof FahrzeugEingabe>(k: K, v: FahrzeugEingabe[K]) {
    setWerte((alt) => ({ ...alt, [k]: v }));
  }

  async function absenden(e: FormEvent) {
    e.preventDefault();
    if (!werte.kennzeichen.trim()) {
      setFehler("Das Kennzeichen fehlt — daran erkennt jeder das Fahrzeug wieder.");
      return;
    }
    setSpeichert(true);
    setFehler(null);
    try {
      if (vorhanden) await fahrzeugAendern(vorhanden.id, werte);
      else await fahrzeugAnlegen(werte);
      beiGespeichert();
    } catch (e: unknown) {
      setFehler(
        fehlersatz(e, {
          kennzeichen: "Dieses Kennzeichen gibt es schon.",
        }),
      );
    } finally {
      setSpeichert(false);
    }
  }

  return (
    <form className="wb-maske" onSubmit={absenden}>
      <label className="wb-feld">
        <span>Kennzeichen *</span>
        <input
          type="text"
          value={werte.kennzeichen}
          onChange={(e) => feld("kennzeichen", e.target.value.toUpperCase())}
          placeholder="WN-123AB"
          required
        />
      </label>

      <label className="wb-feld">
        <span>Bezeichnung *</span>
        <input
          type="text"
          value={werte.bezeichnung}
          onChange={(e) => feld("bezeichnung", e.target.value)}
          placeholder="Montagebus groß"
          required
        />
      </label>

      <label className="wb-feld">
        <span>Art</span>
        <select
          value={werte.art}
          onChange={(e) => feld("art", e.target.value as FahrzeugEingabe["art"])}
        >
          {FAHRZEUGARTEN.map((a) => (
            <option key={a} value={a}>
              {FAHRZEUGART_TEXT[a]}
            </option>
          ))}
        </select>
      </label>

      <label className="wb-feld">
        <span>Marke</span>
        <input type="text" value={werte.marke ?? ""} onChange={(e) => feld("marke", e.target.value)} />
      </label>

      <label className="wb-feld">
        <span>Modell</span>
        <input
          type="text"
          value={werte.modell ?? ""}
          onChange={(e) => feld("modell", e.target.value)}
        />
      </label>

      <label className="wb-feld">
        <span>Erstzulassung</span>
        <input
          type="date"
          value={werte.erstzulassung?.slice(0, 10) ?? ""}
          onChange={(e) => feld("erstzulassung", e.target.value)}
        />
      </label>

      <label className="wb-feld">
        <span>Zugeordnet</span>
        <select
          value={werte.mitarbeiter ?? ""}
          onChange={(e) => feld("mitarbeiter", e.target.value)}
        >
          <option value="">Poolfahrzeug</option>
          {mitarbeiter
            .filter((m) => m.aktiv !== false)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
        </select>
      </label>

      <label className="wb-feld">
        <span>Kilometerstand</span>
        <input
          type="number"
          min={0}
          value={werte.kmStand ?? 0}
          onChange={(e) => feld("kmStand", Number(e.target.value))}
        />
      </label>

      <label className="wb-feld wb-feld--breit">
        <span>Notiz</span>
        <input type="text" value={werte.notiz ?? ""} onChange={(e) => feld("notiz", e.target.value)} />
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
