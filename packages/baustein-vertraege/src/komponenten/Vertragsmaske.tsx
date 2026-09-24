import { useEffect, useState, type FormEvent } from "react";
import {
  aktuellerRechtsraum,
  alsEingabe,
  ausGeld,
  fehlersatz,
  kundenSuchen,
  schreibweiseVon,
  type Kunde,
} from "@werkboq/core";
import {
  RHYTHMEN,
  RHYTHMUS_TEXT,
  VERRECHNUNGSART_TEXT,
  VERRECHNUNGSARTEN,
  type Rhythmus,
  type Verrechnungsart,
} from "../daten/rechnen";
import { standorteZuKunde, type VertragEingabe } from "../daten/vertraege";

/**
 * Der Vertrag in einer Maske, in drei Abschnitten: Wartung, Verrechnung,
 * Laufzeit. Die Felder, die nur bei Pauschale Sinn haben, erscheinen nur
 * dann — ein Aufwandsvertrag mit einem Pauschalbetrag von 0 € ist ein
 * Feld, das Fragen aufwirft.
 */
export function Vertragsmaske({
  vorher,
  beiSpeichern,
  beiAbbruch,
}: {
  vorher: VertragEingabe;
  beiSpeichern: (e: VertragEingabe) => Promise<void>;
  beiAbbruch: () => void;
}) {
  const sw = schreibweiseVon(aktuellerRechtsraum().id);
  const [w, setW] = useState<VertragEingabe>(vorher);
  const [pauschaleText, setPauschaleText] = useState(vorher.pauschale ? alsEingabe(vorher.pauschale, sw) : "");
  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [standorte, setStandorte] = useState<{ id: string; bezeichnung: string }[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  useEffect(() => {
    kundenSuchen("", 500).then(setKunden).catch(() => setKunden([]));
  }, []);
  useEffect(() => {
    standorteZuKunde(w.kunde).then(setStandorte).catch(() => setStandorte([]));
  }, [w.kunde]);

  const feld = <K extends keyof VertragEingabe>(k: K, wert: VertragEingabe[K]) => setW((x) => ({ ...x, [k]: wert }));
  const zahl = (t: string) => (t.trim() === "" ? 0 : Math.max(0, Math.round(Number(t.replace(",", ".")) || 0)));

  async function absenden(e: FormEvent) {
    e.preventDefault();
    const pauschale = w.verrechnung === "pauschale" ? ausGeld(pauschaleText) : 0;
    if (w.verrechnung === "pauschale" && (!Number.isFinite(pauschale) || pauschale <= 0)) {
      setFehler("Bei einer Pauschale fehlt der Betrag.");
      return;
    }
    if (!w.kunde) {
      setFehler("Ein Vertrag gehört zu einem Kunden.");
      return;
    }
    setLaeuft(true);
    try {
      await beiSpeichern({ ...w, pauschale });
    } catch (x: unknown) {
      setFehler(fehlersatz(x));
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <form className="wb-maske" onSubmit={absenden}>
      <label className="wb-feld">
        <span>Nummer</span>
        <input type="text" value={w.nummer} onChange={(e) => feld("nummer", e.target.value)} required />
      </label>
      <label className="wb-feld">
        <span>Kunde *</span>
        <select value={w.kunde} onChange={(e) => setW((x) => ({ ...x, kunde: e.target.value, standort: "" }))} required>
          <option value="">bitte wählen</option>
          {kunden.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
            </option>
          ))}
        </select>
      </label>
      {standorte.length > 0 && (
        <label className="wb-feld">
          <span>Standort / Objekt</span>
          <select value={w.standort ?? ""} onChange={(e) => feld("standort", e.target.value)}>
            <option value="">—</option>
            {standorte.map((s) => (
              <option key={s.id} value={s.id}>
                {s.bezeichnung}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="wb-feld wb-feld--breit">
        <span>Worum geht es *</span>
        <input
          type="text"
          value={w.titel}
          onChange={(e) => feld("titel", e.target.value)}
          placeholder="z. B. Wiederkehrende Prüfung und Notbeleuchtung, Objekt Lindenhof"
          required
        />
      </label>
      <label className="wb-feld wb-feld--breit">
        <span>Leistungen bei jeder Wartung</span>
        <textarea
          rows={3}
          value={w.leistungen ?? ""}
          onChange={(e) => feld("leistungen", e.target.value)}
          placeholder="Steht später im Wartungsauftrag — was der Monteur vor Ort tut."
        />
      </label>

      <h2 className="wb-maske__abschnitt">Wartung</h2>
      <label className="wb-feld">
        <span>Alle … Monate</span>
        <input type="number" min={1} max={120} value={w.intervallMonate} onChange={(e) => feld("intervallMonate", zahl(e.target.value) || 1)} />
      </label>
      <label className="wb-feld">
        <span>Nächste Wartung</span>
        <input type="date" value={w.naechsteWartung ?? ""} onChange={(e) => feld("naechsteWartung", e.target.value)} />
      </label>
      <label className="wb-feld">
        <span>Erinnern … Tage vorher</span>
        <input type="number" min={0} max={365} value={w.vorlaufTage ?? 30} onChange={(e) => feld("vorlaufTage", zahl(e.target.value))} />
      </label>

      <h2 className="wb-maske__abschnitt">Verrechnung</h2>
      <label className="wb-feld">
        <span>Wie</span>
        <select value={w.verrechnung} onChange={(e) => feld("verrechnung", e.target.value as Verrechnungsart)}>
          {VERRECHNUNGSARTEN.map((a) => (
            <option key={a} value={a}>
              {VERRECHNUNGSART_TEXT[a]}
            </option>
          ))}
        </select>
        <small className="wb-notiz">
          {w.verrechnung === "pauschale"
            ? "Ein fester Betrag je Zeitraum, im Voraus. Werkboq erinnert, wenn er fällig ist, und legt auf Klick einen Rechnungsentwurf an."
            : "Jede Wartung wird wie ein normaler Auftrag verrechnet — mit Stunden und Material."}
        </small>
      </label>
      {w.verrechnung === "pauschale" && (
        <>
          <label className="wb-feld">
            <span>Pauschale netto ({aktuellerRechtsraum().waehrungszeichen})</span>
            <input type="text" inputMode="decimal" value={pauschaleText} onChange={(e) => setPauschaleText(e.target.value)} placeholder="0,00" />
          </label>
          <label className="wb-feld">
            <span>je</span>
            <select value={w.rhythmus ?? "jahr"} onChange={(e) => feld("rhythmus", e.target.value as Rhythmus)}>
              {RHYTHMEN.map((r) => (
                <option key={r} value={r}>
                  {RHYTHMUS_TEXT[r]}
                </option>
              ))}
            </select>
          </label>
          <label className="wb-feld">
            <span>Nächste Rechnung am</span>
            <input type="date" value={w.naechsteRechnung ?? ""} onChange={(e) => feld("naechsteRechnung", e.target.value)} />
          </label>
        </>
      )}

      <h2 className="wb-maske__abschnitt">Laufzeit</h2>
      <label className="wb-feld">
        <span>Beginn *</span>
        <input type="date" value={w.beginn} onChange={(e) => feld("beginn", e.target.value)} required />
      </label>
      <label className="wb-feld">
        <span>Erste Laufzeit (Monate)</span>
        <input type="number" min={0} value={w.laufzeitMonate ?? 0} onChange={(e) => feld("laufzeitMonate", zahl(e.target.value))} />
        <small className="wb-notiz">0 = unbefristet</small>
      </label>
      <label className="wb-feld">
        <span>Verlängert sich um (Monate)</span>
        <input type="number" min={0} value={w.verlaengerungMonate ?? 0} onChange={(e) => feld("verlaengerungMonate", zahl(e.target.value))} />
        <small className="wb-notiz">0 = endet nach der Laufzeit</small>
      </label>
      <label className="wb-feld">
        <span>Kündigungsfrist (Monate)</span>
        <input type="number" min={0} value={w.kuendigungsfristMonate ?? 0} onChange={(e) => feld("kuendigungsfristMonate", zahl(e.target.value))} />
      </label>
      <label className="wb-feld wb-feld--breit">
        <span>Notiz</span>
        <input type="text" value={w.notiz ?? ""} onChange={(e) => feld("notiz", e.target.value)} />
      </label>

      {fehler && <p className="wb-fehler wb-feld--breit" role="alert">{fehler}</p>}
      <div className="wb-aktionen wb-feld--breit">
        <button className="wb-button" type="submit" disabled={laeuft}>
          {laeuft ? "Wird gespeichert …" : "Speichern"}
        </button>
        <button className="wb-button wb-button--sekundaer" type="button" onClick={beiAbbruch}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}
