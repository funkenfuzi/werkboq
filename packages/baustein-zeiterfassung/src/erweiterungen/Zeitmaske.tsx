import { useEffect, useState, type FormEvent } from "react";
import {
  alleMitarbeiter,
  alsDatum,
  alsStunden,
  eigenerMitarbeiter,
  minuten,
  type Auftrag,
  type Mitarbeiter,
} from "@werkboq/core";
import {
  dauer,
  LEERE_ZEIT,
  zeitAnlegen,
  ZEITARTEN,
  ZEITART_TEXT,
  type Zeitart,
  type ZeitEingabe,
} from "../daten/zeiten";

/**
 * Maske für einen Zeiteintrag.
 *
 * Wird an zwei Stellen verwendet: in der Wochenansicht (dort wählt man den
 * Auftrag) und in der Auftragsakte (dort steht er fest). Deshalb ist der
 * Auftrag entweder ein Auswahlfeld oder fix vorgegeben.
 */
export function Zeitmaske({
  auftraege,
  festerAuftrag,
  vorgabeDatum,
  beiGespeichert,
  beiAbbruch,
}: {
  auftraege?: Auftrag[];
  festerAuftrag?: string;
  vorgabeDatum?: string;
  beiGespeichert: () => void;
  beiAbbruch: () => void;
}) {
  const [werte, setWerte] = useState<ZeitEingabe>({
    ...LEERE_ZEIT,
    datum: vorgabeDatum ?? alsDatum(new Date()),
    auftrag: festerAuftrag ?? "",
    beginn: "07:00",
    ende: "16:00",
    pause: 30,
  });
  const [fehler, setFehler] = useState<string | null>(null);
  const [speichert, setSpeichert] = useState(false);
  const [personal, setPersonal] = useState<Mitarbeiter[]>([]);

  // Vorbelegt ist der eigene Mitarbeiterdatensatz. Ohne ihn taucht die
  // Buchung zwar in der eigenen Wochenansicht auf, aber nicht in der Planung
  // — dort wird nach Mitarbeiter gezählt, nicht nach Benutzerkonto.
  useEffect(() => {
    let abgebrochen = false;
    Promise.all([eigenerMitarbeiter(), alleMitarbeiter(true)])
      .then(([eigen, alle]) => {
        if (abgebrochen) return;
        setPersonal(alle);
        if (eigen) setWerte((v) => (v.mitarbeiter ? v : { ...v, mitarbeiter: eigen.id }));
      })
      .catch(() => undefined);
    return () => {
      abgebrochen = true;
    };
  }, []);

  const laenge = dauer(werte);

  async function absenden(e: FormEvent) {
    e.preventDefault();
    if (minuten(werte.beginn) < 0) {
      setFehler("Beginn bitte als Uhrzeit angeben, etwa 07:30.");
      return;
    }
    if (werte.ende && minuten(werte.ende) < 0) {
      setFehler("Ende bitte als Uhrzeit angeben, etwa 16:00.");
      return;
    }
    if (laenge === 0) {
      setFehler("Die Dauer ist null — Beginn, Ende und Pause prüfen.");
      return;
    }
    setSpeichert(true);
    setFehler(null);
    try {
      await zeitAnlegen(werte);
      beiGespeichert();
    } catch (e: unknown) {
      setFehler(e instanceof Error ? e.message : String(e));
    } finally {
      setSpeichert(false);
    }
  }

  return (
    <form className="wb-maske" onSubmit={absenden}>
      <label className="wb-feld">
        <span>Datum *</span>
        <input
          type="date"
          value={werte.datum}
          onChange={(e) => setWerte({ ...werte, datum: e.target.value })}
          required
        />
      </label>

      <label className="wb-feld">
        <span>Art</span>
        <select
          value={werte.art}
          onChange={(e) => setWerte({ ...werte, art: e.target.value as Zeitart })}
        >
          {ZEITARTEN.map((a) => (
            <option key={a} value={a}>
              {ZEITART_TEXT[a]}
            </option>
          ))}
        </select>
      </label>

      <label className="wb-feld wb-feld--schmal">
        <span>Beginn *</span>
        <input
          type="time"
          value={werte.beginn}
          onChange={(e) => setWerte({ ...werte, beginn: e.target.value })}
          required
        />
      </label>

      <label className="wb-feld wb-feld--schmal">
        <span>Ende</span>
        <input
          type="time"
          value={werte.ende ?? ""}
          onChange={(e) => setWerte({ ...werte, ende: e.target.value })}
        />
      </label>

      <label className="wb-feld wb-feld--schmal">
        <span>Pause (min)</span>
        <input
          type="number"
          min={0}
          step={5}
          value={werte.pause ?? 0}
          onChange={(e) => setWerte({ ...werte, pause: Number(e.target.value) })}
        />
      </label>

      <div className="wb-feld">
        <span>Dauer</span>
        <output className="wb-dauer">{alsStunden(laenge)} h</output>
      </div>

      {!festerAuftrag && (
        <label className="wb-feld wb-feld--breit">
          <span>Auftrag</span>
          <select
            value={werte.auftrag ?? ""}
            onChange={(e) => setWerte({ ...werte, auftrag: e.target.value })}
          >
            <option value="">— kein Auftrag (allgemeine Arbeitszeit) —</option>
            {(auftraege ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.nummer} · {a.titel}
              </option>
            ))}
          </select>
        </label>
      )}

      {personal.length > 1 && (
        <label className="wb-feld wb-feld--breit">
          <span>Mitarbeiter</span>
          <select
            value={werte.mitarbeiter ?? ""}
            onChange={(e) => setWerte({ ...werte, mitarbeiter: e.target.value })}
          >
            <option value="">— nicht zugeordnet —</option>
            {personal.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="wb-feld wb-feld--breit">
        <span>Tätigkeit</span>
        <input
          type="text"
          placeholder="Verteiler verdrahtet, Zuleitung gezogen"
          value={werte.taetigkeit ?? ""}
          onChange={(e) => setWerte({ ...werte, taetigkeit: e.target.value })}
        />
      </label>

      <label className="wb-schalter wb-feld--breit">
        <input
          type="checkbox"
          checked={werte.verrechenbar ?? false}
          onChange={(e) => setWerte({ ...werte, verrechenbar: e.target.checked })}
        />
        <span>
          Verrechenbar
          <small>Zählt später in die Abrechnung. Fahrtzeiten je nach Vereinbarung.</small>
        </span>
      </label>

      {fehler && (
        <p className="wb-fehler wb-feld--breit" role="alert">
          {fehler}
        </p>
      )}

      <div className="wb-aktionen wb-feld--breit">
        <button className="wb-button" type="submit" disabled={speichert}>
          {speichert ? "Speichert …" : "Eintragen"}
        </button>
        <button className="wb-button wb-button--sekundaer" type="button" onClick={beiAbbruch}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}
