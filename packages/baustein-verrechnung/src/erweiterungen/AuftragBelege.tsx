import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  aktuellerRechtsraum,
  alsEuro,
  Auftragskachel,
  auftragLaden,
  betriebLaden,
  dienst,
  fahrtkostenZeile,
  fehlersatz,
  kundeLaden,
  schreibweiseVon,
  Symbol,
  type ErweiterungsProps,
  type UstSatz,
} from "@werkboq/core";
import {
  anschriftVon,
  BELEGART_TEXT,
  belegAnlegen,
  belegeSuchen,
  heute,
  LEERER_BELEG,
  naechsteBelegnummer,
  STATUS_FARBE,
  STATUS_TEXT,
  type Beleg,
  type Belegart,
  type BelegpositionEingabe,
} from "../daten/belege";

/**
 * Belege am Auftrag.
 *
 * Hängt an "auftrag.abschnitt" und ist die Stelle, an der aus getaner Arbeit
 * ein Beleg wird: Positionen und Stunden werden übernommen, der Rest ist
 * Kopfdaten. Beides holt sich dieser Baustein über Dienste — ohne Material
 * gibt es keine Positionen zu übernehmen, ohne Zeiterfassung keine Stunden,
 * und in beiden Fällen kann man die Zeilen von Hand schreiben.
 */
export function AuftragBelege({ datensatzId }: ErweiterungsProps) {
  const navigate = useNavigate();
  const sw = schreibweiseVon(aktuellerRechtsraum().id);
  const [belege, setBelege] = useState<Beleg[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  /** Vom Monteur erfasst, noch nicht freigegeben — kommt nicht auf den Beleg. */
  const [offen, setOffen] = useState(0);

  const laden = useCallback(() => {
    if (!datensatzId) return;
    belegeSuchen({})
      .then((alle) => setBelege(alle.filter((b) => b.auftrag === datensatzId)))
      .catch((e: unknown) => setFehler(fehlersatz(e)));
    // Zurückgehaltene Positionen zählen. Ohne den Baustein Material
    // antwortet niemand, dann gibt es auch nichts zurückzuhalten.
    void dienst("auftragspositionen")?.(datensatzId)
      .then((p) => setOffen(p.offeneVorschlaege))
      .catch(() => setOffen(0));
  }, [datensatzId]);

  useEffect(laden, [laden]);

  if (!datensatzId) return null;

  /**
   * Erzeugt einen Entwurf aus allem, was am Auftrag hängt.
   *
   * Positionen kommen als Zeilen, wie sie sind. Die Stunden werden zu einer
   * einzigen Zeile zusammengefasst — eine Rechnung mit vierzig Einzelzeilen
   * "Arbeitszeit 3,5 h" liest niemand gern, und die Aufzeichnung dahinter
   * bleibt in der Zeiterfassung nachvollziehbar.
   */
  async function erzeugen(art: Belegart) {
    if (!datensatzId) return;
    setLaeuft(true);
    setFehler(null);
    try {
      const auftrag = await auftragLaden(datensatzId);
      const kunde = await kundeLaden(auftrag.kunde);
      const betrieb = await betriebLaden();

      const zeilen: BelegpositionEingabe[] = [];
      let pos = 10;

      const positionen = await dienst("auftragspositionen")?.(datensatzId);

      // Hier und nicht früher: der Kasten oben ist ein Schnappschuss vom
      // Laden der Seite, aber verbindlich wird es in dieser Sekunde. Wer
      // eine Rechnung mit fehlendem Material festschreibt, schreibt einen
      // Verlust fest — dann lieber einmal nachfragen.
      const zurueckgehalten = positionen?.offeneVorschlaege ?? 0;
      if (zurueckgehalten > 0) {
        const weiter = confirm(
          `${zurueckgehalten === 1 ? "Eine Position ist" : `${zurueckgehalten} Positionen sind`} ` +
            `von der Baustelle erfasst und noch nicht freigegeben. ` +
            `${zurueckgehalten === 1 ? "Sie kommt" : "Sie kommen"} nicht auf diesen Beleg.\n\n` +
            `Trotzdem fortfahren?`,
        );
        if (!weiter) {
          setLaeuft(false);
          return;
        }
      }

      for (const p of positionen?.positionen ?? []) {
        zeilen.push({
          pos,
          art: p.art,
          bezeichnung: p.bezeichnung,
          beschreibung: p.beschreibung,
          menge: p.menge,
          einheit: p.einheit,
          einzelpreis: p.einzelpreis,
          rabatt: p.rabatt,
          ustsatz: p.ustsatz as UstSatz,
          quelle: p.quelle,
        });
        pos += 10;
      }

      const stunden = await dienst("auftragsstunden")?.(datensatzId);
      const satz = betrieb?.stundensatz ?? 0;
      if (stunden && stunden.verrechenbar > 0) {
        zeilen.push({
          pos,
          art: "leistung",
          bezeichnung: "Arbeitszeit laut Aufzeichnung",
          beschreibung:
            satz > 0 ? "" : "Stundensatz unter Einstellungen → Betrieb hinterlegen",
          menge: Math.round((stunden.verrechenbar / 60) * 100) / 100,
          einheit: "h",
          einzelpreis: satz,
          rabatt: 0,
          ustsatz: aktuellerRechtsraum().normalsatz,
          quelle: "zeiterfassung",
        });
        // Bis September 2026 war das die letzte Zeile, und die Nummer wurde
        // danach nicht weitergezählt. Mit den Fahrten dahinter bekäme sonst
        // die Fahrtzeile dieselbe Positionsnummer wie die Stunden.
        pos += 10;
      }

      // Fahrten: ob und wie sie auf den Beleg kommen, entscheidet der
      // Betrieb in den Stammdaten — km × Satz, Pauschale je Fahrt oder gar
      // nicht. Die Rechnung dazu steht in fahrtkostenZeile() im Kern.
      const fahrten = await dienst("auftragsfahrten")?.(datensatzId);
      const fahrtzeile = fahrten ? fahrtkostenZeile(betrieb, fahrten) : null;
      if (fahrtzeile) {
        zeilen.push({
          pos,
          art: "leistung",
          ...fahrtzeile,
          rabatt: 0,
          ustsatz: aktuellerRechtsraum().normalsatz,
          quelle: "fahrten",
        });
        pos += 10;
      }

      const nummer = await naechsteBelegnummer(art);
      const beleg = await belegAnlegen(
        {
          ...LEERER_BELEG,
          belegart: art,
          nummer,
          kunde: auftrag.kunde,
          auftrag: datensatzId,
          datum: heute(),
          leistungVon: auftrag.beginn?.slice(0, 10) || heute(),
          leistungBis: auftrag.ende?.slice(0, 10) || heute(),
          empfaengerName: kunde.name,
          empfaengerAnschrift: anschriftVon(kunde),
          empfaengerUid: kunde.uid ?? "",
          // Bauleistung nur vorschlagen, wenn der Empfänger Unternehmer ist.
          // Ob es tatsächlich eine Bauleistung ist, entscheidet kein Programm.
          steuerfrei: "keiner",
          kopftext: `Auftrag ${auftrag.nummer} — ${auftrag.titel}`,
        },
        zeilen,
      );
      navigate(`/belege/${beleg.id}`);
    } catch (e: unknown) {
      setFehler(fehlersatz(e, { nummer: "Diese Belegnummer ist schon vergeben — bitte erneut versuchen." }));
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <section className="wb-block">
      <div className="wb-block__kopf">
        <h2>Belege</h2>
        <div className="wb-aktionen">
          <button
            className="wb-button wb-button--sekundaer"
            type="button"
            disabled={laeuft}
            onClick={() => void erzeugen("angebot")}
          >
            Angebot
          </button>
          <button
            className="wb-button"
            type="button"
            disabled={laeuft}
            onClick={() => void erzeugen("rechnung")}
          >
            <Symbol name="beleg" groesse={18} />
            Rechnung
          </button>
        </div>
      </div>

      {fehler && (
        <p className="wb-fehler" role="alert">
          {fehler}
        </p>
      )}

      {offen > 0 && (
        <div className="wb-warnkasten">
          <Symbol name="warnung" groesse={18} />
          <div>
            <strong>
              {offen === 1
                ? "Eine Position wartet auf Freigabe"
                : `${offen} Positionen warten auf Freigabe`}
            </strong>
            <p>
              Von der Baustelle erfasst und noch nicht geprüft. Was hier steht, kommt{" "}
              <strong>nicht</strong> auf den Beleg — erst freigeben, dann verrechnen. Der Block
              „Positionen" weiter oben zeigt sie.
            </p>
          </div>
        </div>
      )}

      {belege.length === 0 ? (
        <p className="wb-leer">
          Noch kein Beleg. Ein Klick übernimmt die Positionen und die verrechenbaren Stunden in
          einen Entwurf — geändert wird danach am Beleg, nicht am Auftrag.
        </p>
      ) : (
        <div className="wb-tabelle-rahmen">
          <table className="wb-tabelle">
            <thead>
              <tr>
                <th scope="col">Nummer</th>
                <th scope="col">Art</th>
                <th scope="col">Datum</th>
                <th scope="col">Status</th>
                <th scope="col" className="wb-zelle--rechts">Netto</th>
                <th scope="col" className="wb-zelle--rechts">Brutto</th>
              </tr>
            </thead>
            <tbody>
              {belege.map((b) => (
                <tr key={b.id} onClick={() => navigate(`/belege/${b.id}`)} className="ist-klickbar">
                  <td className="wb-tabelle__kennung">{b.nummer}</td>
                  <td>{BELEGART_TEXT[b.belegart]}</td>
                  <td className="wb-tabelle__kennung">
                    {new Date(b.datum).toLocaleDateString("de-AT")}
                  </td>
                  <td>
                    <span className={`wb-plakette wb-plakette--${STATUS_FARBE[b.status]}`}>
                      {STATUS_TEXT[b.status]}
                    </span>
                  </td>
                  <td className="wb-zelle--rechts wb-tabelle__kennung">{alsEuro(b.netto, sw)}</td>
                  <td className="wb-zelle--rechts wb-tabelle__kennung wb-zelle--betont">
                    {alsEuro(b.brutto, sw)}
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

/**
 * Kachel im Überblick: wie viele Belege, und ob eine Rechnung offen ist.
 *
 * „Offen" heißt hier: festgeschrieben und noch nicht bezahlt. Ein Entwurf
 * ist noch keine Forderung und zählt deshalb nicht als offen.
 */
export function BelegKachel({ datensatzId }: ErweiterungsProps) {
  const [belege, setBelege] = useState<Beleg[] | null>(null);

  useEffect(() => {
    if (!datensatzId) return;
    belegeSuchen({})
      .then((alle) => setBelege(alle.filter((b) => b.auftrag === datensatzId)))
      .catch(() => setBelege([]));
  }, [datensatzId]);

  if (!datensatzId || belege === null) return null;
  const offen = belege.filter((b) => b.belegart === "rechnung" && b.status === "offen").length;
  const entwuerfe = belege.filter((b) => b.status === "entwurf").length;

  return (
    <Auftragskachel
      auftragId={datensatzId}
      reiter="abrechnung"
      titel="Belege"
      wert={String(belege.length)}
      zusatz={
        offen
          ? `${offen} Rechnung${offen === 1 ? "" : "en"} offen`
          : entwuerfe
            ? `${entwuerfe} Entwurf${entwuerfe === 1 ? "" : "e"}`
            : belege.length
              ? "nichts offen"
              : "noch keiner"
      }
      achtung={offen > 0 || entwuerfe > 0}
    />
  );
}
