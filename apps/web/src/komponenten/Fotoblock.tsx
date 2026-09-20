import { useCallback, useEffect, useRef, useState } from "react";
import {
  fehlersatz,
  fotoBeschriften,
  fotoHochladen,
  fotoLoeschen,
  fotosZuAuftrag,
  dateiAdresse,
  Symbol,
  vorschauAdresse,
  type Foto,
} from "@werkboq/core";

/**
 * Fotos einer Baustelle.
 *
 * DIE WICHTIGSTE SCHALTFLÄCHE IM GANZEN PROGRAMM steht hier oben, und sie
 * heißt „Foto aufnehmen". Auf dem Handy öffnet `capture="environment"`
 * direkt die Kamera statt eines Dateiwählers — ein Griff, kein Formular. Die
 * Beschreibung kommt danach, wenn überhaupt: ein Bild ohne Text ist
 * hundertmal mehr wert als ein Bild, das nie gemacht wurde, weil erst ein
 * Pflichtfeld auszufüllen war.
 *
 * Mehrere Fotos auf einmal gehen auch — nach dem Verputzen steht man vor
 * einem Raum und knipst sechsmal.
 */
export function Fotoblock({ auftragId }: { auftragId: string }) {
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [laeuft, setLaeuft] = useState(0);
  const [fehler, setFehler] = useState<string | null>(null);
  const [gross, setGross] = useState<Foto | null>(null);
  const kamera = useRef<HTMLInputElement>(null);
  const dateiwahl = useRef<HTMLInputElement>(null);

  const laden = useCallback(() => {
    setLaedt(true);
    fotosZuAuftrag(auftragId)
      .then(setFotos)
      .catch((e: unknown) => setFehler(fehlersatz(e)))
      .finally(() => setLaedt(false));
  }, [auftragId]);

  useEffect(laden, [laden]);

  async function aufnehmen(dateien: FileList | null) {
    if (!dateien || dateien.length === 0) return;
    setFehler(null);
    setLaeuft(dateien.length);
    let misslungen = 0;
    for (const datei of Array.from(dateien)) {
      try {
        await fotoHochladen(auftragId, datei);
      } catch (e: unknown) {
        misslungen += 1;
        setFehler(fehlersatz(e));
      }
      setLaeuft((n) => n - 1);
    }
    // Auch bei Teilerfolg neu laden: was durchging, soll sichtbar sein.
    if (misslungen < dateien.length) laden();
    setLaeuft(0);
    if (kamera.current) kamera.current.value = "";
    if (dateiwahl.current) dateiwahl.current.value = "";
  }

  return (
    <section className="wb-block">
      <div className="wb-block__kopf">
        <h2>Fotos</h2>
        <span className="wb-block__summe">{fotos.length}</span>

        <input
          ref={kamera}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="wb-verborgen"
          onChange={(e) => void aufnehmen(e.target.files)}
        />
        <input
          ref={dateiwahl}
          type="file"
          accept="image/*"
          multiple
          className="wb-verborgen"
          onChange={(e) => void aufnehmen(e.target.files)}
        />

        <button
          className="wb-button"
          type="button"
          disabled={laeuft > 0}
          onClick={() => kamera.current?.click()}
        >
          <Symbol name="kamera" groesse={18} />
          {laeuft > 0 ? `${laeuft} wird geladen …` : "Foto aufnehmen"}
        </button>
        <button
          className="wb-button wb-button--sekundaer"
          type="button"
          disabled={laeuft > 0}
          onClick={() => dateiwahl.current?.click()}
        >
          Aus Galerie
        </button>
      </div>

      {fehler && (
        <p className="wb-fehler" role="alert">
          {fehler}
        </p>
      )}

      {laedt && fotos.length === 0 && <p className="wb-leer">Wird geladen …</p>}

      {!laedt && fotos.length === 0 && (
        <p className="wb-leer">
          Noch keine Fotos. Der beste Zeitpunkt ist, bevor die Wand zugeht — was dann noch
          sichtbar ist, weiß in zwei Jahren niemand mehr.
        </p>
      )}

      {fotos.length > 0 && (
        <ul className="wb-galerie">
          {fotos.map((f) => (
            <li key={f.id} className="wb-galerie__bild">
              <button
                type="button"
                className="wb-galerie__knopf"
                onClick={() => setGross(f)}
                aria-label={f.beschreibung || "Foto vergrößern"}
              >
                <img src={vorschauAdresse(f)} alt={f.beschreibung || ""} loading="lazy" />
              </button>
              <p className="wb-galerie__zeile">
                {f.aufgenommen
                  ? new Date(`${f.aufgenommen.slice(0, 10)}T00:00:00`).toLocaleDateString("de-AT")
                  : ""}
                {f.beschreibung && <span>{f.beschreibung}</span>}
              </p>
            </li>
          ))}
        </ul>
      )}

      {gross && (
        <Grossansicht
          foto={gross}
          beiSchliessen={() => setGross(null)}
          beiAenderung={() => {
            setGross(null);
            laden();
          }}
          beiFehler={setFehler}
        />
      )}
    </section>
  );
}

/**
 * Ein Foto groß, mit Beschriftung und Löschen.
 *
 * Bewusst kein `dialog`-Element mit `showModal`: das öffnet in manchen
 * mobilen Browsern eine Ebene, aus der die Zurück-Taste nicht herausführt,
 * und dann sitzt der Monteur fest.
 */
function Grossansicht({
  foto,
  beiSchliessen,
  beiAenderung,
  beiFehler,
}: {
  foto: Foto;
  beiSchliessen: () => void;
  beiAenderung: () => void;
  beiFehler: (f: string) => void;
}) {
  const [text, setText] = useState(foto.beschreibung ?? "");
  const [laeuft, setLaeuft] = useState(false);

  useEffect(() => {
    function taste(e: KeyboardEvent) {
      if (e.key === "Escape") beiSchliessen();
    }
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [beiSchliessen]);

  async function tu(was: () => Promise<void>) {
    setLaeuft(true);
    try {
      await was();
      beiAenderung();
    } catch (e: unknown) {
      beiFehler(fehlersatz(e));
      beiSchliessen();
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <div className="wb-bildschau" role="dialog" aria-modal="true" aria-label="Foto">
      <div className="wb-bildschau__hintergrund" onClick={beiSchliessen} aria-hidden="true" />
      <div className="wb-bildschau__inhalt">
        <img src={dateiAdresse(foto)} alt={foto.beschreibung || "Foto der Baustelle"} />

        <div className="wb-bildschau__leiste">
          <label className="wb-feld wb-feld--breit">
            <span>Beschreibung</span>
            <input
              type="text"
              value={text}
              placeholder="Leitungsführung Schlafzimmer, vor dem Verputzen"
              onChange={(e) => setText(e.target.value)}
            />
          </label>

          <div className="wb-aktionen">
            <button
              className="wb-button"
              type="button"
              disabled={laeuft || text === (foto.beschreibung ?? "")}
              onClick={() => void tu(() => fotoBeschriften(foto, text))}
            >
              Speichern
            </button>
            <a
              className="wb-button wb-button--sekundaer"
              href={dateiAdresse(foto)}
              target="_blank"
              rel="noreferrer"
            >
              Original
            </a>
            <button
              className="wb-button wb-button--sekundaer"
              type="button"
              onClick={beiSchliessen}
            >
              Schließen
            </button>
            <button
              className="wb-button wb-button--gefahr"
              type="button"
              disabled={laeuft}
              onClick={() => {
                if (!confirm("Foto löschen? Das lässt sich nicht rückgängig machen.")) return;
                void tu(() => fotoLoeschen(foto));
              }}
            >
              <Symbol name="muell" groesse={16} />
              Löschen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
