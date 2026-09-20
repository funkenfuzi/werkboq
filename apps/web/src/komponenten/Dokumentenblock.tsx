import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  dateiAdresse,
  dokumenteZuAuftrag,
  dokumentHochladen,
  dokumentLoeschen,
  DOKUMENTARTEN_AUFTRAG,
  fehlersatz,
  Symbol,
  type Dokument,
} from "@werkboq/core";

/**
 * Dokumente am Auftrag: Pläne, Datenblätter, Lieferscheine, Schriftverkehr.
 *
 * Getrennt von den Fotos, obwohl beides Dateien sind. Ein Foto will man
 * sehen, ein Dokument öffnen; ein Foto entsteht am Handy, ein Dokument kommt
 * per Mail. In einer gemeinsamen Liste wäre die Galerie voller grauer
 * PDF-Kacheln und die Dokumentenliste voller Vorschaubilder.
 *
 * Der Titel wird aus dem Dateinamen vorbelegt. „Angebot_Elektro_final_v3.pdf"
 * ist kein schöner Titel, aber besser als ein leeres Pflichtfeld zwischen
 * dem Anwender und dem Ablegen.
 */
export function Dokumentenblock({ auftragId }: { auftragId: string }) {
  const [liste, setListe] = useState<Dokument[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [maske, setMaske] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(() => {
    setLaedt(true);
    dokumenteZuAuftrag(auftragId)
      .then(setListe)
      .catch((e: unknown) => setFehler(fehlersatz(e)))
      .finally(() => setLaedt(false));
  }, [auftragId]);

  useEffect(laden, [laden]);

  return (
    <section className="wb-block">
      <div className="wb-block__kopf">
        <h2>Dokumente</h2>
        <span className="wb-block__summe">{liste.length}</span>
        {!maske && (
          <button className="wb-button" type="button" onClick={() => setMaske(true)}>
            <Symbol name="plus" groesse={18} />
            Ablegen
          </button>
        )}
      </div>

      {fehler && (
        <p className="wb-fehler" role="alert">
          {fehler}
        </p>
      )}

      {maske && (
        <Ablagemaske
          auftragId={auftragId}
          beiAbgelegt={() => {
            setMaske(false);
            laden();
          }}
          beiAbbruch={() => setMaske(false)}
          beiFehler={setFehler}
        />
      )}

      {laedt && liste.length === 0 && <p className="wb-leer">Wird geladen …</p>}
      {!laedt && liste.length === 0 && !maske && (
        <p className="wb-leer">Noch nichts abgelegt.</p>
      )}

      {liste.length > 0 && (
        <ul className="wb-dateiliste">
          {liste.map((d) => (
            <li key={d.id}>
              <a href={dateiAdresse(d)} target="_blank" rel="noreferrer">
                <Symbol name="beleg" groesse={18} />
                <span>
                  {d.titel}
                  <small>
                    {[d.art, d.modul && `aus ${d.modul}`, d.datei.split(".").pop()?.toUpperCase()]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                </span>
              </a>
              <button
                type="button"
                className="wb-zeilenknopf"
                title={`${d.titel} löschen`}
                onClick={() => {
                  if (!confirm(`"${d.titel}" löschen?`)) return;
                  void dokumentLoeschen(d)
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

function Ablagemaske({
  auftragId,
  beiAbgelegt,
  beiAbbruch,
  beiFehler,
}: {
  auftragId: string;
  beiAbgelegt: () => void;
  beiAbbruch: () => void;
  beiFehler: (f: string) => void;
}) {
  const [datei, setDatei] = useState<File | null>(null);
  const [titel, setTitel] = useState("");
  const [art, setArt] = useState<string>(DOKUMENTARTEN_AUFTRAG[0]);
  const [laeuft, setLaeuft] = useState(false);
  const feld = useRef<HTMLInputElement>(null);

  /** Der Dateiname ohne Endung ist ein brauchbarer Titelvorschlag. */
  function gewaehlt(dateien: FileList | null) {
    const d = dateien?.[0] ?? null;
    setDatei(d);
    if (d && !titel.trim()) setTitel(d.name.replace(/\.[^.]+$/, ""));
  }

  async function absenden(e: FormEvent) {
    e.preventDefault();
    if (!datei) return;
    setLaeuft(true);
    try {
      await dokumentHochladen(auftragId, datei, titel, art);
      beiAbgelegt();
    } catch (e: unknown) {
      beiFehler(fehlersatz(e));
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <form className="wb-maske" onSubmit={absenden}>
      <label className="wb-feld wb-feld--breit">
        <span>Datei *</span>
        <input ref={feld} type="file" onChange={(e) => gewaehlt(e.target.files)} required />
      </label>

      <label className="wb-feld wb-feld--breit">
        <span>Titel</span>
        <input
          type="text"
          value={titel}
          placeholder="wird aus dem Dateinamen übernommen"
          onChange={(e) => setTitel(e.target.value)}
        />
      </label>

      <label className="wb-feld">
        <span>Art</span>
        <select value={art} onChange={(e) => setArt(e.target.value)}>
          {DOKUMENTARTEN_AUFTRAG.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </label>

      <div className="wb-aktionen wb-feld--breit">
        <button className="wb-button" type="submit" disabled={laeuft || !datei}>
          {laeuft ? "Wird geladen …" : "Ablegen"}
        </button>
        <button className="wb-button wb-button--sekundaer" type="button" onClick={beiAbbruch}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}
