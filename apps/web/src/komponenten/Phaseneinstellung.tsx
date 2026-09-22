import { useEffect, useState } from "react";
import {
  AUFTRAGSART_HINWEIS,
  AUFTRAGSART_TEXT,
  AUFTRAGSARTEN,
  betriebLaden,
  betriebSpeichern,
  fehlersatz,
  PFLICHTSTUFEN,
  PHASEN_VORGABE,
  phasenDerArt,
  phasenEinstellen,
  PHASENSTUFE_TEXT,
  PHASENSTUFEN,
  type Auftragsart,
  type Betrieb,
  type Phase,
  type Phaseneinstellung as Einstellung,
  type Phasenstufe,
} from "@werkboq/core";

/**
 * Phasen je Auftragsart umbenennen und ausblenden.
 *
 * Was man hier NICHT kann, und warum: eigene Phasen erfinden oder die
 * Reihenfolge ändern. Unter jeder Phase liegt eine Stufe des festen
 * Gerüsts, und an den Stufen hängt Verhalten — „Verrechnen" löst die
 * Rechnungswarnung aus, „Abgeschlossen" wird im Brett eingeklappt. Eine
 * frei erfundene Phase wüsste nicht, was sie bedeutet.
 *
 * „Verrechnen" und „Abgeschlossen" lassen sich umbenennen, aber nicht
 * ausblenden: ohne sie gäbe es keinen Ort, an dem ein fertiger, aber nicht
 * verrechneter Auftrag auffällt.
 */

interface Zeile {
  stufe: Phasenstufe;
  an: boolean;
  text: string;
}

function zeilenAus(art: Auftragsart): Zeile[] {
  const eingestellt = phasenDerArt(art);
  return PHASENSTUFEN.map((stufe) => {
    const p = eingestellt.find((x) => x.stufe === stufe);
    return { stufe, an: Boolean(p), text: p?.text ?? "" };
  });
}

function vorgabeText(art: Auftragsart, stufe: Phasenstufe): string {
  return PHASEN_VORGABE[art].find((p) => p.stufe === stufe)?.text ?? PHASENSTUFE_TEXT[stufe];
}

function alsPhasen(art: Auftragsart, zeilen: Zeile[]): Phase[] {
  return zeilen
    .filter((z) => z.an || PFLICHTSTUFEN.includes(z.stufe))
    .map((z) => ({ stufe: z.stufe, text: z.text.trim() || vorgabeText(art, z.stufe) }));
}

function gleichVorgabe(art: Auftragsart, phasen: Phase[]): boolean {
  const v = PHASEN_VORGABE[art];
  return v.length === phasen.length && v.every((p, i) => p.stufe === phasen[i]!.stufe && p.text === phasen[i]!.text);
}

export function Phaseneinstellung() {
  const [betrieb, setBetrieb] = useState<Betrieb | null>(null);
  const [zeilen, setZeilen] = useState<Record<Auftragsart, Zeile[]> | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    betriebLaden()
      .then((b) => {
        setBetrieb(b);
        // Frisch vom Server, nicht aus dem Stand beim Start — ein anderer
        // Rechner könnte inzwischen umbenannt haben.
        phasenEinstellen(b?.phasen);
        setZeilen(
          Object.fromEntries(AUFTRAGSARTEN.map((a) => [a, zeilenAus(a)])) as Record<Auftragsart, Zeile[]>,
        );
      })
      .catch((e: unknown) => setFehler(fehlersatz(e)));
  }, []);

  if (fehler && !zeilen) return <p className="wb-fehler" role="alert">{fehler}</p>;
  if (!zeilen) return <p className="wb-leer">Wird geladen …</p>;
  if (!betrieb) return <p className="wb-leer">Es gibt noch keinen Betriebsdatensatz.</p>;

  function aendern(art: Auftragsart, stufe: Phasenstufe, teil: Partial<Zeile>) {
    setHinweis(null);
    setZeilen((z) =>
      z ? { ...z, [art]: z[art].map((x) => (x.stufe === stufe ? { ...x, ...teil } : x)) } : z,
    );
  }

  function zuruecksetzen(art: Auftragsart) {
    setHinweis(null);
    setZeilen((z) =>
      z
        ? {
            ...z,
            [art]: PHASENSTUFEN.map((stufe) => {
              const p = PHASEN_VORGABE[art].find((x) => x.stufe === stufe);
              return { stufe, an: Boolean(p), text: p?.text ?? "" };
            }),
          }
        : z,
    );
  }

  async function speichern() {
    if (!betrieb || !zeilen) return;
    setLaeuft(true);
    try {
      // Nur speichern, was von der Vorgabe abweicht. Dann bekommt ein
      // Betrieb, der nichts geändert hat, spätere Verbesserungen der
      // Vorgabe mit, statt auf dem Stand von heute festzusitzen.
      const neu: Einstellung = {};
      for (const art of AUFTRAGSARTEN) {
        const phasen = alsPhasen(art, zeilen[art]);
        if (!gleichVorgabe(art, phasen)) neu[art] = phasen;
      }
      await betriebSpeichern(betrieb.id, { phasen: neu }, "Phasen der Auftragsarten geändert");
      const sauber = phasenEinstellen(neu);
      setBetrieb({ ...betrieb, phasen: sauber });
      setZeilen(
        Object.fromEntries(AUFTRAGSARTEN.map((a) => [a, zeilenAus(a)])) as Record<Auftragsart, Zeile[]>,
      );
      setHinweis("Gespeichert. Die neuen Namen gelten sofort, auch im Phasenbrett.");
      setFehler(null);
    } catch (e: unknown) {
      setFehler(fehlersatz(e));
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <div className="wb-phaseneinstellung">
      <p className="wb-leer">
        Jede Auftragsart hat ihre eigenen Phasen. Hier lassen sie sich so nennen, wie ihr sie im
        Betrieb nennt, und ausblenden, was ihr nicht braucht. Die Reihenfolge ist fest.
        „Verrechnen" und „Abgeschlossen" bleiben immer — daran hängt die Warnung vor
        vergessenen Rechnungen.
      </p>
      <p className="wb-leer">
        Ein Auftrag, der gerade in einer ausgeblendeten Phase steht, bleibt dort und zeigt sie
        weiter an, bis er weiterwandert.
      </p>

      <div className="wb-phasenkarten">
        {AUFTRAGSARTEN.map((art) => {
          const geaendert = !gleichVorgabe(art, alsPhasen(art, zeilen[art]));
          return (
            <section key={art} className="wb-block">
              <div className="wb-block__kopf">
                <h2>{AUFTRAGSART_TEXT[art]}</h2>
                <small className="wb-zelle--gedaempft">{AUFTRAGSART_HINWEIS[art]}</small>
              </div>
              <ol className="wb-phasenzeilen">
                {zeilen[art].map((z) => {
                  const pflicht = PFLICHTSTUFEN.includes(z.stufe);
                  const an = z.an || pflicht;
                  return (
                    <li key={z.stufe} className={an ? "" : "ist-aus"}>
                      <input
                        type="checkbox"
                        checked={an}
                        disabled={pflicht}
                        onChange={(e) => aendern(art, z.stufe, { an: e.target.checked })}
                        aria-label={`${PHASENSTUFE_TEXT[z.stufe]} bei ${AUFTRAGSART_TEXT[art]} verwenden`}
                        title={pflicht ? "Lässt sich nicht ausblenden" : undefined}
                      />
                      <input
                        type="text"
                        value={z.text}
                        disabled={!an}
                        placeholder={vorgabeText(art, z.stufe)}
                        maxLength={30}
                        onChange={(e) => aendern(art, z.stufe, { text: e.target.value })}
                        aria-label={`Name der Stufe ${PHASENSTUFE_TEXT[z.stufe]}`}
                      />
                      {/* Die Stufe darunter nur nennen, wenn der Name davon abweicht —
                          „Verrechnen · Verrechnen" sagt nichts. */}
                      <span className="wb-phasenzeilen__stufe">
                        {(z.text.trim() || vorgabeText(art, z.stufe)) !== PHASENSTUFE_TEXT[z.stufe]
                          ? PHASENSTUFE_TEXT[z.stufe]
                          : ""}
                      </span>
                    </li>
                  );
                })}
              </ol>
              {geaendert && (
                <button
                  type="button"
                  className="wb-button wb-button--sekundaer"
                  onClick={() => zuruecksetzen(art)}
                >
                  Voreinstellung
                </button>
              )}
            </section>
          );
        })}
      </div>

      {fehler && <p className="wb-fehler" role="alert">{fehler}</p>}
      {hinweis && <p className="wb-hinweis" role="status">{hinweis}</p>}
      <div className="wb-aktionen">
        <button className="wb-button" type="button" disabled={laeuft} onClick={() => void speichern()}>
          {laeuft ? "Wird gespeichert …" : "Phasen speichern"}
        </button>
      </div>
    </div>
  );
}
