import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { darfSchreiben, dienst, fehlersatz } from "@werkboq/core";
import { hinweise, type Hinweis } from "../daten/rechnen";
import { heute, pauschaleVerrechnen, wartungAnlegen, type Vertrag } from "../daten/vertraege";

const KURZ: Record<Hinweis["art"], string> = {
  wartung: "Wartung",
  rechnung: "Pauschale",
  kuendigung: "Kündigungsfrist",
  preis: "Preis prüfen",
  ablauf: "Abgelaufen",
};

const FARBE: Record<Hinweis["art"], string> = {
  wartung: "info",
  rechnung: "warn",
  kuendigung: "warn",
  preis: "neutral",
  ablauf: "fehler",
};

function datum(t: string | null): string {
  return t ? new Date(`${t}T00:00:00`).toLocaleDateString("de-AT") : "";
}

function wann(h: Hinweis): string {
  if (h.tage === null) return h.tag ? `seit ${datum(h.tag)}` : "";
  if (h.tage === 0) return "heute";
  if (h.tage < 0) return `seit ${-h.tage} ${h.tage === -1 ? "Tag" : "Tagen"} (${datum(h.tag)})`;
  return `in ${h.tage} ${h.tage === 1 ? "Tag" : "Tagen"} (${datum(h.tag)})`;
}

/**
 * Was bei einem oder mehreren Verträgen ansteht — mit dem Knopf, der es
 * erledigt. Eine Erinnerung ohne Knopf ist eine Aufgabe mehr; eine mit
 * Knopf ist in zwei Sekunden weg.
 */
export function Hinweisliste({
  vertraege,
  mitName = true,
  ohnePreis = false,
  beiAenderung,
}: {
  vertraege: Vertrag[];
  mitName?: boolean;
  /** Die Preisprüfung weglassen — auf der Startseite ist sie nicht dringend genug. */
  ohnePreis?: boolean;
  beiAenderung: () => void;
}) {
  const navigate = useNavigate();
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [erledigt, setErledigt] = useState<string | null>(null);
  const darf = darfSchreiben("buchhaltung");
  const mitVerrechnung = Boolean(dienst("belegentwurf"));
  const stichtag = heute();

  const zeilen = vertraege
    .flatMap((v) => hinweise(v, stichtag).filter((h) => !ohnePreis || h.art !== "preis").map((h) => ({ v, h })))
    .sort((a, b) => Number(b.h.dringend) - Number(a.h.dringend) || (a.h.tage ?? 9999) - (b.h.tage ?? 9999));

  async function tu(schluessel: string, was: () => Promise<string>) {
    setLaeuft(schluessel);
    setFehler(null);
    try {
      setErledigt(await was());
      beiAenderung();
    } catch (e: unknown) {
      setFehler(fehlersatz(e));
    } finally {
      setLaeuft(null);
    }
  }

  if (!zeilen.length) return <p className="wb-leer">Nichts fällig.</p>;

  return (
    <>
      {erledigt && <p className="wb-hinweis" role="status">{erledigt}</p>}
      {fehler && <p className="wb-fehler" role="alert">{fehler}</p>}
      <ul className="wb-fristenliste">
        {zeilen.map(({ v, h }) => {
          const schluessel = `${v.id}-${h.art}`;
          return (
            <li key={schluessel}>
              <span className={`wb-plakette wb-plakette--${h.dringend ? "fehler" : FARBE[h.art]}`}>{KURZ[h.art]}</span>
              <span className="wb-fristenliste__was">
                {mitName ? (
                  <Link to={`/vertraege/${v.id}`}>
                    <strong>{v.expand?.kunde?.name ?? v.nummer}</strong> <span>{h.text}</span>
                  </Link>
                ) : (
                  <span>{h.text}</span>
                )}
              </span>
              <span className="wb-fristenliste__wann">{wann(h)}</span>
              {darf && h.art === "wartung" && (
                <button
                  type="button"
                  className="wb-button wb-button--klein"
                  disabled={laeuft !== null}
                  onClick={() =>
                    void tu(schluessel, async () => {
                      const { auftragId } = await wartungAnlegen(v);
                      navigate(`/auftraege/${auftragId}`);
                      return "Wartungsauftrag angelegt.";
                    })
                  }
                >
                  Auftrag anlegen
                </button>
              )}
              {darf && h.art === "rechnung" && mitVerrechnung && (
                <button
                  type="button"
                  className="wb-button wb-button--klein"
                  disabled={laeuft !== null}
                  onClick={() =>
                    void tu(schluessel, async () => {
                      const { belegId } = await pauschaleVerrechnen(v);
                      navigate(`/belege/${belegId}`);
                      return "Rechnungsentwurf angelegt.";
                    })
                  }
                >
                  Rechnung anlegen
                </button>
              )}
              {(h.art === "kuendigung" || h.art === "preis" || h.art === "ablauf") && mitName && (
                <Link className="wb-button wb-button--sekundaer wb-button--klein" to={`/vertraege/${v.id}`}>
                  Öffnen
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
