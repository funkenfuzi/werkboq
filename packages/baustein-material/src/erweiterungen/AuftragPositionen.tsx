import { useCallback, useEffect, useState } from "react";
import {
  aktuellerBenutzer,
  aktuellerRechtsraum,
  alsEuro,
  Auftragskachel,
  alsGeld,
  alsMenge,
  ausGeld,
  darfSchreiben,
  fehlersatz,
  satzText,
  schreibweiseVon,
  Symbol,
  zahlText,
  type ErweiterungsProps,
  type UstSatz,
} from "@werkboq/core";
import {
  ARTIKELART_TEXT,
  ARTIKELARTEN,
  artikelSuchen,
  EINHEITEN,
  type Artikel,
  type Artikelart,
} from "../daten/artikel";
import { Materialerfassung } from "../komponenten/Materialerfassung";
import {
  alleFreigeben,
  ausArtikel,
  freigeben,
  LEERE_POSITION,
  nurFreigegebene,
  nurVorschlaege,
  naechstePos,
  positionAendern,
  positionAnlegen,
  positionLoeschen,
  positionenZuAuftrag,
  positionswert,
  positionVerschieben,
  summieren,
  type Position,
  type PositionEingabe,
} from "../daten/positionen";

/**
 * Positionen in der Auftragsakte.
 *
 * Hängt an "auftrag.abschnitt". Zeigt, was verbaut und geleistet wurde, mit
 * Summe je Steuersatz — dieselbe Aufstellung, die später auf der Rechnung
 * steht. Die Stunden stehen bewusst in ihrem eigenen Block darüber: eine
 * Stunde ist keine Position, und wer beides vermischt, verrechnet sie
 * irgendwann doppelt.
 */
export function AuftragPositionen({ datensatzId }: ErweiterungsProps) {
  // Steuersätze, Währung und Schreibweise hängen am Rechtsraum des Betriebs.
  const raum = aktuellerRechtsraum();
  const geld = schreibweiseVon(raum.id);
  const [positionen, setPositionen] = useState<Position[]>([]);
  const [maske, setMaske] = useState<Position | "neu" | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(() => {
    if (!datensatzId) return;
    positionenZuAuftrag(datensatzId)
      .then(setPositionen)
      .catch((e: unknown) => setFehler(e instanceof Error ? e.message : String(e)));
  }, [datensatzId]);

  useEffect(laden, [laden]);

  if (!datensatzId) return null;

  // Nur Freigegebenes zählt in der Summe — genau das geht auch auf den
  // Beleg. Die Vorschläge stehen darüber in ihrem eigenen Block, damit
  // niemand sie übersieht, aber sie verfälschen keine Zahl.
  const gueltig = nurFreigegebene(positionen);
  const vorschlaege = nurVorschlaege(positionen);
  const summen = summieren(gueltig);
  const darfFreigeben = darfSchreiben("lager");

  async function entfernen(p: Position) {
    if (!confirm(`Position ${p.pos} „${p.bezeichnung}" entfernen?`)) return;
    await positionLoeschen(p);
    laden();
  }

  /**
   * Reihenfolge tauschen. Gerechnet wird über die angezeigte Liste, nicht
   * über alle Positionen — sonst tauscht der Pfeil mit einem Vorschlag,
   * der gar nicht in der Tabelle steht.
   */
  async function schieben(sichtbar: Position[], i: number, richtung: -1 | 1) {
    const a = sichtbar[i];
    const b = sichtbar[i + richtung];
    if (!a || !b) return;
    await positionVerschieben(a, b);
    laden();
  }

  async function freigabe(p: Position) {
    try {
      await freigeben(p, aktuellerBenutzer()?.id);
      laden();
    } catch (e: unknown) {
      setFehler(fehlersatz(e));
    }
  }

  async function alleFreigabe() {
    try {
      await alleFreigeben(vorschlaege, aktuellerBenutzer()?.id);
      laden();
    } catch (e: unknown) {
      setFehler(fehlersatz(e));
    }
  }

  // Die Erfassung durch den Monteur steht seit der Aufteilung in Reiter
  // unter „Arbeit" (siehe MaterialImAuftrag unten). Hier, unter
  // „Abrechnung", steht nur noch das Ergebnis: was zählt und was wartet.
  return (
    <>
    <section className="wb-block">
      <div className="wb-block__kopf">
        <h2>Positionen</h2>
        <span className="wb-block__summe">
          {alsEuro(summen.netto, geld)} netto · {alsEuro(summen.brutto, geld)} brutto
        </span>
        {/*
          Eine Position von Hand anzulegen setzt sie sofort auf
          freigegeben — das lässt der Server ohne Lagerrecht nicht zu.
          Der Knopf wäre dort also ein Knopf, der eine Fehlermeldung
          erzeugt. Wer das Recht nicht hat, erfasst über den Block
          darüber, und das ist auch der schnellere Weg.
        */}
        {!maske && darfFreigeben && (
          <button className="wb-button" type="button" onClick={() => setMaske("neu")}>
            <Symbol name="plus" groesse={18} />
            Position
          </button>
        )}
      </div>

      {fehler && (
        <p className="wb-fehler" role="alert">
          {fehler}
        </p>
      )}

      {maske && (
        <Positionsmaske
          key={maske === "neu" ? "neu" : maske.id}
          auftrag={datensatzId}
          vorhanden={maske === "neu" ? null : maske}
          naechste={naechstePos(positionen)}
          beiGespeichert={() => {
            setMaske(null);
            laden();
          }}
          beiAbbruch={() => setMaske(null)}
        />
      )}

      {vorschlaege.length > 0 && (
        <Vorschlagsblock
          liste={vorschlaege}
          geld={geld}
          darfFreigeben={darfFreigeben}
          beiFreigeben={(p) => void freigabe(p)}
          beiAlleFreigeben={() => void alleFreigabe()}
          beiAendern={(p) => setMaske(p)}
          beiVerwerfen={(p) => void entfernen(p)}
        />
      )}

      {gueltig.length === 0 ? (
        <p className="wb-leer">
          {vorschlaege.length > 0
            ? "Noch nichts freigegeben. Was oben steht, kommt erst nach der Freigabe auf einen Beleg."
            : "Noch keine Positionen. Material und Leistungen hier eintragen — daraus entsteht später Angebot und Rechnung."}
        </p>
      ) : (
        <>
          <div className="wb-tabelle-rahmen">
            <table className="wb-tabelle wb-tabelle--positionen">
              <thead>
                <tr>
                  <th scope="col">Pos</th>
                  <th scope="col">Bezeichnung</th>
                  <th scope="col" className="wb-zelle--rechts">Menge</th>
                  <th scope="col">Einheit</th>
                  <th scope="col" className="wb-zelle--rechts">Einzel</th>
                  <th scope="col" className="wb-zelle--rechts">Rabatt</th>
                  <th scope="col" className="wb-zelle--rechts">{raum.steuerKurz}</th>
                  <th scope="col" className="wb-zelle--rechts">Betrag</th>
                  <th scope="col" aria-label="Aktionen" />
                </tr>
              </thead>
              <tbody>
                {gueltig.map((p, i) => (
                  <tr key={p.id} className={p.verrechnet ? "ist-verrechnet" : ""}>
                    <td className="wb-tabelle__kennung">{p.pos}</td>
                    <td>
                      <span className="wb-zellname">
                        <span className={`wb-punkt wb-punkt--${p.art}`} aria-hidden="true" />
                        <span>
                          {p.bezeichnung}
                          {p.beschreibung && <small>{p.beschreibung}</small>}
                        </span>
                      </span>
                    </td>
                    <td className="wb-zelle--rechts wb-tabelle__kennung">{alsMenge(p.menge, geld)}</td>
                    <td className="wb-zelle--gedaempft">{p.einheit}</td>
                    <td className="wb-zelle--rechts wb-tabelle__kennung">{alsGeld(p.einzelpreis, geld)}</td>
                    <td className="wb-zelle--rechts wb-tabelle__kennung">
                      {p.rabatt ? `${p.rabatt} %` : "—"}
                    </td>
                    <td className="wb-zelle--rechts wb-tabelle__kennung">{zahlText(raum, p.ustsatz)} %</td>
                    <td className="wb-zelle--rechts wb-tabelle__kennung wb-zelle--betont">
                      {alsGeld(positionswert(p), geld)}
                    </td>
                    <td className="wb-zelle--rechts">
                      {darfFreigeben && (
                      <>
                      <button
                        type="button"
                        className="wb-zeilenknopf wb-zeilenknopf--neutral"
                        onClick={() => void schieben(gueltig, i, -1)}
                        disabled={i === 0}
                        title="nach oben"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="wb-zeilenknopf wb-zeilenknopf--neutral"
                        onClick={() => void schieben(gueltig, i, 1)}
                        disabled={i === gueltig.length - 1}
                        title="nach unten"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="wb-zeilenknopf wb-zeilenknopf--neutral"
                        onClick={() => setMaske(p)}
                        title="bearbeiten"
                      >
                        <Symbol name="stift" groesse={16} />
                      </button>
                      <button
                        type="button"
                        className="wb-zeilenknopf"
                        onClick={() => void entfernen(p)}
                        title="entfernen"
                      >
                        <Symbol name="muell" groesse={16} />
                      </button>
                      </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <dl className="wb-aufstellung">
            {[...summen.nettoJeSatz.entries()]
              .sort((a, b) => b[0] - a[0])
              .map(([satz, betrag]) => (
                <div key={satz}>
                  <dt>Netto {zahlText(raum, Number(satz))} %</dt>
                  <dd>{alsEuro(betrag, geld)}</dd>
                </div>
              ))}
            <div>
              <dt>Nettosumme</dt>
              <dd>{alsEuro(summen.netto, geld)}</dd>
            </div>
            <div>
              <dt>{raum.steuerName}</dt>
              <dd>{alsEuro(summen.ust, geld)}</dd>
            </div>
            <div className="wb-aufstellung__gesamt">
              <dt>Gesamt</dt>
              <dd>{alsEuro(summen.brutto, geld)}</dd>
            </div>
          </dl>
        </>
      )}
    </section>
    </>
  );
}

function Positionsmaske({
  auftrag,
  vorhanden,
  naechste,
  beiGespeichert,
  beiAbbruch,
}: {
  auftrag: string;
  vorhanden: Position | null;
  naechste: number;
  beiGespeichert: () => void;
  beiAbbruch: () => void;
}) {
  const raum = aktuellerRechtsraum();
  const geld = schreibweiseVon(raum.id);
  const [werte, setWerte] = useState<PositionEingabe>(
    vorhanden
      ? { ...vorhanden }
      : { ...LEERE_POSITION, auftrag, pos: naechste, ustsatz: raum.normalsatz },
  );
  // Preise tippt man als "12,50"; im Datensatz stehen Cent.
  const [preistext, setPreistext] = useState(
    vorhanden ? (vorhanden.einzelpreis / 100).toFixed(2).replace(".", ",") : "0,00",
  );
  const [suche, setSuche] = useState("");
  const [treffer, setTreffer] = useState<Artikel[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [speichert, setSpeichert] = useState(false);

  useEffect(() => {
    if (suche.trim().length < 2) {
      setTreffer([]);
      return;
    }
    let weg = false;
    const zeit = setTimeout(() => {
      artikelSuchen(suche, 8)
        .then((l) => !weg && setTreffer(l))
        .catch(() => !weg && setTreffer([]));
    }, 200);
    return () => {
      weg = true;
      clearTimeout(zeit);
    };
  }, [suche]);

  function uebernehmen(a: Artikel) {
    setWerte(ausArtikel(a, auftrag, werte.pos, werte.menge || 1));
    setPreistext((a.preis / 100).toFixed(2).replace(".", ","));
    setSuche("");
    setTreffer([]);
  }

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    const preis = ausGeld(preistext);
    if (Number.isNaN(preis)) {
      setFehler("Der Einzelpreis ist keine Zahl — etwa 12,50 eingeben.");
      return;
    }
    if (!werte.bezeichnung.trim()) {
      setFehler("Eine Bezeichnung ist Pflicht.");
      return;
    }
    setSpeichert(true);
    setFehler(null);
    try {
      // Wer einen Vorschlag von der Baustelle bearbeitet und speichert,
      // hat ihn damit geprüft — das ist die Freigabe. Ein zweiter Klick
      // auf "Freigeben" danach wäre eine Frage, die sich schon erübrigt
      // hat, und genau solche Klicks bleiben im Alltag liegen.
      const freigabe =
        vorhanden?.zustand === "vorschlag" && darfSchreiben("lager")
          ? {
              zustand: "freigegeben" as const,
              freigabeVon: aktuellerBenutzer()?.id,
              freigabeAm: new Date().toISOString().slice(0, 10),
            }
          : {};
      const fertig = { ...werte, einzelpreis: preis, ...freigabe };
      if (vorhanden) await positionAendern(vorhanden, fertig);
      else await positionAnlegen(fertig);
      beiGespeichert();
    } catch (e: unknown) {
      setFehler(e instanceof Error ? e.message : String(e));
    } finally {
      setSpeichert(false);
    }
  }

  const vorschau = positionswert({
    menge: werte.menge,
    einzelpreis: ausGeld(preistext) || 0,
    rabatt: werte.rabatt,
  });

  return (
    <form className="wb-maske" onSubmit={absenden}>
      {!vorhanden && (
        <div className="wb-feld wb-feld--breit wb-artikelsuche">
          <span>Aus dem Katalog übernehmen</span>
          <input
            type="search"
            placeholder="Artikelnummer oder Bezeichnung …"
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
          />
          {treffer.length > 0 && (
            <ul className="wb-artikelsuche__liste">
              {treffer.map((a) => (
                <li key={a.id}>
                  <button type="button" onClick={() => uebernehmen(a)}>
                    <span className="wb-tabelle__kennung">{a.nummer}</span>
                    <span>{a.bezeichnung}</span>
                    <span className="wb-zelle--gedaempft">
                      {alsGeld(a.preis, geld)} / {a.einheit}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <small className="wb-notiz">
            Der Preis wird kopiert, nicht verknüpft — ein späterer Preiswechsel im Katalog ändert
            diese Position nicht.
          </small>
        </div>
      )}

      <label className="wb-feld wb-feld--schmal">
        <span>Pos</span>
        <input
          type="number"
          min={0}
          step={10}
          value={werte.pos}
          onChange={(e) => setWerte({ ...werte, pos: Number(e.target.value) })}
        />
      </label>

      <label className="wb-feld">
        <span>Art</span>
        <select
          value={werte.art}
          onChange={(e) => setWerte({ ...werte, art: e.target.value as Artikelart })}
        >
          {ARTIKELARTEN.map((a) => (
            <option key={a} value={a}>
              {ARTIKELART_TEXT[a]}
            </option>
          ))}
        </select>
      </label>

      <label className="wb-feld wb-feld--breit">
        <span>Bezeichnung *</span>
        <input
          type="text"
          value={werte.bezeichnung}
          onChange={(e) => setWerte({ ...werte, bezeichnung: e.target.value })}
          required
        />
      </label>

      <label className="wb-feld wb-feld--breit">
        <span>Beschreibung</span>
        <input
          type="text"
          placeholder="steht als kleine Zeile unter der Bezeichnung"
          value={werte.beschreibung ?? ""}
          onChange={(e) => setWerte({ ...werte, beschreibung: e.target.value })}
        />
      </label>

      <label className="wb-feld wb-feld--schmal">
        <span>Menge *</span>
        <input
          type="number"
          step="0.001"
          value={werte.menge}
          onChange={(e) => setWerte({ ...werte, menge: Number(e.target.value) })}
          required
        />
      </label>

      <label className="wb-feld wb-feld--schmal">
        <span>Einheit</span>
        <input
          type="text"
          list="wb-einheiten"
          value={werte.einheit}
          onChange={(e) => setWerte({ ...werte, einheit: e.target.value })}
        />
        <datalist id="wb-einheiten">
          {EINHEITEN.map((e) => (
            <option key={e} value={e} />
          ))}
        </datalist>
      </label>

      <label className="wb-feld wb-feld--schmal">
        <span>Einzelpreis netto *</span>
        <input
          type="text"
          inputMode="decimal"
          value={preistext}
          onChange={(e) => setPreistext(e.target.value)}
          required
        />
      </label>

      <label className="wb-feld wb-feld--schmal">
        <span>Rabatt %</span>
        <input
          type="number"
          min={0}
          max={100}
          step="0.5"
          value={werte.rabatt ?? 0}
          onChange={(e) => setWerte({ ...werte, rabatt: Number(e.target.value) })}
        />
      </label>

      <label className="wb-feld">
        <span>{raum.steuerName}</span>
        <select
          value={werte.ustsatz}
          onChange={(e) => setWerte({ ...werte, ustsatz: Number(e.target.value) as UstSatz })}
        >
          {raum.steuersaetze.map((s) => (
            <option key={s.satz} value={s.satz}>
              {satzText(raum, s.satz)}
            </option>
          ))}
        </select>
      </label>

      <div className="wb-feld">
        <span>Betrag netto</span>
        <output className="wb-dauer">{alsEuro(vorschau, geld)}</output>
      </div>

      {fehler && (
        <p className="wb-fehler wb-feld--breit" role="alert">
          {fehler}
        </p>
      )}

      <div className="wb-aktionen wb-feld--breit">
        <button className="wb-button" type="submit" disabled={speichert}>
          {vorhanden ? "Speichern" : "Hinzufügen"}
        </button>
        <button className="wb-button wb-button--sekundaer" type="button" onClick={beiAbbruch}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}

/**
 * Was von der Baustelle hereingekommen ist und noch niemand geprüft hat.
 *
 * Steht ÜBER der Positionsliste und nicht darin: eine Zeile, die noch
 * nicht zählt, darf nicht zwischen Zeilen stehen, die zählen — sonst
 * verrechnet sich jemand beim Überfliegen, und genau darum geht es bei
 * einer Rechnung.
 *
 * Wer Material nicht verwalten darf, sieht seine eigenen Vorschläge, aber
 * keine Freigabeknöpfe. Das Recht liegt serverseitig noch nicht fest —
 * siehe docs/rechte.md; hier ist es bisher nur die Oberfläche.
 */
function Vorschlagsblock({
  liste,
  geld,
  darfFreigeben,
  beiFreigeben,
  beiAlleFreigeben,
  beiAendern,
  beiVerwerfen,
}: {
  liste: Position[];
  geld: ReturnType<typeof schreibweiseVon>;
  darfFreigeben: boolean;
  beiFreigeben: (p: Position) => void;
  beiAlleFreigeben: () => void;
  beiAendern: (p: Position) => void;
  beiVerwerfen: (p: Position) => void;
}) {
  const summe = liste.reduce((s, p) => s + positionswert(p), 0);

  return (
    <div className="wb-vorschlaege">
      <div className="wb-vorschlaege__kopf">
        <Symbol name="warnung" groesse={18} />
        <div>
          <strong>
            {liste.length === 1
              ? "Eine Position von der Baustelle"
              : `${liste.length} Positionen von der Baustelle`}
          </strong>
          <span>
            {alsEuro(summe, geld)} netto — zählt erst nach der Freigabe und kommt bis dahin auf
            keinen Beleg.
          </span>
        </div>
        {darfFreigeben && liste.length > 1 && (
          <button className="wb-button" type="button" onClick={beiAlleFreigeben}>
            <Symbol name="haken" groesse={18} />
            Alle freigeben
          </button>
        )}
      </div>

      <ul className="wb-vorschlagsliste">
        {liste.map((p) => (
          <li key={p.id}>
            <span className="wb-vorschlagsliste__menge">
              {alsMenge(p.menge, geld)} {p.einheit}
            </span>
            <span className="wb-vorschlagsliste__name">
              {p.bezeichnung}
              <small>
                {ARTIKELART_TEXT[p.art]} · {alsGeld(p.einzelpreis, geld)} / {p.einheit}
              </small>
            </span>
            <span className="wb-vorschlagsliste__betrag">{alsGeld(positionswert(p), geld)}</span>
            {darfFreigeben && (
              <span className="wb-aktionen wb-aktionen--eng">
                <button
                  type="button"
                  className="wb-button wb-button--klein"
                  onClick={() => beiFreigeben(p)}
                >
                  Freigeben
                </button>
                <button
                  type="button"
                  className="wb-zeilenknopf wb-zeilenknopf--neutral"
                  onClick={() => beiAendern(p)}
                  title="ändern"
                >
                  <Symbol name="stift" groesse={16} />
                </button>
                <button
                  type="button"
                  className="wb-zeilenknopf"
                  onClick={() => beiVerwerfen(p)}
                  title="verwerfen"
                >
                  <Symbol name="muell" groesse={16} />
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Reiter „Arbeit": die Materialerfassung.
 *
 * Aufgeklappt für den, der Material nicht verwalten darf — das ist der
 * Monteur, und der kommt genau dafür her. Wer es darf, sitzt im Büro und
 * klappt sie bei Bedarf auf.
 */
export function MaterialImAuftrag({ datensatzId }: ErweiterungsProps) {
  if (!datensatzId) return null;
  return <Materialerfassung auftragId={datensatzId} offenAnfangs={!darfSchreiben("lager")} />;
}

/** Zwei Kacheln im Überblick: was von der Baustelle wartet, und was zählt. */
export function MaterialKacheln({ datensatzId }: ErweiterungsProps) {
  const [positionen, setPositionen] = useState<Position[] | null>(null);

  useEffect(() => {
    if (!datensatzId) return;
    positionenZuAuftrag(datensatzId)
      .then(setPositionen)
      .catch(() => setPositionen([]));
  }, [datensatzId]);

  if (!datensatzId || positionen === null) return null;
  const geld = schreibweiseVon(aktuellerRechtsraum().id);
  const offen = nurVorschlaege(positionen).length;
  const summe = summieren(nurFreigegebene(positionen));

  return (
    <>
      <Auftragskachel
        auftragId={datensatzId}
        reiter="arbeit"
        titel="Material"
        wert={offen ? `${offen} offen` : "—"}
        zusatz={offen ? "von der Baustelle, nicht freigegeben" : "nichts wartet"}
        achtung={offen > 0}
      />
      <Auftragskachel
        auftragId={datensatzId}
        reiter="abrechnung"
        titel="Positionen"
        wert={alsEuro(summe.netto, geld)}
        zusatz={`${nurFreigegebene(positionen).length} Zeilen, netto`}
      />
    </>
  );
}
