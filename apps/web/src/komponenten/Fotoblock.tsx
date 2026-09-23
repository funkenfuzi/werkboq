import { useCallback, useEffect, useRef, useState } from "react";
import {
  dokumentationsluecken,
  fehlersatz,
  fotoartVon,
  FOTOART_FARBE,
  FOTOART_HINWEIS,
  FOTOART_TEXT,
  FOTOARTEN,
  fotoBeschriften,
  fotoEinordnen,
  fotoHochladen,
  fotoLoeschen,
  fotosZuAuftrag,
  gepufferteFotos,
  beiDateiAenderung,
  gepufferteEntfernen,
  type GepufferteDatei,
  dateiAdresse,
  nachArt,
  Symbol,
  vorschauAdresse,
  type Foto,
  type Fotoart,
} from "@werkboq/core";

/**
 * Fotos einer Baustelle, nach Abschnitten.
 *
 * DIE EINORDNUNG WIRD VOR DEM AUSLÖSEN GEWÄHLT, NICHT DANACH.
 *
 * Das ist der ganze Unterschied. Ein Monteur, der zehn Bilder macht und
 * hinterher jedes einzeln einsortieren soll, sortiert keines ein — und ein
 * Foto ohne Einordnung beweist nichts: "da war ein Loch in der Wand" sagt
 * nicht, ob es vorher schon da war. Also steht oben, woran gerade
 * gearbeitet wird, und der Auslöser übernimmt das für jedes Bild dieser
 * Serie.
 *
 * Auf dem Handy öffnet `capture="environment"` direkt die Kamera. Die
 * Beschreibung kommt später, wenn überhaupt: ein Bild ohne Text ist
 * hundertmal mehr wert als eines, das nie gemacht wurde, weil erst ein
 * Pflichtfeld auszufüllen war.
 */
export function Fotoblock({ auftragId }: { auftragId: string }) {
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [art, setArt] = useState<Fotoart>("vorher");
  const [laedt, setLaedt] = useState(true);
  const [laeuft, setLaeuft] = useState(0);
  const [fehler, setFehler] = useState<string | null>(null);
  const [gross, setGross] = useState<Foto | null>(null);
  const [wartend, setWartend] = useState<GepufferteDatei[]>([]);
  const kamera = useRef<HTMLInputElement>(null);
  const dateiwahl = useRef<HTMLInputElement>(null);

  const wartendeLaden = useCallback(() => {
    void gepufferteFotos(auftragId).then(setWartend);
  }, [auftragId]);

  // Kommt das Netz zurück und werden Fotos nachgereicht, ändert sich die
  // Zahl im Puffer — dann beides neu laden, damit das Bild vom „wartet"-
  // Stapel in die richtige Gruppe wandert.
  useEffect(() => beiDateiAenderung(() => {
    wartendeLaden();
    if (navigator.onLine) laden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [wartendeLaden]);

  const laden = useCallback(() => {
    setLaedt(true);
    wartendeLaden();
    fotosZuAuftrag(auftragId)
      .then((liste) => {
        setFotos(liste);
        // Ist der Vorher-Abschnitt schon gefüllt, geht es beim nächsten Griff
        // vermutlich um das Ergebnis. Nur ein Vorschlag, umstellbar.
        const hat = (a: Fotoart) => liste.some((f) => fotoartVon(f) === a);
        if (hat("vorher") && !hat("nachher")) setArt("nachher");
      })
      // Ohne Netz keine Fehlermeldung über die ganze Breite: die schon
      // geladenen Bilder bleiben stehen, die neuen kommen in den Puffer.
      .catch((e: unknown) => {
        if (navigator.onLine) setFehler(fehlersatz(e));
      })
      .finally(() => setLaedt(false));
  }, [auftragId, wartendeLaden]);

  useEffect(laden, [laden]);

  async function aufnehmen(dateien: FileList | null) {
    if (!dateien || dateien.length === 0) return;
    setFehler(null);
    setLaeuft(dateien.length);
    let misslungen = 0;
    for (const datei of Array.from(dateien)) {
      try {
        const ergebnis = await fotoHochladen(auftragId, datei, art);
        if ("gepuffert" in ergebnis) wartendeLaden();
      } catch (e: unknown) {
        misslungen += 1;
        setFehler(fehlersatz(e));
      }
      setLaeuft((n) => n - 1);
    }
    if (misslungen < dateien.length) laden();
    setLaeuft(0);
    if (kamera.current) kamera.current.value = "";
    if (dateiwahl.current) dateiwahl.current.value = "";
  }

  const gruppen = nachArt(fotos);
  const luecken = dokumentationsluecken(fotos);

  return (
    <section className="wb-block">
      <div className="wb-block__kopf">
        <h2>Fotos</h2>
        <span className="wb-block__summe">{fotos.length}</span>
      </div>

      <div className="wb-aufnahme">
        <fieldset className="wb-aufnahme__wahl">
          <legend>Was wird aufgenommen?</legend>
          <div className="wb-aufnahme__arten">
            {FOTOARTEN.filter((a) => a !== "sonstiges").map((a) => (
              <label key={a} className={`wb-artwahl ${art === a ? "ist-aktiv" : ""}`}>
                <input
                  type="radio"
                  name="fotoart"
                  value={a}
                  checked={art === a}
                  onChange={() => setArt(a)}
                />
                <span>{FOTOART_TEXT[a]}</span>
              </label>
            ))}
          </div>
          <small className="wb-notiz">{FOTOART_HINWEIS[art]}</small>
        </fieldset>

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

        <div className="wb-aufnahme__knoepfe">
          <button
            className="wb-button wb-button--gross"
            type="button"
            disabled={laeuft > 0}
            onClick={() => kamera.current?.click()}
          >
            <Symbol name="kamera" groesse={20} />
            {laeuft > 0 ? `${laeuft} wird geladen …` : `${FOTOART_TEXT[art]} aufnehmen`}
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
      </div>

      {fehler && (
        <p className="wb-fehler" role="alert">
          {fehler}
        </p>
      )}

      {!laedt && luecken.length > 0 && fotos.length > 0 && (
        <p className="wb-hinweis">
          {luecken.join(" ")} Kein Zwang — aber genau diese beiden Bilder sind es, die im
          Streitfall zählen.
        </p>
      )}

      {wartend.length > 0 && (
        <div className="wb-galerie__gruppe wb-galerie__gruppe--wartend">
          <h3 className="wb-galerie__titel">
            <span className="wb-plakette wb-plakette--warn">Wartet auf Netz</span>
            <span className="wb-galerie__anzahl">{wartend.length}</span>
          </h3>
          <p className="wb-notiz">
            Noch nicht auf dem Server: ohne Netz aufgenommen und nur auf diesem Gerät
            gespeichert. Sie gehen von selbst hinaus, sobald wieder Verbindung besteht — erst
            dann sind sie gesichert. Bis dahin kein privates Fenster schließen und den
            Browserverlauf nicht löschen.
          </p>
          <ul className="wb-galerie">
            {wartend.map((d) => (
              <WartendesBild key={d.id} datei={d} beiEntfernen={wartendeLaden} />
            ))}
          </ul>
        </div>
      )}

      {laedt && fotos.length === 0 && <p className="wb-leer">Wird geladen …</p>}

      {!laedt && fotos.length === 0 && wartend.length === 0 && (
        <p className="wb-leer">
          Noch keine Fotos. Der beste Zeitpunkt für das Vorher-Bild ist, bevor der erste
          Handgriff getan ist — und für das Nachher-Bild, bevor die Wand zugeht.
        </p>
      )}

      {gruppen.map(({ art: gruppenart, fotos: bilder }) => (
        <div key={gruppenart} className="wb-galerie__gruppe">
          <h3 className="wb-galerie__titel">
            <span className={`wb-plakette wb-plakette--${FOTOART_FARBE[gruppenart]}`}>
              {FOTOART_TEXT[gruppenart]}
            </span>
            <span className="wb-galerie__anzahl">{bilder.length}</span>
          </h3>
          <ul className="wb-galerie">
            {bilder.map((f) => (
              <li key={f.id} className="wb-galerie__bild">
                <button
                  type="button"
                  className="wb-galerie__knopf"
                  onClick={() => setGross(f)}
                  aria-label={f.beschreibung || `${FOTOART_TEXT[gruppenart]} vergrößern`}
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
        </div>
      ))}

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
 * Ein Bild aus dem Zwischenspeicher. Vorschau aus dem gespeicherten Blob,
 * Art und Zeitpunkt darunter. Hat der Server es abgelehnt, steht der Grund
 * da, und nur dann gibt es einen Knopf zum Entfernen — ein Bild, das noch
 * unterwegs ist, wirft man nicht aus Versehen weg.
 */
function WartendesBild({ datei, beiEntfernen }: { datei: GepufferteDatei; beiEntfernen: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(datei.datei);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [datei.datei]);
  const art = (datei.felder.art as Fotoart) || "sonstiges";
  return (
    <li className="wb-galerie__bild wb-galerie__bild--wartend">
      {url && <img src={url} alt="" />}
      <p className="wb-galerie__zeile">
        {FOTOART_TEXT[art] ?? ""} · {new Date(datei.angelegt).toLocaleTimeString("de-AT", { hour: "2-digit", minute: "2-digit" })}
      </p>
      {datei.fehler && (
        <p className="wb-fehler">
          Vom Server abgelehnt: {datei.fehler}{" "}
          <button
            type="button"
            className="wb-button wb-button--sekundaer wb-button--klein"
            onClick={() => {
              if (confirm("Dieses Foto endgültig verwerfen?")) void gepufferteEntfernen(datei.id).then(beiEntfernen);
            }}
          >
            Verwerfen
          </button>
        </p>
      )}
    </li>
  );
}

/**
 * Ein Foto groß, mit Beschriftung, Einordnung und Löschen.
 *
 * Bewusst kein `dialog` mit `showModal`: das öffnet in manchen mobilen
 * Browsern eine Ebene, aus der die Zurück-Taste nicht herausführt, und dann
 * sitzt der Monteur fest.
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
  const [art, setArt] = useState<Fotoart>(fotoartVon(foto));
  const [laeuft, setLaeuft] = useState(false);

  useEffect(() => {
    function taste(e: KeyboardEvent) {
      if (e.key === "Escape") beiSchliessen();
    }
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [beiSchliessen]);

  const geaendert = text !== (foto.beschreibung ?? "") || art !== fotoartVon(foto);

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
          <label className="wb-feld">
            <span>Einordnung</span>
            <select value={art} onChange={(e) => setArt(e.target.value as Fotoart)}>
              {FOTOARTEN.map((a) => (
                <option key={a} value={a}>
                  {FOTOART_TEXT[a]}
                </option>
              ))}
            </select>
          </label>

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
              disabled={laeuft || !geaendert}
              onClick={() =>
                void tu(async () => {
                  if (art !== fotoartVon(foto)) await fotoEinordnen(foto, art);
                  if (text !== (foto.beschreibung ?? "")) await fotoBeschriften(foto, text);
                })
              }
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
            <button className="wb-button wb-button--sekundaer" type="button" onClick={beiSchliessen}>
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
