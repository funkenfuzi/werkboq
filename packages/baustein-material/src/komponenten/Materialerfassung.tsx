import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  alsEuro,
  aktuellerRechtsraum,
  eigenerMitarbeiter,
  fehlersatz,
  schreibweiseVon,
  Symbol,
} from "@werkboq/core";
import {
  artikelSuchen,
  ARTIKELART_TEXT,
  type Artikel,
} from "../daten/artikel";
import {
  artikelZuEan,
  eanNormalisieren,
  passtZuSuche,
  schnellwahlLaden,
} from "../daten/schnellwahl";
import {
  ausArtikel,
  naechstePos,
  positionenZuAuftrag,
  positionLoeschen,
  vorschlagAnlegen,
  type Position,
} from "../daten/positionen";
import { leserVorhanden, Scanfeld } from "./Scanfeld";

/**
 * Material erfassen, wie es auf der Baustelle zugeht.
 *
 * Der Monteur hat eine Hand frei, schlechtes Licht und kein Netz. Jede
 * Sekunde, die diese Maske länger braucht als ein Zettel, wird sie nicht
 * benutzt — und dann fehlt genau das Material auf der Rechnung, das dieser
 * Baustein einsammeln soll.
 *
 * Daher: was zuletzt verbaut wurde, steht oben und braucht einen Tipp.
 * Alles andere kommt über Suche oder Strichcode. Die Menge wird mit großen
 * Knöpfen eingestellt, nicht über eine Zahlentastatur, die halb vom
 * Tastaturfeld verdeckt wird.
 *
 * Was hier entsteht, ist ein VORSCHLAG. Es steht sofort in der Liste, zählt
 * aber erst, wenn das Büro es freigegeben hat.
 */
export function Materialerfassung({
  auftragId,
  offenAnfangs = false,
  beiAenderung,
}: {
  auftragId: string;
  /**
   * Für den Monteur steht die Maske offen — er kommt zum Erfassen. Fürs
   * Büro ist sie zugeklappt, dort ist die Positionsliste das Wichtige.
   */
  offenAnfangs?: boolean;
  /**
   * Sagt dem Positionsblock daneben Bescheid. Ohne das steht der neue
   * Vorschlag zwar in der Datenbank, aber die Liste daneben zeigt ihn
   * erst nach dem nächsten Neuladen — und wer das sieht, glaubt, das
   * Erfassen habe nicht funktioniert, und tippt es noch einmal ein.
   */
  beiAenderung?: () => void;
}) {
  const sw = schreibweiseVon(aktuellerRechtsraum().id);
  const [offen, setOffen] = useState(offenAnfangs);
  const [reiter, setReiter] = useState<"zuletzt" | "favoriten" | "suche">("zuletzt");
  const [zuletzt, setZuletzt] = useState<Artikel[]>([]);
  const [favoriten, setFavoriten] = useState<Artikel[]>([]);
  const [eigene, setEigene] = useState(false);
  const [suchtext, setSuchtext] = useState("");
  const [treffer, setTreffer] = useState<Artikel[]>([]);
  const [sucht, setSucht] = useState(false);
  const [scannt, setScannt] = useState(false);
  const [gewaehlt, setGewaehlt] = useState<Artikel | null>(null);
  const [eigeneZeilen, setEigeneZeilen] = useState<Position[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const suchfeld = useRef<HTMLInputElement>(null);

  const ladenListe = useCallback(
    (melden = false) => {
      positionenZuAuftrag(auftragId)
        .then((alle) => setEigeneZeilen(alle.filter((p) => p.zustand === "vorschlag")))
        .catch((e: unknown) => setFehler(fehlersatz(e)));
      if (melden) beiAenderung?.();
    },
    [auftragId, beiAenderung],
  );

  useEffect(() => {
    schnellwahlLaden()
      .then((s) => {
        setZuletzt(s.zuletzt);
        setFavoriten(s.favoriten);
        setEigene(s.eigene);
        // Wer noch nie etwas erfasst hat, sieht eine leere Fläche —
        // dann lieber gleich die Favoriten zeigen.
        if (!s.zuletzt.length && s.favoriten.length) setReiter("favoriten");
      })
      .catch((e: unknown) => setFehler(fehlersatz(e)));
    ladenListe();
  }, [ladenListe]);

  // Suche: erst im schon Geladenen, dann am Server. Ohne Netz bleibt
  // wenigstens die Schnellwahl durchsuchbar.
  const schonGeladen = useMemo(() => {
    const alle = [...zuletzt, ...favoriten];
    const gesehen = new Set<string>();
    return alle.filter((a) => (gesehen.has(a.id) ? false : (gesehen.add(a.id), true)));
  }, [zuletzt, favoriten]);

  useEffect(() => {
    const text = suchtext.trim();
    if (!text) {
      setTreffer([]);
      return;
    }
    // Erst das, was schon im Speicher liegt — das steht sofort da und
    // funktioniert auch ohne Netz.
    const lokal = schonGeladen.filter((a) => passtZuSuche(a, text));
    setTreffer(lokal);
    setSucht(true);
    const zeit = window.setTimeout(() => {
      artikelSuchen(text)
        .then((vomServer) => {
          // ZUSAMMENFÜHREN, NICHT ERSETZEN. Ein leeres Serverergebnis
          // darf brauchbare lokale Treffer nicht wegräumen — sonst
          // blinkt der gesuchte Artikel kurz auf und verschwindet
          // wieder, was aussieht wie ein kaputtes Programm.
          const gesehen = new Set(lokal.map((a) => a.id));
          setTreffer([...lokal, ...vomServer.filter((a) => !gesehen.has(a.id))]);
        })
        .catch(() => undefined)
        .finally(() => setSucht(false));
    }, 250);
    return () => window.clearTimeout(zeit);
  }, [suchtext, schonGeladen]);

  async function codeVerarbeiten(code: string) {
    setScannt(false);
    const gefunden = await artikelZuEan(code).catch(() => []);
    if (gefunden.length === 1) {
      setGewaehlt(gefunden[0]!);
      setHinweis(null);
    } else if (gefunden.length > 1) {
      setReiter("suche");
      setTreffer(gefunden);
      setHinweis("Zu diesem Strichcode gibt es mehrere Artikel — bitte auswählen.");
    } else {
      setReiter("suche");
      setSuchtext(eanNormalisieren(code));
      setHinweis(
        `Kein Artikel mit dem Strichcode ${eanNormalisieren(code)}. Such ihn über den Namen und trag die Nummer im Katalog nach — dann geht es beim nächsten Mal mit einem Scan.`,
      );
      suchfeld.current?.focus();
    }
  }

  async function erfassen(a: Artikel, menge: number) {
    setFehler(null);
    try {
      const vorhandene = await positionenZuAuftrag(auftragId);
      const ich = await eigenerMitarbeiter().catch(() => null);
      await vorschlagAnlegen(
        ausArtikel(a, auftragId, naechstePos(vorhandene), menge),
        ich?.id,
      );
      setGewaehlt(null);
      setSuchtext("");
      setHinweis(null);
      ladenListe(true);
      // Was gerade erfasst wurde, gehört beim nächsten Griff nach oben.
      setZuletzt((alt) => [a, ...alt.filter((x) => x.id !== a.id)].slice(0, 12));
      setReiter("zuletzt");
    } catch (e: unknown) {
      setFehler(fehlersatz(e));
    }
  }

  const liste = reiter === "favoriten" ? favoriten : reiter === "suche" ? treffer : zuletzt;

  return (
    <section className="wb-block">
      <div className="wb-block__kopf">
        <h2>Material erfassen</h2>
        {eigeneZeilen.length > 0 && (
          <span className="wb-block__summe">{eigeneZeilen.length} offen</span>
        )}
        <button
          className={offen ? "wb-button wb-button--sekundaer" : "wb-button"}
          type="button"
          onClick={() => setOffen(!offen)}
          aria-expanded={offen}
        >
          {offen ? "Zuklappen" : (<><Symbol name="plus" groesse={18} />Erfassen</>)}
        </button>
      </div>

      {fehler && (
        <p className="wb-fehler" role="alert">
          {fehler}
        </p>
      )}

      {offen && (scannt ? (
        <Scanfeld beiCode={(c) => void codeVerarbeiten(c)} beiAbbruch={() => setScannt(false)} />
      ) : (
        <>
          <div className="wb-suchzeile">
            <label className="wb-feld wb-feld--breit">
              <span className="wb-nur-vorleser">Artikel suchen</span>
              <input
                ref={suchfeld}
                type="search"
                inputMode="search"
                placeholder="Suchen oder Nummer eintippen"
                value={suchtext}
                onChange={(e) => {
                  setSuchtext(e.target.value);
                  setReiter(e.target.value ? "suche" : "zuletzt");
                }}
              />
            </label>
            {leserVorhanden() && (
              <button
                className="wb-button wb-button--sekundaer"
                type="button"
                onClick={() => setScannt(true)}
              >
                <Symbol name="kamera" groesse={18} />
                Scannen
              </button>
            )}
          </div>

          {!leserVorhanden() && (
            <p className="wb-notiz">
              Dieser Browser kann keine Strichcodes lesen — auf dem iPhone geht es nicht, auf
              Android mit Chrome schon. Die EAN lässt sich oben eintippen.
            </p>
          )}

          {hinweis && <p className="wb-hinweis">{hinweis}</p>}

          <div className="wb-umschalter" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={reiter === "zuletzt"}
              className={reiter === "zuletzt" ? "ist-aktiv" : ""}
              onClick={() => setReiter("zuletzt")}
            >
              {eigene ? "Zuletzt verwendet" : "Zuletzt im Betrieb"}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={reiter === "favoriten"}
              className={reiter === "favoriten" ? "ist-aktiv" : ""}
              onClick={() => setReiter("favoriten")}
            >
              Schnellauswahl
            </button>
            {suchtext && (
              <button
                type="button"
                role="tab"
                aria-selected={reiter === "suche"}
                className={reiter === "suche" ? "ist-aktiv" : ""}
                onClick={() => setReiter("suche")}
              >
                Treffer {sucht ? "…" : `(${treffer.length})`}
              </button>
            )}
          </div>

          {liste.length === 0 ? (
            <p className="wb-leer">
              {reiter === "suche"
                ? sucht
                  ? "Wird gesucht …"
                  : "Nichts gefunden. Ein Artikel, den es noch nicht gibt, gehört zuerst in den Katalog."
                : reiter === "favoriten"
                  ? "Keine Schnellauswahl eingerichtet. Im Katalog lässt sich ein Artikel dafür vormerken — das, was der Betrieb ständig braucht."
                  : "Noch nichts verbaut. Such den ersten Artikel über das Feld oben."}
            </p>
          ) : (
            <ul className="wb-artikelwahl">
              {liste.map((a) => (
                <li key={a.id}>
                  <button type="button" onClick={() => setGewaehlt(a)}>
                    <span className="wb-artikelwahl__name">{a.bezeichnung}</span>
                    <span className="wb-artikelwahl__unten">
                      <span className="wb-artikelwahl__nummer">{a.nummer}</span>
                      <span>
                        {alsEuro(a.preis, sw)} / {a.einheit}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ))}

      {offen && gewaehlt && (
        <Mengenmaske
          artikel={gewaehlt}
          beiFertig={(menge) => void erfassen(gewaehlt, menge)}
          beiAbbruch={() => setGewaehlt(null)}
        />
      )}

      {eigeneZeilen.length > 0 && (
        <>
          <h3 className="wb-zwischentitel">Erfasst, noch nicht freigegeben</h3>
          <ul className="wb-erfasstliste">
            {eigeneZeilen.map((p) => (
              <li key={p.id}>
                <span className="wb-erfasstliste__menge">
                  {p.menge} {p.einheit}
                </span>
                <span className="wb-erfasstliste__name">
                  {p.bezeichnung}
                  <small>{ARTIKELART_TEXT[p.art]}</small>
                </span>
                <button
                  type="button"
                  className="wb-button wb-button--sekundaer wb-button--klein"
                  onClick={() =>
                    void positionLoeschen(p)
                      .then(() => ladenListe(true))
                      .catch((e: unknown) => setFehler(fehlersatz(e)))
                  }
                  aria-label={`${p.bezeichnung} entfernen`}
                >
                  <Symbol name="muell" groesse={16} />
                </button>
              </li>
            ))}
          </ul>
          <p className="wb-notiz">
            Das Büro gibt frei, dann kommt es auf die Rechnung. Solange es hier steht, zählt es
            nicht mit.
          </p>
        </>
      )}
    </section>
  );
}

/**
 * Menge einstellen.
 *
 * Große Knöpfe statt Zahlenfeld: mit Arbeitshandschuhen trifft niemand eine
 * Tastatur, und das Tastaturfeld verdeckt auf dem Handy die halbe Maske.
 * Das Zahlenfeld gibt es trotzdem — für die 47 Meter, die man nicht
 * einzeln antippen will.
 */
function Mengenmaske({
  artikel,
  beiFertig,
  beiAbbruch,
}: {
  artikel: Artikel;
  beiFertig: (menge: number) => void;
  beiAbbruch: () => void;
}) {
  const sw = schreibweiseVon(aktuellerRechtsraum().id);
  const [menge, setMenge] = useState(1);
  const [text, setText] = useState("1");

  /** Bei Metern zählt man in halben, bei Stück in ganzen. */
  const schritt = artikel.einheit === "Stk" || artikel.einheit === "Satz" ? 1 : 0.5;

  function setzen(neu: number) {
    const sicher = Math.max(schritt, Math.round(neu * 100) / 100);
    setMenge(sicher);
    setText(String(sicher).replace(".", ","));
  }

  return (
    <div className="wb-mengenmaske">
      <p className="wb-mengenmaske__name">{artikel.bezeichnung}</p>
      <div className="wb-mengenwahl">
        <button
          type="button"
          className="wb-button wb-button--sekundaer"
          onClick={() => setzen(menge - schritt)}
          aria-label="weniger"
        >
          −
        </button>
        <label className="wb-feld">
          <span className="wb-nur-vorleser">Menge in {artikel.einheit}</span>
          <input
            type="text"
            inputMode="decimal"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              const zahl = Number(e.target.value.replace(",", "."));
              if (Number.isFinite(zahl) && zahl > 0) setMenge(zahl);
            }}
          />
        </label>
        <span className="wb-mengenwahl__einheit">{artikel.einheit}</span>
        <button
          type="button"
          className="wb-button wb-button--sekundaer"
          onClick={() => setzen(menge + schritt)}
          aria-label="mehr"
        >
          +
        </button>
      </div>
      <p className="wb-mengenmaske__wert">
        {alsEuro(artikel.preis, sw)} / {artikel.einheit} · ergibt{" "}
        <strong>{alsEuro(Math.round(menge * artikel.preis), sw)}</strong> netto
      </p>
      <div className="wb-aktionen">
        <button className="wb-button" type="button" onClick={() => beiFertig(menge)}>
          <Symbol name="haken" groesse={18} />
          Erfassen
        </button>
        <button className="wb-button wb-button--sekundaer" type="button" onClick={beiAbbruch}>
          Abbrechen
        </button>
      </div>
    </div>
  );
}
