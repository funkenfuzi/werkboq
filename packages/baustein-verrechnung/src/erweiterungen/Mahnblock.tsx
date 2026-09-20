import { useCallback, useEffect, useState } from "react";
import { alsEuro, ausGeld, fehlersatz, Symbol, type Kunde } from "@werkboq/core";
import { faelligAm, ueberfaelligSeit, type Beleg } from "../daten/belege";
import {
  BETREIBUNGSKOSTEN_B2B,
  MAHNSTUFE_TEXT,
  mahntext,
  mahnungAnlegen,
  mahnungenZuBeleg,
  mahnvorschlag,
  naechsteStufe,
  VERZUGSZINSEN_B2B,
  VERZUGSZINSEN_B2C,
  type Mahnung,
} from "../daten/mahnwesen";

/**
 * Mahnungen zu einer Rechnung.
 *
 * Erscheint erst, wenn die Rechnung festgeschrieben, fällig und noch offen
 * ist — vorher gibt es nichts zu mahnen, und ein Mahnknopf neben einer
 * frischen Rechnung lädt zu Fehlern ein.
 *
 * Zinsen und Spesen schlägt Werkboq vor und begründet sie; ändern kann man
 * beides. Wer einem langjährigen Kunden keine Zinsen verrechnen will, soll
 * das tun dürfen, ohne die Zahl im Kopf ausrechnen zu müssen.
 */
export function Mahnblock({
  beleg,
  kunde,
  offen,
  beiAenderung,
}: {
  beleg: Beleg;
  kunde: Kunde | null;
  offen: number;
  beiAenderung: () => void;
}) {
  const [mahnungen, setMahnungen] = useState<Mahnung[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [maske, setMaske] = useState(false);

  const laden = useCallback(() => {
    mahnungenZuBeleg(beleg.id)
      .then(setMahnungen)
      .catch((e: unknown) => setFehler(fehlersatz(e)));
  }, [beleg.id]);

  useEffect(laden, [laden]);

  const tage = ueberfaelligSeit(beleg);
  const stufe = naechsteStufe(mahnungen);
  const unternehmer = Boolean(kunde?.unternehmer);
  const bisherigeSpesen = mahnungen.reduce((s, m) => s + (m.spesen ?? 0), 0);

  if (tage === 0 && mahnungen.length === 0) {
    return (
      <section className="wb-block">
        <h2>Mahnwesen</h2>
        <p className="wb-leer">
          Noch nicht fällig — zahlbar bis {new Date(faelligAm(beleg)).toLocaleDateString("de-AT")}.
        </p>
      </section>
    );
  }

  return (
    <section className="wb-block">
      <div className="wb-block__kopf">
        <h2>Mahnwesen</h2>
        <span className="wb-block__summe">
          {tage} Tage überfällig · {alsEuro(offen)} offen ·{" "}
          {unternehmer ? "Unternehmer" : "Verbraucher"}
        </span>
        {stufe && !maske && (
          <button className="wb-button" type="button" onClick={() => setMaske(true)}>
            <Symbol name="warnung" groesse={18} />
            {MAHNSTUFE_TEXT[stufe]}
          </button>
        )}
      </div>

      {fehler && (
        <p className="wb-fehler" role="alert">
          {fehler}
        </p>
      )}

      {!kunde?.unternehmer && (
        <p className="wb-leer wb-notiz">
          Dieser Kunde ist als Verbraucher geführt: Verzugszinsen {VERZUGSZINSEN_B2C} % nach
          § 1000 ABGB, keine Betreibungskostenpauschale. Mahnspesen müssten gesondert vereinbart
          und der Höhe nach angemessen sein. Stimmt das nicht, lässt sich der Kunde in seinen
          Stammdaten als Unternehmer kennzeichnen.
        </p>
      )}
      {kunde?.unternehmer && (
        <p className="wb-leer wb-notiz">
          Unternehmer: Verzugszinsen {VERZUGSZINSEN_B2B.toFixed(2)} % nach § 456 UGB
          (Basiszinssatz plus 9,2 Punkte) und einmalig {alsEuro(BETREIBUNGSKOSTEN_B2B)}{" "}
          Betreibungskosten nach § 458 UGB.
        </p>
      )}

      {maske && stufe && (
        <Mahnmaske
          beleg={beleg}
          stufe={stufe}
          offen={offen}
          unternehmer={unternehmer}
          bisherigeSpesen={bisherigeSpesen}
          beiGespeichert={() => {
            setMaske(false);
            laden();
            beiAenderung();
          }}
          beiAbbruch={() => setMaske(false)}
          beiFehler={setFehler}
        />
      )}

      {mahnungen.length > 0 && (
        <div className="wb-tabelle-rahmen">
          <table className="wb-tabelle">
            <thead>
              <tr>
                <th scope="col">Stufe</th>
                <th scope="col">Datum</th>
                <th scope="col">Frist</th>
                <th scope="col" className="wb-zelle--rechts">Zinsen</th>
                <th scope="col" className="wb-zelle--rechts">Spesen</th>
                <th scope="col" className="wb-zelle--rechts">Gesamt</th>
              </tr>
            </thead>
            <tbody>
              {mahnungen.map((m) => (
                <tr key={m.id}>
                  <td>{MAHNSTUFE_TEXT[m.stufe]}</td>
                  <td className="wb-tabelle__kennung">
                    {new Date(m.datum).toLocaleDateString("de-AT")}
                  </td>
                  <td className="wb-tabelle__kennung">
                    {new Date(m.frist).toLocaleDateString("de-AT")}
                  </td>
                  <td className="wb-zelle--rechts wb-tabelle__kennung">{alsEuro(m.zinsen ?? 0)}</td>
                  <td className="wb-zelle--rechts wb-tabelle__kennung">{alsEuro(m.spesen ?? 0)}</td>
                  <td className="wb-zelle--rechts wb-tabelle__kennung wb-zelle--betont">
                    {alsEuro(offen + (m.zinsen ?? 0) + (m.spesen ?? 0))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!stufe && (
        <p className="wb-leer wb-notiz">
          Drei Stufen sind ausgeschöpft. Was jetzt geschieht — Inkasso, Anwalt, Abschreibung —
          entscheidet kein Programm.
        </p>
      )}
    </section>
  );
}

function Mahnmaske({
  beleg,
  stufe,
  offen,
  unternehmer,
  bisherigeSpesen,
  beiGespeichert,
  beiAbbruch,
  beiFehler,
}: {
  beleg: Beleg;
  stufe: 1 | 2 | 3;
  offen: number;
  unternehmer: boolean;
  bisherigeSpesen: number;
  beiGespeichert: () => void;
  beiAbbruch: () => void;
  beiFehler: (f: string) => void;
}) {
  const vorschlag = mahnvorschlag(beleg, offen, unternehmer, stufe, bisherigeSpesen);
  const [zinsen, setZinsen] = useState((vorschlag.zinsen / 100).toFixed(2).replace(".", ","));
  const [spesen, setSpesen] = useState((vorschlag.spesen / 100).toFixed(2).replace(".", ","));
  const [frist, setFrist] = useState(vorschlag.frist);
  const [text, setText] = useState(mahntext(stufe, beleg.nummer, beleg.datum, vorschlag.frist));
  const [laeuft, setLaeuft] = useState(false);

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    const z = ausGeld(zinsen);
    const s = ausGeld(spesen);
    if (Number.isNaN(z) || Number.isNaN(s)) {
      beiFehler("Zinsen und Spesen bitte als Zahl angeben.");
      return;
    }
    setLaeuft(true);
    try {
      await mahnungAnlegen(beleg, {
        stufe,
        datum: new Date().toISOString().slice(0, 10),
        frist,
        zinsen: z,
        spesen: s,
        text,
      });
      beiGespeichert();
    } catch (e: unknown) {
      beiFehler(fehlersatz(e));
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <form className="wb-maske" onSubmit={absenden}>
      <div className="wb-feld wb-feld--breit">
        <span>{MAHNSTUFE_TEXT[stufe]}</span>
        <p className="wb-notiz">
          {vorschlag.tage} Tage über der Fälligkeit, offen {alsEuro(offen)}. Zinsen gerechnet mit{" "}
          {(unternehmer ? VERZUGSZINSEN_B2B : VERZUGSZINSEN_B2C).toFixed(2)} % taggenau auf 365
          Tage.
        </p>
      </div>

      <label className="wb-feld wb-feld--schmal">
        <span>Zahlbar bis</span>
        <input type="date" value={frist} onChange={(e) => setFrist(e.target.value)} required />
      </label>

      <label className="wb-feld wb-feld--schmal">
        <span>Verzugszinsen</span>
        <input
          type="text"
          inputMode="decimal"
          value={zinsen}
          onChange={(e) => setZinsen(e.target.value)}
        />
      </label>

      <label className="wb-feld wb-feld--schmal">
        <span>Spesen</span>
        <input
          type="text"
          inputMode="decimal"
          value={spesen}
          onChange={(e) => setSpesen(e.target.value)}
        />
      </label>

      <label className="wb-feld wb-feld--breit">
        <span>Text</span>
        <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} />
      </label>

      <div className="wb-aktionen wb-feld--breit">
        <button className="wb-button" type="submit" disabled={laeuft}>
          {MAHNSTUFE_TEXT[stufe]} festhalten
        </button>
        <button className="wb-button wb-button--sekundaer" type="button" onClick={beiAbbruch}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}
