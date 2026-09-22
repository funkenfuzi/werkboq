import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  dienst,
  eigenerMitarbeiter,
  fehlersatz,
  heute,
  Symbol,
  type Fahrzeugauswahl,
} from "@werkboq/core";
import { fahrtAnlegen, fahrtenZuAuftrag, fahrtLoeschen, kmGesamt, summeKm, type Fahrt } from "../daten/fahrten";

/**
 * Fahrten im Reiter „Arbeit".
 *
 * Schnell muss es gehen: der Monteur tippt die einfache Strecke, „hin und
 * retour" ist vorgewählt, das eigene Fahrzeug auch. Drei Felder, ein Knopf.
 * Die Strecke vom letzten Mal steht schon drin — zum selben Kunden fährt
 * man meistens dieselbe Strecke.
 */
export function AuftragFahrten({ auftragId }: { auftragId: string }) {
  const [fahrten, setFahrten] = useState<Fahrt[]>([]);
  const [fahrzeuge, setFahrzeuge] = useState<Fahrzeugauswahl[] | null>(null);
  const [maske, setMaske] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(() => {
    fahrtenZuAuftrag(auftragId)
      .then(setFahrten)
      .catch((e: unknown) => setFehler(fehlersatz(e)));
  }, [auftragId]);

  useEffect(() => {
    laden();
    // Ohne Fuhrpark antwortet niemand — dann entfällt die Auswahl.
    const quelle = dienst("fahrzeuge");
    if (quelle) void quelle().then(setFahrzeuge).catch(() => setFahrzeuge(null));
  }, [laden]);

  return (
    <section className="wb-block">
      <div className="wb-block__kopf">
        <h2>Fahrten</h2>
        {fahrten.length > 0 && (
          <span className="wb-block__summe">
            {summeKm(fahrten).toLocaleString("de-AT")} km · {fahrten.length}{" "}
            {fahrten.length === 1 ? "Fahrt" : "Fahrten"}
          </span>
        )}
        {!maske && (
          <button className="wb-button" type="button" onClick={() => setMaske(true)}>
            <Symbol name="plus" groesse={18} />
            Fahrt
          </button>
        )}
      </div>

      {fehler && (
        <p className="wb-fehler" role="alert">
          {fehler}
        </p>
      )}

      {maske && (
        <Fahrtmaske
          auftragId={auftragId}
          letzte={fahrten[0]}
          fahrzeuge={fahrzeuge}
          beiFertig={() => {
            setMaske(false);
            laden();
          }}
          beiAbbruch={() => setMaske(false)}
          beiFehler={setFehler}
        />
      )}

      {fahrten.length === 0 && !maske ? (
        <p className="wb-leer">Noch keine Fahrt erfasst.</p>
      ) : (
        <ul className="wb-fahrtenliste">
          {fahrten.map((f) => (
            <li key={f.id}>
              <span className="wb-fahrtenliste__datum">
                {new Date(`${f.datum.slice(0, 10)}T00:00:00`).toLocaleDateString("de-AT")}
              </span>
              <span className="wb-fahrtenliste__km">
                {f.hinRetour ? `2 × ${f.kmEinfach}` : f.kmEinfach} km
              </span>
              <span className="wb-fahrtenliste__was">
                {f.kennzeichen || "ohne Fahrzeug"}
                {f.notiz ? ` · ${f.notiz}` : ""}
              </span>
              <span className="wb-fahrtenliste__summe">{kmGesamt(f)} km</span>
              <button
                type="button"
                className="wb-zeilenknopf"
                title="entfernen"
                onClick={() => {
                  if (!confirm(`Fahrt vom ${f.datum.slice(0, 10)} entfernen?`)) return;
                  void fahrtLoeschen(f)
                    .then(laden)
                    .catch((e: unknown) => setFehler(fehlersatz(e)));
                }}
              >
                <Symbol name="muell" groesse={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Fahrtmaske({
  auftragId,
  letzte,
  fahrzeuge,
  beiFertig,
  beiAbbruch,
  beiFehler,
}: {
  auftragId: string;
  letzte?: Fahrt;
  fahrzeuge: Fahrzeugauswahl[] | null;
  beiFertig: () => void;
  beiAbbruch: () => void;
  beiFehler: (f: string) => void;
}) {
  const [datum, setDatum] = useState(heute());
  const [km, setKm] = useState(letzte?.kmEinfach ? String(letzte.kmEinfach) : "");
  const [hinRetour, setHinRetour] = useState(letzte?.hinRetour ?? true);
  const [fahrzeug, setFahrzeug] = useState(letzte?.fahrzeug ?? "");
  const [notiz, setNotiz] = useState("");
  const [laeuft, setLaeuft] = useState(false);

  // Das eigene Fahrzeug vorwählen, wenn es eines gibt und noch nichts
  // gewählt ist.
  useEffect(() => {
    if (fahrzeug || !fahrzeuge?.length) return;
    void eigenerMitarbeiter()
      .then((ich) => {
        const meins = ich ? fahrzeuge.find((f) => f.mitarbeiter === ich.id) : undefined;
        if (meins) setFahrzeug(meins.id);
      })
      .catch(() => undefined);
  }, [fahrzeuge, fahrzeug]);

  const zahl = Number(km.replace(",", "."));

  async function absenden(e: FormEvent) {
    e.preventDefault();
    setLaeuft(true);
    try {
      const fz = fahrzeuge?.find((f) => f.id === fahrzeug);
      await fahrtAnlegen({
        auftrag: auftragId,
        datum,
        kmEinfach: zahl,
        hinRetour,
        fahrzeug: fz?.id ?? "",
        kennzeichen: fz?.kennzeichen ?? "",
        notiz,
      });
      beiFertig();
    } catch (e: unknown) {
      beiFehler(fehlersatz(e));
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <form className="wb-maske" onSubmit={absenden}>
      <label className="wb-feld">
        <span>Datum</span>
        <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} required />
      </label>

      <label className="wb-feld">
        <span>Strecke einfach (km)</span>
        <input
          type="text"
          inputMode="numeric"
          value={km}
          onChange={(e) => setKm(e.target.value)}
          placeholder="42"
          required
        />
      </label>

      <label className="wb-schalter wb-feld">
        <input type="checkbox" checked={hinRetour} onChange={(e) => setHinRetour(e.target.checked)} />
        <span>
          Hin und retour
          {Number.isFinite(zahl) && zahl > 0 && <small> — {kmGesamt({ kmEinfach: zahl, hinRetour })} km</small>}
        </span>
      </label>

      {fahrzeuge && fahrzeuge.length > 0 && (
        <label className="wb-feld">
          <span>Fahrzeug</span>
          <select value={fahrzeug} onChange={(e) => setFahrzeug(e.target.value)}>
            <option value="">ohne</option>
            {fahrzeuge.map((f) => (
              <option key={f.id} value={f.id}>
                {f.kennzeichen} · {f.bezeichnung}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="wb-feld wb-feld--breit">
        <span>Notiz</span>
        <input
          type="text"
          value={notiz}
          onChange={(e) => setNotiz(e.target.value)}
          placeholder="z. B. Material beim Großhändler geholt"
        />
      </label>

      <div className="wb-aktionen wb-feld--breit">
        <button
          className="wb-button"
          type="submit"
          disabled={laeuft || !Number.isFinite(zahl) || zahl <= 0}
        >
          {laeuft ? "Wird gespeichert …" : "Fahrt festhalten"}
        </button>
        <button className="wb-button wb-button--sekundaer" type="button" onClick={beiAbbruch}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}
