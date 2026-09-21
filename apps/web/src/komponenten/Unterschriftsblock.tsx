import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  betriebLaden,
  erklaerungsvorschlag,
  fehlersatz,
  Symbol,
  unterschreiben,
  unterschriftAdresse,
  unterschriftenZuAuftrag,
  UNTERSCHRIFT_ZWECKE,
  ZWECK_HINWEIS,
  ZWECK_TEXT,
  type Betrieb,
  type Unterschrift,
  type Unterschriftzweck,
} from "@werkboq/core";
import { alsPng, Unterschriftsfeld } from "./Unterschriftsfeld";

/**
 * Unterschriften am Auftrag.
 *
 * Was hier entsteht, lässt sich nicht mehr ändern — die Collection kennt
 * keine Änderung, und das ist der Punkt. Deshalb steht vor dem Festhalten
 * eine Zusammenfassung dessen, was gleich unveränderlich wird, und der
 * Wortlaut ist bis zum letzten Moment bearbeitbar.
 */
export function Unterschriftsblock({ auftragId }: { auftragId: string }) {
  const [liste, setListe] = useState<Unterschrift[]>([]);
  const [betrieb, setBetrieb] = useState<Betrieb | null>(null);
  const [maske, setMaske] = useState(false);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [gross, setGross] = useState<Unterschrift | null>(null);

  const laden = useCallback(() => {
    setLaedt(true);
    Promise.all([unterschriftenZuAuftrag(auftragId), betriebLaden().catch(() => null)])
      .then(([u, b]) => {
        setListe(u);
        setBetrieb(b);
      })
      .catch((e: unknown) => setFehler(fehlersatz(e)))
      .finally(() => setLaedt(false));
  }, [auftragId]);

  useEffect(laden, [laden]);

  return (
    <section className="wb-block">
      <div className="wb-block__kopf">
        <h2>Unterschriften</h2>
        <span className="wb-block__summe">{liste.length}</span>
        {!maske && (
          <button className="wb-button" type="button" onClick={() => setMaske(true)}>
            <Symbol name="stift" groesse={18} />
            Unterschreiben lassen
          </button>
        )}
      </div>

      {fehler && (
        <p className="wb-fehler" role="alert">
          {fehler}
        </p>
      )}

      {maske && (
        <Unterschriftsmaske
          auftragId={auftragId}
          betrieb={betrieb}
          beiFertig={() => {
            setMaske(false);
            laden();
          }}
          beiAbbruch={() => setMaske(false)}
          beiFehler={setFehler}
        />
      )}

      {laedt && liste.length === 0 && <p className="wb-leer">Wird geladen …</p>}

      {!laedt && liste.length === 0 && !maske && (
        <p className="wb-leer">
          Noch nichts unterschrieben. Der Abnahmeschein am Tablet erspart den Satz „das habe ich
          so nie bestellt“ drei Monate später.
        </p>
      )}

      {liste.length > 0 && (
        <ul className="wb-unterschriftsliste">
          {liste.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                className="wb-unterschriftsliste__bild"
                onClick={() => setGross(u)}
                aria-label={`Unterschrift von ${u.name} ansehen`}
              >
                <img src={unterschriftAdresse(u, true)} alt="" loading="lazy" />
              </button>
              <div className="wb-unterschriftsliste__text">
                <strong>{ZWECK_TEXT[u.zweck]}</strong>
                <span>
                  {u.name}
                  {u.funktion ? `, ${u.funktion}` : ""} ·{" "}
                  {new Date(`${u.datum.slice(0, 10)}T00:00:00`).toLocaleDateString("de-AT")}
                  {u.ort ? ` · ${u.ort}` : ""}
                </span>
                {u.vorbehalt && (
                  <span className="wb-unterschriftsliste__vorbehalt">
                    <Symbol name="warnung" groesse={14} />
                    Vorbehalt: {u.vorbehalt}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {gross && <Schau unterschrift={gross} beiSchliessen={() => setGross(null)} />}
    </section>
  );
}

function Unterschriftsmaske({
  auftragId,
  betrieb,
  beiFertig,
  beiAbbruch,
  beiFehler,
}: {
  auftragId: string;
  betrieb: Betrieb | null;
  beiFertig: () => void;
  beiAbbruch: () => void;
  beiFehler: (f: string) => void;
}) {
  const [zweck, setZweck] = useState<Unterschriftzweck>("abnahme");
  const [name, setName] = useState("");
  const [funktion, setFunktion] = useState("");
  const [ort, setOrt] = useState("");
  const [vorbehalt, setVorbehalt] = useState("");
  const [erklaerung, setErklaerung] = useState(() => erklaerungsvorschlag("abnahme", betrieb));
  const [erklaerungGeaendert, setErklaerungGeaendert] = useState(false);
  const [hatStriche, setHatStriche] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const feld = useRef<HTMLDivElement>(null);

  /** Der Vorschlag folgt dem Zweck — solange niemand von Hand eingegriffen hat. */
  function zweckWaehlen(z: Unterschriftzweck) {
    setZweck(z);
    if (!erklaerungGeaendert) setErklaerung(erklaerungsvorschlag(z, betrieb));
  }

  async function festhalten(e: FormEvent) {
    e.preventDefault();
    const canvas = feld.current?.querySelector("canvas");
    if (!canvas) return;
    if (!name.trim()) {
      beiFehler("Der Name in Blockschrift fehlt — eine Unterschrift allein ist oft nicht lesbar.");
      return;
    }
    setLaeuft(true);
    try {
      const bild = await alsPng(canvas);
      if (!bild) throw new Error("Das Unterschriftsbild ließ sich nicht erzeugen.");
      await unterschreiben(auftragId, { zweck, name, funktion, ort, erklaerung, vorbehalt }, bild);
      beiFertig();
    } catch (e: unknown) {
      beiFehler(fehlersatz(e));
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <form className="wb-maske" onSubmit={festhalten}>
      <label className="wb-feld wb-feld--breit">
        <span>Wofür wird unterschrieben?</span>
        <select value={zweck} onChange={(e) => zweckWaehlen(e.target.value as Unterschriftzweck)}>
          {UNTERSCHRIFT_ZWECKE.map((z) => (
            <option key={z} value={z}>
              {ZWECK_TEXT[z]}
            </option>
          ))}
        </select>
        <small className="wb-notiz">{ZWECK_HINWEIS[zweck]}</small>
      </label>

      <label className="wb-feld wb-feld--breit">
        <span>Erklärung, die bestätigt wird</span>
        <textarea
          rows={4}
          value={erklaerung}
          onChange={(e) => {
            setErklaerung(e.target.value);
            setErklaerungGeaendert(true);
          }}
          required
        />
        <small className="wb-notiz">
          Genau dieser Wortlaut wird mitgespeichert und ist später nicht mehr änderbar. Eine
          Unterschrift ohne den Text, den sie bestätigt, ist wertlos.
        </small>
      </label>

      <label className="wb-feld">
        <span>Name in Blockschrift *</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ing. Peter Novak"
          required
        />
      </label>

      <label className="wb-feld">
        <span>Funktion</span>
        <input
          type="text"
          value={funktion}
          onChange={(e) => setFunktion(e.target.value)}
          placeholder="Bauleiter"
        />
      </label>

      <label className="wb-feld">
        <span>Ort</span>
        <input
          type="text"
          value={ort}
          onChange={(e) => setOrt(e.target.value)}
          placeholder="Wiener Neustadt"
        />
      </label>

      <label className="wb-feld wb-feld--breit">
        <span>Vorbehalt oder festgehaltene Mängel</span>
        <input
          type="text"
          value={vorbehalt}
          onChange={(e) => setVorbehalt(e.target.value)}
          placeholder="leer lassen, wenn ohne Vorbehalt"
        />
        {zweck === "abnahme" && (
          <small className="wb-notiz">
            Was hier steht, ist bei der Abnahme ausdrücklich vorbehalten. Alles andere gilt als
            angenommen, soweit es erkennbar war.
          </small>
        )}
      </label>

      <div className="wb-feld wb-feld--breit" ref={feld}>
        <span>Unterschrift *</span>
        <Unterschriftsfeld beiAenderung={setHatStriche} />
      </div>

      <div className="wb-aktionen wb-feld--breit">
        <button className="wb-button" type="submit" disabled={laeuft || !hatStriche || !name.trim()}>
          {laeuft ? "Wird festgehalten …" : "Unterschrift festhalten"}
        </button>
        <button className="wb-button wb-button--sekundaer" type="button" onClick={beiAbbruch}>
          Abbrechen
        </button>
      </div>

      <p className="wb-leer wb-notiz wb-feld--breit">
        Danach lässt sich nichts mehr ändern — weder der Text noch das Bild. Das ist der Sinn der
        Sache.
      </p>
    </form>
  );
}

function Schau({
  unterschrift,
  beiSchliessen,
}: {
  unterschrift: Unterschrift;
  beiSchliessen: () => void;
}) {
  useEffect(() => {
    function taste(e: KeyboardEvent) {
      if (e.key === "Escape") beiSchliessen();
    }
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [beiSchliessen]);

  return (
    <div className="wb-bildschau" role="dialog" aria-modal="true" aria-label="Unterschrift">
      <div className="wb-bildschau__hintergrund" onClick={beiSchliessen} aria-hidden="true" />
      <div className="wb-bildschau__inhalt">
        <div className="wb-bildschau__leiste">
          <h3>{ZWECK_TEXT[unterschrift.zweck]}</h3>
          <p className="wb-erklaerungstext">{unterschrift.erklaerung}</p>
          {unterschrift.vorbehalt && (
            <p className="wb-hinweis">Vorbehalt: {unterschrift.vorbehalt}</p>
          )}
        </div>
        <img
          className="wb-unterschriftsbild"
          src={unterschriftAdresse(unterschrift)}
          alt={`Unterschrift von ${unterschrift.name}`}
        />
        <div className="wb-bildschau__leiste">
          <dl className="wb-daten">
            <div>
              <dt>Name</dt>
              <dd>
                {unterschrift.name}
                {unterschrift.funktion ? `, ${unterschrift.funktion}` : ""}
              </dd>
            </div>
            <div>
              <dt>Datum</dt>
              <dd>
                {new Date(`${unterschrift.datum.slice(0, 10)}T00:00:00`).toLocaleDateString("de-AT")}
              </dd>
            </div>
            {unterschrift.ort && (
              <div>
                <dt>Ort</dt>
                <dd>{unterschrift.ort}</dd>
              </div>
            )}
          </dl>
          <div className="wb-aktionen">
            <button className="wb-button wb-button--sekundaer" type="button" onClick={beiSchliessen}>
              Schließen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
